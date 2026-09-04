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
    <div className="square-ui relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div className="absolute right-4 top-4 z-10">
        <QuickActions />
      </div>
      <div className="relative z-10 w-full max-w-sm md:min-w-sm">{children}</div>
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
