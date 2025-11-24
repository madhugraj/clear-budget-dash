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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          expense_id: string | null
          id: string
          performed_by: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          expense_id?: string | null
          id?: string
          performed_by: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          expense_id?: string | null
          id?: string
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          allocated_amount: number
          category: string
          created_at: string
          created_by: string
          description: string | null
          fiscal_year: number
          id: string
        }
        Insert: {
          allocated_amount: number
          category: string
          created_at?: string
          created_by: string
          description?: string | null
          fiscal_year: number
          id?: string
        }
        Update: {
          allocated_amount?: number
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          fiscal_year?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_master: {
        Row: {
          annual_budget: number
          category: string
          committee: string
          created_at: string
          created_by: string
          fiscal_year: string
          id: string
          item_name: string
          monthly_budget: number
          serial_no: number
          updated_at: string
        }
        Insert: {
          annual_budget: number
          category: string
          committee: string
          created_at?: string
          created_by: string
          fiscal_year?: string
          id?: string
          item_name: string
          monthly_budget?: number
          serial_no: number
          updated_at?: string
        }
        Update: {
          annual_budget?: number
          category?: string
          committee?: string
          created_at?: string
          created_by?: string
          fiscal_year?: string
          id?: string
          item_name?: string
          monthly_budget?: number
          serial_no?: number
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          approved_by: string | null
          budget_item_id: string | null
          budget_master_id: string | null
          claimed_by: string
          created_at: string
          description: string
          expense_date: string
          id: string
          invoice_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          budget_item_id?: string | null
          budget_master_id?: string | null
          claimed_by: string
          created_at?: string
          description: string
          expense_date: string
          id?: string
          invoice_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          budget_item_id?: string | null
          budget_master_id?: string | null
          claimed_by?: string
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          invoice_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_budget_master_id_fkey"
            columns: ["budget_master_id"]
            isOneToOne: false
            referencedRelation: "budget_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      historical_spending: {
        Row: {
          budget_item_id: string
          created_at: string
          created_by: string
          fiscal_year: number
          id: string
          q1_amount: number | null
          q2_amount: number | null
          q3_amount: number | null
          q4_amount: number | null
          updated_at: string
        }
        Insert: {
          budget_item_id: string
          created_at?: string
          created_by: string
          fiscal_year: number
          id?: string
          q1_amount?: number | null
          q2_amount?: number | null
          q3_amount?: number | null
          q4_amount?: number | null
          updated_at?: string
        }
        Update: {
          budget_item_id?: string
          created_at?: string
          created_by?: string
          fiscal_year?: number
          id?: string
          q1_amount?: number | null
          q2_amount?: number | null
          q3_amount?: number | null
          q4_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "historical_spending_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historical_spending_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      income_actuals: {
        Row: {
          actual_amount: number
          category_id: string
          created_at: string
          fiscal_year: string
          id: string
          month: number
          notes: string | null
          recorded_by: string
          updated_at: string
        }
        Insert: {
          actual_amount?: number
          category_id: string
          created_at?: string
          fiscal_year: string
          id?: string
          month: number
          notes?: string | null
          recorded_by: string
          updated_at?: string
        }
        Update: {
          actual_amount?: number
          category_id?: string
          created_at?: string
          fiscal_year?: string
          id?: string
          month?: number
          notes?: string | null
          recorded_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_actuals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "income_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      income_budget: {
        Row: {
          budgeted_amount: number
          category_id: string
          created_at: string
          created_by: string
          fiscal_year: string
          id: string
          updated_at: string
        }
        Insert: {
          budgeted_amount?: number
          category_id: string
          created_at?: string
          created_by: string
          fiscal_year: string
          id?: string
          updated_at?: string
        }
        Update: {
          budgeted_amount?: number
          category_id?: string
          created_at?: string
          created_by?: string
          fiscal_year?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_budget_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "income_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      income_categories: {
        Row: {
          category_name: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          parent_category_id: string | null
          subcategory_name: string | null
          updated_at: string
        }
        Insert: {
          category_name: string
          created_at?: string
          display_order: number
          id?: string
          is_active?: boolean
          parent_category_id?: string | null
          subcategory_name?: string | null
          updated_at?: string
        }
        Update: {
          category_name?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          parent_category_id?: string | null
          subcategory_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "income_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      user_role: "treasurer" | "accountant"
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
      user_role: ["treasurer", "accountant"],
    },
  },
} as const
