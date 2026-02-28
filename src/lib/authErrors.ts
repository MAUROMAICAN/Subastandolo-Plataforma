/**
 * Translates Supabase auth error messages to user-friendly Spanish messages.
 * Covers all known error codes from production logs.
 */
export function translateAuthError(message: string): string {
  const lower = message.toLowerCase();

  // Email not confirmed
  if (lower.includes("email not confirmed") || lower.includes("email_not_confirmed")) {
    return "Tu correo electrónico aún no ha sido verificado. Revisa tu bandeja de entrada.";
  }

  // Invalid credentials
  if (lower.includes("invalid login credentials") || lower.includes("invalid_credentials")) {
    return "Correo o contraseña incorrectos. Verifica tus datos.";
  }

  // Same password
  if (lower.includes("same password") || lower.includes("same_password") || lower.includes("new password should be different")) {
    return "La nueva contraseña debe ser diferente a la anterior.";
  }

  // Rate limiting
  if (lower.includes("rate limit") || lower.includes("over_email_send_rate_limit") || lower.includes("you can only request this after")) {
    const secondsMatch = message.match(/after (\d+) seconds/i);
    const seconds = secondsMatch ? secondsMatch[1] : "unos";
    return `Por seguridad, espera ${seconds} segundos antes de intentar nuevamente.`;
  }

  // Expired / invalid link
  if (lower.includes("email link is invalid") || lower.includes("one-time token not found") || lower.includes("otp_expired")) {
    return "El enlace ha expirado o ya fue usado. Solicita uno nuevo.";
  }

  // User already registered
  if (lower.includes("user already registered") || lower.includes("already been registered")) {
    return "Este correo ya está registrado. Intenta iniciar sesión o recuperar tu contraseña.";
  }

  // Signup disabled
  if (lower.includes("signups not allowed") || lower.includes("signup_disabled")) {
    return "Los registros están temporalmente deshabilitados. Intenta más tarde.";
  }

  // Password too short
  if (lower.includes("password should be at least")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }

  // Invalid email
  if (lower.includes("unable to validate email") || lower.includes("invalid email")) {
    return "El correo electrónico no es válido. Verifica que esté bien escrito.";
  }

  // Network / connection errors
  if (lower.includes("fetch") || lower.includes("network") || lower.includes("failed to fetch")) {
    return "Error de conexión. Verifica tu internet e intenta de nuevo.";
  }

  // Session expired
  if (lower.includes("session_not_found") || lower.includes("refresh_token_not_found")) {
    return "Tu sesión ha expirado. Inicia sesión nuevamente.";
  }

  // Generic fallback — still show something useful
  return message;
}

/**
 * Checks if the error is an "email not confirmed" error
 */
export function isEmailNotConfirmedError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("email not confirmed") || lower.includes("email_not_confirmed");
}

/**
 * Checks if the error is a rate limit error
 */
export function isRateLimitError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("rate limit") || lower.includes("over_email_send_rate_limit") || lower.includes("you can only request this after");
}
