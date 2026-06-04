const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ogkoirannxpnnzaencda.supabase.co', 'sb_publishable_KiLnqPD9UtH9hK5WDJsstg_Dfg5twhA');

(async () => {
  console.log("Fetching settings from Supabase...");
  const { data, error } = await supabase.from('settings').select('value').eq('key', 'site').single();
  if (error) {
    console.error("Error fetching settings:", error);
  } else {
    console.log("Settings fetched successfully:", JSON.stringify(data, null, 2));
  }
})();
