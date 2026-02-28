# Archivos faltantes para crear en Lovable

Estos archivos están en GitHub pero Lovable no los sincronizó. Cópialos manualmente en Lovable.

---

## 1. src/lib/errorHandler.ts

```
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

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return "Error desconocido";
}

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
```

---

## 2. src/lib/constants.ts

```
/**
 * Constantes centralizadas de la aplicación.
 */

export const APP = {
  name: "SUBASTANDOLO",
  description: "Plataforma de subastas online",
  lang: "es",
} as const;

export const LIMITS = {
  searchQuery: 200,
  fullName: 100,
  phone: 20,
  description: 5000,
  title: 200,
  amountDecimals: 2,
  bidMinIncrement: 0.01,
} as const;

export const FILE_UPLOAD = {
  allowedImageTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  maxSizeMB: 5,
  maxSizeBytes: 5 * 1024 * 1024,
} as const;

export const RATE_LIMIT = {
  loginAttempts: 4,
  lockoutMs: 15 * 60 * 1000,
  resendCooldownSeconds: 30,
  buttonClicksPerMinute: 10,
} as const;

export const PAGINATION = {
  defaultPageSize: 12,
  adminPageSize: 20,
} as const;
```

---

## 3. src/lib/validation.ts

```
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
```

---

## 4. src/lib/logger.ts

```
/**
 * Logger ligero para la app.
 * En desarrollo imprime a consola; en producción puede enviar a un servicio.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const minLevel = import.meta.env.DEV ? "debug" : "warn";
const minLevelNum = LOG_LEVELS[minLevel as LogLevel] ?? LOG_LEVELS.info;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= minLevelNum;
}

function formatMsg(tag: string, message: string): string {
  const ts = new Date().toISOString();
  return `[${ts}] [${tag}] ${message}`;
}

export const logger = {
  debug(tag: string, message: string, ...args: unknown[]): void {
    if (shouldLog("debug")) {
      console.debug(formatMsg(tag, message), ...args);
    }
  },
  info(tag: string, message: string, ...args: unknown[]): void {
    if (shouldLog("info")) {
      console.info(formatMsg(tag, message), ...args);
    }
  },
  warn(tag: string, message: string, ...args: unknown[]): void {
    if (shouldLog("warn")) {
      console.warn(formatMsg(tag, message), ...args);
    }
  },
  error(tag: string, message: string, ...args: unknown[]): void {
    if (shouldLog("error")) {
      console.error(formatMsg(tag, message), ...args);
    }
  },
};
```

---

## 5. src/lib/sanitize.test.ts

```
import { describe, it, expect } from "vitest";
import {
  stripHtml,
  sanitizeText,
  sanitizeEmail,
  sanitizePhone,
  sanitizeAmount,
  sanitizeUrl,
  validateFileUpload,
  isRateLimited,
} from "./sanitize";

describe("sanitize", () => {
  describe("stripHtml", () => {
    it("elimina etiquetas HTML", () => {
      expect(stripHtml("<script>alert(1)</script>")).toBe("alert(1)");
      expect(stripHtml("<b>Hola</b>")).toBe("Hola");
    });
  });

  describe("sanitizeText", () => {
    it("recorta texto a maxLength", () => {
      expect(sanitizeText("a".repeat(600), 500)).toHaveLength(500);
    });
    it("retorna vacío si input vacío", () => {
      expect(sanitizeText("")).toBe("");
    });
  });

  describe("sanitizeEmail", () => {
    it("normaliza email a minúsculas", () => {
      expect(sanitizeEmail("Test@Example.COM")).toBe("test@example.com");
    });
    it("recorta a 255 caracteres", () => {
      expect(sanitizeEmail("a".repeat(300))).toHaveLength(255);
    });
  });

  describe("sanitizePhone", () => {
    it("solo permite dígitos, +, -, (, ), espacios", () => {
      expect(sanitizePhone("+58 412 1234567")).toBe("+58 412 1234567");
      expect(sanitizePhone("abc123")).toBe("123");
    });
  });

  describe("sanitizeAmount", () => {
    it("retorna 0 para valores inválidos", () => {
      expect(sanitizeAmount("abc")).toBe(0);
      expect(sanitizeAmount(-5)).toBe(0);
      expect(sanitizeAmount(NaN)).toBe(0);
    });
    it("redondea a 2 decimales", () => {
      expect(sanitizeAmount(10.999)).toBe(11);
    });
  });

  describe("sanitizeUrl", () => {
    it("acepta http/https", () => {
      const url = sanitizeUrl("https://example.com");
      expect(url).not.toBeNull();
      expect(url).toContain("example.com");
      expect(url).toMatch(/^https?:\/\//);
    });
    it("rechaza javascript:", () => {
      expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
    });
  });

  describe("validateFileUpload", () => {
    it("rechaza archivos mayores al límite", () => {
      const file = new File(["x".repeat(10 * 1024 * 1024)], "test.jpg", { type: "image/jpeg" });
      const result = validateFileUpload(file, ["image/jpeg"], 5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("5MB");
    });
    it("rechaza extensiones peligrosas", () => {
      const file = new File(["x"], "test.exe", { type: "application/octet-stream" });
      const result = validateFileUpload(file, ["application/octet-stream"], 10);
      expect(result.valid).toBe(false);
    });
  });

  describe("isRateLimited", () => {
    it("permite intentos dentro del límite", () => {
      const key = `rate-test-${Date.now()}`;
      expect(isRateLimited(key, 3, 60000)).toBe(false);
      expect(isRateLimited(key, 3, 60000)).toBe(false);
      expect(isRateLimited(key, 3, 60000)).toBe(false);
      expect(isRateLimited(key, 3, 60000)).toBe(true);
    });
  });
});
```

