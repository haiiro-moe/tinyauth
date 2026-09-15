import { useTranslation } from "react-i18next";
import { Input } from "../ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import {
  accountPasswordSchema,
  AccountPasswordSchema,
} from "@/schemas/account-password-schema";
import z from "zod";

interface Props {
  onSubmit: (data: AccountPasswordSchema) => void;
  loading?: boolean;
  formId?: string;
}

export const PasswordForm = (props: Props) => {
  const { onSubmit, loading, formId } = props;
  const { t } = useTranslation();

  z.config({
    customError: (iss) =>
      iss.input === undefined ? t("fieldRequired") : t("invalidInput"),
  });

  const form = useForm<AccountPasswordSchema>({
    resolver: zodResolver(accountPasswordSchema),
  });

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem className="mb-4 gap-0">
              <FormLabel className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t("accountCurrentPassword")}
              </FormLabel>
              <FormControl className="mb-1">
                <Input
                  type="password"
                  disabled={loading}
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem className="mb-4 gap-0">
              <FormLabel className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t("accountNewPassword")}
              </FormLabel>
              <FormControl className="mb-1">
                <Input
                  type="password"
                  disabled={loading}
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem className="gap-0">
              <FormLabel className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t("accountConfirmPassword")}
              </FormLabel>
              <FormControl className="mb-1">
                <Input
                  type="password"
                  disabled={loading}
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
};
