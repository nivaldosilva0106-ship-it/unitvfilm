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

let supabaseInstance: any = null;
let lastUsedUrl = '';
let lastUsedKey = '';
let isListeningToActivity = false;
let activeRefreshPromise: Promise<void> | null = null;

// Check and refresh session if expiring soon or expired
export const checkAndRefreshSession = async () => {
  if (!supabaseInstance) return;
  
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }
  
  activeRefreshPromise = (async () => {
    try {
      const { data: { session }, error } = await supabaseInstance.auth.getSession();
      if (error) {
        console.warn("Supabase session verification failed, signing out to clear expired session:", error);
        await supabaseInstance.auth.signOut();
        return;
      }
      
      if (session) {
        const expiresAt = session.expires_at; // unix timestamp in seconds
        const now = Math.floor(Date.now() / 1000);
        
        // If expired or expires in less than 5 minutes (300s), refresh it
        if (expiresAt && (expiresAt - now < 300)) {
          console.log("Supabase session expiring soon, refreshing now...");
          const { error: refreshError } = await supabaseInstance.auth.refreshSession();
          if (refreshError) {
            console.error("Failed to refresh Supabase session:", refreshError);
            await supabaseInstance.auth.signOut();
          } else {
            console.log("Supabase session refreshed successfully.");
          }
        }
      }
    } catch (err) {
      console.error("Error checking Supabase session:", err);
    } finally {
      activeRefreshPromise = null;
    }
  })();
  
  return activeRefreshPromise;
};

const setupSessionRefreshListeners = () => {
  if (isListeningToActivity || typeof window === 'undefined') return;
  isListeningToActivity = true;

  // 1. Run check every 2 minutes
  setInterval(checkAndRefreshSession, 2 * 60 * 1000);

  // 2. Run check on window focus
  window.addEventListener('focus', checkAndRefreshSession);

  // 3. Run check on visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkAndRefreshSession();
    }
  });
  
  console.log("Supabase session refresh listeners initialized.");
};

// Global query interceptor to catch JWT expiration and retry
const installQueryInterceptor = (supabase: any) => {
  try {
    // Create a dummy builder to obtain prototype (doesn't trigger network request)
    const dummyBuilder = supabase.from('profiles').select('id').limit(1);
    let proto = Object.getPrototypeOf(dummyBuilder);
    
    // Traverse prototype chain to find where the 'then' method is located
    while (proto && !proto.hasOwnProperty('then')) {
      proto = Object.getPrototypeOf(proto);
    }
    
    if (proto && proto.then && !proto.then.__wrapped) {
      const originalThen = proto.then;
      proto.then = function(onfulfilled: any, onrejected: any) {
        const self = this;
        return originalThen.call(self).then(
          (result: any) => {
            if (result && result.error && 
                (result.error.message?.includes('JWT') || 
                 result.error.message?.includes('expired') || 
                 result.error.code === 'PGRST301' || 
                 result.error.status === 401)) {
              console.warn("Supabase JWT expired or unauthorized detected in query builder, attempting silent session refresh and retry...");
              return checkAndRefreshSession().then(() => {
                // Retry the query once with refreshed session
                return originalThen.call(self, onfulfilled, onrejected);
              });
            }
            return onfulfilled ? onfulfilled(result) : result;
          }
        ).catch((error: any) => {
          return onrejected ? onrejected(error) : Promise.reject(error);
        });
      };
      proto.then.__wrapped = true;
      console.log("Supabase query auto-retry interceptor installed successfully.");
    }
  } catch (err) {
    console.warn("Failed to install Supabase query interceptor:", err);
  }
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
    
    // Install global query interceptor
    installQueryInterceptor(supabaseInstance);
    
    // Setup listeners on client creation
    setupSessionRefreshListeners();
    // Run initial check in background
    checkAndRefreshSession().catch(console.error);
    
    return supabaseInstance;
  } catch (error) {
    console.error("Failed to initialize Supabase client", error);
    return null;
  }
};
