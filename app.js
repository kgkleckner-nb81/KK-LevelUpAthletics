const KEY='ethansBaseballHQ.logoParent.v1';
const defaults={athleteName:'Ethan',daily:[],combine:[],quests:[],bonuses:[],claimedRewards:[],inventory:['default'],equipped:{frame:'default',background:'default',outfit:'default',prop:'default',faceAccent:'default',title:'default'},gearPurchases:[],shoutouts:[],gameScores:{reaction:null,strike:0,homer:0},gameXP:{date:'',xp:0},rainTokens:1,spinLog:[],arcadeDaily:{date:'',spinsUsed:0,spinsAvailable:1,triviaAnswered:false,triviaCorrect:null,triviaSelected:null},programs:[],activeProgramId:null,draftProgram:null,presetsSeeded:false,teamProgram:null,teamProgramOptIn:false,currentTierIndex:0,combineCheckpoints:[],team:null,teamIdentityJoined:false,arcadeScores:{homeRunHero:{best:0,lastPlayed:null},webGem:{best:0,bestReaction:null,lastPlayed:null},clutchCatch:{best:0,lastPlayed:null}},arcadeMetrics:{homeRunHero:0,webGem:0,clutchCatch:0},attributePoints:{}};
let state=load();
// account-layer equivalent of `state` — WHO is signed in and WHICH athlete
// is selected, not athlete data itself (see refreshAthleteState()). Declared
// here, at the very top, because render()/renderPlayerCardHero() read
// activeAthlete and the first boot-time render() call happens well before
// the old Phase B section further down — a `let` there left activeAthlete
// in the temporal dead zone at that first call and crashed the whole boot
// script silently.
let currentSession=null;
let currentProfile=null;
let currentAthletes=[];
let activeAthlete=null;
function load(){try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return defaults}}
// Arcade gameplay state (spins-used-today, trivia-answered-today, daily
// game XP cap, best scores, rain tokens) is local-only (Arcade was
// deliberately kept out of the Supabase schema) but IS per-athlete — two
// siblings signed into the same parent account on the same device must not
// share "already spun today." Stored under its own per-athlete localStorage
// key and swapped in/out on selectAthlete(), separate from the rest of
// `state`, which stays one shared blob per browser (workout-builder
// programs etc. are fine to share across siblings on one device).
const ARCADE_LOCAL_FIELDS=['arcadeScores','arcadeMetrics','gameScores','gameXP','rainTokens','arcadeDaily'];
function arcadeStorageKey(athleteId){return KEY+'.arcade.'+athleteId}
function loadArcadeStateFor(athleteId){
  try{
    const raw=localStorage.getItem(arcadeStorageKey(athleteId));
    return raw?JSON.parse(raw):null;
  }catch{return null}
}
function saveArcadeStateFor(athleteId){
  if(!athleteId) return;
  const snap={};
  ARCADE_LOCAL_FIELDS.forEach(k=>snap[k]=state[k]);
  localStorage.setItem(arcadeStorageKey(athleteId),JSON.stringify(snap));
}
function save(){
  localStorage.setItem(KEY,JSON.stringify(state));
  if(activeAthlete) saveArcadeStateFor(activeAthlete.id);
}
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const metricNames={pushups:'Push-ups',squats:'Squats',plank:'Plank seconds',crunches:'Sit Ups',broadJumps:'Broad jumps',shuffleTouches:'Lateral shuffle touches',skaterJumps:'Skater jumps',sprints:'Sprints'};
const combineNames={maxPushups:'Max push-ups',squat60:'Squats in 60 sec',plankMax:'Longest plank',broadJumpIn:'Broad jump',sprintSec:'20-yard sprint'};

const quests=[
  {id:'daily-double',type:'Quest',icon:'⚾',title:'Daily Double',desc:'Complete two short workouts in one day.',xp:40},
  {id:'gold-glove',type:'Quest',icon:'🧤',title:'Gold Glove Drill',desc:'Complete 50 lateral shuffle touches.',xp:35},
  {id:'base-stealer',type:'Quest',icon:'🏃',title:'Base Stealer Bonus',desc:'Complete 10 total 20-yard sprints.',xp:40},
  {id:'iron-core',type:'Quest',icon:'🧱',title:'Iron Core',desc:'Hold a plank for 60 seconds.',xp:45},
  {id:'power-hitter',type:'Quest',icon:'💥',title:'Power Hitter',desc:'Complete 15 broad jumps with good form.',xp:45},
  {id:'dad-challenge',type:'Quest',icon:'👨‍👦',title:'Dad Challenge',desc:'Beat Dad in one approved challenge.',xp:60},
  {id:'fastball-monster',type:'Boss Battle',icon:'👹',title:'Fastball Monster',desc:'15 push-ups, 45-sec plank, and 40 squats.',xp:100},
  {id:'base-dragon',type:'Boss Battle',icon:'🐉',title:'Base-Stealing Dragon',desc:'8 sprints and 40 shuffle touches.',xp:100},
  {id:'spartan-trial',type:'Boss Battle',icon:'⚔️',title:'Spartan Trial',desc:'Reach 60+ overall and complete a verified combine.',xp:125},
  {id:'brewers-callup',type:'Boss Battle',icon:'🔵',title:'Brewers Call-Up',desc:'Reach Brewers Prospect tier.',xp:175}
];

// Tier labels reuse the same common/uncommon/rare/legendary "prize-giveaway
// hierarchy" language as the Arcade wheel's weighted tiers, just applied to
// reward spacing instead of wheel wedge size.
const rewardMilestones=[
  {xp:250,title:'Ice Cream Single',icon:'🍦',desc:'Small surprise reward.',tier:'Common'},
  {xp:500,title:'Batting Cage Trip',icon:'🥎',desc:'Parent-approved cage session or dad pitching session.',tier:'Common'},
  {xp:750,title:'New Baseball Bonus',icon:'⚾',desc:'New baseball, eye black, or small gear item.',tier:'Uncommon'},
  {xp:1000,title:'Baseball Store Visit',icon:'🧢',desc:'Trip to pick a small baseball item.',tier:'Uncommon'},
  {xp:1500,title:'"The Show" Award',icon:'🔵',desc:'Favorite team themed surprise.',tier:'Rare'},
  {xp:2000,title:'All-Star Outing',icon:'🏟️',desc:'Special baseball outing idea.',tier:'Rare'},
  {xp:3000,title:'MVP Surprise',icon:'🏆',desc:'Big end-of-season reward.',tier:'Legendary'}
];
const bonusXPValues={
  'Great Effort Bonus':25,
  'Sportsmanship Bonus':50,
  'Helping Teammate Bonus':50,
  'Coach Compliment Bonus':100,
  'Parent Wild Card':75,
  // Replaces the old per-axis 1-10 coach grade that used to feed the rating
  // math invisibly — a coach recognizing real performance/effort is now an
  // explicit, visible, one-off award instead of a hidden multiplier.
  "Coach's Boost":100
};

// Round 5: sport-agnostic, non-trademarked six-tier ladder. Actual promotion
// between tiers is gated (see evaluatePromotion()) rather than being a pure
// function of `min` — `min` here is only the rating component of that gate,
// kept alongside the name for renderPathToNextTier()'s "next tier" lookup.
const tiers=[{name:'Rookie',min:0},{name:'Grinder',min:55},{name:'Baller',min:65},{name:'All-Star',min:75},{name:'Elite',min:85},{name:'Legend',min:93}];
// Real artwork is being sourced separately per tier — this is a swappable
// slot lookup, not placeholder art. Missing files fall back to a plain
// colored badge (see tierBadgeHTML) with zero code changes once files land.
const tierBadges={Rookie:'assets/tier-rookie.png',Grinder:'assets/tier-grinder.png',Baller:'assets/tier-baller.png','All-Star':'assets/tier-allstar.png',Elite:'assets/tier-elite.png',Legend:'assets/tier-legend.png'};
// Round 13 item 13: Body Control's benchmark is new — Single-Leg Balance
// hold, seconds, same duration-metric shape as Plank. Starting tiers only
// (no prior benchmark data existed for this axis) — flagged for re-tuning
// with real data alongside the promotion-gate thresholds (see item 15).
const benches={pushups:[5,10,15,20,30],squats:[15,25,40,60,80],plank:[20,30,45,60,90],shuffleTouches:[20,30,40,50,60],skaterJumps:[10,20,30,40,50],broadJumpIn:[40,50,60,70,80],sprintSec:[4.5,4.2,4.0,3.8,3.6],singleLegBalanceSec:[15,25,40,60,90]};

$$('.tab').forEach(b=>b.onclick=()=>switchScreen(b.dataset.screen));
function modeForScreen(id){
  if(['clubhouse','daily','player','combine','quests','charts','library','rewards'].includes(id)) return 'athlete';
  if(['team','league'].includes(id)) return 'team';
  if(id==='arcade') return 'arcade';
  if(id==='parent') return 'parent';
  return 'home';
}
function showModeNav(mode){
  // Round 14: active-state icon color now cascades from the button's own
  // .active class via plain CSS descendant selectors (.mode-btn.active
  // .lua-icon), so no separate icon-level class to toggle here anymore.
  $$('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  ['athlete','team','arcade','parent'].forEach(m=>{
    const el=$('#'+m+'Subnav'); if(el) el.classList.toggle('hidden',m!==mode);
  });
}
function switchScreen(id){
  const mode=modeForScreen(id);
  showModeNav(mode);
  $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.screen===id));
  $$('.screen').forEach(s=>s.classList.toggle('active',s.id===id));
  window.scrollTo({top:0,behavior:'smooth'});
  render();
  // Team membership/program data is cached (athleteTeamMembership,
  // currentTeamProgram) and only refetched at sign-in/athlete-select/join
  // actions — stale if a coach approval or program save happened elsewhere
  // in the same session without a reload. Refetch on landing on any screen
  // that displays it, so it can't silently show stale data.
  if(['team','clubhouse','daily'].includes(id)&&typeof refreshTeamMembershipUI==='function'&&activeAthlete) refreshTeamMembershipUI();
  // League HQ needs its own fetch (league standings aren't part of the
  // athlete-state refresh) — only on navigating there, not on every render().
  if(id==='league'&&typeof renderLeagueHQ==='function') renderLeagueHQ();
  // Same staleness class as team membership above: pending join requests
  // are only fetched at sign-in or right after the coach's own actions, so
  // a request submitted by a second athlete mid-session stayed invisible
  // until a full reload. Refetch on landing on Coach/Parent Corner too.
  if(id==='parent'&&coachTeam&&typeof renderPendingTeamRequests==='function') renderPendingTeamRequests();
}
function enterMode(mode){
  if(mode==='home') switchScreen('home');
  if(mode==='athlete') switchScreen('clubhouse');
  if(mode==='team') switchScreen('team');
  if(mode==='arcade'){
    // Round 8: each arcade game's per-session difficulty ramp (Home Run
    // Hero's pitch speed, Web Gem's delay/size, Clutch Catch's in-progress
    // round) resets on a fresh visit to Arcade, not on every re-render.
    resetHomerSession();resetWebGemSession();resetClutchSession();
    switchScreen('arcade');
  }
  if(mode==='parent') switchScreen('parent');
}
$$('.mode-btn').forEach(b=>b.onclick=()=>enterMode(b.dataset.mode));
$$('[data-path]').forEach(b=>b.onclick=()=>enterMode(b.dataset.path));
$$('[data-home-button]').forEach(b=>b.onclick=()=>enterMode('home'));
if($('#dailyForm').date) $('#dailyForm').date.valueAsDate=new Date();
// Round 3: every activity has exactly one metric, so a single field holds its
// value (combine) or a list of per-set fields holds its values (daily/team —
// see collectActivitySets). Returns null if the field was left blank.
function collectMetricValue(fieldName,d,a){
  const raw=d[fieldName];
  delete d[fieldName];
  if(raw===undefined||raw==='') return null;
  const value=a.metric.inputType==='decimal'?parseFloat(raw):+raw;
  return Number.isNaN(value)?null:value;
}
function collectActivitySets(prefix,d,a,setCount){
  const sets=[];
  for(let i=0;i<setCount;i++){
    const value=collectMetricValue(`${prefix}_${a.id}_${i}`,d,a);
    if(value!=null) sets.push({[a.metric.key]:value});
  }
  return sets;
}
$('#dailyForm').onsubmit=async e=>{
  e.preventDefault();
  if(!activeAthlete){alert('Sign in and select an athlete before logging a workout.');return}
  const d=Object.fromEntries(new FormData(e.target).entries());
  const custom={};
  const prog=findProgram(state.activeProgramId);
  const programId=prog?prog.id:null;
  const programName=prog?prog.name:null;
  (prog?prog.activityIds:[]).forEach(actId=>{
    const a=findActivityById(actId);
    if(!a) return;
    const sets=collectActivitySets('set',d,a,dailySetCounts[actId]||1);
    if(sets.length) custom[a.name]={sets};
  });
  try{
    await submitDailyCheckIn(activeAthlete.id,d.date||todayISO(),'personal',programId,programName,custom,computeAttributePointsDelta(custom));
  }catch(err){
    alert('Could not save workout: '+(err.message||'unknown error'));
    return;
  }
  await refreshAthleteState();
  e.target.reset();
  $('#dailyForm').date.valueAsDate=new Date();
  dailySetCounts={};
  renderDailyCustomFields();
  render();
};
$('#combineForm').onsubmit=async e=>{
  e.preventDefault();
  if(!activeAthlete){alert('Sign in and select an athlete before submitting a combine test.');return}
  const d=Object.fromEntries(new FormData(e.target).entries());
  const week=d.week;
  const chosen=combineProgramOptions().find(o=>o.id===d.combineProgram);
  const customCombine=[];
  (chosen?chosen.activities:[]).forEach(a=>{
    const value=collectMetricValue(`combineProgram_${a.id}_${a.metric.key}`,d,a);
    if(value!=null) customCombine.push({name:a.name,values:{[a.metric.key]:value}});
  });
  const pin=await showPinModal('verify this combine test now — or close this without a PIN to save it as pending for later approval');
  let result;
  try{
    result=await submitCombineTestRemote(activeAthlete.id,week,chosen?chosen.id:null,chosen?chosen.name:null,customCombine,pin);
  }catch(err){
    alert('Could not save combine test: '+(err.message||'unknown error'));
    return;
  }
  await refreshAthleteState();
  // Item 9: promotion is only re-evaluated when a VERIFIED Combine is saved
  // (not on every render), and only verified results ever become
  // checkpoints — a pending/unverified test can't confirm a tier. The
  // checkpoint's rating snapshot is computed here, client-side, with the
  // just-verified test already reflected in state — see
  // record_combine_checkpoint's SQL comment for why this isn't done
  // server-side.
  if(result.status==='verified'){
    try{
      await recordCombineCheckpointRemote(activeAthlete.id,result.id,ratings().overall);
      await refreshAthleteState();
    }catch(err){
      console.error('Could not record combine checkpoint',err);
    }
    evaluatePromotion();
    save();
  }
  alert(result.status==='verified'?'Combine test saved and verified.':'Saved as pending. Approve it later from Coach/Parent Corner.');
  e.target.reset();
  render();
};
// Quests/boss battles reset weekly (calendar week, Monday start) rather than
// being repeatable indefinitely.
function weekStartISO(dateStr){
  const d=new Date((dateStr||todayISO())+'T00:00:00Z');
  const day=d.getUTCDay();
  d.setUTCDate(d.getUTCDate()+(day===0?-6:1-day));
  return d.toISOString().slice(0,10);
}
function questCompletedThisWeek(id){
  const wk=weekStartISO(todayISO());
  return (state.quests||[]).some(x=>x.id===id&&weekStartISO(x.date)===wk);
}
if($('#teamProgramLogForm')?.date) $('#teamProgramLogForm').date.valueAsDate=new Date();
$('#teamProgramLogForm').onsubmit=async e=>{
  e.preventDefault();
  if(!activeAthlete){alert('Sign in and select an athlete before logging a team check-in.');return}
  const d=Object.fromEntries(new FormData(e.target).entries());
  const custom={};
  const programName=currentTeamProgram?currentTeamProgram.title:null;
  (currentTeamProgram?.activity_names||[]).forEach(name=>{
    const a=findActivity(name);
    if(!a) return;
    const sets=collectActivitySets('teamset',d,a,teamSetCounts[a.id]||1);
    if(sets.length) custom[a.name]={sets};
  });
  // The 50 XP team-program bonus fires server-side (log_daily_check_in RPC)
  // only when custom is non-empty and only once per day — same gate as before.
  try{
    await submitDailyCheckIn(activeAthlete.id,d.date||todayISO(),'team','team',programName,custom,computeAttributePointsDelta(custom));
  }catch(err){
    alert('Could not save check-in: '+(err.message||'unknown error'));
    return;
  }
  await refreshAthleteState();
  e.target.reset();
  $('#teamProgramLogForm').date.valueAsDate=new Date();
  teamSetCounts={};
  renderTeamProgramLogFields();
  render();
};
$('#questForm').onsubmit=async e=>{
  e.preventDefault();
  if(!activeAthlete){alert('Sign in and select an athlete first.');return}
  const d=Object.fromEntries(new FormData(e.target).entries());
  const q=quests.find(x=>x.id===d.questId);
  if(!q){alert('Select a quest.');return}
  if(questCompletedThisWeek(q.id)){alert(`${q.title} was already completed this week. It resets next Monday.`);return}
  const pin=await showPinModal('approve this quest/battle and award XP');
  if(!pin) return;
  try{
    await completeQuestRemote(activeAthlete.id,q.id,d.notes||'',pin);
  }catch(err){
    alert('Could not award quest XP: '+(err.message||'unknown error'));
    return;
  }
  await refreshAthleteState();
  alert(`${q.title} complete! +${q.xp} XP awarded.`);
  e.target.reset();
  render();
};

$('#approvePending').onclick=async()=>{
  if(!activeAthlete){alert('Sign in and select an athlete first.');return}
  const pending=(state.combine||[]).filter(x=>!x.verified);
  if(!pending.length){alert('No pending combine tests.');return}
  const pin=await showPinModal('approve all pending combine tests');
  if(!pin) return;
  try{
    for(const entry of pending) await verifyCombineTestRemote(entry.id,pin);
  }catch(err){
    alert('Could not approve pending tests: '+(err.message||'unknown error'));
  }
  await refreshAthleteState();
  render();
};
$('#bonusForm').onsubmit=async e=>{
  e.preventDefault();
  if(!activeAthlete){alert('Sign in and select an athlete first.');return}
  const d=Object.fromEntries(new FormData(e.target).entries());
  const xpValue=bonusXPValues[d.bonusType]||0;
  const pin=await showPinModal('award this bonus XP');
  if(!pin) return;
  try{
    await awardBonusXPRemote(activeAthlete.id,d.bonusType,xpValue,d.reason||'',pin);
  }catch(err){
    alert('Could not award bonus XP: '+(err.message||'unknown error'));
    return;
  }
  await refreshAthleteState();
  alert(`${d.bonusType} awarded! +${xpValue} XP.`);
  e.target.reset();
  render();
};

$('#exerciseSelect').onchange=renderCharts;$('#combineMetricSelect').onchange=renderCharts;
// Phase D: athlete data (workouts, combine tests, quests, rewards, gear,
// team) lives in Supabase now, not this device's localStorage blob — so
// Backup/Reset only covers the fields that are genuinely still local-only
// (draft training programs, Arcade scores/session state). Exporting or
// resetting `state` wholesale would touch fields that get silently
// overwritten by the next refreshAthleteState() call anyway.
const LOCAL_ONLY_FIELDS=['programs','activeProgramId','draftProgram','presetsSeeded','arcadeScores','arcadeMetrics','gameScores','gameXP','rainTokens','arcadeDaily'];
$('#exportData').onclick=()=>{
  const localState={};
  LOCAL_ONLY_FIELDS.forEach(k=>{localState[k]=state[k]});
  const blob=new Blob([JSON.stringify(localState,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='level-up-athletics-local-backup.json';
  a.click();
};
$('#importData').onchange=e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const imported=JSON.parse(r.result);
      LOCAL_ONLY_FIELDS.forEach(k=>{if(imported[k]!==undefined) state[k]=imported[k]});
      save();
      render();
    }catch{alert('Could not import file')}
  };
  r.readAsText(f);
};
$('#resetData').onclick=()=>{
  if(!confirm('Reset local device settings (draft training programs, Arcade scores)? This does not affect anything saved to your account.')) return;
  state.programs=[];
  state.activeProgramId=null;
  state.draftProgram=null;
  state.presetsSeeded=false;
  state.arcadeScores={homeRunHero:{best:0,lastPlayed:null},webGem:{best:0,bestReaction:null,lastPlayed:null},clutchCatch:{best:0,lastPlayed:null}};
  state.arcadeMetrics={homeRunHero:0,webGem:0,clutchCatch:0};
  state.gameScores={reaction:null,strike:0,homer:0};
  state.gameXP={date:'',xp:0};
  state.rainTokens=1;
  state.spinLog=[];
  state.arcadeDaily={date:'',spinsUsed:0,spinsAvailable:1,triviaAnswered:false,triviaCorrect:null,triviaSelected:null};
  save();
  render();
};

