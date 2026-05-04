import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vkappuaapscvteexogtp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrYXBwdWFhcHNjdnRlZXhvZ3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjI1NDA5MiwiZXhwIjoyMDYxODMwMDkyfQ.niUv-xWTFnPpCwDP2p1tLAjciaLqA_miH5KrN6UF3u4'
);

const id = '2540146';
const email = 'suryachalam.vm@bsccmh.christuniversity.in';

console.log('Searching for register number:', id, 'or email:', email);

const { data, error } = await supabase
  .from('registrations')
  .select('registration_id,event_id,individual_register_number,team_leader_register_number,individual_email,team_leader_email,user_email')
  .or(`individual_register_number.eq."${id}",team_leader_register_number.eq."${id}",individual_email.eq."${email}",team_leader_email.eq."${email}",user_email.eq."${email}"`);

console.log('Error:', error);
console.log('Count:', data?.length);
console.log('Sample:', JSON.stringify(data?.slice(0, 3), null, 2));

// Also try without quotes
const { data: data2, error: error2 } = await supabase
  .from('registrations')
  .select('registration_id,event_id,individual_register_number,team_leader_register_number,individual_email,team_leader_email,user_email')
  .or(`individual_register_number.eq.${id},team_leader_register_number.eq.${id},individual_email.eq.${email},team_leader_email.eq.${email},user_email.eq.${email}`);

console.log('\nWithout quotes - Error:', error2);
console.log('Without quotes - Count:', data2?.length);
console.log('Without quotes - Sample:', JSON.stringify(data2?.slice(0, 3), null, 2));
