// Level Up Athletics — Supabase data layer (Phase B)
//
// This file owns every read/write to Supabase. app.js calls these functions
// and assigns their results onto the existing `state` object in the exact
// shapes the rating engine and render functions already expect — the goal
// is that ratings()/axisScore()/pr()/etc. in app.js never need to change.
//
// Everything still gated by the shared parentCode (combine verification,
// quest/bonus approval, coach-grade edits, reward claims, team setup) stays
// on the OLD localStorage path for now — this file only covers auth, the
// athlete/profile switcher, daily check-ins, and the Gear Locker, per the
// Phase B scope. Combine/quest/reward/team migration is Phase C/D.

const ACTIVE_ATHLETE_STORAGE_KEY='lua.activeAthleteId';

function onSupabaseReady(cb){
  if(window.supabase) cb();
  else window.addEventListener('supabase-ready', cb, {once:true});
}

// ---------------- Auth ----------------

async function sendMagicLink(email){
  const redirectTo=window.location.href.split('#')[0].split('?')[0];
  const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo}});
  if(error) throw error;
}

async function signOutUser(){
  await supabase.auth.signOut();
}

async function getCurrentSession(){
  const {data:{session}}=await supabase.auth.getSession();
  return session;
}

function onAuthChange(cb){
  supabase.auth.onAuthStateChange((event,session)=>cb(event,session));
}

// ---------------- Home Screen device tokens ----------------
// Backs the installed-icon login flow (see index.html's ?login= handling
// in app.js's tryRedeemDeviceLoginToken). Both Edge Functions are deployed
// separately in the Supabase Dashboard, not part of this static site's
// build — see supabase/functions/*/index.ts for their source and the
// deploy notes at the top of each.

// supabase.functions.invoke() wraps any non-2xx Edge Function response in a
// generic FunctionsHttpError ("Edge Function returned a non-2xx status
// code") — it does NOT surface the actual JSON body our functions return
// (e.g. {error:"Sign in first."}). error.context is the raw Response;
// read it back out so real failures are visible instead of that generic
// message.
async function extractFunctionErrorMessage(error){
  try{
    if(error&&error.context&&typeof error.context.json==='function'){
      const body=await error.context.json();
      if(body&&body.error) return body.error;
    }
  }catch(e){ /* fall through */ }
  return (error&&error.message)||'Something went wrong.';
}

async function mintDeviceToken(deviceLabel){
  const {data,error}=await supabase.functions.invoke('mint-device-token',{body:{device_label:deviceLabel||null}});
  if(error) throw new Error(await extractFunctionErrorMessage(error));
  if(data&&data.error) throw new Error(data.error);
  return data.token;
}

// Exchanges a device token for a real session. Never called with an
// existing session in mind — safe to call while fully signed out, which is
// the normal case for a freshly-opened Home Screen icon. Routes through
// Supabase's own verifyOtp() rather than accepting a session directly from
// the Edge Function — see redeem-device-token/index.ts for why.
async function redeemDeviceToken(token){
  const {data,error}=await supabase.functions.invoke('redeem-device-token',{body:{token}});
  if(error) throw new Error(await extractFunctionErrorMessage(error));
  if(data&&data.error) throw new Error(data.error);
  const {error:verifyErr}=await supabase.auth.verifyOtp({token_hash:data.hashed_token,type:'email'});
  if(verifyErr) throw verifyErr;
}

async function loadMyDevices(){
  const {data,error}=await supabase.from('device_tokens')
    .select('id, device_label, created_at, last_used_at, expires_at, revoked_at')
    .is('revoked_at',null).order('created_at',{ascending:false});
  if(error) throw error;
  return data||[];
}

async function revokeDeviceTokenRemote(id){
  const {error}=await supabase.rpc('revoke_device_token',{p_token_id:id});
  if(error) throw error;
}

// ---------------- Profile ----------------

// approval_pin_hash is column-locked (0006_pin_hardening.sql) — never
// selectable by the client, hashed or not. Both queries below list columns
// explicitly rather than `select('*')`, which would otherwise error trying
// to include a column the client has no privilege to read.
const PROFILE_COLUMNS='id, display_name, is_parent, is_coach, coach_approved, created_at';

async function fetchProfile(userId){
  const {data,error}=await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id',userId).maybeSingle();
  if(error) throw error;
  return data;
}

async function createProfile(userId,displayName,isParent,isCoach){
  const {data,error}=await supabase.from('profiles')
    .insert({id:userId,display_name:displayName,is_parent:isParent,is_coach:isCoach})
    .select(PROFILE_COLUMNS).single();
  if(error) throw error;
  return data;
}

