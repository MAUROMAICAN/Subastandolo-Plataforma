// Site configuration and dynamic URLs based on Vite's environment mode.

export const isDev = import.meta.env.DEV;
export const isProd = import.meta.env.PROD;

// In development, the base URL is usually localhost.
// In production, it's the real domain.
export const BASE_URL = isDev
    ? "http://localhost:8080"
    : "https://www.subastandolo.com";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
