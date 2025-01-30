import { createClient } from '@supabase/supabase-js'

// Define our own Json type since Supabase's isn't exported
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// Types for our database schema
export interface Database {
  public: {
    Tables: {
      team: {
        Row: {
          id: string
          name: string
          github_org_id: bigint
          github_org_name: string | null
          created_at: string
          updated_at: string
        }
      }
      repo: {
        Row: {
          id: string
          name: string
          github_repo_id: string
          url: string | null
          team_id: string
          created_at: string
          updated_at: string
        }
      }
      contributor: {
        Row: {
          id: string
          name: string
          github_user_id: string
          github_login: string
          avatar_url: string | null
          cursor_email: string | null
          team_id: string
          created_at: string
          updated_at: string
        }
      }
      commit: {
        Row: {
          id: string
          github_commit_id: string
          message: string
          lines_added: number
          lines_deleted: number
          authored_at: string | null
          committed_at: string
          url: string | null
          repo_id: string
          author_id: string
          created_at: string
          updated_at: string
        }
      }
      month: {
        Row: {
          id: string
          date: string
          team_id: string
          stats: Json
          created_at: string
          updated_at: string
        }
      }
    }
  }
}

export interface Env {
  PUBLIC_SUPABASE_URL: string
  PUBLIC_SUPABASE_ANON_KEY: string
}

// Create a Supabase client with the provided env vars
export function createSupabaseClient(env: Env) {
  return createClient<Database>(
    env.PUBLIC_SUPABASE_URL,
    env.PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true
      }
    }
  )
}

// Helper function to check if an error is a Supabase error
interface SupabaseError {
  code: string
  message: string
  details: string
}

export function isSupabaseError(err: unknown): err is SupabaseError {
  return typeof err === 'object' && err !== null && 'code' in err && 'message' in err
}

// Helper to get strongly typed table names
export type Tables = keyof Database['public']['Tables'] 
