import { createClient } from '@supabase/supabase-js';

let supabaseInstance: any = null;
let lastUsedUrl = '';
let lastUsedKey = '';

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
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: {
          getItem: (name: string) => localStorage.getItem(name),
          setItem: (name: string, value: string) => localStorage.setItem(name, value),
          removeItem: (name: string) => localStorage.removeItem(name),
        },
      },
      global: {
        headers: {
          'x-client-info': 'unitv-film',
        },
      },
    });
    lastUsedUrl = url;
    lastUsedKey = key;
    
    return supabaseInstance;
  } catch (error) {
    console.error("Failed to initialize Supabase client", error);
    return null;
  }
};

export const uploadApkToSupabase = async (file: File, type: 'normal' | 'lite'): Promise<string> => {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase client not configured");

  const fileExt = file.name.split('.').pop();
  const fileName = `unitvfilm_${type}_${Date.now()}.${fileExt}`;
  
  const { data, error } = await client.storage
    .from('apks')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.error("Erro no upload do APK:", error);
    throw error;
  }

  const { data: publicUrlData } = client.storage
    .from('apks')
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
};

export const deleteApkFromSupabase = async (fileUrl: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    // Extract the path from the URL
    // e.g. https://xxx.supabase.co/storage/v1/object/public/apks/filename.apk
    const urlObj = new URL(fileUrl);
    const pathParts = urlObj.pathname.split('/apks/');
    if (pathParts.length > 1) {
      const fileName = pathParts[1];
      const { error } = await client.storage
        .from('apks')
        .remove([fileName]);
        
      if (error) {
        console.error("Erro ao apagar APK antigo:", error);
        return false;
      }
      return true;
    }
    return false;
  } catch (e) {
    console.error("Failed to parse URL for deletion:", e);
    return false;
  }
};
