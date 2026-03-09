import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Saves and restores scroll position per route.
 * When navigating away, saves current scroll. When navigating back, restores it.
 * Uses sessionStorage so positions persist across browser back/forward.
 */
const ScrollRestoration = () => {
    const { pathname, key } = useLocation();

    // Save scroll position before leaving the current page
    useEffect(() => {
        // Disable browser's default scroll restoration — we handle it ourselves
        if ("scrollRestoration" in window.history) {
            window.history.scrollRestoration = "manual";
        }

        return () => {
            // When this route unmounts (user navigates away), save current scroll
            sessionStorage.setItem(`scroll:${pathname}`, String(window.scrollY));
        };
    }, [pathname]);

    // Restore scroll position when arriving at a page
    useEffect(() => {
        const saved = sessionStorage.getItem(`scroll:${pathname}`);

        if (saved && window.history.state?.idx !== undefined) {
            // Small delay to let the DOM render before restoring scroll
            const timer = requestAnimationFrame(() => {
                window.scrollTo(0, parseInt(saved, 10));
            });
            return () => cancelAnimationFrame(timer);
        }
        // New navigation (not back/forward) — scroll to top
        // Check if there's a hash (e.g. /#subastas) — if so, let the browser handle it
        if (!window.location.hash) {
            window.scrollTo(0, 0);
        }
        return undefined;
    }, [pathname, key]);

    return null;
};

export default ScrollRestoration;