function max(arr){return Math.max(0,...arr.map(x=>+x||0))}
function minPos(arr){const v=arr.map(Number).filter(x=>x>0);return v.length?Math.min(...v):0}
// Round 3: every core stat now comes from the unified activity catalog via
// bestActivityValue(), which already merges daily + verified-combine logs
// (both current-shape and legacy flat-field data). Key names are kept
// identical to the pre-Round-3 shape so score()/ratings()/render()'s use of
// pr() didn't need to change beyond this function.
function pr(){
  return {
    pushups:bestActivityValue('Push-ups'),
    squats:bestActivityValue('Squats'),
    plank:bestActivityValue('Plank'),
    shuffleTouches:bestActivityValue('Lateral Shuffle'),
    skaterJumps:bestActivityValue('Skater Jumps'),
    broadJumpIn:bestActivityValue('Broad Jump'),
    sprintSec:bestActivityValue('20-yard Sprint'),
    singleLegBalanceSec:bestActivityValue('Single-Leg Balance')
  };
}
// Round 5: continuous replacement for the old discrete 5-tier snap (which
// jumped in chunks of 8+ and left benches[0] functionally unreachable — see
// git history). Every bench point is now a real, distinct breakpoint:
// v=0 anchors at 30 (floor), each benches[k][i] anchors at scorePoints[i+1],
// and values between/beyond breakpoints interpolate or extrapolate linearly
// off the nearest segment's slope, capped at 92. sprintSec (lower=better) is
// handled by negating both the value and its benchmarks rather than a
// hardcoded special case, which also fixes the old top-score inconsistency
// (sprint alone topped out at 92 while everything else capped at 84).
const lowerIsBetterBenchKeys=new Set(['sprintSec']);
const scorePoints=[50,60,68,76,84];
function score(v,k){
  const raw=benches[k]||[5,10,15,20,30];
  const lower=lowerIsBetterBenchKeys.has(k);
  const val=+v||0;
  const thresholds=lower?raw.map(n=>-n):raw;
  const x=lower?-val:val;
  if(x<=thresholds[0]){
    const slope=(scorePoints[1]-scorePoints[0])/(thresholds[1]-thresholds[0]);
    return Math.round(Math.max(30,scorePoints[0]+slope*(x-thresholds[0])));
  }
  for(let i=0;i<thresholds.length-1;i++){
    if(x<=thresholds[i+1]){
      const t=(x-thresholds[i])/(thresholds[i+1]-thresholds[i]);
      return Math.round(scorePoints[i]+(scorePoints[i+1]-scorePoints[i])*t);
    }
  }
  const slope=(scorePoints[4]-scorePoints[3])/(thresholds[4]-thresholds[3]);
  return Math.round(Math.min(92,scorePoints[4]+slope*(x-thresholds[4])));
}
// "No data logged at all" is handled here (neutral 50), not inside score()
// itself, so a genuinely low-but-real value still scores below a never-tried
// one instead of the two colliding at the same floor.
function scoreOrBaseline(v,k){return v>0?score(v,k):50}
// Round 13 item 1: six performance axes, 1:1 with Skill Lab categories
// except Balance+Coordination which both roll into one Body Control axis
// (Kurt's decision — not kept as two separate rated axes). Mobility stays
// untracked, same as before this round.
const performanceAxisOrder=['strength','speed','quickness','jumpPower','core','bodyControl'];
const axisLabels={strength:'Strength',speed:'Speed',quickness:'Quickness',jumpPower:'Jump/Power',core:'Core',bodyControl:'Body Control',consistency:'Consistency'};
// Which activity(ies) feed each performance axis's benches-keyed stat.
// Plank moved off Strength onto Core, where it actually belongs now that
// Core is its own rated axis — Strength keeps Push-ups/Squats.
const axisStatNames={strength:[['Push-ups','pushups'],['Squats','squats']],speed:[['20-yard Sprint','sprintSec']],quickness:[['Skater Jumps','skaterJumps'],['Lateral Shuffle','shuffleTouches']],jumpPower:[['Broad Jump','broadJumpIn']],core:[['Plank','plank']],bodyControl:[['Single-Leg Balance','singleLegBalanceSec']]};
// Round 13 item 4: which Skill Lab attribute name(s) (from Round 9's
// per-exercise weight map, state.attributePoints) feed each axis's
// completion component. Balance+Coordination both feed bodyControl,
// matching categoryAxisMap's many-to-one mapping below.
const axisAttributeMap={strength:['Strength'],speed:['Speed'],quickness:['Quickness'],jumpPower:['Jump'],core:['Core'],bodyControl:['Balance','Coordination']};
// Round 13 originally blended a third, optional coach-grade (1-10) input in
// here at ~28% weight. Removed per a later product decision: it was opaque
// (the Player Card deliberately never explains its own math, so a parent
// had no way to see why a grade moved a number), added a per-test chore for
// coaches, and baked subjective judgment invisibly into a number presented
// as objective performance. A coach's input is now the explicit, visible
// "Coach's Boost" bonus (Parent Bonus XP form) instead — same pattern as
// every other bonus type, not a hidden multiplier.
// These two weights are exactly what a missing coach grade already
// redistributed onto in the old 3-input formula (0.60/0.72, 0.12/0.72) —
// so removing the third input changes no existing rating's math, it just
// makes the always-true case the only case.
const AXIS_COMBINE_WEIGHT=5/6, AXIS_COMPLETION_WEIGHT=1/6;
// Points of (post-checkpoint-reset) attributePoints needed for full
// completion credit — tunable starting point, same spirit as the bench
// tiers above.
const COMPLETION_CAP_POINTS=40;
function combineComponentScore(axis){
  const stats=axisStatNames[axis];
  const total=stats.reduce((sum,[name,benchKey])=>sum+scoreOrBaseline(latestVerifiedCombineValue(name),benchKey),0);
  return total/stats.length;
}
// Repurposes state.attributePoints (Round 9 built this as an inert display
// tally with a hard constraint against ever reaching ratings() — that
// constraint is removed per this round) into a real, capped scoring input.
// Resets each checkpoint (see recordCombineCheckpoint), so this reflects
// completion since the last verified Combine, not a lifetime tally.
function completionScore(axis){
  const attrs=axisAttributeMap[axis]||[];
  const pts=attrs.reduce((sum,a)=>sum+((state.attributePoints||{})[a]||0),0);
  const pct=Math.min(1,pts/COMPLETION_CAP_POINTS);
  return 50+pct*49;
}
function axisScore(axis){
  const combineComp=combineComponentScore(axis);
  const completionComp=completionScore(axis);
  return Math.round(combineComp*AXIS_COMBINE_WEIGHT+completionComp*AXIS_COMPLETION_WEIGHT);
}
// Item 2/8: Teamwork Skill Lab completions don't get their own axis — they
// nudge Consistency instead, capped the same "small, non-dominant" way the
// old Daily Check-in input was capped.
function teamworkCompletionCount(){
  let count=0;
  state.daily.forEach(entry=>{
    if(!entry.custom) return;
    Object.keys(entry.custom).forEach(name=>{
      const a=findActivity(name);
      if(a&&a.category==='Teamwork'&&hasLoggedAny(entry.custom[name])) count++;
    });
  });
  return count;
}
function ratings(){
  // Item 1: Consistency is purely engagement (workout count + streak) plus
  // a small capped Teamwork nudge (item 8) — no XP input.
  const consistency=Math.min(99,50+state.daily.length*2+streak()*3+Math.min(8,teamworkCompletionCount()));
  const axisScores={};
  performanceAxisOrder.forEach(axis=>{
    axisScores[axis]=Math.min(99,axisScore(axis)+combineImprovementBonus(axis));
  });
  const overall=Math.round((performanceAxisOrder.reduce((sum,axis)=>sum+axisScores[axis],0)+consistency)/(performanceAxisOrder.length+1));
  return{...axisScores,consistency,overall};
}
function streak(){const dates=[...new Set(state.daily.map(x=>x.date).filter(Boolean))].sort().reverse();if(!dates.length)return 0;let s=0,d=new Date();for(let i=0;i<365;i++){const iso=d.toISOString().slice(0,10);if(dates.includes(iso)){s++;d.setDate(d.getDate()-1)}else if(i===0)d.setDate(d.getDate()-1);else break}return s}
// Phase D: combine/quest/bonus/spin XP all come from the server now
// (state.totalXP, via xp_ledger), same as daily-check-in/mission/team-bonus
// did after Phase B. Do NOT sum verified-combine count, quest XP, bonus
// XP, or spin XP back in here — those amounts are already inside
// state.totalXP, and re-adding them would double-count every award.
function xp(){return state.totalXP||0}
// Round 5 item 9: tier is now stateful (state.currentTierIndex), advanced
// only by evaluatePromotion() at a verified-Combine save — not a pure
// function of the current rating, so it doesn't flicker as raw numbers
// shift day to day.
function tier(){return tiers[state.currentTierIndex||0]}
// Item 8's promotion table, keyed by the tier being promoted INTO (index 1
// is Rookie->Grinder, etc; index 0/Rookie has no incoming gate). combine
// checkpoint requirements are expressed in terms of ordinal verified-Combine
// position (1st/2nd/3rd+) rather than calendar weeks, since the app has no
// season-start-date concept — see Round 5 open question 2.
// Round 13 item 15 — FLAG FOR RE-TUNING: these rating thresholds (55/65/
// 75/85/93) were tuned against the old 5-axis average (Speed/Strength/
// Power/Agility/Consistency). Round 13 changed what ratings().overall
// represents — it's now a 7-axis average including two brand-new axes
// (Core, Body Control) plus a new 3-input-blend formula per axis — so a
// given Overall number no longer means what it meant when these numbers
// were picked. Deliberately NOT re-tuned here (no real usage data to tune
// against yet); revisit once there's actual athlete data to calibrate to.
const promotionGates=[
  null,
  {rating:55,workouts:5,combineCheckpoint:'first'},
  {rating:65,workouts:10,combineCheckpoint:'mid'},
  {rating:75,workouts:15,combineCheckpoint:'mid_or_end'},
  {rating:85,workouts:20,combineCheckpoint:'end'},
  {rating:93,workouts:25,combineCheckpoint:'both_mid_and_end'}
];
function questCompletionCount(){return (state.quests||[]).length}
function teamProgramLoggedAtLeastOnce(){return state.daily.some(d=>d.programType==='team')}
// Engagement gate: "any one of a few paths" per tier (item 8's table).
function engagementSatisfied(tierIndex){
  const s=streak(), q=questCompletionCount(), team=teamProgramLoggedAtLeastOnce();
  switch(tierIndex){
    case 1:return s>=3||q>=1;
    case 2:return s>=5||q>=2;
    case 3:return s>=7||q>=3||team;
    case 4:return s>=10||(q>=4&&team);
    case 5:return s>=14||(q>=5&&team);
    default:return false;
  }
}
function checkpointMeetsThreshold(idx,threshold){
  const cp=(state.combineCheckpoints||[])[idx];
  return !!(cp&&cp.overall>=threshold);
}
// "first" = the athlete's 1st-ever verified Combine (or early baseline
// check); "mid"/"end" = the 2nd / any 3rd-or-later verified Combine,
// standing in for the Mid-Season / End-of-Season checkpoints described in
// Part 2's season model. "both_mid_and_end" is Legend's exception — proof
// across the whole season, not one good test.
function combineConfirmed(gateType,threshold){
  const cps=state.combineCheckpoints||[];
  const endMet=()=>cps.slice(2).some((_,i)=>checkpointMeetsThreshold(i+2,threshold));
  switch(gateType){
    case 'first':return checkpointMeetsThreshold(0,threshold);
    case 'mid':return checkpointMeetsThreshold(1,threshold);
    case 'end':return endMet();
    case 'mid_or_end':return checkpointMeetsThreshold(1,threshold)||endMet();
    case 'both_mid_and_end':return checkpointMeetsThreshold(1,threshold)&&endMet();
    default:return false;
  }
}
// Checkpoint recording (snapshotting the current overall rating against a
// verified Combine, and resetting the attributePoints rolling window) now
// happens server-side via recordCombineCheckpointRemote() in data.js,
// called right after a combine test is verified — see combineForm's
// submit handler.
// Advances at most one tier per unmet gate, but loops so a strong athlete
// who clears multiple tiers' gates in one checkpoint isn't artificially
// held back to a single step.
function evaluatePromotion(){
  state.currentTierIndex=state.currentTierIndex||0;
  let advanced=true;
  while(advanced&&state.currentTierIndex<tiers.length-1){
    const nextIndex=state.currentTierIndex+1;
    const gate=promotionGates[nextIndex];
    const ratingOk=ratings().overall>=gate.rating;
    const workoutsOk=state.daily.length>=gate.workouts;
    const combineOk=combineConfirmed(gate.combineCheckpoint,gate.rating);
    const engagementOk=engagementSatisfied(nextIndex);
    if(ratingOk&&workoutsOk&&combineOk&&engagementOk){
      state.currentTierIndex=nextIndex;
    }else{
      advanced=false;
    }
  }
}
// Item 10: plain-language progress toward the next tier, without exposing
// the rating threshold, axis weights, or exact gate math.
function pathToNextTier(){
  const idx=state.currentTierIndex||0;
  if(idx>=tiers.length-1) return null;
  const nextIndex=idx+1;
  const gate=promotionGates[nextIndex];
  const ratingOk=ratings().overall>=gate.rating;
  const workoutsOk=state.daily.length>=gate.workouts;
  const combineOk=combineConfirmed(gate.combineCheckpoint,gate.rating);
  const engagementOk=engagementSatisfied(nextIndex);
  const combineLabel={
    first:'Awaiting your first verified Combine',
    mid:'Awaiting Mid-Season Combine confirmation',
    end:'Awaiting End-of-Season Combine confirmation',
    mid_or_end:'Awaiting Mid-Season or End-of-Season Combine confirmation',
    both_mid_and_end:'Awaiting confirmation at both Mid-Season and End-of-Season Combine'
  }[gate.combineCheckpoint];
  return{
    nextTierName:tiers[nextIndex].name,
    items:[
      {label:'Rating goal met',done:ratingOk},
      {label:`${Math.min(state.daily.length,gate.workouts)} of ${gate.workouts} workouts logged`,done:workoutsOk},
      {label:combineOk?'Combine confirmed':combineLabel,done:combineOk},
      {label:'Engagement goal met',done:engagementOk}
    ]
  };
}
function renderPathToNextTier(){
  const c=$('#pathToNextTier'); if(!c) return;
  const path=pathToNextTier();
  if(!path){c.innerHTML='<p class="muted">🏆 Top tier reached — Legend status confirmed.</p>';return}
  c.innerHTML=`<p class="eyebrow dark">Path to ${path.nextTierName}</p><ul class="path-checklist">${path.items.map(i=>`<li class="${i.done?'done':''}">${i.done?'✅':'⏳'} ${i.label}</li>`).join('')}</ul>`;
}
// Real badge artwork is being sourced separately per tier (item 6) — this
// renders whatever's at tierBadges[name] and falls back to a plain colored
// initial-letter box on image load failure, so dropping in real files later
// needs zero code changes.
function tierBadgeHTML(tierName){
  const src=tierBadges[tierName];
  const initial=(tierName||'?').charAt(0);
  return `<div class="logo-frame tier-badge-slot"><img src="${src}" alt="${tierName} badge" onerror="this.style.display='none';this.nextElementSibling.classList.add('show')"><div class="tier-badge-fallback">${initial}</div></div>`;
}
// Round 6 item 3: the badge artwork carries the tier name as part of the
// image itself, so the ladder cards no longer render a separate name banner
// (unlike the status bar / Player Card, which still show tier name as text).
function renderLadder(){
  const c=$('#ladderContainer'); if(!c) return;
  c.innerHTML=tiers.map((t,i)=>`<div class="tier cardtier" id="tier${i}">${tierBadgeHTML(t.name)}</div>`).join('');
}
function renderHeroLadderPreview(){
  const c=$('#heroLadderPreview'); if(!c) return;
  c.innerHTML=tierBadgeHTML('Rookie')+tierBadgeHTML('Legend');
}

function renderPlatformStatus(){
  const total=xp(), currentIndex=state.currentTierIndex||0, current=tiers[currentIndex];
  const next=tiers[Math.min(currentIndex+1,tiers.length-1)];
  const packReady=(total%250)>=200;
  if($('#statusTier')) $('#statusTier').textContent=current.name;
  if($('#statusXP')) $('#statusXP').textContent=total;
  if($('#statusStreak')) $('#statusStreak').textContent=streak();
  if($('#statusPack')) $('#statusPack').textContent=packReady?'READY':'LOCKED';
  if($('#homeStreak')) $('#homeStreak').textContent=streak()+' Days';
  if($('#homeNextCallup')) $('#homeNextCallup').textContent=next.name;
  if($('#homePackStatus')) $('#homePackStatus').textContent=packReady?'Ready to Open':'Locked';
  if($('#homeMissionName')) $('#homeMissionName').textContent=typeof missionForToday==='function'?missionForToday().title:'Daily Mission';
}
function render(){renderPlatformStatus();const r=ratings(), rec=pr(), x=xp(), t=tier();$('#overall').textContent=r.overall;$('#overallBig').textContent=r.overall;$('#streak').textContent=streak();$('#workouts').textContent=state.daily.length;$('#xp').textContent=x;$('#levelName').textContent=t.name;$('#levelDesc').textContent=t.name==='THE SHOW'?'Major league energy. Keep building.':(t.name==='Triple AAA'?'One step from THE SHOW. Keep stacking wins.':'Keep training to get called up.');[...performanceAxisOrder,'consistency'].forEach(k=>{$('#'+k).textContent=r[k];$('#'+k+'Bar').style.width=Math.min(100,r[k])+'%'});
$$('.tier').forEach((el,i)=>el.classList.toggle('active',i===(state.currentTierIndex||0)));$('#records').innerHTML=`<li>${rec.pushups} max push-ups</li><li>${rec.squats} max squats</li><li>${rec.plank} sec plank</li><li>${rec.shuffleTouches} shuffle touches</li><li>${rec.broadJumpIn} in verified broad jump</li><li>${rec.sprintSec||'—'} sec verified sprint</li><li>${rec.singleLegBalanceSec||'—'} sec single-leg balance</li>`;renderPathToNextTier();
const pct=Math.min(100,(x%250)/250*100);$('#meterFill').style.width=pct+'%';$('#meterText').textContent=`${x%250} / 250 XP to next parent surprise`;$('#rewardNotice').textContent=x>=250&&x%250<75?'🎁 Parent surprise may be unlocked. Check Coach/Parent Corner.':'';
$('#dailyLog').innerHTML=workoutHistoryTable(state.daily.slice(-10).reverse());
$('#combineLog').innerHTML=combineHistoryTable(state.combine.slice().reverse());
$('#pendingList').innerHTML=table(['Week','Program','Status'],state.combine.filter(a=>!a.verified).map(a=>[a.week,a.programName||'—',a.status]));
$('#targets').innerHTML=Object.entries({pushups:rec.pushups,squats:rec.squats,plank:rec.plank,shuffleTouches:rec.shuffleTouches,skaterJumps:rec.skaterJumps,broadJumpIn:rec.broadJumpIn}).map(([k,v])=>`<p><strong>${k}</strong>: current ${v||0}</p>`).join('');renderQuests();renderRewards();renderGearLocker();renderPlayerCardHero();renderCoachReport();renderTeamEdition();renderCombineProgramPicker();renderCharts()}


function xpEvents(){
  const events=[];
  (state.daily||[]).forEach(x=>events.push({date:x.date||'',label:'Daily Workout',xp:25,detail:x.notes||''}));
  (state.combine||[]).filter(x=>x.verified).forEach(x=>events.push({date:'Week '+x.week,label:'Verified Combine Testing',xp:75,detail:'Parent verified'}));
  (state.quests||[]).forEach(x=>events.push({date:x.date||'',label:x.title,xp:+x.xp||0,detail:x.type||'Quest'}));
  (state.bonuses||[]).forEach(x=>events.push({date:x.date||'',label:x.type,xp:+x.xp||0,detail:x.reason||'Parent bonus'}));
  (state.spinLog||[]).forEach(x=>events.push({date:x.date||'',label:'Prize Wheel Spin',xp:+x.xp||0,detail:`Landed on +${x.xp} XP`}));
  return events;
}
// Rewards are a spendable balance (earned minus claimed), not a lifetime
// total — a milestone's "available/locked" state is purely a function of the
// CURRENT balance vs its cost, so it can lock again after spending drops the
// balance below it. Each claim requires parent-code approval.
// Round 12: Gear Locker purchases spend from the same balance as reward
// milestones but are tracked in a separate ledger (state.gearPurchases)
// so claimedRewards / claimsCountBig stay real-world-reward-only.
function totalGearXPSpent(){return (state.gearPurchases||[]).reduce((a,p)=>a+(+p.xpCost||0),0)}
function totalXPSpent(){return (state.claimedRewards||[]).reduce((a,r)=>a+(+r.milestoneXP||0),0)+totalGearXPSpent()}
function availableBalance(){return xp()-totalXPSpent()}
async function claimReward(xpCost,title){
  if(!activeAthlete){alert('Sign in and select an athlete before claiming a reward.');return}
  const balance=availableBalance();
  if(balance<xpCost){alert(`Not enough balance to claim ${title}. You need ${xpCost} XP and have ${balance}.`);return}
  const pin=await showPinModal(`approve claiming "${title}" (-${xpCost} XP)`);
  if(!pin) return;
  try{
    const rewardId=await findRewardIdByTitle(title);
    await claimRewardRemote(activeAthlete.id,rewardId,pin);
  }catch(err){
    alert('Could not claim reward: '+(err.message||'unknown error'));
    return;
  }
  await refreshAthleteState();
  alert(`${title} claimed! -${xpCost} XP.`);
  render();
}
function renderRewards(){
  const total=xp();
  const spent=totalXPSpent();
  const balance=availableBalance();
  const next=rewardMilestones.find(r=>balance<r.xp);
  if($('#balanceBig')) $('#balanceBig').textContent=balance;
  if($('#lifetimeXPBig')) $('#lifetimeXPBig').textContent=total;
  if($('#spentXPBig')) $('#spentXPBig').textContent=spent;
  if($('#claimsCountBig')) $('#claimsCountBig').textContent=(state.claimedRewards||[]).length;
  const prevAvailable=[...rewardMilestones].reverse().find(r=>balance>=r.xp);
  const base=prevAvailable?prevAvailable.xp:0;
  const top=next?next.xp:base+250;
  const pct=Math.min(100,((balance-base)/(top-base||1))*100);
  if($('#vaultMeterFill')) $('#vaultMeterFill').style.width=pct+'%';
  if($('#vaultMeterText')) $('#vaultMeterText').textContent=next?`${balance} XP available. ${next.xp-balance} XP until you can claim ${next.title}.`:`${balance} XP available. Every listed reward is claimable!`;
  if($('#rewardVault')) $('#rewardVault').innerHTML=rewardMilestones.map(r=>{
    const available=balance>=r.xp;
    const claimCount=(state.claimedRewards||[]).filter(c=>c.title===r.title).length;
    return `<div class="reward-tile ${available?'unlocked':''}">
      <span class="reward-tier-badge tier-${r.tier.toLowerCase()}">${r.tier}</span>
      <div class="quest-icon">${r.icon}</div>
      <h3>${r.title}</h3>
      <p><strong>${r.xp} XP</strong></p>
      <p>${r.desc}</p>
      <strong>${available?'Available':'Locked'}</strong>
      ${claimCount?`<p class="muted">Claimed ${claimCount}x</p>`:''}
      ${available?`<button type="button" class="primary claim-reward-btn" data-xp="${r.xp}" data-title="${r.title}">Claim</button>`:''}
    </div>`;
  }).join('');
  const events=xpEvents().slice().reverse();
  if($('#xpLedger')) $('#xpLedger').innerHTML=events.length?events.map(e=>`<div class="ledger-item"><span>${e.date}</span><span>${e.label}<br><small class="muted">${e.detail||''}</small></span><strong>+${e.xp} XP</strong></div>`).join(''):'<p class="muted">No XP events yet.</p>';
}
document.addEventListener('click',e=>{
  const claimBtn=e.target.closest('.claim-reward-btn');
  if(claimBtn) claimReward(+claimBtn.dataset.xp,claimBtn.dataset.title);
  const buyBtn=e.target.closest('.buy-gear-btn');
  if(buyBtn) buyGearItem(buyBtn.dataset.item);
  const equipBtn=e.target.closest('.gear-equip-btn');
  if(equipBtn) equipGearItem(equipBtn.dataset.slot,equipBtn.dataset.item);
});

function renderQuests(){
  const wk=weekStartISO(todayISO());
  const completedThisWeek=new Set((state.quests||[]).filter(x=>weekStartISO(x.date)===wk).map(x=>x.id));
  if($('#questSelect')) $('#questSelect').innerHTML=quests.map(q=>`<option value="${q.id}" ${completedThisWeek.has(q.id)?'disabled':''}>${q.type}: ${q.title} (+${q.xp} XP)${completedThisWeek.has(q.id)?' — done this week':''}</option>`).join('');
  if($('#questList')) $('#questList').innerHTML=quests.map(q=>{
    const doneThisWeek=completedThisWeek.has(q.id);
    const lifetimeCount=(state.quests||[]).filter(x=>x.id===q.id).length;
    return `<div class="quest-card ${q.type==='Boss Battle'?'battle':''} ${doneThisWeek?'complete':''}">
      <div class="quest-icon">${q.icon}</div>
      <h3>${q.title}</h3>
      <p><strong>${q.type}</strong></p>
      <p>${q.desc}</p>
      <span class="xp-pill">+${q.xp} XP</span>
      ${doneThisWeek?`<p class="verified">Completed this week</p>`:''}
      ${lifetimeCount?`<p class="muted">Lifetime: ${lifetimeCount}x</p>`:''}
    </div>`;
  }).join('');
  if($('#questHistory')) $('#questHistory').innerHTML=table(['Date','Challenge','Type','XP','Notes'],(state.quests||[]).slice().reverse().map(q=>[q.date,q.title,q.type,q.xp,q.notes]));
}


