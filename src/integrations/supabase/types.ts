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
      app_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      bibliographies: {
        Row: {
          created_at: string
          entries: Json | null
          format: string
          generated_text: string | null
          id: string
          scan_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entries?: Json | null
          format?: string
          generated_text?: string | null
          id?: string
          scan_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entries?: Json | null
          format?: string
          generated_text?: string | null
          id?: string
          scan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bibliographies_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: true
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      citations: {
        Row: {
          author: string | null
          citation_text: string
          citation_type: string
          created_at: string
          id: string
          is_valid: boolean | null
          position_end: number | null
          position_start: number | null
          scan_id: string
          source: string | null
          title: string | null
          url: string | null
          year: string | null
        }
        Insert: {
          author?: string | null
          citation_text: string
          citation_type: string
          created_at?: string
          id?: string
          is_valid?: boolean | null
          position_end?: number | null
          position_start?: number | null
          scan_id: string
          source?: string | null
          title?: string | null
          url?: string | null
          year?: string | null
        }
        Update: {
          author?: string | null
          citation_text?: string
          citation_type?: string
          created_at?: string
          id?: string
          is_valid?: boolean | null
          position_end?: number | null
          position_start?: number | null
          scan_id?: string
          source?: string | null
          title?: string | null
          url?: string | null
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "citations_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      class_memberships: {
        Row: {
          class_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_memberships_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          teacher_id: string | null
          university_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          teacher_id?: string | null
          university_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          teacher_id?: string | null
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      document_comparisons: {
        Row: {
          completed_at: string | null
          created_at: string
          document_a_id: string
          document_b_id: string
          id: string
          matching_sections: Json | null
          similarity_score: number | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          document_a_id: string
          document_b_id: string
          id?: string
          matching_sections?: Json | null
          similarity_score?: number | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          document_a_id?: string
          document_b_id?: string
          id?: string
          matching_sections?: Json | null
          similarity_score?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_comparisons_document_a_id_fkey"
            columns: ["document_a_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_comparisons_document_b_id_fkey"
            columns: ["document_b_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          class_id: string | null
          content: string | null
          created_at: string
          file_path: string | null
          file_size: number | null
          file_type: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          class_id?: string | null
          content?: string | null
          created_at?: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          class_id?: string | null
          content?: string | null
          created_at?: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: string
          university_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          role?: string
          university_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: string
          university_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_reports: {
        Row: {
          created_at: string
          id: string
          report_data: Json
          scan_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          report_data?: Json
          scan_id: string
        }
        Update: {
          created_at?: string
          id?: string
          report_data?: Json
          scan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_reports_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: true
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scans: {
        Row: {
          ai_detection_score: number | null
          completed_at: string | null
          created_at: string
          document_id: string
          id: string
          processing_time_ms: number | null
          similarity_score: number | null
          status: string
          user_id: string
          word_count: number | null
        }
        Insert: {
          ai_detection_score?: number | null
          completed_at?: string | null
          created_at?: string
          document_id: string
          id?: string
          processing_time_ms?: number | null
          similarity_score?: number | null
          status?: string
          user_id: string
          word_count?: number | null
        }
        Update: {
          ai_detection_score?: number | null
          completed_at?: string | null
          created_at?: string
          document_id?: string
          id?: string
          processing_time_ms?: number | null
          similarity_score?: number | null
          status?: string
          user_id?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scans_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      similarity_matches: {
        Row: {
          created_at: string
          end_position: number | null
          id: string
          matched_text: string
          original_text: string
          scan_id: string
          similarity_percentage: number
          source_title: string | null
          source_url: string
          start_position: number | null
        }
        Insert: {
          created_at?: string
          end_position?: number | null
          id?: string
          matched_text: string
          original_text: string
          scan_id: string
          similarity_percentage: number
          source_title?: string | null
          source_url: string
          start_position?: number | null
        }
        Update: {
          created_at?: string
          end_position?: number | null
          id?: string
          matched_text?: string
          original_text?: string
          scan_id?: string
          similarity_percentage?: number
          source_title?: string | null
          source_url?: string
          start_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "similarity_matches_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_tiers: {
        Row: {
          created_at: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_scans_per_month: number | null
          max_words_per_scan: number | null
          name: string
          price_monthly: number
          price_yearly: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_scans_per_month?: number | null
          max_words_per_scan?: number | null
          name: string
          price_monthly?: number
          price_yearly?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_scans_per_month?: number | null
          max_words_per_scan?: number | null
          name?: string
          price_monthly?: number
          price_yearly?: number
        }
        Relationships: []
      }
      universities: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          logo_url: string | null
          name: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          id?: string
          logo_url?: string | null
          name: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          id?: string
          logo_url?: string | null
          name?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      user_subscriptions: {
        Row: {
          billing_period_end: string | null
          billing_period_start: string
          created_at: string
          id: string
          is_trial: boolean | null
          scans_used_this_month: number | null
          status: string
          stripe_subscription_id: string | null
          tier_id: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_period_end?: string | null
          billing_period_start?: string
          created_at?: string
          id?: string
          is_trial?: boolean | null
          scans_used_this_month?: number | null
          status?: string
          stripe_subscription_id?: string | null
          tier_id: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_period_end?: string | null
          billing_period_start?: string
          created_at?: string
          id?: string
          is_trial?: boolean | null
          scans_used_this_month?: number | null
          status?: string
          stripe_subscription_id?: string | null
          tier_id?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "subscription_tiers"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Enums: {
      app_role: "user" | "teacher" | "admin"
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
      app_role: ["user", "teacher", "admin"],
    },
  },
} as const
