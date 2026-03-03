import { useState } from "react";
import StarRating from "@/components/StarRating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { User, MessageSquareReply, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ReviewCardProps {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string | null;
  tags: string[];
  productAccuracy?: number | null;
  attentionQuality?: number | null;
  shippingSpeed?: number | null;
  paymentCompliance?: number | null;
  communicationQuality?: number | null;
  createdAt: string;
  reviewType: string;
  replyText?: string | null;
  repliedAt?: string | null;
  reviewedId: string;
  currentUserId?: string;
  onReplySubmitted?: () => void;
}

import { maskName } from "@/lib/utils";

const ReviewCard = ({
  id,
  reviewerName,
  rating,
  comment,
  tags,
  productAccuracy,
  attentionQuality,
  shippingSpeed,
  paymentCompliance,
  communicationQuality,
  createdAt,
  reviewType,
  replyText,
  repliedAt,
  reviewedId,
  currentUserId,
  onReplySubmitted,
}: ReviewCardProps) => {
  const isDealerReview = reviewType === "buyer_to_dealer";
  const timeAgo = getTimeAgo(createdAt);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const canReply = currentUserId === reviewedId && !replyText;

  const handleSubmitReply = async () => {
    if (!replyDraft.trim()) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("reviews")
      .update({ reply_text: replyDraft.trim(), replied_at: new Date().toISOString() } as any)
      .eq("id", id);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error al responder", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Respuesta publicada" });
      setShowReplyForm(false);
      onReplySubmitted?.();
    }
  };

  return (
    <div className="bg-card border border-border rounded-sm p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div>
            <span className="text-sm font-medium">{maskName(reviewerName)}</span>
            <span className="text-[10px] text-muted-foreground ml-2">{timeAgo}</span>
          </div>
        </div>
        <StarRating rating={rating} size="sm" />
      </div>

      {/* Aspect breakdown */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {isDealerReview ? (
          <>
            {productAccuracy && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Producto:</span>
                <StarRating rating={productAccuracy} size="sm" />
              </div>
            )}
            {attentionQuality && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Atención:</span>
                <StarRating rating={attentionQuality} size="sm" />
              </div>
            )}
            {shippingSpeed && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Envío:</span>
                <StarRating rating={shippingSpeed} size="sm" />
              </div>
            )}
          </>
        ) : (
          <>
            {paymentCompliance && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Pago:</span>
                <StarRating rating={paymentCompliance} size="sm" />
              </div>
            )}
            {communicationQuality && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Comunicación:</span>
                <StarRating rating={communicationQuality} size="sm" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Comment */}
      {comment && (
        <p className="text-sm text-foreground leading-relaxed">"{comment}"</p>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map(tag => (
            <Badge key={tag} variant="outline" className="text-[9px] bg-primary/5 border-primary/15 text-primary px-1.5 py-0">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Reply display */}
      {replyText && (
        <div className="ml-4 mt-2 border-l-2 border-primary/20 pl-3 py-1.5 bg-muted/30 rounded-r-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Store className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-semibold text-primary">
              Respuesta del {isDealerReview ? "vendedor" : "comprador"}
            </span>
            {repliedAt && (
              <span className="text-[9px] text-muted-foreground">· {getTimeAgo(repliedAt)}</span>
            )}
          </div>
          <p className="text-xs text-foreground leading-relaxed">{replyText}</p>
        </div>
      )}

      {/* Reply button */}
      {canReply && !showReplyForm && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] text-muted-foreground gap-1"
          onClick={() => setShowReplyForm(true)}
        >
          <MessageSquareReply className="h-3 w-3" />
          Responder
        </Button>
      )}

      {/* Reply form */}
      {showReplyForm && (
        <div className="ml-4 mt-1 space-y-2">
          <Textarea
            placeholder="Escribe tu respuesta..."
            value={replyDraft}
            onChange={e => setReplyDraft(e.target.value)}
            className="text-sm min-h-[60px]"
            maxLength={500}
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-[11px]" onClick={handleSubmitReply} disabled={submitting || !replyDraft.trim()}>
              {submitting ? "Enviando..." : "Publicar respuesta"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setShowReplyForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days}d`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months > 1 ? "es" : ""}`;
}

export default ReviewCard;
