import { createClient } from '@supabase/supabase-js';

const materialverleihSupabaseUrl = 'https://gwntrurvxpzvcfkydjey.supabase.co';
const materialverleihAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3bnRydXJ2eHB6dmNma3lkamV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNTA4MjMsImV4cCI6MjA5OTYyNjgyM30.lholo7TOGJa4kQZNYV5MhTaA96c1iT77RYtBB5AS3E8';

const supabaseUrl = process.env.NEXT_PUBLIC_FFELM_SUPABASE_URL || materialverleihSupabaseUrl;
const supabaseAnonKey = process.env.NEXT_PUBLIC_FFELM_SUPABASE_ANON_KEY || materialverleihAnonKey;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
