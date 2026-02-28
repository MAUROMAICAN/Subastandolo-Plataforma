import { Share2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, forwardRef } from "react";
import { useToast } from "@/hooks/use-toast";

const REFER_URL = "https://www.subastandolo.com";
const REFER_TEXT = "¡Descubre subastas increíbles en Subastandolo! Compra productos a precios únicos 🔥";

const ReferButton = forwardRef<HTMLButtonElement, { variant?: "default" | "compact" }>(
  ({ variant = "default" }, ref) => {
    const [copied, setCopied] = useState(false);
    const { toast } = useToast();

    const handleShare = async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title: "Subastandolo", text: REFER_TEXT, url: REFER_URL });
        } catch { /* user cancelled */ }
      } else {
        await navigator.clipboard.writeText(`${REFER_TEXT}\n${REFER_URL}`);
        setCopied(true);
        toast({ title: "¡Link copiado! 🎉", description: "Compártelo con tus amigos" });
        setTimeout(() => setCopied(false), 2000);
      }
    };

    if (variant === "compact") {
      return (
        <button ref={ref} onClick={handleShare} className="px-3 py-1.5 text-accent hover:text-accent/80 hover:bg-white/5 transition-colors font-semibold flex items-center gap-1.5 border border-accent/40 rounded-sm text-xs">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
          {copied ? "¡Copiado!" : "Referir amigo"}
        </button>
      );
    }

    return (
      <Button ref={ref} onClick={handleShare} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
        {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
        {copied ? "¡Copiado!" : "Referir a un amigo"}
      </Button>
    );
  }
);

ReferButton.displayName = "ReferButton";

export default ReferButton;
