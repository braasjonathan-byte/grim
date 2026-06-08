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
          plan_start_date: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string
          completion_data?: Json
          id?: string
          plan_data?: Json
          plan_name?: string
          plan_start_date?: string | null
          user_id: string
        }
        Update: {
          archived_at?: string
          completion_data?: Json
          id?: string
          plan_data?: Json
          plan_name?: string
          plan_start_date?: string | null
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
      chat_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          last_read_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_groups: {
        Row: {
          created_at: string
          created_by: string
          event_group_id: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_group_id?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_group_id?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_groups_event_group_id_fkey"
            columns: ["event_group_id"]
            isOneToOne: true
            referencedRelation: "event_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          message: string | null
          message_type: string
          read: boolean
          receiver_id: string | null
          sender_id: string
          shared_workout: Json | null
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          message?: string | null
          message_type?: string
          read?: boolean
          receiver_id?: string | null
          sender_id: string
          shared_workout?: Json | null
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          message?: string | null
          message_type?: string
          read?: boolean
          receiver_id?: string | null
          sender_id?: string
          shared_workout?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_exercises: {
        Row: {
          category: string
          created_at: string
          created_by: string
          id: string
          is_bodyweight_exercise: boolean
          is_time_based: boolean
          muscle_group: string
          name: string
          secondary_muscles: Json
          submuscles: string[]
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          id?: string
          is_bodyweight_exercise?: boolean
          is_time_based?: boolean
          muscle_group?: string
          name: string
          secondary_muscles?: Json
          submuscles?: string[]
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          is_bodyweight_exercise?: boolean
          is_time_based?: boolean
          muscle_group?: string
          name?: string
          secondary_muscles?: Json
          submuscles?: string[]
        }
        Relationships: []
      }
      custom_foods: {
        Row: {
          carbs_g: number
          created_at: string
          fat_g: number
          fiber_g: number
          id: string
          kcal: number
          name: string
          protein_g: number
          user_id: string
        }
        Insert: {
          carbs_g?: number
          created_at?: string
          fat_g?: number
          fiber_g?: number
          id?: string
          kcal?: number
          name: string
          protein_g?: number
          user_id: string
        }
        Update: {
          carbs_g?: number
          created_at?: string
          fat_g?: number
          fiber_g?: number
          id?: string
          kcal?: number
          name?: string
          protein_g?: number
          user_id?: string
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
      device_push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_countdowns: {
        Row: {
          created_at: string
          end_date: string | null
          event_date: string
          event_name: string
          event_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          event_date: string
          event_name: string
          event_type?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          event_date?: string
          event_name?: string
          event_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      event_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "event_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      event_groups: {
        Row: {
          created_at: string
          created_by: string | null
          event_date: string | null
          event_end_date: string | null
          event_name: string
          event_type: string
          id: string
          is_auto: boolean
          popular_event_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_date?: string | null
          event_end_date?: string | null
          event_name: string
          event_type?: string
          id?: string
          is_auto?: boolean
          popular_event_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_date?: string | null
          event_end_date?: string | null
          event_name?: string
          event_type?: string
          id?: string
          is_auto?: boolean
          popular_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_groups_popular_event_id_fkey"
            columns: ["popular_event_id"]
            isOneToOne: false
            referencedRelation: "popular_events"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_description_reports: {
        Row: {
          created_at: string
          exercise_name: string
          exercise_name_lower: string
          id: string
          reason: string | null
          reported_by: string
          resolved: boolean
        }
        Insert: {
          created_at?: string
          exercise_name: string
          exercise_name_lower: string
          id?: string
          reason?: string | null
          reported_by: string
          resolved?: boolean
        }
        Update: {
          created_at?: string
          exercise_name?: string
          exercise_name_lower?: string
          id?: string
          reason?: string | null
          reported_by?: string
          resolved?: boolean
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
      exercise_muscle_overrides: {
        Row: {
          created_at: string
          exercise_name: string
          exercise_name_lower: string | null
          id: string
          muscle_group: string | null
          secondary_muscles: Json
          submuscles: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          exercise_name: string
          exercise_name_lower?: string | null
          id?: string
          muscle_group?: string | null
          secondary_muscles?: Json
          submuscles?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          exercise_name?: string
          exercise_name_lower?: string | null
          id?: string
          muscle_group?: string | null
          secondary_muscles?: Json
          submuscles?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      foods: {
        Row: {
          carbs_g: number
          created_at: string
          fat_g: number
          fiber_g: number
          food_number: number | null
          group_name: string | null
          id: string
          kcal: number
          name: string
          protein_g: number
        }
        Insert: {
          carbs_g?: number
          created_at?: string
          fat_g?: number
          fiber_g?: number
          food_number?: number | null
          group_name?: string | null
          id?: string
          kcal?: number
          name: string
          protein_g?: number
        }
        Update: {
          carbs_g?: number
          created_at?: string
          fat_g?: number
          fiber_g?: number
          food_number?: number | null
          group_name?: string | null
          id?: string
          kcal?: number
          name?: string
          protein_g?: number
        }
        Relationships: []
      }
      friendships: {
        Row: {
          blocked_by: string | null
          created_at: string
          friend_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          blocked_by?: string | null
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_logs: {
        Row: {
          amount: number
          carbs_g: number
          created_at: string
          custom_food_id: string | null
          fat_g: number
          food_id: string | null
          id: string
          item_name: string
          kcal: number
          log_date: string
          meal_type: string
          protein_g: number
          recipe_id: string | null
          unit: string
          user_id: string
        }
        Insert: {
          amount?: number
          carbs_g?: number
          created_at?: string
          custom_food_id?: string | null
          fat_g?: number
          food_id?: string | null
          id?: string
          item_name: string
          kcal?: number
          log_date: string
          meal_type?: string
          protein_g?: number
          recipe_id?: string | null
          unit?: string
          user_id: string
        }
        Update: {
          amount?: number
          carbs_g?: number
          created_at?: string
          custom_food_id?: string | null
          fat_g?: number
          food_id?: string | null
          id?: string
          item_name?: string
          kcal?: number
          log_date?: string
          meal_type?: string
          protein_g?: number
          recipe_id?: string | null
          unit?: string
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
      nutrition_goals: {
        Row: {
          activity_level: string
          carbs_g: number
          created_at: string
          daily_kcal: number
          fat_g: number
          goal_type: string
          id: string
          meal_slots: string[]
          protein_g: number
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_level?: string
          carbs_g?: number
          created_at?: string
          daily_kcal?: number
          fat_g?: number
          goal_type?: string
          id?: string
          meal_slots?: string[]
          protein_g?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_level?: string
          carbs_g?: number
          created_at?: string
          daily_kcal?: number
          fat_g?: number
          goal_type?: string
          id?: string
          meal_slots?: string[]
          protein_g?: number
          updated_at?: string
          user_id?: string
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
      popular_events: {
        Row: {
          city: string | null
          country: string
          end_date: string | null
          event_type: string
          id: string
          name: string
          start_date: string
        }
        Insert: {
          city?: string | null
          country?: string
          end_date?: string | null
          event_type?: string
          id?: string
          name: string
          start_date: string
        }
        Update: {
          city?: string | null
          country?: string
          end_date?: string | null
          event_type?: string
          id?: string
          name?: string
          start_date?: string
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
      pr_overrides: {
        Row: {
          created_at: string
          exercise: string
          id: string
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          exercise: string
          id?: string
          updated_at?: string
          user_id: string
          weight: number
        }
        Update: {
          created_at?: string
          exercise?: string
          id?: string
          updated_at?: string
          user_id?: string
          weight?: number
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
          height_cm: number | null
          id: string
          instagram: string | null
          is_honorary: boolean
          max_distance_km: number | null
          must_change_password: boolean
          nickname: string
          plan_start_calibrated: boolean
          plan_start_date: string | null
          protein_bars: number
          referral_code: string | null
          referred_by: string | null
          snapchat: string | null
          spotify_anthem_name: string | null
          spotify_anthem_url: string | null
          theme: string
          tiktok: string | null
          time_10km_min: number | null
          tour_completed: boolean
          tour_prompted: boolean
          training_days_per_week: number | null
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          created_at?: string
          experience_level?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          instagram?: string | null
          is_honorary?: boolean
          max_distance_km?: number | null
          must_change_password?: boolean
          nickname: string
          plan_start_calibrated?: boolean
          plan_start_date?: string | null
          protein_bars?: number
          referral_code?: string | null
          referred_by?: string | null
          snapchat?: string | null
          spotify_anthem_name?: string | null
          spotify_anthem_url?: string | null
          theme?: string
          tiktok?: string | null
          time_10km_min?: number | null
          tour_completed?: boolean
          tour_prompted?: boolean
          training_days_per_week?: number | null
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          created_at?: string
          experience_level?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          instagram?: string | null
          is_honorary?: boolean
          max_distance_km?: number | null
          must_change_password?: boolean
          nickname?: string
          plan_start_calibrated?: boolean
          plan_start_date?: string | null
          protein_bars?: number
          referral_code?: string | null
          referred_by?: string | null
          snapchat?: string | null
          spotify_anthem_name?: string | null
          spotify_anthem_url?: string | null
          theme?: string
          tiktok?: string | null
          time_10km_min?: number | null
          tour_completed?: boolean
          tour_prompted?: boolean
          training_days_per_week?: number | null
          user_id?: string
          weight_kg?: number | null
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
      ready_workout_config: {
        Row: {
          category_label: string
          created_at: string
          id: string
          is_circuit: boolean
          updated_at: string
          workout_name: string
        }
        Insert: {
          category_label: string
          created_at?: string
          id?: string
          is_circuit?: boolean
          updated_at?: string
          workout_name: string
        }
        Update: {
          category_label?: string
          created_at?: string
          id?: string
          is_circuit?: boolean
          updated_at?: string
          workout_name?: string
        }
        Relationships: []
      }
      recipes: {
        Row: {
          carbs_g_per_serving: number
          category: string | null
          created_at: string
          fat_g_per_serving: number
          id: string
          ingredients: Json
          instructions: string | null
          kcal_per_serving: number
          name: string
          protein_g_per_serving: number
          servings: number
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          carbs_g_per_serving?: number
          category?: string | null
          created_at?: string
          fat_g_per_serving?: number
          id?: string
          ingredients?: Json
          instructions?: string | null
          kcal_per_serving?: number
          name: string
          protein_g_per_serving?: number
          servings?: number
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          carbs_g_per_serving?: number
          category?: string | null
          created_at?: string
          fat_g_per_serving?: number
          id?: string
          ingredients?: Json
          instructions?: string | null
          kcal_per_serving?: number
          name?: string
          protein_g_per_serving?: number
          servings?: number
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      saved_workouts: {
        Row: {
          created_at: string
          details: string
          id: string
          name: string
          tempo: string | null
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          created_at?: string
          details: string
          id?: string
          name: string
          tempo?: string | null
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          name?: string
          tempo?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string
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
      social_post_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      social_post_images: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_url: string
          post_id: string
          sort_order: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          post_id: string
          sort_order?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          post_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "social_post_images_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          caption: string | null
          created_at: string
          group_id: string | null
          id: string
          image_url: string | null
          pinned: boolean
          user_id: string
          visibility: string
          workout_day: string | null
          workout_week: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          image_url?: string | null
          pinned?: boolean
          user_id: string
          visibility?: string
          workout_day?: string | null
          workout_week?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          image_url?: string | null
          pinned?: boolean
          user_id?: string
          visibility?: string
          workout_day?: string | null
          workout_week?: number | null
        }
        Relationships: []
      }
      strava_activities: {
        Row: {
          activity_type: string | null
          average_heartrate: number | null
          average_speed_mps: number | null
          created_at: string
          distance_km: number | null
          elapsed_time_seconds: number | null
          id: string
          max_heartrate: number | null
          moving_time_seconds: number | null
          name: string | null
          raw_activity: Json
          sport_type: string | null
          start_date: string
          strava_activity_id: number
          updated_at: string
          user_id: string
          workout_completion_id: string | null
        }
        Insert: {
          activity_type?: string | null
          average_heartrate?: number | null
          average_speed_mps?: number | null
          created_at?: string
          distance_km?: number | null
          elapsed_time_seconds?: number | null
          id?: string
          max_heartrate?: number | null
          moving_time_seconds?: number | null
          name?: string | null
          raw_activity?: Json
          sport_type?: string | null
          start_date: string
          strava_activity_id: number
          updated_at?: string
          user_id: string
          workout_completion_id?: string | null
        }
        Update: {
          activity_type?: string | null
          average_heartrate?: number | null
          average_speed_mps?: number | null
          created_at?: string
          distance_km?: number | null
          elapsed_time_seconds?: number | null
          id?: string
          max_heartrate?: number | null
          moving_time_seconds?: number | null
          name?: string | null
          raw_activity?: Json
          sport_type?: string | null
          start_date?: string
          strava_activity_id?: number
          updated_at?: string
          user_id?: string
          workout_completion_id?: string | null
        }
        Relationships: []
      }
      strava_connections: {
        Row: {
          access_token: string
          athlete_firstname: string | null
          athlete_lastname: string | null
          athlete_profile_url: string | null
          athlete_username: string | null
          created_at: string
          expires_at: string
          id: string
          last_sync_attempt_at: string | null
          last_sync_error: string | null
          last_sync_imported_count: number
          last_synced_at: string | null
          refresh_token: string
          scope: string | null
          strava_athlete_id: number
          total_imported_activities: number
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          athlete_firstname?: string | null
          athlete_lastname?: string | null
          athlete_profile_url?: string | null
          athlete_username?: string | null
          created_at?: string
          expires_at: string
          id?: string
          last_sync_attempt_at?: string | null
          last_sync_error?: string | null
          last_sync_imported_count?: number
          last_synced_at?: string | null
          refresh_token: string
          scope?: string | null
          strava_athlete_id: number
          total_imported_activities?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          athlete_firstname?: string | null
          athlete_lastname?: string | null
          athlete_profile_url?: string | null
          athlete_username?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          last_sync_attempt_at?: string | null
          last_sync_error?: string | null
          last_sync_imported_count?: number
          last_synced_at?: string | null
          refresh_token?: string
          scope?: string | null
          strava_athlete_id?: number
          total_imported_activities?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      strava_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          redirect_origin: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          redirect_origin: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          redirect_origin?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      suggestion_replies: {
        Row: {
          author_id: string
          created_at: string
          id: string
          message: string
          suggestion_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          message: string
          suggestion_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          message?: string
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_replies_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          admin_id: string | null
          created_at: string
          id: string
          is_from_admin: boolean
          message: string
          read: boolean
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          id?: string
          is_from_admin?: boolean
          message: string
          read?: boolean
          user_id: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          id?: string
          is_from_admin?: boolean
          message?: string
          read?: boolean
          user_id?: string
        }
        Relationships: []
      }
      tool_layout: {
        Row: {
          id: string
          section_order: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          section_order?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          section_order?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      triathlon_plans: {
        Row: {
          bike_km_week: number
          bike_level: string
          created_at: string
          duration_weeks: number | null
          goal_type: string
          id: string
          include_strength: boolean
          is_active: boolean
          long_session_days: string[]
          race_date: string | null
          run_km_week: number
          run_level: string
          sessions_per_week: number
          start_date: string
          swim_km_week: number
          swim_level: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bike_km_week?: number
          bike_level?: string
          created_at?: string
          duration_weeks?: number | null
          goal_type?: string
          id?: string
          include_strength?: boolean
          is_active?: boolean
          long_session_days?: string[]
          race_date?: string | null
          run_km_week?: number
          run_level?: string
          sessions_per_week?: number
          start_date?: string
          swim_km_week?: number
          swim_level?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bike_km_week?: number
          bike_level?: string
          created_at?: string
          duration_weeks?: number | null
          goal_type?: string
          id?: string
          include_strength?: boolean
          is_active?: boolean
          long_session_days?: string[]
          race_date?: string | null
          run_km_week?: number
          run_level?: string
          sessions_per_week?: number
          start_date?: string
          swim_km_week?: number
          swim_level?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      triathlon_session_logs: {
        Row: {
          created_at: string
          felt: string
          had_pain: boolean
          id: string
          notes: string | null
          pain_area: string | null
          pain_level: number | null
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          felt?: string
          had_pain?: boolean
          id?: string
          notes?: string | null
          pain_area?: string | null
          pain_level?: number | null
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          felt?: string
          had_pain?: boolean
          id?: string
          notes?: string | null
          pain_area?: string | null
          pain_level?: number | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "triathlon_session_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "triathlon_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      triathlon_sessions: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          day_of_week: string
          description: string
          discipline: string
          distance_km: number
          duration_min: number
          id: string
          intensity: string
          is_long_session: boolean
          plan_id: string
          session_date: string
          updated_at: string
          user_id: string
          week: number
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          day_of_week?: string
          description?: string
          discipline?: string
          distance_km?: number
          duration_min?: number
          id?: string
          intensity?: string
          is_long_session?: boolean
          plan_id: string
          session_date: string
          updated_at?: string
          user_id: string
          week?: number
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          day_of_week?: string
          description?: string
          discipline?: string
          distance_km?: number
          duration_min?: number
          id?: string
          intensity?: string
          is_long_session?: boolean
          plan_id?: string
          session_date?: string
          updated_at?: string
          user_id?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "triathlon_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "triathlon_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          stripe_customer_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          stripe_customer_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          stripe_customer_id?: string | null
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
          plan_id: string | null
          target_user_id: string
          week: number
        }
        Insert: {
          author_id: string
          comment: string
          created_at?: string
          day: string
          id?: string
          plan_id?: string | null
          target_user_id: string
          week: number
        }
        Update: {
          author_id?: string
          comment?: string
          created_at?: string
          day?: string
          id?: string
          plan_id?: string | null
          target_user_id?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "workout_comments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
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
          plan_id: string | null
          target_user_id: string
          user_id: string
          week: number
        }
        Insert: {
          created_at?: string
          day: string
          id?: string
          plan_id?: string | null
          target_user_id: string
          user_id: string
          week: number
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          plan_id?: string | null
          target_user_id?: string
          user_id?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "workout_likes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          created_at: string
          day: string
          details: string
          id: string
          is_circuit: boolean
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
          is_circuit?: boolean
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
          is_circuit?: boolean
          session_name?: string
          tempo?: string | null
          updated_at?: string
          user_id?: string
          week?: number
        }
        Relationships: []
      }
      workout_reminders: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          reminder_time: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          reminder_time?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          reminder_time?: string
          timezone?: string
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
      admin_merge_exercises: {
        Args: { p_from: string[]; p_to: string }
        Returns: Json
      }
      are_blocked: { Args: { _a: string; _b: string }; Returns: boolean }
      get_inactive_users_for_nudge: {
        Args: { cutoff_date: string }
        Returns: {
          user_id: string
        }[]
      }
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
      get_my_access_status: {
        Args: never
        Returns: {
          is_honorary: boolean
          must_change_password: boolean
          nickname: string
          role: Database["public"]["Enums"]["app_role"]
          theme: string
        }[]
      }
      get_my_security_question_indices: {
        Args: never
        Returns: {
          question_index: number
        }[]
      }
      get_my_strava_connection: {
        Args: never
        Returns: {
          athlete_firstname: string
          athlete_lastname: string
          athlete_profile_url: string
          athlete_username: string
          connected: boolean
          last_sync_attempt_at: string
          last_sync_error: string
          last_sync_imported_count: number
          last_synced_at: string
          total_imported_activities: number
          updated_at: string
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
      is_chat_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_chat_group_member: {
        Args: { _group_id: string; _user_id: string }
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
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