function streakBonusXP(s){
  if(s>=30) return 50;
  if(s>=14) return 35;
  if(s>=7) return 20;
  if(s>=3) return 10;
  return 0;
}
// No single workout should read as meaningfully close to even the smallest
// reward (250 XP) — base stays a flat 25 (so ~10 workouts = a small reward,
// matching the target economy), and combined bonuses are capped well under
// that so a big PR/streak day still can't rival multi-day + other-activity effort.
const WORKOUT_XP_CAP=75;
function workoutXPForEntry(entry){
  const base=25;
  const prs=entryPRs(entry);
  const prBonus=prs.length*15;
  const s=streak();
  const streakBonus=streakBonusXP(s);
  const rawTotal=base+prBonus+streakBonus;
  const total=Math.min(rawTotal,WORKOUT_XP_CAP);
  return {total,prs,base,streakBonus,prBonus,capped:rawTotal>WORKOUT_XP_CAP};
}
// PRs are now detected per logged activity (not a fixed field list): an
// entry's best set for an activity counts as a PR if it beats every prior
// daily entry's best for that same activity (or if it's the athlete's first
// time ever logging it, matching the old "first log always counts" behavior).
function previousActivityBest(beforeIndex,name){
  const a=findActivity(name);
  if(!a) return 0;
  const metricKey=a.metric.key;
  const legacyKey=legacyDailyFieldMap[name];
  const vals=[];
  state.daily.slice(0,beforeIndex).forEach(entry=>{
    vals.push(...valuesForActivityMetric(entry.custom&&entry.custom[name],metricKey));
    if(legacyKey&&entry[legacyKey]!=null&&entry[legacyKey]!=='')vals.push(+entry[legacyKey]);
  });
  if(!vals.length) return 0;
  return a.metric.lowerIsBetter?Math.min(...vals):Math.max(...vals);
}
function entryPRs(entry){
  const idx=state.daily.indexOf(entry);
  if(idx<0||!entry.custom) return [];
  const prs=[];
  Object.keys(entry.custom).forEach(name=>{
    const a=findActivity(name);
    if(!a) return;
    const vals=valuesForActivityMetric(entry.custom[name],a.metric.key);
    if(!vals.length) return;
    const best=a.metric.lowerIsBetter?Math.min(...vals):Math.max(...vals);
    const previous=previousActivityBest(idx,name);
    const beatsPrevious=previous===0?true:(a.metric.lowerIsBetter?best<previous:best>previous);
    if(best>0&&beatsPrevious) prs.push({name,label:a.name,value:best,previous});
  });
  return prs;
}
function workoutHistoryTable(rows){
  if(!rows.length) return '<p class="muted">No entries yet.</p>';
  return `<table class="table workout-history"><thead><tr>
    <th>Date</th><th>✓</th><th>XP</th><th>Program</th><th>Activities Logged</th>
  </tr></thead><tbody>${rows.map(entry=>{
    const originalIndex=state.daily.indexOf(entry);
    const xpInfo=workoutXPForEntry(entry);
    const prs=xpInfo.prs;
    const names=entry.custom?Object.keys(entry.custom).filter(n=>hasLoggedAny(entry.custom[n])):[];
    const summary=names.length?names.map(n=>prs.some(p=>p.name===n)?`${n} <span class="new-pr">▲ PR</span>`:n).join(', '):'—';
    return `<tr class="workout-row" data-workout-index="${originalIndex}">
      <td>${entry.date||''}${prs.length?'<span class="pr-chip">PR</span>':''}</td>
      <td>✅</td>
      <td><strong>+${xpInfo.total}</strong></td>
      <td>${entry.programName||'—'}</td>
      <td>${summary}</td>
    </tr>`;
  }).join('')}</tbody></table><p class="muted tap-note">Tap a row to view workout details.</p>`;
}
function showWorkoutDetail(index){
  const entry=state.daily[index];
  if(!entry) return;
  const xpInfo=workoutXPForEntry(entry);
  const prs=xpInfo.prs;
  const prHtml=prs.length?prs.map(p=>`<li><strong>${p.label}</strong>: ${p.value}${p.previous?` (previous best ${p.previous})`:''}</li>`).join(''):'<li>No new PRs this workout.</li>';
  const loggedNames=entry.custom?Object.keys(entry.custom).filter(n=>hasLoggedAny(entry.custom[n])):[];
  const activityRows=loggedNames.length?loggedNames.map(name=>`<p><strong>${name}:</strong> ${formatMetricValues(name,entry.custom[name])}</p>`).join(''):'<p class="muted">No activities logged.</p>';
  $('#workoutDetailContent').innerHTML=`
    <p class="eyebrow dark">Workout Detail</p>
    <h2>${entry.date||'Workout'}</h2>
    <div class="xp-breakdown">
      <h3>XP Breakdown</h3>
      <p>Daily Workout <strong>+${xpInfo.base}</strong></p>
      <p>Streak Bonus <strong>+${xpInfo.streakBonus}</strong></p>
      <p>New PR Bonus <strong>+${xpInfo.prBonus}</strong></p>
      <p class="total-xp">Total <strong>+${xpInfo.total} XP</strong></p>
      ${xpInfo.capped?`<p class="muted">Daily workout XP is capped at ${WORKOUT_XP_CAP} so one big day can't rival steady training.</p>`:''}
    </div>
    <h3>${entry.programName?entry.programName:'Activities Logged'}</h3>
    <div class="detail-grid">${activityRows}</div>
    ${entry.notes?`<p><strong>Notes:</strong> ${entry.notes}</p>`:''}
    <h3>Personal Records</h3><ul>${prHtml}</ul>`;
  $('#workoutDetailModal').classList.remove('hidden');
}
// Player Card hero — name/team text binding + rating-bar tier coloring.
// Ratings stay the real ratings()-engine axes (Speed/Strength/Power/
// Agility/Consistency), not the placeholder set from the design reference.
function ratingTierClass(v){
  if(v>=80) return 'tier-green';
  if(v>=65) return 'tier-blue';
  if(v>=50) return 'tier-amber';
  return 'tier-red';
}
function renderPlayerCardHero(){
  const name=state.athleteName||'Athlete';
  if($('#statusAthleteName')) $('#statusAthleteName').textContent=name.toUpperCase();
  if($('#playerCardName')) $('#playerCardName').textContent=name;
  if($('#playerCardTeam')) $('#playerCardTeam').textContent=(athleteTeamMembership&&athleteTeamMembership.status==='approved'&&athleteTeamMembership.teams&&athleteTeamMembership.teams.name)||'Free Agent';
  if($('#playerCardAge')) $('#playerCardAge').textContent=(activeAthlete&&activeAthlete.age)||'—';
  [...performanceAxisOrder,'consistency'].forEach(k=>{
    const bar=$('#'+k+'Bar');
    if(!bar) return;
    bar.classList.remove('tier-red','tier-amber','tier-blue','tier-green');
    bar.classList.add(ratingTierClass(+($('#'+k).textContent)||0));
  });
}
// TODO(Build Your Athlete): stub for the future selfie-capture -> 3D-avatar
// render -> Reward Locker gear-purchase flow described in
// design-reference/player-card-avatar-attributes.md. No destination yet.
function buildYourAthlete(){
  alert('Coming soon: take a selfie, render your 3D avatar, and gear it up in the Reward Locker!');
}
// One-time setup (not called from render()) — the rotation is decorative
// sample content, independent of app state, so it shouldn't be torn down
// and rebuilt on every re-render. Respects prefers-reduced-motion by
// slowing the interval and shortening the crossfade (see styles.css) rather
// than disabling the preview outright.
function initPlayerCardRotation(){
  const slot=$('#playerCardSlot');
  const dotsWrap=$('#playerCardDots');
  if(!slot||!dotsWrap) return;
  const images=[...slot.querySelectorAll('img')];
  if(!images.length) return;
  images.forEach((_,i)=>{
    const dot=document.createElement('span');
    if(i===0) dot.classList.add('active');
    dotsWrap.appendChild(dot);
  });
  const dots=[...dotsWrap.querySelectorAll('span')];
  const reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ROTATE_MS=reduceMotion?12000:1800;
  let current=0;
  let paused=false;
  setInterval(()=>{
    if(paused) return;
    images[current].classList.remove('active');
    dots[current].classList.remove('active');
    current=(current+1)%images.length;
    images[current].classList.add('active');
    dots[current].classList.add('active');
  },ROTATE_MS);
  slot.setAttribute('tabindex','0');
  slot.addEventListener('mouseenter',()=>paused=true);
  slot.addEventListener('mouseleave',()=>paused=false);
  slot.addEventListener('focusin',()=>paused=true);
  slot.addEventListener('focusout',()=>paused=false);
}
function renderCoachReport(){
  if(!$('#coachReport')) return;
  if(!state.daily.length){$('#coachReport').innerHTML='<p class="muted">Complete a few workouts to unlock a weekly coach report.</p>';return;}
  const last7=state.daily.slice(-7);
  const workouts=last7.length;
  const names=new Set();
  last7.forEach(entry=>{if(entry.custom)Object.keys(entry.custom).forEach(n=>{if(hasLoggedAny(entry.custom[n]))names.add(n)})});
  let best=null;
  names.forEach(name=>{
    const a=findActivity(name);
    if(!a) return;
    const vals=last7.map(entry=>{
      const v=valuesForActivityMetric(entry.custom&&entry.custom[name],a.metric.key);
      return v.length?(a.metric.lowerIsBetter?Math.min(...v):Math.max(...v)):null;
    }).filter(v=>v!=null);
    if(vals.length<2) return;
    const improvement=Math.max(...vals)-Math.min(...vals);
    if(!best||improvement>best.improvement) best={label:name,improvement};
  });
  const r=pr();
  $('#coachReport').innerHTML=`<p><strong>Great work this week.</strong></p><p>You logged <strong>${workouts}</strong> recent workouts.${best?` Biggest improvement area: <strong>${best.label}</strong>.`:''}</p><p><strong>Next goals:</strong> ${(r.pushups||0)+2} push-ups, ${(r.plank||0)+5}-second plank.</p><p class="muted">Keep stacking small wins and chasing the next call-up.</p>`;
}
document.addEventListener('click',e=>{
  const row=e.target.closest('.workout-row');
  if(row) showWorkoutDetail(+row.dataset.workoutIndex);
  if(e.target.id==='closeWorkoutDetail' || e.target.id==='workoutDetailModal') $('#workoutDetailModal').classList.add('hidden');
  if(e.target.id==='playerCardAge'){
    if(!activeAthlete) return;
    const val=prompt('Enter age:',activeAthlete.age||'');
    if(val===null) return;
    const age=parseInt(val,10);
    if(!Number.isInteger(age)||age<1||age>25){alert('Enter a whole number between 1 and 25.');return}
    updateAthleteAge(activeAthlete.id,age).then(()=>{
      activeAthlete.age=age;
      const idx=currentAthletes.findIndex(a=>a.id===activeAthlete.id);
      if(idx>=0) currentAthletes[idx].age=age;
      renderPlayerCardHero();
    }).catch(err=>alert('Could not save age: '+(err.message||err)));
  }
});

function table(h,rows){if(!rows.length)return'<p class="muted">No entries yet.</p>';return`<table class="table"><thead><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c||''}</td>`).join('')}</tr>`).join('')}</tbody></table>`}
// Round 3: combine results are single-value-per-exercise (no sets) against
// whichever program the parent picked at test time, so the history table
// shows the program name + a results summary instead of fixed benchmark columns.
function combineHistoryTable(rows){
  if(!rows.length) return '<p class="muted">No entries yet.</p>';
  return `<table class="table"><thead><tr><th>Week</th><th>Program</th><th>Results</th><th>Status</th></tr></thead><tbody>${rows.map(entry=>{
    const legacyResults=[];
    if(entry.maxPushups!=null&&entry.maxPushups!=='')legacyResults.push(`Push-ups: ${entry.maxPushups}`);
    if(entry.squat60!=null&&entry.squat60!=='')legacyResults.push(`Squats: ${entry.squat60}`);
    if(entry.plankMax!=null&&entry.plankMax!=='')legacyResults.push(`Plank: ${entry.plankMax}`);
    if(entry.broadJumpIn!=null&&entry.broadJumpIn!=='')legacyResults.push(`Broad Jump: ${entry.broadJumpIn}`);
    if(entry.sprintSec!=null&&entry.sprintSec!=='')legacyResults.push(`20-yard Sprint: ${entry.sprintSec}`);
    const customResults=(entry.customCombine||[]).map(x=>`${x.name}: ${formatMetricValues(x.name,x.values!=null?x.values:x.value)}`);
    const results=[...legacyResults,...customResults].join(', ')||'—';
    return `<tr><td>${entry.week}</td><td>${entry.programName||'—'}</td><td>${results}</td><td><span class="status ${entry.verified?'verified':'pending'}">${entry.status}</span></td></tr>`;
  }).join('')}</tbody></table>`;
}

function canvas(id,h=240){const c=$('#'+id);if(!c)return null;const w=c.clientWidth||800,dpr=devicePixelRatio||1;c.width=w*dpr;c.height=h*dpr;const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);return{ctx,w,h}}
function line(id,rows,title){const c=canvas(id);if(!c)return;const{ctx,w,h}=c;if(!rows.length){ctx.fillText('No data yet.',20,100);return}const vals=rows.map(r=>r.value).filter(Number.isFinite),maxV=Math.max(...vals,1)*1.1,minV=0,p={l:40,r:20,t:35,b:35};ctx.font='700 16px "Fredoka",sans-serif';ctx.fillStyle='#161616';ctx.fillText(title,p.l,20);ctx.strokeStyle='#f0e4c8';for(let i=0;i<=4;i++){let y=p.t+(h-p.t-p.b)*i/4;ctx.beginPath();ctx.moveTo(p.l,y);ctx.lineTo(w-p.r,y);ctx.stroke()}const pts=rows.map((r,i)=>({x:p.l+(w-p.l-p.r)*(rows.length===1?.5:i/(rows.length-1)),y:p.t+(h-p.t-p.b)*(1-(r.value-minV)/(maxV-minV||1)),...r}));ctx.beginPath();pts.forEach((pt,i)=>i?ctx.lineTo(pt.x,pt.y):ctx.moveTo(pt.x,pt.y));ctx.strokeStyle='#1F7AE0';ctx.lineWidth=4;ctx.stroke();pts.forEach(pt=>{ctx.beginPath();ctx.arc(pt.x,pt.y,5,0,Math.PI*2);ctx.fillStyle='#FF2E9A';ctx.fill();ctx.strokeStyle='#161616';ctx.stroke()})}
function populateSelect(sel,fixedDict,customNames){
  if(!sel) return;
  const current=sel.value;
  const fixedOpts=Object.entries(fixedDict).map(([k,label])=>`<option value="${k}">${label}</option>`).join('');
  const customOpts=customNames.map(n=>`<option value="c:${n}">${n} (Skill Lab)</option>`).join('');
  sel.innerHTML=fixedOpts+customOpts;
  if([...sel.options].some(o=>o.value===current)) sel.value=current;
}
function refreshChartSelectors(){
  const names=loggedCustomExerciseNames();
  populateSelect($('#exerciseSelect'),metricNames,names);
  populateSelect($('#combineMetricSelect'),combineNames,names);
}
function renderCharts(){
  refreshChartSelectors();
  let m=$('#exerciseSelect').value;
  const label=m.startsWith('c:')?m.slice(2):metricNames[m];
  line('exerciseChart',state.daily.filter(x=>x.date).map(x=>({label:x.date,value:dailyValueFor(x,m)})),label+' over time');
  let cm=$('#combineMetricSelect').value;
  const clabel=cm.startsWith('c:')?cm.slice(2):combineNames[cm];
  line('combineChart',best(cm),clabel+' best-to-date');
}
function best(m){let rows=[],b=m==='sprintSec'?Infinity:0;state.combine.filter(x=>x.verified).sort((a,b)=>(+a.week||0)-(+b.week||0)).forEach(x=>{let v=combineValueFor(x,m);if(m==='sprintSec'){if(v>0)b=Math.min(b,v);if(b!==Infinity)rows.push({label:'W'+x.week,value:b})}else{b=Math.max(b,v);rows.push({label:'W'+x.week,value:b})}});return rows}

// Round 13: Core and Body Control are now real rated axes (they weren't
// before this round). Balance and Coordination both route to the single
// bodyControl axis — the first many-to-one case here, so whyTrackLine()
// below can't assume a 1:1 category-to-axis mapping. Teamwork maps to
// 'consistency' because it's now a literal scoring input there (item 8),
// not a placeholder fallback. Mobility has no entry at all — it stays
// unrated recovery work — whyTrackLine() special-cases it instead.
const categoryAxisMap={Strength:'strength',Core:'core',Speed:'speed',Quickness:'quickness','Jumping/Plyometrics':'jumpPower',Balance:'bodyControl',Coordination:'bodyControl',Teamwork:'consistency'};
const categoryIcons={Strength:'💪',Core:'🧱',Speed:'⚡',Quickness:'🏃','Jumping/Plyometrics':'🚀',Balance:'⚖',Coordination:'🎯',Mobility:'🧘',Teamwork:'🤝'};
// Round 9 item 10 — goal-chip nav, one per non-Teamwork category. Labels
// and mapping (including "More Durable"->Core) match the change-request
// doc's explicit list verbatim.
const goalChipDefs=[
  {category:'Strength',label:'Stronger',icon:'💪'},
  {category:'Speed',label:'Faster',icon:'⚡'},
  {category:'Quickness',label:'Quicker',icon:'🏃'},
  {category:'Jumping/Plyometrics',label:'Jump Higher',icon:'🚀'},
  {category:'Core',label:'More Durable',icon:'🛡'},
  {category:'Balance',label:'Better Balance',icon:'⚖'},
  {category:'Coordination',label:'Better Coordination',icon:'🎯'},
  {category:'Mobility',label:'More Flexible',icon:'🧘'}
];

// ---- Skills Lab activity catalog ----
// Each activity: {id, name, category, sportTags, ageBand, media, metric}
// media.video.plannedUrl is reserved for a future pass — no component in this
// build ever reads it. See renderActivityDetail(): the Demo Video section is
// always the "coming soon" placeholder, regardless of this field's value.
//
// Round 3: every activity tracks exactly one metric — reps, time, or distance
// (no RPE/effort, no weight) — because Daily Check-In now logs a list of sets
// of that single measurement (see the Add Set flow) rather than a compound
// reps+sets+effort object. `lowerIsBetter` marks timed-course metrics (sprints)
// where a smaller number is the improvement, as opposed to held/duration work
// (planks, mobility) where more time is the improvement.
function slug(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}
function emptyMedia(){return {instructionText:null,formCues:[],commonFaults:[],video:{plannedUrl:null}}}
const MetricBuilders={
  reps:(label)=>({key:'reps',label:label||'Reps',unit:'reps',inputType:'integer',min:1}),
  duration:()=>({key:'duration_sec',label:'Duration',unit:'sec',inputType:'integer',min:0,step:5}),
  time:()=>({key:'duration_sec',label:'Time',unit:'sec',inputType:'decimal',min:0,step:0.01,lowerIsBetter:true}),
  distanceYd:()=>({key:'distance_yd',label:'Distance',unit:'yd',inputType:'integer',min:0}),
  distanceIn:()=>({key:'distance_in',label:'Distance',unit:'in',inputType:'integer',min:0})
};
const M=MetricBuilders;
// Round 9: consolidated to 8 sport-agnostic athletic-quality categories
// (Strength/Core/Speed/Quickness/Jumping-Plyometrics/Balance/Coordination/
// Mobility) plus Teamwork, curated from a youth bodyweight/plyometric
// research summary — down from the old 11-category, baseball-mixed list.
// Baseball-specific content (Throwing/Catching/Hitting/Pitching, plus the
// base-running-specific First-Step Reaction/Base-Stealing Starts) is
// quarantined in baseballActivityDefs below, not deleted, for a future
// dedicated Baseball Skill Lab module.
//
// Each entry is [name, metricBuilderFn, attributeWeights]. attributeWeights
// is a small {Attribute:weight} map used only for the informational
// Attribute Breakdown display (state.attributePoints, Part 4) — never read
// by ratings()/pr()/score(). The 7 trackable attributes are Strength,
// Speed, Quickness, Jump, Core, Balance, Coordination; Mobility and
// Teamwork exercises carry no weight (null) since they aren't a rated
// athletic quality. HARD CONSTRAINT: Push-ups, Squats, Plank, Lateral
// Shuffle, Skater Jumps, Broad Jump, and 20-yard Sprint are read by exact
// string match in pr()/axisStatNames/benches — do not rename or remove.
const activityDefs={
  Strength:[
    ['Push-ups',()=>M.reps(),{Strength:3,Core:1}],
    ['Wide Push-ups',()=>M.reps(),{Strength:3,Core:1}],
    ['Squats',()=>M.reps(),{Strength:3,Jump:1}],
    ['Jump Squats',()=>M.reps(),{Strength:2,Jump:2}],
    ['Glute Bridge',()=>M.reps(),{Strength:3,Core:1}],
    ['Drop Lunges',()=>M.reps('Reps (each leg)'),{Strength:3,Balance:1}],
    ['Pull-Ups',()=>M.reps(),{Strength:3}],
    ['Dead Hang',M.duration,{Strength:2,Core:1}]
  ],
  Core:[
    ['Plank',M.duration,{Core:3}],
    ['Side Plank',M.duration,{Core:3,Balance:1}],
    ['Hollow Hold',M.duration,{Core:3}],
    ['Dead Bugs',()=>M.reps(),{Core:3,Coordination:1}],
    ['Bird Dog',()=>M.reps(),{Core:3,Balance:1}],
    ['Bear Crawl',M.duration,{Core:2,Coordination:2}]
  ],
  Speed:[
    ['10-yard Sprint',M.time,{Speed:3}],
    ['20-yard Sprint',M.time,{Speed:3}],
    ['40-Yard Sprint',M.time,{Speed:3}],
    ['Hill Sprint',M.time,{Speed:3,Strength:1}],
    ['Flying Sprint',M.time,{Speed:3}]
  ],
  Quickness:[
    ['Skater Jumps',()=>M.reps(),{Quickness:2,Jump:2}],
    ['Lateral Shuffle',()=>M.reps('Touches'),{Quickness:3}],
    ['Shuttle Run',M.time,{Quickness:3,Speed:1}],
    ['Carioca',M.duration,{Quickness:3,Coordination:1}],
    ['Zig-Zag Cones',M.duration,{Quickness:3}],
    ['Box Drill',M.duration,{Quickness:3,Coordination:1}]
  ],
  'Jumping/Plyometrics':[
    ['Broad Jump',M.distanceIn,{Jump:3,Speed:1}],
    ['Vertical Jump',M.distanceIn,{Jump:3,Strength:1}],
    ['Single-Leg Hops',()=>M.reps(),{Jump:2,Balance:2}],
    ['Lateral Hops',()=>M.reps(),{Jump:2,Quickness:1}],
    ['Squat Jump',()=>M.reps(),{Jump:3,Strength:1}],
    ['Box Jump',()=>M.reps(),{Jump:3}],
    ['Tuck Jump',()=>M.reps(),{Jump:3,Core:1}],
    ['Jump Rope',()=>M.reps(),{Coordination:2,Quickness:2}],
    ['Pogo Jumps',()=>M.reps(),{Jump:3,Quickness:1}]
  ],
  Balance:[
    ['Single-Leg Balance',M.duration,{Balance:3}],
    ['Single-Leg Reach',()=>M.reps(),{Balance:3,Core:1}],
    ['Heel-to-Toe Walk',()=>M.reps('Steps'),{Balance:3,Coordination:1}]
  ],
  Coordination:[
    ['High Knees',()=>M.reps(),{Coordination:2,Speed:1}],
    ['Butt Kicks',()=>M.reps(),{Coordination:2,Speed:1}],
    ['Ladder Quick Feet',M.duration,{Coordination:3,Quickness:1}],
    ['Crossovers',()=>M.reps(),{Coordination:3,Quickness:1}],
    ['Mountain Climbers',()=>M.reps(),{Coordination:2,Core:2}]
  ],
  Mobility:[
    ['Hip Mobility',M.duration,null],
    ['Shoulder Mobility',M.duration,null],
    ["World's Greatest Stretch",M.duration,null],
    ['Deep Squat Hold',M.duration,null],
    ['Hamstring Stretch',M.duration,null],
    ['Thoracic Rotation',M.duration,null]
  ],
  Teamwork:[['Sportsmanship Challenge',()=>M.reps('Times'),null],['Encourage a Teammate',()=>M.reps('Times'),null],['Equipment Cleanup',()=>M.reps('Times'),null],['Coach Helper',()=>M.reps('Times'),null]]
};
const categoryOrder=Object.keys(activityDefs);
// Quarantined baseball-specific content — intentionally NOT referenced by
// categoryOrder/activities/the Skill Lab UI. Kept intact (including its
// authored coaching text) for a future dedicated Baseball Skill Lab module.
const baseballActivityDefs={
  Throwing:[['Target Throws',()=>M.reps()],['One-Knee Throwing',()=>M.reps()],['Long Toss',M.distanceYd],['Crow Hop',()=>M.reps()],['Quick Release',()=>M.reps()],['Pivot Throws',()=>M.reps()]],
  Catching:[['Tennis Ball Reaction',()=>M.reps()],['Barehand Catches',()=>M.reps()],['Blocking Drill',()=>M.reps()],['Transfer Drill',()=>M.reps()]],
  Hitting:[['Tee Work',()=>M.reps('Swings')],['Front Toss',()=>M.reps('Swings')],['Bat-Speed Swings',()=>M.reps('Swings')],['One-Hand Drills',()=>M.reps('Swings')],['Balance Drills',M.duration],['Launch Position',()=>M.reps()]],
  Pitching:[['Balance Drill',M.duration],['Arm Care',()=>M.reps()],['Hip Rotation',()=>M.reps()],['Towel Drill',()=>M.reps()]],
  Speed:[['First-Step Reaction',()=>M.reps()],['Base-Stealing Starts',()=>M.reps()]]
};
const baseballSampleMedia={
  'Tee Work':{instructionText:'Hit off the batting tee focusing on a consistent, repeatable swing path rather than power.'}
};
// A handful of activities ship with real content to prove the "present" and
// "partially present" states render correctly. Everything else intentionally
// ships with null/empty media — the "absent" state — until a content pass fills it in.
const sampleMedia={
  'Hollow Hold':{instructionText:'Lie on your back, press your lower back into the floor, and lift your shoulders and legs slightly off the ground, arms reaching overhead. Hold the "banana" shape with your core braced.',formCues:['Lower back pressed flat, no arch','Legs straight and squeezed together','Arms reaching long overhead','Breathe steady, don’t hold your breath'],commonFaults:['Letting the lower back arch off the floor','Legs dropping too low to compensate']},
  '10-yard Sprint':{instructionText:'A short, explosive sprint from a stopped start. Drive out low for the first few steps, then accelerate through the line without slowing down.',formCues:['Lean forward out of the start','Drive your arms front to back','Push the ground away, don’t reach with your feet','Run through the line, not to it'],commonFaults:['Standing up too tall too early','Taking choppy first steps instead of driving out low']},
  'Box Drill':{instructionText:'Set up four cones in a square. Sprint, shuffle, backpedal, and shuffle again around the box, staying low and under control at every corner.',formCues:['Stay low through every direction change','Chop your feet at each corner','Keep your eyes up, not on your feet','Push off the outside foot on every turn'],commonFaults:['Standing up tall at the corners and losing speed','Crossing your feet during the shuffle sections']},
  'Hip Mobility':{instructionText:'A continuous flow through 90/90 switches, world’s greatest stretch, and lateral lunges to open the hips before training.',formCues:['Keep both hips square to the front','Move slow and controlled, no bouncing','Breathe out on every stretch position'],commonFaults:['Rushing through positions','Letting the back knee collapse inward']}
};
const activities=categoryOrder.flatMap(cat=>activityDefs[cat].map(([name,metricFn,attrs])=>{
  const m=sampleMedia[name];
  return {
    id:slug(name),
    name,
    category:cat,
    sportTags:['multi-sport'],
    ageBand:'all',
    media:m?{instructionText:m.instructionText,formCues:m.formCues||[],commonFaults:m.commonFaults||[],video:{plannedUrl:null}}:emptyMedia(),
    metric:metricFn(),
    attributes:attrs||null
  };
}));
function findActivity(name){return activities.find(a=>a.name===name)}
function findActivityById(id){return activities.find(a=>a.id===id)}
// Round 9 built this as a purely additive, informational-only tally, fed by
// Daily/Team Program Check-In logs (weight x sets logged per activity, not
// weighted by raw value since reps/seconds/inches aren't unit-compatible).
// Round 13 repurposed it into a real (capped) scoring input — see
// completionScore()/axisScore() — reset at each verified-Combine checkpoint
// so it reflects completion since the last checkpoint, not a lifetime tally.
// Phase B: the checkpoint-tagged reset now lives server-side
// (attribute_points_ledger.checkpoint_id), so this only computes the point
// delta for a single check-in — log_daily_check_in's RPC does the
// insert/accumulation; app.js never mutates state.attributePoints directly
// anymore, it's refreshed from the server after every check-in.
function computeAttributePointsDelta(custom){
  const delta={};
  Object.entries(custom||{}).forEach(([name,entry])=>{
    const a=findActivity(name);
    const sets=entry&&Array.isArray(entry.sets)?entry.sets.length:0;
    if(!a||!a.attributes||!sets) return;
    Object.entries(a.attributes).forEach(([attr,weight])=>{
      delta[attr]=(delta[attr]||0)+weight*sets;
    });
  });
  return delta;
}
function exerciseCategory(name){const a=findActivity(name);return a?a.category:null}
// Three ready-made, locked programs so an athlete can start logging on day
// one without building anything. Seeded once (state.presetsSeeded) so they
// never duplicate on reload, and never re-seeded after an athlete deletes
// their own programs — presets are a starting point, not a permanent fixture.
const presetDefs=[
  {name:'Level 1: Base Camp',activities:['Push-ups','Squats','Skater Jumps','Lateral Shuffle','Plank','Broad Jump','20-yard Sprint']},
  {name:'Level 2: The Grind',activities:['Push-ups','Jump Squats','Skater Jumps','Hollow Hold','Plank','Drop Lunges']},
  {name:'Level 3: Boss Level',activities:['Push-ups','Jump Squats','Skater Jumps','Hollow Hold','Plank','Drop Lunges','Dead Hang','Single-Leg Hops']}
];
function seedPresetPrograms(){
  if(state.presetsSeeded) return;
  state.programs=state.programs||[];
  presetDefs.forEach((def,i)=>{
    const activityIds=def.activities.map(n=>findActivity(n)).filter(Boolean).map(a=>a.id);
    state.programs.push({id:'preset_'+i,name:def.name,activityIds,preset:true});
  });
  state.presetsSeeded=true;
  save();
}
// ---- Logged-value extraction (handles 3 historical data generations) ----
// A logged custom entry (`entry.custom[name]` or a customCombine `.values`)
// may be shaped as:
//   1. a legacy flat number (pre-Skills-Lab, e.g. {"Wide Push-ups": 12})
//   2. a Round-2 single-object {metricKey: value} (one set, no Add Set yet)
//   3. a Round-3 {sets:[{metricKey:value}, ...]} list (this build)
// valuesForActivityMetric() reads any of the three and always returns a flat
// array of numbers for the activity's one metric key.
function valuesForActivityMetric(raw,metricKey){
  if(raw==null) return [];
  if(typeof raw==='number') return [raw];
  if(Array.isArray(raw.sets)) return raw.sets.map(s=>s[metricKey]).filter(v=>v!=null).map(Number);
  if(raw[metricKey]!=null) return [Number(raw[metricKey])];
  return [];
}
function hasLoggedAny(raw){
  if(raw==null) return false;
  if(typeof raw==='number') return raw>0;
  if(Array.isArray(raw.sets)) return raw.sets.some(s=>Object.values(s).some(v=>(+v||0)>0));
  return Object.values(raw).some(v=>(+v||0)>0);
}
// The very first app (before any Skills Lab catalog existed) wrote these 8
// activities straight onto the daily/combine entry as flat named fields.
// Folding them in here keeps that history contributing to PRs/ratings
// instead of silently vanishing. Two of the original daily fields (broadJumps,
// sprints) were rep-counts, not the distance/time the current Broad Jump and
// 20-yard Sprint activities measure, so those two aren't unit-compatible and
// are intentionally left out of the daily map.
const legacyDailyFieldMap={'Push-ups':'pushups','Squats':'squats','Plank':'plank','Lateral Shuffle':'shuffleTouches','Skater Jumps':'skaterJumps','Sit Ups':'crunches'};
const legacyCombineFieldMap={'Push-ups':'maxPushups','Squats':'squat60','Plank':'plankMax','Broad Jump':'broadJumpIn','20-yard Sprint':'sprintSec'};
function loggedCustomExerciseNames(){
  const set=new Set();
  state.daily.forEach(d=>{if(d.custom)Object.keys(d.custom).forEach(k=>{if(hasLoggedAny(d.custom[k]))set.add(k)})});
  state.combine.forEach(c=>{(c.customCombine||[]).forEach(x=>{if(hasLoggedAny(x.values!=null?x.values:x.value))set.add(x.name)})});
  return [...set].sort();
}
// Formats a logged value for display, e.g. "8, 10, 12 reps (3 sets)".
function formatMetricValues(name,raw){
  if(raw==null) return '—';
  const a=findActivity(name);
  const met=a?a.metric:null;
  if(typeof raw==='number') return met?`${raw} ${met.unit}`:String(raw);
  if(Array.isArray(raw.sets)){
    const key=met?met.key:Object.keys(raw.sets[0]||{})[0];
    const vals=raw.sets.map(s=>s[key]).filter(v=>v!=null);
    if(!vals.length) return '—';
    return vals.join(', ')+(met&&met.unit?' '+met.unit:'')+(vals.length>1?` (${vals.length} sets)`:'');
  }
  return Object.entries(raw).map(([mk,mv])=>met&&met.key===mk?`${mv}${met.unit?' '+met.unit:''}`:`${mk} ${mv}`).join(', ');
}
// Best-ever value for one activity's single metric, across every daily set
// (any Program) and every verified combine result, folding in whichever of
// the 3 historical shapes (plus the pre-Skills-Lab flat fields) applies.
// "Best" respects the metric's direction: max for reps/distance/held-duration,
// min for timed-course metrics (sprints) where faster is the improvement.
function bestActivityValue(name){
  const a=findActivity(name);
  if(!a) return 0;
  const metricKey=a.metric.key;
  const legacyDailyKey=legacyDailyFieldMap[name];
  const legacyCombineKey=legacyCombineFieldMap[name];
  const vals=[];
  state.daily.forEach(entry=>{
    vals.push(...valuesForActivityMetric(entry.custom&&entry.custom[name],metricKey));
    if(legacyDailyKey&&entry[legacyDailyKey]!=null&&entry[legacyDailyKey]!=='')vals.push(+entry[legacyDailyKey]);
  });
  state.combine.filter(x=>x.verified).forEach(entry=>{
    const f=(entry.customCombine||[]).find(x=>x.name===name);
    if(f)vals.push(...valuesForActivityMetric(f.values!=null?f.values:f.value,metricKey));
    if(legacyCombineKey&&entry[legacyCombineKey]!=null&&entry[legacyCombineKey]!=='')vals.push(+entry[legacyCombineKey]);
  });
  if(!vals.length) return 0;
  return a.metric.lowerIsBetter?Math.min(...vals):Math.max(...vals);
}
// One combine entry's value for one activity (not searched across history —
// used to compare specific checkpoints against each other for the
// improvement bonus and the promotion gates' checkpoint snapshots).
function combineEntryValue(entry,name){
  const a=findActivity(name);
  if(!a||!entry) return 0;
  const metricKey=a.metric.key;
  const found=(entry.customCombine||[]).find(x=>x.name===name);
  if(found){
    const vals=valuesForActivityMetric(found.values!=null?found.values:found.value,metricKey);
    if(vals.length) return a.metric.lowerIsBetter?Math.min(...vals):Math.max(...vals);
  }
  const legacyKey=legacyCombineFieldMap[name];
  if(legacyKey&&entry[legacyKey]!=null&&entry[legacyKey]!=='') return +entry[legacyKey];
  return 0;
}
// "Latest" (most recent verified test), not "best ever" — a rating axis
// should reflect current standing, not a historical peak that may no longer
// be true.
function latestVerifiedCombineValue(name){
  const verified=state.combine.filter(x=>x.verified);
  for(let i=verified.length-1;i>=0;i--){
    const v=combineEntryValue(verified[i],name);
    if(v) return v;
  }
  return 0;
}
// Item 5: replaces the old "distinct exercises logged" bonus with credit for
// real, verified improvement between the two most recent verified Combines —
// the main lever that makes 99 hard to reach, since it requires the athlete
// to actually get better at a checkpoint, not just log variety.
function combineImprovementBonus(axis){
  const stats=axisStatNames[axis];
  const verified=state.combine.filter(x=>x.verified);
  if(!stats||verified.length<2) return 0;
  const prevEntry=verified[verified.length-2];
  const latestEntry=verified[verified.length-1];
  let total=0,count=0;
  stats.forEach(([name,benchKey])=>{
    const prevVal=combineEntryValue(prevEntry,name);
    const latestVal=combineEntryValue(latestEntry,name);
    if(!prevVal||!latestVal) return;
    total+=score(latestVal,benchKey)-score(prevVal,benchKey);
    count++;
  });
  if(!count) return 0;
  return Math.max(0,Math.min(10,Math.round(total/count)));
}
function dailyValueFor(entry,key){
  if(key.startsWith('c:')){
    const name=key.slice(2);
    const a=findActivity(name);
    if(!a) return 0;
    const vals=valuesForActivityMetric(entry.custom&&entry.custom[name],a.metric.key);
    const legacyKey=legacyDailyFieldMap[name];
    if(legacyKey&&entry[legacyKey]!=null&&entry[legacyKey]!=='')vals.push(+entry[legacyKey]);
    if(!vals.length) return 0;
    return a.metric.lowerIsBetter?Math.min(...vals):Math.max(...vals);
  }
  return +entry[key]||0;
}
function combineValueFor(entry,key){
  if(key.startsWith('c:')){
    const name=key.slice(2);
    const a=findActivity(name);
    if(!a) return 0;
    const f=(entry.customCombine||[]).find(x=>x.name===name);
    const vals=f?valuesForActivityMetric(f.values!=null?f.values:f.value,a.metric.key):[];
    const legacyKey=legacyCombineFieldMap[name];
    if(legacyKey&&entry[legacyKey]!=null&&entry[legacyKey]!=='')vals.push(+entry[legacyKey]);
    if(!vals.length) return 0;
    return a.metric.lowerIsBetter?Math.min(...vals):Math.max(...vals);
  }
  return +entry[key]||0;
}
// Round 12: Player Card Gear Locker. lockerItems is a slotted cosmetic
// catalog (frame/background/outfit/prop/faceAccent/title), sold via the
// same availableBalance() pool as rewardMilestones but tracked separately
// (see totalGearXPSpent()) — rewardMilestones stays real-world-only.
// Every slot's free option is the sentinel id 'default' rather than a
// catalog entry, since it's always owned/equippable regardless of slot.
const gearSlotOrder=['frame','background','outfit','prop','faceAccent','title'];
const gearSlotLabels={frame:'Frame',background:'Background',outfit:'Outfit',prop:'Prop',faceAccent:'Face Accent',title:'Title'};
const lockerItems=[
  {id:'blueprint-bg',name:'Blueprint Card Background',slot:'background',xpCost:75,tier:'Common'},
  {id:'stadium-lights-bg',name:'Stadium Lights Background',slot:'background',xpCost:150,tier:'Uncommon'},
  {id:'fire-frame',name:'Fire Player Frame',slot:'frame',xpCost:250,tier:'Rare'},
  {id:'diamond-frame',name:'Diamond Card Border',slot:'frame',xpCost:400,tier:'Legendary'},
  {id:'pinstripe-kit',name:'Pinstripe Kit',slot:'outfit',xpCost:75,tier:'Common'},
  {id:'grip-tape',name:'Grip Tape',slot:'prop',xpCost:150,tier:'Uncommon'},
  {id:'eye-black',name:'Lightning Eye Black',slot:'faceAccent',xpCost:75,tier:'Common'},
  {id:'captain-title',name:'Captain Title',slot:'title',xpCost:250,tier:'Rare'}
];
function findGearItem(id){return lockerItems.find(i=>i.id===id)}
const defaultEquipped={frame:'default',background:'default',outfit:'default',prop:'default',faceAccent:'default',title:'default'};
// Swappable-art-slot lookups, same pattern as tierBadges — missing files
// fall back to a plain placeholder (see avatarLayerHTML/tierBadgeHTML).
const avatarBaseArt='assets/avatar-base.png';
const gearArt={
  'blueprint-bg':'assets/gear-blueprint-bg.png',
  'stadium-lights-bg':'assets/gear-stadium-lights-bg.png',
  'fire-frame':'assets/gear-fire-frame.png',
  'diamond-frame':'assets/gear-diamond-frame.png',
  'pinstripe-kit':'assets/gear-pinstripe-kit.png',
  'grip-tape':'assets/gear-grip-tape.png',
  'eye-black':'assets/gear-eye-black.png'
};

const wheelSegments=[5,10,10,15,20,20,25,25,50,50,100,250,1000];
// Slice size (and therefore landing odds — the wedge angle IS the probability)
// scales down as prize value climbs, so the wheel visually and mathematically
// tells the truth about how rare a prize is: standard/-30%/-50%/-75% width.
function wheelSliceWeight(val){
  if(val>=1000) return 0.25;
  if(val>=250) return 0.5;
  if(val>=50) return 0.7;
  return 1;
}
function wheelSliceAngles(){
  const weights=wheelSegments.map(wheelSliceWeight);
  const total=weights.reduce((a,b)=>a+b,0);
  let acc=0;
  return wheelSegments.map((val,i)=>{
    const width=weights[i]/total*360;
    const start=acc;
    acc+=width;
    return {value:val,width,start};
  });
}

const triviaQuestions=[
  {cat:'History',q:'Which team ended a 108-year championship drought by winning the 2016 World Series?',choices:['Cleveland Indians','Chicago Cubs','Boston Red Sox','Chicago White Sox'],a:1},
  {cat:'History',q:'The Houston Astros won their first World Series title in which year?',choices:['2015','2016','2017','2018'],a:2},
  {cat:'History',q:'Which team swept the Los Angeles Dodgers to win the 2018 World Series?',choices:['New York Yankees','Boston Red Sox','Houston Astros','Atlanta Braves'],a:1},
  {cat:'History',q:'The Washington Nationals won the 2019 World Series. What made it a first in MLB history?',choices:['They won every game of the Series on the road','They swept in 4 games','They came back from a 3-0 deficit','They scored in every inning'],a:0},
  {cat:'History',q:'Because of the COVID-19 pandemic, where was the entire 2020 World Series played?',choices:['Dodger Stadium','Tropicana Field','Globe Life Field in Arlington, TX','Minute Maid Park'],a:2},
  {cat:'History',q:'Which team won the 2020 World Series?',choices:['Tampa Bay Rays','Los Angeles Dodgers','Atlanta Braves','Houston Astros'],a:1},
  {cat:'History',q:'The Atlanta Braves won the 2021 World Series, defeating which team?',choices:['Houston Astros','Los Angeles Dodgers','Milwaukee Brewers','Boston Red Sox'],a:0},
  {cat:'Records',q:'In 2022, Aaron Judge broke the American League single-season home run record with how many home runs?',choices:['59','61','62','65'],a:2},
  {cat:'History',q:"Aaron Judge's 2022 home run record broke a mark set in 1961 by which player?",choices:['Babe Ruth','Mickey Mantle','Roger Maris','Barry Bonds'],a:2},
  {cat:'Records',q:'Albert Pujols became just the fourth player in MLB history to reach 700 career home runs in which season?',choices:['2020','2021','2022','2023'],a:2},
  {cat:'History',q:'Which team won the 2022 World Series?',choices:['Philadelphia Phillies','Houston Astros','New York Yankees','San Diego Padres'],a:1},
  {cat:'History',q:'The Texas Rangers won their first-ever World Series title in which year?',choices:['2021','2022','2023','2024'],a:2},
  {cat:'History',q:'Which team did the Texas Rangers defeat to win the 2023 World Series?',choices:['Philadelphia Phillies','Arizona Diamondbacks','Houston Astros','Atlanta Braves'],a:1},
  {cat:'Rules',q:'MLB introduced the pitch clock to speed up games starting in which season?',choices:['2021','2022','2023','2024'],a:2},
  {cat:'Rules',q:'As part of the 2023 rule changes, how much bigger did the bases become (from 15 inches square)?',choices:['1 inch','2 inches','3 inches','5 inches'],a:2},
  {cat:'Rules',q:'Which 2023 rule change restricted infielders from shifting to the opposite side of second base?',choices:['The shift ban','The bunt rule','The mound visit rule','The extra-inning rule'],a:0},
  {cat:'Records',q:'In 2024, Shohei Ohtani became the first player in MLB history to do what?',choices:['Hit 3 grand slams in one season','Win MVP in both leagues in the same year','Hit 50 home runs and steal 50 bases in one season','Pitch a perfect game and hit a grand slam in the same game'],a:2},
  {cat:'History',q:'Shohei Ohtani signed a record-breaking contract with which team before the 2024 season?',choices:['Los Angeles Angels','Los Angeles Dodgers','New York Yankees','San Francisco Giants'],a:1},
  {cat:'History',q:'Which team won the 2024 World Series?',choices:['New York Yankees','Los Angeles Dodgers','Cleveland Guardians','Milwaukee Brewers'],a:1},
  {cat:'Records',q:'Ronald Acuña Jr. became the first member of the "40-70 club" (40+ home runs, 70+ stolen bases) in which season?',choices:['2021','2022','2023','2024'],a:2},
  {cat:'History',q:'Which star signed a record-setting contract with the New York Mets after the 2024 season?',choices:['Aaron Judge','Juan Soto','Mookie Betts','Freddie Freeman'],a:1},
  {cat:'Records',q:'Which first baseman has won the MLB Home Run Derby three times, including in 2019, 2021, and 2022?',choices:['Vladimir Guerrero Jr.','Kyle Schwarber','Pete Alonso','Joey Gallo'],a:2},
  {cat:'Trivia',q:'Julio Rodríguez won the Home Run Derby in 2023 while playing in front of his home fans in which city?',choices:['Los Angeles','San Diego','Houston','Seattle'],a:3},
  {cat:'Rules',q:'In 2022, MLB expanded its postseason format to how many total teams?',choices:['8','10','12','14'],a:2},
  {cat:'History',q:'The 2022 MLB season began later than usual due to what labor situation?',choices:['A players strike','A lockout','A stadium dispute','A pandemic delay'],a:1},
  {cat:'Awards',q:'Which legendary Yankees shortstop was elected to the Hall of Fame in 2020, falling one vote short of unanimous?',choices:['Alex Rodriguez','Mariano Rivera','Derek Jeter','Jorge Posada'],a:2},
  {cat:'Awards',q:'David Ortiz ("Big Papi") was elected to the Baseball Hall of Fame on the first ballot in which year?',choices:['2021','2022','2023','2024'],a:1},
  {cat:'Awards',q:'Which longtime Mariners star was elected to the Hall of Fame in a near-unanimous vote in 2025?',choices:['CC Sabathia','Félix Hernández','Ichiro Suzuki','Robinson Canó'],a:2},
  {cat:'Records',q:'Justin Verlander threw the third no-hitter of his career in which season?',choices:['2017','2018','2019','2021'],a:2},
  {cat:'History',q:'Which pitcher was the No. 1 overall pick in the 2023 MLB Draft and made a sensational debut for the Pittsburgh Pirates?',choices:['Jackson Holliday','Dylan Crews','Wyatt Langford','Paul Skenes'],a:3},
  {cat:'Awards',q:'Julio Rodríguez won the 2022 American League Rookie of the Year award while playing for which team?',choices:['Baltimore Orioles','Seattle Mariners','Kansas City Royals','Texas Rangers'],a:1},
  {cat:'Awards',q:'Which Baltimore Orioles infielder won the 2023 American League Rookie of the Year award?',choices:['Adley Rutschman','Jackson Holliday','Gunnar Henderson','Jordan Westburg'],a:2},
  {cat:'Awards',q:'Corbin Carroll won the 2023 National League Rookie of the Year award while playing for which team?',choices:['Arizona Diamondbacks','Cincinnati Reds','Miami Marlins','Colorado Rockies'],a:0},
  {cat:'Rules',q:'MLB expanded the active roster from 25 to how many players starting in 2020?',choices:['26','27','28','30'],a:0},
  {cat:'Rules',q:'Starting in the 2022 season, the designated hitter (DH) became permanent in which league, having previously been American League-only?',choices:['American League','National League','Both leagues at once','Minor leagues only'],a:1},
  {cat:'Rules',q:"MLB's extra-innings rule, made permanent in 2023, places a free runner on which base to start each half-inning after the 9th?",choices:['First base','Second base','Third base','Home plate'],a:1},
  {cat:'History',q:"In October 2024, which team's home ballpark, Tropicana Field, was significantly damaged by a hurricane?",choices:['Miami Marlins','Tampa Bay Rays','Houston Astros','Texas Rangers'],a:1},
  {cat:'History',q:'MLB owners approved the relocation of the Oakland Athletics to which city?',choices:['Portland','Nashville','Las Vegas','Salt Lake City'],a:2},
  {cat:'Trivia',q:'In 2019 and 2023, MLB played regular season games in London, England, as part of what initiative?',choices:['The World Baseball Classic','The London Series','The Overseas Cup','MLB Europe Week'],a:1},
  {cat:'Trivia',q:"MLB played its first-ever regular season games in Seoul, South Korea, in which season?",choices:['2022','2023','2024','2025'],a:2},
  {cat:'Trivia',q:"Which team has played 'home' games in Mexico City as part of MLB's international scheduling in recent seasons?",choices:['San Diego Padres','Arizona Diamondbacks','Colorado Rockies','Texas Rangers'],a:0},
  {cat:'Trivia',q:'What is a "golden sombrero" in baseball slang?',choices:['Hitting for the cycle','Striking out four times in one game','Hitting four home runs in one game','Winning MVP and Cy Young in the same year'],a:1},
  {cat:'Stats',q:'What does the pitching statistic "ERA" stand for?',choices:['Extra Run Average','Effective Run Allowance','Earned Run Average','Early Run Analysis'],a:2},
  {cat:'Stats',q:'What does the modern baseball statistic "WAR" measure?',choices:['Weekly At-bat Ratio','Wins Above Replacement','Winning Average Rating','Walks and Runs'],a:1},
  {cat:'Rules',q:'How many balls make up a walk (base on balls)?',choices:['3','4','5','6'],a:1},
  {cat:'Stats',q:'What is it called when a pitcher retires every batter he faces with no one reaching base, for a full 9-inning game?',choices:['A no-hitter','A shutout','A perfect game','An immaculate inning'],a:2},
  {cat:'Stats',q:'What is an "immaculate inning"?',choices:['A batter hits a home run on the first pitch of the game','A pitcher strikes out all 3 batters in an inning on 9 total pitches','A team scores in every inning','A pitcher throws a complete game shutout'],a:1},
  {cat:'Trivia',q:"What is the standard distance from the pitcher's mound to home plate in MLB?",choices:["55 feet","60 feet, 6 inches","66 feet","90 feet"],a:1},
  {cat:'Trivia',q:'How many feet apart are the bases on a standard MLB infield?',choices:['60 feet','75 feet','90 feet','100 feet'],a:2},
  {cat:'Trivia',q:'In 2024, MLB uniforms made by Nike and Fanatics drew criticism from players over what issue?',choices:['Wrong team colors','Missing player names','See-through pants and poor stitching quality','Incorrect logos'],a:2}
];

function todayISO(){return new Date().toISOString().slice(0,10)}
function ensureGameXPDay(){if(!state.gameXP||state.gameXP.date!==todayISO())state.gameXP={date:todayISO(),xp:0}}
function awardGameXP(amount){ensureGameXPDay();const avail=Math.max(0,25-state.gameXP.xp),earned=Math.min(avail,amount);state.gameXP.xp+=earned;save();renderTeamEdition();return earned}
// ---- Arcade storage layer (Round 8) ----
// Sole read/write path for per-game arcade scores/metrics, so a future
// Supabase migration only has to change these functions' internals, not
// every call site in each game's logic.
function getArcadeBest(gameId){return (state.arcadeScores&&state.arcadeScores[gameId]&&state.arcadeScores[gameId].best)||0}
function getWebGemBestReaction(){return state.arcadeScores&&state.arcadeScores.webGem?state.arcadeScores.webGem.bestReaction:null}
function recordArcadeResult(gameId,result){
  state.arcadeScores=state.arcadeScores||{};
  const g=state.arcadeScores[gameId]=state.arcadeScores[gameId]||{best:0};
  const prevBest=g.best||0;
  const isNewBest=result.score>prevBest;
  if(isNewBest) g.best=result.score;
  g.lastPlayed={...result,date:todayISO()};
  save();
  return {isNewBest,best:g.best,prevBest};
}
function updateWebGemReactionBest(ms){
  if(ms==null) return;
  state.arcadeScores=state.arcadeScores||{};
  const g=state.arcadeScores.webGem=state.arcadeScores.webGem||{best:0};
  if(g.bestReaction==null||ms<g.bestReaction) g.bestReaction=ms;
  save();
}
// Round 8 item 21 — HARD CONSTRAINT: arcadeMetrics must never be read by
// ratings()/pr()/score(). It exists only for a possible future "Arcade
// Stats" display, kept strictly separate from the real rating axes.
function recordArcadeMetric(gameId,value){
  state.arcadeMetrics=state.arcadeMetrics||{};
  state.arcadeMetrics[gameId]=Math.max(0,Math.min(100,Math.round(value)));
  save();
}
function missionForToday(){const m=[{title:'Speed Day',tasks:['6 Sprints','40 Shuffle Touches','20 Skater Jumps'],reward:'+40 XP + Mystery Pack'},{title:'Power Day',tasks:['35 Squats','12 Push-ups','10 Broad Jumps'],reward:'+40 XP + Mystery Pack'},{title:'Core Day',tasks:['30 Sit Ups','45-Second Plank','20 Dead Bugs'],reward:'+40 XP + Mystery Pack'},{title:'Baseball IQ Day',tasks:['Strike Zone Challenge','Target Throws','Coach Helper'],reward:'+35 XP + Card Unlock'},{title:'Recovery Day',tasks:['Shoulder Mobility','Hip Mobility','Easy Stretching'],reward:'+25 XP + Rain Token Chance'}];return m[new Date().getDay()%m.length]}
// Round 12 item 9 — HARD RULE: one roll per mission, a mystery gear item OR
// bonus XP, never both. Falls back to XP if every item is already owned (or
// the roll simply lands on XP) so a completed mission never wastes a dupe.
function rollDailyMissionReward(){
  const owned=state.inventory||['default'];
  const unowned=lockerItems.filter(i=>!owned.includes(i.id));
  if(unowned.length&&Math.random()<0.5){
    const item=unowned[Math.floor(Math.random()*unowned.length)];
    state.inventory=state.inventory||['default'];
    state.inventory.push(item.id);
    return {type:'item',item};
  }
  return {type:'xp',xp:40};
}
async function completeDailyMission(){
  if(!activeAthlete){alert('Sign in and select an athlete before completing today’s mission.');return}
  const m=missionForToday();
  let result;
  try{
    result=await completeDailyMissionRemote(activeAthlete.id,m.title);
  }catch(err){
    alert(err.message==='mission already complete today'?'Today’s mission is already complete.':('Could not complete mission: '+(err.message||'unknown error')));
    return;
  }
  await refreshAthleteState();
  if(result.type==='xp'){
    alert(`Mission complete! +${result.xp} XP.`);
  }else{
    const item=findGearItem(result.item_id);
    alert(`Mission complete! You unlocked ${item?item.name:'a new item'} for your Gear Locker.`);
  }
  render();
}
// Round 12 items 4-5: instant, no-PIN cosmetic purchase (unlike claimReward()'s
// real-world flow) — buying is permanent, equipping is always free including
// switching back to Default. Phase B: both now go through Supabase.
async function buyGearItem(itemId){
  if(!activeAthlete){alert('Sign in and select an athlete before visiting the Gear Locker.');return}
  const item=findGearItem(itemId);
  if(!item) return;
  if((state.inventory||['default']).includes(itemId)){alert(`${item.name} is already unlocked.`);return}
  const balance=availableBalance();
  if(balance<item.xpCost){alert(`Not enough balance to buy ${item.name}. You need ${item.xpCost} XP and have ${balance}.`);return}
  try{
    await buyGearItemRemote(activeAthlete.id,itemId);
  }catch(err){
    alert('Could not complete purchase: '+(err.message||'unknown error'));
    return;
  }
  await refreshAthleteState();
  alert(`${item.name} unlocked! -${item.xpCost} XP.`);
  render();
}
async function equipGearItem(slot,itemId){
  if(!activeAthlete) return;
  if(itemId!=='default'){
    const item=findGearItem(itemId);
    if(!item||item.slot!==slot||!(state.inventory||[]).includes(itemId)) return;
  }
  try{
    await equipGearItemRemote(activeAthlete.id,slot,itemId);
  }catch(err){
    alert('Could not update equipped gear: '+(err.message||'unknown error'));
    return;
  }
  state.equipped=state.equipped||{...defaultEquipped};
  state.equipped[slot]=itemId;
  render();
}
function useRainToken(){state.rainTokens=state.rainTokens??1;if(state.rainTokens<=0){alert('No Rain Delay Tokens available.');return}state.rainTokens-=1;state.bonuses=state.bonuses||[];state.bonuses.push({date:todayISO(),type:'Rain Delay Token',xp:0,reason:'Streak protected'});save();alert('Streak protected for one missed day.');renderTeamEdition()}
function renderMission(){const m=missionForToday();if($('#missionTitle'))$('#missionTitle').textContent=m.title;if($('#missionTasks'))$('#missionTasks').innerHTML='<ul>'+m.tasks.map(t=>`<li>☐ ${t}</li>`).join('')+'</ul>';if($('#missionReward'))$('#missionReward').textContent=m.reward;if($('#streakLarge'))$('#streakLarge').textContent=streak();if($('#rainTokens'))$('#rainTokens').textContent=state.rainTokens??1}
// Round 12 items 4-5: shop grouped by slot (buy) + equip controls grouped
// by slot (always free, always includes Default). Replaces the old dead
// renderLocker(), which targeted a #lockerInventory element that never
// existed anywhere in index.html.
function renderGearLocker(){
  const inv=state.inventory||['default'];
  const equipped=state.equipped||defaultEquipped;
  const balance=availableBalance();
  if($('#gearShop')){
    $('#gearShop').innerHTML=gearSlotOrder.map(slot=>{
      const items=lockerItems.filter(i=>i.slot===slot);
      if(!items.length) return '';
      return `<div class="gear-slot-group"><h4>${gearSlotLabels[slot]}</h4><div class="reward-grid">${items.map(item=>{
        const owned=inv.includes(item.id);
        const afford=balance>=item.xpCost;
        return `<div class="reward-tile ${owned?'unlocked':''}">
          <span class="reward-tier-badge tier-${item.tier.toLowerCase()}">${item.tier}</span>
          <h3>${item.name}</h3>
          <p><strong>${item.xpCost} XP</strong></p>
          ${owned?'<strong>Owned</strong>':`<button type="button" class="primary buy-gear-btn" data-item="${item.id}" ${afford?'':'disabled'}>${afford?'Buy':'Not enough XP'}</button>`}
        </div>`;
      }).join('')}</div></div>`;
    }).join('');
  }
  if($('#gearEquip')){
    $('#gearEquip').innerHTML=gearSlotOrder.map(slot=>{
      const ownedInSlot=lockerItems.filter(i=>i.slot===slot&&inv.includes(i.id));
      const options=[{id:'default',name:slot==='title'?'No Title':'Default'},...ownedInSlot];
      return `<div class="gear-equip-row"><span>${gearSlotLabels[slot]}</span><div class="gear-equip-options">${options.map(o=>`<button type="button" class="gear-equip-btn ${equipped[slot]===o.id?'active':''}" data-slot="${slot}" data-item="${o.id}">${o.name}</button>`).join('')}</div></div>`;
    }).join('');
  }
}
// Phase C: sourced from currentTeamRoster (get_team_roster() RPC — name +
// aggregate XP/participation only, the narrowed coach-view data), cached by
// refreshTeamMembershipUI() and repainted here synchronously so this can
// stay in the render() chain without refetching on every render.
function renderLeaderboard(){
  if(!$('#teamLeaderboard')) return;
  const metric=$('#leaderboardMetric')?.value||'xp';
  const rows=(currentTeamRoster||[]).filter(r=>r.status==='approved');
  const sorted=[...rows].sort((a,b)=>metric==='workouts'?(b.workout_count||0)-(a.workout_count||0):(b.total_xp||0)-(a.total_xp||0));
  const label=metric==='workouts'?'Workouts':'XP';
  $('#teamLeaderboard').innerHTML=`<table class="table"><thead><tr><th>#</th><th>Athlete</th><th>${label}</th></tr></thead><tbody>${sorted.map((r,i)=>`<tr><td>${i+1}</td><td>${r.display_name}</td><td>${metric==='workouts'?(r.workout_count||0):(r.total_xp||0)}</td></tr>`).join('')}</tbody></table>`;
}
// Phase C: the old fake feed named specific "teammates" doing things that
// never happened — misleading now that real teammates exist. No activity
// feed table exists yet, so this is an honest placeholder, not a real
// migration, until a future round adds one.
function renderTeamFeed(){if(!$('#teamFeed'))return;$('#teamFeed').innerHTML='<p class="muted">Team activity feed is coming in a future update.</p>'}
// Positive Reactions and Coach/Parent Shout-Outs are one unified feed —
// both are positive-only entries in state.shoutouts, distinguished by
// `source` only for icon rendering.
function renderShoutouts(){
  if(!$('#shoutouts'))return;
  const demo=[{type:'Great Hustle',from:'Coach',date:'Today',source:'shoutout'},{type:'Great Attitude',from:'Dad',date:'Yesterday',source:'shoutout'}];
  $('#shoutouts').innerHTML=[...demo,...(state.shoutouts||[])].slice(-8).reverse().map(x=>{
    let icon='🏅',label=x.type;
    if(x.source==='reaction'){const parts=x.type.split(' ');icon=parts[0];label=parts.slice(1).join(' ')}
    return `<div class="shoutout"><span>${icon}</span><div><strong>${label}</strong><br><small>${x.from} · ${x.date}</small></div></div>`;
  }).join('');
}
function addShoutout(){state.shoutouts=state.shoutouts||[];state.shoutouts.push({type:$('#shoutoutType').value,from:$('#shoutoutFrom').value,date:todayISO(),source:'shoutout'});save();renderShoutouts()}
function addReaction(text){state.shoutouts=state.shoutouts||[];state.shoutouts.push({type:text,from:'You',date:todayISO(),source:'reaction'});save();renderShoutouts()}
// ---- Personal Programs ----
// A Program is {id, name, activityIds[], preset?:true}. Preset programs ship
// locked/read-only (seeded once by seedPresetPrograms) and can be used for
// logging but never edited or deleted. Personal programs go through an
// explicit draft/save workflow: state.draftProgram holds in-progress edits
// (new or existing) and is only committed to state.programs on Save; the
// Skill Lab Add button is only enabled while a draft is active.
function findProgram(id){return (state.programs||[]).find(p=>p.id===id)}
function personalPrograms(){return (state.programs||[]).filter(p=>!p.preset)}
function presetPrograms(){return (state.programs||[]).filter(p=>p.preset)}
function startNewProgramDraft(){
  state.draftProgram={id:null,name:'',activityIds:[]};
  renderProgramBuilder();
  renderExerciseLibrary();
}
function startEditProgramDraft(id){
  const p=findProgram(id);
  if(!p||p.preset) return;
  state.draftProgram={id:p.id,name:p.name,activityIds:[...p.activityIds]};
  renderProgramBuilder();
  renderExerciseLibrary();
}
function discardProgramDraft(){
  state.draftProgram=null;
  renderProgramBuilder();
  renderExerciseLibrary();
}
function saveProgramDraft(name){
  const draft=state.draftProgram;
  if(!draft) return;
  const finalName=(name||draft.name||'').trim();
  if(!finalName){alert('Give your program a name before saving.');return}
  if(!draft.activityIds.length){alert('Add at least one activity before saving.');return}
  state.programs=state.programs||[];
  if(draft.id){
    const p=findProgram(draft.id);
    if(p){p.name=finalName;p.activityIds=draft.activityIds}
  }else{
    const p={id:'prog_'+Date.now()+'_'+Math.floor(Math.random()*1000),name:finalName,activityIds:draft.activityIds};
    state.programs.push(p);
    if(!state.activeProgramId) state.activeProgramId=p.id;
  }
  state.draftProgram=null;
  save();
  renderProgramBuilder();
  renderExerciseLibrary();
  renderDailyProgramPicker();
  renderDailyCustomFields();
  renderCombineProgramPicker();
}
function addActivityToDraft(name){
  const a=findActivity(name);
  if(!a||!state.draftProgram) return;
  if(state.draftProgram.activityIds.includes(a.id)){alert(`${a.name} is already in this program.`);return}
  state.draftProgram.activityIds.push(a.id);
  renderProgramBuilder();
  renderExerciseLibrary();
  if($('#activityDetailModal')) $('#activityDetailModal').classList.add('hidden');
}
function removeActivityFromDraft(activityId){
  if(!state.draftProgram) return;
  state.draftProgram.activityIds=state.draftProgram.activityIds.filter(id=>id!==activityId);
  renderProgramBuilder();
  renderExerciseLibrary();
}
function deleteProgram(id){
  const p=findProgram(id);
  if(!p||p.preset) return;
  if(!confirm(`Delete "${p.name}"? This can't be undone.`)) return;
  state.programs=state.programs.filter(x=>x.id!==id);
  if(state.activeProgramId===id) state.activeProgramId=null;
  if(state.draftProgram&&state.draftProgram.id===id) state.draftProgram=null;
  save();
  renderProgramBuilder();
  renderExerciseLibrary();
  renderDailyProgramPicker();
  renderDailyCustomFields();
  renderCombineProgramPicker();
}
function renderProgramBuilder(){
  const body=$('#programBuilderBody'); if(!body) return;
  const draft=state.draftProgram;
  const presets=presetPrograms();
  const personal=personalPrograms();
  const programTile=(p,editable)=>`<div class="program-tile${p.preset?' preset':''}">${p.preset?'<span class="lock-badge">🔒 Preset</span>':''}<h3>${p.name}</h3><ul>${p.activityIds.map(id=>{const a=findActivityById(id);return a?`<li>${a.name}</li>`:''}).join('')}</ul>${editable?`<div class="program-tile-actions"><button type="button" class="edit-program-btn" data-program="${p.id}">Edit</button><button type="button" class="delete-program-btn" data-program="${p.id}">Delete</button></div>`:''}</div>`;
  const presetHTML=presets.length?`<p class="eyebrow dark">Preset Programs</p><div class="program-list">${presets.map(p=>programTile(p,false)).join('')}</div>`:'';
  const personalHTML=`<p class="eyebrow dark">Your Programs</p>${personal.length?`<div class="program-list">${personal.map(p=>programTile(p,true)).join('')}</div>`:'<p class="muted">No programs yet — click "+ New Program" to build one.</p>'}`;
  const draftHTML=draft?`
    <div class="program-draft-editor">
      <p class="eyebrow dark">${draft.id?'Editing Program':'New Program'}</p>
      <label class="wide">Program name<input type="text" id="draftProgramName" value="${draft.name||''}" placeholder="e.g. Baseball Exercise Program"></label>
      <div id="draftActivityList" class="program-activity-list">${draft.activityIds.length?'<ul class="program-activity-items">'+draft.activityIds.map(id=>{const a=findActivityById(id);return a?`<li>${a.name}<button type="button" class="remove-draft-activity" data-activity="${id}">Remove</button></li>`:''}).join('')+'</ul>':'<p class="muted">No activities yet — use Add on any Skill Lab exercise below.</p>'}</div>
      <div class="program-draft-actions"><button type="button" id="saveProgramDraftBtn" class="primary">Save Program</button><button type="button" id="discardProgramDraftBtn">Discard</button></div>
    </div>`:'<button id="newProgramBtn" type="button">+ New Program</button>';
  body.innerHTML=presetHTML+personalHTML+draftHTML;
}
function renderExerciseLibrary(){
  if(!$('#libraryCategory'))return;
  if(!$('#libraryCategory').options.length)$('#libraryCategory').innerHTML=categoryOrder.map(c=>`<option>${c}</option>`).join('');
  const cat=$('#libraryCategory').value||categoryOrder[0];
  if($('#goalChips'))$('#goalChips').innerHTML=goalChipDefs.map(g=>`<button type="button" class="goal-chip${g.category===cat?' active':''}" data-category="${g.category}">${g.icon} ${g.label}</button>`).join('');
  const draft=state.draftProgram;
  $('#exerciseLibrary').innerHTML=activities.filter(a=>a.category===cat).map(a=>{
    const inDraft=!!(draft&&draft.activityIds.includes(a.id));
    const label=!draft?'Start a Program':(inDraft?'In Program':'Add');
    return `<div class="library-card${inDraft?' active':''}"><span>${categoryIcons[cat]||'⭐'}</span><strong>${a.name}</strong><div class="library-card-actions"><button type="button" class="view-activity-btn" data-exercise="${a.name}">View</button><button type="button" class="add-exercise-btn" data-exercise="${a.name}" ${(!draft||inDraft)?'disabled':''}>${label}</button></div></div>`;
  }).join('');
}
function whyTrackLine(category){
  if(category==='Mobility') return 'Recovery and mobility work — not tied to a Player Card rating, but keeps you ready to train.';
  const axis=categoryAxisMap[category];
  const axisLabel=(axisLabels[axis]||'training consistency');
  return `We log this so we can chart your ${axisLabel} rating on the Player Card.`;
}
function renderActivityDetail(name){
  const a=findActivity(name);
  if(!a || !$('#activityDetailModal')) return;
  const media=a.media||emptyMedia();
  const perform=media.instructionText
    ?`<p>${media.instructionText}</p>${media.formCues&&media.formCues.length?`<h4>Form Cues</h4><ul>${media.formCues.map(c=>`<li>${c}</li>`).join('')}</ul>`:''}${media.commonFaults&&media.commonFaults.length?`<h4>Watch For</h4><ul class="fault-list">${media.commonFaults.map(c=>`<li>${c}</li>`).join('')}</ul>`:''}`
    :`<div class="placeholder-card">Written instructions coming soon</div>`;
  const video=`<div class="video-placeholder"><span class="play-glyph">▶</span><p>Demo video coming soon</p></div>`;
  const legend=`<div class="metric-legend-item"><strong>${a.metric.label}</strong><span>${a.metric.unit||'—'}</span></div>`;
  const draft=state.draftProgram;
  const inDraft=!!(draft&&draft.activityIds.includes(a.id));
  const addLabel=!draft?'Start a Program':(inDraft?'In Program':'Add to Program');
  $('#activityDetailContent').innerHTML=`
    <p class="eyebrow dark">${a.category}</p>
    <h2>${a.name}</h2>
    <h3>How to Perform</h3>${perform}
    <h3>Demo Video</h3>${video}
    <h3>How to Track</h3>
    <div class="metric-legend">${legend}</div>
    <p class="muted">${whyTrackLine(a.category)}</p>
    <button type="button" class="primary add-exercise-btn" data-exercise="${a.name}" ${(!draft||inDraft)?'disabled':''}>${addLabel}</button>
  `;
  $('#activityDetailModal').classList.remove('hidden');
}
// Single-value field (Combine Testing — one snapshot per activity) with a
// persistent unit badge so the unit stays visible while typing.
function metricInputHTML(fieldName,activityName,metric){
  const step=metric.step!=null?metric.step:(metric.inputType==='decimal'?0.01:1);
  const min=metric.min!=null?` min="${metric.min}"`:'';
  return `<div class="metric-field"><span class="metric-field-label">${activityName} · ${metric.label}</span><div class="unit-input"><input type="number" name="${fieldName}" step="${step}"${min} placeholder="0"><span class="unit-badge">${metric.unit||''}</span></div></div>`;
}
// Daily/Team Check-In: repeatable per-set field for one activity, e.g. three
// sets of push-ups logged as three separate values. Counts are transient UI
// state (not persisted) so "+ Add Set" can grow a block without a full re-render.
let dailySetCounts={};
let teamSetCounts={};
function setInputHTML(prefix,activityId,activityName,metric,index){
  const step=metric.step!=null?metric.step:(metric.inputType==='decimal'?0.01:1);
  const min=metric.min!=null?` min="${metric.min}"`:'';
  return `<div class="metric-field"><span class="metric-field-label">${activityName} · Set ${index+1}</span><div class="unit-input"><input type="number" name="${prefix}_${activityId}_${index}" step="${step}"${min} placeholder="0"><span class="unit-badge">${metric.unit||''}</span></div></div>`;
}
function activitySetBlockHTML(prefix,a,counts){
  const n=counts[a.id]||1;
  const rows=Array.from({length:n},(_,i)=>setInputHTML(prefix,a.id,a.name,a.metric,i)).join('');
  return `<div class="activity-set-block" data-activity="${a.id}"><h4>${a.name}</h4>${rows}<button type="button" class="add-set-btn" data-prefix="${prefix}" data-activity="${a.id}">+ Add Set</button></div>`;
}
// Daily Check-In: which personal (or preset) program is being logged today.
function renderDailyProgramPicker(){
  const c=$('#dailyProgramPicker'); if(!c) return;
  const progs=state.programs||[];
  if(!progs.length){
    c.innerHTML='<p class="muted">You haven\'t built a program yet.</p><button type="button" id="goToBuilderBtn">+ Build a Program</button>';
    return;
  }
  if(!state.activeProgramId || !findProgram(state.activeProgramId)) state.activeProgramId=progs[0].id;
  if(progs.length===1){
    c.innerHTML=`<p class="muted">Logging for: <strong>${progs[0].name}</strong></p>`;
    return;
  }
  c.innerHTML=`<label>Logging for which program?<select id="dailyProgramSelect">${progs.map(p=>`<option value="${p.id}" ${p.id===state.activeProgramId?'selected':''}>${p.name}${p.preset?' (Preset)':''}</option>`).join('')}</select></label><button type="button" id="goToBuilderBtn">+ Build Another Program</button>`;
}
function renderDailyCustomFields(){
  const c=$('#dailyCustomFields'); if(!c) return;
  const prog=findProgram(state.activeProgramId);
  dailySetCounts={};
  if(!prog||!prog.activityIds.length){c.innerHTML='<p class="muted">Build a program in Skill Lab to see activities here.</p>';return}
  c.innerHTML=prog.activityIds.map(id=>{
    const a=findActivityById(id);
    return a?activitySetBlockHTML('set',a,dailySetCounts):'';
  }).join('');
}
// Combine Testing: a parent/coach picks which program is being tested, then
// gets one single-value field per activity in it — a benchmark snapshot, not
// a workout log, so no "Add Set" here (unlike Daily/Team Check-In).
function combineProgramOptions(){
  const opts=(state.programs||[]).map(p=>({id:p.id,name:p.name,activities:p.activityIds.map(findActivityById).filter(Boolean)}));
  if(currentTeamProgram&&currentTeamProgramOptedIn){
    opts.push({id:'team',name:currentTeamProgram.title,activities:currentTeamProgram.activity_names.map(findActivity).filter(Boolean)});
  }
  return opts;
}
function renderCombineProgramPicker(){
  const sel=$('#combineProgramSelect'); if(!sel) return;
  const opts=combineProgramOptions();
  if(!opts.length){
    sel.innerHTML='<option value="">Build a program first</option>';
    renderCombineProgramFields();
    return;
  }
  const current=sel.value;
  sel.innerHTML=opts.map(o=>`<option value="${o.id}">${o.name}</option>`).join('');
  sel.value=opts.some(o=>o.id===current)?current:opts[0].id;
  renderCombineProgramFields();
}
function renderCombineProgramFields(){
  const c=$('#combineProgramFields'); if(!c) return;
  const sel=$('#combineProgramSelect');
  const chosen=combineProgramOptions().find(o=>o.id===(sel?sel.value:''));
  c.innerHTML=chosen&&chosen.activities.length
    ?chosen.activities.map(a=>metricInputHTML(`combineProgram_${a.id}_${a.metric.key}`,a.name,a.metric)).join('')
    :'<p class="muted">No activities in this program yet.</p>';
}
document.addEventListener('click',e=>{
  const addSetBtn=e.target.closest('.add-set-btn');
  if(addSetBtn){
    const prefix=addSetBtn.dataset.prefix, actId=addSetBtn.dataset.activity;
    const counts=prefix==='set'?dailySetCounts:(prefix==='teamset'?teamSetCounts:null);
    const a=findActivityById(actId);
    if(counts&&a){
      const index=counts[actId]||1;
      counts[actId]=index+1;
      addSetBtn.insertAdjacentHTML('beforebegin',setInputHTML(prefix,actId,a.name,a.metric,index));
    }
  }
});
document.addEventListener('change',e=>{
  if(e.target.id==='dailyProgramSelect'){state.activeProgramId=e.target.value;save();renderDailyCustomFields()}
  if(e.target.id==='combineProgramSelect') renderCombineProgramFields();
});
document.addEventListener('click',e=>{
  const addBtn=e.target.closest('.add-exercise-btn');
  if(addBtn && !addBtn.disabled) addActivityToDraft(addBtn.dataset.exercise);
  const viewBtn=e.target.closest('.view-activity-btn');
  if(viewBtn) renderActivityDetail(viewBtn.dataset.exercise);
  if(e.target.id==='closeActivityDetail' || e.target.id==='activityDetailModal') $('#activityDetailModal').classList.add('hidden');
  if(e.target.id==='newProgramBtn') startNewProgramDraft();
  if(e.target.id==='saveProgramDraftBtn'){const nameInput=$('#draftProgramName');saveProgramDraft(nameInput?nameInput.value:'')}
  if(e.target.id==='discardProgramDraftBtn'){if(confirm('Discard this program without saving?')) discardProgramDraft()}
  const editBtn=e.target.closest('.edit-program-btn');
  if(editBtn) startEditProgramDraft(editBtn.dataset.program);
  const delBtn=e.target.closest('.delete-program-btn');
  if(delBtn) deleteProgram(delBtn.dataset.program);
  const rmDraftBtn=e.target.closest('.remove-draft-activity');
  if(rmDraftBtn) removeActivityFromDraft(rmDraftBtn.dataset.activity);
  if(e.target.id==='goToBuilderBtn') switchScreen('library');
});
// ---- Team Identity (Phase C) ----
// Real team join is now request -> pending -> coach approve/decline
// (team_members.status), not an instant local unlock. Team data comes from
// Supabase (teams/team_members), scoped to the active athlete's own
// membership row. coachTeam (below, in the auth block) is a SEPARATE
// concept — the team a signed-in coach profile owns/manages — since a
// person can be both a parent and a coach at once, and those are different
// identities in the data model.
let athleteTeamMembership=null, currentTeamXpTotals=null, currentTeamRank=null, currentTeamRankTotal=null, currentTeamRoster=[];
function generateTeamJoinCode(){
  return Math.random().toString(36).slice(2,8).toUpperCase();
}
function teamLogoHTML(sizeClass,team){
  if(team&&team.logo_url){
    return `<img src="${team.logo_url}" alt="${team.name||'Team'} logo" class="team-logo ${sizeClass||''}">`;
  }
  const inner=team&&team.name?team.name.trim().charAt(0).toUpperCase():'<span class="lua-icon icon-team" aria-hidden="true"></span>';
  return `<div class="team-logo-fallback ${sizeClass||''}">${inner}</div>`;
}
// Synchronous repaint from cached state (athleteTeamMembership/
// currentTeamRoster/currentTeamXpTotals/currentTeamRank*, populated by the
// async refreshTeamMembershipUI() below) — safe to call from the render()
// chain on every mutation without refetching from Supabase each time.
function renderTeamIdentity(){
  const m=athleteTeamMembership;
  const approved=!!(m&&m.status==='approved');
  const joinCard=$('#teamJoinCard'), heroCard=$('#teamHeroCard'), statsGrid=$('#teamStatsGrid'), boardsGrid=$('#teamBoardsGrid');
  if(joinCard) joinCard.classList.toggle('hidden',approved);
  if(heroCard) heroCard.classList.toggle('hidden',!approved);
  if(statsGrid) statsGrid.classList.toggle('hidden',!approved);
  if(boardsGrid) boardsGrid.classList.toggle('hidden',!approved);
  if(!approved){
    const formFields=$('#teamJoinFormFields');
    if(m&&m.status==='pending'){
      if(formFields) formFields.classList.add('hidden');
      if($('#teamJoinStatus')) $('#teamJoinStatus').textContent=`Request sent to "${m.teams?.name||'the team'}" — waiting for coach approval.`;
    }else{
      if(formFields) formFields.classList.remove('hidden');
      if($('#teamJoinStatus')) $('#teamJoinStatus').textContent=m&&m.status==='declined'?'Your last request was declined. You can try again.':m&&m.status==='left'?`You left "${m.teams?.name||'your last team'}". You can join a new team below.`:'';
    }
  }
  const pathLogo=$('#pathCardTeamLogo');
  if(pathLogo) pathLogo.innerHTML=teamLogoHTML('team-logo-path',approved?m.teams:null);
  if(!approved) return;
  const heroName=$('#teamHeroName'); if(heroName) heroName.textContent=m.teams?.name||'Your Team';
  const heroLogo=$('#teamHeroLogo'); if(heroLogo) heroLogo.innerHTML=teamLogoHTML('team-logo-hero',m.teams);
  if($('#teamStatXP')) $('#teamStatXP').textContent=currentTeamXpTotals?currentTeamXpTotals.team_xp:0;
  if($('#teamStatRoster')) $('#teamStatRoster').textContent=currentTeamXpTotals?currentTeamXpTotals.athlete_count:0;
  if($('#teamStatRank')) $('#teamStatRank').textContent=currentTeamRank||'—';
  if($('#teamStatRankOf')) $('#teamStatRankOf').textContent=currentTeamRankTotal?`of ${currentTeamRankTotal}`:'';
  if($('#teamHeroMeta')) $('#teamHeroMeta').textContent=`${currentTeamXpTotals?currentTeamXpTotals.athlete_count:0} Athletes`;
  const approvedRoster=(currentTeamRoster||[]).filter(r=>r.status==='approved');
  const weekMs=7*24*60*60*1000, now=Date.now();
  const activeThisWeek=approvedRoster.filter(r=>r.last_workout_date&&(now-new Date(r.last_workout_date).getTime())<=weekMs).length;
  if($('#teamStatCompletion')) $('#teamStatCompletion').textContent=(approvedRoster.length?Math.round(activeThisWeek/approvedRoster.length*100):0)+'%';
}
// Async: fetches the active athlete's membership + (if approved) roster/
// totals/rank, caches them, then repaints. Called on athlete select and
// after a join request — NOT from the general render() chain.
// Visible on-page status (not just console) — this data layer has been hard
// to diagnose remotely (RLS-on-view surprises, silent hangs), so any
// failure here is surfaced directly in the Team HQ card instead of only
// failing silently to "0". A 10s timeout turns a hung request into a
// readable message instead of an indefinite blank stat.
function withTimeout(promise,ms,label){
  return Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} timed out after ${ms/1000}s`)),ms))
  ]);
}
async function refreshTeamMembershipUI(){
  if(!activeAthlete) return;
  const statusEl=$('#teamStatsStatus');
  if(statusEl) statusEl.textContent='';
  try{
    athleteTeamMembership=await withTimeout(getAthleteTeamMembership(activeAthlete.id),10000,'Loading team membership');
    const approved=athleteTeamMembership&&athleteTeamMembership.status==='approved';
    if(approved){
      const teamId=athleteTeamMembership.teams.id;
      const [totals,ranked,roster]=await withTimeout(Promise.all([
        loadTeamXpTotals(teamId), loadAllTeamXpTotalsRanked(), loadTeamRoster(teamId)
      ]),10000,'Loading team stats');
      currentTeamXpTotals=totals;
      currentTeamRoster=roster;
      const rankIndex=ranked.findIndex(t=>t.team_id===teamId);
      currentTeamRank=rankIndex>=0?rankIndex+1:null;
      currentTeamRankTotal=ranked.length;
    }else{
      currentTeamXpTotals=null; currentTeamRoster=[]; currentTeamRank=null; currentTeamRankTotal=null;
    }
  }catch(err){
    currentTeamXpTotals=null; currentTeamRoster=[]; currentTeamRank=null; currentTeamRankTotal=null;
    if(statusEl) statusEl.textContent='Could not load team stats: '+(err&&err.message?err.message:String(err));
  }
  renderTeamIdentity();
  renderLeaderboard();
  await refreshTeamProgramForAthlete();
}
async function joinTeamIdentity(){
  if(!activeAthlete){alert('Sign in and select an athlete first.');return}
  const codeInput=$('#teamJoinCodeInput');
  const code=(codeInput?codeInput.value:'').trim();
  if(!code){if($('#teamJoinStatus'))$('#teamJoinStatus').textContent='Enter a join code.';return}
  try{
    await requestTeamJoinForAthlete(activeAthlete.id,code);
  }catch(err){
    if($('#teamJoinStatus'))$('#teamJoinStatus').textContent=err.message||'Could not send join request.';
    return;
  }
  if(codeInput) codeInput.value='';
  await refreshTeamMembershipUI();
}
// ---- Coach Team Setup (Phase C) ----
// Operates on the signed-in profile's OWN team (coach_profile_id=auth.uid(),
// enforced by RLS) — no shared code anymore, real identity via the session.
async function saveTeamSetup(){
  if(!currentProfile){alert('Sign in first.');return}
  const name=$('#teamNameInput').value.trim();
  if(!name){alert('Enter a team name.');return}
  const pin=await showPinModal('save your team setup');
  if(!pin) return;
  let pinOk=false;
  try{ pinOk=await verifyApprovalPinRemote(pin); }catch(err){ /* treat as failed */ }
  if(!pinOk){alert('Incorrect PIN.');return}
  let created=null,lastErr=null;
  for(let attempt=0;attempt<5&&!created;attempt++){
    try{ created=await createTeam(currentProfile.id,name,generateTeamJoinCode()); }
    catch(err){ lastErr=err; if(!/duplicate key|unique/i.test(err.message||'')) break; }
  }
  if(!created){alert('Could not save team: '+(lastErr?.message||'unknown error'));return}
  coachTeams.push(created);
  coachTeam=created;
  $('#teamNameInput').value='';
  if($('#teamSetupStatus')) $('#teamSetupStatus').textContent=`Saved "${created.name}". Join code: ${created.join_code}`;
  renderTeamSetupPanel();
  renderCoachOnlyVisibility();
  await renderPendingTeamRequests();
}
async function handleTeamLogoUpload(file){
  if(!file||!coachTeam) return;
  const r=new FileReader();
  r.onload=async()=>{
    try{
      await updateTeamLogo(coachTeam.id,r.result);
      coachTeam.logo_url=r.result;
      if($('#teamSetupStatus')) $('#teamSetupStatus').textContent='Logo updated.';
      if(activeAthlete) await refreshTeamMembershipUI();
    }catch(err){
      alert('Could not save logo: '+(err.message||'unknown error'));
    }
  };
  r.readAsDataURL(file);
}
// A coach can run more than one team — createFields stays available even
// once coachTeam is set (button relabels to "+ Create Another Team"), and
// coachTeamSwitcher (shown only once there are 2+) picks which one every
// other Coach Tools card (pending requests, team program, league join)
// operates on.
function renderTeamSetupPanel(){
  const createFields=$('#teamSetupCreateFields'), existing=$('#teamSetupExisting'), pending=$('#teamSetupPendingApproval');
  if(!createFields) return;
  const approved=!!(currentProfile&&currentProfile.coach_approved);
  if(pending) pending.classList.toggle('hidden',approved);
  createFields.classList.toggle('hidden',!approved);
  if(!approved){
    if(existing) existing.classList.add('hidden');
    return;
  }
  if($('#saveTeamSetup')) $('#saveTeamSetup').textContent=coachTeam?'+ Create Another Team':'Create Team + Generate Join Code';
  if(coachTeam){
    if(existing){
      existing.classList.remove('hidden');
      $('#teamSetupName').textContent=coachTeam.name;
      $('#teamSetupJoinCode').textContent=coachTeam.join_code;
    }
    const switcherWrap=$('#coachTeamSwitcherWrap'), switcher=$('#coachTeamSwitcher');
    if(switcherWrap&&switcher){
      switcherWrap.classList.toggle('hidden',coachTeams.length<2);
      switcher.innerHTML=coachTeams.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
      switcher.value=coachTeam.id;
    }
  }else{
    if(existing) existing.classList.add('hidden');
  }
}
async function joinLeagueAction(){
  if(!coachTeam){return}
  const code=$('#leagueJoinCodeInput').value.trim();
  if(!code){if($('#leagueJoinStatus'))$('#leagueJoinStatus').textContent='Enter a league code.';return}
  try{
    const result=await joinLeagueForTeam(coachTeam.id,code);
    coachTeam.league_id=result?.result_league_id;
    if($('#leagueJoinStatus')) $('#leagueJoinStatus').textContent=`Joined "${result?.result_league_name||'the league'}"!`;
    $('#leagueJoinCodeInput').value='';
    if(activeAthlete) await refreshTeamMembershipUI();
  }catch(err){
    if($('#leagueJoinStatus')) $('#leagueJoinStatus').textContent=err.message||'Could not join league.';
  }
}
async function renderPendingTeamRequests(){
  const list=$('#pendingRequestsList');
  if(!list||!coachTeam) return;
  const rows=await loadPendingRequestsForTeam(coachTeam.id);
  list.innerHTML=rows.length?rows.map(r=>`<div class="pending-request-row"><span>${r.athletes?.display_name||'Athlete'}</span><button class="primary" data-approve="${r.id}" type="button">Approve</button><button class="danger" data-decline="${r.id}" type="button">Decline</button></div>`).join(''):'<p class="muted">No pending requests.</p>';
}
async function decideTeamJoinAction(teamMemberId,approve){
  try{
    await decideTeamJoinRemote(teamMemberId,approve);
    await renderPendingTeamRequests();
    await renderTeamRoster();
  }catch(err){
    alert('Could not update request: '+(err.message||'unknown error'));
  }
}
// Coach's roster management list — sourced from the same narrowed
// get_team_roster() RPC the athlete-side leaderboard uses (name + aggregate
// XP/participation only), filtered to currently-approved members.
async function renderTeamRoster(){
  const list=$('#teamRosterList');
  if(!list||!coachTeam) return;
  const rows=(await loadTeamRoster(coachTeam.id)).filter(r=>r.status==='approved');
  list.innerHTML=rows.length?rows.map(r=>`<div class="pending-request-row"><span>${r.display_name}</span><button class="danger" data-remove="${r.athlete_id}" data-name="${r.display_name}" type="button">Remove</button></div>`).join(''):'<p class="muted">No athletes on the roster yet.</p>';
}
// Sets team_members.status to 'left' — a soft removal, same tier as
// archiving an athlete. Nothing else (XP, workouts, combine tests, rewards,
// gear) is touched: none of it is scoped by team in this schema, so there's
// nothing to wipe.
async function removeTeamMemberAction(athleteId,name){
  if(!coachTeam) return;
  if(!confirm(`Remove "${name}" from the team roster? Their workout history and XP are kept — they can be re-invited with the join code anytime.`)) return;
  try{
    await removeTeamMemberRemote(coachTeam.id,athleteId);
    await renderTeamRoster();
  }catch(err){
    alert('Could not remove athlete: '+(err.message||'unknown error'));
  }
}
async function leaveTeamAction(){
  if(!activeAthlete) return;
  const teamName=(athleteTeamMembership&&athleteTeamMembership.teams&&athleteTeamMembership.teams.name)||'this team';
  if(!confirm(`Leave "${teamName}"? Your workout history and XP are kept — you can rejoin with a join code anytime.`)) return;
  const pin=await showPinModal('leave your team');
  if(!pin) return;
  try{
    await leaveTeamRemote(activeAthlete.id,pin);
    await refreshTeamMembershipUI();
  }catch(err){
    alert('Could not leave team: '+(err.message||'unknown error'));
  }
}
// ---- Coach team context (loaded once per sign-in, not athlete-scoped) ----
// coachTeams holds every team this profile coaches (a profile can own more
// than one — the RLS/RPC layer never capped this, only the old UI did);
// coachTeam is whichever one is currently selected in Coach Tools.
let coachTeams=[];
let coachTeam=null;
async function refreshCoachTeamContext(){
  if(!currentProfile||!currentProfile.is_coach){
    coachTeams=[]; coachTeam=null; renderCoachOnlyVisibility();
    return;
  }
  coachTeams=await loadCoachTeams(currentProfile.id);
  if(!coachTeam||!coachTeams.some(t=>t.id===coachTeam.id)) coachTeam=coachTeams[0]||null;
  renderCoachOnlyVisibility();
  renderTeamSetupPanel();
  if(coachTeam){
    await renderPendingTeamRequests();
    await renderTeamRoster();
    await refreshTeamProgramBuilderFields();
  }
}
async function switchCoachTeam(teamId){
  const t=coachTeams.find(x=>x.id===teamId);
  if(!t) return;
  coachTeam=t;
  renderTeamSetupPanel();
  await renderPendingTeamRequests();
  await renderTeamRoster();
  await refreshTeamProgramBuilderFields();
}
function renderCoachOnlyVisibility(){
  const isCoach=!!(currentProfile&&currentProfile.is_coach);
  $$('[data-coach-only]').forEach(el=>el.classList.toggle('hidden',!isCoach));
  if($('#leagueJoinCard')) $('#leagueJoinCard').classList.toggle('hidden',!isCoach||!coachTeam);
  if($('#pendingRequestsCard')) $('#pendingRequestsCard').classList.toggle('hidden',!isCoach||!coachTeam);
  if($('#teamRosterCard')) $('#teamRosterCard').classList.toggle('hidden',!isCoach||!coachTeam);
}

// ---- Team Program (Phase C) ----
// One row per team (team_programs), overwritten wholesale on each coach
// save — same one-object-per-team model the old state.teamProgram used,
// just server-side now. currentTeamProgram/currentTeamProgramOptedIn are
// the ACTIVE ATHLETE's team's program (for the athlete-side summary/opt-in/
// check-in UI), refreshed alongside team membership, not the coach's own —
// a parent isn't necessarily the coach of their kid's team.
let currentTeamProgram=null, currentTeamProgramOptedIn=false;
function teamProgramLabel(){return `TEAM ${(athleteTeamMembership?.teams?.name||'YOUR TEAM').toUpperCase()} PROGRAM`}
// Builds the activity multi-select's option list once (cheap/sync) — safe
// in the render() chain. Pre-filling it with an existing program's
// selections is a separate async step (refreshTeamProgramBuilderFields).
function renderTeamProgramBuilder(){
  const sel=$('#teamProgramActivities');
  if(!sel || sel.options.length) return;
  sel.innerHTML=categoryOrder.map(cat=>`<optgroup label="${cat}">${activities.filter(a=>a.category===cat).map(a=>`<option value="${a.name}">${a.name}</option>`).join('')}</optgroup>`).join('');
}
async function refreshTeamProgramBuilderFields(){
  renderTeamProgramBuilder();
  if(!coachTeam) return;
  const sel=$('#teamProgramActivities');
  const existing=await loadTeamProgram(coachTeam.id);
  if(existing&&sel){
    [...sel.options].forEach(o=>{o.selected=existing.activity_names.includes(o.value)});
    if($('#teamProgramTitle')) $('#teamProgramTitle').value=existing.title;
    if($('#teamProgramInstructions')) $('#teamProgramInstructions').value=existing.instructions||'';
  }
}
async function saveTeamProgram(){
  if(!coachTeam){alert('Set up your team first.');return}
  const chosen=[...$('#teamProgramActivities').selectedOptions].map(o=>o.value);
  if(!chosen.length){alert('Pick at least one activity for the program.');return}
  const title=$('#teamProgramTitle').value.trim()||`${coachTeam.name} Baseball Training Program`;
  const instructions=($('#teamProgramInstructions')?.value||'').trim();
  const pin=await showPinModal('save this team program');
  if(!pin) return;
  let pinOk=false;
  try{ pinOk=await verifyApprovalPinRemote(pin); }catch(err){ /* treat as failed */ }
  if(!pinOk){alert('Incorrect PIN.');return}
  try{
    await saveTeamProgramRemote(coachTeam.id,title,chosen,instructions,currentProfile.id);
  }catch(err){
    alert('Could not save team program: '+(err.message||'unknown error'));
    return;
  }
  if($('#teamProgramStatus')) $('#teamProgramStatus').textContent=`Saved "${title}" with ${chosen.length} activities.`;
  if(activeAthlete&&athleteTeamMembership?.teams?.id===coachTeam.id) await refreshTeamProgramForAthlete();
}
// Joining is one-way — there's no leave action from the athlete's side.
async function joinTeamProgram(){
  if(!currentTeamProgram||currentTeamProgramOptedIn||!activeAthlete) return;
  try{
    await optInTeamProgramRemote(currentTeamProgram.id,activeAthlete.id);
  }catch(err){
    alert('Could not join team program: '+(err.message||'unknown error'));
    return;
  }
  currentTeamProgramOptedIn=true;
  renderTeamProgramSummary();
  renderClubhouseTeamProgram();
  renderTeamProgramLogFields();
}
async function refreshTeamProgramForAthlete(){
  const team=athleteTeamMembership&&athleteTeamMembership.status==='approved'?athleteTeamMembership.teams:null;
  if(!team){
    currentTeamProgram=null; currentTeamProgramOptedIn=false;
  }else{
    currentTeamProgram=await loadTeamProgram(team.id);
    currentTeamProgramOptedIn=currentTeamProgram?await getTeamProgramOptIn(currentTeamProgram.id,activeAthlete.id):false;
  }
  renderTeamProgramSummary();
  renderClubhouseTeamProgram();
  renderTeamProgramLogFields();
}
function renderTeamProgramSummary(){
  if(!$('#teamProgramSummaryCard')) return;
  const p=currentTeamProgram;
  if(!p){
    $('#teamProgramSummaryTitle').textContent='No Team Program Yet';
    $('#teamProgramActivityList').innerHTML='<p class="muted">Your coach hasn’t created a team program yet.</p>';
    $('#joinTeamProgram').classList.add('hidden');
    return;
  }
  $('#teamProgramSummaryTitle').textContent=p.title;
  $('#teamProgramActivityList').innerHTML='<ul>'+p.activity_names.map(n=>`<li>${n}</li>`).join('')+'</ul>'+(p.instructions?`<p class="muted team-program-notes"><strong>Coach note:</strong> ${p.instructions}</p>`:'');
  $('#joinTeamProgram').classList.remove('hidden');
  $('#joinTeamProgram').disabled=!!currentTeamProgramOptedIn;
  $('#joinTeamProgram').textContent=currentTeamProgramOptedIn?'Joined ✓':'Join Team Program';
}
// Round 4: the Clubhouse button no longer awards XP itself — it's a jump-off
// point to the real logging screen. The 50 XP only fires from an actual save
// on the Team Program Check-In block (see the teamProgramLogForm submit
// handler), gated the same once-per-day way completeTeamProgram used to gate it.
function goToTeamProgramCheckIn(){
  switchScreen('daily');
  const card=$('#teamProgramLogCard');
  if(!card) return;
  card.scrollIntoView({behavior:'smooth',block:'start'});
  card.classList.add('pulse-highlight');
  setTimeout(()=>card.classList.remove('pulse-highlight'),1600);
}
function renderClubhouseTeamProgram(){
  const card=$('#teamProgramCard'); if(!card) return;
  const show=!!(currentTeamProgramOptedIn && currentTeamProgram && currentTeamProgram.activity_names.length);
  card.classList.toggle('hidden',!show);
  if(!show) return;
  $('#teamProgramCardTitle').textContent=teamProgramLabel();
  $('#teamProgramTasks').innerHTML='<ul>'+currentTeamProgram.activity_names.map(n=>`<li>☐ ${n}</li>`).join('')+'</ul>';
  const doneToday=(state.daily||[]).some(x=>x.programType==='team'&&x.date===todayISO());
  if($('#completeTeamProgram')){
    $('#completeTeamProgram').disabled=doneToday;
    $('#completeTeamProgram').textContent=doneToday?'Completed Today':'Log Team Program';
  }
}
// Daily Check-In: a parallel logging section sourced from the Team Program's
// activities (by name, matching how activity_names is already stored)
// rather than a personal Program's activityIds. Only shown once the athlete
// has joined a team program.
function renderTeamProgramLogFields(){
  const card=$('#teamProgramLogCard'); if(!card) return;
  const show=!!(currentTeamProgramOptedIn && currentTeamProgram && currentTeamProgram.activity_names.length);
  card.classList.toggle('hidden',!show);
  if(!show) return;
  const c=$('#teamProgramLogFields'); if(!c) return;
  teamSetCounts={};
  c.innerHTML=currentTeamProgram.activity_names.map(name=>{
    const a=findActivity(name);
    return a?activitySetBlockHTML('teamset',a,teamSetCounts):'';
  }).join('');
}
// Phase C: Arcade has no server table (deliberately out of scope, see the
// migration plan) — an honest placeholder instead of the old fake-data
// leaderboard, which named specific "teammates" and their scores.
function renderArcadeLeaderboard(){if(!$('#arcadeLeaderboard'))return;$('#arcadeLeaderboard').innerHTML='<p class="muted">Team arcade leaderboards are coming in a future update.</p>'}
// ---- League HQ (Phase C) ----
async function renderLeagueHQ(){
  const heroCard=$('#leagueHeroCard'), emptyCard=$('#leagueEmptyCard'), boardCard=$('#leagueLeaderboardCard');
  if(!heroCard) return;
  const m=athleteTeamMembership;
  const team=m&&m.status==='approved'?m.teams:null;
  if(!team||!team.league_id){
    heroCard.classList.add('hidden'); boardCard.classList.add('hidden'); emptyCard.classList.remove('hidden');
    return;
  }
  const {league,standings}=await loadLeagueForTeam(team.id,team.league_id);
  if(!league){
    heroCard.classList.add('hidden'); boardCard.classList.add('hidden'); emptyCard.classList.remove('hidden');
    return;
  }
  emptyCard.classList.add('hidden'); heroCard.classList.remove('hidden'); boardCard.classList.remove('hidden');
  $('#leagueName').textContent=league.name;
  $('#leagueMeta').textContent=`${standings.length} Team${standings.length===1?'':'s'}${league.season?' · '+league.season:''}`;
  $('#leagueLeaderboardBody').innerHTML=standings.map(s=>`<tr><td>${s.team_name}</td><td>${s.athlete_count}</td><td>${s.team_xp}</td></tr>`).join('');
}
function renderTeamEdition(){renderMission();renderLeaderboard();renderTeamFeed();renderShoutouts();renderExerciseLibrary();renderProgramBuilder();renderTeamProgramBuilder();renderTeamProgramSummary();renderClubhouseTeamProgram();renderTeamProgramLogFields();renderTeamIdentity();renderArcadeLeaderboard();ensureGameXPDay();if($('#gameXPToday'))$('#gameXPToday').textContent=state.gameXP.xp;if($('#reactionBest'))$('#reactionBest').textContent=getWebGemBestReaction()??'—';if($('#strikeBest'))$('#strikeBest').textContent=state.gameScores?.strike??0;if($('#homerBest'))$('#homerBest').textContent=getArcadeBest('homeRunHero');if($('#clutchBest'))$('#clutchBest').textContent=getArcadeBest('clutchCatch');renderArcadeExtras()}
// ---- Web Gem (Round 8 glow-up of the old Reaction Catch) ----
// Streak/combo model: a catch immediately queues the next ball at a
// shorter delay and slightly smaller size; a miss or too-slow tap ends the
// round. Session (delay/size ramp) resets on Arcade entry via
// resetWebGemSession, same pattern as Home Run Hero.
const WEBGEM_START_DELAY=1600,WEBGEM_DELAY_FLOOR=500,WEBGEM_DELAY_STEP=90,WEBGEM_REACT_WINDOW=1400;
let webGemActive=false,webGemStreak=0,webGemDelay=WEBGEM_START_DELAY,webGemAppearAt=0,webGemBestReactionThisRound=null,webGemSpawnTimer=null,webGemTimeoutTimer=null;
function resetWebGemSession(){
  webGemActive=false;webGemStreak=0;webGemDelay=WEBGEM_START_DELAY;webGemBestReactionThisRound=null;
  clearTimeout(webGemSpawnTimer);clearTimeout(webGemTimeoutTimer);
}
function startReactionGame(){
  resetWebGemSession();
  startWebGemRound();
}
function startWebGemRound(){
  webGemActive=false;
  $('#reactionResult').textContent=webGemStreak>0?`Streak: ${webGemStreak} — get ready...`:'Get ready...';
  $('#reactionBall').classList.add('hidden');
  clearTimeout(webGemSpawnTimer);clearTimeout(webGemTimeoutTimer);
  const delay=webGemDelay*0.7+Math.random()*webGemDelay*0.6;
  webGemSpawnTimer=setTimeout(()=>{
    const b=$('#reactionBall');
    const size=Math.max(40,64-Math.floor(webGemStreak/3)*3);
    b.style.width=size+'px';b.style.height=size+'px';
    b.style.left=(10+Math.random()*70)+'%';
    b.style.top=(18+Math.random()*55)+'%';
    b.classList.remove('hidden');
    webGemAppearAt=performance.now();
    webGemActive=true;
    $('#reactionResult').textContent='TAP!';
    webGemTimeoutTimer=setTimeout(()=>{if(webGemActive) endWebGemRound()},WEBGEM_REACT_WINDOW);
  },delay);
}
function flashWebGemMilestone(streak){
  const el=$('#reactionGame'); if(!el) return;
  el.classList.add('milestone-flash');
  setTimeout(()=>el.classList.remove('milestone-flash'),700);
}
function hitReactionBall(){
  if(!webGemActive) return;
  const ms=Math.round(performance.now()-webGemAppearAt);
  webGemActive=false;
  clearTimeout(webGemTimeoutTimer);
  $('#reactionBall').classList.add('hidden');
  webGemStreak++;
  if(webGemBestReactionThisRound===null||ms<webGemBestReactionThisRound) webGemBestReactionThisRound=ms;
  webGemDelay=Math.max(WEBGEM_DELAY_FLOOR,webGemDelay-WEBGEM_DELAY_STEP);
  const milestone=[5,10,15].includes(webGemStreak);
  if(milestone){
    flashWebGemMilestone(webGemStreak);
    $('#reactionResult').innerHTML=`🔥 <strong>${webGemStreak} in a row!</strong> Keep it up!`;
  }else{
    $('#reactionResult').textContent=`Caught! ${ms} ms · Streak: ${webGemStreak}`;
  }
  setTimeout(()=>startWebGemRound(),milestone?900:150);
}
function endWebGemRound(){
  webGemActive=false;
  clearTimeout(webGemSpawnTimer);clearTimeout(webGemTimeoutTimer);
  $('#reactionBall').classList.add('hidden');
  const finalStreak=webGemStreak;
  const xpEarned=Math.min(25,Math.round(finalStreak*1.5));
  const e=awardGameXP(xpEarned);
  const res=recordArcadeResult('webGem',{score:finalStreak});
  updateWebGemReactionBest(webGemBestReactionThisRound);
  recordArcadeMetric('webGem',Math.min(100,finalStreak/20*100));
  const bestReaction=getWebGemBestReaction();
  $('#reactionResult').innerHTML=`Streak ended at <strong>${finalStreak}</strong> · +${e} XP${res.isNewBest?' · New Best Streak! 🎉':''}<br><small>Best streak: ${res.best} · Best time: ${bestReaction!=null?bestReaction+' ms':'—'}</small>`;
  webGemStreak=0;webGemDelay=WEBGEM_START_DELAY;webGemBestReactionThisRound=null;
}
// ---- Clutch Catch (Round 8 new game) ----
// Several objects fall at once; one is the target (baseball), the rest are
// decoys. Tap the target to score, tap a decoy or let the target fall
// un-tapped and lose a life. Spawn rate and decoy ratio both increase over
// the round. Plain absolutely-positioned DOM elements animated with CSS
// transitions — no canvas/physics library, per Round 8's explicit scope.
const CLUTCH_DECOYS=['🟠','⚽','🎾'];
const CLUTCH_ROUND_MS=50000,CLUTCH_START_LIVES=3;
let clutchActive=false,clutchLives=CLUTCH_START_LIVES,clutchScore=0,clutchStartTime=0,clutchSpawnTimer=null,clutchRoundTimer=null,clutchObjId=0;
function resetClutchSession(){
  clutchActive=false;
  clearTimeout(clutchSpawnTimer);clearTimeout(clutchRoundTimer);
  const arena=$('#clutchArena'); if(arena) arena.innerHTML='';
  if($('#clutchLives')) $('#clutchLives').textContent='';
}
function clutchElapsedRatio(){return Math.min(1,(performance.now()-clutchStartTime)/CLUTCH_ROUND_MS)}
function updateClutchHud(){
  if(!$('#clutchLives')) return;
  const lives=Math.max(0,clutchLives);
  $('#clutchLives').textContent='❤️'.repeat(lives)+'🖤'.repeat(CLUTCH_START_LIVES-lives)+` · Score: ${clutchScore}`;
}
function flashClutchStage(cls){
  const el=$('#clutchGame'); if(!el) return;
  el.classList.add(cls);
  setTimeout(()=>el.classList.remove(cls),300);
}
function scheduleClutchSpawn(){
  if(!clutchActive) return;
  const ratio=clutchElapsedRatio();
  const interval=Math.max(450,1400-ratio*950);
  clutchSpawnTimer=setTimeout(()=>{spawnClutchObject();scheduleClutchSpawn()},interval);
}
function spawnClutchObject(){
  if(!clutchActive) return;
  const arena=$('#clutchArena'); if(!arena) return;
  const ratio=clutchElapsedRatio();
  const decoyChance=Math.min(0.75,0.35+ratio*0.4);
  const isTarget=Math.random()>decoyChance;
  const el=document.createElement('button');
  el.type='button';
  el.className='clutch-object'+(isTarget?' target':' decoy');
  el.textContent=isTarget?'⚾':CLUTCH_DECOYS[Math.floor(Math.random()*CLUTCH_DECOYS.length)];
  el.dataset.id=++clutchObjId;
  el.dataset.target=isTarget?'1':'0';
  el.style.left=(6+Math.random()*82)+'%';
  el.style.top='-12%';
  arena.appendChild(el);
  const fallMs=Math.max(1600,3000-ratio*1200);
  requestAnimationFrame(()=>{
    el.style.transition=`top ${fallMs}ms linear`;
    el.style.top='108%';
  });
  const onExpire=()=>{
    el.removeEventListener('transitionend',onExpire);
    if(!el.isConnected) return;
    if(el.dataset.target==='1'&&clutchActive){
      clutchLives--;
      flashClutchStage('clutch-miss-flash');
      updateClutchHud();
      if(clutchLives<=0){endClutchGame();return}
    }
    el.remove();
  };
  el.addEventListener('transitionend',onExpire);
  el.onclick=()=>tapClutchObject(el);
}
function tapClutchObject(el){
  if(!clutchActive||!el.isConnected) return;
  const isTarget=el.dataset.target==='1';
  el.remove();
  if(isTarget){
    clutchScore+=10;
    flashClutchStage('clutch-hit-flash');
    updateClutchHud();
  }else{
    clutchLives--;
    flashClutchStage('clutch-miss-flash');
    updateClutchHud();
    if(clutchLives<=0){endClutchGame();return}
  }
}
function startClutchGame(){
  resetClutchSession();
  clutchActive=true;
  clutchLives=CLUTCH_START_LIVES;
  clutchScore=0;
  clutchStartTime=performance.now();
  updateClutchHud();
  $('#clutchResult').textContent='';
  scheduleClutchSpawn();
  clutchRoundTimer=setTimeout(()=>endClutchGame(),CLUTCH_ROUND_MS);
}
function endClutchGame(){
  clutchActive=false;
  clearTimeout(clutchSpawnTimer);clearTimeout(clutchRoundTimer);
  const arena=$('#clutchArena'); if(arena) arena.innerHTML='';
  const xpEarned=Math.min(25,Math.round(clutchScore/4));
  const e=awardGameXP(xpEarned);
  const res=recordArcadeResult('clutchCatch',{score:clutchScore});
  recordArcadeMetric('clutchCatch',clutchScore/150*100);
  $('#clutchResult').innerHTML=`Final score: <strong>${clutchScore}</strong> · +${e} XP${res.isNewBest?' · New Best! 🎉':''}`;
}
let strikeTarget=0,strikeRound=0,strikeScore=0;function startStrikeGame(){strikeRound=1;strikeScore=0;nextStrike()}function nextStrike(){strikeTarget=1+Math.floor(Math.random()*9);const names={1:'High & Inside',2:'High Center',3:'High & Away',4:'Middle Inside',5:'Middle',6:'Middle Away',7:'Low & Inside',8:'Low Center',9:'Low & Away'};$('#strikePrompt').textContent=`Round ${strikeRound}/5: ${names[strikeTarget]}`}function chooseStrike(z){if(!strikeRound)return;if(z===strikeTarget){strikeScore+=100;$('#strikeResult').textContent='Correct! +100'}else $('#strikeResult').textContent='Missed. Keep learning the zone.';strikeRound++;if(strikeRound>5){state.gameScores=state.gameScores||{};state.gameScores.strike=Math.max(state.gameScores.strike||0,strikeScore);const e=awardGameXP(10);$('#strikePrompt').textContent=`Final Score: ${strikeScore} · +${e} XP`;strikeRound=0;save()}else nextStrike()}
// ---- Home Run Hero (Round 8 glow-up of the old Home Run Timing) ----
// Contact-quality tiers by distance from the hit-zone center (76%, matching
// .hit-zone's left:70%/width:12%), instead of a flat hit/miss. Ball travel
// time shortens each successful swing within a session (reset on Arcade
// entry via resetHomerSession) for a starts-easy-gets-harder curve.
const HOMER_START_SPEED=1800,HOMER_SPEED_FLOOR=900,HOMER_SPEED_STEP=70;
let homerAnimation=null,homerStart=0,homerActive=false,homerPitchSpeed=HOMER_START_SPEED;
function resetHomerSession(){homerPitchSpeed=HOMER_START_SPEED}
function homerContactTier(left){
  const dist=Math.abs(left-76);
  if(dist<=3) return{tier:'perfect',label:'PERFECT!',points:125};
  if(dist<=8) return{tier:'good',label:'Good contact!',points:75};
  if(dist<=18) return{tier:left<76?'early':'late',label:left<76?'Too early':'Too late',points:40};
  if(dist<=30) return{tier:left<76?'veryEarly':'veryLate',label:left<76?'Way too early':'Way too late',points:10};
  return{tier:'miss',label:'Miss!',points:0};
}
const HOMER_XP_BY_TIER={perfect:12,good:8,early:5,late:5,veryEarly:2,veryLate:2,miss:0};
function startHomerGame(){
  const ball=$('#timingBall');
  cancelAnimationFrame(homerAnimation);
  homerStart=performance.now();
  homerActive=true;
  $('#homerResult').textContent='';
  const speed=homerPitchSpeed;
  function move(t){
    const pct=Math.min(100,((t-homerStart)/speed)*100);
    ball.style.left=pct+'%';
    if(pct<100&&homerActive) homerAnimation=requestAnimationFrame(move);
    else if(homerActive){$('#homerResult').textContent='Strike! Try again.';homerActive=false}
  }
  homerAnimation=requestAnimationFrame(move);
}
function flashHomerPerfect(){
  const zone=$('.hit-zone'); if(!zone) return;
  zone.classList.add('perfect-flash');
  setTimeout(()=>zone.classList.remove('perfect-flash'),500);
}
function swingHomer(){
  if(!homerActive) return;
  homerActive=false;
  cancelAnimationFrame(homerAnimation);
  const left=parseFloat($('#timingBall').style.left)||0;
  const result=homerContactTier(left);
  const {isNewBest,prevBest}=recordArcadeResult('homeRunHero',{score:result.points});
  const e=awardGameXP(HOMER_XP_BY_TIER[result.tier]||0);
  if(result.points>0) homerPitchSpeed=Math.max(HOMER_SPEED_FLOOR,homerPitchSpeed-HOMER_SPEED_STEP);
  recordArcadeMetric('homeRunHero',result.points/125*100);
  if(result.tier==='perfect') flashHomerPerfect();
  const delta=result.points-prevBest;
  const deltaText=prevBest>0?(delta>=0?`+${delta} above your best`:`${Math.abs(delta)} below your best (${prevBest})`):(result.points>0?'First result logged!':'');
  $('#homerResult').innerHTML=`<strong>${result.label}</strong> ${result.points} pts · +${e} XP${isNewBest?' · New Best! 🎉':''}${deltaText?`<br><small>${deltaText}</small>`:''}`;
}
function ensureArcadeDay(){
  const today=todayISO();
  if(!state.arcadeDaily||state.arcadeDaily.date!==today){
    state.arcadeDaily={date:today,spinsUsed:0,spinsAvailable:1,triviaAnswered:false,triviaCorrect:null,triviaSelected:null};
    save();
  }
}
function todayTriviaIndex(){
  const epoch=Date.UTC(2024,0,1);
  const days=Math.floor((new Date(todayISO()+'T00:00:00Z').getTime()-epoch)/86400000);
  return ((days%triviaQuestions.length)+triviaQuestions.length)%triviaQuestions.length;
}
function buildWheelSVG(){
  const cx=150,cy=150,r=145;
  const palette=['#00E5FF','#FF9A45','#FF2E9A','#39FF88','#1F7AE0','#FFC98B'];
  const slices=wheelSliceAngles();
  let shapes='';
  slices.forEach((s,i)=>{
    const start=-90+s.start, end=start+s.width;
    const x1=cx+r*Math.cos(start*Math.PI/180), y1=cy+r*Math.sin(start*Math.PI/180);
    const x2=cx+r*Math.cos(end*Math.PI/180), y2=cy+r*Math.sin(end*Math.PI/180);
    const largeArc=s.width>180?1:0;
    const color=s.value>=250?'#F9FF3D':palette[i%palette.length];
    shapes+=`<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${largeArc} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${color}" stroke="#161616" stroke-width="2"/>`;
    const mid=start+s.width/2;
    const lx=cx+(r*0.66)*Math.cos(mid*Math.PI/180), ly=cy+(r*0.66)*Math.sin(mid*Math.PI/180);
    const fontSize=s.value>=1000?10:(s.value>=250?12:(s.value>=50?14:16));
    shapes+=`<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" transform="rotate(${(mid+90).toFixed(2)},${lx.toFixed(2)},${ly.toFixed(2)})" text-anchor="middle" dominant-baseline="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="${fontSize}" fill="#161616">${s.value}</text>`;
  });
  return `<svg viewBox="0 0 300 300"><circle cx="150" cy="150" r="147" fill="#161616"/>${shapes}</svg>`;
}
// Picks a winning slice weighted by its angular width, so the odds of landing
// on a prize always match how big its wedge looks on the wheel.
function pickWeightedSlice(){
  const slices=wheelSliceAngles();
  let r=Math.random()*360;
  for(let i=0;i<slices.length;i++){
    if(r<slices[i].width) return i;
    r-=slices[i].width;
  }
  return slices.length-1;
}
let wheelRotation=0,wheelSpinning=false;
function spinWheel(){
  ensureArcadeDay();
  if(wheelSpinning) return;
  if(state.arcadeDaily.spinsUsed>=state.arcadeDaily.spinsAvailable){
    if($('#spinStatus')) $('#spinStatus').textContent='No spins left today — come back tomorrow!';
    return;
  }
  const wheelEl=$('#wheelInner');
  if(!wheelEl) return;
  wheelSpinning=true;
  if($('#spinButton')) $('#spinButton').disabled=true;
  if($('#spinResult')) $('#spinResult').textContent='';
  const idx=pickWeightedSlice();
  const val=wheelSegments[idx];
  const chosen=wheelSliceAngles()[idx];
  const centerAngle=-90+chosen.start+chosen.width/2;
  const targetMod=(((-90-centerAngle)%360)+360)%360;
  const curMod=((wheelRotation%360)+360)%360;
  let delta=targetMod-curMod;
  if(delta<=0) delta+=360;
  wheelRotation+=6*360+delta;
  wheelEl.style.transform=`rotate(${wheelRotation}deg)`;
  const onDone=async()=>{
    wheelEl.removeEventListener('transitionend',onDone);
    state.arcadeDaily.spinsUsed+=1;
    save();
    if(!activeAthlete){
      wheelSpinning=false;
      if($('#spinResult')) $('#spinResult').textContent='Sign in and select an athlete to spin.';
      renderArcadeExtras();
      return;
    }
    try{
      await awardSpinXpRemote(activeAthlete.id,val);
      await refreshAthleteState();
      if($('#spinResult')) $('#spinResult').textContent=`🎉 You landed on +${val} XP!`;
    }catch(err){
      if($('#spinResult')) $('#spinResult').textContent='Could not save spin: '+(err.message||err);
    }
    wheelSpinning=false;
    renderArcadeExtras();
    render();
  };
  wheelEl.addEventListener('transitionend',onDone,{once:true});
}
function answerTrivia(choiceIdx){
  ensureArcadeDay();
  if(state.arcadeDaily.triviaAnswered) return;
  const q=triviaQuestions[todayTriviaIndex()];
  const correct=choiceIdx===q.a;
  state.arcadeDaily.triviaAnswered=true;
  state.arcadeDaily.triviaSelected=choiceIdx;
  state.arcadeDaily.triviaCorrect=correct;
  if(correct) state.arcadeDaily.spinsAvailable+=1;
  save();
  renderArcadeExtras();
}
function renderArcadeExtras(){
  if(!$('#spinButton')) return;
  ensureArcadeDay();
  const remaining=state.arcadeDaily.spinsAvailable-state.arcadeDaily.spinsUsed;
  $('#spinButton').disabled=remaining<=0||wheelSpinning;
  $('#spinButton').textContent=remaining>0?'Spin The Wheel':'No Spins Left Today';
  if($('#spinStatus')) $('#spinStatus').textContent=remaining>0?`${remaining} spin${remaining===1?'':'s'} available today.`:"Come back tomorrow — or ace today's trivia for a bonus spin!";

  const q=triviaQuestions[todayTriviaIndex()];
  const answered=state.arcadeDaily.triviaAnswered;
  const selected=state.arcadeDaily.triviaSelected;
  if($('#triviaCategory')) $('#triviaCategory').textContent=q.cat;
  if($('#triviaQuestion')) $('#triviaQuestion').textContent=q.q;
  if($('#triviaChoices')) $('#triviaChoices').innerHTML=q.choices.map((c,i)=>{
    let cls='trivia-choice';
    if(answered){
      if(i===q.a) cls+=' correct';
      else if(i===selected) cls+=' incorrect';
    }
    return `<button type="button" class="${cls}" data-choice="${i}" ${answered?'disabled':''}>${c}</button>`;
  }).join('');
  if($('#triviaResult')) $('#triviaResult').textContent=answered?(state.arcadeDaily.triviaCorrect?'✅ Correct! Bonus spin unlocked.':`❌ Not quite — the answer was: ${q.choices[q.a]}`):'';
}
document.addEventListener('click',e=>{
  const choiceBtn=e.target.closest('.trivia-choice');
  if(choiceBtn && !choiceBtn.disabled) answerTrivia(+choiceBtn.dataset.choice);
});

