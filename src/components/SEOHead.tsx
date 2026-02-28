import { useEffect } from "react";

interface SEOHeadProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
}

const SEOHead = ({ title, description, image, url, type = "website" }: SEOHeadProps) => {
  useEffect(() => {
    const siteName = "SUBASTANDOLO";
    const fullTitle = title ? `${title} | ${siteName}` : siteName;
    const desc = description || "Plataforma de subastas online - Compra y vende en subastas seguras";
    const ogImage = image || "/icons/icon-512.png";
    const pageUrl = url || window.location.href;

    document.title = fullTitle;

    const setMeta = (selector: string, content: string) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute("content", content);
    };

    setMeta('meta[name="description"]', desc);
    setMeta('meta[property="og:title"]', fullTitle);
    setMeta('meta[property="og:description"]', desc);
    setMeta('meta[property="og:image"]', ogImage);
    setMeta('meta[property="og:type"]', type);
    setMeta('meta[name="twitter:title"]', fullTitle);
    setMeta('meta[name="twitter:description"]', desc);
    setMeta('meta[name="twitter:image"]', ogImage);

    // Set og:url dynamically
    let ogUrl = document.querySelector('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement("meta");
      ogUrl.setAttribute("property", "og:url");
      document.head.appendChild(ogUrl);
    }
    ogUrl.setAttribute("content", pageUrl);

    // Set canonical
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", pageUrl);
  }, [title, description, image, url, type]);

  return null;
};

export default SEOHead;