async function hasApprovalPin(){
  const {data,error}=await supabase.rpc('has_approval_pin');
  if(error) throw error;
  return !!data;
}

async function setApprovalPinRemote(pin){
  const {error}=await supabase.rpc('set_approval_pin',{p_pin:pin});
  if(error) throw error;
}

async function changeApprovalPinRemote(oldPin,newPin){
  const {error}=await supabase.rpc('change_approval_pin',{p_old_pin:oldPin,p_new_pin:newPin});
  if(error) throw error;
}

// Client-side pre-check only — used for actions that don't otherwise carry
// an xp_ledger side effect (team setup/program edits), where RLS already
// restricts the write to the real coach and the PIN is purely the "kid on
// an already-logged-in device" mitigation. Every XP-granting action instead
// has its PIN checked INSIDE its own SECURITY DEFINER function server-side
// — this pre-check is not a substitute for that pattern.
async function verifyApprovalPinRemote(pin){
  const {data,error}=await supabase.rpc('verify_approval_pin',{p_pin:pin});
  if(error) throw error;
  return !!data;
}

// ---------------- Athletes ----------------

async function listAthletes(parentProfileId){
  const {data,error}=await supabase.from('athletes').select('*')
    .eq('parent_profile_id',parentProfileId).is('archived_at',null).order('created_at');
  if(error) throw error;
  return data||[];
}

async function createAthlete(parentProfileId,displayName,age){
  const {data,error}=await supabase.from('athletes')
    .insert({parent_profile_id:parentProfileId,display_name:displayName,age:age||null})
    .select().single();
  if(error) throw error;
  return data;
}

// Frictionless, same as creation — age isn't a PIN-gated field.
async function updateAthleteAge(athleteId,age){
  const {error}=await supabase.from('athletes').update({age}).eq('id',athleteId);
  if(error) throw error;
}

// PIN-gated soft delete — see 0010_athlete_age_and_archive.sql.
async function archiveAthleteRemote(athleteId,pin){
  const {error}=await supabase.rpc('archive_athlete',{p_athlete_id:athleteId,p_pin:pin});
  if(error) throw error;
}

function getStoredActiveAthleteId(){
  try{return localStorage.getItem(ACTIVE_ATHLETE_STORAGE_KEY)}catch{return null}
}
function setStoredActiveAthleteId(athleteId){
  try{localStorage.setItem(ACTIVE_ATHLETE_STORAGE_KEY,athleteId)}catch{}
}