---

## 6. src/lib/authErrors.test.ts

```
import { describe, it, expect } from "vitest";
import {
  translateAuthError,
  isEmailNotConfirmedError,
  isRateLimitError,
} from "./authErrors";

describe("authErrors", () => {
  describe("translateAuthError", () => {
    it("traduce invalid login credentials", () => {
      expect(translateAuthError("Invalid login credentials")).toContain("incorrectos");
    });
    it("traduce email not confirmed", () => {
      expect(translateAuthError("Email not confirmed")).toContain("verificado");
    });
    it("traduce rate limit", () => {
      expect(translateAuthError("Rate limit exceeded")).toContain("segundos");
    });
    it("retorna mensaje genérico para errores desconocidos", () => {
      const msg = "Algo raro";
      expect(translateAuthError(msg)).toBe(msg);
    });
  });

  describe("isEmailNotConfirmedError", () => {
    it("detecta error de email no confirmado", () => {
      expect(isEmailNotConfirmedError("Email not confirmed")).toBe(true);
      expect(isEmailNotConfirmedError("algo más")).toBe(false);
    });
  });

  describe("isRateLimitError", () => {
    it("detecta error de rate limit", () => {
      expect(isRateLimitError("Rate limit exceeded")).toBe(true);
      expect(isRateLimitError("over_email_send_rate_limit")).toBe(true);
      expect(isRateLimitError("otro error")).toBe(false);
    });
  });
});
```

---

## 7. docs/ANDROID_BUILD.md

En Lovable crea la carpeta `docs` si no existe, luego el archivo `ANDROID_BUILD.md`:

```
# Build de Android para producción

## Requisitos

- Android Studio (Arctic Fox o superior)
- JDK 17
- Node.js 18+
- Cuenta de Google Play (para publicar)

## Pasos para generar APK/AAB

### 1. Build web de producción

npm run build

### 2. Sincronizar con Capacitor

npx cap sync android

### 3. Abrir en Android Studio

npx cap open android

### 4. Configurar firma (release)

En Android Studio:
1. Build > Generate Signed Bundle / APK
2. Selecciona Android App Bundle (AAB) para Google Play
3. O APK para instalación directa
4. Crea o selecciona un keystore
5. Genera el bundle

### 5. Versión de la app

Edita android/app/build.gradle:

versionCode 1        // Incrementar en cada release
versionName "1.0.0"  // Versión visible

### 6. Proguard (minificación)

Para producción, habilita minify en android/app/build.gradle:

buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}

## Script rápido

npm run cap:android

Esto ejecuta npm run build, npx cap sync y abre Android Studio.
```

---

## Resumen de archivos a crear en Lovable

| Ruta | Acción |
|------|--------|
| src/lib/errorHandler.ts | Crear |
| src/lib/constants.ts | Crear |
| src/lib/validation.ts | Crear |
| src/lib/logger.ts | Crear |
| src/lib/sanitize.test.ts | Crear |
| src/lib/authErrors.test.ts | Crear |
| docs/ANDROID_BUILD.md | Crear (crea carpeta docs primero) |

Los tests van en **src/lib/** (no en src/test/) porque vitest busca `src/**/*.{test,spec}.{ts,tsx}`.
