export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      auction_images: {
        Row: {
          auction_id: string
          created_at: string
          display_order: number
          id: string
          image_url: string
        }
        Insert: {
          auction_id: string
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
        }
        Update: {
          auction_id?: string
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_images_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_reports: {
        Row: {
          admin_notes: string | null
          auction_id: string
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          admin_notes?: string | null
          auction_id: string
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          admin_notes?: string | null
          auction_id?: string
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_reports_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      auctions: {
        Row: {
          admin_notes: string | null
          archived_at: string | null
          created_at: string
          created_by: string
          current_price: number
          dealer_ship_deadline: string | null
          delivered_at: string | null
          delivery_status: string
          description: string | null
          end_time: string
          funds_frozen: boolean
          funds_released_at: string | null
          id: string
          image_url: string | null
          is_extended: boolean
          operation_number: string | null
          paid_at: string | null
          payment_status: string
          requested_duration_hours: number | null
          start_time: string | null
          starting_price: number
          status: string
          title: string
          tracking_number: string | null
          tracking_photo_url: string | null
          winner_id: string | null
          winner_name: string | null
        }
        Insert: {
          admin_notes?: string | null
          archived_at?: string | null
          created_at?: string
          created_by: string
          current_price?: number
          dealer_ship_deadline?: string | null
          delivered_at?: string | null
          delivery_status?: string
          description?: string | null
          end_time: string
          funds_frozen?: boolean
          funds_released_at?: string | null
          id?: string
          image_url?: string | null
          is_extended?: boolean
          operation_number?: string | null
          paid_at?: string | null
          payment_status?: string
          requested_duration_hours?: number | null
          start_time?: string | null
          starting_price?: number
          status?: string
          title: string
          tracking_number?: string | null
          tracking_photo_url?: string | null
          winner_id?: string | null
          winner_name?: string | null
        }
        Update: {
          admin_notes?: string | null
          archived_at?: string | null
          created_at?: string
          created_by?: string
          current_price?: number
          dealer_ship_deadline?: string | null
          delivered_at?: string | null
          delivery_status?: string
          description?: string | null
          end_time?: string
          funds_frozen?: boolean
          funds_released_at?: string | null
          id?: string
          image_url?: string | null
          is_extended?: boolean
          operation_number?: string | null
          paid_at?: string | null
          payment_status?: string
          requested_duration_hours?: number | null
          start_time?: string | null
          starting_price?: number
          status?: string
          title?: string
          tracking_number?: string | null
          tracking_photo_url?: string | null
          winner_id?: string | null
          winner_name?: string | null
        }
        Relationships: []
      }
      auto_bids: {
        Row: {
          auction_id: string
          created_at: string
          id: string
          is_active: boolean
          max_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          auction_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          auction_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      banner_images: {
        Row: {
          created_at: string
          created_by: string
          display_order: number
          id: string
          image_url: string
          is_active: boolean
          subtitle: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          display_order?: number
          id?: string
          image_url: string
          is_active?: boolean
          subtitle?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          display_order?: number
          id?: string
          image_url?: string
          is_active?: boolean
          subtitle?: string | null
          title?: string | null
        }
        Relationships: []
      }
      bids: {
        Row: {
          amount: number
          auction_id: string
          bidder_name: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          auction_id: string
          bidder_name: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          auction_id?: string
          bidder_name?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      blacklisted_records: {
        Row: {
          banned_by: string | null
          cedula: string | null
          created_at: string
          email: string | null
          id: string
          phone: string | null
          reason: string
        }
        Insert: {
          banned_by?: string | null
          cedula?: string | null
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          reason?: string
        }
        Update: {
          banned_by?: string | null
          cedula?: string | null
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          reason?: string
        }
        Relationships: []
      }
      branding_config: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      campaign_dismissals: {
        Row: {
          campaign_id: string
          dismissed_at: string
          id: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          dismissed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          dismissed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_dismissals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          created_by: string
          ends_at: string | null
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ends_at?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          starts_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ends_at?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      dealer_bank_accounts: {
        Row: {
          account_number: string
          account_type: string
          admin_notes: string | null
          bank_name: string
          created_at: string
          email: string
          id: string
          identity_document: string
          is_verified: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number: string
          account_type: string
          admin_notes?: string | null
          bank_name: string
          created_at?: string
          email: string
          id?: string
          identity_document: string
          is_verified?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string
          account_type?: string
          admin_notes?: string | null
          bank_name?: string
          created_at?: string
          email?: string
          id?: string
          identity_document?: string
          is_verified?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dealer_payment_items: {
        Row: {
          amount: number
          created_at: string
          earning_id: string
          id: string
          payment_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          earning_id: string
          id?: string
          payment_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          earning_id?: string
          id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dealer_payment_items_earning_id_fkey"
            columns: ["earning_id"]
            isOneToOne: false
            referencedRelation: "platform_earnings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_payment_items_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "dealer_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_payments: {
        Row: {
          bank_name: string | null
          created_at: string
          created_by: string
          dealer_id: string
          id: string
          notes: string | null
          payment_method: string
          proof_url: string | null
          reference_number: string | null
          status: string
          total_amount: number
        }
        Insert: {
          bank_name?: string | null
          created_at?: string
          created_by: string
          dealer_id: string
          id?: string
          notes?: string | null
          payment_method?: string
          proof_url?: string | null
          reference_number?: string | null
          status?: string
          total_amount: number
        }
        Update: {
          bank_name?: string | null
          created_at?: string
          created_by?: string
          dealer_id?: string
          id?: string
          notes?: string | null
          payment_method?: string
          proof_url?: string | null
          reference_number?: string | null
          status?: string
          total_amount?: number
        }
        Relationships: []
      }
      dealer_verification: {
        Row: {
          account_status: string
          address_proof_url: string | null
          admin_notes: string | null
          birth_date: string | null
          business_description: string | null
          business_name: string
          cedula_back_url: string | null
          cedula_front_url: string | null
          cedula_number: string | null
          created_at: string
          dealer_balance: number
          full_name: string | null
          id: string
          instagram_url: string | null
          manual_tier: string | null
          phone: string
          public_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: string
          status_changed_at: string | null
          status_changed_by: string | null
          status_reason: string | null
          terms_accepted: boolean
          user_id: string
        }
        Insert: {
          account_status?: string
          address_proof_url?: string | null
          admin_notes?: string | null
          birth_date?: string | null
          business_description?: string | null
          business_name: string
          cedula_back_url?: string | null
          cedula_front_url?: string | null
          cedula_number?: string | null
          created_at?: string
          dealer_balance?: number
          full_name?: string | null
          id?: string
          instagram_url?: string | null
          manual_tier?: string | null
          phone: string
          public_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          status_reason?: string | null
          terms_accepted?: boolean
          user_id: string
        }
        Update: {
          account_status?: string
          address_proof_url?: string | null
          admin_notes?: string | null
          birth_date?: string | null
          business_description?: string | null
          business_name?: string
          cedula_back_url?: string | null
          cedula_front_url?: string | null
          cedula_number?: string | null
          created_at?: string
          dealer_balance?: number
          full_name?: string | null
          id?: string
          instagram_url?: string | null
          manual_tier?: string | null
          phone?: string
          public_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          status_reason?: string | null
          terms_accepted?: boolean
          user_id?: string
        }
        Relationships: []
      }
      dispute_messages: {
        Row: {
          content: string
          created_at: string
          dispute_id: string
          id: string
          is_system: boolean | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          dispute_id: string
          id?: string
          is_system?: boolean | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          dispute_id?: string
          id?: string
          is_system?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_messages_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          admin_requested: boolean | null
          admin_requested_at: string | null
          auction_id: string
          buyer_id: string
          category: string
          created_at: string
          dealer_deadline: string | null
          dealer_id: string
          description: string
          desired_resolution: string | null
          evidence_urls: string[] | null
          id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          signature_data: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_requested?: boolean | null
          admin_requested_at?: string | null
          auction_id: string
          buyer_id: string
          category: string
          created_at?: string
          dealer_deadline?: string | null
          dealer_id: string
          description: string
          desired_resolution?: string | null
          evidence_urls?: string[] | null
          id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          signature_data?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_requested?: boolean | null
          admin_requested_at?: string | null
          auction_id?: string
          buyer_id?: string
          category?: string
          created_at?: string
          dealer_deadline?: string | null
          dealer_id?: string
          description?: string
          desired_resolution?: string | null
          evidence_urls?: string[] | null
          id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          signature_data?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          auction_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          auction_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          auction_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          auction_id: string | null
          content: string
          created_at: string
          id: string
          is_read: boolean
          receiver_id: string
          sender_id: string
        }
        Insert: {
          auction_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          receiver_id: string
          sender_id: string
        }
        Update: {
          auction_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_proofs: {
        Row: {
          admin_notes: string | null
          amount_bs: number
          amount_usd: number
          auction_id: string
          bcv_rate: number
          buyer_id: string
          created_at: string
          id: string
          proof_url: string
          reference_number: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount_bs: number
          amount_usd: number
          auction_id: string
          bcv_rate: number
          buyer_id: string
          created_at?: string
          id?: string
          proof_url: string
          reference_number: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount_bs?: number
          amount_usd?: number
          auction_id?: string
          bcv_rate?: number
          buyer_id?: string
          created_at?: string
          id?: string
          proof_url?: string
          reference_number?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_proofs_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_earnings: {
        Row: {
          auction_id: string
          commission_amount: number
          commission_percentage: number
          created_at: string
          dealer_id: string
          dealer_net: number
          id: string
          is_paid: boolean
          paid_at: string | null
          paid_by: string | null
          sale_amount: number
        }
        Insert: {
          auction_id: string
          commission_amount: number
          commission_percentage: number
          created_at?: string
          dealer_id: string
          dealer_net: number
          id?: string
          is_paid?: boolean
          paid_at?: string | null
          paid_by?: string | null
          sale_amount: number
        }
        Update: {
          auction_id?: string
          commission_amount?: number
          commission_percentage?: number
          created_at?: string
          dealer_id?: string
          dealer_net?: number
          id?: string
          is_paid?: boolean
          paid_at?: string | null
          paid_by?: string | null
          sale_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "platform_earnings_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          manual_buyer_tier: string | null
          phone: string | null
          public_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          manual_buyer_tier?: string | null
          phone?: string | null
          public_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          manual_buyer_tier?: string | null
          phone?: string | null
          public_id?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string | null
          created_at: string
          endpoint: string | null
          fcm_token: string | null
          id: string
          p256dh: string | null
          platform: string
          user_id: string
        }
        Insert: {
          auth?: string | null
          created_at?: string
          endpoint?: string | null
          fcm_token?: string | null
          id?: string
          p256dh?: string | null
          platform?: string
          user_id: string
        }
        Update: {
          auth?: string | null
          created_at?: string
          endpoint?: string | null
          fcm_token?: string | null
          id?: string
          p256dh?: string | null
          platform?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          attention_quality: number | null
          auction_id: string
          comment: string | null
          communication_quality: number | null
          created_at: string
          id: string
          payment_compliance: number | null
          product_accuracy: number | null
          rating: number
          replied_at: string | null
          reply_text: string | null
          review_type: string
          reviewed_id: string
          reviewer_id: string
          shipping_speed: number | null
          tags: string[] | null
        }
        Insert: {
          attention_quality?: number | null
          auction_id: string
          comment?: string | null
          communication_quality?: number | null
          created_at?: string
          id?: string
          payment_compliance?: number | null
          product_accuracy?: number | null
          rating: number
          replied_at?: string | null
          reply_text?: string | null
          review_type: string
          reviewed_id: string
          reviewer_id: string
          shipping_speed?: number | null
          tags?: string[] | null
        }
        Update: {
          attention_quality?: number | null
          auction_id?: string
          comment?: string | null
          communication_quality?: number | null
          created_at?: string
          id?: string
          payment_compliance?: number | null
          product_accuracy?: number | null
          rating?: number
          replied_at?: string | null
          reply_text?: string | null
          review_type?: string
          reviewed_id?: string
          reviewer_id?: string
          shipping_speed?: number | null
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_audit_log: {
        Row: {
          auction_id: string
          change_type: string
          changed_by: string
          created_at: string
          field_name: string | null
          id: string
          new_value: string | null
          notes: string | null
          old_value: string | null
        }
        Insert: {
          auction_id: string
          change_type: string
          changed_by: string
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
        }
        Update: {
          auction_id?: string
          change_type?: string
          changed_by?: string
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_audit_log_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_info: {
        Row: {
          auction_id: string
          buyer_id: string
          cedula: string
          city: string
          created_at: string
          disclaimer_accepted: boolean
          full_name: string
          id: string
          office_name: string
          phone: string | null
          shipping_company: string
          state: string
          updated_at: string
        }
        Insert: {
          auction_id: string
          buyer_id: string
          cedula: string
          city: string
          created_at?: string
          disclaimer_accepted?: boolean
          full_name: string
          id?: string
          office_name: string
          phone?: string | null
          shipping_company: string
          state: string
          updated_at?: string
        }
        Update: {
          auction_id?: string
          buyer_id?: string
          cedula?: string
          city?: string
          created_at?: string
          disclaimer_accepted?: boolean
          full_name?: string
          id?: string
          office_name?: string
          phone?: string | null
          shipping_company?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_info_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      site_sections: {
        Row: {
          content: string | null
          created_at: string
          display_order: number
          id: string
          is_visible: boolean
          metadata: Json | null
          section_key: string
          section_type: string
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_visible?: boolean
          metadata?: Json | null
          section_key: string
          section_type?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_visible?: boolean
          metadata?: Json | null
          section_key?: string
          section_type?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          category: string
          id: string
          label: string
          setting_key: string
          setting_type: string
          setting_value: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string
          id?: string
          label: string
          setting_key: string
          setting_type?: string
          setting_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          id?: string
          label?: string
          setting_key?: string
          setting_type?: string
          setting_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          dealer_id: string
          id: string
          processed_at: string | null
          processed_by: string | null
          status: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          dealer_id: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          dealer_id?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_reputation_stats: {
        Args: { p_review_type: string; p_user_id: string }
        Returns: {
          avg_attention_quality: number
          avg_communication_quality: number
          avg_payment_compliance: number
          avg_product_accuracy: number
          avg_rating: number
          avg_shipping_speed: number
          positive_percentage: number
          total_reviews: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mask_bidder_name: { Args: { name: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "user" | "dealer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "dealer"],
    },
  },
} as const
