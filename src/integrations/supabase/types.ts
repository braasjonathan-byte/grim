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
      profiles: {
        Row: {
          age: number | null
          avatar_url: string | null
          created_at: string
          experience_level: string | null
          gender: string | null
          id: string
          max_distance_km: number | null
          must_change_password: boolean
          nickname: string
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
          max_distance_km?: number | null
          must_change_password?: boolean
          nickname: string
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
          max_distance_km?: number | null
          must_change_password?: boolean
          nickname?: string
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
      temp_passwords: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          temp_password: string
          used: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          temp_password: string
          used?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          temp_password?: string
          used?: boolean
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
      get_suggested_friends: {
        Args: { requesting_user_id: string }
        Returns: {
          mutual_count: number
          nickname: string
          user_id: string
        }[]
      }
      search_users_by_nickname: {
        Args: { requesting_user_id: string; search_term: string }
        Returns: {
          nickname: string
          user_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