seedPresetPrograms();
renderLadder();renderHeroLadderPreview();
window.addEventListener('resize',renderCharts);render();renderTeamEdition();


if($('#completeMission'))$('#completeMission').onclick=completeDailyMission;
if($('#useRainToken'))$('#useRainToken').onclick=useRainToken;
if($('#leaderboardMetric'))$('#leaderboardMetric').onchange=renderLeaderboard;
if($('#libraryCategory'))$('#libraryCategory').onchange=renderExerciseLibrary;
if($('#goalChips'))$('#goalChips').onclick=e=>{const btn=e.target.closest('.goal-chip');if(!btn)return;$('#libraryCategory').value=btn.dataset.category;renderExerciseLibrary()};
if($('#addShoutout'))$('#addShoutout').onclick=addShoutout;
if($('#saveTeamProgram'))$('#saveTeamProgram').onclick=saveTeamProgram;
if($('#saveTeamSetup'))$('#saveTeamSetup').onclick=saveTeamSetup;
if($('#coachTeamSwitcher'))$('#coachTeamSwitcher').onchange=e=>switchCoachTeam(e.target.value);
if($('#joinTeamIdentityBtn'))$('#joinTeamIdentityBtn').onclick=joinTeamIdentity;
if($('#teamLogoUpload'))$('#teamLogoUpload').onchange=e=>handleTeamLogoUpload(e.target.files[0]);
if($('#joinTeamProgram'))$('#joinTeamProgram').onclick=joinTeamProgram;
if($('#completeTeamProgram'))$('#completeTeamProgram').onclick=goToTeamProgramCheckIn;
$$('.reaction-btn').forEach(b=>b.onclick=()=>addReaction(b.textContent));
if($('#startReaction'))$('#startReaction').onclick=startReactionGame;
if($('#reactionBall'))$('#reactionBall').onclick=hitReactionBall;
if($('#startStrike'))$('#startStrike').onclick=startStrikeGame;
$$('#strikeZone button').forEach(b=>b.onclick=()=>chooseStrike(+b.dataset.zone));
if($('#startHomer'))$('#startHomer').onclick=startHomerGame;
if($('#swingButton'))$('#swingButton').onclick=swingHomer;
if($('#startClutch'))$('#startClutch').onclick=startClutchGame;
if($('#wheelInner'))$('#wheelInner').innerHTML=buildWheelSVG();
if($('#spinButton'))$('#spinButton').onclick=spinWheel;
if($('#buildYourAthleteBtn'))$('#buildYourAthleteBtn').onclick=buildYourAthlete;
initPlayerCardRotation();
renderDailyProgramPicker();
renderDailyCustomFields();
renderCombineProgramPicker();

