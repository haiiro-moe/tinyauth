{
  description = "Tinyauth: authentication server and OpenID Connect provider (dev shell and package)";

  inputs = {
    # Rolling channel. The exact revision is pinned in flake.lock; bump it with `nix flake update`.
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      inherit (nixpkgs) lib;

      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = f: lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});

      # Toolchains. AGENTS.md says the Dockerfile is the source of truth for the Go and Node
      # versions, and frontend/package.json for pnpm:
      #   - Go: `golang:1.26` (go.mod: `go 1.26.4`). nixpkgs' default `go` is already 1.27, so pin
      #     the 1.26 line explicitly to build with the same major as the Docker image.
      #   - Node: `node:26.8`, so `nodejs_26`.
      #   - pnpm: "packageManager": "pnpm@11.1.2". nixpkgs ships only the newest release of each
      #     major, so `pnpm_11` is a newer 11.x. The lockfile format (9.0) is the same. The Nix
      #     build uses it as is (pnpmConfigHook sets pm_on_fail=ignore); in the dev shell pnpm
      #     still switches itself to 11.1.2 inside frontend/, as it does everywhere else.
      minGo = "1.26.4";
      toolchain = pkgs: {
        go = pkgs.go_1_26;
        buildGoModule = pkgs.buildGo126Module;
        nodejs = pkgs.nodejs_26;
        # pnpm runs on nodejs-slim; overriding `nodejs` is deprecated and only warns.
        pnpm = pkgs.pnpm_11.override { nodejs-slim = pkgs.nodejs-slim_26; };
      };

      # Metadata baked into the binary, mirroring the Makefile's `binary` target. Untagged builds
      # report "main" there too. The timestamp comes from the commit date instead of `date` so the
      # build stays reproducible. A dirty tree has no `rev`, hence the fallbacks.
      commitHash = self.rev or self.dirtyRev or "dirty";
      buildTimestamp =
        let
          d = self.lastModifiedDate or "19700101000000";
        in
        "${builtins.substring 0 4 d}-${builtins.substring 4 2 d}-${builtins.substring 6 2 d}T"
        + "${builtins.substring 8 2 d}:${builtins.substring 10 2 d}:${builtins.substring 12 2 d}";
      # Derivation version. Kept constant on purpose: the fixed-output dependency derivations
      # (pnpm store, Go vendor dir) carry it in their names, so a per-commit version would make
      # Nix re-download every dependency on each commit. The commit is in the ldflags instead.
      version = "main";
    in
    {
      packages = forAllSystems (
        pkgs:
        let
          tc = toolchain pkgs;

          # Stage 1: the React frontend, built exactly like CI and the Dockerfile
          # (`pnpm ci` then `pnpm run build`, i.e. `tsc -b && vite build`).
          frontend = pkgs.stdenv.mkDerivation (finalAttrs: {
            pname = "tinyauth-frontend";
            inherit version;

            # Only the files the Dockerfile copies into its frontend stage.
            src = lib.fileset.toSource {
              root = ./frontend;
              fileset = lib.fileset.unions [
                ./frontend/package.json
                ./frontend/pnpm-lock.yaml
                ./frontend/pnpm-workspace.yaml
                ./frontend/public
                ./frontend/src
                ./frontend/eslint.config.js
                ./frontend/index.html
                ./frontend/tsconfig.json
                ./frontend/tsconfig.app.json
                ./frontend/tsconfig.node.json
                ./frontend/vite.config.ts
              ];
            };

            nativeBuildInputs = [
              tc.nodejs
              tc.pnpm
              pkgs.pnpmConfigHook
            ];

            # Fixed-output derivation holding the pnpm store for the locked dependencies.
            # Whenever frontend/pnpm-lock.yaml changes, set `hash = lib.fakeHash;`, run
            # `nix build .#frontend`, and paste the hash Nix reports.
            pnpmDeps = pkgs.fetchPnpmDeps {
              inherit (finalAttrs) pname version src;
              pnpm = tc.pnpm;
              fetcherVersion = 5;
              hash = "sha256-Qa2dN1L6DX8Ob7awVAXd7148rKdk5epEY2fwV1dsVM8=";
            };

            buildPhase = ''
              runHook preBuild
              pnpm run build
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              cp -r dist $out
              runHook postInstall
            '';
          });

          # Stage 2: the Go binary with the frontend embedded through `//go:embed dist` in
          # internal/assets/assets.go. Flags match the Makefile, Dockerfile and release workflow.
          tinyauth =
            assert lib.assertMsg (lib.versionAtLeast tc.go.version minGo)
              "go_1_26 in this nixpkgs (${tc.go.version}) is older than go.mod's ${minGo}";
            tc.buildGoModule {
              pname = "tinyauth";
              inherit version;

              # Only what the Dockerfile copies into its Go builder stage. Untracked files such as
              # a local internal/assets/dist are never part of a flake source anyway.
              src = lib.fileset.toSource {
                root = ./.;
                fileset = lib.fileset.unions [
                  ./go.mod
                  ./go.sum
                  ./cmd
                  ./internal
                  ./pkg
                ];
              };

              # Hash of the vendored Go modules. Whenever go.mod or go.sum changes, set
              # `vendorHash = lib.fakeHash;`, run `nix build`, and paste the hash Nix reports.
              vendorHash = "sha256-x06lJ/bziMXsa7z45m6b7kk8C0NYKlNfN8Vw04h5e1s=";

              subPackages = [ "cmd/tinyauth" ];

              env.CGO_ENABLED = 0;
              # Drops Gin's msgpack codec, as GIN_BUILD_TAGS in the Makefile does.
              tags = [ "nomsgpack" ];
              ldflags = [
                "-s"
                "-w"
                "-X github.com/tinyauthapp/tinyauth/internal/model.Version=main"
                "-X github.com/tinyauthapp/tinyauth/internal/model.CommitHash=${commitHash}"
                "-X github.com/tinyauthapp/tinyauth/internal/model.BuildTimestamp=${buildTimestamp}"
              ];

              preBuild = ''
                rm -rf internal/assets/dist
                cp -r ${frontend} internal/assets/dist
                chmod -R u+w internal/assets/dist
              '';

              # buildGoModule would only test `subPackages` (cmd/tinyauth has no tests). Run the
              # whole suite instead, like CI's `go test ./...`, against the real embedded frontend.
              # It works offline in the sandbox.
              checkPhase = ''
                runHook preCheck
                go test -tags nomsgpack ./...
                runHook postCheck
              '';

              passthru = { inherit frontend; };

              meta = {
                description = "The tiniest authentication and authorization server";
                homepage = "https://github.com/tinyauthapp/tinyauth";
                license = lib.licenses.agpl3Only;
                mainProgram = "tinyauth";
                platforms = systems;
              };
            };
        in
        {
          inherit frontend tinyauth;
          default = tinyauth;
        }
      );

      # `nix flake check` only evaluates packages; listing them here makes it build them too,
      # which runs the Go test suite (see checkPhase above).
      checks = forAllSystems (pkgs: {
        inherit (self.packages.${pkgs.stdenv.hostPlatform.system}) tinyauth;
        devShell = self.devShells.${pkgs.stdenv.hostPlatform.system}.default;
      });

      apps = forAllSystems (pkgs: {
        default = {
          type = "app";
          program = lib.getExe self.packages.${pkgs.stdenv.hostPlatform.system}.tinyauth;
          meta.description = "Run the Tinyauth binary";
        };
      });

      devShells = forAllSystems (
        pkgs:
        let
          tc = toolchain pkgs;
        in
        {
          default = pkgs.mkShell {
            name = "tinyauth-dev";

            packages = [
              tc.go
              tc.nodejs
              tc.pnpm
              pkgs.gnumake
              pkgs.sqlc # `make sql`; CI pins sqlc 1.31.1
              pkgs.gopls
              pkgs.golangci-lint
              pkgs.docker-compose # `make dev` / `make prod` (needs a Docker daemon on the host)
              pkgs.git # the Makefile reads the tag and commit hash with git
            ];

            shellHook = ''
              # Matches the Makefile and keeps `go test` / `go vet` from needing a C compiler.
              export CGO_ENABLED=0
            '';
          };
        }
      );

      formatter = forAllSystems (pkgs: pkgs.nixfmt);
    };
}
