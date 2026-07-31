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

// ---------------- Profile ----------------

async function fetchProfile(userId){
  const {data,error}=await supabase.from('profiles').select('*').eq('id',userId).maybeSingle();
  if(error) throw error;
  return data;
}

async function createProfile(userId,displayName,isParent,isCoach){
  const {data,error}=await supabase.from('profiles')
    .insert({id:userId,display_name:displayName,is_parent:isParent,is_coach:isCoach})
    .select().single();
  if(error) throw error;
  return data;
}

// ---------------- Athletes ----------------

async function listAthletes(parentProfileId){
  const {data,error}=await supabase.from('athletes').select('*')
    .eq('parent_profile_id',parentProfileId).order('created_at');
  if(error) throw error;
  return data||[];
}

async function createAthlete(parentProfileId,displayName){
  const {data,error}=await supabase.from('athletes')
    .insert({parent_profile_id:parentProfileId,display_name:displayName})
    .select().single();
  if(error) throw error;
  return data;
}

function getStoredActiveAthleteId(){
  try{return localStorage.getItem(ACTIVE_ATHLETE_STORAGE_KEY)}catch{return null}
}
function setStoredActiveAthleteId(athleteId){
  try{localStorage.setItem(ACTIVE_ATHLETE_STORAGE_KEY,athleteId)}catch{}
}

// ---------------- Athlete state (read side) ----------------
// Fetches every table already migrated in Phase B and maps each into the
// exact shape app.js's `state` object already uses, so existing render/
// rating functions can read it unchanged. Fields NOT covered here
// (state.combine, state.quests, state.bonuses, state.claimedRewards,
// state.team, state.teamProgram) are intentionally left alone — their
// write paths are still local-only until Phase C/D migrate them, so there
// is nothing to fetch for them yet.
async function loadAthleteState(athleteId){
  const [dailyRes, gearInvRes, gearEqRes, gearPurchRes, xpTotalRes, attrPtsRes]=await Promise.all([
    supabase.from('daily_check_ins').select('*').eq('athlete_id',athleteId).order('date'),
    supabase.from('gear_inventory').select('*').eq('athlete_id',athleteId),
    supabase.from('gear_equipped').select('*').eq('athlete_id',athleteId).maybeSingle(),
    supabase.from('gear_purchases').select('*').eq('athlete_id',athleteId),
    supabase.from('athlete_xp_totals').select('*').eq('athlete_id',athleteId).maybeSingle(),
    supabase.from('attribute_points_ledger').select('attribute,points').eq('athlete_id',athleteId).is('checkpoint_id',null)
  ]);
  [dailyRes,gearInvRes,gearEqRes,gearPurchRes,xpTotalRes,attrPtsRes].forEach(r=>{if(r.error) throw r.error});

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

  return {daily,inventory,equipped,gearPurchases,totalXP,attributePoints};
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
