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
      announcements: {
        Row: {
          author_id: string
          created_at: string
          id: string
          message: string
          title: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          message: string
          title: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          message?: string
          title?: string
        }
        Relationships: []
      }
      archived_plans: {
        Row: {
          archived_at: string
          completion_data: Json
          id: string
          plan_data: Json
          plan_name: string
          user_id: string
        }
        Insert: {
          archived_at?: string
          completion_data?: Json
          id?: string
          plan_data?: Json
          plan_name?: string
          user_id: string
        }
        Update: {
          archived_at?: string
          completion_data?: Json
          id?: string
          plan_data?: Json
          plan_name?: string
          user_id?: string
        }
        Relationships: []
      }
      avatar_config: {
        Row: {
          body_fat: string
          body_height: string
          created_at: string
          hair_color: string
          hair_style: string
          id: string
          mouth_expression: string
          muscle_mass: string
          skin_color: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body_fat?: string
          body_height?: string
          created_at?: string
          hair_color?: string
          hair_style?: string
          id?: string
          mouth_expression?: string
          muscle_mass?: string
          skin_color?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body_fat?: string
          body_height?: string
          created_at?: string
          hair_color?: string
          hair_style?: string
          id?: string
          mouth_expression?: string
          muscle_mass?: string
          skin_color?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      avatar_equipped_items: {
        Row: {
          id: string
          item_id: string
          slot: string
          user_id: string
        }
        Insert: {
          id?: string
          item_id: string
          slot: string
          user_id: string
        }
        Update: {
          id?: string
          item_id?: string
          slot?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avatar_equipped_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "avatar_shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      avatar_owned_items: {
        Row: {
          id: string
          item_id: string
          purchased_at: string
          user_id: string
        }
        Insert: {
          id?: string
          item_id: string
          purchased_at?: string
          user_id: string
        }
        Update: {
          id?: string
          item_id?: string
          purchased_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avatar_owned_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "avatar_shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      avatar_shop_items: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
          style_data: Json
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          style_data?: Json
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          style_data?: Json
          updated_at?: string
        }
        Relationships: []
      }
      custom_exercises: {
        Row: {
          category: string
          created_at: string
          created_by: string
          id: string
          muscle_group: string
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          id?: string
          muscle_group?: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          muscle_group?: string
          name?: string
        }
        Relationships: []
      }
      daily_challenge_completions: {
        Row: {
          challenge_date: string
          challenge_text: string
          completed_at: string
          id: string
          user_id: string
        }
        Insert: {
          challenge_date: string
          challenge_text: string
          completed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          challenge_date?: string
          challenge_text?: string
          completed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      exercise_gif_mappings: {
        Row: {
          created_at: string
          created_by: string
          custom_instructions: Json | null
          exercise_name: string
          exercise_name_lower: string | null
          exercisedb_name: string
          gif_url: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          custom_instructions?: Json | null
          exercise_name: string
          exercise_name_lower?: string | null
          exercisedb_name: string
          gif_url?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          custom_instructions?: Json | null
          exercise_name?: string
          exercise_name_lower?: string | null
          exercisedb_name?: string
          gif_url?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          created_at: string
          day: string
          id: string
          type: string
          user_id: string
          week: number
        }
        Insert: {
          created_at?: string
          day: string
          id?: string
          type?: string
          user_id: string
          week: number
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          type?: string
          user_id?: string
          week?: number
        }
        Relationships: []
      }
      password_reset_attempts: {
        Row: {
          attempt_count: number
          id: string
          ip_address: string
          last_attempt_at: string
          locked_until: string | null
          nickname_attempted: string
        }
        Insert: {
          attempt_count?: number
          id?: string
          ip_address: string
          last_attempt_at?: string
          locked_until?: string | null
          nickname_attempted: string
        }
        Update: {
          attempt_count?: number
          id?: string
          ip_address?: string
          last_attempt_at?: string
          locked_until?: string | null
          nickname_attempted?: string
        }
        Relationships: []
      }
      pr_goals: {
        Row: {
          created_at: string
          exercise: string
          id: string
          target_date: string | null
          target_weight: number
          user_id: string
        }
        Insert: {
          created_at?: string
          exercise: string
          id?: string
          target_date?: string | null
          target_weight: number
          user_id: string
        }
        Update: {
          created_at?: string
          exercise?: string
          id?: string
          target_date?: string | null
          target_weight?: number
          user_id?: string
        }
        Relationships: []
      }
      pr_stars: {
        Row: {
          created_at: string
          exercise: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exercise: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exercise?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          avatar_url: string | null
          created_at: string
          experience_level: string | null
          gender: string | null
          id: string
          instagram: string | null
          is_honorary: boolean
          max_distance_km: number | null
          must_change_password: boolean
          nickname: string
          protein_bars: number
          referral_code: string | null
          referred_by: string | null
          snapchat: string | null
          spotify_anthem_name: string | null
          spotify_anthem_url: string | null
          tiktok: string | null
          time_10km_min: number | null
          training_days_per_week: number | null
          user_id: string
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          created_at?: string
          experience_level?: string | null
          gender?: string | null
          id?: string
          instagram?: string | null
          is_honorary?: boolean
          max_distance_km?: number | null
          must_change_password?: boolean
          nickname: string
          protein_bars?: number
          referral_code?: string | null
          referred_by?: string | null
          snapchat?: string | null
          spotify_anthem_name?: string | null
          spotify_anthem_url?: string | null
          tiktok?: string | null
          time_10km_min?: number | null
          training_days_per_week?: number | null
          user_id: string
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          created_at?: string
          experience_level?: string | null
          gender?: string | null
          id?: string
          instagram?: string | null
          is_honorary?: boolean
          max_distance_km?: number | null
          must_change_password?: boolean
          nickname?: string
          protein_bars?: number
          referral_code?: string | null
          referred_by?: string | null
          snapchat?: string | null
          spotify_anthem_name?: string | null
          spotify_anthem_url?: string | null
          tiktok?: string | null
          time_10km_min?: number | null
          training_days_per_week?: number | null
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      security_answers: {
        Row: {
          answer_hash: string
          created_at: string
          id: string
          question_index: number
          user_id: string
        }
        Insert: {
          answer_hash: string
          created_at?: string
          id?: string
          question_index: number
          user_id: string
        }
        Update: {
          answer_hash?: string
          created_at?: string
          id?: string
          question_index?: number
          user_id?: string
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          created_at: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      user_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          user_id?: string
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
      vapid_keys: {
        Row: {
          created_at: string
          id: number
          private_key: string
          public_key: string
        }
        Insert: {
          created_at?: string
          id?: number
          private_key: string
          public_key: string
        }
        Update: {
          created_at?: string
          id?: number
          private_key?: string
          public_key?: string
        }
        Relationships: []
      }
      workout_comments: {
        Row: {
          author_id: string
          comment: string
          created_at: string
          day: string
          id: string
          target_user_id: string
          week: number
        }
        Insert: {
          author_id: string
          comment: string
          created_at?: string
          day: string
          id?: string
          target_user_id: string
          week: number
        }
        Update: {
          author_id?: string
          comment?: string
          created_at?: string
          day?: string
          id?: string
          target_user_id?: string
          week?: number
        }
        Relationships: []
      }
      workout_completions: {
        Row: {
          day: string
          done: boolean
          id: string
          logged_distance_km: number | null
          logged_pulse: number | null
          logged_tempo: string | null
          logged_weights: Json | null
          skipped: boolean
          updated_at: string
          user_comment: string | null
          user_id: string
          week: number
        }
        Insert: {
          day: string
          done?: boolean
          id?: string
          logged_distance_km?: number | null
          logged_pulse?: number | null
          logged_tempo?: string | null
          logged_weights?: Json | null
          skipped?: boolean
          updated_at?: string
          user_comment?: string | null
          user_id: string
          week: number
        }
        Update: {
          day?: string
          done?: boolean
          id?: string
          logged_distance_km?: number | null
          logged_pulse?: number | null
          logged_tempo?: string | null
          logged_weights?: Json | null
          skipped?: boolean
          updated_at?: string
          user_comment?: string | null
          user_id?: string
          week?: number
        }
        Relationships: []
      }
      workout_likes: {
        Row: {
          created_at: string
          day: string
          id: string
          target_user_id: string
          user_id: string
          week: number
        }
        Insert: {
          created_at?: string
          day: string
          id?: string
          target_user_id: string
          user_id: string
          week: number
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          target_user_id?: string
          user_id?: string
          week?: number
        }
        Relationships: []
      }
      workout_plans: {
        Row: {
          created_at: string
          day: string
          details: string
          id: string
          session_name: string
          tempo: string | null
          updated_at: string
          user_id: string
          week: number
        }
        Insert: {
          created_at?: string
          day: string
          details?: string
          id?: string
          session_name?: string
          tempo?: string | null
          updated_at?: string
          user_id: string
          week: number
        }
        Update: {
          created_at?: string
          day?: string
          details?: string
          id?: string
          session_name?: string
          tempo?: string | null
          updated_at?: string
          user_id?: string
          week?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_leaderboard: {
        Args: { filter_month?: number; filter_year: number }
        Returns: {
          avatar_url: string
          done_count: number
          is_honorary: boolean
          nickname: string
          user_id: string
        }[]
      }
      get_my_security_question_indices: {
        Args: never
        Returns: {
          question_index: number
        }[]
      }
      get_suggested_friends: {
        Args: { requesting_user_id: string }
        Returns: {
          mutual_count: number
          nickname: string
          user_id: string
        }[]
      }
      get_suggestion_nicknames: {
        Args: { user_ids: string[] }
        Returns: {
          nickname: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_jonne: { Args: never; Returns: boolean }
      process_referral: {
        Args: { referral_code_input: string }
        Returns: boolean
      }
      purchase_avatar_item: { Args: { p_item_id: string }; Returns: boolean }
      search_users_by_nickname: {
        Args: { requesting_user_id: string; search_term: string }
        Returns: {
          nickname: string
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "member"
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
      app_role: ["admin", "member"],
    },
  },
} as const
