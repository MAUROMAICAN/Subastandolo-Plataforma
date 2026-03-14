import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { moderateQuestion } from "@/utils/textModeration";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, Send, Store, Clock, ChevronDown } from "lucide-react";

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

  const INITIAL_COUNT = 3;

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
      // Anti-fraud: check for contact info
      const modResult = moderateQuestion(newQuestion);
      if (!modResult.isClean) {
        toast({ title: "Contenido no permitido", description: modResult.violations[0], variant: "destructive" });
        setSubmitting(false);
        return;
      }

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
      }).catch(() => {});

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

  // Mask name for privacy
  const maskName = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length <= 1) return parts[0];
    return `${parts[0]} ${parts[1][0]}.`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-heading font-bold flex items-center gap-2.5">
          <MessageSquare className="h-5 w-5 text-primary dark:text-[#A6E300]" />
          Preguntas y respuestas
        </h3>
        {questions.length > 0 && (
          <span className="text-sm text-muted-foreground">{questions.length} pregunta{questions.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Ask form — inline input style */}
      {user && user.id !== sellerId && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Pregúntale al vendedor</p>
          <div className="flex items-start gap-3">
            <input
              type="text"
              placeholder="Escribe tu pregunta..."
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && newQuestion.trim().length >= 10) { e.preventDefault(); handleSubmit(); } }}
              maxLength={500}
              className="flex-1 h-11 px-4 rounded-lg bg-secondary/40 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 dark:focus:ring-[#A6E300]/30 focus:border-primary dark:focus:border-[#A6E300] transition-all"
            />
            <Button
              onClick={handleSubmit}
              disabled={submitting || newQuestion.trim().length < 10}
              className="h-11 px-6 rounded-lg font-bold"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" />Preguntar</>}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">{newQuestion.length}/500 · Mínimo 10 caracteres</p>
        </div>
      )}

      {user && user.id === sellerId && (
        <div className="bg-secondary/30 border border-border/50 rounded-lg p-4 flex items-start gap-3">
          <Store className="h-5 w-5 text-primary dark:text-[#A6E300] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">Este es tu producto</p>
            <p className="text-xs text-muted-foreground mt-0.5">Las preguntas de los compradores aparecerán aquí. Respóndelas desde tu <a href="/dealer?tab=questions" className="text-primary dark:text-[#A6E300] font-bold hover:underline">Panel de Dealer</a>.</p>
          </div>
        </div>
      )}

      {!user && (
        <div className="flex items-center gap-3 bg-secondary/20 border border-border/30 rounded-lg px-4 py-3">
          <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            ¿Tienes una duda? <a href="/auth" className="text-primary dark:text-[#A6E300] font-bold hover:underline">Inicia sesión</a> para preguntarle al vendedor.
          </p>
        </div>
      )}

      {/* Divider */}
      {questions.length > 0 && <div className="border-t border-border/50" />}

      {/* Questions list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Aún no hay preguntas sobre este producto.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">¡Sé el primero en preguntar!</p>
        </div>
      ) : (
        <div className="space-y-0">
          {visibleQuestions.map((q, index) => (
            <div key={q.id} className={`py-4 ${index !== 0 ? "border-t border-border/30" : ""}`}>
              {/* Question */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-muted-foreground/20 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-muted-foreground">
                  P
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-relaxed">{q.question}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] text-muted-foreground">{maskName(q.askerName)}</span>
                    <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" /> {timeAgo(q.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Answer */}
              {q.answer && (
                <div className="flex items-start gap-3 mt-3 ml-8">
                  <div className="w-5 h-5 rounded-full bg-primary/15 dark:bg-[#A6E300]/15 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-primary dark:text-[#A6E300]">
                    R
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-relaxed">{q.answer}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] font-semibold text-primary dark:text-[#A6E300]">Vendedor</span>
                      {q.answered_at && (
                        <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" /> {timeAgo(q.answered_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Pending indicator */}
              {!q.answer && q.status === "pending" && (
                <p className="text-[11px] text-muted-foreground/60 mt-2 ml-8 italic">
                  Esperando respuesta del vendedor...
                </p>
              )}
            </div>
          ))}

          {/* See more button */}
          {hasMore && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full py-4 border-t border-border/30 text-sm font-semibold text-primary dark:text-[#A6E300] hover:text-primary/80 dark:hover:text-[#A6E300]/80 flex items-center justify-center gap-2 transition-colors group"
            >
              <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
              Ver todas las preguntas ({questions.length})
            </button>
          )}

          {hasMore && showAll && (
            <button
              onClick={() => setShowAll(false)}
              className="w-full py-4 border-t border-border/30 text-sm font-semibold text-primary dark:text-[#A6E300] hover:text-primary/80 dark:hover:text-[#A6E300]/80 flex items-center justify-center gap-2 transition-colors"
            >
              Ocultar preguntas
            </button>
          )}
        </div>
      )}
    </div>
  );
}