// ---- Supabase auth, profile, and athlete switcher (Phase B) ----
// currentSession/currentProfile/currentAthletes/activeAthlete are declared
// at the top of the file (with `state`), not here — render()/renderPlayerCardHero()
// read activeAthlete, and the very first boot-time render() call happens
// before this point in the file, so a `let` here would leave activeAthlete
// in the temporal dead zone at that first call and crash the whole boot
// script. Confirmed live: this exact crash silently broke sign-in wiring,
// PIN setup, and everything else after the crash point until caught.
async function refreshAthleteState(){
  if(!activeAthlete) return;
  const remote=await loadAthleteState(activeAthlete.id);
  Object.assign(state,remote);
  render();
}
async function selectAthlete(athleteId){
  const a=currentAthletes.find(x=>x.id===athleteId);
  if(!a) return;
  if(activeAthlete&&activeAthlete.id!==a.id) saveArcadeStateFor(activeAthlete.id);
  activeAthlete=a;
  setStoredActiveAthleteId(a.id);
  state.athleteName=a.display_name;
  const arcadeSnap=loadArcadeStateFor(a.id);
  ARCADE_LOCAL_FIELDS.forEach(k=>{
    state[k]=arcadeSnap&&arcadeSnap[k]!==undefined?arcadeSnap[k]:JSON.parse(JSON.stringify(defaults[k]));
  });
  await refreshAthleteState();
  await refreshTeamMembershipUI();
}
// Soft delete (archive_athlete RPC) — the athlete's workout/combine/reward
// history stays intact server-side, just hidden from the switcher going
// forward (listAthletes filters archived_at IS NULL). PIN-gated since it's
// a consequential account-management action, even though it's reversible
// in the database (there's just no "unarchive" UI yet).
async function removeActiveAthlete(){
  if(!activeAthlete) return;
  const name=activeAthlete.display_name;
  if(!confirm(`Remove "${name}" from your athlete list? Their history is kept, but you won't be able to switch to them here anymore.`)) return;
  const pin=await showPinModal('remove this athlete');
  if(!pin) return;
  try{
    await archiveAthleteRemote(activeAthlete.id,pin);
  }catch(err){
    alert('Could not remove athlete: '+(err.message||'unknown error'));
    return;
  }
  currentAthletes=currentAthletes.filter(a=>a.id!==activeAthlete.id);
  activeAthlete=null;
  if(!currentAthletes.length){
    updateAuthUI();
    showAddAthleteModal();
    return;
  }
  renderAthleteSwitcher();
  await selectAthlete(currentAthletes[0].id);
}
function updateAuthUI(){
  const signedIn=!!currentSession;
  if($('#signInBtn'))$('#signInBtn').classList.toggle('hidden',signedIn);
  if($('#signOutBtn'))$('#signOutBtn').classList.toggle('hidden',!signedIn);
  if($('#athleteSwitcher'))$('#athleteSwitcher').classList.toggle('hidden',!signedIn||!currentAthletes.length);
}
function renderAthleteSwitcher(){
  const sel=$('#athleteSwitcher');
  if(!sel) return;
  sel.innerHTML=currentAthletes.map(a=>`<option value="${a.id}">${a.display_name}</option>`).join('')
    +'<option value="__add__">+ Add Athlete</option>'
    +(currentAthletes.length?'<option value="__remove__">🗑 Remove This Athlete</option>':'');
  if(activeAthlete) sel.value=activeAthlete.id;
}
function showAuthModal(step){
  $('#authModal').classList.remove('hidden');
  $('#authStepEmail').classList.toggle('hidden',step==='profile');
  $('#authStepProfile').classList.toggle('hidden',step!=='profile');
}
function hideAuthModal(){$('#authModal').classList.add('hidden')}
function showAddAthleteModal(){
  $('#addAthleteModal').classList.remove('hidden');
  $('#addAthleteStatus').textContent='';
  $('#newAthleteName').value='';
}
function hideAddAthleteModal(){$('#addAthleteModal').classList.add('hidden')}