// ---------------- Athlete state (read side) ----------------
// Fetches every migrated table and maps each into the exact shape app.js's
// `state` object already uses, so existing render/rating functions can
// read it unchanged. state.bonuses stays local-only even after Phase D —
// parent-awarded bonus XP has no dedicated table (it's just xp_ledger
// source='bonus' entries, which have no natural "list my bonus history"
// read need beyond the derived total already covered by athlete_xp_totals).
// state.spinLog, unlike bonuses, IS read back here (not local-only) —
// award_spin_xp (0008_spin_xp_server_side.sql) writes real xp_ledger rows
// now, so the spin history has to come from the server too or a reload
// would show a balance that doesn't match what was actually earned.
async function loadAthleteState(athleteId){
  const [dailyRes, gearInvRes, gearEqRes, gearPurchRes, xpTotalRes, attrPtsRes, combineRes, questRes, rewardRes, checkpointRes, bonusRes, spinRes]=await Promise.all([
    supabase.from('daily_check_ins').select('*').eq('athlete_id',athleteId).order('date'),
    supabase.from('gear_inventory').select('*').eq('athlete_id',athleteId),
    supabase.from('gear_equipped').select('*').eq('athlete_id',athleteId).maybeSingle(),
    supabase.from('gear_purchases').select('*').eq('athlete_id',athleteId),
    supabase.from('athlete_xp_totals').select('*').eq('athlete_id',athleteId).maybeSingle(),
    supabase.from('attribute_points_ledger').select('attribute,points').eq('athlete_id',athleteId).is('checkpoint_id',null),
    supabase.from('combine_tests').select('*').eq('athlete_id',athleteId).order('created_at'),
    supabase.from('quest_completions').select('*, quests(name,type,xp_value)').eq('athlete_id',athleteId).order('completed_at'),
    supabase.from('reward_claims').select('*, rewards(name,xp_cost,tier)').eq('athlete_id',athleteId).order('claimed_at'),
    supabase.from('combine_checkpoints').select('*').eq('athlete_id',athleteId).order('created_at'),
    supabase.from('xp_ledger').select('*').eq('athlete_id',athleteId).eq('source','bonus').order('created_at'),
    supabase.from('xp_ledger').select('*').eq('athlete_id',athleteId).eq('source','spin').order('created_at')
  ]);
  [dailyRes,gearInvRes,gearEqRes,gearPurchRes,xpTotalRes,attrPtsRes,combineRes,questRes,rewardRes,checkpointRes,bonusRes,spinRes].forEach(r=>{if(r.error) throw r.error});

  const daily=(dailyRes.data||[]).map(row=>({
    date:row.date,
    custom:row.exercise_data||{},
    programType:row.program_type,
    programId:row.program_id,
    programName:row.program_name
  }));

  const inventory=['default',...(gearInvRes.data||[]).map(r=>r.gear_item_id)];

  const eq=gearEqRes.data;
  const equipped=eq?{
    frame:eq.frame,background:eq.background,outfit:eq.outfit,
    prop:eq.prop,faceAccent:eq.face_accent,title:eq.title
  }:{frame:'default',background:'default',outfit:'default',prop:'default',faceAccent:'default',title:'default'};

  const gearPurchases=(gearPurchRes.data||[]).map(r=>({
    itemId:r.gear_item_id,xpCost:r.xp_cost,date:(r.created_at||'').slice(0,10)
  }));

  const totalXP=xpTotalRes.data?xpTotalRes.data.total_xp:0;

  const attributePoints={};
  (attrPtsRes.data||[]).forEach(r=>{
    attributePoints[r.attribute]=(attributePoints[r.attribute]||0)+r.points;
  });

  const combine=(combineRes.data||[]).map(row=>({
    id:row.id,
    week:row.week,
    verified:row.status==='verified',
    status:row.status==='verified'?'Parent Verified':'Pending Parent Review',
    programId:row.program_id,
    programName:row.program_name,
    customCombine:(row.metrics&&row.metrics.customCombine)||[]
  }));

  const quests=(questRes.data||[]).map(row=>({
    id:row.quest_id,
    title:row.quests?row.quests.name:row.quest_id,
    type:row.quests&&row.quests.type==='battle'?'Boss Battle':'Quest',
    xp:row.quests?row.quests.xp_value:0,
    notes:row.notes||'',
    date:(row.completed_at||'').slice(0,10)
  }));

  const claimedRewards=(rewardRes.data||[]).map(row=>({
    milestoneXP:row.rewards?row.rewards.xp_cost:0,
    title:row.rewards?row.rewards.name:'Reward',
    dateClaimed:(row.claimed_at||'').slice(0,10),
    approvedBy:'Parent'
  }));

  const combineCheckpoints=(checkpointRes.data||[]).map(row=>({
    date:(row.created_at||'').slice(0,10),
    overall:row.overall_rating
  }));

  // xp_ledger.note is stored as "<bonus type>: <reason>" (award_bonus_xp,
  // 0004_functions.sql) — split back apart for display. This is a read-only
  // history view; the real total already lives in athlete_xp_totals, not
  // recomputed from this array (see xp() in app.js).
  const bonuses=(bonusRes.data||[]).map(row=>{
    const sep=(row.note||'').indexOf(': ');
    return {
      date:(row.created_at||'').slice(0,10),
      type:sep>=0?row.note.slice(0,sep):(row.note||'Bonus'),
      xp:row.amount,
      reason:sep>=0?row.note.slice(sep+2):''
    };
  });

  const spinLog=(spinRes.data||[]).map(row=>({
    date:(row.created_at||'').slice(0,10),
    xp:row.amount
  }));

  return {daily,inventory,equipped,gearPurchases,totalXP,attributePoints,combine,quests,claimedRewards,combineCheckpoints,bonuses,spinLog};
}

// ---------------- Daily check-in (frictionless, Phase B) ----------------

async function submitDailyCheckIn(athleteId,date,programType,programId,programName,exerciseData,attributePointsDelta){
  const {data,error}=await supabase.rpc('log_daily_check_in',{
    p_athlete_id:athleteId,p_date:date,p_program_type:programType,p_program_id:programId,
    p_program_name:programName,p_exercise_data:exerciseData,p_attribute_points:attributePointsDelta
  });
  if(error) throw error;
  return data;
}

// ---------------- Combine testing (Phase D) ----------------

async function submitCombineTestRemote(athleteId,week,programId,programName,customCombine,pin){
  const {data,error}=await supabase.rpc('submit_combine_test',{
    p_athlete_id:athleteId,p_week:week,p_program_id:programId,p_program_name:programName,
    p_metrics:{customCombine},p_pin:pin
  });
  if(error) throw error;
  return data && data[0];
}

