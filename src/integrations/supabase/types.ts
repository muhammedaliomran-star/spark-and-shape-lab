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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          address: string | null
          created_at: string
          credit_limit: number
          customer_type: string
          due_day: number
          frozen: boolean
          id: string
          joining_date: string
          name: string
          notes: string | null
          opening_balance: number
          phone: string
          rating: number
          status: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          credit_limit?: number
          customer_type?: string
          due_day?: number
          frozen?: boolean
          id?: string
          joining_date?: string
          name: string
          notes?: string | null
          opening_balance?: number
          phone: string
          rating?: number
          status?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          credit_limit?: number
          customer_type?: string
          due_day?: number
          frozen?: boolean
          id?: string
          joining_date?: string
          name?: string
          notes?: string | null
          opening_balance?: number
          phone?: string
          rating?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          expense_date: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          expense_date?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          expense_date?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          cost: number
          created_at: string
          id: string
          invoice_id: string
          name: string
          price: number
          quantity: number
          user_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          id?: string
          invoice_id: string
          name: string
          price?: number
          quantity?: number
          user_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          invoice_id?: string
          name?: string
          price?: number
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          customer_id: string
          discount_amount: number
          discount_pct: number
          down_payment: number
          first_due_date: string
          id: string
          monthly_installment: number
          notes: string | null
          paid: number
          status: string
          tax_amount: number
          tax_pct: number
          total: number
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          discount_amount?: number
          discount_pct?: number
          down_payment?: number
          first_due_date: string
          id?: string
          monthly_installment: number
          notes?: string | null
          paid?: number
          status?: string
          tax_amount?: number
          tax_pct?: number
          total: number
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          discount_amount?: number
          discount_pct?: number
          down_payment?: number
          first_due_date?: string
          id?: string
          monthly_installment?: number
          notes?: string | null
          paid?: number
          status?: string
          tax_amount?: number
          tax_pct?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          id: string
          invoice_id: string
          paid_at: string
          user_id: string
        }
        Insert: {
          amount: number
          id?: string
          invoice_id: string
          paid_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          id?: string
          invoice_id?: string
          paid_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          phone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id: string
          phone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          name: string
          purchase_id: string
          quantity: number
          unit_cost: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          purchase_id: string
          quantity?: number
          unit_cost?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          purchase_id?: string
          quantity?: number
          unit_cost?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          payment_type: string
          purchase_date: string
          supplier_id: string
          total: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          payment_type?: string
          purchase_date?: string
          supplier_id: string
          total?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          payment_type?: string
          purchase_date?: string
          supplier_id?: string
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          created_at: string
          id: string
          name: string
          quantity: number
          return_id: string
          unit_price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          quantity?: number
          return_id: string
          unit_price?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          quantity?: number
          return_id?: string
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "return_records"
            referencedColumns: ["id"]
          },
        ]
      }
      return_records: {
        Row: {
          created_at: string
          id: string
          invoice_id: string | null
          notes: string | null
          reason: string | null
          total_amount: number
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          reason?: string | null
          total_amount?: number
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          reason?: string | null
          total_amount?: number
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_records_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          actual_delivery_date: string | null
          carrier_id: string | null
          cod_amount: number
          collected_at: string | null
          collection_status: string
          created_at: string | null
          delivery_address: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          recipient_name: string | null
          recipient_phone: string | null
          settled_at: string | null
          shipping_cost: number
          status: Database["public"]["Enums"]["shipment_status"] | null
          tracking_number: string | null
          user_id: string | null
          zone_id: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          carrier_id?: string | null
          cod_amount?: number
          collected_at?: string | null
          collection_status?: string
          created_at?: string | null
          delivery_address?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          settled_at?: string | null
          shipping_cost?: number
          status?: Database["public"]["Enums"]["shipment_status"] | null
          tracking_number?: string | null
          user_id?: string | null
          zone_id?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          carrier_id?: string | null
          cod_amount?: number
          collected_at?: string | null
          collection_status?: string
          created_at?: string | null
          delivery_address?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          settled_at?: string | null
          shipping_cost?: number
          status?: Database["public"]["Enums"]["shipment_status"] | null
          tracking_number?: string | null
          user_id?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "shipping_carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_carriers: {
        Row: {
          active: boolean | null
          base_cost: number | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          base_cost?: number | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          base_cost?: number | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      shipping_zones: {
        Row: {
          carrier_id: string | null
          created_at: string | null
          delivery_cost: number | null
          estimated_days: number | null
          id: string
          name: string
          user_id: string | null
        }
        Insert: {
          carrier_id?: string | null
          created_at?: string | null
          delivery_cost?: number | null
          estimated_days?: number | null
          id?: string
          name: string
          user_id?: string | null
        }
        Update: {
          carrier_id?: string | null
          created_at?: string | null
          delivery_cost?: number | null
          estimated_days?: number | null
          id?: string
          name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_zones_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "shipping_carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_settings: {
        Row: {
          address: string
          alerts_enabled: boolean
          created_at: string
          currency: string
          default_due_day: number
          default_installment_months: number
          footer_note: string
          id: string
          invoice_prefix: string
          logo_url: string | null
          low_stock_threshold: number
          phone: string
          print_paper: string
          reminder_days_before: number
          shop_name: string
          tax_number: string
          theme: string
          updated_at: string
          user_id: string
          whatsapp: string
        }
        Insert: {
          address?: string
          alerts_enabled?: boolean
          created_at?: string
          currency?: string
          default_due_day?: number
          default_installment_months?: number
          footer_note?: string
          id?: string
          invoice_prefix?: string
          logo_url?: string | null
          low_stock_threshold?: number
          phone?: string
          print_paper?: string
          reminder_days_before?: number
          shop_name?: string
          tax_number?: string
          theme?: string
          updated_at?: string
          user_id: string
          whatsapp?: string
        }
        Update: {
          address?: string
          alerts_enabled?: boolean
          created_at?: string
          currency?: string
          default_due_day?: number
          default_installment_months?: number
          footer_note?: string
          id?: string
          invoice_prefix?: string
          logo_url?: string | null
          low_stock_threshold?: number
          phone?: string
          print_paper?: string
          reminder_days_before?: number
          shop_name?: string
          tax_number?: string
          theme?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string
        }
        Relationships: []
      }
      stock_adjustments: {
        Row: {
          created_at: string
          delta: number
          id: string
          notes: string | null
          reason: string
          stock_item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          notes?: string | null
          reason: string
          stock_item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          notes?: string | null
          reason?: string
          stock_item_id?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          barcode: string | null
          created_at: string
          id: string
          item_type: string | null
          last_unit_cost: number
          min_stock: number
          name: string
          quantity: number
          sale_price: number
          size: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          id?: string
          item_type?: string | null
          last_unit_cost?: number
          min_stock?: number
          name: string
          quantity?: number
          sale_price?: number
          size?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          barcode?: string | null
          created_at?: string
          id?: string
          item_type?: string | null
          last_unit_cost?: number
          min_stock?: number
          name?: string
          quantity?: number
          sale_price?: number
          size?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_reservations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          order_id: string
          quantity: number
          released_at: string | null
          status: Database["public"]["Enums"]["stock_reservation_status"]
          stock_item_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          order_id: string
          quantity: number
          released_at?: string | null
          status?: Database["public"]["Enums"]["stock_reservation_status"]
          stock_item_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          order_id?: string
          quantity?: number
          released_at?: string | null
          status?: Database["public"]["Enums"]["stock_reservation_status"]
          stock_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      store_order_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          order_id: string
          payload: Json
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          order_id: string
          payload?: Json
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          order_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "store_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      store_order_items: {
        Row: {
          id: string
          line_total: number
          order_id: string
          product_snapshot: Json
          product_title: string
          quantity: number
          stock_item_id: string | null
          storefront_product_id: string | null
          unit_price: number
        }
        Insert: {
          id?: string
          line_total: number
          order_id: string
          product_snapshot?: Json
          product_title: string
          quantity: number
          stock_item_id?: string | null
          storefront_product_id?: string | null
          unit_price: number
        }
        Update: {
          id?: string
          line_total?: number
          order_id?: string
          product_snapshot?: Json
          product_title?: string
          quantity?: number
          stock_item_id?: string | null
          storefront_product_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_order_items_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_order_items_storefront_product_id_fkey"
            columns: ["storefront_product_id"]
            isOneToOne: false
            referencedRelation: "storefront_products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_orders: {
        Row: {
          cancelled_at: string | null
          coupon_id: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_address: string
          delivery_area: string | null
          discount_amount: number
          expires_at: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          order_type: Database["public"]["Enums"]["store_order_type"]
          public_number: string
          reservation_expires_at: string | null
          shipping_fee: number
          status: Database["public"]["Enums"]["store_order_status"]
          status_reason: string | null
          storefront_id: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_name: string
          customer_phone: string
          delivery_address: string
          delivery_area?: string | null
          discount_amount?: number
          expires_at?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_type: Database["public"]["Enums"]["store_order_type"]
          public_number?: string
          reservation_expires_at?: string | null
          shipping_fee?: number
          status?: Database["public"]["Enums"]["store_order_status"]
          status_reason?: string | null
          storefront_id: string
          subtotal: number
          total: number
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          delivery_address?: string
          delivery_area?: string | null
          discount_amount?: number
          expires_at?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_type?: Database["public"]["Enums"]["store_order_type"]
          public_number?: string
          reservation_expires_at?: string | null
          shipping_fee?: number
          status?: Database["public"]["Enums"]["store_order_status"]
          status_reason?: string | null
          storefront_id?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "storefront_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_orders_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_analytics_events: {
        Row: {
          event_name: string
          id: string
          occurred_at: string
          product_id: string | null
          source: string | null
          storefront_id: string
        }
        Insert: {
          event_name: string
          id?: string
          occurred_at?: string
          product_id?: string | null
          source?: string | null
          storefront_id: string
        }
        Update: {
          event_name?: string
          id?: string
          occurred_at?: string
          product_id?: string | null
          source?: string | null
          storefront_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_analytics_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "storefront_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_analytics_events_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_categories: {
        Row: {
          id: string
          name: string
          slug: string
          sort_order: number
          storefront_id: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          sort_order?: number
          storefront_id: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          storefront_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_categories_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          max_uses: number | null
          minimum_order: number
          starts_at: string
          storefront_id: string
          used_count: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          ends_at?: string | null
          id?: string
          max_uses?: number | null
          minimum_order?: number
          starts_at?: string
          storefront_id: string
          used_count?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          max_uses?: number | null
          minimum_order?: number
          starts_at?: string
          storefront_id?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "storefront_coupons_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          status: string
          storefront_id: string
          updated_at: string
          verification_token: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          status?: string
          storefront_id: string
          updated_at?: string
          verification_token?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          status?: string
          storefront_id?: string
          updated_at?: string
          verification_token?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storefront_domains_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_feature_flags: {
        Row: {
          enabled: boolean
          flag: string
          storefront_id: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          flag: string
          storefront_id: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          flag?: string
          storefront_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_feature_flags_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_notifications: {
        Row: {
          body: string
          created_at: string
          event_id: string | null
          id: string
          order_id: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          event_id?: string | null
          id?: string
          order_id?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string | null
          id?: string
          order_id?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "store_order_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          display_price: number
          down_payment_from: number | null
          id: string
          images: Json
          is_published: boolean
          monthly_payment_from: number | null
          show_installments: boolean
          slug: string
          sort_order: number
          stock_item_id: string
          storefront_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          display_price: number
          down_payment_from?: number | null
          id?: string
          images?: Json
          is_published?: boolean
          monthly_payment_from?: number | null
          show_installments?: boolean
          slug: string
          sort_order?: number
          stock_item_id: string
          storefront_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          display_price?: number
          down_payment_from?: number | null
          id?: string
          images?: Json
          is_published?: boolean
          monthly_payment_from?: number | null
          show_installments?: boolean
          slug?: string
          sort_order?: number
          stock_item_id?: string
          storefront_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "storefront_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_products_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_products_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      storefronts: {
        Row: {
          branch_id: string | null
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          shipping_policy: string | null
          slug: string
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          logo_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          shipping_policy?: string | null
          slug: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          shipping_policy?: string | null
          slug?: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      supplier_payments: {
        Row: {
          amount: number
          id: string
          paid_at: string
          supplier_id: string
          user_id: string
        }
        Insert: {
          amount: number
          id?: string
          paid_at?: string
          supplier_id: string
          user_id: string
        }
        Update: {
          amount?: number
          id?: string
          paid_at?: string
          supplier_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact: string
          created_at: string
          id: string
          name: string
          notes: string | null
          opening_balance: number
          user_id: string
        }
        Insert: {
          contact?: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          opening_balance?: number
          user_id: string
        }
        Update: {
          contact?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          opening_balance?: number
          user_id?: string
        }
        Relationships: []
      }
      team_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      warehouse_items: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          notes: string | null
          quantity: number
          sale_price: number
          season: string
          unit_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          quantity?: number
          sale_price?: number
          season?: string
          unit_cost?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          quantity?: number
          sale_price?: number
          season?: string
          unit_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_store_order: {
        Args: { p_order_id: string }
        Returns: {
          cancelled_at: string | null
          coupon_id: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_address: string
          delivery_area: string | null
          discount_amount: number
          expires_at: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          order_type: Database["public"]["Enums"]["store_order_type"]
          public_number: string
          reservation_expires_at: string | null
          shipping_fee: number
          status: Database["public"]["Enums"]["store_order_status"]
          status_reason: string | null
          storefront_id: string
          subtotal: number
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "store_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_store_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: {
          cancelled_at: string | null
          coupon_id: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_address: string
          delivery_area: string | null
          discount_amount: number
          expires_at: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          order_type: Database["public"]["Enums"]["store_order_type"]
          public_number: string
          reservation_expires_at: string | null
          shipping_fee: number
          status: Database["public"]["Enums"]["store_order_status"]
          status_reason: string | null
          storefront_id: string
          subtotal: number
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "store_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_storefront_reservations: { Args: never; Returns: number }
      get_public_order_status: {
        Args: { p_customer_phone: string; p_public_number: string }
        Returns: Json
      }
      get_public_storefront: { Args: { p_slug: string }; Returns: Json }
      get_storefront_analytics_summary: {
        Args: { p_from?: string; p_storefront_id: string }
        Returns: Json
      }
      get_storefront_feature_flag: {
        Args: { p_flag: string; p_storefront_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invoice_store_order: { Args: { p_order_id: string }; Returns: Json }
      record_storefront_event: {
        Args: {
          p_event_name: string
          p_product_id?: string
          p_source?: string
          p_storefront_id: string
        }
        Returns: undefined
      }
      redeem_storefront_coupon: {
        Args: { p_coupon_id: string; p_order_id: string }
        Returns: number
      }
      settle_carrier_collections: {
        Args: { p_carrier_id: string }
        Returns: number
      }
      submit_store_order: {
        Args: {
          p_customer_name: string
          p_customer_phone: string
          p_delivery_address: string
          p_delivery_area: string
          p_items: Json
          p_notes: string
          p_order_type: Database["public"]["Enums"]["store_order_type"]
          p_shipping_zone_id?: string
          p_storefront_id: string
        }
        Returns: Json
      }
      team_directory: {
        Args: never
        Returns: {
          avatar_url: string
          display_name: string
          last_seen_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      update_store_order_status: {
        Args: {
          p_order_id: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["store_order_status"]
        }
        Returns: {
          cancelled_at: string | null
          coupon_id: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_address: string
          delivery_area: string | null
          discount_amount: number
          expires_at: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          order_type: Database["public"]["Enums"]["store_order_type"]
          public_number: string
          reservation_expires_at: string | null
          shipping_fee: number
          status: Database["public"]["Enums"]["store_order_status"]
          status_reason: string | null
          storefront_id: string
          subtotal: number
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "store_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_storefront_shipment_status: {
        Args: {
          p_reason?: string
          p_shipment_id: string
          p_status: Database["public"]["Enums"]["shipment_status"]
        }
        Returns: undefined
      }
      validate_storefront_coupon: {
        Args: { p_code: string; p_storefront_id: string; p_subtotal: number }
        Returns: Json
      }
    }
    Enums: {
      app_role: "owner" | "manager" | "seller"
      shipment_status:
        | "pending"
        | "processing"
        | "shipped"
        | "delivered"
        | "returned"
        | "cancelled"
      stock_reservation_status: "active" | "released" | "consumed" | "expired"
      store_order_status:
        | "submitted"
        | "under_review"
        | "needs_info"
        | "accepted"
        | "invoiced"
        | "shipped"
        | "delivered"
        | "rejected"
        | "cancelled"
        | "expired"
      store_order_type: "cash_on_delivery" | "installment_request"
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
      app_role: ["owner", "manager", "seller"],
      shipment_status: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "returned",
        "cancelled",
      ],
      stock_reservation_status: ["active", "released", "consumed", "expired"],
      store_order_status: [
        "submitted",
        "under_review",
        "needs_info",
        "accepted",
        "invoiced",
        "shipped",
        "delivered",
        "rejected",
        "cancelled",
        "expired",
      ],
      store_order_type: ["cash_on_delivery", "installment_request"],
    },
  },
} as const
