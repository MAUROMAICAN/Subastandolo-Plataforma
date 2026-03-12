import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Send, Clock, CheckCircle2, User, Package } from "lucide-react";

interface Question {
  id: string;
  product_id: string;
  question: string;
  answer: string | null;
  status: string;
  created_at: string;
  askerName: string;
  productTitle: string;
  productImage: string | null;
}

interface Props {
  dealerId: string;
}

export default function DealerQuestionsTab({ dealerId }: Props) {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "answered" | "all">("pending");
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, [dealerId]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      // Get all products owned by this dealer
      const { data: products } = await (supabase
        .from("marketplace_products")
        .select("id, title, image_url")
        .eq("seller_id", dealerId) as any);

      if (!products || products.length === 0) {
        setQuestions([]);
        setLoading(false);
        return;
      }

      const productIds = products.map((p: any) => p.id);
      const productMap = products.reduce((acc: any, p: any) => ({
        ...acc,
        [p.id]: { title: p.title, image: p.image_url }
      }), {});

      // Fetch questions for all products
      const { data: qData, error } = await (supabase
        .from("product_questions")
        .select("id, product_id, question, answer, status, created_at, asker_id")
        .in("product_id", productIds)
        .in("status", ["pending", "answered"])
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;

      // Fetch asker names
      const askerIds = [...new Set((qData || []).map((q: any) => q.asker_id).filter(Boolean))];
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

      setQuestions((qData || []).map((q: any) => ({
        ...q,
        askerName: nameMap[q.asker_id] || "Usuario",
        productTitle: productMap[q.product_id]?.title || "Producto",
        productImage: productMap[q.product_id]?.image || null,
      })));
    } catch (err: any) {
      console.error("Error fetching questions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (questionId: string) => {
    if (!answerText.trim() || answerText.trim().length < 5) {
      toast({ title: "Respuesta muy corta", description: "Escribe al menos 5 caracteres.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await (supabase
        .from("product_questions")
        .update({
          answer: answerText.trim(),
          answered_by: dealerId,
          answered_at: new Date().toISOString(),
          status: "answered",
        })
        .eq("id", questionId) as any);

      if (error) throw error;

      toast({ title: "✅ Respuesta enviada", description: "Tu respuesta ya es visible para todos." });
      setAnsweringId(null);
      setAnswerText("");
      fetchQuestions();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredQuestions = questions.filter(q => {
    if (filter === "all") return true;
    return q.status === filter;
  });

  const pendingCount = questions.filter(q => q.status === "pending").length;

  const timeAgo = (dateStr: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return "ahora";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-heading font-bold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Preguntas de Compradores
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Responde las preguntas sobre tus productos
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge className="bg-destructive text-destructive-foreground font-bold px-3 py-1">
            {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { key: "pending" as const, label: "Pendientes", count: pendingCount },
          { key: "answered" as const, label: "Respondidas", count: questions.filter(q => q.status === "answered").length },
          { key: "all" as const, label: "Todas", count: questions.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filter === tab.key
              ? "bg-foreground text-background border-foreground"
              : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
              }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Questions list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Cargando preguntas...</p>
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="text-center py-16">
          <div className="h-14 w-14 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-3 border border-border">
            <MessageSquare className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="font-heading font-bold mb-1">
            {filter === "pending" ? "Sin preguntas pendientes" : "No hay preguntas"}
          </p>
          <p className="text-sm text-muted-foreground">
            {filter === "pending" ? "¡Excelente! Todas las preguntas están respondidas." : "Aún no te han hecho preguntas."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuestions.map((q) => (
            <div key={q.id} className={`border rounded-lg p-4 transition-colors ${q.status === "pending"
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-border bg-card"
              }`}>
              {/* Product info */}
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                {q.productImage ? (
                  <img src={q.productImage} alt="" className="h-8 w-8 rounded object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded bg-secondary flex items-center justify-center">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <span className="text-xs font-medium text-foreground truncate flex-1">{q.productTitle}</span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" /> {timeAgo(q.created_at)}
                </span>
              </div>

              {/* Question */}
              <div className="flex items-start gap-2 mb-2">
                <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <span className="text-[10px] text-muted-foreground font-medium">{q.askerName}</span>
                  <p className="text-sm text-foreground mt-0.5">{q.question}</p>
                </div>
              </div>

              {/* Answer or answer form */}
              {q.answer ? (
                <div className="flex items-start gap-2 mt-3 ml-4 pl-3 border-l-2 border-success/30 dark:border-[#A6E300]/30">
                  <CheckCircle2 className="h-4 w-4 text-success dark:text-[#A6E300] mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold text-success dark:text-[#A6E300]">Tu respuesta</span>
                    <p className="text-sm text-foreground mt-0.5">{q.answer}</p>
                  </div>
                </div>
              ) : answeringId === q.id ? (
                <div className="mt-3 space-y-2">
                  <Textarea
                    placeholder="Escribe tu respuesta..."
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    className="resize-none text-sm min-h-[80px] bg-background"
                    maxLength={1000}
                    autoFocus
                  />
                  <div className="flex items-center justify-between">
                    <button onClick={() => { setAnsweringId(null); setAnswerText(""); }} className="text-xs text-muted-foreground hover:text-foreground">
                      Cancelar
                    </button>
                    <Button
                      size="sm"
                      onClick={() => handleAnswer(q.id)}
                      disabled={submitting || answerText.trim().length < 5}
                      className="rounded-lg"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                      Responder
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setAnsweringId(q.id); setAnswerText(""); }}
                  className="mt-2 rounded-lg text-xs"
                >
                  <Send className="h-3 w-3 mr-1.5" /> Responder
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