// ---- Home Screen device setup ----
// One-time (per browser) prompt after sign-in to mint a device token and
// bake it into this tab's own URL via replaceState, so "Add to Home
// Screen" (which iOS captures from the current address bar, not from the
// web manifest) picks up a URL that can sign the installed icon back in on
// its own — see tryRedeemDeviceLoginToken() and
// supabase/functions/*-device-token/index.ts for the rest of the flow.
const HOME_SCREEN_DISMISS_KEY='lua.homeScreenPromptDismissed';
function showHomeScreenModal(){
  $('#homeScreenModal').classList.remove('hidden');
  $('#homeScreenStepIntro').classList.remove('hidden');
  $('#homeScreenStepReady').classList.add('hidden');
  $('#homeScreenDeviceLabel').value='';
  $('#homeScreenStatus').textContent='';
}
function hideHomeScreenModal(){$('#homeScreenModal').classList.add('hidden')}
async function maybePromptHomeScreenSetup(){
  if(localStorage.getItem(HOME_SCREEN_DISMISS_KEY)) return;
  try{
    const devices=await loadMyDevices();
    if(!devices.length) showHomeScreenModal();
  }catch(err){ /* non-critical — skip the prompt rather than block sign-in */ }
}
async function renderMyDevices(){
  const list=$('#myDevicesList');
  if(!list||!currentProfile) return;
  let devices=[];
  try{ devices=await loadMyDevices(); }
  catch(err){ list.innerHTML='<p class="muted">Could not load devices.</p>'; return; }
  list.innerHTML=devices.length?devices.map(d=>{
    const label=d.device_label||'Unnamed device';
    const last=d.last_used_at?`Last used ${new Date(d.last_used_at).toLocaleDateString()}`:'Never opened yet';
    return `<div class="pending-request-row"><span>${label} — <span class="muted">${last}</span></span><button class="danger" data-revoke-device="${d.id}" type="button">Remove this device</button></div>`;
  }).join(''):'<p class="muted">No devices added yet.</p>';
}
async function removeDeviceAction(id){
  if(!confirm('Remove this device? It will no longer be able to sign in from its Home Screen icon — you can always add it again later.')) return;
  try{
    await revokeDeviceTokenRemote(id);
    await renderMyDevices();
  }catch(err){
    alert('Could not remove device: '+(err.message||'unknown error'));
  }
}

