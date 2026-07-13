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
      bee_one_ingestions: {
        Row: {
          cle_norme: string
          examine_le: string | null
          examine_par: string | null
          id: string
          motif: string | null
          n_echantillon: number
          profil_code: string | null
          recu_le: string
          seuil_k_anonymat: number
          statut: string
          valeur_agrege: Json
          zone_code: string | null
        }
        Insert: {
          cle_norme: string
          examine_le?: string | null
          examine_par?: string | null
          id?: string
          motif?: string | null
          n_echantillon?: number
          profil_code?: string | null
          recu_le?: string
          seuil_k_anonymat?: number
          statut?: string
          valeur_agrege: Json
          zone_code?: string | null
        }
        Update: {
          cle_norme?: string
          examine_le?: string | null
          examine_par?: string | null
          id?: string
          motif?: string | null
          n_echantillon?: number
          profil_code?: string | null
          recu_le?: string
          seuil_k_anonymat?: number
          statut?: string
          valeur_agrege?: Json
          zone_code?: string | null
        }
        Relationships: []
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
      consultant_links: {
        Row: {
          accorde_le: string
          accorde_par: string | null
          client_org_id: string
          consultant_org_id: string
          credits_source: string
          id: string
          motif_accord: string | null
          motif_revocation: string | null
          revoque_le: string | null
          revoque_par: string | null
          role: string
          statut: string
        }
        Insert: {
          accorde_le?: string
          accorde_par?: string | null
          client_org_id: string
          consultant_org_id: string
          credits_source: string
          id?: string
          motif_accord?: string | null
          motif_revocation?: string | null
          revoque_le?: string | null
          revoque_par?: string | null
          role: string
          statut?: string
        }
        Update: {
          accorde_le?: string
          accorde_par?: string | null
          client_org_id?: string
          consultant_org_id?: string
          credits_source?: string
          id?: string
          motif_accord?: string | null
          motif_revocation?: string | null
          revoque_le?: string | null
          revoque_par?: string | null
          role?: string
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_links_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_links_consultant_org_id_fkey"
            columns: ["consultant_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          action: string | null
          at: string
          auteur_id: string | null
          delta: number
          id: string
          motif: string | null
          org_id: string
          ref_id: string | null
          solde_apres: number
          type: string
        }
        Insert: {
          action?: string | null
          at?: string
          auteur_id?: string | null
          delta: number
          id?: string
          motif?: string | null
          org_id: string
          ref_id?: string | null
          solde_apres: number
          type: string
        }
        Update: {
          action?: string | null
          at?: string
          auteur_id?: string | null
          delta?: number
          id?: string
          motif?: string | null
          org_id?: string
          ref_id?: string | null
          solde_apres?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_pricing: {
        Row: {
          actif: boolean
          action: string
          cout: number
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actif?: boolean
          action: string
          cout: number
          label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actif?: boolean
          action?: string
          cout?: number
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      credit_requests: {
        Row: {
          created_at: string
          credits: number
          demandeur_id: string
          id: string
          message: string | null
          montant_mad: number | null
          motif_refus: string | null
          org_id: string
          pack: string
          statut: string
          traitee_le: string | null
          traitee_par: string | null
        }
        Insert: {
          created_at?: string
          credits: number
          demandeur_id: string
          id?: string
          message?: string | null
          montant_mad?: number | null
          motif_refus?: string | null
          org_id: string
          pack: string
          statut?: string
          traitee_le?: string | null
          traitee_par?: string | null
        }
        Update: {
          created_at?: string
          credits?: number
          demandeur_id?: string
          id?: string
          message?: string | null
          montant_mad?: number | null
          motif_refus?: string | null
          org_id?: string
          pack?: string
          statut?: string
          traitee_le?: string | null
          traitee_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
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
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          meta: Json
          org_id: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          meta?: Json
          org_id?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          meta?: Json
          org_id?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
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
          country: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          type: Database["public"]["Enums"]["org_type"]
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          type: Database["public"]["Enums"]["org_type"]
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["org_type"]
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          actif: boolean
          code: string
          credits_mensuels: number
          label: string
          marque_blanche: boolean
          prix_mad: number
          quota_gen_jour: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actif?: boolean
          code: string
          credits_mensuels?: number
          label: string
          marque_blanche?: boolean
          prix_mad?: number
          quota_gen_jour?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actif?: boolean
          code?: string
          credits_mensuels?: number
          label?: string
          marque_blanche?: boolean
          prix_mad?: number
          quota_gen_jour?: number
          updated_at?: string
          updated_by?: string | null
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
          actif: boolean
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          locale: Database["public"]["Enums"]["locale_code"]
          platform_role: Database["public"]["Enums"]["platform_role"]
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          locale?: Database["public"]["Enums"]["locale_code"]
          platform_role?: Database["public"]["Enums"]["platform_role"]
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          email?: string | null
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
      ref_lots: {
        Row: {
          cree_le: string
          cree_par: string | null
          id: string
          note_version: string | null
          publie_le: string | null
          publie_par: string | null
          statut: string
          version_cible: string
        }
        Insert: {
          cree_le?: string
          cree_par?: string | null
          id?: string
          note_version?: string | null
          publie_le?: string | null
          publie_par?: string | null
          statut?: string
          version_cible: string
        }
        Update: {
          cree_le?: string
          cree_par?: string | null
          id?: string
          note_version?: string | null
          publie_le?: string | null
          publie_par?: string | null
          statut?: string
          version_cible?: string
        }
        Relationships: []
      }
      ref_propositions: {
        Row: {
          ancienne_valeur: Json | null
          approuve_admin_le: string | null
          approuve_admin_par: string | null
          auteur: string | null
          bee_one_n: number | null
          bee_one_periode: string | null
          cle_norme: string
          cree_le: string
          id: string
          justification: string
          lot_id: string
          motif_rejet: string | null
          motif_renvoi: string | null
          nouvelle_valeur: Json
          profil_code: string | null
          provenance: string
          statut: Database["public"]["Enums"]["proposition_statut"]
          valide_comite_le: string | null
          valide_comite_par: string | null
          zone_code: string | null
        }
        Insert: {
          ancienne_valeur?: Json | null
          approuve_admin_le?: string | null
          approuve_admin_par?: string | null
          auteur?: string | null
          bee_one_n?: number | null
          bee_one_periode?: string | null
          cle_norme: string
          cree_le?: string
          id?: string
          justification: string
          lot_id: string
          motif_rejet?: string | null
          motif_renvoi?: string | null
          nouvelle_valeur: Json
          profil_code?: string | null
          provenance: string
          statut?: Database["public"]["Enums"]["proposition_statut"]
          valide_comite_le?: string | null
          valide_comite_par?: string | null
          zone_code?: string | null
        }
        Update: {
          ancienne_valeur?: Json | null
          approuve_admin_le?: string | null
          approuve_admin_par?: string | null
          auteur?: string | null
          bee_one_n?: number | null
          bee_one_periode?: string | null
          cle_norme?: string
          cree_le?: string
          id?: string
          justification?: string
          lot_id?: string
          motif_rejet?: string | null
          motif_renvoi?: string | null
          nouvelle_valeur?: Json
          profil_code?: string | null
          provenance?: string
          statut?: Database["public"]["Enums"]["proposition_statut"]
          valide_comite_le?: string | null
          valide_comite_par?: string | null
          zone_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ref_propositions_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "ref_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      ref_versions: {
        Row: {
          created_by: string | null
          k_anonymat: number | null
          note_publication: string | null
          notes: string | null
          publiee_le: string | null
          publiee_par: string | null
          published_at: string
          version: string
        }
        Insert: {
          created_by?: string | null
          k_anonymat?: number | null
          note_publication?: string | null
          notes?: string | null
          publiee_le?: string | null
          publiee_par?: string | null
          published_at?: string
          version: string
        }
        Update: {
          created_by?: string | null
          k_anonymat?: number | null
          note_publication?: string | null
          notes?: string | null
          publiee_le?: string | null
          publiee_par?: string | null
          published_at?: string
          version?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          autorise_negatif: boolean
          created_at: string
          credits: number
          credits_alerte: number
          org_id: string
          plan: Database["public"]["Enums"]["wallet_plan"]
          plan_assigne_le: string | null
          plan_code: string | null
          plan_facture_ref: string | null
          updated_at: string
        }
        Insert: {
          autorise_negatif?: boolean
          created_at?: string
          credits?: number
          credits_alerte?: number
          org_id: string
          plan?: Database["public"]["Enums"]["wallet_plan"]
          plan_assigne_le?: string | null
          plan_code?: string | null
          plan_facture_ref?: string | null
          updated_at?: string
        }
        Update: {
          autorise_negatif?: boolean
          created_at?: string
          credits?: number
          credits_alerte?: number
          org_id?: string
          plan?: Database["public"]["Enums"]["wallet_plan"]
          plan_assigne_le?: string | null
          plan_code?: string | null
          plan_facture_ref?: string | null
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
          {
            foreignKeyName: "wallets_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
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
      admin_approve_proposition: { Args: { p_id: string }; Returns: undefined }
      admin_assign_plan: {
        Args: {
          p_facture_ref: string
          p_motif: string
          p_org_id: string
          p_plan_code: string
        }
        Returns: undefined
      }
      admin_link_consultant: {
        Args: {
          p_client_org: string
          p_consultant_org: string
          p_motif: string
          p_role: string
          p_source: string
        }
        Returns: string
      }
      admin_return_proposition: {
        Args: { p_id: string; p_motif: string }
        Returns: undefined
      }
      admin_revoke_link: {
        Args: { p_link_id: string; p_motif: string }
        Returns: undefined
      }
      admin_set_user_platform_role: {
        Args: {
          p_motif: string
          p_role: Database["public"]["Enums"]["platform_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      admin_toggle_user_active: {
        Args: { p_actif: boolean; p_motif: string; p_user_id: string }
        Returns: undefined
      }
      bee_one_examine: {
        Args: { p_decision: string; p_id: string; p_motif: string }
        Returns: undefined
      }
      comite_publish_lot: {
        Args: { p_lot_id: string; p_note: string }
        Returns: string
      }
      comite_submit_proposition: { Args: { p_id: string }; Returns: undefined }
      consume_credits: {
        Args: { p_action: string; p_org_id: string; p_ref_id?: string }
        Returns: string
      }
      decide_credit_request: {
        Args: { p_decision: string; p_motif?: string; p_request_id: string }
        Returns: string
      }
      grant_credits: {
        Args: {
          p_delta: number
          p_motif: string
          p_org_id: string
          p_type?: string
        }
        Returns: string
      }
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
      refund_credits: {
        Args: { p_ledger_id: string; p_motif: string }
        Returns: string
      }
    }
    Enums: {
      document_type: "budget" | "business_plan" | "prefaisabilite"
      locale_code: "fr" | "ar" | "en"
      mapping_quality:
        | "optimal"
        | "possible"
        | "deconseille"
        | "eligible"
        | "exclu"
      org_role: "owner" | "admin" | "editor" | "viewer" | "member"
      org_type:
        | "ferme"
        | "cooperative"
        | "banque"
        | "assureur"
        | "organisme_public"
        | "groupe"
        | "autre"
        | "investisseur"
        | "agriculteur"
        | "consultant"
      platform_role: "user" | "admin" | "comite"
      project_mode: "projet" | "capital"
      proposition_statut:
        | "brouillon"
        | "soumise"
        | "validee_comite"
        | "approuvee_admin"
        | "publiee"
        | "rejetee"
        | "renvoyee_comite"
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
      mapping_quality: [
        "optimal",
        "possible",
        "deconseille",
        "eligible",
        "exclu",
      ],
      org_role: ["owner", "admin", "editor", "viewer", "member"],
      org_type: [
        "ferme",
        "cooperative",
        "banque",
        "assureur",
        "organisme_public",
        "groupe",
        "autre",
        "investisseur",
        "agriculteur",
        "consultant",
      ],
      platform_role: ["user", "admin", "comite"],
      project_mode: ["projet", "capital"],
      proposition_statut: [
        "brouillon",
        "soumise",
        "validee_comite",
        "approuvee_admin",
        "publiee",
        "rejetee",
        "renvoyee_comite",
      ],
      wallet_plan: ["free", "pro"],
    },
  },
} as const
