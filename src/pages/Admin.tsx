import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Loader2, Eye, Gavel, Users, LayoutDashboard, Settings, MessageCircle, Mail, MailPlus,
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
import AdminEmailsTab from "@/components/admin/AdminEmailsTab";
import AdminMassEmailTab from "@/components/admin/AdminMassEmailTab";
import type { AdminTab, AuctionExtended, WinnerInfo, BannerImage, DealerUser, Message, SiteSetting, SiteSection } from "@/components/admin/types";

const Admin = () => {
  const { user, isAdmin, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Smart alert badges: track last-seen timestamp per tab via localStorage
  const [tabLastSeen, setTabLastSeen] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem("admin_tab_last_seen");
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  const markTabAsSeen = useCallback((tabKey: string) => {
    const now = new Date().toISOString();
    setTabLastSeen(prev => {
      const next = { ...prev, [tabKey]: now };
      localStorage.setItem("admin_tab_last_seen", JSON.stringify(next));
      return next;
    });
  }, []);
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
  const [dealerProfiles, setDealerProfiles] = useState<Record<string, WinnerInfo>>({});
  const [adminDisputes, setAdminDisputes] = useState<any[]>([]);
  const [auctionReports, setAuctionReports] = useState<any[]>([]);
  const [paymentProofs, setPaymentProofs] = useState<any[]>([]);
  const [openTickets, setOpenTickets] = useState(0);

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
    const dealerContactMap: Record<string, WinnerInfo> = {};
    ((profilesRes as any).data || []).forEach((p: any) => {
      profileMap[p.id] = p;
      dealerNames[p.id] = p.full_name;
      dealerContactMap[p.id] = { full_name: p.full_name, phone: p.phone || null, email: null };
    });

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

    // Enrich dealer contacts with emails
    Object.keys(dealerContactMap).forEach(id => {
      dealerContactMap[id].email = emailMap[id] || null;
    });
    setDealerProfiles(dealerContactMap);

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

    // Fetch open support tickets count
    try {
      const { count } = await supabase.from("support_tickets").select("*", { count: "exact", head: true }).in("status", ["open", "pending"]);
      setOpenTickets(count || 0);
    } catch { /* support_tickets table may not exist */ }

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
  const unreadMessages = messages.filter(m => m.receiver_id === user?.id && !m.is_read).length;
  const pendingPayments = paymentProofs.filter((p: any) => p.status === "pending").length;
  const openDisputes = adminDisputes.filter((d: any) => d.status === "open" || d.status === "mediation").length;

  // Helper: count items created after the last time admin visited a given tab
  const countNewSince = (tabKey: string, items: any[]) => {
    const lastSeen = tabLastSeen[tabKey];
    if (!lastSeen) return 0; // first visit → nothing is "new"
    return items.filter(i => i.created_at && new Date(i.created_at) > new Date(lastSeen)).length;
  };

  // Smart badge counts — only items NEW since last visit
  const newReviews = countNewSince("review", auctions.filter(a => a.status === "pending" || a.status === "in_review"));
  const newUsers = countNewSince("users", allUsers);
  const newDealerApps = countNewSince("dealers", dealerApps.filter((d: any) => d.status === "pending"));
  const newMessages = countNewSince("messages", messages.filter(m => m.receiver_id === user?.id));
  const newPayments = countNewSince("payments", paymentProofs.filter((p: any) => p.status === "pending"));
  const newDisputes = countNewSince("disputes", adminDisputes.filter((d: any) => d.status === "open" || d.status === "mediation"));
  const newReports = countNewSince("reports", auctionReports.filter((r: any) => r.status === "pending" || !r.status));

  // Grouped sidebar sections for professional navigation
  const sidebarGroups: { label: string; items: { key: AdminTab; label: string; icon: any; badge?: number; urgent?: boolean }[] }[] = [
    {
      label: "Operaciones",
      items: [
        { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { key: "review", label: "Revisión", icon: Eye, badge: newReviews || undefined, urgent: newReviews > 0 },
        { key: "auctions", label: "Subastas", icon: Gavel },
        { key: "won", label: "Ganadas", icon: Trophy },
        { key: "payments", label: "Pagos", icon: CreditCard, badge: newPayments || undefined, urgent: newPayments > 0 },
      ],
    },
    {
      label: "Usuarios",
      items: [
        { key: "users", label: "Usuarios", icon: Users, badge: newUsers || undefined },
        { key: "dealers", label: "Dealers", icon: Package, badge: newDealerApps || undefined, urgent: newDealerApps > 0 },
        { key: "dealer_sales", label: "Ventas Dealers", icon: TrendingUp },
        { key: "team", label: "Equipo", icon: Shield },
      ],
    },
    {
      label: "Comunicación",
      items: [
        { key: "messages", label: "Mensajes", icon: MessageCircle, badge: newMessages || undefined, urgent: newMessages > 0 },
        { key: "emails", label: "Soporte & Correos", icon: Mail, badge: openTickets || undefined, urgent: openTickets > 0 },
        { key: "mass_email", label: "Correo Masivo", icon: MailPlus },
        { key: "notifications", label: "Push", icon: Bell },
        { key: "campaigns", label: "Campañas", icon: ImagePlus },
      ],
    },
    {
      label: "Sistema",
      items: [
        { key: "disputes", label: "Disputas", icon: ShieldAlert, badge: newDisputes || undefined, urgent: newDisputes > 0 },
        { key: "reports", label: "Reportes", icon: Flag, badge: newReports || undefined, urgent: newReports > 0 },
        { key: "cms", label: "Config. Central", icon: Settings },
      ],
    },
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
        <nav className="flex-1 py-2 px-2 overflow-y-auto">
          {sidebarGroups.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? "mt-1" : ""}>
              {sidebarOpen && (
                <p className="text-[9px] uppercase tracking-widest text-white/25 font-semibold px-3 pt-3 pb-1.5">{group.label}</p>
              )}
              {!sidebarOpen && gi > 0 && (
                <div className="mx-3 my-2 border-t border-white/10" />
              )}
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <button key={item.key} onClick={() => { markTabAsSeen(item.key); setActiveTab(item.key); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all relative ${activeTab === item.key
                      ? "bg-accent/90 text-accent-foreground font-semibold shadow-sm"
                      : "text-white/55 hover:text-white hover:bg-white/8"
                      }`}>
                    <item.icon className="h-4 w-4 shrink-0" />
                    {sidebarOpen && <span>{item.label}</span>}
                    {item.badge != null && item.badge > 0 && (
                      <span className={`${sidebarOpen ? "ml-auto" : "absolute -top-1.5 -right-1.5"} inline-flex items-center justify-center font-bold tracking-tight transition-all duration-300 ${item.urgent
                        ? sidebarOpen
                          ? "min-w-[22px] h-5 px-1.5 text-[10px] rounded-md bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-[0_0_8px_rgba(239,68,68,0.5)] ring-1 ring-red-400/30"
                          : "min-w-[16px] h-4 px-1 text-[8px] rounded-md bg-red-500 text-white shadow-[0_0_6px_rgba(239,68,68,0.6)]"
                        : sidebarOpen
                          ? "min-w-[22px] h-5 px-1.5 text-[10px] rounded-md bg-white/15 text-white/70 ring-1 ring-white/10"
                          : "min-w-[16px] h-4 px-1 text-[8px] rounded-md bg-white/20 text-white/80"
                        }`}>{item.badge > 99 ? "99+" : item.badge}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
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
            <h2 className="font-heading font-bold text-sm sm:text-base text-foreground hidden sm:block truncate">{sidebarGroups.flatMap(g => g.items).find(s => s.key === activeTab)?.label || "Dashboard"}</h2>
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
              <AdminDashboardTab auctions={auctions} allUsers={allUsers} editingSettings={editingSettings} setEditingSettings={setEditingSettings} savingSettings={savingSettings} handleSaveSettings={handleSaveSettings} setActiveTab={setActiveTab} pendingPayments={pendingPayments} openDisputes={openDisputes} unreadMessages={unreadMessages} />
            )}
            {activeTab === "review" && <AdminReviewTab auctions={auctions} fetchAllData={fetchAllData} />}
            {activeTab === "auctions" && <AdminAuctionsTab auctions={auctions} winnerProfiles={winnerProfiles} commissionPct={commissionPct} fetchAllData={fetchAllData} globalSearch={globalSearch} />}
            {activeTab === "payments" && <AdminPaymentsTab paymentProofs={paymentProofs} fetchAllData={fetchAllData} globalSearch={globalSearch} />}
            {activeTab === "won" && <AdminWonAuctionsTab auctions={auctions} winnerProfiles={winnerProfiles} dealerProfiles={dealerProfiles} paymentProofs={paymentProofs} globalSearch={globalSearch} />}
            {activeTab === "messages" && <AdminMessagesTab globalSearch={globalSearch} />}
            {activeTab === "emails" && <AdminEmailsTab globalSearch={globalSearch} />}
            {activeTab === "cms" && <AdminCMSTab siteSettings={siteSettings} siteSections={siteSections} banners={banners} editingSettings={editingSettings} setEditingSettings={setEditingSettings} savingSettings={savingSettings} setSavingSettings={setSavingSettings} handleSaveSettings={handleSaveSettings} fetchAllData={fetchAllData} />}
            {activeTab === "dealer_sales" && <AdminDealerSalesTab globalSearch={globalSearch} />}
            {activeTab === "dealers" && <AdminDealersTab dealerApps={dealerApps} fetchAllData={fetchAllData} />}
            {activeTab === "disputes" && <AdminDisputesTab adminDisputes={adminDisputes} fetchAllData={fetchAllData} />}
            {activeTab === "reports" && <AdminReportsTab auctionReports={auctionReports} fetchAllData={fetchAllData} />}
            {activeTab === "campaigns" && <AdminCampaignsTab />}
            {activeTab === "notifications" && <AdminNotificationsTab />}
            {activeTab === "mass_email" && <AdminMassEmailTab />}
            {activeTab === "users" && <UserManagementPanel allUsers={allUsers} onRefresh={fetchAllData} globalSearch={globalSearch} />}
            {activeTab === "team" && <TeamPanel />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Admin;
