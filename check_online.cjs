const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://ogkoirannxpnnzaencda.supabase.co', 'sb_publishable_KiLnqPD9UtH9hK5WDJsstg_Dfg5twhA');

(async () => {
  const { data, error } = await s.from('profiles').select('*');
  if (error) {
    console.error(error);
    return;
  }
  const now = new Date();
  const threshold = 5 * 60 * 1000;
  console.log('Current system time:', now.toISOString());
  
  for (const user of data) {
    if (!user.lastSeen) continue;
    const lastSeenDate = new Date(user.lastSeen);
    const diff = now.getTime() - lastSeenDate.getTime();
    console.log(`User: ${user.email}, lastSeen: ${user.lastSeen}, diff: ${diff}ms, isOnline: ${diff < threshold}`);
  }
})();
