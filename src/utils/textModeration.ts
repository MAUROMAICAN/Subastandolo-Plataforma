/**
 * Anti-fraud text moderation for marketplace products.
 * Detects contact information, prohibited content, and suspicious patterns
 * in product titles and descriptions to prevent fraud.
 */

// Phone number patterns (Venezuela and international)
const PHONE_PATTERNS = [
  /\b0\d{3}[-.\s]?\d{3}[-.\s]?\d{2}[-.\s]?\d{2}\b/,     // 0414-123-45-67
  /\b0\d{10}\b/,                                           // 04141234567
  /\+58\s?\d{3}[-.\s]?\d{7}\b/,                            // +58 414 1234567
  /\b\d{4}[-.\s]\d{7}\b/,                                  // 0414-1234567
  /\b(?:04(?:12|14|24|16|26))\d{7}\b/,                     // Venezuelan mobile
];

// Email pattern
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Social media / URL patterns
const URL_PATTERNS = [
  /(?:https?:\/\/|www\.)[^\s]+/i,
  /(?:instagram|ig|insta)\s*[:.@]\s*\S+/i,
  /(?:facebook|fb)\s*[:.@]\s*\S+/i,
  /(?:whatsapp|wpp|wsp|wa\.me)\s*[:.@\/]\s*\S+/i,
  /(?:telegram|tg)\s*[:.@]\s*\S+/i,
  /(?:tiktok|tt)\s*[:.@]\s*\S+/i,
  /(?:twitter|x\.com)\s*[:.@]\s*\S+/i,
  /@[a-zA-Z0-9_]{3,}/,  // @username mentions
];

// Prohibited terms (items not allowed on platform)
const PROHIBITED_TERMS = [
  /\b(?:arma|pistola|revolver|escopeta|rifle|municion|bala)\b/i,
  /\b(?:droga|marihuana|cocaina|crack|heroina|metanfetamina)\b/i,
  /\b(?:falsificad[oa]|replica|pirata|imitacion|clon)\b/i,
  /\b(?:robad[oa]|hurtad[oa])\b/i,
  /\b(?:pornograf|xxx|adulto|erotico)\b/i,
  /\b(?:cuenta\s+(?:de\s+)?(?:netflix|spotify|disney|hbo|steam|playstation|xbox))\b/i,
  /\b(?:tarjeta\s+(?:de\s+)?credito|datos\s+(?:de\s+)?tarjeta)\b/i,
];

export interface ModerationResult {
  isClean: boolean;
  violations: string[];
}

/**
 * Check text content for anti-fraud violations.
 * Returns clean=true if no issues found, or a list of violation descriptions.
 */
export function moderateText(title: string, description: string): ModerationResult {
  const violations: string[] = [];
  const combined = `${title} ${description}`;

  // Check phone numbers
  for (const pattern of PHONE_PATTERNS) {
    if (pattern.test(combined)) {
      violations.push("Se detectó un número de teléfono. No incluyas datos de contacto en el título o descripción.");
      break;
    }
  }

  // Check emails
  if (EMAIL_PATTERN.test(combined)) {
    violations.push("Se detectó un correo electrónico. No incluyas datos de contacto en la publicación.");
  }

  // Check URLs and social media
  for (const pattern of URL_PATTERNS) {
    if (pattern.test(combined)) {
      violations.push("Se detectaron enlaces o redes sociales. No incluyas URLs ni perfiles de redes sociales.");
      break;
    }
  }

  // Check prohibited items
  for (const pattern of PROHIBITED_TERMS) {
    const match = combined.match(pattern);
    if (match) {
      violations.push(`Se detectó contenido prohibido ("${match[0]}"). Este tipo de producto no está permitido en la plataforma.`);
      break;
    }
  }

  return {
    isClean: violations.length === 0,
    violations,
  };
}

// Extra evasion patterns for Q&A (common in marketplace fraud)
const EVASION_PATTERNS = [
  /\b(?:escr[ií]beme|ll[aá]mame|cont[aá]ctame|manda\s?me|env[ií]ame)\b/i,
  /\b(?:mi\s+n[uú]mero|mi\s+tel[eé]fono|mi\s+celular|mi\s+cel)\b/i,
  /\b(?:agr[eé]game|s[ií]gueme|b[uú]scame)\s+(?:en|por)\b/i,
  /\b(?:por\s+fuera|por\s+privado|por\s+interno|fuera\s+de\s+(?:la\s+)?plataforma)\b/i,
  /\b(?:hablemos\s+por|escribeme\s+al|pasame\s+tu)\b/i,
  /\b(?:cero\s*cuatro|cuatro\s*uno\s*(?:dos|cuatro))\b/i, // "cero cuatro uno dos" = phone number spoken
];

/**
 * Check question/answer text for contact info attempts.
 * Lighter than moderateText — only checks contact patterns, not prohibited items.
 */
export function moderateQuestion(text: string): ModerationResult {
  const violations: string[] = [];

  // Check phone numbers
  for (const pattern of PHONE_PATTERNS) {
    if (pattern.test(text)) {
      violations.push("No se permiten números de teléfono en las preguntas. Usa el sistema de preguntas para comunicarte.");
      break;
    }
  }

  // Check emails
  if (EMAIL_PATTERN.test(text)) {
    violations.push("No se permiten correos electrónicos en las preguntas.");
  }

  // Check URLs and social media
  for (const pattern of URL_PATTERNS) {
    if (pattern.test(text)) {
      violations.push("No se permiten enlaces ni redes sociales en las preguntas.");
      break;
    }
  }

  // Check evasion patterns
  for (const pattern of EVASION_PATTERNS) {
    if (pattern.test(text)) {
      violations.push("No se permite solicitar contacto fuera de la plataforma. Usa el sistema de preguntas.");
      break;
    }
  }

  return {
    isClean: violations.length === 0,
    violations,
  };
}
