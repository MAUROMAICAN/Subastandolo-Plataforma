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
      return () => {};
    }

    let cancelled = false;

    async function check() {
      try {
        const { NativeBiometric: NB } = await import("@capgo/capacitor-native-biometric");
        const result = await NB.isAvailable({ useFallback: true });

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
        await NativeBiometric.setCredentials({
          username: email,
          password,
          server: BIOMETRIC_SERVER,
        });
        setIsEnabled(true);
        return true;
      } catch {
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
        await NativeBiometric.verifyIdentity({
          reason: "Inicia sesión en SUBASTANDOLO",
          title: "Inicio con biometría",
          subtitle: "Usa tu huella o rostro para entrar",
          description: "",
        });
        const credentials = await NativeBiometric.getCredentials({
          server: BIOMETRIC_SERVER,
        });
        return {
          success: true,
          email: credentials.username,
          secret: credentials.password,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("16") || msg.includes("User Cancel") || msg.includes("canceled")) {
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
