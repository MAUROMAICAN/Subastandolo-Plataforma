/**
 * Biometric authentication hook.
 * Uses @capgo/capacitor-native-biometric on native (Capacitor).
 * Falls back gracefully on web.
 */

import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";

const BIOMETRIC_SERVER = "com.subastandolo.app";

export function useBiometricAuth() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [biometryType, setBiometryType] = useState<string | null>(null);

  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!isNative) {
      setChecking(false);
      return () => { };
    }

    let cancelled = false;

    async function check() {
      try {
        const { NativeBiometric: NB } = await import("@capgo/capacitor-native-biometric");
        const result = await NB.isAvailable({ useFallback: false });

        if (cancelled) return;

        setIsAvailable(result.isAvailable);
        setBiometryType(result.biometryType != null ? String(result.biometryType) : null);

        if (result.isAvailable) {
          const { isSaved } = await NB.isCredentialsSaved({ server: BIOMETRIC_SERVER });
          setIsEnabled(isSaved);
        }
      } catch {
        if (!cancelled) {
          setIsAvailable(false);
          setIsEnabled(false);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [isNative]);

  const saveCredentials = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      if (!isNative || !isAvailable) return false;
      try {
        const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
        // Try to delete any corrupted or misconfigured key from the keystore first
        try {
          await NativeBiometric.deleteCredentials({ server: BIOMETRIC_SERVER });
        } catch (e) {
          // Ignore if credentials didn't exist
        }

        await NativeBiometric.setCredentials({
          username: email,
          password,
          server: BIOMETRIC_SERVER,
          accessControl: 2, // AccessControl.BIOMETRY_ANY: binds to biometrics securely
        });
        setIsEnabled(true);
        return true;
      } catch (error: any) {
        console.error("Biometric save error:", error);
        return false;
      }
    },
    [isNative, isAvailable]
  );

  const loginWithBiometric = useCallback(
    async (): Promise<{ success: true; email: string; secret: string } | { success: false; error: string }> => {
      if (!isNative || !isAvailable) {
        return { success: false, error: "Biometría no disponible" };
      }
      try {
        const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");

        try {
          // Try secure retrieval first (will prompt natively on iOS and Android)
          const credentials = await NativeBiometric.getSecureCredentials({
            server: BIOMETRIC_SERVER,
            reason: "Inicia sesión en SUBASTANDOLO",
            title: "Inicio con biometría",
            subtitle: "Usa tu huella o rostro para entrar",
          });
          return {
            success: true,
            email: credentials.username,
            secret: credentials.password,
          };
        } catch (secureErr: any) {
          const msg = secureErr instanceof Error ? secureErr.message : String(secureErr);
          // If code is 21 (No protected credentials found), wait and fallback
          if (secureErr.code === "21" || msg.includes("21") || msg.includes("No protected credentials")) {
            // Fallback for older non-secure credentials
            await NativeBiometric.verifyIdentity({
              reason: "Inicia sesión en SUBASTANDOLO",
              title: "Inicio con biometría",
              subtitle: "Usa tu huella o rostro para entrar",
              useFallback: false,
            });
            const oldCredentials = await NativeBiometric.getCredentials({
              server: BIOMETRIC_SERVER,
            });
            return {
              success: true,
              email: oldCredentials.username,
              secret: oldCredentials.password,
            };
          } else {
            throw secureErr; // Rethrow to be caught by outer catch
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("16") || msg.includes("User Cancel") || msg.includes("canceled") || msg.includes("cancel")) {
          return { success: false, error: "Cancelado por el usuario" };
        }
        return { success: false, error: msg || "Error de biometría" };
      }
    },
    [isNative, isAvailable]
  );

  const disableBiometric = useCallback(async () => {
    if (!isNative) return;
    try {
      const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
      await NativeBiometric.deleteCredentials({ server: BIOMETRIC_SERVER });
      setIsEnabled(false);
    } catch {
      // ignore
    }
  }, [isNative]);

  const getSavedEmail = useCallback(() => {
    return localStorage.getItem("last_login_email");
  }, []);

  const getBiometryLabel = useCallback(() => {
    if (!biometryType) return "huella o rostro";
    const t = String(biometryType).toLowerCase();
    if (t.includes("face") || t.includes("faceid")) return "rostro";
    if (t.includes("finger") || t.includes("touchid")) return "huella";
    return "biometría";
  }, [biometryType]);

  return {
    isAvailable,
    isEnabled,
    checking,
    biometryType,
    getBiometryLabel,
    saveCredentials,
    loginWithBiometric,
    disableBiometric,
    getSavedEmail,
  };
}
