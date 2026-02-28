import type { Tables } from "@/integrations/supabase/types";

export interface WinnerInfo {
  full_name: string;
  phone: string | null;
}

export interface BannerImage {
  id: string;
  image_url: string;
  title: string | null;
  subtitle: string | null;
  display_order: number;
  is_active: boolean;
}

export interface AuctionExtended extends Tables<"auctions"> {
  status: string;
  admin_notes: string | null;
  images: { id: string; image_url: string; display_order: number }[];
  dealer_name?: string;
  bids_count?: number;
}

export interface DealerUser {
  user_id: string;
  full_name: string;
  phone: string | null;
  role: string;
  roles: string[];
  created_at: string;
  email?: string;
  banned?: boolean;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  auction_id: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface SiteSetting {
  id: string;
  setting_key: string;
  setting_value: string | null;
  setting_type: string;
  category: string;
  label: string;
}

export interface SiteSection {
  id: string;
  section_key: string;
  title: string | null;
  content: string | null;
  is_visible: boolean;
  display_order: number;
  section_type: string;
}

export type AdminTab = "dashboard" | "review" | "auctions" | "won" | "payments" | "messages" | "cms" | "dealers" | "dealer_sales" | "disputes" | "reports" | "users" | "team" | "campaigns" | "notifications";
