import { useAppContext } from "@/context/app-context";
import { Outlet } from "react-router";
import { useCallback, useEffect, useState } from "react";
import { DomainWarning } from "../domain-warning/domain-warning";
import { QuickActions } from "../quick-actions/quick-actions";
import { isTrustedDomain } from "@/lib/hooks/redirect-uri";

const BaseLayout = ({ children }: { children: React.ReactNode }) => {
  const { ui } = useAppContext();

  useEffect(() => {
    document.title = ui.title;
  }, [ui.title]);

  return (
    <div className="haiiro-shell relative flex min-h-svh flex-col overflow-hidden px-6 py-8 sm:px-10 lg:px-16">
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col">
        <header className="mb-12 flex items-start justify-between gap-8">
          <div>
            <p className="haiiro-eyebrow mb-3">HAIIRO AUTH / ACCESS CONTROL</p>
            <h1 className="haiiro-wordmark">
              <span>HAIIRO</span> <span className="haiiro-wordmark-accent">AUTH</span>
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2 pt-1 text-right">
            <span className="haiiro-status-mark">0</span>
            <span className="haiiro-meta">active sessions</span>
          </div>
        </header>

        <main className="flex flex-1 items-start justify-center">
          <div className="w-full max-w-xl">{children}</div>
        </main>

        <footer className="haiiro-footer mt-12 flex flex-wrap justify-between gap-4">
          <span>Authentication is required to continue.</span>
          <span>standalone / protected</span>
        </footer>
      </div>
      <div className="absolute right-4 top-4 z-20">
        <QuickActions />
      </div>
    </div>
  );
};

export const Layout = () => {
  const { app, ui } = useAppContext();
  const [ignoreDomainWarning, setIgnoreDomainWarning] = useState(() => {
    return window.sessionStorage.getItem("ignoreDomainWarning") === "true";
  });
  const currentUrl = window.location.origin;

  const handleIgnore = useCallback(() => {
    window.sessionStorage.setItem("ignoreDomainWarning", "true");
    setIgnoreDomainWarning(true);
  }, [setIgnoreDomainWarning]);

  const isTrusted = (() => {
    try {
      const appUrlObj = new URL(app.appUrl);
      const currentUrlObj = new URL(currentUrl);

      return isTrustedDomain(currentUrlObj, appUrlObj, "", false);
    } catch {
      return false;
    }
  })();

  if (!ignoreDomainWarning && ui.warningsEnabled && !isTrusted) {
    return (
      <BaseLayout>
        <DomainWarning
          appUrl={app.appUrl}
          currentUrl={currentUrl}
          onClick={() => handleIgnore()}
        />
      </BaseLayout>
    );
  }

  return (
    <BaseLayout>
      <Outlet />
    </BaseLayout>
  );
};
