import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://jbmhfxgviwgjphrnpnsd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpibWhmeGd2aXdnanBocm5wbnNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA5NjcwNTgsImV4cCI6MjA0NjU0MzA1OH0.RXvGJRFxEj_jjid3lMNavTDkmIyVOcbqWhpPWz93OKA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
