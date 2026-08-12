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

// scope:'local' clears this device's session unconditionally, without
// requiring a successful round-trip to revoke it server-side first. The
// default scope tries the server call first — if that session is already
// broken (expired/invalid refresh token, stale after being stuck a long
// time), the server call can fail and the whole signOut() rejects, leaving
// the UI stuck showing "Sign Out" with no way to actually clear it.
async function signOutUser(){
  await supabase.auth.signOut({scope:'local'});
}

async function getCurrentSession(){
  const {data:{session}}=await supabase.auth.getSession();
  return session;
}

function onAuthChange(cb){
  supabase.auth.onAuthStateChange((event,session)=>cb(event,session));
}

// ---------------- Home Screen device pairing ----------------
// A parent's already-signed-in device requests a short pairing code
// (mint-device-token); the athlete's freshly-added Home Screen icon, with
// no session of its own yet, redeems that code once (redeem-pairing-code)
// to sign itself in. After that one-time pairing, the icon just has a
// normal persistent Supabase session — the same mechanism any browser tab
// relies on — so there's nothing fragile left in day-to-day use. See
// supabase/functions/*/index.ts and 0016_pairing_code.sql for the rest of
// the design and why this replaced an earlier URL-token approach.

// Calls an Edge Function with a plain fetch() rather than
// supabase.functions.invoke() — invoke() wraps any non-2xx response in a
// generic FunctionsHttpError ("Edge Function returned a non-2xx status
// code") and, at least on the version pinned here, its `error.context`
// Response body had already been consumed internally by the time we tried
// to re-read it for the real message, so every failure surfaced as that
// same unhelpful generic text no matter what our function actually
// returned. A direct fetch() gives full, guaranteed-once control over
// reading the body, so real errors (e.g. "Sign in first.") show up as-is.
async function callEdgeFunction(name,body){
  const {data:{session}}=await supabase.auth.getSession();
  const accessToken=(session&&session.access_token)||SUPABASE_ANON_KEY;
  const res=await fetch(`${SUPABASE_URL}/functions/v1/${name}`,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':`Bearer ${accessToken}`,
      'apikey':SUPABASE_ANON_KEY,
    },
    body:JSON.stringify(body||{}),
  });
  let json=null;
  try{ json=await res.json(); }catch(e){ /* non-JSON or empty body */ }
  if(!res.ok) throw new Error((json&&json.error)||`Request failed (${res.status}).`);
  return json||{};
}

// Called from the parent's own already-signed-in device.
async function requestDevicePairingCode(deviceLabel){
  const data=await callEdgeFunction('mint-device-token',{device_label:deviceLabel||null});
  return data.code;
}

// Called from the athlete's device (no session yet) with the code the
// parent read off their own screen. Routes through Supabase's own
// verifyOtp() rather than accepting a session directly from the Edge
// Function — see redeem-pairing-code/index.ts for why. Returns the
// device_tokens row id (not a secret) so the caller can store it locally
// and use it with touchDeviceToken() going forward.
async function redeemPairingCode(code){
  const data=await callEdgeFunction('redeem-pairing-code',{code});
  // type must match how redeem-pairing-code generated the link
  // (admin.generateLink({type:'magiclink', ...})) — verifyOtp rejects the
  // hashed_token if the type here doesn't match what it was issued as.
  const {error:verifyErr}=await supabase.auth.verifyOtp({token_hash:data.hashed_token,type:'magiclink'});
  if(verifyErr) throw verifyErr;
  return data.device_token_id;
}

