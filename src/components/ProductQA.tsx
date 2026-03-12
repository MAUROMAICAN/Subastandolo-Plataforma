import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquare, Send, User, Store, Clock, ChevronDown, ChevronUp } from "lucide-react";

interface Question {
  id: string;
  question: string;
  answer: string | null;
  answered_at: string | null;
  status: string;
  created_at: string;
  askerName: string;
}

interface Props {
  productId: string;
  sellerId: string;
}

export default function ProductQA({ productId, sellerId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [showAll, setShowAll] = useState(false);

  const INITIAL_COUNT = 5;

  useEffect(() => {
    fetchQuestions();
  }, [productId]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from("product_questions")
        .select("id, question, answer, answered_at, status, created_at, asker_id")
        .eq("product_id", productId)
        .in("status", ["pending", "answered"])
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;

      // Fetch asker names
      const askerIds = [...new Set((data || []).map((q: any) => q.asker_id).filter(Boolean))];
      let nameMap: Record<string, string> = {};
      if (askerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", askerIds);
        nameMap = (profiles || []).reduce((acc: any, p: any) => ({
          ...acc,
          [p.id]: p.full_name || "Usuario"
        }), {});
      }

      setQuestions((data || []).map((q: any) => ({
        ...q,
        askerName: nameMap[q.asker_id] || "Usuario",
      })));
    } catch (err: any) {
      console.error("Error fetching questions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "Inicia sesión", description: "Debes iniciar sesión para preguntar.", variant: "destructive" });
      return;
    }
    if (!newQuestion.trim() || newQuestion.trim().length < 10) {
      toast({ title: "Pregunta muy corta", description: "Escribe al menos 10 caracteres.", variant: "destructive" });
      return;
    }
    if (user.id === sellerId) {
      toast({ title: "No puedes preguntar", description: "No puedes hacer preguntas en tu propio producto.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await (supabase
        .from("product_questions")
        .insert({
          product_id: productId,
          asker_id: user.id,
          question: newQuestion.trim(),
          status: "pending",
        }) as any);

      if (error) throw error;

      // Increment questions_count
      await (supabase.rpc as any)("increment_field", {
        table_name: "marketplace_products",
        field_name: "questions_count",
        row_id: productId,
      }).catch(() => {
        // If RPC doesn't exist, just ignore
      });

      toast({ title: "¡Pregunta enviada!", description: "El vendedor responderá pronto." });
      setNewQuestion("");
      fetchQuestions();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const visibleQuestions = showAll ? questions : questions.slice(0, INITIAL_COUNT);
  const hasMore = questions.length > INITIAL_COUNT;

  // Format relative time
  const timeAgo = (dateStr: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return "hace un momento";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `hace ${days}d`;
    return new Date(dateStr).toLocaleDateString("es-VE", { day: "numeric", month: "short" });
  };

  // Mask name for privacy: "Mauro J."
  const maskName = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length <= 1) return parts[0];
    return `${parts[0]} ${parts[1][0]}.`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-foreground" />
        <h3 className="font-heading font-bold text-lg">Preguntas y respuestas</h3>
        {questions.length > 0 && (
          <span className="text-xs text-muted-foreground">({questions.length})</span>
        )}
      </div>

      {/* Ask form - only for authenticated non-seller users */}
      {user && user.id !== sellerId && (
        <div className="bg-secondary/30 rounded-lg p-4 border border-border/50">
          <Textarea
            placeholder="Escribe tu pregunta sobre este producto..."
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            className="resize-none bg-background border-border min-h-[80px] text-sm"
            maxLength={500}
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-muted-foreground">{newQuestion.length}/500</p>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || newQuestion.trim().length < 10}
              className="rounded-lg"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
              Preguntar
            </Button>
          </div>
        </div>
      )}

      {!user && (
        <p className="text-sm text-muted-foreground bg-secondary/20 p-3 rounded-lg border border-border/30 text-center">
          <a href="/auth" className="text-primary dark:text-[#A6E300] font-semibold hover:underline">Inicia sesión</a> para hacer una pregunta
        </p>
      )}

      {/* Questions list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : questions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Aún no hay preguntas sobre este producto. ¡Sé el primero en preguntar!
        </p>
      ) : (
        <div className="space-y-3">
          {visibleQuestions.map((q) => (
            <div key={q.id} className="border border-border/50 rounded-lg p-4 bg-card/50">
              {/* Question */}
              <div className="flex items-start gap-2">
                <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-foreground">{maskName(q.askerName)}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" /> {timeAgo(q.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{q.question}</p>
                </div>
              </div>

              {/* Answer */}
              {q.answer && (
                <div className="flex items-start gap-2 mt-3 ml-4 pl-4 border-l-2 border-primary/30 dark:border-[#A6E300]/30">
                  <div className="h-6 w-6 rounded-full bg-primary/10 dark:bg-[#A6E300]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Store className="h-3.5 w-3.5 text-primary dark:text-[#A6E300]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-primary dark:text-[#A6E300]">Vendedor</span>
                      {q.answered_at && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" /> {timeAgo(q.answered_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{q.answer}</p>
                  </div>
                </div>
              )}

              {/* Pending badge */}
              {!q.answer && q.status === "pending" && (
                <p className="text-[10px] text-muted-foreground mt-2 ml-8 italic">
                  Esperando respuesta del vendedor...
                </p>
              )}
            </div>
          ))}

          {/* Show more / less */}
          {hasMore && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full py-2 text-xs font-semibold text-primary dark:text-[#A6E300] hover:text-primary/80 flex items-center justify-center gap-1 transition-colors"
            >
              {showAll ? (
                <><ChevronUp className="h-3.5 w-3.5" /> Ver menos preguntas</>
              ) : (
                <><ChevronDown className="h-3.5 w-3.5" /> Ver las {questions.length - INITIAL_COUNT} preguntas restantes</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
