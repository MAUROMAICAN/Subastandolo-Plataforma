import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Loader2, Eye, Gavel, Users, LayoutDashboard, Settings, MessageCircle,
  Menu, ChevronLeft, Globe, ShieldAlert, CreditCard, Shield, Search, Package, Flag, Trophy, TrendingUp, ImagePlus, Bell, LogOut
} from "lucide-react";
import AdminBadge from "@/components/AdminBadge";
import UserManagementPanel from "@/components/UserManagementPanel";
import TeamPanel from "@/components/TeamPanel";

// Extracted tab components
import AdminDashboardTab from "@/components/admin/AdminDashboardTab";
import AdminReviewTab from "@/components/admin/AdminReviewTab";
import AdminAuctionsTab from "@/components/admin/AdminAuctionsTab";
import AdminPaymentsTab from "@/components/admin/AdminPaymentsTab";
import AdminMessagesTab from "@/components/admin/AdminMessagesTab";
import AdminCMSTab from "@/components/admin/AdminCMSTab";
import AdminDealersTab from "@/components/admin/AdminDealersTab";
import AdminDisputesTab from "@/components/admin/AdminDisputesTab";
import AdminReportsTab from "@/components/admin/AdminReportsTab";
import AdminWonAuctionsTab from "@/components/admin/AdminWonAuctionsTab";
import AdminDealerSalesTab from "@/components/admin/AdminDealerSalesTab";
import AdminCampaignsTab from "@/components/admin/AdminCampaignsTab";
import AdminNotificationsTab from "@/components/admin/AdminNotificationsTab";
import type { AdminTab, AuctionExtended, WinnerInfo, BannerImage, DealerUser, Message, SiteSetting, SiteSection } from "@/components/admin/types";

