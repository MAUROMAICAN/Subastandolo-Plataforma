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
