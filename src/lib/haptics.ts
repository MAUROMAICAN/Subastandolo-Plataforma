import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const isNative = Capacitor.isNativePlatform();

export async function vibrateOutbid() {
  if (isNative) {
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch {
      // fallback
    }
  } else if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200]);
  }
}

export async function vibrateBidPlaced() {
  if (isNative) {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      // fallback
    }
  } else if ('vibrate' in navigator) {
    navigator.vibrate(100);
  }
}

export async function vibrateWin() {
  if (isNative) {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      // fallback
    }
  } else if ('vibrate' in navigator) {
    navigator.vibrate([100, 50, 100, 50, 300]);
  }
}
