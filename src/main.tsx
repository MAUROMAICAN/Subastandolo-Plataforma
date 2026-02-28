import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global unhandled rejection handler to prevent silent crashes
window.addEventListener("unhandledrejection", (event) => {
  console.error("[BOOT] Unhandled rejection caught:", event.reason);
  event.preventDefault();
});

const mount = () => {
  createRoot(document.getElementById("root")!).render(<App />);
};

// Mount app immediately, register SW in background
mount();

import("virtual:pwa-register")
  .then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log("[PWA] New version available, reloading…");
        updateSW(true);
      },
      onOfflineReady() {
        console.log("[PWA] App ready for offline use");
      },
    });

    // Check for updates every 5 minutes (was 1 min - too aggressive)
    setInterval(() => {
      updateSW(false);
    }, 5 * 60 * 1000);
  })
  .catch((err) => console.warn("PWA register skipped:", err));
