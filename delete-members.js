const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteMembers() {
  const siteId = '3e8a25e8-1953-4c30-a581-9c2d62d93c35';

  console.log('Deleting all members for site:', siteId);

  const { error } = await supabase
    .from('members')
    .delete()
    .eq('site_id', siteId);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Done! All members deleted.');
  }
}

deleteMembers();
