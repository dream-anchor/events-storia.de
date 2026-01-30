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
      activity_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: []
      }
      admin_presence: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_editing: boolean | null
          last_seen: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_editing?: boolean | null
          last_seen?: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_editing?: boolean | null
          last_seen?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
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
          reference_number: string | null
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
          reference_number?: string | null
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
          reference_number?: string | null
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
      email_delivery_logs: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          error_message: string | null
          id: string
          metadata: Json | null
          provider: string
          provider_message_id: string | null
          recipient_email: string
          recipient_name: string | null
          sent_at: string
          sent_by: string | null
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          provider: string
          provider_message_id?: string | null
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
          subject: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          provider_message_id?: string | null
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          category: string
          content: string
          content_en: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          category?: string
          content: string
          content_en?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          category?: string
          content?: string
          content_en?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      event_bookings: {
        Row: {
          booking_number: string
          company_name: string | null
          created_at: string
          customer_email: string
          customer_name: string
          event_date: string
          event_time: string | null
          guest_count: number
          id: string
          internal_notes: string | null
          lexoffice_contact_id: string | null
          lexoffice_document_type: string | null
          lexoffice_invoice_id: string | null
          location_id: string | null
          menu_confirmed: boolean | null
          menu_selection: Json | null
          package_id: string | null
          payment_status: string | null
          phone: string | null
          source_inquiry_id: string | null
          source_option_id: string | null
          status: string | null
          stripe_payment_intent_id: string | null
          stripe_payment_link_id: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          booking_number: string
          company_name?: string | null
          created_at?: string
          customer_email: string
          customer_name: string
          event_date: string
          event_time?: string | null
          guest_count: number
          id?: string
          internal_notes?: string | null
          lexoffice_contact_id?: string | null
          lexoffice_document_type?: string | null
          lexoffice_invoice_id?: string | null
          location_id?: string | null
          menu_confirmed?: boolean | null
          menu_selection?: Json | null
          package_id?: string | null
          payment_status?: string | null
          phone?: string | null
          source_inquiry_id?: string | null
          source_option_id?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_link_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          booking_number?: string
          company_name?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          event_date?: string
          event_time?: string | null
          guest_count?: number
          id?: string
          internal_notes?: string | null
          lexoffice_contact_id?: string | null
          lexoffice_document_type?: string | null
          lexoffice_invoice_id?: string | null
          location_id?: string | null
          menu_confirmed?: boolean | null
          menu_selection?: Json | null
          package_id?: string | null
          payment_status?: string | null
          phone?: string | null
          source_inquiry_id?: string | null
          source_option_id?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_link_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_bookings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_bookings_source_inquiry_id_fkey"
            columns: ["source_inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_bookings_source_option_id_fkey"
            columns: ["source_option_id"]
            isOneToOne: false
            referencedRelation: "inquiry_offer_options"
            referencedColumns: ["id"]
          },
        ]
      }
      event_inquiries: {
        Row: {
          company_name: string | null
          contact_name: string
          converted_to_booking_id: string | null
          created_at: string
          current_offer_version: number | null
          delivery_city: string | null
          delivery_street: string | null
          delivery_time_slot: string | null
          delivery_zip: string | null
          email: string
          email_draft: string | null
          event_type: string | null
          guest_count: string | null
          id: string
          inquiry_type: Database["public"]["Enums"]["inquiry_type"] | null
          internal_notes: string | null
          last_edited_at: string | null
          last_edited_by: string | null
          lexoffice_quotation_id: string | null
          menu_selection: Json | null
          message: string | null
          notification_sent: boolean | null
          offer_sent_at: string | null
          offer_sent_by: string | null
          phone: string | null
          preferred_date: string | null
          quote_items: Json | null
          quote_notes: string | null
          room_selection: string | null
          selected_items: Json | null
          selected_option_id: string | null
          selected_packages: Json | null
          source: string | null
          status: string | null
          time_slot: string | null
          updated_at: string | null
        }
        Insert: {
          company_name?: string | null
          contact_name: string
          converted_to_booking_id?: string | null
          created_at?: string
          current_offer_version?: number | null
          delivery_city?: string | null
          delivery_street?: string | null
          delivery_time_slot?: string | null
          delivery_zip?: string | null
          email: string
          email_draft?: string | null
          event_type?: string | null
          guest_count?: string | null
          id?: string
          inquiry_type?: Database["public"]["Enums"]["inquiry_type"] | null
          internal_notes?: string | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          lexoffice_quotation_id?: string | null
          menu_selection?: Json | null
          message?: string | null
          notification_sent?: boolean | null
          offer_sent_at?: string | null
          offer_sent_by?: string | null
          phone?: string | null
          preferred_date?: string | null
          quote_items?: Json | null
          quote_notes?: string | null
          room_selection?: string | null
          selected_items?: Json | null
          selected_option_id?: string | null
          selected_packages?: Json | null
          source?: string | null
          status?: string | null
          time_slot?: string | null
          updated_at?: string | null
        }
        Update: {
          company_name?: string | null
          contact_name?: string
          converted_to_booking_id?: string | null
          created_at?: string
          current_offer_version?: number | null
          delivery_city?: string | null
          delivery_street?: string | null
          delivery_time_slot?: string | null
          delivery_zip?: string | null
          email?: string
          email_draft?: string | null
          event_type?: string | null
          guest_count?: string | null
          id?: string
          inquiry_type?: Database["public"]["Enums"]["inquiry_type"] | null
          internal_notes?: string | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          lexoffice_quotation_id?: string | null
          menu_selection?: Json | null
          message?: string | null
          notification_sent?: boolean | null
          offer_sent_at?: string | null
          offer_sent_by?: string | null
          phone?: string | null
          preferred_date?: string | null
          quote_items?: Json | null
          quote_notes?: string | null
          room_selection?: string | null
          selected_items?: Json | null
          selected_option_id?: string | null
          selected_packages?: Json | null
          source?: string | null
          status?: string | null
          time_slot?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_inquiries_converted_to_booking_id_fkey"
            columns: ["converted_to_booking_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_offer_history: {
        Row: {
          created_at: string
          email_content: string | null
          id: string
          inquiry_id: string
          options_snapshot: Json
          pdf_url: string | null
          sent_at: string
          sent_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          email_content?: string | null
          id?: string
          inquiry_id: string
          options_snapshot: Json
          pdf_url?: string | null
          sent_at?: string
          sent_by?: string | null
          version: number
        }
        Update: {
          created_at?: string
          email_content?: string | null
          id?: string
          inquiry_id?: string
          options_snapshot?: Json
          pdf_url?: string | null
          sent_at?: string
          sent_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_offer_history_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_offer_options: {
        Row: {
          created_at: string
          guest_count: number
          id: string
          inquiry_id: string
          is_active: boolean | null
          menu_selection: Json | null
          offer_version: number
          option_label: string
          package_id: string | null
          sort_order: number | null
          stripe_payment_link_id: string | null
          stripe_payment_link_url: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          guest_count: number
          id?: string
          inquiry_id: string
          is_active?: boolean | null
          menu_selection?: Json | null
          offer_version?: number
          option_label?: string
          package_id?: string | null
          sort_order?: number | null
          stripe_payment_link_id?: string | null
          stripe_payment_link_url?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          guest_count?: number
          id?: string
          inquiry_id?: string
          is_active?: boolean | null
          menu_selection?: Json | null
          offer_version?: number
          option_label?: string
          package_id?: string | null
          sort_order?: number | null
          stripe_payment_link_id?: string | null
          stripe_payment_link_url?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_offer_options_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_offer_options_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          capacity_seated: number | null
          capacity_standing: number | null
          created_at: string | null
          description: string | null
          description_en: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          name: string
          name_en: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          capacity_seated?: number | null
          capacity_standing?: number | null
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          name_en?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          capacity_seated?: number | null
          capacity_standing?: number | null
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_en?: string | null
          sort_order?: number | null
          updated_at?: string | null
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
      package_course_config: {
        Row: {
          allowed_categories: string[] | null
          allowed_sources: string[] | null
          course_label: string
          course_label_en: string | null
          course_type: string
          created_at: string | null
          custom_item_description: string | null
          custom_item_name: string | null
          custom_item_name_en: string | null
          id: string
          is_custom_item: boolean | null
          is_required: boolean | null
          package_id: string
          sort_order: number | null
        }
        Insert: {
          allowed_categories?: string[] | null
          allowed_sources?: string[] | null
          course_label: string
          course_label_en?: string | null
          course_type: string
          created_at?: string | null
          custom_item_description?: string | null
          custom_item_name?: string | null
          custom_item_name_en?: string | null
          id?: string
          is_custom_item?: boolean | null
          is_required?: boolean | null
          package_id: string
          sort_order?: number | null
        }
        Update: {
          allowed_categories?: string[] | null
          allowed_sources?: string[] | null
          course_label?: string
          course_label_en?: string | null
          course_type?: string
          created_at?: string | null
          custom_item_description?: string | null
          custom_item_name?: string | null
          custom_item_name_en?: string | null
          id?: string
          is_custom_item?: boolean | null
          is_required?: boolean | null
          package_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "package_course_config_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      package_drink_config: {
        Row: {
          created_at: string | null
          drink_group: string
          drink_label: string
          drink_label_en: string | null
          id: string
          is_choice: boolean | null
          is_included: boolean | null
          options: Json | null
          package_id: string
          quantity_label: string | null
          quantity_label_en: string | null
          quantity_per_person: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          drink_group: string
          drink_label: string
          drink_label_en?: string | null
          id?: string
          is_choice?: boolean | null
          is_included?: boolean | null
          options?: Json | null
          package_id: string
          quantity_label?: string | null
          quantity_label_en?: string | null
          quantity_per_person?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          drink_group?: string
          drink_label?: string
          drink_label_en?: string | null
          id?: string
          is_choice?: boolean | null
          is_included?: boolean | null
          options?: Json | null
          package_id?: string
          quantity_label?: string | null
          quantity_label_en?: string | null
          quantity_per_person?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "package_drink_config_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      package_locations: {
        Row: {
          created_at: string | null
          id: string
          location_id: string
          package_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          location_id: string
          package_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          location_id?: string
          package_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_locations_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      package_menu_items: {
        Row: {
          created_at: string | null
          id: string
          is_included: boolean | null
          item_id: string
          item_name: string
          item_price: number | null
          item_source: string
          package_id: string
          quantity: number
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_included?: boolean | null
          item_id: string
          item_name: string
          item_price?: number | null
          item_source: string
          package_id: string
          quantity?: number
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_included?: boolean | null
          item_id?: string
          item_name?: string
          item_price?: number | null
          item_source?: string
          package_id?: string
          quantity?: number
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_menu_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string | null
          description: string | null
          description_en: string | null
          id: string
          includes: Json | null
          is_active: boolean | null
          max_guests: number | null
          min_guests: number | null
          name: string
          name_en: string | null
          package_type: string
          prepayment_percentage: number | null
          price: number
          price_per_person: boolean | null
          requires_prepayment: boolean | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          id?: string
          includes?: Json | null
          is_active?: boolean | null
          max_guests?: number | null
          min_guests?: number | null
          name: string
          name_en?: string | null
          package_type?: string
          prepayment_percentage?: number | null
          price?: number
          price_per_person?: boolean | null
          requires_prepayment?: boolean | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          id?: string
          includes?: Json | null
          is_active?: boolean | null
          max_guests?: number | null
          min_guests?: number | null
          name?: string
          name_en?: string | null
          package_type?: string
          prepayment_percentage?: number | null
          price?: number
          price_per_person?: boolean | null
          requires_prepayment?: boolean | null
          sort_order?: number | null
          updated_at?: string | null
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
      generate_booking_number: { Args: never; Returns: string }
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
      inquiry_type: "event" | "catering"
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
      inquiry_type: ["event", "catering"],
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
