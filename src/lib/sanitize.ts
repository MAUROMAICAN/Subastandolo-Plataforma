/**
 * Security sanitization utilities for user inputs.
 * Prevents XSS, injection attacks, and data corruption.
 */

// Strip HTML tags to prevent XSS
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').replace(/[<>]/g, '');
}

// Sanitize text input: trim, remove HTML, limit length
export function sanitizeText(input: string, maxLength = 500): string {
  if (!input) return '';
  return stripHtml(input.trim()).slice(0, maxLength);
}

// Sanitize and validate email format
export function sanitizeEmail(input: string): string {
  const cleaned = input.trim().toLowerCase().slice(0, 255);
  return cleaned;
}

// Sanitize phone number: only allow digits, +, -, (, ), spaces
export function sanitizePhone(input: string): string {
  return input.replace(/[^\d+\-() ]/g, '').slice(0, 20);
}

// Sanitize monetary amount: ensure valid positive number
export function sanitizeAmount(input: string | number): number {
  const num = typeof input === 'string' ? parseFloat(input) : input;
  if (isNaN(num) || num < 0 || !isFinite(num)) return 0;
  return Math.round(num * 100) / 100; // 2 decimal places max
}

// Sanitize URL: only allow http/https protocols
export function sanitizeUrl(input: string): string | null {
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

// Prevent prototype pollution in objects
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const dangerous = ['__proto__', 'constructor', 'prototype'];
  const clean = { ...obj };
  for (const key of dangerous) {
    delete (clean as Record<string, unknown>)[key];
  }
  return clean;
}

// Rate limiter for client-side actions (e.g., button clicks)
const rateLimitMap = new Map<string, number[]>();

export function isRateLimited(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const attempts = rateLimitMap.get(key) || [];
  const recent = attempts.filter(t => now - t < windowMs);
  
  if (recent.length >= maxAttempts) {
    rateLimitMap.set(key, recent);
    return true;
  }
  
  recent.push(now);
  rateLimitMap.set(key, recent);
  return false;
}

// Validate file upload: check type and size
export function validateFileUpload(
  file: File,
  allowedTypes: string[],
  maxSizeMB: number
): { valid: boolean; error?: string } {
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `Tipo de archivo no permitido. Permitidos: ${allowedTypes.join(', ')}` };
  }
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `El archivo excede el tamaño máximo de ${maxSizeMB}MB.` };
  }
  // Check for disguised executables
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.js', '.vbs', '.ps1', '.sh'];
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  if (dangerousExtensions.includes(ext)) {
    return { valid: false, error: 'Tipo de archivo no permitido por razones de seguridad.' };
  }
  return { valid: true };
}
