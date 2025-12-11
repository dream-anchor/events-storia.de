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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      catering_orders: {
        Row: {
          billing_city: string | null
          billing_country: string | null
          billing_name: string | null
          billing_street: string | null
          billing_zip: string | null
          calculated_distance_km: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          company_name: string | null
          created_at: string | null
          customer_email: string
          customer_name: string
          customer_phone: string
          delivery_address: string | null
          delivery_city: string | null
          delivery_cost: number | null
          delivery_floor: string | null
          delivery_street: string | null
          delivery_zip: string | null
          desired_date: string | null
          desired_time: string | null
          has_elevator: boolean | null
          id: string
          internal_notes: string | null
          is_pickup: boolean | null
          items: Json
          lexoffice_contact_id: string | null
          lexoffice_credit_note_id: string | null
          lexoffice_document_type: string | null
          lexoffice_invoice_id: string | null
          minimum_order_surcharge: number | null
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_status: string | null
          status: string | null
          stripe_payment_intent_id: string | null
          total_amount: number | null
          user_id: string | null
        }
        Insert: {
          billing_city?: string | null
          billing_country?: string | null
          billing_name?: string | null
          billing_street?: string | null
          billing_zip?: string | null
          calculated_distance_km?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          company_name?: string | null
          created_at?: string | null
          customer_email: string
          customer_name: string
          customer_phone: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_cost?: number | null
          delivery_floor?: string | null
          delivery_street?: string | null
          delivery_zip?: string | null
          desired_date?: string | null
          desired_time?: string | null
          has_elevator?: boolean | null
          id?: string
          internal_notes?: string | null
          is_pickup?: boolean | null
          items: Json
          lexoffice_contact_id?: string | null
          lexoffice_credit_note_id?: string | null
          lexoffice_document_type?: string | null
          lexoffice_invoice_id?: string | null
          minimum_order_surcharge?: number | null
          notes?: string | null
          order_number: string
          payment_method?: string | null
          payment_status?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          total_amount?: number | null
          user_id?: string | null
        }
        Update: {
          billing_city?: string | null
          billing_country?: string | null
          billing_name?: string | null
          billing_street?: string | null
          billing_zip?: string | null
          calculated_distance_km?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          company_name?: string | null
          created_at?: string | null
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_cost?: number | null
          delivery_floor?: string | null
          delivery_street?: string | null
          delivery_zip?: string | null
          desired_date?: string | null
          desired_time?: string | null
          has_elevator?: boolean | null
          id?: string
          internal_notes?: string | null
          is_pickup?: boolean | null
          items?: Json
          lexoffice_contact_id?: string | null
          lexoffice_credit_note_id?: string | null
          lexoffice_document_type?: string | null
          lexoffice_invoice_id?: string | null
          minimum_order_surcharge?: number | null
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          payment_status?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          total_amount?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          billing_city: string | null
          billing_country: string | null
          billing_name: string | null
          billing_street: string | null
          billing_zip: string | null
          company: string | null
          created_at: string | null
          delivery_city: string | null
          delivery_country: string | null
          delivery_floor: string | null
          delivery_street: string | null
          delivery_zip: string | null
          email: string | null
          has_elevator: boolean | null
          id: string
          name: string | null
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billing_city?: string | null
          billing_country?: string | null
          billing_name?: string | null
          billing_street?: string | null
          billing_zip?: string | null
          company?: string | null
          created_at?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_floor?: string | null
          delivery_street?: string | null
          delivery_zip?: string | null
          email?: string | null
          has_elevator?: boolean | null
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billing_city?: string | null
          billing_country?: string | null
          billing_name?: string | null
          billing_street?: string | null
          billing_zip?: string | null
          company?: string | null
          created_at?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_floor?: string | null
          delivery_street?: string | null
          delivery_zip?: string | null
          email?: string | null
          has_elevator?: boolean | null
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      menu_categories: {
        Row: {
          created_at: string | null
          description: string | null
          description_en: string | null
          id: string
          menu_id: string
          name: string
          name_en: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          id?: string
          menu_id: string
          name: string
          name_en?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          id?: string
          menu_id?: string
          name?: string
          name_en?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          allergens: string | null
          category_id: string
          created_at: string | null
          description: string | null
          description_en: string | null
          id: string
          image_url: string | null
          is_vegan: boolean | null
          is_vegetarian: boolean | null
          min_order: string | null
          min_order_en: string | null
          name: string
          name_en: string | null
          price: number | null
          price_display: string | null
          serving_info: string | null
          serving_info_en: string | null
          sort_order: number | null
        }
        Insert: {
          allergens?: string | null
          category_id: string
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          id?: string
          image_url?: string | null
          is_vegan?: boolean | null
          is_vegetarian?: boolean | null
          min_order?: string | null
          min_order_en?: string | null
          name: string
          name_en?: string | null
          price?: number | null
          price_display?: string | null
          serving_info?: string | null
          serving_info_en?: string | null
          sort_order?: number | null
        }
        Update: {
          allergens?: string | null
          category_id?: string
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          id?: string
          image_url?: string | null
          is_vegan?: boolean | null
          is_vegetarian?: boolean | null
          min_order?: string | null
          min_order_en?: string | null
          name?: string
          name_en?: string | null
          price?: number | null
          price_display?: string | null
          serving_info?: string | null
          serving_info_en?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          additional_info: string | null
          additional_info_en: string | null
          created_at: string | null
          id: string
          is_published: boolean | null
          menu_type: Database["public"]["Enums"]["menu_type"]
          pdf_url: string | null
          published_at: string | null
          slug: string | null
          sort_order: number | null
          subtitle: string | null
          subtitle_en: string | null
          title: string | null
          title_en: string | null
          updated_at: string | null
        }
        Insert: {
          additional_info?: string | null
          additional_info_en?: string | null
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          menu_type: Database["public"]["Enums"]["menu_type"]
          pdf_url?: string | null
          published_at?: string | null
          slug?: string | null
          sort_order?: number | null
          subtitle?: string | null
          subtitle_en?: string | null
          title?: string | null
          title_en?: string | null
          updated_at?: string | null
        }
        Update: {
          additional_info?: string | null
          additional_info_en?: string | null
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          menu_type?: Database["public"]["Enums"]["menu_type"]
          pdf_url?: string | null
          published_at?: string | null
          slug?: string | null
          sort_order?: number | null
          subtitle?: string | null
          subtitle_en?: string | null
          title?: string | null
          title_en?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      order_number_sequences: {
        Row: {
          created_at: string | null
          current_number: number
          id: string
          prefix: string
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          current_number?: number
          id?: string
          prefix: string
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          current_number?: number
          id?: string
          prefix?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_next_order_number: {
        Args: { p_prefix: string; p_year: number }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff"
      menu_type:
        | "lunch"
        | "food"
        | "drinks"
        | "christmas"
        | "valentines"
        | "special"
        | "catering"
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
      app_role: ["admin", "staff"],
      menu_type: [
        "lunch",
        "food",
        "drinks",
        "christmas",
        "valentines",
        "special",
        "catering",
      ],
    },
  },
} as const
