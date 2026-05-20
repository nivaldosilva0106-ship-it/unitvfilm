const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://ogkoirannxpnnzaencda.supabase.co', 'sb_publishable_KiLnqPD9UtH9hK5WDJsstg_Dfg5twhA');

(async () => {
  const sql = `
CREATE OR REPLACE FUNCTION set_last_seen_to_server_time()
RETURNS TRIGGER AS $$
BEGIN
  -- If lastSeen is being updated/inserted, override it with current server time
  IF NEW."lastSeen" IS DISTINCT FROM OLD."lastSeen" OR (NEW."lastSeen" IS NOT NULL AND OLD."lastSeen" IS NULL) THEN
    NEW."lastSeen" := to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_last_seen ON profiles;

CREATE TRIGGER trigger_set_last_seen
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_last_seen_to_server_time();
  `;

  console.log('Running trigger SQL creation via RPC...');
  const { data, error } = await s.rpc('exec_sql', { query: sql });
  if (error) {
    console.error('Error executing SQL:', error.message);
  } else {
    console.log('Successfully created set_last_seen_to_server_time trigger! Result:', data);
  }
})();
