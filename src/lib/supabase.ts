import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

export const supabase = createClientComponentClient()

export type Database = {
  public: {
    Tables: {
      posts: {
        Row: {
          id: string
          user_name: string
          content: string
          image_url: string | null
          likes_count: number
          comments_count: number
          created_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          user_name: string
          content: string
          image_url?: string | null
          likes_count?: number
          comments_count?: number
          created_at?: string
          expires_at: string
        }
        Update: {
          id?: string
          user_name?: string
          content?: string
          image_url?: string | null
          likes_count?: number
          comments_count?: number
          created_at?: string
          expires_at?: string
        }
      }
      comments: {
        Row: {
          id: string
          post_id: string
          user_name: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_name: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          user_name?: string
          content?: string
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          type: "like" | "comment"
          message: string
          created_at: string
          read: boolean
        }
        Insert: {
          id?: string
          type: "like" | "comment"
          message: string
          created_at?: string
          read?: boolean
        }
        Update: {
          id?: string
          type?: "like" | "comment"
          message?: string
          created_at?: string
          read?: boolean
        }
      }
    }
    Functions: {
      increment_comments_count: {
        Args: { post_id: string }
        Returns: void
      }
    }
  }
}
