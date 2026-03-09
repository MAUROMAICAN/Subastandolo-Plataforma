import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Saves and restores scroll position per route.
 * When navigating away, saves current scroll. When navigating back, restores it.
 * Uses sessionStorage so positions persist across browser back/forward.
 * 
 * Uses a retry loop because async-loaded content (auctions, products) may not
 * be rendered yet when navigation completes — the page might be too short to
 * scroll to the saved position immediately.
 */
const ScrollRestoration = () => {
    const { pathname, key } = useLocation();
    const prevPathname = useRef(pathname);
    const prevKey = useRef(key);

    // Save scroll position before leaving the current page
    useEffect(() => {
        if ("scrollRestoration" in window.history) {
            window.history.scrollRestoration = "manual";
        }

        return () => {
            sessionStorage.setItem(`scroll:${pathname}`, String(window.scrollY));
        };
    }, [pathname]);

    // Restore scroll position when arriving at a page
    useEffect(() => {
        // Detect if this is a "back" navigation (same pathname but different key)
        // or a fresh visit
        const isReturning = prevPathname.current !== pathname;
        prevPathname.current = pathname;
        prevKey.current = key;

        const saved = sessionStorage.getItem(`scroll:${pathname}`);
        const targetY = saved ? parseInt(saved, 10) : 0;

        // If there's no saved position or it's 0, just scroll to top
        if (!saved || targetY === 0) {
            if (!window.location.hash) {
                window.scrollTo(0, 0);
            }
            return;
        }

        // Retry scrolling until the page is tall enough or we time out (3 seconds)
        let attempts = 0;
        const maxAttempts = 30; // 30 x 100ms = 3 seconds
        const intervalId = setInterval(() => {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            attempts++;

            if (maxScroll >= targetY || attempts >= maxAttempts) {
                window.scrollTo(0, Math.min(targetY, maxScroll));
                clearInterval(intervalId);
                // Clean up saved position after restoring
                sessionStorage.removeItem(`scroll:${pathname}`);
            }
        }, 100);

        return () => clearInterval(intervalId);
    }, [pathname, key]);

    return null;
};

export default ScrollRestoration;
