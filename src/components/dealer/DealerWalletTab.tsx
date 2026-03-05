import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet, DollarSign } from "lucide-react";

export default function DealerWalletTab() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [requestingWithdrawal, setRequestingWithdrawal] = useState(false);
  const [hasPendingWithdrawal, setHasPendingWithdrawal] = useState(false);

  useEffect(() => {
    if (user) fetchWalletData();
  }, [user]);

  const fetchWalletData = async () => {
    if (!user) return;
    setWalletLoading(true);
    const { data: dv } = await supabase
      .from("dealer_verification")
      .select("dealer_balance")
      .eq("user_id", user.id)
      .single();
    setWalletBalance(Number(dv?.dealer_balance) || 0);
    const { data: wr } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("dealer_id", user.id)
      .order("created_at", { ascending: false });
    setWithdrawals(wr || []);
    setHasPendingWithdrawal((wr || []).some((w: any) => w.status === "pending"));
    setWalletLoading(false);
  };

  const handleRequestWithdrawal = async () => {
    if (walletBalance <= 0) {
      toast({ title: "Sin saldo disponible", description: "Tu balance debe ser mayor a $0.", variant: "destructive" });
      return;
    }
    setRequestingWithdrawal(true);
    try {
      const { error } = await supabase.from("withdrawal_requests").insert({
        dealer_id: user!.id,
        amount: walletBalance,
      } as any);
      if (error) throw error;
      toast({ title: "✅ Solicitud Enviada", description: `Retiro de $${walletBalance.toFixed(2)} solicitado. El admin lo procesará.` });
      fetchWalletData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setRequestingWithdrawal(false);
  };

  const statusMap: Record<string, { label: string; color: string; icon: string }> = {
    pending: { label: "Pendiente", color: "bg-warning/10 text-warning border-warning/20", icon: "⏳" },
    approved: { label: "Aprobado", color: "bg-primary/10 text-primary dark:text-[#A6E300] border-primary/20", icon: "✅" },
    rejected: { label: "Rechazado", color: "bg-destructive/10 text-destructive border-destructive/20", icon: "❌" },
  };

  if (walletLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary dark:text-[#A6E300]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border border-primary/30 rounded-sm bg-primary/5 dark:bg-[#A6E300]/5 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 dark:bg-[#A6E300]/10 rounded-sm">
              <Wallet className="h-8 w-8 text-primary dark:text-[#A6E300]" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Saldo Disponible</p>
              <p className="text-3xl font-heading font-bold text-primary dark:text-[#A6E300]">${walletBalance.toFixed(2)}</p>
            </div>
          </div>
          <Button
            onClick={handleRequestWithdrawal}
            disabled={requestingWithdrawal || walletBalance <= 0 || hasPendingWithdrawal}
            className="mt-4 w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm font-bold"
          >
            {requestingWithdrawal ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Procesando...</>
            ) : hasPendingWithdrawal ? (
              "⏳ Ya tienes un retiro pendiente"
            ) : (
              <><DollarSign className="h-4 w-4 mr-2" /> Solicitar Retiro</>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-border rounded-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary dark:text-[#A6E300]" />
            Historial de Retiros
          </CardTitle>
        </CardHeader>
        <CardContent>
          {withdrawals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No has realizado retiros aún.</p>
          ) : (
            <div className="space-y-2">
              {withdrawals.map((w: any) => {
                const st = statusMap[w.status] || statusMap.pending;
                return (
                  <div key={w.id} className="flex items-center justify-between border border-border rounded-sm px-4 py-3">
                    <div>
                      <p className="text-sm font-bold">${Number(w.amount).toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(w.created_at).toLocaleDateString("es-MX")}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${st.color}`}>
                      {st.icon} {st.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="bg-secondary/50 rounded-sm p-4 text-xs text-muted-foreground space-y-2">
        <p className="font-semibold text-foreground">ℹ️ ¿Cómo funciona tu billetera?</p>
        <ul className="list-disc ml-4 space-y-1">
          <li>Cuando se libera un pago verificado, tu comisión neta (95%) se acredita a tu balance.</li>
          <li>Puedes solicitar un retiro en cualquier momento, el admin lo procesará a tu cuenta bancaria registrada.</li>
          <li>Solo puedes tener un retiro pendiente a la vez.</li>
        </ul>
      </div>
    </div>
  );
}
