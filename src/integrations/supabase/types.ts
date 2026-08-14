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
    PostgrestVersion: "14.15"
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
          user_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          id?: string
          invoice_id: string
          name: string
          price?: number
          user_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          invoice_id?: string
          name?: string
          price?: number
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
          down_payment: number
          first_due_date: string
          id: string
          monthly_installment: number
          notes: string | null
          paid: number
          total: number
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          down_payment?: number
          first_due_date: string
          id?: string
          monthly_installment: number
          notes?: string | null
          paid?: number
          total: number
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          down_payment?: number
          first_due_date?: string
          id?: string
          monthly_installment?: number
          notes?: string | null
          paid?: number
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
    }
    Enums: {
      app_role: "owner" | "manager" | "seller"
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
    },
  },
} as const
