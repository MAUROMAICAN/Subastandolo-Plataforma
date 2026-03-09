import { useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";

/**
 * Saves and restores scroll position per route.
 * 
 * Key insight: useEffect cleanup runs AFTER the new render, when the browser
 * has already scrolled to 0 for the new page. So we can't save scroll position
 * in cleanup. Instead, we save it continuously on every scroll event (debounced).
 */
const ScrollRestoration = () => {
    const { pathname, key } = useLocation();

    // Continuously save scroll position while the user scrolls (debounced)
    const saveScroll = useCallback(() => {
        sessionStorage.setItem(`scroll:${pathname}`, String(window.scrollY));
    }, [pathname]);

    useEffect(() => {
        if ("scrollRestoration" in window.history) {
            window.history.scrollRestoration = "manual";
        }

        let ticking = false;
        const onScroll = () => {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(() => {
                    saveScroll();
                    ticking = false;
                });
            }
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, [saveScroll]);

    // Restore scroll position when arriving at a page
    useEffect(() => {
        const saved = sessionStorage.getItem(`scroll:${pathname}`);
        const targetY = saved ? parseInt(saved, 10) : 0;

        // If there's no saved position or it's 0, just scroll to top
        if (!saved || targetY === 0) {
            if (!window.location.hash) {
                window.scrollTo(0, 0);
            }
            return undefined;
        }

        // Retry scrolling until the page is tall enough or we time out (3 seconds)
        let attempts = 0;
        const maxAttempts = 30;
        const intervalId = setInterval(() => {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            attempts++;

            if (maxScroll >= targetY || attempts >= maxAttempts) {
                window.scrollTo(0, Math.min(targetY, maxScroll));
                clearInterval(intervalId);
            }
        }, 100);

        return () => clearInterval(intervalId);
    }, [pathname, key]);

    return null;
};

export default ScrollRestoration;