// Called periodically by an already-paired device using its own normal
// session (no separate secret needed) to keep its device_tokens row's
// expiry sliding forward, and to detect revocation — the RPC throws if the
// row is gone or revoked, which the caller treats as "sign this device
// out."
async function touchDeviceToken(deviceTokenId){
  const {error}=await supabase.rpc('touch_device_token',{p_device_token_id:deviceTokenId});
  if(error) throw error;
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

// Frictionless, same as age — not a PIN-gated field.
async function updateAthleteNickname(athleteId,nickname){
  const {error}=await supabase.from('athletes').update({nickname:nickname||null}).eq('id',athleteId);
  if(error) throw error;
}

// PIN-gated soft delete — see 0010_athlete_age_and_archive.sql.
async function archiveAthleteRemote(athleteId,pin){
  const {error}=await supabase.rpc('archive_athlete',{p_athlete_id:athleteId,p_pin:pin});
  if(error) throw error;
}

// ---------------- Avatar face-layer generation ----------------
// Early-access: only athlete ids on the Edge Function's ALLOWED_ATHLETE_IDS
// allowlist will succeed — everyone else gets a clean "not turned on yet"
// error back (see supabase/functions/generate-avatar-face/index.ts).
// Generation only — does NOT save to the athlete's profile. The caller
// shows the result for review, then calls saveAthleteAvatarUrl() to commit.
async function generateAvatarFaceRemote(athleteId,selfieDataUri,model,style){
  const data=await callEdgeFunction('generate-avatar-face',{
    athlete_id:athleteId,
    selfie_data_uri:selfieDataUri,
    model:model||'flux-2-pro',
    style:style||'illustrated',
  });
  return data; // {image_url, metadata}
}

// Frictionless, same as updateAthleteAge — not a PIN-gated field.
async function saveAthleteAvatarUrl(athleteId,avatarUrl){
  const {error}=await supabase.from('athletes').update({avatar_url:avatarUrl}).eq('id',athleteId);
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
  const [dailyRes, gearInvRes, gearEqRes, gearPurchRes, xpTotalRes, attrPtsRes, combineRes, questRes, rewardRes, checkpointRes, bonusRes, spinRes, arcadeGameRes]=await Promise.all([
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
    supabase.from('xp_ledger').select('*').eq('athlete_id',athleteId).eq('source','spin').order('created_at'),
    supabase.from('xp_ledger').select('*').eq('athlete_id',athleteId).eq('source','arcade_game').order('created_at')
  ]);
  [dailyRes,gearInvRes,gearEqRes,gearPurchRes,xpTotalRes,attrPtsRes,combineRes,questRes,rewardRes,checkpointRes,bonusRes,spinRes,arcadeGameRes].forEach(r=>{if(r.error) throw r.error});

  const daily=(dailyRes.data||[]).map(row=>({
    date:row.date,
    custom:row.exercise_data||{},
    programType:row.program_type,
    programId:row.program_id,
    programName:row.program_name
  }));

  const inventory=['default',...(gearInvRes.data||[]).map(r=>r.gear_item_id)];

  // Gear Locker v2 (0018_gear_locker_v2.sql) — column names match the
  // slots 1:1 except faceExtra (column face_extra), same snake_case
  // convention as the rest of this file's row mapping.
  const eq=gearEqRes.data;
  const equippedDefault={base:'default',jersey:'default',headwear:'default',hair:'default',faceExtra:'default',gear:'default',accessory:'default',border:'default',background:'default',skin:'default',badge:'default'};
  const equipped=eq?{
    base:eq.base,jersey:eq.jersey,headwear:eq.headwear,hair:eq.hair,
    faceExtra:eq.face_extra,gear:eq.gear,accessory:eq.accessory,
    border:eq.border,background:eq.background,skin:eq.skin,badge:eq.badge
  }:equippedDefault;
  const slotColors=(eq&&eq.colors)||{};

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

  // xp_ledger.note holds the game id (award_arcade_xp, 0017_*.sql) — read
  // back only so the UI can show "today's arcade game XP so far" against
  // the real server-enforced 25/day cap; state.arcadeScores/arcadeMetrics
  // (personal bests, Player Card mapping) are unrelated and stay local.
  const arcadeGameLog=(arcadeGameRes.data||[]).map(row=>({
    date:(row.created_at||'').slice(0,10),
    xp:row.amount,
    gameId:row.note
  }));

  return {daily,inventory,equipped,slotColors,gearPurchases,totalXP,attributePoints,combine,quests,claimedRewards,combineCheckpoints,bonuses,spinLog,arcadeGameLog};
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

// Unlike spin (exact value awarded or nothing), arcade game XP can be
// partially credited server-side against the 25/day cross-game cap — the
// RPC returns the actual amount credited, which the caller should display
// instead of the requested amount. Not PIN-gated, same tier as spin.
async function awardArcadeXpRemote(athleteId,gameId,xp){
  const {data,error}=await supabase.rpc('award_arcade_xp',{p_athlete_id:athleteId,p_game_id:gameId,p_xp:xp});
  if(error) throw error;
  return data;
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

// Gear Locker v2 (0018_gear_locker_v2.sql) column map — keys are the
// slot names lockerItems/gearSlotOrder use in app.js, values are the
// actual gear_equipped columns (differs only for faceExtra->face_extra).
const gearEquippedColumnBySlot={base:'base',jersey:'jersey',headwear:'headwear',hair:'hair',faceExtra:'face_extra',gear:'gear',accessory:'accessory',border:'border',background:'background',skin:'skin',badge:'badge'};
async function equipGearItemRemote(athleteId,slot,itemId){
  const column=gearEquippedColumnBySlot[slot];
  if(!column) throw new Error('unknown gear slot: '+slot);
  const {error}=await supabase.from('gear_equipped')
    .upsert({athlete_id:athleteId,[column]:itemId},{onConflict:'athlete_id'});
  if(error) throw error;
}

// colors is a single jsonb column shared across every tintable slot
// ({"jersey":"#1F7AE0","headwear":"#..."}), so this merges the one
// changed slot into the caller's already-known colors object (from
// state.slotColors) rather than reading it back first — cheap since
// there's rarely more than a couple of tintable slots equipped at once.
async function setGearColorRemote(athleteId,slot,colorHex,currentColors){
  const merged={...(currentColors||{}),[slot]:colorHex};
  const {error}=await supabase.from('gear_equipped')
    .upsert({athlete_id:athleteId,colors:merged},{onConflict:'athlete_id'});
  if(error) throw error;
  return merged;
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
