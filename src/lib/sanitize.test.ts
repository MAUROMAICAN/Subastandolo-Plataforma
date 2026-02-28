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
