import { z } from "zod";

export const accountPasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
  });

export type AccountPasswordSchema = z.infer<typeof accountPasswordSchema>;