const Admin = () => {
  const { user, isAdmin, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  // Data states
  const [auctions, setAuctions] = useState<AuctionExtended[]>([]);
  const [banners, setBanners] = useState<BannerImage[]>([]);
  const [dealerApps, setDealerApps] = useState<any[]>([]);
  const [winnerProfiles, setWinnerProfiles] = useState<Record<string, WinnerInfo>>({});
  const [allUsers, setAllUsers] = useState<DealerUser[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSetting[]>([]);
  const [siteSections, setSiteSections] = useState<SiteSection[]>([]);
  const [dealerProfiles, setDealerProfiles] = useState<Record<string, string>>({});
  const [adminDisputes, setAdminDisputes] = useState<any[]>([]);
  const [auctionReports, setAuctionReports] = useState<any[]>([]);
  const [paymentProofs, setPaymentProofs] = useState<any[]>([]);

  // CMS / settings
  const [editingSettings, setEditingSettings] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  const [globalSearch, setGlobalSearch] = useState("");

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate("/");
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (!isAdmin || !user) return;
    fetchAllData();
  }, [isAdmin, user]);

  const fetchAllData = async () => {
    const [auctionsRes, bannersRes, appsRes, settingsRes, sectionsRes, messagesRes, disputesRes, paymentsRes, reportsRes] = await Promise.all([
      supabase.from("auctions").select("*").order("created_at", { ascending: false }),
      supabase.from("banner_images").select("*").order("display_order"),
      supabase.from("dealer_verification").select("*").order("created_at", { ascending: false }),
      supabase.from("site_settings").select("*").order("category, label"),
      supabase.from("site_sections").select("*").order("display_order"),
      supabase.from("messages").select("*").or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`).order("created_at", { ascending: false }).limit(100),
      supabase.from("disputes").select("*").order("created_at", { ascending: false }),
      supabase.from("payment_proofs").select("*").order("created_at", { ascending: false }),
      supabase.from("auction_reports" as any).select("*").order("created_at", { ascending: false }),
    ]);

    const auctionList = auctionsRes.data || [];
    const auctionIds = auctionList.map(a => a.id);

    const [imagesRes, bidsRes, profilesRes, rolesRes] = await Promise.all([
      auctionIds.length > 0 ? supabase.from("auction_images").select("*").in("auction_id", auctionIds).order("display_order") : { data: [] },
      auctionIds.length > 0 ? supabase.from("bids").select("auction_id").in("auction_id", auctionIds) : { data: [] },
      supabase.from("profiles").select("id, full_name, phone, created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const imagesMap: Record<string, any[]> = {};
    ((imagesRes as any).data || []).forEach((img: any) => {
      if (!imagesMap[img.auction_id]) imagesMap[img.auction_id] = [];
      imagesMap[img.auction_id].push(img);
    });

    const bidsCountMap: Record<string, number> = {};
    ((bidsRes as any).data || []).forEach((b: any) => {
      bidsCountMap[b.auction_id] = (bidsCountMap[b.auction_id] || 0) + 1;
    });

    // We also need images for reports specifically since they may reference past/archived auctions
    const reportAuctionIds = ((reportsRes as any).data || []).map((r: any) => r.auction_id).filter(Boolean);
    if (reportAuctionIds.length > 0) {
      const { data: reportImages } = await supabase.from("auction_images").select("*").in("auction_id", reportAuctionIds).order("display_order");
      (reportImages || []).forEach((img: any) => {
        if (!imagesMap[img.auction_id]) imagesMap[img.auction_id] = [];
        // Only push if it's not already there avoiding duplicates
        if (!imagesMap[img.auction_id].find(i => i.id === img.id)) {
          imagesMap[img.auction_id].push(img);
        }
      });
    }

    const profileMap: Record<string, any> = {};
    const dealerNames: Record<string, string> = {};
    ((profilesRes as any).data || []).forEach((p: any) => {
      profileMap[p.id] = p;
      dealerNames[p.id] = p.full_name;
    });
    setDealerProfiles(dealerNames);

    const rolesMap: Record<string, string[]> = {};
    ((rolesRes as any).data || []).forEach((r: any) => {
      if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
      rolesMap[r.user_id].push(r.role);
    });

    const users: DealerUser[] = ((profilesRes as any).data || []).map((p: any) => ({
      user_id: p.id,
      full_name: p.full_name,
      phone: p.phone,
      role: rolesMap[p.id]?.includes("admin") ? "admin" : rolesMap[p.id]?.includes("dealer") ? "dealer" : "user",
      roles: rolesMap[p.id] || ["user"],
      created_at: p.created_at,
    }));
    setAllUsers(users);

    try {
      const { data: emailData } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "list_users", userId: "all" },
      });
      if (emailData?.emails) {
        setAllUsers(prev => prev.map(u => ({ ...u, email: emailData.emails[u.user_id] || "" })));
      }
    } catch (e) {
      console.error("Error fetching emails:", e);
    }

    const enriched: AuctionExtended[] = auctionList.map(a => ({
      ...a,
      status: (a as any).status || 'active',
      admin_notes: (a as any).admin_notes || null,
      images: imagesMap[a.id] || [],
      dealer_name: dealerNames[a.created_by] || "Desconocido",
      bids_count: bidsCountMap[a.id] || 0,
    }));

    setAuctions(enriched);
    setBanners((bannersRes.data as BannerImage[]) || []);
    setDealerApps(appsRes.data || []);
    setSiteSettings((settingsRes.data as SiteSetting[]) || []);
    setSiteSections((sectionsRes.data as SiteSection[]) || []);
    setMessages((messagesRes.data as Message[]) || []);

    const editMap: Record<string, string> = {};
    ((settingsRes.data || []) as SiteSetting[]).forEach(s => { editMap[s.setting_key] = s.setting_value || ""; });
    setEditingSettings(editMap);

    const winnerIds = auctionList.filter(a => a.winner_id).map(a => a.winner_id!);

    // Fetch emails first so we can include them in winnerProfiles
    let emailMap: Record<string, string> = {};
    try {
      const { data: emailData } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "list_users", userId: "all" },
      });
      if (emailData?.emails) {
        emailMap = emailData.emails;
        setAllUsers(prev => prev.map(u => ({ ...u, email: emailMap[u.user_id] || "" })));
      }
    } catch (e) {
      console.error("Error fetching emails:", e);
    }

    if (winnerIds.length > 0) {
      const uniqueIds = [...new Set(winnerIds)];
      const map: Record<string, WinnerInfo> = {};
      uniqueIds.forEach(id => {
        const p = profileMap[id];
        if (p) map[id] = { full_name: p.full_name, phone: p.phone, email: emailMap[id] || null };
      });
      setWinnerProfiles(map);
    }

    const disputesList = (disputesRes.data || []).map((d: any) => ({
      ...d,
      auction_title: auctionList.find(a => a.id === d.auction_id)?.title || "Subasta",
      buyer_name: dealerNames[d.buyer_id] || "Comprador",
      dealer_name: dealerNames[d.dealer_id] || "Dealer",
    }));
    setAdminDisputes(disputesList);

    const paymentsList = (paymentsRes.data || []).map((p: any) => ({
      ...p,
      auction_title: auctionList.find(a => a.id === p.auction_id)?.title || "Subasta",
      buyer_name: dealerNames[p.buyer_id] || "Comprador",
    }));
    setPaymentProofs(paymentsList);

    const reportsList = ((reportsRes as any).data || []).map((r: any) => ({
      ...r,
      auction_title: auctionList.find(a => a.id === r.auction_id)?.title || "Subasta",
      auction_image: imagesMap[r.auction_id]?.[0]?.image_url || null,
      reporter_name: dealerNames[r.reporter_id] || "Usuario",
    }));
    setAuctionReports(reportsList);

    setLoading(false);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    let hasError = false;
    for (const [key, newValue] of Object.entries(editingSettings)) {
      const existingSetting = siteSettings.find(s => s.setting_key === key);
      const oldValue = existingSetting ? (existingSetting.setting_value || "") : "";

      if (newValue !== oldValue) {
        if (existingSetting) {
          const { error } = await supabase.from("site_settings").update({ setting_value: newValue, updated_by: user!.id, updated_at: new Date().toISOString() } as any).eq("setting_key", key);
          if (error) {
            toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
            hasError = true;
            break;
          }
        } else {
          const { error } = await supabase.from("site_settings").insert({
            setting_key: key,
            setting_value: newValue,
            setting_type: key.includes("color") ? "color" : "text",
            category: "general",
            label: key,
          } as any);
          if (error) {
            toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
            hasError = true;
            break;
          }
        }
      }
    }
    if (!hasError) toast({ title: "✅ Cambios guardados", description: "La configuración se ha guardado exitosamente." });
    setSavingSettings(false); fetchAllData();
  };

  // Computed values
  const commissionPct = parseFloat(editingSettings["commission_percentage"] || "0");
  const pendingAuctions = auctions.filter(a => a.status === "pending" || a.status === "in_review");
  const dealers = allUsers.filter(u => u.role === "dealer");
  const unreadMessages = messages.filter(m => m.receiver_id === user?.id && !m.is_read).length;
  const openDisputes = adminDisputes.filter((d: any) => d.status === "open" || d.status === "mediation").length;
  const pendingPayments = paymentProofs.filter((p: any) => p.status === "pending").length;

  const sidebarItems: { key: AdminTab; label: string; icon: any; badge?: number }[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "review", label: "Revisión", icon: Eye, badge: pendingAuctions.length },
    { key: "auctions", label: "Subastas", icon: Gavel, badge: auctions.length },
    { key: "payments", label: "Pagos", icon: CreditCard, badge: paymentProofs.length },
    { key: "won", label: "Ganadas", icon: Trophy, badge: auctions.filter(a => a.status === "finalized").length },
    { key: "messages", label: "Mensajes", icon: MessageCircle, badge: messages.length },
    { key: "dealer_sales", label: "Ventas Dealers", icon: TrendingUp },
    { key: "dealers", label: "Dealers", icon: Package, badge: dealers.length },
    { key: "disputes", label: "Disputas", icon: ShieldAlert, badge: adminDisputes.length },
    { key: "reports", label: "Reportes", icon: Flag, badge: auctionReports.length },
    { key: "campaigns", label: "Campañas", icon: ImagePlus },
    { key: "notifications", label: "Push", icon: Bell },
    { key: "users", label: "Usuarios", icon: Users, badge: allUsers.length },
    { key: "team", label: "Equipo", icon: Shield, badge: allUsers.filter(u => u.role === "admin").length },
    { key: "cms", label: "Config. Central", icon: Settings },
  ];

  if (authLoading || !isAdmin) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary dark:text-[#A6E300]" /></div>;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-60 fixed lg:relative z-40" : "w-0 lg:w-16"} bg-nav-solid text-white shrink-0 transition-all duration-300 flex flex-col h-screen lg:sticky top-0 overflow-hidden`}>
        <div className="flex flex-col border-b border-white/10 shrink-0">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-3 h-14 sm:h-16 px-4 hover:bg-white/5 transition-colors text-left"
          >
            {sidebarOpen ? (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center"><Shield className="h-4 w-4 text-accent-foreground" /></div>
                <div><span className="font-heading font-bold text-sm block leading-tight text-white">Admin</span><span className="text-[10px] text-white/40 leading-tight">Panel de Control</span></div>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center mx-auto"><Shield className="h-4 w-4 text-accent-foreground" /></div>
            )}
          </button>

          <div className="px-2 pb-2 space-y-1">
            <button onClick={() => navigate("/")} className="flex items-center gap-2.5 text-xs text-white/40 hover:text-white w-full px-3 py-2 rounded-md hover:bg-white/5 transition-colors">
              <Globe className="h-3.5 w-3.5" />{sidebarOpen && <span>Ver sitio</span>}
            </button>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="hidden lg:flex items-center gap-2.5 text-xs text-white/30 hover:text-white w-full px-3 py-2 rounded-md hover:bg-white/5 transition-colors">
              {sidebarOpen ? <ChevronLeft className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}{sidebarOpen && <span>Colapsar</span>}
            </button>
          </div>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {sidebarOpen && <p className="text-[10px] uppercase tracking-wider text-white/30 font-medium px-2 mb-2">Navegación</p>}
          {sidebarItems.map(item => (
            <button key={item.key} onClick={() => { setActiveTab(item.key); if (window.innerWidth < 1024) setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs rounded-md transition-all relative ${activeTab === item.key ? "bg-accent text-accent-foreground font-semibold shadow-md" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
              <item.icon className={`h-4 w-4 shrink-0`} />
              {sidebarOpen && <span>{item.label}</span>}
              {item.badge && item.badge > 0 && (
                <span className={`${sidebarOpen ? "ml-auto" : "absolute -top-1 -right-1"} min-w-[20px] h-5 px-1 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center font-bold`}>{item.badge}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10 shrink-0 flex flex-col items-center">
          <span className="text-[10px] text-white/20">v1.2.0</span>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="sticky top-0 z-20 bg-card border-b border-border h-14 sm:h-16 flex items-center justify-between px-3 sm:px-6 shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground">
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="font-heading font-bold text-sm sm:text-base text-foreground hidden sm:block truncate">{sidebarItems.find(s => s.key === activeTab)?.label || "Dashboard"}</h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-1 max-w-md mx-2 sm:mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} className="pl-10 h-8 sm:h-9 rounded-md bg-secondary/50 border-border text-xs sm:text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="relative">
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-foreground" onClick={() => setActiveTab("messages")}>
                <MessageCircle className="h-4 w-4" />
              </Button>
              {unreadMessages > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] rounded-full flex items-center justify-center font-bold">{unreadMessages}</span>}
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/")} className="h-8 px-2 sm:px-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground hidden sm:flex">
              <LogOut className="h-3.5 w-3.5" /> Salir
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigate("/")} className="h-8 w-8 sm:hidden text-muted-foreground">
              <LogOut className="h-4 w-4" />
            </Button>
            <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-border">
              <Avatar className="h-8 w-8 border border-border">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile?.full_name || ""} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">{(profile?.full_name || "A").charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="hidden md:flex items-center gap-2">
                <div><p className="text-xs font-medium text-foreground leading-tight">{profile?.full_name || "Administrador"}</p><p className="text-[10px] text-muted-foreground leading-tight">Admin</p></div>
                <AdminBadge size="md" />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-6 overflow-y-auto">
          <div className="max-w-5xl mx-auto">
            {activeTab === "dashboard" && (
              <AdminDashboardTab auctions={auctions} allUsers={allUsers} editingSettings={editingSettings} setEditingSettings={setEditingSettings} savingSettings={savingSettings} handleSaveSettings={handleSaveSettings} setActiveTab={setActiveTab} />
            )}
            {activeTab === "review" && <AdminReviewTab auctions={auctions} fetchAllData={fetchAllData} />}
            {activeTab === "auctions" && <AdminAuctionsTab auctions={auctions} winnerProfiles={winnerProfiles} commissionPct={commissionPct} fetchAllData={fetchAllData} />}
            {activeTab === "payments" && <AdminPaymentsTab paymentProofs={paymentProofs} fetchAllData={fetchAllData} />}
            {activeTab === "won" && <AdminWonAuctionsTab auctions={auctions} winnerProfiles={winnerProfiles} dealerProfiles={dealerProfiles} paymentProofs={paymentProofs} />}
            {activeTab === "messages" && <AdminMessagesTab dealers={dealers} messages={messages} dealerProfiles={dealerProfiles} fetchAllData={fetchAllData} />}
            {activeTab === "cms" && <AdminCMSTab siteSettings={siteSettings} siteSections={siteSections} banners={banners} editingSettings={editingSettings} setEditingSettings={setEditingSettings} savingSettings={savingSettings} setSavingSettings={setSavingSettings} handleSaveSettings={handleSaveSettings} fetchAllData={fetchAllData} />}
            {activeTab === "dealer_sales" && <AdminDealerSalesTab />}
            {activeTab === "dealers" && <AdminDealersTab dealerApps={dealerApps} fetchAllData={fetchAllData} />}
            {activeTab === "disputes" && <AdminDisputesTab adminDisputes={adminDisputes} fetchAllData={fetchAllData} />}
            {activeTab === "reports" && <AdminReportsTab auctionReports={auctionReports} fetchAllData={fetchAllData} />}
            {activeTab === "campaigns" && <AdminCampaignsTab />}
            {activeTab === "notifications" && <AdminNotificationsTab />}
            {activeTab === "users" && <UserManagementPanel allUsers={allUsers} onRefresh={fetchAllData} />}
            {activeTab === "team" && <TeamPanel />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Admin;
