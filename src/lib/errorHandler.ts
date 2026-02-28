/**
 * Centralizado de manejo de errores para la app.
 * Unifica logging, reporting y traducción de errores.
 */

import { translateAuthError } from "./authErrors";

export type ErrorCategory = "auth" | "network" | "validation" | "supabase" | "unknown";

export interface AppError {
  message: string;
  category: ErrorCategory;
  original?: unknown;
  userMessage?: string;
}

/**
 * Determina la categoría del error
 */
function getErrorCategory(error: unknown): ErrorCategory {
  if (!error) return "unknown";
  const msg = String(typeof error === "object" && error !== null && "message" in error ? (error as { message: string }).message : error);
  const lower = msg.toLowerCase();
  if (lower.includes("fetch") || lower.includes("network") || lower.includes("failed to fetch")) return "network";
  if (lower.includes("invalid") || lower.includes("validation") || lower.includes("required")) return "validation";
  if (lower.includes("supabase") || lower.includes("postgres") || lower.includes("row level")) return "supabase";
  if (lower.includes("auth") || lower.includes("session") || lower.includes("login") || lower.includes("password")) return "auth";
  return "unknown";
}

/**
 * Extrae mensaje legible del error
 */
function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return "Error desconocido";
}

/**
 * Procesa un error y devuelve AppError normalizado
 */
export function normalizeError(error: unknown, context?: string): AppError {
  const message = extractMessage(error);
  const category = getErrorCategory(error);
  let userMessage: string | undefined;

  if (category === "auth") {
    userMessage = translateAuthError(message);
  } else if (category === "network") {
    userMessage = "Error de conexión. Verifica tu internet e intenta de nuevo.";
  } else if (category === "validation") {
    userMessage = message;
  } else if (category === "supabase") {
    userMessage = "Error al procesar la solicitud. Intenta de nuevo.";
  } else {
    userMessage = "Ha ocurrido un error inesperado. Intenta de nuevo.";
  }

  if (import.meta.env.DEV && error) {
    console.error(`[ErrorHandler]${context ? ` [${context}]` : ""}`, error);
  }

  return {
    message,
    category,
    original: error,
    userMessage,
  };
}

/**
 * Wrapper para ejecutar async con manejo de errores
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  fallback: T,
  onError?: (err: AppError) => void
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const appError = normalizeError(error);
    onError?.(appError);
    return fallback;
  }
}