async function verifyCombineTestRemote(combineTestId,pin){
  const {error}=await supabase.rpc('verify_combine_test',{p_combine_test_id:combineTestId,p_pin:pin});
  if(error) throw error;
}

async function recordCombineCheckpointRemote(athleteId,combineTestId,overallRating){
  const {error}=await supabase.rpc('record_combine_checkpoint',{
    p_athlete_id:athleteId,p_combine_test_id:combineTestId,p_overall_rating:overallRating
  });
  if(error) throw error;
}

// ---------------- Quests / bonus XP / rewards (Phase D) ----------------

async function completeQuestRemote(athleteId,questId,notes,pin){
  const {error}=await supabase.rpc('complete_quest',{p_athlete_id:athleteId,p_quest_id:questId,p_notes:notes,p_pin:pin});
  if(error) throw error;
}

async function awardBonusXPRemote(athleteId,bonusType,xp,reason,pin){
  const {error}=await supabase.rpc('award_bonus_xp',{p_athlete_id:athleteId,p_bonus_type:bonusType,p_xp:xp,p_reason:reason,p_pin:pin});
  if(error) throw error;
}

// Not PIN-gated — matches the existing frictionless Prize Wheel spin flow.
async function awardSpinXpRemote(athleteId,xp){
  const {error}=await supabase.rpc('award_spin_xp',{p_athlete_id:athleteId,p_xp:xp});
  if(error) throw error;
}

// rewards.id is a server-generated uuid, unlike quests/gear_items which keep
// the app's literal string ids — the client's static rewardMilestones
// catalog only knows a reward by its xp threshold/title, so this fetches
// the real id by matching name once per claim rather than caching a
// possibly-stale catalog across a session.
async function findRewardIdByTitle(title){
  const {data,error}=await supabase.from('rewards').select('id').eq('name',title).maybeSingle();
  if(error) throw error;
  if(!data) throw new Error(`Reward "${title}" not found in the catalog — has it been seeded in Supabase?`);
  return data.id;
}

async function claimRewardRemote(athleteId,rewardId,pin){
  const {error}=await supabase.rpc('claim_reward',{p_athlete_id:athleteId,p_reward_id:rewardId,p_pin:pin});
  if(error) throw error;
}

// ---------------- Gear Locker (frictionless, Phase B) ----------------

async function buyGearItemRemote(athleteId,gearItemId){
  const {error}=await supabase.rpc('buy_gear_item',{p_athlete_id:athleteId,p_gear_item_id:gearItemId});
  if(error) throw error;
}

async function equipGearItemRemote(athleteId,slot,itemId){
  const columnBySlot={frame:'frame',background:'background',outfit:'outfit',prop:'prop',faceAccent:'face_accent',title:'title'};
  const column=columnBySlot[slot];
  if(!column) throw new Error('unknown gear slot: '+slot);
  const {error}=await supabase.from('gear_equipped')
    .upsert({athlete_id:athleteId,[column]:itemId},{onConflict:'athlete_id'});
  if(error) throw error;
}

async function completeDailyMissionRemote(athleteId,missionTitle){
  const {data,error}=await supabase.rpc('complete_daily_mission',{p_athlete_id:athleteId,p_mission_title:missionTitle});
  if(error) throw error;
  return data;
}

// ---------------- Teams (coach side, Phase C) ----------------
// A coach's Team Setup/Team Program panels operate on the coach's own
// `profiles.id`, not the current athlete — a person can be a parent and a
// coach at once, and these are separate identities in the data model.

async function loadCoachTeams(coachProfileId){
  const {data,error}=await supabase.from('teams').select('*')
    .eq('coach_profile_id',coachProfileId).order('created_at');
  if(error) throw error;
  return data||[];
}

async function createTeam(coachProfileId,name,joinCode){
  const {data,error}=await supabase.from('teams')
    .insert({coach_profile_id:coachProfileId,name,join_code:joinCode})
    .select().single();
  if(error) throw error;
  return data;
}

async function updateTeamLogo(teamId,logoDataUrl){
  const {error}=await supabase.from('teams').update({logo_url:logoDataUrl}).eq('id',teamId);
  if(error) throw error;
}

async function joinLeagueForTeam(teamId,joinCode){
  const {data,error}=await supabase.rpc('join_league',{p_team_id:teamId,p_join_code:joinCode});
  if(error) throw error;
  return data && data[0];
}

