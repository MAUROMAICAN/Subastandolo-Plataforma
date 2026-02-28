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
