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
      absence_requests: {
        Row: {
          absence_type: Database["public"]["Enums"]["absence_type"]
          approved_by: string | null
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          notes: string | null
          start_date: string
          status: Database["public"]["Enums"]["absence_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          absence_type?: Database["public"]["Enums"]["absence_type"]
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          notes?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["absence_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          absence_type?: Database["public"]["Enums"]["absence_type"]
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["absence_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_documents: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          section: string
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          section?: string
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          section?: string
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      crm_activities: {
        Row: {
          completed_at: string | null
          contenido: string
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          scheduled_for: string | null
          tipo: string
        }
        Insert: {
          completed_at?: string | null
          contenido?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          scheduled_for?: string | null
          tipo: string
        }
        Update: {
          completed_at?: string | null
          contenido?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          scheduled_for?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_followup_settings: {
        Row: {
          followup_days: number[]
          id: number
          updated_at: string
        }
        Insert: {
          followup_days?: number[]
          id?: number
          updated_at?: string
        }
        Update: {
          followup_days?: number[]
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      crm_incidents: {
        Row: {
          cliente: string
          created_at: string
          created_by: string | null
          descripcion: string
          estado: Database["public"]["Enums"]["incident_status"]
          fecha: string
          id: string
          prioridad: Database["public"]["Enums"]["incident_priority"]
          updated_at: string
        }
        Insert: {
          cliente: string
          created_at?: string
          created_by?: string | null
          descripcion: string
          estado?: Database["public"]["Enums"]["incident_status"]
          fecha?: string
          id?: string
          prioridad?: Database["public"]["Enums"]["incident_priority"]
          updated_at?: string
        }
        Update: {
          cliente?: string
          created_at?: string
          created_by?: string | null
          descripcion?: string
          estado?: Database["public"]["Enums"]["incident_status"]
          fecha?: string
          id?: string
          prioridad?: Database["public"]["Enums"]["incident_priority"]
          updated_at?: string
        }
        Relationships: []
      }
      crm_leads: {
        Row: {
          apellido: string
          archived: boolean
          cargo: string | null
          cif: string | null
          comentarios: string | null
          comercial_id: string | null
          contact_count: number
          created_at: string
          email: string
          email_copy: string | null
          empresa: string
          fase: Database["public"]["Enums"]["lead_phase"]
          fuente: string
          gancho: string | null
          id: string
          is_converted: boolean
          linkedin_copy: string | null
          linkedin_url: string | null
          nombre: string
          plan_objetivo: string
          prioridad: string
          proximo_contacto: string | null
          quality_flag: string
          region: string | null
          tipo_cuenta: string
          ultimo_contacto: string | null
          updated_at: string
          web: string | null
        }
        Insert: {
          apellido?: string
          archived?: boolean
          cargo?: string | null
          cif?: string | null
          comentarios?: string | null
          comercial_id?: string | null
          contact_count?: number
          created_at?: string
          email?: string
          email_copy?: string | null
          empresa?: string
          fase?: Database["public"]["Enums"]["lead_phase"]
          fuente?: string
          gancho?: string | null
          id?: string
          is_converted?: boolean
          linkedin_copy?: string | null
          linkedin_url?: string | null
          nombre: string
          plan_objetivo?: string
          prioridad?: string
          proximo_contacto?: string | null
          quality_flag?: string
          region?: string | null
          tipo_cuenta?: string
          ultimo_contacto?: string | null
          updated_at?: string
          web?: string | null
        }
        Update: {
          apellido?: string
          archived?: boolean
          cargo?: string | null
          cif?: string | null
          comentarios?: string | null
          comercial_id?: string | null
          contact_count?: number
          created_at?: string
          email?: string
          email_copy?: string | null
          empresa?: string
          fase?: Database["public"]["Enums"]["lead_phase"]
          fuente?: string
          gancho?: string | null
          id?: string
          is_converted?: boolean
          linkedin_copy?: string | null
          linkedin_url?: string | null
          nombre?: string
          plan_objetivo?: string
          prioridad?: string
          proximo_contacto?: string | null
          quality_flag?: string
          region?: string | null
          tipo_cuenta?: string
          ultimo_contacto?: string | null
          updated_at?: string
          web?: string | null
        }
        Relationships: []
      }
      crm_playbook: {
        Row: {
          body: string
          key: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          key: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          bio: string
          credentials: Json
          education: Json
          experience: Json
          id: string
          image_url: string
          linkedin: string | null
          name: string
          role: string
          slug: string
          sort_order: number
          summary: string
          visible: boolean
        }
        Insert: {
          bio?: string
          credentials?: Json
          education?: Json
          experience?: Json
          id?: string
          image_url?: string
          linkedin?: string | null
          name: string
          role?: string
          slug: string
          sort_order?: number
          summary?: string
          visible?: boolean
        }
        Update: {
          bio?: string
          credentials?: Json
          education?: Json
          experience?: Json
          id?: string
          image_url?: string
          linkedin?: string | null
          name?: string
          role?: string
          slug?: string
          sort_order?: number
          summary?: string
          visible?: boolean
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          billing_date: string
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          description: string | null
          expense_date: string
          external_id: string | null
          id: string
          payment_date: string | null
          provider: string
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          billing_date?: string
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          external_id?: string | null
          id?: string
          payment_date?: string | null
          provider?: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_date?: string
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          external_id?: string | null
          id?: string
          payment_date?: string | null
          provider?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      festivos: {
        Row: {
          created_at: string
          created_by: string | null
          fecha: string
          id: string
          nombre: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fecha: string
          id?: string
          nombre: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fecha?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      module_entries: {
        Row: {
          body: string
          client_id: string
          id: string
          kind: string
          module: string
          sort_order: number
          title: string
          unit: string
          updated_at: string
          value: string
        }
        Insert: {
          body?: string
          client_id: string
          id?: string
          kind: string
          module: string
          sort_order?: number
          title: string
          unit?: string
          updated_at?: string
          value?: string
        }
        Update: {
          body?: string
          client_id?: string
          id?: string
          kind?: string
          module?: string
          sort_order?: number
          title?: string
          unit?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          calendly_url: string | null
          company_name: string | null
          created_at: string
          email: string
          employee_permissions: Json
          first_name: string
          full_name: string | null
          id: string
          job_title: string | null
          last_name: string
          nif: string | null
          role: string
          updated_at: string
          work_email: string | null
        }
        Insert: {
          calendly_url?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          employee_permissions?: Json
          first_name?: string
          full_name?: string | null
          id: string
          job_title?: string | null
          last_name?: string
          nif?: string | null
          role: string
          updated_at?: string
          work_email?: string | null
        }
        Update: {
          calendly_url?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          employee_permissions?: Json
          first_name?: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string
          nif?: string | null
          role?: string
          updated_at?: string
          work_email?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          about_image_url: string
          hero_image_url: string
          id: number
          stat_1_prefix: string
          stat_1_suffix: string
          stat_1_value: number
          stat_2_prefix: string
          stat_2_suffix: string
          stat_2_value: number
          stat_3_prefix: string
          stat_3_suffix: string
          stat_3_value: number
          stat_4_prefix: string
          stat_4_suffix: string
          stat_4_value: number
        }
        Insert: {
          about_image_url?: string
          hero_image_url?: string
          id?: number
          stat_1_prefix?: string
          stat_1_suffix?: string
          stat_1_value?: number
          stat_2_prefix?: string
          stat_2_suffix?: string
          stat_2_value?: number
          stat_3_prefix?: string
          stat_3_suffix?: string
          stat_3_value?: number
          stat_4_prefix?: string
          stat_4_suffix?: string
          stat_4_value?: number
        }
        Update: {
          about_image_url?: string
          hero_image_url?: string
          id?: number
          stat_1_prefix?: string
          stat_1_suffix?: string
          stat_1_value?: number
          stat_2_prefix?: string
          stat_2_suffix?: string
          stat_2_value?: number
          stat_3_prefix?: string
          stat_3_suffix?: string
          stat_3_value?: number
          stat_4_prefix?: string
          stat_4_suffix?: string
          stat_4_value?: number
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          clock_in: string
          clock_out: string | null
          created_at: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          clock_in: string
          clock_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
          work_date?: string
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: []
      }
      trajectory_items: {
        Row: {
          href: string
          id: string
          logo_url: string | null
          name: string
          sort_order: number
        }
        Insert: {
          href: string
          id?: string
          logo_url?: string | null
          name: string
          sort_order?: number
        }
        Update: {
          href?: string
          id?: string
          logo_url?: string | null
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _employee_permissions_json: {
        Args: { p_permissions: Json }
        Returns: Json
      }
      crm_next_contact_date: {
        Args: { p_contact_count: number; p_days?: number[]; p_from: string }
        Returns: string
      }
      crm_schedule_followups: {
        Args: { p_from?: string; p_lead_id: string }
        Returns: undefined
      }
      demote_employee_to_cliente: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      has_admin_module_access: { Args: { p_module: string }; Returns: boolean }
      has_employee_permission: { Args: { p_key: string }; Returns: boolean }
      is_staff_member: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      list_employee_profiles: {
        Args: never
        Returns: {
          calendly_url: string
          company_name: string
          created_at: string
          email: string
          employee_permissions: Json
          full_name: string
          job_title: string
          role: string
          user_id: string
          work_email: string
        }[]
      }
      search_cliente_profiles: {
        Args: { p_limit?: number; p_query?: string }
        Returns: {
          company_name: string
          email: string
          full_name: string
          user_id: string
        }[]
      }
      search_users_for_employee: {
        Args: { p_limit?: number; p_query?: string }
        Returns: {
          company_name: string
          email: string
          full_name: string
          role: string
          user_id: string
        }[]
      }
      set_user_as_employee: {
        Args: { p_permissions?: Json; p_user_id: string }
        Returns: undefined
      }
      update_employee_commercial_identity: {
        Args: {
          p_calendly_url: string
          p_full_name: string
          p_job_title: string
          p_user_id: string
          p_work_email: string
        }
        Returns: undefined
      }
      update_employee_permissions: {
        Args: { p_permissions: Json; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      absence_status: "pending" | "approved" | "rejected"
      absence_type:
        | "vacation"
        | "sick_leave"
        | "maternity"
        | "justified"
        | "pending"
      expense_category:
        | "recurrent"
        | "payroll"
        | "one_time"
        | "interest"
        | "tax"
        | "depreciation"
        | "amortization"
      incident_priority: "baja" | "media" | "alta" | "critica"
      incident_status: "abierta" | "en_progreso" | "resuelta" | "cerrada"
      lead_phase:
        | "nuevo"
        | "contactado"
        | "propuesta"
        | "negociacion"
        | "convertido"
        | "perdido"
      mc_absence_status: "pending" | "approved" | "rejected"
      mc_absence_type:
        | "vacation"
        | "sick_leave"
        | "maternity"
        | "justified"
        | "pending"
      mc_app_role: "superadmin" | "admin" | "client" | "empleado"
      mc_bulletin_frequency: "daily" | "weekly" | "biweekly" | "monthly"
      mc_bulletin_status: "draft" | "active" | "paused" | "archived"
      mc_expense_category:
        | "recurrent"
        | "payroll"
        | "one_time"
        | "interest"
        | "tax"
        | "depreciation"
        | "amortization"
      mc_incident_priority: "baja" | "media" | "alta" | "critica"
      mc_incident_status: "abierta" | "en_progreso" | "resuelta" | "cerrada"
      mc_lead_phase:
        | "nuevo"
        | "contactado"
        | "propuesta"
        | "negociacion"
        | "convertido"
        | "perdido"
      mc_plan_type: "starter" | "business" | "enterprise"
      mc_report_kind: "estado_arte" | "informe_mercado" | "social_listening"
      mc_report_status: "draft" | "generating" | "ready" | "failed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      absence_status: ["pending", "approved", "rejected"],
      absence_type: [
        "vacation",
        "sick_leave",
        "maternity",
        "justified",
        "pending",
      ],
      expense_category: [
        "recurrent",
        "payroll",
        "one_time",
        "interest",
        "tax",
        "depreciation",
        "amortization",
      ],
      incident_priority: ["baja", "media", "alta", "critica"],
      incident_status: ["abierta", "en_progreso", "resuelta", "cerrada"],
      lead_phase: [
        "nuevo",
        "contactado",
        "propuesta",
        "negociacion",
        "convertido",
        "perdido",
      ],
      mc_absence_status: ["pending", "approved", "rejected"],
      mc_absence_type: [
        "vacation",
        "sick_leave",
        "maternity",
        "justified",
        "pending",
      ],
      mc_app_role: ["superadmin", "admin", "client", "empleado"],
      mc_bulletin_frequency: ["daily", "weekly", "biweekly", "monthly"],
      mc_bulletin_status: ["draft", "active", "paused", "archived"],
      mc_expense_category: [
        "recurrent",
        "payroll",
        "one_time",
        "interest",
        "tax",
        "depreciation",
        "amortization",
      ],
      mc_incident_priority: ["baja", "media", "alta", "critica"],
      mc_incident_status: ["abierta", "en_progreso", "resuelta", "cerrada"],
      mc_lead_phase: [
        "nuevo",
        "contactado",
        "propuesta",
        "negociacion",
        "convertido",
        "perdido",
      ],
      mc_plan_type: ["starter", "business", "enterprise"],
      mc_report_kind: ["estado_arte", "informe_mercado", "social_listening"],
      mc_report_status: ["draft", "generating", "ready", "failed"],
    },
  },
} as const
