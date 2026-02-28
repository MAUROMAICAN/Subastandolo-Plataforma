import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import StarRating from "@/components/StarRating";
import { Loader2, Send } from "lucide-react";

interface ReviewFormProps {
  auctionId: string;
  reviewedId: string;
  reviewType: "buyer_to_dealer" | "dealer_to_buyer";
  onSubmitted?: () => void;
}

const DEALER_TAGS = [
  "Producto impecable",
  "Excelente comunicación",
  "Envío rápido",
  "Bien empaquetado",
  "Tal cual la descripción",
  "Muy profesional",
];

const BUYER_TAGS = [
  "Pago puntual",
  "Buena comunicación",
  "Comprador confiable",
  "Fácil de contactar",
  "Recomendado",
];

const ReviewForm = ({ auctionId, reviewedId, reviewType, onSubmitted }: ReviewFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Aspect ratings
  const [productAccuracy, setProductAccuracy] = useState(0);
  const [attentionQuality, setAttentionQuality] = useState(0);
  const [shippingSpeed, setShippingSpeed] = useState(0);
  const [paymentCompliance, setPaymentCompliance] = useState(0);
  const [communicationQuality, setCommunicationQuality] = useState(0);

  const isDealerReview = reviewType === "buyer_to_dealer";
  const tags = isDealerReview ? DEALER_TAGS : BUYER_TAGS;

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const canSubmit = rating > 0 && (
    isDealerReview
      ? productAccuracy > 0 && attentionQuality > 0 && shippingSpeed > 0
      : paymentCompliance > 0 && communicationQuality > 0
  );

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);

    const reviewData: Record<string, any> = {
      auction_id: auctionId,
      reviewer_id: user.id,
      reviewed_id: reviewedId,
      review_type: reviewType,
      rating,
      comment: comment.trim() || null,
      tags: selectedTags,
    };

    if (isDealerReview) {
      reviewData.product_accuracy = productAccuracy;
      reviewData.attention_quality = attentionQuality;
      reviewData.shipping_speed = shippingSpeed;
    } else {
      reviewData.payment_compliance = paymentCompliance;
      reviewData.communication_quality = communicationQuality;
    }

    const { error } = await supabase.from("reviews").insert(reviewData as any);

    if (error) {
      if (error.code === "23505") {
        toast({ title: "Ya calificaste esta transacción", variant: "destructive" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "⭐ ¡Calificación enviada!", description: "Gracias por tu reseña." });
      onSubmitted?.();
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      {/* Overall rating */}
      <div className="space-y-1">
        <p className="text-xs font-medium">Calificación General *</p>
        <StarRating rating={rating} size="lg" interactive onChange={setRating} />
      </div>

      {/* Aspect ratings */}
      {isDealerReview ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">Producto / Descripción *</p>
            <StarRating rating={productAccuracy} size="md" interactive onChange={setProductAccuracy} />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">Atención *</p>
            <StarRating rating={attentionQuality} size="md" interactive onChange={setAttentionQuality} />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">Velocidad de Envío *</p>
            <StarRating rating={shippingSpeed} size="md" interactive onChange={setShippingSpeed} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">Cumplimiento de Pago *</p>
            <StarRating rating={paymentCompliance} size="md" interactive onChange={setPaymentCompliance} />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">Comunicación *</p>
            <StarRating rating={communicationQuality} size="md" interactive onChange={setCommunicationQuality} />
          </div>
        </div>
      )}

      {/* Quick tags */}
      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground">Etiquetas rápidas (opcional)</p>
        <div className="flex flex-wrap gap-1.5">
          {tags.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`text-[10px] px-2 py-1 rounded-sm border transition-colors ${
                selectedTags.includes(tag)
                  ? "bg-primary/10 border-primary/30 text-primary font-medium"
                  : "bg-card border-border text-muted-foreground hover:border-primary/20"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div className="space-y-1">
        <p className="text-[11px] text-muted-foreground">Comentario (opcional)</p>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Comparte tu experiencia..."
          rows={3}
          className="rounded-sm text-sm"
          maxLength={500}
        />
        <p className="text-[9px] text-muted-foreground text-right">{comment.length}/500</p>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-sm"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
        Enviar Calificación
      </Button>
    </div>
  );
};

export default ReviewForm;