// ---- PIN step-up (Phase D) ----
// Shared confirmation modal used by every approval-gated action (combine
// verification, quest/bonus approval, reward claims, coach roster/program
// edits). Returns the entered PIN, or null if the user closed the modal
// without confirming — callers should treat null as "cancelled," not
// re-prompt. The PIN itself is only ever checked server-side (RPCs call
// verify_approval_pin internally) — this modal just collects it.
function showPinModal(actionLabel){
  return new Promise(resolve=>{
    const modal=$('#pinModal'), input=$('#pinModalInput'), submitBtn=$('#pinModalSubmit'), closeBtn=$('#closePinModal');
    $('#pinModalLabel').textContent=`Enter your PIN to ${actionLabel}.`;
    input.value='';
    $('#pinModalStatus').textContent='';
    modal.classList.remove('hidden');
    input.focus();
    let done=false;
    const finish=val=>{
      if(done) return;
      done=true;
      modal.classList.add('hidden');
      submitBtn.onclick=null; closeBtn.onclick=null; input.onkeydown=null;
      resolve(val);
    };
    submitBtn.onclick=()=>{
      const v=input.value.trim();
      if(!/^[0-9]{4,6}$/.test(v)){$('#pinModalStatus').textContent='Enter a 4-6 digit PIN.';return}
      finish(v);
    };
    closeBtn.onclick=()=>finish(null);
    input.onkeydown=e=>{if(e.key==='Enter') submitBtn.click();};
  });
}
async function refreshPinSetupPanel(){
  if(!currentProfile) return;
  let has=false;
  try{ has=await hasApprovalPin(); }catch(err){ /* leave has=false, show the create form */ }
  $('#pinSetupCreateFields').classList.toggle('hidden',has);
  $('#pinChangeFields').classList.toggle('hidden',!has);
}

