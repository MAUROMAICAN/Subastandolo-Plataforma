import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { X } from "lucide-react";

interface Campaign {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
}

const getViewportSize = () => {
  if (window.visualViewport) {
    return {
      width: Math.round(window.visualViewport.width),
      height: Math.round(window.visualViewport.height),
    };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
};

const CampaignModal = () => {
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [visible, setVisible] = useState(false);
  const [imageRatio, setImageRatio] = useState<number | null>(null);
  const [viewport, setViewport] = useState({ width: 390, height: 844 });

  const fetchActiveCampaign = useCallback(async () => {
    const nowIso = new Date().toISOString();

    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id, title, image_url, link_url")
      .eq("is_active", true)
      .lte("starts_at", nowIso)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!campaigns || campaigns.length === 0) return;

    const activeCampaign = campaigns[0] as Campaign;

    if (user) {
      const { data: dismissals } = await supabase
        .from("campaign_dismissals")
        .select("id")
        .eq("campaign_id", activeCampaign.id)
        .eq("user_id", user.id)
        .limit(1);

      if (dismissals && dismissals.length > 0) return;
    } else {
      const dismissed = localStorage.getItem(`campaign_dismissed_${activeCampaign.id}`);
      if (dismissed) return;
    }

    setCampaign(activeCampaign);
    setImageRatio(null);
    setTimeout(() => setVisible(true), 250);
  }, [user]);

  useEffect(() => {
    fetchActiveCampaign();
  }, [fetchActiveCampaign]);

  useEffect(() => {
    const handler = () => {
      setCampaign(null);
      setVisible(false);
      setTimeout(() => fetchActiveCampaign(), 400);
    };

    window.addEventListener("campaign-resent", handler);
    return () => window.removeEventListener("campaign-resent", handler);
  }, [fetchActiveCampaign]);

  useEffect(() => {
    if (!campaign) return;

    const updateViewport = () => setViewport(getViewportSize());

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
    };
  }, [campaign?.id]);

  const handleDismiss = async () => {
    setVisible(false);
    setTimeout(() => setCampaign(null), 260);

    if (!campaign) return;

    if (user) {
      await supabase.from("campaign_dismissals").insert({
        campaign_id: campaign.id,
        user_id: user.id,
      } as any);
    } else {
      localStorage.setItem(`campaign_dismissed_${campaign.id}`, "true");
    }
  };

  const handleImageClick = () => {
    if (campaign?.link_url) {
      window.open(campaign.link_url, "_blank", "noopener,noreferrer");
    }
  };

  if (!campaign) return null;

  const availableWidth = Math.max(viewport.width - 8, 280);
  const availableHeight = Math.max(viewport.height - 8, 360);
  const ratio = imageRatio ?? 9 / 16;
  const frameWidth = Math.min(availableWidth, availableHeight * ratio);
  const frameHeight = Math.min(availableHeight, frameWidth / ratio);

  return (
    <div
      className={`fixed inset-0 z-[100] transition-all duration-300 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      style={{
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        backgroundColor: "rgba(0,0,0,0.70)",
      }}
      onClick={handleDismiss}
    >
      <div
        className={`relative flex h-full w-full items-center justify-center transition-all duration-300 ${
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        style={{ padding: "max(env(safe-area-inset-top), 8px) 4px max(env(safe-area-inset-bottom), 8px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform hover:scale-110"
          style={{ marginTop: "max(env(safe-area-inset-top), 0px)" }}
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        <div
          className="relative overflow-hidden rounded-xl bg-black/30 shadow-2xl"
          style={{
            width: `${frameWidth}px`,
            height: `${frameHeight}px`,
            maxWidth: "100%",
            maxHeight: "100%",
          }}
        >
          <img
            src={campaign.image_url}
            alt={campaign.title}
            className={`h-full w-full object-contain ${campaign.link_url ? "cursor-pointer" : ""}`}
            onClick={handleImageClick}
            onLoad={(e) => {
              const { naturalWidth, naturalHeight } = e.currentTarget;
              if (naturalWidth > 0 && naturalHeight > 0) {
                setImageRatio(naturalWidth / naturalHeight);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default CampaignModal;

