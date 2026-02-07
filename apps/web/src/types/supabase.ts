/**
 * Supabase Database Types
 * Re-exports and placeholder types matching schema.sql
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted: boolean;
        };
        Insert: Partial<Database['public']['Tables']['customers']['Row']> & { owner_id: string; name: string };
        Update: Partial<Database['public']['Tables']['customers']['Row']>;
      };
      jobs: {
        Row: {
          id: string;
          owner_id: string;
          customer_id: string;
          location_id: string | null;
          title: string;
          service_type: string | null;
          problem_description: string | null;
          status: 'scheduled' | 'in_progress' | 'completed' | 'canceled';
          scheduled_start: string | null;
          scheduled_end: string | null;
          arrived_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          internal_notes: string | null;
          customer_notes: string | null;
          diagnostics: Json;
          total_estimate_cents: number;
          total_invoice_cents: number;
          paid_cents: number;
          created_at: string;
          updated_at: string;
          deleted: boolean;
        };
        Insert: Partial<Database['public']['Tables']['jobs']['Row']> & { owner_id: string; customer_id: string; title: string };
        Update: Partial<Database['public']['Tables']['jobs']['Row']>;
      };
      call_logs: {
        Row: {
          id: string;
          owner_id: string;
          external_call_id: string;
          thread_id: string | null;
          direction: 'inbound' | 'outbound';
          from_phone: string;
          to_phone: string;
          started_at: string | null;
          ended_at: string | null;
          answered_at: string | null;
          duration_seconds: number | null;
          recording_url: string | null;
          transcript: string | null;
          summary: string | null;
          action_items: Json;
          ai_extraction: Json;
          related_job_id: string | null;
          raw_event: Json;
          created_at: string;
          updated_at: string;
          deleted: boolean;
        };
        Insert: Partial<Database['public']['Tables']['call_logs']['Row']> & { owner_id: string; external_call_id: string; direction: 'inbound' | 'outbound'; from_phone: string; to_phone: string };
        Update: Partial<Database['public']['Tables']['call_logs']['Row']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      call_direction: 'inbound' | 'outbound';
      job_status: 'scheduled' | 'in_progress' | 'completed' | 'canceled';
    };
  };
}
