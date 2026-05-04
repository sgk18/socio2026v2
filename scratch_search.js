import { supabase } from './server/config/database.js';

const id = '2540146';
const email = 'suryachalam.vm@bsccmh.christuniversity.in';

async function testSearch() {
  console.log(`Searching for ID: ${id} or Email: ${email}`);
  
  const { data, error } = await supabase
    .from("registrations")
    .select("registration_id, event_id, individual_register_number, team_leader_register_number, individual_email, team_leader_email, user_email")
    .or(`individual_register_number.eq.${id},team_leader_register_number.eq.${id},individual_email.eq.${email},team_leader_email.eq.${email},user_email.eq.${email}`);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Results count:', data.length);
  console.log('Results:', JSON.stringify(data, null, 2));

  // Also check teammates
  const { data: teammateRegs } = await supabase
    .from("registrations")
    .select("registration_id, event_id, teammates")
    .not("teammates", "is", null);

  const matchingTeammateRegs = teammateRegs.filter(reg => {
    if (!reg.teammates) return false;
    const teammates = Array.isArray(reg.teammates) ? reg.teammates : JSON.parse(reg.teammates || '[]');
    return teammates.some(tm => 
      String(tm.registerNumber || "").toUpperCase() === id.toUpperCase() || 
      String(tm.email || "").toLowerCase() === email.toLowerCase()
    );
  });

  console.log('Teammate results count:', matchingTeammateRegs.length);
  console.log('Teammate results:', JSON.stringify(matchingTeammateRegs, null, 2));
}

testSearch();
