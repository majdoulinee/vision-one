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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          meta: Json
          org_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          meta?: Json
          org_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          meta?: Json
          org_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          created_at: string
          data: Json
          id: string
          org_id: string
          overrides: Json
          project_id: string
          ref_version: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          org_id: string
          overrides?: Json
          project_id: string
          ref_version: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          org_id?: string
          overrides?: Json
          project_id?: string
          ref_version?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_ref_version_fkey"
            columns: ["ref_version"]
            isOneToOne: false
            referencedRelation: "ref_versions"
            referencedColumns: ["version"]
          },
        ]
      }
      business_plans: {
        Row: {
          created_at: string
          hypotheses: Json
          id: string
          org_id: string
          project_id: string
          ref_version: string
          scenarios: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          hypotheses?: Json
          id?: string
          org_id: string
          project_id: string
          ref_version: string
          scenarios?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          hypotheses?: Json
          id?: string
          org_id?: string
          project_id?: string
          ref_version?: string
          scenarios?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_plans_ref_version_fkey"
            columns: ["ref_version"]
            isOneToOne: false
            referencedRelation: "ref_versions"
            referencedColumns: ["version"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          created_by: string
          id: string
          org_id: string
          overrides: Json
          provenance: Json
          ref_version: string | null
          resume: Json
          sha256: string | null
          source_id: string | null
          storage_path: string | null
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          org_id: string
          overrides?: Json
          provenance?: Json
          ref_version?: string | null
          resume?: Json
          sha256?: string | null
          source_id?: string | null
          storage_path?: string | null
          type: Database["public"]["Enums"]["document_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          org_id?: string
          overrides?: Json
          provenance?: Json
          ref_version?: string | null
          resume?: Json
          sha256?: string | null
          source_id?: string | null
          storage_path?: string | null
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_ref_version_fkey"
            columns: ["ref_version"]
            isOneToOne: false
            referencedRelation: "ref_versions"
            referencedColumns: ["version"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          type: Database["public"]["Enums"]["org_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          type: Database["public"]["Enums"]["org_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["org_type"]
          updated_at?: string
        }
        Relationships: []
      }
      profil_zone_mappings: {
        Row: {
          created_at: string
          profile_code: string
          quality: Database["public"]["Enums"]["mapping_quality"]
          ref_version: string
          zone_code: string
        }
        Insert: {
          created_at?: string
          profile_code: string
          quality: Database["public"]["Enums"]["mapping_quality"]
          ref_version: string
          zone_code: string
        }
        Update: {
          created_at?: string
          profile_code?: string
          quality?: Database["public"]["Enums"]["mapping_quality"]
          ref_version?: string
          zone_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "profil_zone_mappings_profile_code_fkey"
            columns: ["profile_code"]
            isOneToOne: false
            referencedRelation: "profils_production"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "profil_zone_mappings_ref_version_fkey"
            columns: ["ref_version"]
            isOneToOne: false
            referencedRelation: "ref_versions"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "profil_zone_mappings_zone_code_fkey"
            columns: ["zone_code"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["code"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          locale: Database["public"]["Enums"]["locale_code"]
          platform_role: Database["public"]["Enums"]["platform_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          locale?: Database["public"]["Enums"]["locale_code"]
          platform_role?: Database["public"]["Enums"]["platform_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: Database["public"]["Enums"]["locale_code"]
          platform_role?: Database["public"]["Enums"]["platform_role"]
          updated_at?: string
        }
        Relationships: []
      }
      profils_production: {
        Row: {
          category: string | null
          code: string
          created_at: string
          data: Json
          name: string
          ref_version: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string
          data?: Json
          name: string
          ref_version: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string
          data?: Json
          name?: string
          ref_version?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profils_production_ref_version_fkey"
            columns: ["ref_version"]
            isOneToOne: false
            referencedRelation: "ref_versions"
            referencedColumns: ["version"]
          },
        ]
      }
      projects: {
        Row: {
          capital: number | null
          created_at: string
          created_by: string
          data: Json
          id: string
          mode: Database["public"]["Enums"]["project_mode"]
          name: string
          org_id: string
          profile_code: string | null
          status: string
          surface_ha: number | null
          updated_at: string
          zone_code: string | null
        }
        Insert: {
          capital?: number | null
          created_at?: string
          created_by: string
          data?: Json
          id?: string
          mode: Database["public"]["Enums"]["project_mode"]
          name: string
          org_id: string
          profile_code?: string | null
          status?: string
          surface_ha?: number | null
          updated_at?: string
          zone_code?: string | null
        }
        Update: {
          capital?: number | null
          created_at?: string
          created_by?: string
          data?: Json
          id?: string
          mode?: Database["public"]["Enums"]["project_mode"]
          name?: string
          org_id?: string
          profile_code?: string | null
          status?: string
          surface_ha?: number | null
          updated_at?: string
          zone_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_profile_code_fkey"
            columns: ["profile_code"]
            isOneToOne: false
            referencedRelation: "profils_production"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "projects_zone_code_fkey"
            columns: ["zone_code"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["code"]
          },
        ]
      }
      ref_versions: {
        Row: {
          created_by: string | null
          notes: string | null
          published_at: string
          version: string
        }
        Insert: {
          created_by?: string | null
          notes?: string | null
          published_at?: string
          version: string
        }
        Update: {
          created_by?: string | null
          notes?: string | null
          published_at?: string
          version?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          created_at: string
          credits: number
          org_id: string
          plan: Database["public"]["Enums"]["wallet_plan"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits?: number
          org_id: string
          plan?: Database["public"]["Enums"]["wallet_plan"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          org_id?: string
          plan?: Database["public"]["Enums"]["wallet_plan"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          code: string
          created_at: string
          data: Json
          name: string
          ref_version: string
          region: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          data?: Json
          name: string
          ref_version: string
          region?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          data?: Json
          name?: string
          ref_version?: string
          region?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zones_ref_version_fkey"
            columns: ["ref_version"]
            isOneToOne: false
            referencedRelation: "ref_versions"
            referencedColumns: ["version"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_org_role: {
        Args: {
          _org_id: string
          _roles: Database["public"]["Enums"]["org_role"][]
        }
        Returns: boolean
      }
      has_platform_role: {
        Args: { _role: Database["public"]["Enums"]["platform_role"] }
        Returns: boolean
      }
      is_org_member: { Args: { _org_id: string }; Returns: boolean }
      is_referentiel_editor: { Args: never; Returns: boolean }
    }
    Enums: {
      document_type: "budget" | "business_plan" | "prefaisabilite"
      locale_code: "fr" | "ar" | "en"
      mapping_quality: "optimal" | "possible" | "deconseille"
      org_role: "owner" | "admin" | "editor" | "viewer"
      org_type:
        | "ferme"
        | "cooperative"
        | "banque"
        | "assureur"
        | "organisme_public"
        | "groupe"
        | "autre"
      platform_role: "user" | "admin" | "comite"
      project_mode: "projet" | "capital"
      wallet_plan: "free" | "pro"
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
      document_type: ["budget", "business_plan", "prefaisabilite"],
      locale_code: ["fr", "ar", "en"],
      mapping_quality: ["optimal", "possible", "deconseille"],
      org_role: ["owner", "admin", "editor", "viewer"],
      org_type: [
        "ferme",
        "cooperative",
        "banque",
        "assureur",
        "organisme_public",
        "groupe",
        "autre",
      ],
      platform_role: ["user", "admin", "comite"],
      project_mode: ["projet", "capital"],
      wallet_plan: ["free", "pro"],
    },
  },
} as const
