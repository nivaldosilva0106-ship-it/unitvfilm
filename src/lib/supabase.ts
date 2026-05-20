import { createClient } from '@supabase/supabase-js';

export const getSupabaseConfig = () => {
  const localUrl = localStorage.getItem('supabase_url');
  const localKey = localStorage.getItem('supabase_anon_key');
  
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  return {
    url: localUrl || envUrl || '',
    key: localKey || envKey || '',
    isConfigured: !!(localUrl || envUrl) && !!(localKey || envKey)
  };
};

export const isSupabaseEnabled = (): boolean => {
  return getSupabaseConfig().isConfigured;
};

export const getSupabaseClient = () => {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;
  
  if (supabaseInstance && url === lastUsedUrl && key === lastUsedKey) {
    return supabaseInstance;
  }
  
  try {
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    lastUsedUrl = url;
    lastUsedKey = key;
    
    return supabaseInstance;
  } catch (error) {
    console.error("Failed to initialize Supabase client", error);
    return null;
  }
};
