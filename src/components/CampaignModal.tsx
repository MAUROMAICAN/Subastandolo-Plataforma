import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { X } from "lucide-react";

const AUTO_DISMISS_MS = 8_000; // 8 seconds

interface Campaign {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  target_user_ids: string[] | null;
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
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);

  const fetchActiveCampaign = useCallback(async () => {
    const nowIso = new Date().toISOString();

    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id, title, image_url, link_url, target_user_ids")
      .eq("is_active", true)
      .lte("starts_at", nowIso)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!campaigns || campaigns.length === 0) return;

    // Find first campaign that targets this user (or targets everyone)
    const activeCampaign = ((campaigns as unknown) as Campaign[]).find((c) => {
      if (!c.target_user_ids) return true; // null = all users
      if (!user) return false; // targeted campaign but no user logged in
      return c.target_user_ids.includes(user.id);
    });

    if (!activeCampaign) return;

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
    setProgress(100);
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

  // ── Auto-dismiss timer with progress bar ──
  useEffect(() => {
    if (!campaign || !visible) return;

    const TICK = 50;
    const startTime = Date.now();
    let pauseOffset = 0;
    let pauseStart = 0;

    const interval = setInterval(() => {
      if (pausedRef.current) {
        if (!pauseStart) pauseStart = Date.now();
        return;
      }
      if (pauseStart) {
        pauseOffset += Date.now() - pauseStart;
        pauseStart = 0;
      }
      const elapsed = Date.now() - startTime - pauseOffset;
      const remaining = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        setVisible(false);
        setTimeout(() => setCampaign(null), 260);
      }
    }, TICK);

    timerRef.current = interval;
    return () => clearInterval(interval);
  }, [campaign?.id, visible]);

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

  const maxW = viewport.width * 0.70;
  const maxH = viewport.height * 0.70;
  const ratio = imageRatio ?? 9 / 16;
  const frameWidth = Math.min(maxW, maxH * ratio);
  const frameHeight = Math.min(maxH, frameWidth / ratio);

  return (
    <div
      className={`fixed inset-0 z-[9999] transition-all duration-300 ${visible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      style={{
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        backgroundColor: "rgba(0,0,0,0.80)",
      }}
      onClick={handleDismiss}
    >
      <div
        className={`relative flex h-full w-full items-center justify-center transition-all duration-300 ${visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}
        onTouchStart={() => { pausedRef.current = true; }}
        onTouchEnd={() => { pausedRef.current = false; }}
      >
        <div
          className="relative overflow-hidden rounded-2xl shadow-2xl"
          style={{
            width: `${frameWidth}px`,
            height: `${frameHeight}px`,
            maxWidth: "92vw",
            maxHeight: "88vh",
          }}
        >
          {/* Close button — inside the image, top-right, always visible */}
          <button
            onClick={handleDismiss}
            className="absolute right-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm transition-transform hover:scale-110 active:scale-95"
            style={{ top: "max(env(safe-area-inset-top, 0px), 12px)" }}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Campaign image — fills the frame */}
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

          {/* Auto-dismiss progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
            <div
              className="h-full bg-[#c8f135] transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignModal;

