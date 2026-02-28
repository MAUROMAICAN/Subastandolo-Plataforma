/**
 * Detects phone numbers, social media handles, URLs, and contact info
 * in auction titles and descriptions.
 * Returns an array of violation messages, empty if clean.
 */

const PATTERNS: { regex: RegExp; label: string }[] = [
  // Phone numbers (various formats: +58, 0414, 04XX, international)
  { regex: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{2,4}/g, label: "número de teléfono" },
  // WhatsApp mentions
  { regex: /whats\s*app|wsp|wa\.me|whatssap/gi, label: "referencia a WhatsApp" },
  // Instagram
  { regex: /@[\w.]{2,30}|instagram\.com|insta\s*gram|ig:/gi, label: "referencia a Instagram" },
  // Facebook
  { regex: /facebook\.com|fb\.com|face\s*book/gi, label: "referencia a Facebook" },
  // Twitter/X
  { regex: /twitter\.com|x\.com\/\w/gi, label: "referencia a Twitter/X" },
  // TikTok
  { regex: /tiktok\.com|tik\s*tok/gi, label: "referencia a TikTok" },
  // Telegram
  { regex: /t\.me\/|telegram/gi, label: "referencia a Telegram" },
  // Email addresses
  { regex: /[\w.-]+@[\w.-]+\.\w{2,}/g, label: "correo electrónico" },
  // Generic URLs (http/https/www)
  { regex: /https?:\/\/[^\s]+|www\.[^\s]+/gi, label: "enlace externo" },
  // "Escríbeme", "Llámame", "DM", contact language
  { regex: /escr[íi]beme|ll[áa]m[ae]me|mand[ae]\s*(un\s*)?mensaje|cont[áa]ct[ae]me|por\s*interno|dm\s*me|mand[ae]\s*dm/gi, label: "invitación a contacto externo" },
];

// Words that are commonly false positives (prices, dimensions, model numbers)
const FALSE_POSITIVE_PATTERNS = [
  /^\$?\d+([.,]\d{1,2})?$/, // Prices like $100, 100.00
  /^\d+\s*(gb|mb|tb|kg|lb|cm|mm|m|"|\"|pulg|pulgadas|mph|rpm|mah|hz|ghz|mp)$/i, // Specs
];

export function detectContactInfo(text: string): string[] {
  if (!text) return [];
  
  const violations: string[] = [];
  
  for (const { regex, label } of PATTERNS) {
    regex.lastIndex = 0;
    const matches = text.match(regex);
    if (matches) {
      // Filter out false positives for phone pattern
      const realMatches = matches.filter(m => {
        const cleaned = m.replace(/[-.\s()]/g, "");
        // Too short to be a phone number
        if (cleaned.length < 7 && label === "número de teléfono") return false;
        // Check if it's a spec/price
        if (FALSE_POSITIVE_PATTERNS.some(fp => fp.test(m.trim()))) return false;
        return true;
      });
      if (realMatches.length > 0 && !violations.includes(label)) {
        violations.push(label);
      }
    }
  }
  
  return violations;
}

/**
 * Returns a user-friendly error message if violations found, or null if clean.
 */
export function validateNoContactInfo(title: string, description: string): string | null {
  const titleViolations = detectContactInfo(title);
  const descViolations = detectContactInfo(description);
  const all = [...new Set([...titleViolations, ...descViolations])];
  
  if (all.length === 0) return null;
  
  return `Se detectó contenido no permitido: ${all.join(", ")}. Según las políticas de publicación, no se permite incluir datos de contacto, redes sociales ni enlaces externos.`;
}