async function afterSignedIn(session){
  currentSession=session;
  const profile=await fetchProfile(session.user.id);
  if(!profile){
    showAuthModal('profile');
    return;
  }
  currentProfile=profile;
  hideAuthModal();
  await refreshPinSetupPanel();
  await refreshCoachTeamContext();
  await renderMyDevices();
  currentAthletes=await listAthletes(profile.id);
  updateAuthUI();
  if(!currentAthletes.length){
    showAddAthleteModal();
    return;
  }
  renderAthleteSwitcher();
  const storedId=getStoredActiveAthleteId();
  const initial=currentAthletes.find(a=>a.id===storedId)||currentAthletes[0];
  await selectAthlete(initial.id);
  await maybePromptHomeScreenSetup();
}
function afterSignedOut(){
  currentSession=null;
  currentProfile=null;
  currentAthletes=[];
  activeAthlete=null;
  coachTeams=[];
  coachTeam=null;
  athleteTeamMembership=null;
  currentTeamXpTotals=null;
  currentTeamRank=null;
  currentTeamRankTotal=null;
  currentTeamRoster=[];
  currentTeamProgram=null;
  currentTeamProgramOptedIn=false;
  updateAuthUI();
  renderCoachOnlyVisibility();
  renderTeamIdentity();
  $('#pinSetupCreateFields').classList.remove('hidden');
  $('#pinChangeFields').classList.add('hidden');
}
// Runs on every boot where the URL has ?login=<token> — covers both the
// first time this exact URL is opened in Safari (right after "Add to Home
// Screen") and every later open from the installed icon. Safe to call with
// no existing session (the normal case for a fresh icon) or with one
// already present (just renews the device token's expiry either way — see
// redeem-device-token/index.ts). Registered onAuthChange picks up the
// resulting SIGNED_IN event the same as a magic-link sign-in would.
async function tryRedeemDeviceLoginToken(){
  const params=new URLSearchParams(window.location.search);
  const token=params.get('login');
  if(!token) return;
  try{
    await redeemDeviceToken(token);
  }catch(err){
    const msg=err&&err.message?err.message:String(err);
    console.warn('Device login link could not be used:',msg);
    // Surface this in the UI, not just the console — an iPad has no easy
    // way to see console output, and silently falling back to "Sign In"
    // with no explanation makes a real failure indistinguishable from
    // "nothing happened."
    showAuthModal('email');
    if($('#authEmailStatus')) $('#authEmailStatus').textContent='Could not sign in from this device link: '+msg;
  }finally{
    // Strip the token from this tab's visible URL/history after use. This
    // does NOT affect the installed Home Screen icon's own launch target —
    // iOS captured that URL (token included) at "Add to Home Screen" time,
    // independent of any later history changes here — it only reduces how
    // long the raw token sits visible in this particular tab.
    const url=new URL(window.location.href);
    url.searchParams.delete('login');
    window.history.replaceState({},'',url.toString());
  }
}
function initAuthUI(){
  onSupabaseReady(async()=>{
    onAuthChange((event,session)=>{
      if(session) afterSignedIn(session);
      else afterSignedOut();
    });
    await tryRedeemDeviceLoginToken();
    const existing=await getCurrentSession();
    if(existing) afterSignedIn(existing);
  });
  if($('#signInBtn'))$('#signInBtn').onclick=()=>showAuthModal('email');
  if($('#signOutBtn'))$('#signOutBtn').onclick=async()=>{
    try{
      await signOutUser();
    }catch(err){
      // Belt-and-suspenders: even if the sign-out call itself throws for
      // some unexpected reason, force the UI back to signed-out rather
      // than leaving it stuck showing "Sign Out" with a dead session.
      console.warn('Sign out did not complete cleanly:',err&&err.message?err.message:err);
      afterSignedOut();
    }
  };
  if($('#closeAuthModal'))$('#closeAuthModal').onclick=hideAuthModal;
  if($('#sendMagicLinkBtn'))$('#sendMagicLinkBtn').onclick=async()=>{
    const email=$('#authEmailInput').value.trim();
    if(!email){$('#authEmailStatus').textContent='Enter an email address.';return}
    $('#authEmailStatus').textContent='Sending...';
    try{
      await sendMagicLink(email);
      $('#authEmailStatus').textContent='Check your email for a sign-in link.';
    }catch(err){
      $('#authEmailStatus').textContent=err.message||'Something went wrong. Try again.';
    }
  };
  if($('#saveProfileBtn'))$('#saveProfileBtn').onclick=async()=>{
    const name=$('#authDisplayName').value.trim();
    if(!name){$('#authProfileStatus').textContent='Enter your name.';return}
    const isParent=$('#authIsParent').checked, isCoach=$('#authIsCoach').checked;
    if(!isParent&&!isCoach){$('#authProfileStatus').textContent='Select parent, coach, or both.';return}
    try{
      currentProfile=await createProfile(currentSession.user.id,name,isParent,isCoach);
      hideAuthModal();
      await refreshPinSetupPanel();
      await refreshCoachTeamContext();
      currentAthletes=await listAthletes(currentProfile.id);
      updateAuthUI();
      if(!currentAthletes.length) showAddAthleteModal();
      else { renderAthleteSwitcher(); await selectAthlete(currentAthletes[0].id); }
    }catch(err){
      $('#authProfileStatus').textContent=err.message||'Something went wrong. Try again.';
    }
  };
  if($('#closeAddAthleteModal'))$('#closeAddAthleteModal').onclick=hideAddAthleteModal;
  if($('#saveNewAthleteBtn'))$('#saveNewAthleteBtn').onclick=async()=>{
    const name=$('#newAthleteName').value.trim();
    if(!name){$('#addAthleteStatus').textContent='Enter a name.';return}
    const ageVal=$('#newAthleteAge').value.trim();
    const age=ageVal?parseInt(ageVal,10):null;
    try{
      const a=await createAthlete(currentProfile.id,name,age);
      currentAthletes.push(a);
      hideAddAthleteModal();
      renderAthleteSwitcher();
      await selectAthlete(a.id);
    }catch(err){
      $('#addAthleteStatus').textContent=err.message||'Something went wrong. Try again.';
    }
  };
  if($('#athleteSwitcher'))$('#athleteSwitcher').onchange=async e=>{
    if(e.target.value==='__add__'){
      renderAthleteSwitcher();
      showAddAthleteModal();
      return;
    }
    if(e.target.value==='__remove__'){
      renderAthleteSwitcher();
      await removeActiveAthlete();
      return;
    }
    await selectAthlete(e.target.value);
  };
  if($('#openHomeScreenSetupBtn'))$('#openHomeScreenSetupBtn').onclick=showHomeScreenModal;
  if($('#closeHomeScreenModal'))$('#closeHomeScreenModal').onclick=()=>{
    localStorage.setItem(HOME_SCREEN_DISMISS_KEY,'1');
    hideHomeScreenModal();
  };
  if($('#skipHomeScreenBtn'))$('#skipHomeScreenBtn').onclick=()=>{
    localStorage.setItem(HOME_SCREEN_DISMISS_KEY,'1');
    hideHomeScreenModal();
  };
  if($('#doneHomeScreenBtn'))$('#doneHomeScreenBtn').onclick=hideHomeScreenModal;
  if($('#createHomeScreenLinkBtn'))$('#createHomeScreenLinkBtn').onclick=async()=>{
    const label=$('#homeScreenDeviceLabel').value.trim();
    $('#homeScreenStatus').textContent='Creating your device link...';
    try{
      const token=await mintDeviceToken(label);
      const url=new URL(window.location.href);
      url.search='';
      url.searchParams.set('login',token);
      window.history.replaceState({},'',url.toString());
      $('#homeScreenStepIntro').classList.add('hidden');
      $('#homeScreenStepReady').classList.remove('hidden');
      await renderMyDevices();
    }catch(err){
      $('#homeScreenStatus').textContent=err.message||'Could not create device link. Try again.';
    }
  };
  if($('#myDevicesList'))$('#myDevicesList').addEventListener('click',async e=>{
    const id=e.target.dataset.revokeDevice;
    if(!id) return;
    await removeDeviceAction(id);
  });
  if($('#joinLeagueBtn'))$('#joinLeagueBtn').onclick=joinLeagueAction;
  if($('#pendingRequestsList'))$('#pendingRequestsList').addEventListener('click',async e=>{
    const approveId=e.target.dataset.approve, declineId=e.target.dataset.decline;
    if(!approveId&&!declineId) return;
    await decideTeamJoinAction(approveId||declineId,!!approveId);
  });
  if($('#teamRosterList'))$('#teamRosterList').addEventListener('click',async e=>{
    const athleteId=e.target.dataset.remove;
    if(!athleteId) return;
    await removeTeamMemberAction(athleteId,e.target.dataset.name||'this athlete');
  });
  if($('#leaveTeamBtn'))$('#leaveTeamBtn').onclick=leaveTeamAction;
  if($('#savePinBtn'))$('#savePinBtn').onclick=async()=>{
    const pin=$('#newPinInput').value.trim();
    if(!/^[0-9]{4,6}$/.test(pin)){$('#pinSetupStatus').textContent='Enter a 4-6 digit PIN.';return}
    try{
      await setApprovalPinRemote(pin);
      $('#newPinInput').value='';
      $('#pinSetupStatus').textContent='PIN set.';
      await refreshPinSetupPanel();
    }catch(err){
      $('#pinSetupStatus').textContent=err.message||'Could not set PIN.';
    }
  };
  if($('#changePinBtn'))$('#changePinBtn').onclick=async()=>{
    const oldPin=$('#oldPinInput').value.trim(), newPin=$('#newPinInput2').value.trim();
    if(!/^[0-9]{4,6}$/.test(newPin)){$('#pinSetupStatus').textContent='Enter a 4-6 digit new PIN.';return}
    try{
      await changeApprovalPinRemote(oldPin,newPin);
      $('#oldPinInput').value='';
      $('#newPinInput2').value='';
      $('#pinSetupStatus').textContent='PIN changed.';
    }catch(err){
      $('#pinSetupStatus').textContent=err.message||'Could not change PIN.';
    }
  };
}
initAuthUI();

// Version 3.1 initial route
showModeNav('home');
$$('.screen').forEach(s=>s.classList.toggle('active',s.id==='home'));
