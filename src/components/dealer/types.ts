export interface AuctionWithImages {
  id: string;
  title: string;
  description: string | null;
  starting_price: number;
  current_price: number;
  end_time: string;
  created_by: string;
  created_at: string;
  image_url: string | null;
  status: string;
  admin_notes: string | null;
  winner_id: string | null;
  winner_name: string | null;
  payment_status: string | null;
  delivery_status: string | null;
  tracking_number: string | null;
  images: { id: string; image_url: string; display_order: number }[];
  bids: { id: string; amount: number; bidder_name: string; created_at: string; user_id: string }[];
}

export interface WinnerProfile {
  full_name: string;
  phone: string | null;
}

export const statusConfig: Record<string, { label: string; color: string; icon: any }> = {};

// Re-export for convenience - actual icons assigned in components
