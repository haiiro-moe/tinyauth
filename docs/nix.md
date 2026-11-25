# Nix / NixOS

The repository ships a `flake.nix` for `x86_64-linux` and `aarch64-linux`. It needs Nix with
the `nix-command` and `flakes` features enabled.

## Development shell

```sh
nix develop          # or `direnv allow` once, using the bundled .envrc
make deps            # pnpm ci + go mod download
make test
make vet
```

The shell provides Go 1.26, Node.js 26 and pnpm 11 (the versions the `Dockerfile` and
`frontend/package.json` ask for), plus `make`, `sqlc`, `gopls`, `golangci-lint`, `docker-compose`
and `git`. `make dev` still needs a Docker daemon on the host. Inside `frontend/`, pnpm switches
itself to the exact version in `packageManager` (11.1.2), downloading it on first use.

`go test` and `go vet` need `internal/assets/dist` to exist, because the frontend is embedded with
`//go:embed dist`. Either build the frontend (`make webui`) or create the same stub `air.toml` uses:

```sh
mkdir -p internal/assets/dist && echo 'backend running' > internal/assets/dist/index.html
```

## Building the binary

```sh
nix build            # result/bin/tinyauth
nix run . -- version
nix flake check      # builds the package, which runs `go test ./...`
```

The package builds in two stages, like the `Dockerfile`: `.#frontend` builds the React app with
pnpm, then the Go build embeds it and builds with `CGO_ENABLED=0`, `-tags nomsgpack` and the
same `-ldflags` as the Makefile. The version is reported as `main` with the flake's commit hash and
commit date. The full Go test suite runs during the build.

When `frontend/pnpm-lock.yaml` or `go.mod`/`go.sum` change, the dependency hashes in `flake.nix`
(`pnpmDeps.hash` and `vendorHash`) must be updated. Set the hash to `lib.fakeHash`, run
`nix build`, and copy the hash Nix reports.

## Running

```sh
TINYAUTH_APPURL=http://tinyauth.127.0.0.1.sslip.io:3000 \
TINYAUTH_DATABASE_PATH=/var/lib/tinyauth/tinyauth.db \
TINYAUTH_RESOURCES_PATH=/var/lib/tinyauth/resources \
  ./result/bin/tinyauth
```

At least one authentication provider is required, for example
`TINYAUTH_AUTH_USERS` with a user from `tinyauth user create`. The defaults write the database and
resources into the working directory, so point them at a writable directory. See the
[documentation](https://tinyauth.app) for the other options.

On NixOS, nixpkgs has a `services.tinyauth` module. To run this checkout with it, set
`services.tinyauth.package = inputs.tinyauth.packages.${pkgs.stdenv.hostPlatform.system}.default;`.
