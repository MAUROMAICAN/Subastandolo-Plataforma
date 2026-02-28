/**
 * Esquemas Zod para validación de formularios.
 */

import { z } from "zod";
import { LIMITS } from "./constants";

export const emailSchema = z
  .string()
  .min(1, "El correo es requerido")
  .email("Correo electrónico inválido")
  .max(255);

export const passwordSchema = z
  .string()
  .min(6, "La contraseña debe tener al menos 6 caracteres")
  .max(72);

export const fullNameSchema = z
  .string()
  .min(2, "El nombre debe tener al menos 2 caracteres")
  .max(LIMITS.fullName);

export const phoneSchema = z
  .string()
  .regex(/^[\d+\-() ]+$/, "Teléfono inválido")
  .max(LIMITS.phone)
  .optional()
  .or(z.literal(""));

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
  phone: phoneSchema,
  termsAccepted: z.boolean().refine((v) => v === true, {
    message: "Debes aceptar los términos y condiciones",
  }),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const bidAmountSchema = z
  .number()
  .positive("El monto debe ser mayor a 0")
  .refine((n) => Number.isFinite(n), "Monto inválido");

export const searchQuerySchema = z
  .string()
  .max(LIMITS.searchQuery)
  .optional()
  .default("");
