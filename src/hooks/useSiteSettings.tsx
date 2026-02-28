import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SiteSettings {
  [key: string]: string;
}

interface SiteSection {
  id: string;
  section_key: string;
  title: string | null;
  content: string | null;
  is_visible: boolean;
  display_order: number;
  section_type: string;
  metadata: any;
}

interface SiteContextType {
  settings: SiteSettings;
  sections: SiteSection[];
  loading: boolean;
  getSetting: (key: string, fallback?: string) => string;
  refetch: () => Promise<void>;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

export function SiteProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>({});
  const [sections, setSections] = useState<SiteSection[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [settingsRes, sectionsRes] = await Promise.all([
      supabase.from("site_settings").select("setting_key, setting_value"),
      supabase.from("site_sections").select("*").order("display_order"),
    ]);

    if (settingsRes.data) {
      const map: SiteSettings = {};
      settingsRes.data.forEach((s: any) => { map[s.setting_key] = s.setting_value || ""; });
      setSettings(map);

      // Apply color settings to CSS variables
      const colorMap: Record<string, string> = {
        primary_color: "--primary",
        accent_color: "--accent",
        nav_color: "--nav-bg",
      };
      const root = document.documentElement;
      settingsRes.data.forEach((s: any) => {
        const cssVar = colorMap[s.setting_key];
        if (cssVar && s.setting_value) {
          root.style.setProperty(cssVar, s.setting_value);
        }
      });
    }

    setSections((sectionsRes.data as SiteSection[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel("site-settings-realtime").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "site_settings" },
      () => { fetchData(); }
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const getSetting = (key: string, fallback = "") => settings[key] || fallback;

  return (
    <SiteContext.Provider value={{ settings, sections, loading, getSetting, refetch: fetchData }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSiteSettings() {
  const context = useContext(SiteContext);
  if (!context) throw new Error("useSiteSettings must be used within SiteProvider");
  return context;
}
