const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://ogkoirannxpnnzaencda.supabase.co', 'sb_publishable_KiLnqPD9UtH9hK5WDJsstg_Dfg5twhA');

(async () => {
  // 1. Fix adBlockFriendly: set all to false
  console.log('--- Fixing adBlockFriendly to false for all contents ---');
  const { data: updated, error: updateErr } = await s
    .from('contents')
    .update({ adBlockFriendly: false })
    .eq('adBlockFriendly', true)
    .select('id');
  
  if (updateErr) {
    console.error('Error updating adBlockFriendly:', updateErr.message);
  } else {
    console.log(`Updated ${updated?.length || 0} contents to adBlockFriendly=false`);
  }

  // 2. Verify
  const { data: verify } = await s.from('contents').select('id,"adBlockFriendly"').eq('adBlockFriendly', true);
  console.log(`Remaining with adBlockFriendly=true: ${verify?.length || 0}`);
  
  // 3. Also update the DB column default via ALTER TABLE  
  console.log('\n--- Updating column default ---');
  const { error: alterErr } = await s.rpc('exec_sql', { 
    query: `ALTER TABLE contents ALTER COLUMN "adBlockFriendly" SET DEFAULT false;` 
  });
  if (alterErr) {
    console.log('Note: Could not alter column default via RPC (expected if RPC not set up):', alterErr.message);
    console.log('The default is handled in application code instead.');
  } else {
    console.log('Column default updated to false');
  }

  console.log('\nDone!');
})();
