import { PasswordForm } from "@/components/account/password-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useUserContext } from "@/context/user-context";
import { AccountPasswordSchema } from "@/schemas/account-password-schema";
import { useMutation } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { toast } from "sonner";

export const AccountPage = () => {
  const { auth } = useUserContext();
  const { t } = useTranslation();
  const formId = useId();

  const isLdap = auth.providerId === "ldap";

  const passwordMutation = useMutation({
    mutationFn: (values: AccountPasswordSchema) =>
      axios.post("/api/user/password", values),
    mutationKey: ["account-password"],
    onSuccess: () => {
      toast.success(t("accountPasswordSuccessTitle"), {
        description: t("accountPasswordSuccessSubtitle"),
      });
      passwordMutation.reset();
    },
    onError: (error: AxiosError) => {
      toast.error(t("accountPasswordFailTitle"), {
        description:
          error.response?.status === 429
            ? t("loginFailRateLimit")
            : t("accountPasswordFailSubtitle"),
      });
    },
  });

  if (!auth.authenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Card>
      <CardHeader className="gap-1.5">
        <CardTitle className="text-xl">{t("accountTitle")}</CardTitle>
        <CardDescription>{t("accountSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t("accountUsername")}
            </dt>
            <dd className="mt-1 truncate">{auth.username}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t("accountName")}
            </dt>
            <dd className="mt-1 truncate">{auth.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t("accountEmail")}
            </dt>
            <dd className="mt-1 truncate">{auth.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t("accountProvider")}
            </dt>
            <dd className="mt-1 truncate">
              {t(
                isLdap
                  ? "quickActionsProviderLDAP"
                  : "quickActionsProviderLocal",
              )}
            </dd>
          </div>
        </dl>

        <Separator />

        {isLdap ? (
          <div>
            <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
              {t("accountChangePassword")}
            </h2>
            <PasswordForm
              formId={formId}
              loading={passwordMutation.isPending}
              onSubmit={(values) => passwordMutation.mutate(values)}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("accountPasswordUnavailable")}
          </p>
        )}
      </CardContent>
      {isLdap && (
        <CardFooter>
          <Button
            className="w-full"
            form={formId}
            type="submit"
            loading={passwordMutation.isPending}
          >
            {t("accountChangePasswordSubmit")}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};