async function loadLeagueForTeam(teamId,leagueId){
  if(!leagueId) return {league:null,standings:[]};
  const [leagueRes,standingsRes]=await Promise.all([
    supabase.from('leagues').select('*').eq('id',leagueId).maybeSingle(),
    supabase.rpc('get_league_team_totals',{p_league_id:leagueId})
  ]);
  if(leagueRes.error) throw leagueRes.error;
  if(standingsRes.error) throw standingsRes.error;
  return {league:leagueRes.data,standings:standingsRes.data||[]};
}

// ---------------- Team membership (athlete side, Phase C) ----------------

async function getAthleteTeamMembership(athleteId){
  const {data,error}=await supabase.from('team_members')
    .select('*, teams(*)').eq('athlete_id',athleteId)
    .order('requested_at',{ascending:false}).limit(1).maybeSingle();
  if(error) throw error;
  return data;
}

async function requestTeamJoinForAthlete(athleteId,joinCode){
  const {error}=await supabase.rpc('request_team_join',{p_athlete_id:athleteId,p_join_code:joinCode});
  if(error) throw error;
}

async function leaveTeamRemote(athleteId,pin){
  const {error}=await supabase.rpc('leave_team',{p_athlete_id:athleteId,p_pin:pin});
  if(error) throw error;
}

// ---------------- Pending join requests (coach side, Phase C) ----------------

async function loadPendingRequestsForTeam(teamId){
  const {data,error}=await supabase.from('team_members')
    .select('*, athletes(display_name)').eq('team_id',teamId).eq('status','pending')
    .order('requested_at');
  if(error) throw error;
  return data||[];
}

async function decideTeamJoinRemote(teamMemberId,approve){
  const {error}=await supabase.rpc('decide_team_join',{p_team_member_id:teamMemberId,p_approve:approve});
  if(error) throw error;
}

async function removeTeamMemberRemote(teamId,athleteId){
  const {error}=await supabase.rpc('remove_team_member',{p_team_id:teamId,p_athlete_id:athleteId});
  if(error) throw error;
}

// ---------------- Team roster / dashboard (Phase C) ----------------
// get_team_roster() is the narrowed view — name + aggregate XP/participation
// only, never raw workout/combine records. Used for both the coach's roster
// and a teammate-parent's leaderboard view (same narrowed access for both).

async function loadTeamRoster(teamId){
  const {data,error}=await supabase.rpc('get_team_roster',{p_team_id:teamId});
  if(error) throw error;
  return data||[];
}

// Read through get_team_xp_totals/get_all_team_xp_totals_ranked (SECURITY
// DEFINER RPCs), not a direct select on the team_xp_totals view — see
// 0011_fix_team_totals_rls.sql for why the direct view read wasn't
// reliably readable as `authenticated`.
async function loadTeamXpTotals(teamId){
  const {data,error}=await supabase.rpc('get_team_xp_totals',{p_team_id:teamId});
  if(error) throw error;
  return (data&&data[0])||null;
}

async function loadAllTeamXpTotalsRanked(){
  const {data,error}=await supabase.rpc('get_all_team_xp_totals_ranked');
  if(error) throw error;
  return data||[];
}

// ---------------- Team Program (Phase C) ----------------
// Mirrors the old single-object-per-team model (state.teamProgram): one row
// per team, overwritten wholesale on each save rather than versioned.

async function loadTeamProgram(teamId){
  const {data,error}=await supabase.from('team_programs').select('*')
    .eq('team_id',teamId).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(error) throw error;
  return data;
}

async function saveTeamProgramRemote(teamId,title,activityNames,instructions,createdBy){
  const existing=await loadTeamProgram(teamId);
  if(existing){
    const {data,error}=await supabase.from('team_programs')
      .update({title,activity_names:activityNames,instructions})
      .eq('id',existing.id).select().single();
    if(error) throw error;
    return data;
  }
  const {data,error}=await supabase.from('team_programs')
    .insert({team_id:teamId,title,activity_names:activityNames,instructions,created_by:createdBy})
    .select().single();
  if(error) throw error;
  return data;
}

async function getTeamProgramOptIn(teamProgramId,athleteId){
  const {data,error}=await supabase.from('team_program_opt_ins').select('*')
    .eq('team_program_id',teamProgramId).eq('athlete_id',athleteId).maybeSingle();
  if(error) throw error;
  return !!data;
}

async function optInTeamProgramRemote(teamProgramId,athleteId){
  const {error}=await supabase.from('team_program_opt_ins')
    .insert({team_program_id:teamProgramId,athlete_id:athleteId});
  if(error) throw error;
}
