const KEY='ethansBaseballHQ.logoParent.v1';
const defaults={athleteName:'Ethan',daily:[],combine:[],quests:[],bonuses:[],claimedRewards:[],inventory:['default'],equipped:{frame:'default',background:'default',outfit:'default',prop:'default',faceAccent:'default',title:'default'},gearPurchases:[],shoutouts:[],gameScores:{homer:0},rainTokens:1,spinLog:[],arcadeGameLog:[],arcadeDaily:{date:'',spinsUsed:0,spinsAvailable:1,triviaAnswered:false,triviaCorrect:null,triviaSelected:null},programs:[],activeProgramId:null,draftProgram:null,presetsSeeded:false,teamProgram:null,teamProgramOptIn:false,currentTierIndex:0,combineCheckpoints:[],team:null,teamIdentityJoined:false,arcadeScores:{homeRunHero:{best:0,lastPlayed:null},cannonArm:{best:0,lastPlayed:null},dugoutDisaster:{best:0,lastPlayed:null},ballparkBreakout:{best:0,lastPlayed:null},skylineSlam:{best:0,lastPlayed:null},pocketPrecision:{best:0,lastPlayed:null},turfTrouble:{best:0,lastPlayed:null}},arcadeMetrics:{homeRunHero:0,cannonArm:0,dugoutDisaster:0,ballparkBreakout:0,skylineSlam:0,pocketPrecision:0,turfTrouble:0},attributePoints:{}};
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
const ARCADE_LOCAL_FIELDS=['arcadeScores','arcadeMetrics','gameScores','rainTokens','arcadeDaily'];
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

// brewers-callup keeps its original id on purpose: it's the FK in
// quest_completions and the weekly-dedupe key, so renaming the id would
// orphan history / allow duplicate awards. Only the display name and
// objective changed (Brewers Call-Up -> Baller Call Up); see migration 0028.
const quests=[
  {id:'daily-double',type:'Quest',img:'lua-quest-daily-double',title:'Daily Double',desc:'Complete two short workouts in one day.',xp:40},
  {id:'gold-glove',type:'Quest',img:'lua-quest-gold-glove-drill',title:'Gold Glove Drill',desc:'Complete 50 lateral shuffle touches.',xp:35},
  {id:'base-stealer',type:'Quest',img:'lua-quest-base-stealer-bonus',title:'Base Stealer Bonus',desc:'Complete 10 total 20-yard sprints.',xp:40},
  {id:'iron-core',type:'Quest',img:'lua-quest-iron-core',title:'Iron Core',desc:'Hold a plank for 60 seconds.',xp:45},
  {id:'power-hitter',type:'Quest',img:'lua-quest-power-hitter',title:'Power Hitter',desc:'Complete 15 broad jumps with good form.',xp:45},
  {id:'dad-challenge',type:'Quest',img:'lua-quest-dad-challenge',title:'Dad Challenge',desc:'Beat Dad in one approved challenge.',xp:60},
  {id:'fastball-monster',type:'Boss Battle',img:'lua-quest-fastball-monster',title:'Fastball Monster',desc:'15 push-ups, 45-sec plank, and 40 squats.',xp:100},
  {id:'base-dragon',type:'Boss Battle',img:'lua-quest-base-stealing-dragon',title:'Base-Stealing Dragon',desc:'8 sprints and 40 shuffle touches.',xp:100},
  {id:'spartan-trial',type:'Boss Battle',img:'lua-quest-spartan-trial',title:'Spartan Trial',desc:'Reach 60+ overall and complete a verified combine.',xp:125},
  {id:'brewers-callup',type:'Boss Battle',img:'lua-quest-baller-call-up',title:'Baller Call Up',desc:'Reach Baller tier.',xp:175}
];

// Tier labels reuse the same common/uncommon/rare/legendary "prize-giveaway
// hierarchy" language as the Arcade wheel's weighted tiers, just applied to
// reward spacing instead of wheel wedge size.
const rewardMilestones=[
  {xp:250,title:'Victory Treat',img:'lua-reward-victory-treat',desc:'A parent-approved dessert or sweet treat of the athlete\u2019s choice.',tier:'Common'},
  {xp:500,title:'Bonus Round',img:'lua-reward-bonus-round',desc:'An extra play session at a parent-approved activity spot, such as a court, rink, cage, or mini-golf course.',tier:'Common'},
  {xp:750,title:'Gear Grab',img:'lua-reward-gear-grab',desc:'A small sports or active-play gift chosen with a parent.',tier:'Uncommon'},
  {xp:1000,title:'Gear Store Draft',img:'lua-reward-gear-store-draft',desc:'A trip to a gear store to choose one parent-approved item.',tier:'Uncommon'},
  {xp:1500,title:'Fan Favorite',img:'lua-reward-fan-favorite',desc:'A surprise themed around the athlete\u2019s favorite team.',tier:'Rare'},
  {xp:2000,title:'All-Star Adventure',img:'lua-reward-all-star-adventure',desc:'A special sports outing or activity chosen with a parent.',tier:'Rare'},
  {xp:3000,title:'MVP Experience',img:'lua-reward-mvp-experience',desc:'A bigger, personalized end-of-season experience planned with a parent.',tier:'Legendary'}
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
const tierBadges={Rookie:'assets/tier-rookie.svg',Grinder:'assets/tier-grinder.svg',Baller:'assets/tier-baller.svg','All-Star':'assets/tier-allstar.svg',Elite:'assets/tier-elite.svg',Legend:'assets/tier-legend.svg'};
// Call-Up Ladder card-back content (tap-to-flip). Keyed by tile index
// (0-5), deliberately separate from the `tiers` array above so copy can
// be edited here without touching the tiers/thresholds that drive
// render()'s .active toggle and rating math.
const tierCardBacks=[
  {motto:'Every great player started here.',report:['Learns the basics right','Listens to coaches','Ready to try new things']},
  {motto:"Shows up and does the work — even when it's boring.",report:['Finishes every workout','Keeps the streak alive','Works on weaknesses']},
  {motto:'Brings the practice work to game day.',report:['Wants the ball in big moments','Uses practice skills in games','Shakes off mistakes fast']},
  {motto:'Makes everyone around them better.',report:['Picks up teammates',"Cheers others' wins loudly",'Leads by example']},
  {motto:"Holds the standard when no one's watching.",report:['Trains without reminders','Takes coaching, no excuses','Helps Rookies learn']},
  {motto:'Remembered for how they played — and who they lifted up.',report:['Leads every day','Mentors younger players','Respects everyone, win or lose']}
];
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
  if(id==='coachhq') return 'coachhq';
  if(id==='parent') return 'parent';
  return 'home';
}
function showModeNav(mode){
  // Round 14: active-state icon color now cascades from the button's own
  // .active class via plain CSS descendant selectors (.mode-btn.active
  // .lua-icon), so no separate icon-level class to toggle here anymore.
  $$('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  ['athlete','team','arcade','coachhq','parent'].forEach(m=>{
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
    // Every remaining arcade game keeps its own session state inside its
    // iframe, so there's nothing to reset on entering Arcade.
    switchScreen('arcade');
  }
  if(mode==='coachhq') switchScreen('coachhq');
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
  alert(result.status==='verified'?'Combine test saved and verified.':'Saved as pending. Approve it later from Settings.');
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
const LOCAL_ONLY_FIELDS=['programs','activeProgramId','draftProgram','presetsSeeded','arcadeScores','arcadeMetrics','gameScores','rainTokens','arcadeDaily'];
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
  state.arcadeScores={homeRunHero:{best:0,lastPlayed:null},cannonArm:{best:0,lastPlayed:null},dugoutDisaster:{best:0,lastPlayed:null},ballparkBreakout:{best:0,lastPlayed:null},skylineSlam:{best:0,lastPlayed:null},pocketPrecision:{best:0,lastPlayed:null},turfTrouble:{best:0,lastPlayed:null}};
  state.arcadeMetrics={homeRunHero:0,cannonArm:0,dugoutDisaster:0,ballparkBreakout:0,skylineSlam:0,pocketPrecision:0,turfTrouble:0};
  state.gameScores={homer:0};
  state.rainTokens=1;
  state.spinLog=[];
  state.arcadeGameLog=[];
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
// Simple black checkbox; when done, a bold cyan marker-style checkmark
// (constant-width, square-ended, ink-outlined so it stays readable on white) fills the box and
// its long stroke sweeps out past the box edge. Pure inline SVG so it needs
// no art files and scales crisply. Status is announced as text, not just
// color/shape, via the visually-hidden span.
function luaCheckHTML(done){
  const mark=done?'<svg viewBox="0 0 24 24" aria-hidden="true"><path class="lua-check-outline" d="M3.8 12.6L9 18Q13.6 10.6 21 3.6"/><path class="lua-check-mark" d="M3.8 12.6L9 18Q13.6 10.6 21 3.6"/></svg>':'';
  return `<span class="lua-check${done?' done':''}" aria-hidden="true">${mark}</span><span class="sr-only">${done?'Done: ':'Not yet: '}</span>`;
}
function renderPathToNextTier(){
  const c=$('#pathToNextTier'); if(!c) return;
  const path=pathToNextTier();
  if(!path){c.innerHTML='<p class="muted">🏆 Top tier reached — Legend status confirmed.</p>';return}
  c.innerHTML=`<p class="eyebrow dark">Path to ${path.nextTierName}</p><ul class="path-checklist">${path.items.map(i=>`<li class="${i.done?'done':''}">${luaCheckHTML(i.done)}<span>${i.label}</span></li>`).join('')}</ul>`;
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
// The rank badge artwork (Round 16 v2) is deliberately name-free — one
// consistent shield shape, black + a single accent color, no baked-in
// text — so unlike the old sticker-style art, the ladder needs its own
// name label per card now. Reuses .tier-name-graffiti, the same gradient
// treatment already shown as real text in the status bar / Player Card.
// Tap-to-flip: every .tier keeps the exact id/class/order render()'s
// .active toggle already depends on ($$('.tier').forEach(...) at
// app.js's render()) — the flip only adds a .tier-inner wrapper around
// the existing front content plus a new .tier-back face, and card-stock
// visual styling (background/border/the "CALL UP" tag) moves from
// .tier.cardtier itself onto each face in styles.css so both faces still
// look like the same physical card. EARNED ✓ / KEEP GRINDING TO UNLOCK
// on the back is pure CSS (.tier.active .tier-locked / .tier:not(.active)
// .tier-earned) rather than computed here, since renderLadder() only
// runs once at boot while .active gets re-toggled on every render() —
// baking the earned state into HTML here would go stale.
function renderLadder(){
  const c=$('#ladderContainer'); if(!c) return;
  c.innerHTML=tiers.map((t,i)=>{
    const back=tierCardBacks[i]||{motto:'',report:[]};
    return `<div class="tier cardtier" id="tier${i}" role="button" tabindex="0" aria-pressed="false" aria-label="${t.name} tier card. Press to flip for details.">
      <div class="tier-inner">
        <div class="tier-front tier-face">${tierBadgeHTML(t.name)}<span class="tier-name-graffiti tier-ladder-name">${t.name}</span></div>
        <div class="tier-back tier-face">
          <p class="tier-motto">“${back.motto}”</p>
          <div class="tier-report"><p class="tier-report-label">Scouting Report</p><ul>${back.report.map(line=>`<li>${line}</li>`).join('')}</ul></div>
          <p class="tier-earned">Earned ✓</p>
          <p class="tier-locked">Keep grinding to unlock</p>
        </div>
      </div>
    </div>`;
  }).join('');
}
function toggleTierFlip(el){
  const flipped=el.classList.toggle('flipped');
  el.setAttribute('aria-pressed',flipped?'true':'false');
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
$('#dailyLog').innerHTML=workoutHistoryTable(state.daily.slice(-10).reverse());
$('#combineLog').innerHTML=combineHistoryTable(state.combine.slice().reverse());
$('#pendingList').innerHTML=table(['Week','Program','Status'],state.combine.filter(a=>!a.verified).map(a=>[a.week,a.programName||'—',a.status]));
const targetLabels={pushups:'Push-ups',squats:'Squats',plank:'Plank (sec)',shuffleTouches:'Lateral Shuffle Touches',skaterJumps:'Skater Jumps',broadJumpIn:'Broad Jump (in)'};
$('#targets').innerHTML=Object.entries({pushups:rec.pushups,squats:rec.squats,plank:rec.plank,shuffleTouches:rec.shuffleTouches,skaterJumps:rec.skaterJumps,broadJumpIn:rec.broadJumpIn}).map(([k,v])=>`<p><strong>${targetLabels[k]||k}</strong>: current ${v||0}</p>`).join('');renderQuests();renderRewards();renderGearLocker();renderPlayerCardHero();renderCoachReport();renderTeamEdition();renderCombineProgramPicker();renderCharts()}


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
// Round 17 — XP Vault + Reward Track visual refresh. The underlying
// economy is unchanged: rewardMilestones stay repeatable, balance-priced
// items (claiming still spends from the same pool as Gear Locker
// purchases — see availableBalance()/claimReward()). This only changes
// how that data is presented: a vault-styled balance hero, a Reward
// Track stepper across all milestones (2 states only — locked/ready,
// same eligibility test as the tiles below, so the track never implies
// a state the tiles contradict), and status icons per tile.
function renderRewards(){
  const total=xp();
  const spent=totalXPSpent();
  const balance=availableBalance();
  const next=rewardMilestones.find(r=>balance<r.xp);
  if($('#balanceBig')) $('#balanceBig').textContent=balance;
  if($('#lifetimeXPBig')) $('#lifetimeXPBig').textContent=total;
  if($('#spentXPBig')) $('#spentXPBig').textContent=spent;
  if($('#claimsCountBig')) $('#claimsCountBig').textContent=(state.claimedRewards||[]).length;
  if($('#rewardTrackText')) $('#rewardTrackText').textContent=next?`${balance} XP available. ${next.xp-balance} XP until you can claim ${next.title}.`:`${balance} XP available. Every listed reward is claimable!`;
  if($('#rewardTrack')) $('#rewardTrack').innerHTML=rewardMilestones.map((r,i)=>{
    const ready=balance>=r.xp;
    const isNext=r===next;
    const icon=ready?'assets/xp/lua-reward-ready.svg':'assets/xp/lua-reward-locked.svg';
    const connector=i<rewardMilestones.length-1?`<div class="reward-track-connector ${ready?'filled':''}"></div>`:'';
    return `<div class="reward-track-step">
      <div class="reward-track-node ${ready?'ready':'locked'}">
        <img src="${icon}" alt="${ready?'Ready to claim':'Locked'}" width="40" height="40">
        ${isNext?`<img src="assets/xp/lua-reward-marker.svg" alt="Next goal" class="reward-track-marker">`:''}
      </div>
      <span class="reward-track-amount">${r.xp}</span>
    </div>${connector}`;
  }).join('');
  if($('#rewardVault')) $('#rewardVault').innerHTML=rewardMilestones.map(r=>{
    const available=balance>=r.xp;
    const claimCount=(state.claimedRewards||[]).filter(c=>c.title===r.title).length;
    return `<div class="reward-tile ${available?'unlocked':''}">
      <span class="reward-tier-badge tier-${r.tier.toLowerCase()}">${r.tier}</span>
      <img class="reward-status-icon" src="${available?'assets/xp/lua-reward-ready.svg':'assets/xp/lua-reward-locked.svg'}" alt="${available?'Ready to claim':'Locked'}" width="32" height="32">
      <img class="reward-art" src="assets/rewards/${r.img}.webp" alt="" width="96" height="96" loading="lazy">
      <h3>${r.title}</h3>
      <p class="reward-price"><img src="assets/xp/lua-xp-coin.svg" alt="" width="22" height="22"><strong>${r.xp} XP</strong></p>
      <p>${r.desc}</p>
      <strong>${available?'Available':`${r.xp-balance} XP away`}</strong>
      ${claimCount?`<p class="muted"><img src="assets/xp/lua-reward-claimed.svg" alt="" width="16" height="16" style="vertical-align:-3px;margin-right:4px">Claimed ${claimCount}x</p>`:''}
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
document.addEventListener('change',e=>{
  const colorInput=e.target.closest('.gear-color-input');
  if(colorInput) setGearColor(colorInput.dataset.slot,colorInput.value);
});
async function setGearColor(slot,colorHex){
  if(!activeAthlete) return;
  try{
    state.slotColors=await setGearColorRemote(activeAthlete.id,slot,colorHex,state.slotColors);
  }catch(err){
    alert('Could not save color: '+(err.message||'unknown error'));
    return;
  }
  renderAvatarComposite($('#gearAvatarPreview'));
}

function renderQuests(){
  const wk=weekStartISO(todayISO());
  const completedThisWeek=new Set((state.quests||[]).filter(x=>weekStartISO(x.date)===wk).map(x=>x.id));
  if($('#questSelect')) $('#questSelect').innerHTML=quests.map(q=>`<option value="${q.id}" ${completedThisWeek.has(q.id)?'disabled':''}>${q.type}: ${q.title} (+${q.xp} XP)${completedThisWeek.has(q.id)?' — done this week':''}</option>`).join('');
  if($('#questList')) $('#questList').innerHTML=quests.map(q=>{
    const doneThisWeek=completedThisWeek.has(q.id);
    const lifetimeCount=(state.quests||[]).filter(x=>x.id===q.id).length;
    return `<div class="quest-card ${q.type==='Boss Battle'?'battle':''} ${doneThisWeek?'complete':''}">
      <img class="quest-art" src="assets/quests/${q.img}.webp" alt="" width="112" height="112" loading="lazy">
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
  const nickname=activeAthlete&&activeAthlete.nickname;
  if($('#playerCardName')) $('#playerCardName').textContent=nickname||name;
  if($('#playerCardRealName')){
    $('#playerCardRealName').textContent=nickname?name:'';
    $('#playerCardRealName').classList.toggle('hidden',!nickname);
  }
  if($('#playerCardTeam')) $('#playerCardTeam').textContent=(athleteTeamMembership&&athleteTeamMembership.status==='approved'&&athleteTeamMembership.teams&&athleteTeamMembership.teams.name)||'Free Agent';
  if($('#playerCardAge')) $('#playerCardAge').textContent=(activeAthlete&&activeAthlete.age)||'—';
  if($('#playerCardHeroAvatar')){
    const url=activeAthlete&&activeAthlete.avatar_url;
    const heroImg=$('#playerCardHeroAvatar');
    const sampleImgs=$('#playerCardSlot')?[...$('#playerCardSlot').querySelectorAll('img:not(#playerCardHeroAvatar):not(#playerCardGearOverlayFaceExtra)')]:[];
    heroImg.src=url||'';
    heroImg.classList.toggle('hidden',!url);
    sampleImgs.forEach(img=>img.classList.toggle('hidden',!!url));
    if($('#playerCardDots')) $('#playerCardDots').classList.toggle('hidden',!!url);
    if($('#viewSampleAvatarsBtn')) $('#viewSampleAvatarsBtn').classList.toggle('hidden',!url);
    // Nameplate only overlays the real generated photo — the rotating
    // sample cards already have their own baked-in captions, so showing
    // it there too would double up.
    if($('#playerCardNameplate')) $('#playerCardNameplate').classList.toggle('hidden',!url);
    // Real gear art layered on top of the real photo — only for slots
    // that have art (gearItemArt) and only once a real avatar exists.
    // Respects the same skin-hides-faceExtra rule as the Gear Locker's
    // own compositing preview.
    if($('#playerCardGearOverlayFaceExtra')){
      const equipped=state.equipped||defaultEquipped;
      const skinActive=!!(equipped.skin&&equipped.skin!=='default');
      const faceExtraArt=!skinActive&&gearItemArt[equipped.faceExtra];
      const overlay=$('#playerCardGearOverlayFaceExtra');
      overlay.src=(url&&faceExtraArt)||'';
      overlay.classList.toggle('hidden',!(url&&faceExtraArt));
    }
  }
  [...performanceAxisOrder,'consistency'].forEach(k=>{
    const bar=$('#'+k+'Bar');
    if(!bar) return;
    bar.classList.remove('tier-red','tier-amber','tier-blue','tier-green');
    bar.classList.add(ratingTierClass(+($('#'+k).textContent)||0));
  });
}
// Early access — gated server-side by ALLOWED_ATHLETE_IDS on the
// generate-avatar-face Edge Function, so this is safe to expose to every
// signed-in parent even though only approved athletes will succeed.
function buildYourAthlete(){
  if(!activeAthlete){alert('Sign in and select an athlete first.');return}
  $('#buildAvatarStepUpload').classList.remove('hidden');
  $('#buildAvatarStepReview').classList.add('hidden');
  $('#avatarSelfieInput').value='';
  $('#buildAvatarStatus').textContent='';
  $('#buildAvatarModal').classList.remove('hidden');
}
function hideBuildAvatarModal(){$('#buildAvatarModal').classList.add('hidden')}
function fileToDataUri(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(reader.error||new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}
let pendingAvatarUrl=null;
async function generateAvatarAction(){
  const file=$('#avatarSelfieInput').files[0];
  if(!file){$('#buildAvatarStatus').textContent='Choose a photo first.';return}
  $('#buildAvatarStatus').textContent='Generating... this can take 20-30 seconds.';
  $('#generateAvatarBtn').disabled=true;
  try{
    const dataUri=await fileToDataUri(file);
    const style=$('#avatarStyleSelect')?$('#avatarStyleSelect').value:'illustrated';
    const {image_url}=await generateAvatarFaceRemote(activeAthlete.id,dataUri,'flux-2-pro',style);
    pendingAvatarUrl=image_url;
    $('#avatarPreviewImg').src=image_url;
    $('#buildAvatarStepUpload').classList.add('hidden');
    $('#buildAvatarStepReview').classList.remove('hidden');
  }catch(err){
    $('#buildAvatarStatus').textContent=err.message||'Could not generate an avatar. Try a different photo.';
  }finally{
    $('#generateAvatarBtn').disabled=false;
  }
}
async function saveAvatarAction(){
  if(!pendingAvatarUrl||!activeAthlete) return;
  try{
    await saveAthleteAvatarUrl(activeAthlete.id,pendingAvatarUrl);
    activeAthlete.avatar_url=pendingAvatarUrl;
  }catch(err){
    alert('Could not save avatar: '+(err.message||'unknown error'));
    return;
  }
  pendingAvatarUrl=null;
  hideBuildAvatarModal();
  renderPlayerCardHero();
}
function retryAvatarAction(){
  pendingAvatarUrl=null;
  $('#buildAvatarStepReview').classList.add('hidden');
  $('#buildAvatarStepUpload').classList.remove('hidden');
  $('#avatarSelfieInput').value='';
  $('#buildAvatarStatus').textContent='';
}
// Feedback to Developer (Coach/Parent Corner) — write-only, see
// 0021_developer_feedback.sql. pageContext is just the current screen id,
// captured so a bug report carries some idea of where it happened.
async function sendDeveloperFeedback(){
  if(!currentProfile){alert('Sign in first.');return}
  const input=$('#devFeedbackInput');
  const message=(input.value||'').trim();
  if(!message){$('#devFeedbackStatus').textContent='Write a message first.';return}
  $('#sendDevFeedbackBtn').disabled=true;
  try{
    const pageContext=document.querySelector('.screen.active')?.id||null;
    await submitDeveloperFeedback(currentProfile.id,activeAthlete&&activeAthlete.id,message,pageContext);
    input.value='';
    $('#devFeedbackStatus').textContent='Thanks — sent to the developer!';
  }catch(err){
    $('#devFeedbackStatus').textContent='Could not send feedback: '+(err.message||'unknown error');
  }finally{
    $('#sendDevFeedbackBtn').disabled=false;
  }
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
  const images=[...slot.querySelectorAll('img:not(#playerCardHeroAvatar)')];
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
  if(e.target.id==='playerCardName'){
    if(!activeAthlete) return;
    const val=prompt('Enter a nickname for the player card (leave blank to remove):',activeAthlete.nickname||'');
    if(val===null) return;
    const nickname=val.trim().slice(0,30)||null;
    updateAthleteNickname(activeAthlete.id,nickname).then(()=>{
      activeAthlete.nickname=nickname;
      const idx=currentAthletes.findIndex(a=>a.id===activeAthlete.id);
      if(idx>=0) currentAthletes[idx].nickname=nickname;
      renderPlayerCardHero();
    }).catch(err=>alert('Could not save nickname: '+(err.message||err)));
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
// Illustrated Skill Lab category icons (LUA-Skill-Lab-Illustrated-Icons-v2).
// Keyed by the same 8 goalChipDefs categories; Teamwork has no illustrated
// icon (it's not one of the 8 goal tiles, only reachable via the hidden
// #libraryCategory select) so it falls back to categoryIcons' emoji.
const categoryIconImg={Strength:'assets/skill-lab-icons/lua-skill-stronger.png',Speed:'assets/skill-lab-icons/lua-skill-faster.png',Quickness:'assets/skill-lab-icons/lua-skill-quicker.png','Jumping/Plyometrics':'assets/skill-lab-icons/lua-skill-jump-higher.png',Core:'assets/skill-lab-icons/lua-skill-more-durable.png',Balance:'assets/skill-lab-icons/lua-skill-better-balance.png',Coordination:'assets/skill-lab-icons/lua-skill-better-coordination.png',Mobility:'assets/skill-lab-icons/lua-skill-more-flexible.png'};
// Round 9 item 10 — goal-chip nav, one per non-Teamwork category. Tile
// labels now match the category name itself (Kurt's rename request), not
// the old "goal phrasing" (Stronger/Faster/...) — Jump Higher was kept
// as-is since the raw category key ("Jumping/Plyometrics") is a bad
// display label. Icon filenames still say lua-skill-stronger.png etc.
// (unchanged, cosmetic-only rename would just be churn).
const goalChipDefs=[
  {category:'Strength',label:'Strength',icon:'💪',img:'assets/skill-lab-icons/lua-skill-stronger.png'},
  {category:'Speed',label:'Speed',icon:'⚡',img:'assets/skill-lab-icons/lua-skill-faster.png'},
  {category:'Quickness',label:'Quickness',icon:'🏃',img:'assets/skill-lab-icons/lua-skill-quicker.png'},
  {category:'Jumping/Plyometrics',label:'Jump Higher',icon:'🚀',img:'assets/skill-lab-icons/lua-skill-jump-higher.png'},
  {category:'Core',label:'Core',icon:'🛡',img:'assets/skill-lab-icons/lua-skill-more-durable.png'},
  {category:'Balance',label:'Balance',icon:'⚖',img:'assets/skill-lab-icons/lua-skill-better-balance.png'},
  {category:'Coordination',label:'Coordination',icon:'🎯',img:'assets/skill-lab-icons/lua-skill-better-coordination.png'},
  {category:'Mobility',label:'Mobility',icon:'🧘',img:'assets/skill-lab-icons/lua-skill-more-flexible.png'}
];

// ---- Skills Lab activity catalog ----
// Each activity: {id, name, category, sportTags, ageBand, media, metric}
// media.video.plannedUrl, when set (via a sampleMedia entry's videoUrl), is
// rendered as a real <video> by renderActivityDetail() — see that function.
// Still null/"coming soon" for every activity without one.
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
    ['Squats',()=>M.reps(),{Strength:3,Jump:1}],
    ['Jump Squats',()=>M.reps(),{Strength:2,Jump:2}],
    ['Glute Bridge',()=>M.reps(),{Strength:3,Core:1}],
    ['Lunges',()=>M.reps('Reps (each leg)'),{Strength:3,Balance:1}],
    ['Pull-Ups',()=>M.reps(),{Strength:3}],
    ['Dead Hang',M.duration,{Strength:2,Core:1}]
  ],
  Core:[
    ['Plank',M.duration,{Core:3}],
    ['Side Plank',M.duration,{Core:3,Balance:1}],
    ['Hollow Hold',M.duration,{Core:3}],
    ['Dead Bugs',()=>M.reps(),{Core:3,Coordination:1}],
    ['Bird Dog',()=>M.reps(),{Core:3,Balance:1}],
    ['Bear Crawl',()=>M.reps('Steps'),{Core:2,Coordination:2}]
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
// Full Skills Lab move guide (skills-lab-move-guide.md), authored for every
// activity in activityDefs except Teamwork (not a physical movement).
// instructionText joins the guide's "How to" bullets into one paragraph;
// commonFaults is its single "Don't" callout per move, emoji stripped.
// formCues stays empty here — the guide doesn't author a separate cue
// list distinct from the How To paragraph, and duplicating the same
// sentences under a second heading just reads as repetition.
const sampleMedia={
  'Push-ups':{instructionText:'Hands under shoulders, body in one straight line from head to heels. Squeeze your core and butt tight, lower your chest almost to the floor, elbows at about a 45° angle, then push back up.',formCues:[],commonFaults:['Don’t let your hips sag or pike up in the air — that’s cheating your core and can tweak your lower back.'],videoUrl:'assets/videos/push-ups-demo.mp4'},
  'Squats':{instructionText:'Feet shoulder-width, toes turned slightly out. Sit your hips back and down like you’re sitting in a chair. Chest up, knees tracking over your toes, go as low as you can control.',formCues:[],commonFaults:['Don’t let your knees cave inward — keep them pushed out in line with your feet the whole time.'],videoUrl:'assets/videos/squats-demo.mp4'},
  'Jump Squats':{instructionText:'Squat down like normal, then explode straight up as high as you can. Land soft with bent knees and reset right into the next rep.',formCues:[],commonFaults:['Don’t land stiff-legged — always land quiet and soft to protect your knees and ankles.'],videoUrl:'assets/videos/jump-squats-demo.mp4'},
  'Glute Bridge':{instructionText:'Lie on your back, knees bent, feet flat on the floor. Squeeze your glutes and lift your hips up until your body’s a straight line from shoulders to knees.',formCues:[],commonFaults:['Don’t overarch your lower back to get higher — squeeze your butt to lift, not your spine.'],videoUrl:'assets/videos/glute-bridge-demo.mp4'},
  'Lunges':{instructionText:'Step one leg back and slightly behind you, drop that back knee toward the ground, then push back up to standing. Alternate legs each rep.',formCues:[],commonFaults:['Don’t let your front knee cave inward or shoot way past your toes.'],videoUrl:'assets/videos/drop-lunges-demo.mp4'},
  'Pull-Ups':{instructionText:'Grab the bar just outside shoulder-width, hang with arms fully straight, then pull your chin over the bar leading with your chest. Lower back down under control — don’t just drop.',formCues:[],commonFaults:['Don’t kip or swing wildly to "cheat" a rep up — that yanks on your shoulders. Full arm extension at the bottom, every rep.'],videoUrl:'assets/videos/pull-ups-demo.mp4'},
  'Dead Hang':{instructionText:'Grab the bar with a firm grip, feet off the ground, shoulders relaxed but engaged, and just hang there and breathe.',formCues:[],commonFaults:['Don’t hang until your grip suddenly gives out and you drop wrong — hop off and reset the second your hands start slipping.'],videoUrl:'assets/videos/dead-hang-demo.mp4'},
  'Plank':{instructionText:'Forearms and toes on the ground, body in one straight line, core braced tight, eyes down at the floor.',formCues:[],commonFaults:['Don’t let your hips sag toward the floor or pike up toward the ceiling.'],videoUrl:'assets/videos/plank-demo.mov'},
  'Side Plank':{instructionText:'Lie on your side, prop up on one forearm stacked right under your shoulder, lift your hips so your body forms a straight line. Stack your feet on top of each other.',formCues:[],commonFaults:['Don’t let your hips drop or rotate forward — keep everything stacked and square.'],videoUrl:'assets/videos/side-plank-demo.mp4'},
  'Hollow Hold':{instructionText:'Lie on your back, press your lower back flat into the floor, and lift your shoulders and legs slightly off the ground, arms reaching overhead. Hold that "banana" shape and breathe steady.',formCues:[],commonFaults:['Don’t let your lower back arch up off the floor — that means your legs are too low, so raise them a bit until your back stays flat.']},
  'Dead Bugs':{instructionText:'Lie on your back, arms reaching straight up, knees bent at 90°. Slowly lower one arm and the opposite leg toward the floor while keeping your lower back flat, then switch sides.',formCues:[],commonFaults:['Don’t let your lower back lift off the floor as you lower — that means you’re going too low too soon. Only go as far as you can control.']},
  'Bird Dog':{instructionText:'On hands and knees, extend one arm and the opposite leg straight out, hips staying level, hold briefly, then switch.',formCues:[],commonFaults:['Don’t let your hips twist or rotate open — keep them square to the floor the whole time.'],videoUrl:'assets/videos/bird-dog-demo.mp4'},
  'Bear Crawl':{instructionText:'Hands and toes on the ground, knees hovering just above the floor, crawl forward moving opposite hand and foot together. Keep your hips low and steady.',formCues:[],commonFaults:['Don’t let your hips pop up high in the air — keep your back flat like a tabletop.']},
  '10-yard Sprint':{instructionText:'Start in an athletic stance, drive your first steps low and hard, pump your arms, sprint all the way through the line.',formCues:[],commonFaults:['Don’t stand straight up right away — popping up too early kills your acceleration.'],videoUrl:'assets/videos/10-yard-sprint-demo.mp4'},
  '20-yard Sprint':{instructionText:'Same drive-phase start, gradually rising up into a tall sprint as you go, eyes up, arms driving front to back.',formCues:[],commonFaults:['Don’t slow down before you reach the line — always sprint through it, not to it.']},
  '40-Yard Sprint':{instructionText:'Same mechanics, just longer — drive phase into a full, tall stride, relaxed shoulders and face.',formCues:[],commonFaults:['Don’t tense up your shoulders or clench your jaw — staying relaxed at top speed is what actually makes you faster.']},
  'Hill Sprint':{instructionText:'Find a moderate hill, lean into the incline a bit, drive your knees up and pump your arms hard to the top.',formCues:[],commonFaults:['Don’t sprint back down the hill for "extra reps" — that’s exactly how ankles get rolled. Walk back down.'],videoUrl:'assets/videos/hill-sprint-demo.mp4'},
  'Flying Sprint':{instructionText:'Build up your speed with a rolling start (jog into a sprint) before hitting your top speed through the marked zone.',formCues:[],commonFaults:['Don’t jump straight into an all-out sprint from a dead stop without warming up first — cold hamstrings pull easily.']},
  'Skater Jumps':{instructionText:'Push off one leg, leap sideways, and land soft on the other leg with a bent knee, reaching the opposite arm across your body.',formCues:[],commonFaults:['Don’t land with a stiff, straight knee — that’s how ankles and knees get tweaked.']},
  'Lateral Shuffle':{instructionText:'Athletic stance, stay low, shuffle side to side without ever crossing your feet.',formCues:[],commonFaults:['Don’t stand up tall while shuffling — staying low the whole time is what makes this drill actually work.'],videoUrl:'assets/videos/lateral-shuffle-demo.mp4'},
  'Shuttle Run':{instructionText:'Sprint to a line, touch it, sprint back the other way, touch again — stay low through every direction change.',formCues:[],commonFaults:['Don’t round your turns wide and lazy — plant hard and snap back the other direction.']},
  'Carioca':{instructionText:'Move sideways while crossing one foot in front, then behind, keeping your hips loose and quick.',formCues:[],commonFaults:['Don’t stare down at your feet the whole time — once you’ve got it, keep your head up.']},
  'Zig-Zag Cones':{instructionText:'Set cones in a zig-zag line, cut hard at each one while staying low, changing direction off your outside foot.',formCues:[],commonFaults:['Don’t run wide loops around the cones — sharp, tight cuts are the entire point of this drill.']},
  'Box Drill':{instructionText:'Four cones in a square — sprint, shuffle, backpedal, then shuffle back around, staying low at every corner.',formCues:[],commonFaults:['Don’t stand up tall at the corners — that’s exactly where all your speed leaks out.']},
  'Broad Jump':{instructionText:'Feet shoulder-width, swing your arms back then explosively forward as you jump out as far as you can. Land soft with bent knees, stay balanced.',formCues:[],commonFaults:['Don’t land stiff or fall backward — stick the landing balanced with your knees bent.']},
  'Vertical Jump':{instructionText:'Quick dip down, swing your arms up hard, jump straight up as high as you can.',formCues:[],commonFaults:['Don’t skip the landing — always absorb it through bent knees instead of just crashing down straight-legged.'],videoUrl:'assets/videos/vertical-jump-demo.mp4'},
  'Single-Leg Hops':{instructionText:'Balance on one leg, hop forward or in place with small, controlled hops, landing soft on that same leg each time.',formCues:[],commonFaults:['Don’t push through these if your balance feels shaky that day — do fewer reps and build up over time.'],videoUrl:'assets/videos/single-leg-hops-demo.mp4'},
  'Squat Jump':{instructionText:'Squat down, then explode straight up as high as you can, landing back down into a soft, controlled squat.',formCues:[],commonFaults:['Don’t rush the landing — control it down into the next squat instead of just collapsing.']},
  'Box Jump':{instructionText:'Face a sturdy box that’s an appropriate height for you, swing your arms, and jump up landing with both feet fully on top, knees soft.',formCues:[],commonFaults:['Don’t jump onto a box too high to land on with full control — and always step back down, never jump down off the box.'],videoUrl:'assets/videos/box-jump-demo.mp4'},
  'Tuck Jump':{instructionText:'Jump straight up and pull both knees up toward your chest, landing soft and quiet.',formCues:[],commonFaults:['Don’t lean way forward or backward in the air — stay tall and controlled.'],videoUrl:'assets/videos/tuck-jump-demo.mp4'},
  'Jump Rope':{instructionText:'Small hops, just enough to clear the rope, elbows in close to your body, wrists doing the turning.',formCues:[],commonFaults:['Don’t jump way too high off the ground — big jumps throw off your rhythm and gas you out fast.'],videoUrl:'assets/videos/jump-rope-demo.mp4'},
  'Pogo Jumps':{instructionText:'Quick, small, springy hops using mostly your ankles, like a pogo stick — barely bend your knees.',formCues:[],commonFaults:['Don’t turn these into big bounding jumps — keep it quick, small, and low to the ground.'],videoUrl:'assets/videos/pogo-jumps-demo.mp4'},
  'Single-Leg Balance':{instructionText:'Stand on one leg, other knee lifted, pick a spot to focus your eyes on, and hold steady.',formCues:[],commonFaults:['Don’t lock your standing knee out stiff — keep a soft bend so you can actually adjust and balance.'],videoUrl:'assets/videos/single-leg-balance-demo.mp4'},
  'Single-Leg Reach':{instructionText:'Balance on one leg, hinge forward at your hips and reach the opposite hand toward the ground, keeping your back flat, then return to standing.',formCues:[],commonFaults:['Don’t round your back to reach farther — the bend comes from your hips, not your spine.'],videoUrl:'assets/videos/single-leg-reach-demo.mp4'},
  'Heel-to-Toe Walk':{instructionText:'Walk in a straight line placing the heel of one foot directly in front of the toes of the other, arms out for balance.',formCues:[],commonFaults:['Don’t rush through it — slow and controlled is what actually trains your balance.']},
  'High Knees':{instructionText:'Quick jog in place or moving forward, driving your knees up to about waist height, arms pumping opposite your legs.',formCues:[],commonFaults:['Don’t lean back — stay tall and really drive your knees up instead of just taking fast tiny steps.']},
  'Butt Kicks':{instructionText:'Quick jog kicking your heels straight up toward your glutes, staying light on your feet, arms pumping.',formCues:[],commonFaults:['Don’t kick your heels out to the side — keep the motion straight up and down.']},
  'Ladder Quick Feet':{instructionText:'Run through an agility ladder (or taped squares on the ground) with fast, light steps in the assigned pattern.',formCues:[],commonFaults:['Don’t stare down at your feet the whole drill — that actually slows your reaction time. Trust your feet.']},
  'Crossovers':{instructionText:'Step one foot over and across the other while moving sideways, quick and light, staying low.',formCues:[],commonFaults:['Don’t cross so far that you lose your balance — smaller, quicker steps beat one big lunging step.']},
  'Mountain Climbers':{instructionText:'Start in a plank/push-up position, drive your knees alternately toward your chest quickly, core tight, hips level.',formCues:[],commonFaults:['Don’t let your hips bounce up and down — keep them level like a plank the entire time.'],videoUrl:'assets/videos/mountain-climbers-demo.mp4'},
  'Hip Mobility':{instructionText:'Flow through moves like 90/90 switches and lateral lunges, moving slow and controlled to open up your hips.',formCues:[],commonFaults:['Don’t bounce or force a stretch — ease into your range, never yank or jerk into it.'],videoUrl:'assets/videos/hip-mobility-demo.mp4'},
  'Shoulder Mobility':{instructionText:'Slow arm circles, shoulder rolls, and cross-body reaches to loosen up your shoulders before throwing, hitting, or lifting.',formCues:[],commonFaults:['Don’t do fast, jerky arm swings — shoulders respond a lot better to slow and controlled movement.']},
  "World's Greatest Stretch":{instructionText:'Step into a lunge, drop your same-side hand to the floor, then rotate your other arm up toward the ceiling, following it with your eyes. Switch sides.',formCues:[],commonFaults:['Don’t force the rotation further than feels comfortable — a little bit every day beats forcing it once.']},
  'Deep Squat Hold':{instructionText:'Sink down into the lowest comfortable squat position, chest up, and just hang out there and breathe.',formCues:[],commonFaults:['Don’t force your heels flat to the floor if they want to pop up — that improves gradually on its own, don’t force it.'],videoUrl:'assets/videos/deep-squat-hold-demo.mp4'},
  'Hamstring Stretch':{instructionText:'Sit or stand, extend one leg out, and hinge forward from your hips (not your back) reaching toward your toes with a slight bend in the knee.',formCues:[],commonFaults:['Don’t bounce into the stretch — hold it still and let it ease out on its own.']},
  'Thoracic Rotation':{instructionText:'On hands and knees or lying on your side, rotate your upper back and reach one arm up and open toward the ceiling, eyes following your hand.',formCues:[],commonFaults:['Don’t force the twist from your lower back — the rotation should come from your upper spine, not your hips.']},
};
const activities=categoryOrder.flatMap(cat=>activityDefs[cat].map(([name,metricFn,attrs])=>{
  const m=sampleMedia[name];
  return {
    id:slug(name),
    name,
    category:cat,
    sportTags:['multi-sport'],
    ageBand:'all',
    media:m?{instructionText:m.instructionText,formCues:m.formCues||[],commonFaults:m.commonFaults||[],video:{plannedUrl:m.videoUrl||null}}:emptyMedia(),
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
// one without building anything. Each activity carries a prescribed target
// (sets + a value, with a short unit string chosen per entry rather than
// derived from the activity's own metric — e.g. Broad Jump's catalog
// metric unit is "in", but the target here is "attempts", not inches) so
// the program tile can show real guidance like "2 sets × 10 reps" instead
// of just a bare exercise name. The target is display-only: the athlete
// still logs however many sets they actually did via Add Set, same as
// before — nothing here is enforced.
const presetDefs=[
  {name:'Level 1: Base Camp',activities:[
    {name:'Squats',sets:2,value:10,unit:'reps'},
    {name:'Push-ups',sets:2,value:5,unit:'reps'},
    {name:'Lunges',sets:1,value:5,unit:'reps each leg'},
    {name:'Bear Crawl',sets:1,value:20,unit:'steps'},
    {name:'Plank',sets:1,value:20,unit:'sec'}
  ]},
  {name:'Level 2: The Grind',activities:[
    {name:'Jump Squats',sets:2,value:10,unit:'reps'},
    {name:'Bird Dog',sets:1,value:8,unit:'reps each side'},
    {name:'Push-ups',sets:1,value:10,unit:'reps'},
    {name:'Lunges',sets:1,value:10,unit:'reps each leg'},
    {name:'Plank',sets:2,value:20,unit:'sec'},
    {name:'Pogo Jumps',sets:1,value:15,unit:'reps'},
    {name:'Bear Crawl',sets:1,value:20,unit:'steps'}
  ]},
  {name:'Level 3: Boss Level',activities:[
    {name:'Jump Squats',sets:2,value:15,unit:'reps'},
    {name:'Push-ups',sets:2,value:10,unit:'reps'},
    {name:'Lunges',sets:1,value:10,unit:'reps each leg'},
    {name:'Plank',sets:1,value:45,unit:'sec'},
    {name:'Broad Jump',sets:1,value:5,unit:'attempts'},
    {name:'Single-Leg Reach',sets:1,value:10,unit:'reps'},
    {name:'Side Plank',sets:1,value:20,unit:'sec each side'},
    {name:'Tuck Jump',sets:2,value:8,unit:'reps'}
  ]}
];
function formatProgramTarget(t){
  if(!t) return '';
  return t.sets>1?`${t.sets} sets × ${t.value} ${t.unit}`:`${t.value} ${t.unit}`;
}
// Always re-syncs preset programs to the current presetDefs above, rather
// than seeding once and leaving them stale (state.presetsSeeded is kept
// only so personal-program defaults/reset logic elsewhere has it, not as
// a seed guard here) — so editing presetDefs updates every athlete's
// presets on next load, not just newly created athletes. Ids are
// deterministic (preset_0/1/2, stable array order) so this never disturbs
// activeProgramId or daily check-in history that reference a preset by id.
function seedPresetPrograms(){
  state.programs=(state.programs||[]).filter(p=>!p.preset);
  presetDefs.forEach((def,i)=>{
    const activityIds=[],targets={};
    def.activities.forEach(entry=>{
      const a=findActivity(entry.name);
      if(!a) return;
      activityIds.push(a.id);
      targets[a.id]={sets:entry.sets,value:entry.value,unit:entry.unit};
    });
    state.programs.push({id:'preset_'+i,name:def.name,activityIds,targets,preset:true});
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
// Gear Locker v2 (gear-locker-v2 branch): slotted cosmetic catalog matching
// design-reference/player-card-avatar-attributes.md and
// 0018_gear_locker_v2.sql exactly — item ids here MUST match that
// migration's seed rows 1:1, since gear_inventory/gear_purchases reference
// gear_items.id as a foreign key. Sold via the same availableBalance()
// pool as rewardMilestones but tracked separately (see totalGearXPSpent()).
// Every slot's free option is the sentinel id 'default', always
// owned/equippable regardless of slot. tintable:true slots get a color
// picker in the UI instead of (or alongside) their fixed art — see
// renderAvatarComposite() for how color is applied.
// 'skin' is a full head override: when equipped (!=='default'), the
// renderer hides the face/headwear/hair layers entirely instead of
// stacking with them (a mascot head replaces the face, it doesn't wear a
// cap over it) — see gearSlotHiddenBySkin below.
const gearSlotOrder=['base','jersey','headwear','hair','faceExtra','gear','accessory','border','background','skin','badge'];
const gearSlotLabels={base:'Body',jersey:'Jersey',headwear:'Headwear',hair:'Hair',faceExtra:'Face Extra',gear:'Gear',accessory:'Accessory',border:'Border',background:'Background',skin:'Skin',badge:'Badge'};
// Slots a non-default skin hides (replaces) rather than stacks with.
const gearSlotHiddenBySkin=['headwear','hair','faceExtra'];
const lockerItems=[
  // base
  {id:'beast-mode-base',name:'Beast Mode',slot:'base',xpCost:150,tier:'Uncommon'},
  {id:'giant-head-base',name:'Giant Head',slot:'base',xpCost:250,tier:'Rare'},
  // jersey
  {id:'jersey-standard-color',name:'Standard Jersey',slot:'jersey',xpCost:75,tier:'Common',tintable:true},
  {id:'pinstripe-kit',name:'Pinstripe Jersey',slot:'jersey',xpCost:75,tier:'Common'},
  {id:'jersey-cutoff',name:'Cut-Off Sleeves',slot:'jersey',xpCost:150,tier:'Uncommon'},
  {id:'jersey-hype',name:'Hype Jersey',slot:'jersey',xpCost:250,tier:'Rare'},
  // headwear
  {id:'headwear-batting-helmet',name:'Batting Helmet',slot:'headwear',xpCost:75,tier:'Common'},
  {id:'headwear-classic-cap',name:'Classic Cap',slot:'headwear',xpCost:75,tier:'Common',tintable:true},
  {id:'headwear-visor',name:'Visor',slot:'headwear',xpCost:150,tier:'Uncommon'},
  {id:'headwear-bandana',name:'Bandana',slot:'headwear',xpCost:150,tier:'Uncommon'},
  {id:'headwear-cheesehead',name:'Cheesehead Hat',slot:'headwear',xpCost:400,tier:'Legendary'},
  // hair
  {id:'hair-mullet',name:'Mullet',slot:'hair',xpCost:75,tier:'Common'},
  {id:'hair-giant-afro',name:'Giant Afro',slot:'hair',xpCost:150,tier:'Uncommon'},
  {id:'hair-mohawk',name:'Mohawk',slot:'hair',xpCost:150,tier:'Uncommon'},
  {id:'hair-rainbow-wig',name:'Rainbow Wig',slot:'hair',xpCost:250,tier:'Rare'},
  // faceExtra
  {id:'face-paint',name:'Face Paint',slot:'faceExtra',xpCost:75,tier:'Common',tintable:true},
  {id:'face-mustache',name:'Handlebar Mustache',slot:'faceExtra',xpCost:75,tier:'Common'},
  {id:'face-gold-grill',name:'Gold Grill',slot:'faceExtra',xpCost:250,tier:'Rare'},
  // gear
  {id:'gear-bat',name:'Bat',slot:'gear',xpCost:75,tier:'Common'},
  {id:'gear-glove',name:'Glove',slot:'gear',xpCost:75,tier:'Common'},
  {id:'eye-black',name:'Lightning Eye Black',slot:'gear',xpCost:75,tier:'Common'},
  {id:'gear-shades-wrap',name:'Wrap-Around Shades',slot:'gear',xpCost:75,tier:'Common'},
  {id:'grip-tape',name:'Grip Tape',slot:'gear',xpCost:150,tier:'Uncommon'},
  {id:'gear-shades-flip',name:'Flip-Up Shades',slot:'gear',xpCost:150,tier:'Uncommon'},
  {id:'gear-shades-silly',name:'Silly Shades',slot:'gear',xpCost:250,tier:'Rare'},
  {id:'gear-banana',name:'Banana',slot:'gear',xpCost:400,tier:'Legendary'},
  // accessory
  {id:'accessory-bling',name:'Bling Chain',slot:'accessory',xpCost:150,tier:'Uncommon'},
  {id:'accessory-cape',name:'Cape',slot:'accessory',xpCost:250,tier:'Rare'},
  // border
  {id:'border-rookie',name:'Rookie Border',slot:'border',xpCost:75,tier:'Common'},
  {id:'border-starter',name:'Starter Border',slot:'border',xpCost:150,tier:'Uncommon'},
  {id:'fire-frame',name:'All-Star Border',slot:'border',xpCost:250,tier:'Rare'},
  {id:'diamond-frame',name:'Legendary Holographic Border',slot:'border',xpCost:400,tier:'Legendary'},
  // background
  {id:'blueprint-bg',name:'Blueprint Card Background',slot:'background',xpCost:75,tier:'Common'},
  {id:'stadium-lights-bg',name:'Stadium Lights Background',slot:'background',xpCost:150,tier:'Uncommon'},
  {id:'bg-sunset',name:'Sunset Game Day',slot:'background',xpCost:150,tier:'Uncommon'},
  {id:'bg-outer-space',name:'Outer Space',slot:'background',xpCost:250,tier:'Rare'},
  {id:'bg-volcano',name:'Volcano / Lava Field',slot:'background',xpCost:400,tier:'Legendary'},
  // skin (full head override)
  {id:'skin-mascot',name:'Team Mascot',slot:'skin',xpCost:250,tier:'Rare'},
  {id:'skin-shark',name:'Shark',slot:'skin',xpCost:250,tier:'Rare'},
  {id:'skin-trex',name:'T. Rex',slot:'skin',xpCost:400,tier:'Legendary'},
  {id:'skin-banana-costume',name:'Banana Costume',slot:'skin',xpCost:400,tier:'Legendary'},
  // badge
  {id:'badge-first-pitch',name:'First Pitch',slot:'badge',xpCost:75,tier:'Common'},
  {id:'badge-diamond-grinder',name:'Diamond Grinder',slot:'badge',xpCost:150,tier:'Uncommon'},
  {id:'badge-streak-king',name:'Streak King/Queen',slot:'badge',xpCost:150,tier:'Uncommon'},
  {id:'badge-clutch-gene',name:'Clutch Gene',slot:'badge',xpCost:250,tier:'Rare'},
  {id:'badge-most-improved',name:'Most Improved',slot:'badge',xpCost:250,tier:'Rare'},
  {id:'captain-title',name:'Team Captain',slot:'badge',xpCost:250,tier:'Rare'},
  {id:'badge-the-show',name:'The Show',slot:'badge',xpCost:400,tier:'Legendary'}
];
function findGearItem(id){return lockerItems.find(i=>i.id===id)}
// Real illustrated art, keyed by gear item id — first entry replaces the
// placeholder colored box for that item (in both renderAvatarComposite's
// mini preview and the real Player Card avatar overlay below) without
// touching the schema, catalog, or equip logic. Add more items here as
// art gets produced; anything not listed still falls back to the
// placeholder box.
const gearItemArt={'face-mustache':'assets/gear/face-mustache.png'};
const defaultEquipped={base:'default',jersey:'default',headwear:'default',hair:'default',faceExtra:'default',gear:'default',accessory:'default',border:'default',background:'default',skin:'default',badge:'default'};
// Placeholder-art color palette per tier, used by the CSS-only compositing
// renderer (renderAvatarComposite) until real illustrated art exists —
// see 0018_gear_locker_v2.sql's header note. Swapping in real art later
// only touches the renderer, not this catalog or the schema.
const gearTierColor={Common:'#8a7f6a',Uncommon:'#1FA35C',Rare:'#1F7AE0',Legendary:'#F76C1E'};
// Back-to-front stacking order for the compositing renderer. 'skin' sits
// where the head goes and, when equipped, suppresses headwear/hair/
// faceExtra via gearSlotHiddenBySkin above rather than stacking under them.
const avatarLayerOrder=['background','border','base','jersey','skin','headwear','hair','faceExtra','gear','accessory','badge'];
// Placeholder-art compositing renderer — no real illustrated assets exist
// yet (see 0018_gear_locker_v2.sql's header note), so each equipped slot
// renders as a labeled, tier-colored (or custom-tinted) shape positioned
// roughly where that layer belongs on a card. This proves out the actual
// system under test — equip state, layering/z-order, color tinting, and
// the skin-overrides-face/headwear/hair rule — independent of art, which
// can replace this function's innerHTML later (an <img> per layer instead
// of a colored div) without touching the schema, catalog, or equip logic.
function renderAvatarComposite(containerEl){
  if(!containerEl) return;
  const equipped=state.equipped||defaultEquipped;
  const colors=state.slotColors||{};
  const skinActive=!!(equipped.skin&&equipped.skin!=='default');
  const layerHTML=slot=>{
    if(gearSlotHiddenBySkin.includes(slot)&&skinActive) return '';
    const itemId=equipped[slot];
    if(!itemId||itemId==='default') return '';
    const item=findGearItem(itemId);
    if(!item) return '';
    if(gearItemArt[itemId]) return `<img class="avatar-layer avatar-layer-${slot} avatar-layer-art" src="${gearItemArt[itemId]}" alt="${item.name}" title="${item.name}">`;
    const color=item.tintable&&colors[slot]?colors[slot]:(gearTierColor[item.tier]||'#8a7f6a');
    return `<div class="avatar-layer avatar-layer-${slot}" style="--layer-color:${color}" title="${item.name}"><span>${item.name}</span></div>`;
  };
  containerEl.innerHTML=`<div class="avatar-composite">${avatarLayerOrder.map(layerHTML).join('')}</div>`;
}

// Round 18 — dimensional prize wheel art (LUA-Prize-Wheel asset pack),
// same odds as before, not the pack's own proposed distribution. The
// pack's rotor artwork bakes each wedge's exact position in as vector
// paths, so it needs a fixed, precomputed segments table rather than
// the old runtime wheelSliceAngles() — wheelConfig.segments below IS
// that table, generated once (source/build_lua_current_odds.py, kept
// outside the repo) from the exact same weights the old
// wheelSliceWeight() used, then baked into both this config and the
// wheel-rotor.svg artwork so the art and the odds can never drift
// apart. Same 9 values/probabilities as the site always had:
// old wheelSegments=[5,10,10,15,20,20,25,25,50,50,100,250,1000] with
// wheelSliceWeight() (1/0.7/0.5/0.25 by tier) collapses to the exact
// per-value probabilities below once the duplicate slices are summed.
// Angle convention (matches wheel-plane's art): degrees clockwise from
// 12 o'clock, pointerDeg 0 — ported from the pack's own wheel-math.js,
// validated there against 216 targeted landings + 10,000 quantiles.
const wheelConfig={pointerDeg:0,segments:[
  {id:'xp-1000',value:1000,probability:0.02304147465437788,startDeg:-3.6,endDeg:4.69493088,centerDeg:0.54746544},
  {id:'xp-5',value:5,probability:0.09216589861751152,startDeg:4.69493088,endDeg:37.87465438,centerDeg:21.28479263},
  {id:'xp-100',value:100,probability:0.06451612903225806,startDeg:37.87465438,endDeg:61.10046083,centerDeg:49.4875576},
  {id:'xp-10',value:10,probability:0.18433179723502305,startDeg:61.10046083,endDeg:127.45990783,centerDeg:94.28018433},
  {id:'xp-250',value:250,probability:0.04608294930875576,startDeg:127.45990783,endDeg:144.04976959,centerDeg:135.75483871},
  {id:'xp-15',value:15,probability:0.09216589861751152,startDeg:144.04976959,endDeg:177.22949309,centerDeg:160.63963134},
  {id:'xp-20',value:20,probability:0.18433179723502305,startDeg:177.22949309,endDeg:243.58894009,centerDeg:210.40921659},
  {id:'xp-25',value:25,probability:0.18433179723502305,startDeg:243.58894009,endDeg:309.9483871,centerDeg:276.76866359},
  {id:'xp-50',value:50,probability:0.12903225806451613,startDeg:309.9483871,endDeg:356.4,centerDeg:333.17419355}
]};
const wheelMod=n=>((n%360)+360)%360;
function wheelSelectSegment(u){
  let sum=0;
  for(const s of wheelConfig.segments){ sum+=s.probability; if(u<sum) return s; }
  return wheelConfig.segments[wheelConfig.segments.length-1];
}
function wheelSegmentAtRotation(rotation){
  const angle=wheelMod(wheelConfig.pointerDeg-rotation);
  return wheelConfig.segments.find(s=>wheelMod(angle-s.startDeg)<(s.endDeg-s.startDeg));
}
function wheelTargetRotation(currentRotation,segmentId,turns){
  const s=wheelConfig.segments.find(s=>s.id===segmentId);
  const finalPhase=wheelMod(wheelConfig.pointerDeg-s.centerDeg);
  return currentRotation+turns*360+wheelMod(finalPhase-wheelMod(currentRotation));
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
// Arcade game XP is server-tracked now (award_arcade_xp,
// 0017_arcade_game_xp_server_side.sql) — this just sums today's already-
// awarded rows (state.arcadeGameLog, from xp_ledger source='arcade_game')
// for the "Today's Game XP" stat tile. Not used to decide how much a round
// SHOULD award — the RPC enforces the real 25/day cap server-side.
function todayArcadeGameXP(){return (state.arcadeGameLog||[]).filter(x=>x.date===todayISO()).reduce((sum,x)=>sum+(+x.xp||0),0)}
// Shared by every arcade mini-game — replaces the old local-only awardGameXP() with a
// server-enforced award via award_arcade_xp
// (0017_arcade_game_xp_server_side.sql). Returns the actual credited
// amount (may be less than requested once the 25/day cross-game cap is
// hit), or null if the call failed — callers should show an error rather
// than silently treating null as 0, same as the existing Prize Wheel spin
// error handling (app.js ~2660).
async function awardArcadeXp(gameId,xp){
  if(!activeAthlete) return null;
  try{
    const credited=await awardArcadeXpRemote(activeAthlete.id,gameId,xp);
    await refreshAthleteState();
    return credited;
  }catch(err){
    console.warn('Could not save arcade XP:',err&&err.message?err.message:err);
    return null;
  }
}
// ---- Arcade storage layer (Round 8) ----
// Sole read/write path for per-game arcade scores/metrics, so a future
// Supabase migration only has to change these functions' internals, not
// every call site in each game's logic.
function getArcadeBest(gameId){return (state.arcadeScores&&state.arcadeScores[gameId]&&state.arcadeScores[gameId].best)||0}
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
  // Purchasing unlocks the item into the closet — it does NOT equip it.
  // Ask right away, while the athlete is still looking at what they just
  // bought, instead of silently auto-equipping or leaving them to hunt for
  // the separate Equip section below to notice anything changed.
  if(confirm(`${item.name} unlocked! -${item.xpCost} XP.\n\nWear it on your Player Card now?`)){
    try{
      await equipGearItemRemote(activeAthlete.id,item.slot,itemId);
    }catch(err){
      alert('Unlocked, but could not equip it: '+(err.message||'unknown error'));
    }
  }
  await refreshAthleteState(); // re-fetches inventory + equipped state, calls render()
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
// Gear Locker v2: shop grouped by slot (buy) + equip controls grouped by
// slot (always free, always includes Default), plus a live compositing
// preview and a color picker on whichever slot's currently-equipped item
// is tintable. Replaces the old dead renderLocker(), which targeted a
// #lockerInventory element that never existed anywhere in index.html.
function renderGearLocker(){
  const inv=state.inventory||['default'];
  const equipped=state.equipped||defaultEquipped;
  const balance=availableBalance();
  renderAvatarComposite($('#gearAvatarPreview'));
  if($('#gearShop')){
    $('#gearShop').innerHTML=gearSlotOrder.map(slot=>{
      const items=lockerItems.filter(i=>i.slot===slot);
      if(!items.length) return '';
      return `<div class="gear-slot-group"><h4>${gearSlotLabels[slot]}</h4><div class="reward-grid">${items.map(item=>{
        const owned=inv.includes(item.id);
        const afford=balance>=item.xpCost;
        const art=gearItemArt[item.id];
        return `<div class="reward-tile ${owned?'unlocked':''}">
          <span class="reward-tier-badge tier-${item.tier.toLowerCase()}">${item.tier}</span>
          ${art?`<img class="gear-tile-art" src="${art}" alt="${item.name}">`:''}
          <h3>${item.name}${item.tintable?' 🎨':''}</h3>
          <p class="reward-price"><img src="assets/xp/lua-xp-coin.svg" alt="" width="22" height="22"><strong>${item.xpCost} XP</strong></p>
          ${owned?'<strong>Owned</strong>':`<button type="button" class="primary buy-gear-btn" data-item="${item.id}" ${afford?'':'disabled'}>${afford?'Buy':'Not enough XP'}</button>`}
        </div>`;
      }).join('')}</div></div>`;
    }).join('');
  }
  if($('#gearEquip')){
    const colors=state.slotColors||{};
    $('#gearEquip').innerHTML=gearSlotOrder.map(slot=>{
      const ownedInSlot=lockerItems.filter(i=>i.slot===slot&&inv.includes(i.id));
      const options=[{id:'default',name:'Default'},...ownedInSlot];
      const equippedItem=findGearItem(equipped[slot]);
      const colorPicker=equippedItem&&equippedItem.tintable
        ?`<input type="color" class="gear-color-input" data-slot="${slot}" value="${colors[slot]||'#1F7AE0'}" title="Color for ${equippedItem.name}">`:'';
      return `<div class="gear-equip-row"><span>${gearSlotLabels[slot]}</span><div class="gear-equip-options">${options.map(o=>`<button type="button" class="gear-equip-btn ${equipped[slot]===o.id?'active':''}" data-slot="${slot}" data-item="${o.id}">${o.name}</button>`).join('')}${colorPicker}</div></div>`;
    }).join('');
  }
}
// Phase C: sourced from currentTeamRoster (get_team_roster() RPC — name +
// aggregate XP/participation only, the narrowed coach-view data), cached by
// refreshTeamMembershipUI() and repainted here synchronously so this can
// stay in the render() chain without refetching on every render.
function escapeHTML(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderLeaderboard(){
  if(!$('#teamLeaderboard')) return;
  const metric=$('#leaderboardMetric')?.value||'xp';
  const rows=(currentTeamRoster||[]).filter(r=>r.status==='approved');
  const sorted=[...rows].sort((a,b)=>metric==='workouts'?(b.workout_count||0)-(a.workout_count||0):(b.total_xp||0)-(a.total_xp||0));
  const label=metric==='workouts'?'Workouts':'XP';
  $('#teamLeaderboard').innerHTML=`<table class="table"><thead><tr><th>#</th><th>Athlete</th><th>${label}</th></tr></thead><tbody>${sorted.map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHTML(r.display_name)}</td><td>${metric==='workouts'?(r.workout_count||0):(r.total_xp||0)}</td></tr>`).join('')}</tbody></table>`;
}
// Phase C: the old fake feed named specific "teammates" doing things that
// never happened — misleading now that real teammates exist. No activity
// feed table exists yet, so this is an honest placeholder, not a real
// migration, until a future round adds one.
function renderTeamFeed(){if(!$('#teamFeed'))return;$('#teamFeed').innerHTML='<p class="muted">Team activity feed is coming in a future update.</p>'}
// ---- Personal Programs ----
// A Program is {id, name, activityIds[], targets?:{activityId:{sets,value,unit}},
// preset?:true}. Preset programs ship locked/read-only (always re-synced by
// seedPresetPrograms) and can be used for logging but never edited or
// deleted. Personal programs go through an explicit draft/save workflow:
// state.draftProgram holds in-progress edits (new or existing) and is only
// committed to state.programs on Save; the Skill Lab Add button is only
// enabled while a draft is active. targets is optional per activity — an
// athlete/parent can leave a sets/reps target blank, same as presets can
// (formatProgramTarget/activitySetBlockHTML already treat a missing target
// as "no guidance shown", not an error).
function findProgram(id){return (state.programs||[]).find(p=>p.id===id)}
function personalPrograms(){return (state.programs||[]).filter(p=>!p.preset)}
function presetPrograms(){return (state.programs||[]).filter(p=>p.preset)}
function startNewProgramDraft(){
  state.draftProgram={id:null,name:'',activityIds:[],targets:{}};
  renderProgramBuilder();
  renderExerciseLibrary();
}
function startEditProgramDraft(id){
  const p=findProgram(id);
  if(!p||p.preset) return;
  state.draftProgram={id:p.id,name:p.name,activityIds:[...p.activityIds],targets:JSON.parse(JSON.stringify(p.targets||{}))};
  renderProgramBuilder();
  renderExerciseLibrary();
}
function discardProgramDraft(){
  state.draftProgram=null;
  renderProgramBuilder();
  renderExerciseLibrary();
}
// Drops any target with no value typed in (sets alone isn't a target) and
// clamps sets to a sane minimum — same "guidance only, never required"
// rule as preset targets.
function cleanDraftTargets(draft){
  const cleaned={};
  draft.activityIds.forEach(id=>{
    const t=draft.targets&&draft.targets[id];
    if(t&&t.value) cleaned[id]={sets:Math.max(1,Math.round(+t.sets||1)),value:+t.value,unit:t.unit||''};
  });
  return cleaned;
}
function saveProgramDraft(name){
  const draft=state.draftProgram;
  if(!draft) return;
  const finalName=(name||draft.name||'').trim();
  if(!finalName){alert('Give your program a name before saving.');return}
  if(!draft.activityIds.length){alert('Add at least one activity before saving.');return}
  state.programs=state.programs||[];
  const targets=cleanDraftTargets(draft);
  if(draft.id){
    const p=findProgram(draft.id);
    if(p){p.name=finalName;p.activityIds=draft.activityIds;p.targets=targets}
  }else{
    const p={id:'prog_'+Date.now()+'_'+Math.floor(Math.random()*1000),name:finalName,activityIds:draft.activityIds,targets};
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
  state.draftProgram.targets=state.draftProgram.targets||{};
  state.draftProgram.targets[a.id]={sets:1,value:null,unit:a.metric.unit||''};
  renderProgramBuilder();
  renderExerciseLibrary();
  if($('#activityDetailModal')) $('#activityDetailModal').classList.add('hidden');
}
function removeActivityFromDraft(activityId){
  if(!state.draftProgram) return;
  state.draftProgram.activityIds=state.draftProgram.activityIds.filter(id=>id!==activityId);
  if(state.draftProgram.targets) delete state.draftProgram.targets[activityId];
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
  const programTile=(p,editable)=>`<div class="program-tile${p.preset?' preset':''}">${p.preset?'<span class="lock-badge">🔒 Preset</span>':''}<h3>${p.name}</h3><ul>${p.activityIds.map(id=>{const a=findActivityById(id);if(!a)return'';const target=p.targets&&p.targets[id];return`<li>${a.name}${target?`<span class="program-target">${formatProgramTarget(target)}</span>`:''}</li>`}).join('')}</ul>${editable?`<div class="program-tile-actions"><button type="button" class="edit-program-btn" data-program="${p.id}">Edit</button><button type="button" class="delete-program-btn" data-program="${p.id}">Delete</button></div>`:''}</div>`;
  const presetHTML=presets.length?`<p class="eyebrow dark">Preset Programs</p><div class="program-list">${presets.map(p=>programTile(p,false)).join('')}</div>`:'';
  const personalHTML=`<p class="eyebrow dark">Your Programs</p>${personal.length?`<div class="program-list">${personal.map(p=>programTile(p,true)).join('')}</div>`:'<p class="muted">No programs yet — click "+ New Program" to build one.</p>'}`;
  const draftHTML=draft?`
    <div class="program-draft-editor">
      <p class="eyebrow dark">${draft.id?'Editing Program':'New Program'}</p>
      <label class="wide">Program name<input type="text" id="draftProgramName" value="${draft.name||''}" placeholder="e.g. Baseball Exercise Program"></label>
      <div id="draftActivityList" class="program-activity-list">${draft.activityIds.length?'<ul class="program-activity-items">'+draft.activityIds.map(id=>{
        const a=findActivityById(id); if(!a) return '';
        const t=(draft.targets&&draft.targets[id])||{};
        return `<li>
          <div class="draft-activity-row"><span>${a.name}</span><button type="button" class="remove-draft-activity" data-activity="${id}">Remove</button></div>
          <div class="draft-target-row">
            <label>Sets<input type="number" min="1" step="1" inputmode="numeric" class="draft-target-sets" data-activity="${id}" value="${t.sets||1}"></label>
            <label>Target<input type="number" min="0" step="1" inputmode="numeric" class="draft-target-value" data-activity="${id}" placeholder="optional" value="${t.value||''}"></label>
            <span class="draft-target-unit">${a.metric.unit||''}</span>
          </div>
        </li>`;
      }).join('')+'</ul>':'<p class="muted">No activities yet — use Add on any Skill Lab exercise below.</p>'}</div>
      <div class="program-draft-actions"><button type="button" id="saveProgramDraftBtn" class="primary">Save Program</button><button type="button" id="discardProgramDraftBtn">Discard</button></div>
    </div>`:'<button id="newProgramBtn" type="button">+ New Program</button>';
  body.innerHTML=presetHTML+personalHTML+draftHTML;
}
function renderExerciseLibrary(){
  if(!$('#libraryCategory'))return;
  if(!$('#libraryCategory').options.length)$('#libraryCategory').innerHTML=categoryOrder.map(c=>`<option>${c}</option>`).join('');
  const cat=$('#libraryCategory').value||categoryOrder[0];
  if($('#goalChips'))$('#goalChips').innerHTML=goalChipDefs.map(g=>`<button type="button" class="goal-chip${g.category===cat?' active':''}" data-category="${g.category}"><img src="${g.img}" alt="" width="64" height="64"><span>${g.label}</span></button>`).join('');
  const draft=state.draftProgram;
  const catIcon=categoryIconImg[cat]?`<img src="${categoryIconImg[cat]}" alt="" width="36" height="36">`:`<span>${categoryIcons[cat]||'⭐'}</span>`;
  $('#exerciseLibrary').innerHTML=activities.filter(a=>a.category===cat).map(a=>{
    const inDraft=!!(draft&&draft.activityIds.includes(a.id));
    const label=!draft?'Start a Program':(inDraft?'In Program':'Add');
    return `<div class="library-card${inDraft?' active':''}">${catIcon}<strong>${a.name}</strong><div class="library-card-actions"><button type="button" class="view-activity-btn" data-exercise="${a.name}">View</button><button type="button" class="add-exercise-btn" data-exercise="${a.name}" ${(!draft||inDraft)?'disabled':''}>${label}</button></div></div>`;
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
  const video=media.video&&media.video.plannedUrl
    ?`<div class="demo-video-frame"><video class="demo-video" src="${media.video.plannedUrl}" controls playsinline preload="metadata"></video><img class="demo-video-watermark" src="assets/brand-logo-transparent.png" alt="Level Up Athletics"></div>`
    :`<div class="video-placeholder"><span class="play-glyph">▶</span><p>Demo video coming soon</p></div>`;
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
function activitySetBlockHTML(prefix,a,counts,target){
  const n=counts[a.id]||1;
  const rows=Array.from({length:n},(_,i)=>setInputHTML(prefix,a.id,a.name,a.metric,i)).join('');
  const targetLine=target?`<p class="program-target-hint">Target: ${formatProgramTarget(target)}</p>`:'';
  return `<div class="activity-set-block" data-activity="${a.id}"><h4>${a.name}</h4>${targetLine}${rows}<button type="button" class="add-set-btn" data-prefix="${prefix}" data-activity="${a.id}">+ Add Set</button></div>`;
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
    return a?activitySetBlockHTML('set',a,dailySetCounts,prog.targets&&prog.targets[id]):'';
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
  // Draft program sets/target inputs — update state.draftProgram.targets
  // in place with no re-render, so the field keeps focus while typing.
  // cleanDraftTargets() (in saveProgramDraft) drops anything with no
  // value typed in, so a blank Target field is just "no target set".
  if(e.target.classList.contains('draft-target-sets')||e.target.classList.contains('draft-target-value')){
    const draft=state.draftProgram; if(!draft) return;
    const id=e.target.dataset.activity;
    draft.targets=draft.targets||{};
    const a=findActivityById(id);
    draft.targets[id]=draft.targets[id]||{sets:1,value:null,unit:a?a.metric.unit:''};
    if(e.target.classList.contains('draft-target-sets')) draft.targets[id].sets=Math.max(1,Math.round(+e.target.value||1));
    else draft.targets[id].value=e.target.value?+e.target.value:null;
  }
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
  const gameTile=e.target.closest('.game-tile');
  if(gameTile) openGameModal(gameTile.dataset.game);
  if(e.target.id==='closeGameModal' || e.target.id==='gameModal') closeGameModal();
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
// Clubhouse locker room: roster comes from get_clubhouse_roster() (approved members only).
// status: idle | loading | ready | error. Fallback = migration 0032 not applied yet.
let currentClubhouseRoster=[], clubhouseStatus='idle', clubhouseError='', clubhouseUsingFallback=false;
// Shared recognitions (0033). status: idle | ready | error | unavailable (migration not applied).
let currentRecognitions=[], currentSpotlight=null, recognitionsStatus='idle', recognitionsError='';
// Team Streak & Team Challenge — see 0022_team_streak_and_challenges.sql.
// currentTeamActiveDates is bare dates only (no athlete identity), fed
// into teamStreak() below the same way personal streak() walks
// state.daily. CHALLENGE_CATEGORIES maps the coach-facing broad category
// checkboxes to the real xp_ledger.source values that count toward a
// challenge's target — 'mission' (Daily Mission XP) is folded into
// Workouts since it's physical training, same spirit as a check-in.
let currentTeamActiveDates=[], currentTeamStreak=0, currentTeamChallenge=null;
const CHALLENGE_CATEGORIES={
  'Workouts':['daily_check_in','team_program_bonus','mission'],
  'Arcade':['arcade_game','spin'],
  'Quests & Battles':['quest','bonus'],
  'Combine Testing':['combine_verified']
};
// Mirrors personal streak() exactly (app.js, walks state.daily backward
// day-by-day) — only the input source differs: a team-wide Set<date> from
// get_team_active_dates() instead of one athlete's own check-in dates.
function teamStreak(dates){
  const set=new Set(dates||[]);
  if(!set.size) return 0;
  let s=0,d=new Date();
  for(let i=0;i<365;i++){
    const iso=d.toISOString().slice(0,10);
    if(set.has(iso)){s++;d.setDate(d.getDate()-1)}
    else if(i===0)d.setDate(d.getDate()-1);
    else break;
  }
  return s;
}
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
  const clubRoot=$('.lua-team-clubhouse');
  if(clubRoot) clubRoot.dataset.state=approved?'approved':'preview';
  ['#teamProgramSummaryCard','#clubhouseLower','#clubhouseManage'].forEach(sel=>{const el=$(sel); if(el) el.classList.toggle('hidden',!approved)});
  renderClubhouse();
  renderRecognitions();
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
  if($('#teamStatStreak')) $('#teamStatStreak').textContent=currentTeamStreak||0;
}
// ---- Team Clubhouse locker room ----
// Layers: decorative room shell (CSS background) > locker bay art (CSS
// background, one per member) > real HTML nameplate/avatar/stats > one
// transparent button for the whole locker. Every name and number is text, so
// if the artwork never loads the lockers still read as a plain roster.
const fmtNum=n=>Number(n||0).toLocaleString();
const workoutsLabel=n=>`${fmtNum(n)} ${Number(n)===1?'workout':'workouts'}`;
function clubhouseMemberLabel(m,isYou){
  return `${m.display_name||'Teammate'}${isYou?' (you)':''}: ${fmtNum(m.total_xp)} XP, ${workoutsLabel(m.workout_count)}`;
}
function clubhouseAvatarHTML(m,cls){
  const name=m.display_name||'Teammate';
  const mono=`<span class="clubhouse-monogram ${cls}" aria-hidden="true">${escapeHTML(name.trim().charAt(0).toUpperCase()||'?')}</span>`;
  if(!m.avatar_url) return mono;
  // On load failure, swap the broken image for the monogram.
  return `<img class="clubhouse-avatar ${cls}" src="${escapeHTML(m.avatar_url)}" alt="${escapeHTML(name)}'s avatar" width="256" height="256" loading="lazy" data-fallback="${escapeHTML(name.trim().charAt(0).toUpperCase()||'?')}">`;
}
function renderClubhouse(){
  const room=$('#clubhouseRoom'), roster=$('#clubhouseRoster'), note=$('#clubhouseRoomNote');
  if(!room||!roster||!note) return;
  const m=athleteTeamMembership;
  const approved=!!(m&&m.status==='approved');
  const viewAll=$('#clubhouseViewAll'), foot=$('#clubhouseRoomFoot');
  const setNote=(html)=>{note.innerHTML=html; note.classList.toggle('hidden',!html)};
  room.setAttribute('aria-busy',clubhouseStatus==='loading'?'true':'false');
  roster.innerHTML=''; roster.classList.add('hidden');
  if(viewAll) viewAll.classList.add('hidden');
  if(foot) foot.classList.add('hidden');
  room.classList.toggle('is-preview',!approved);
  if(clubhouseStatus==='loading'){setNote('Loading your teammates…');return}
  if(!activeAthlete){setNote('<strong>Preview</strong> — sign in and choose an athlete to see your team’s locker room.');return}
  if(!approved){
    setNote(m&&m.status==='pending'
      ?'<strong>Preview</strong> — your join request is waiting for coach approval. Teammates’ lockers appear here once you’re approved.'
      :'<strong>Preview</strong> — join a team with your coach’s code to see your teammates’ lockers here.');
    return;
  }
  if(clubhouseStatus==='error'){
    setNote(`Couldn’t load your teammates (${escapeHTML(clubhouseError)}). <button type="button" class="clubhouse-link" id="clubhouseRetry">Try again</button>`);
    return;
  }
  const members=currentClubhouseRoster||[];
  if(!members.length){setNote('No teammates to show yet.');return}
  setNote('');
  roster.classList.remove('hidden');
  roster.innerHTML=members.map(mem=>{
    const isYou=activeAthlete&&mem.athlete_id===activeAthlete.id;
    const name=mem.display_name||'Teammate';
    return `<div class="clubhouse-locker" role="listitem">
      <div class="clubhouse-locker-art" aria-hidden="true"></div>
      <span class="clubhouse-nameplate" aria-hidden="true">${escapeHTML(name)}</span>
      <div class="clubhouse-player" aria-hidden="true">
        ${clubhouseAvatarHTML(mem,'')}
        <strong class="clubhouse-xp">${fmtNum(mem.total_xp)}</strong><span class="clubhouse-xp-label">XP</span>
        <span class="clubhouse-workouts">${workoutsLabel(mem.workout_count)}</span>
      </div>
      ${isYou?'<span class="clubhouse-you" aria-hidden="true">YOU</span>':''}
      <button type="button" class="clubhouse-locker-action" data-athlete="${escapeHTML(mem.athlete_id)}" aria-label="Open locker. ${escapeHTML(clubhouseMemberLabel(mem,isYou))}"></button>
    </div>`;
  }).join('');
  if(viewAll) viewAll.classList.toggle('hidden',members.length<3);
  if(foot){
    foot.classList.toggle('hidden',!clubhouseUsingFallback);
    foot.textContent=clubhouseUsingFallback?'Teammate avatars will appear after the clubhouse update finishes setting up.':'';
  }
}
function openClubhouseDialog(html,returnFocusTo){
  const dlg=$('#clubhouseDialog'); if(!dlg) return;
  $('#clubhouseDialogBody').innerHTML=html;
  if(typeof dlg.showModal==='function'){ if(!dlg.open) dlg.showModal() } else dlg.setAttribute('open','');
  const title=$('#clubhouseDialogTitle'); if(title) title.setAttribute('tabindex','-1');
  dlg._returnFocus=returnFocusTo||null;
  $('#clubhouseDialogClose').focus();
}
function closeClubhouseDialog(){
  const dlg=$('#clubhouseDialog'); if(!dlg) return;
  if(typeof dlg.close==='function'){ if(dlg.open) dlg.close() } else dlg.removeAttribute('open');
  if(dlg._returnFocus&&document.contains(dlg._returnFocus)) dlg._returnFocus.focus();
}
function kudosBoxHTML(mem){
  if(recognitionsStatus!=='ready') return '<p class="muted">Player cards are private to each athlete’s family.</p>';
  return `<div class="kudos-box"><p class="kudos-title">Give ${escapeHTML(mem.display_name||'your teammate')} kudos</p>
    <div class="kudos-buttons">${KUDOS_LABELS.map(k=>`<button type="button" class="kudos-btn" data-recipient="${escapeHTML(mem.athlete_id)}" data-kudos="${escapeHTML(k)}">${escapeHTML(k)}</button>`).join('')}</div>
    <p class="muted kudos-note" id="kudosStatus" role="status">Up to 3 a day, one per teammate.</p></div>`;
}
function showClubhouseMember(athleteId,trigger){
  const mem=(currentClubhouseRoster||[]).find(x=>x.athlete_id===athleteId); if(!mem) return;
  const isYou=activeAthlete&&mem.athlete_id===activeAthlete.id;
  openClubhouseDialog(`
    <div class="clubhouse-member">
      <div class="clubhouse-member-photo">${clubhouseAvatarHTML(mem,'large')}</div>
      <div>
        <h2 id="clubhouseDialogTitle">${escapeHTML(mem.display_name||'Teammate')}${isYou?' <span class="clubhouse-you-tag">YOU</span>':''}</h2>
        <dl class="clubhouse-member-stats"><div><dt>Career XP</dt><dd>${fmtNum(mem.total_xp)}</dd></div><div><dt>Workouts logged</dt><dd>${fmtNum(mem.workout_count)}</dd></div></dl>
        ${isYou?'<button type="button" class="primary" id="clubhouseOpenMyCard">Open my Player Card</button>':kudosBoxHTML(mem)}
      </div>
    </div>`,trigger);
}
function showClubhouseRoster(trigger){
  const rows=(currentClubhouseRoster||[]).map(mem=>{
    const isYou=activeAthlete&&mem.athlete_id===activeAthlete.id;
    return `<li>${escapeHTML(mem.display_name||'Teammate')}${isYou?' <span class="clubhouse-you-tag">YOU</span>':''}<span class="muted">${fmtNum(mem.total_xp)} XP · ${workoutsLabel(mem.workout_count)}</span></li>`;
  }).join('');
  openClubhouseDialog(`<h2 id="clubhouseDialogTitle">Teammates</h2><ul class="clubhouse-roster-list">${rows}</ul>`,trigger);
}
document.addEventListener('click',e=>{
  const lock=e.target.closest('.clubhouse-locker-action');
  if(lock){showClubhouseMember(lock.dataset.athlete,lock);return}
  if(e.target.closest('#clubhouseViewAll')){showClubhouseRoster(e.target.closest('#clubhouseViewAll'));return}
  if(e.target.closest('#clubhouseRetry')){refreshTeamMembershipUI();return}
  if(e.target.closest('#clubhouseDialogClose')){closeClubhouseDialog();return}
  if(e.target.closest('#clubhouseOpenMyCard')){closeClubhouseDialog();switchScreen('player');return}
  const dlg=$('#clubhouseDialog');
  if(dlg&&e.target===dlg) closeClubhouseDialog(); // click on the backdrop
});
// Native <dialog> handles Escape and focus trapping; restore focus to the
// locker that opened it however the dialog was closed.
if($('#clubhouseDialog')) $('#clubhouseDialog').addEventListener('close',()=>{const d=$('#clubhouseDialog'); if(d._returnFocus&&document.contains(d._returnFocus)) d._returnFocus.focus()});
// A failed avatar swaps to the monogram so the locker never shows a broken image.
document.addEventListener('error',e=>{
  const img=e.target;
  if(img&&img.classList&&img.classList.contains('clubhouse-avatar')){
    const span=document.createElement('span');
    span.className='clubhouse-monogram '+(img.classList.contains('large')?'large':'');
    span.setAttribute('aria-hidden','true'); span.textContent=img.dataset.fallback||'?';
    img.replaceWith(span);
  }
},true);
// ---- Recognitions: shared shout-outs (migration 0033) ----
// Coach awards (PIN, 5 presets) and peer kudos (4 presets, capped server-side)
// share one feed; preset reactions sit on each item. Cosmetic only — no XP.
// Everything here renders server-checked data; the server decides who may
// read, give, react or remove.
const RECOG_REACTIONS=[{key:'clap',emoji:'👏',label:'Nice Work'},{key:'fire',emoji:'🔥',label:'Awesome'},{key:'raised',emoji:'🙌',label:'Great Job'},{key:'muscle',emoji:'💪',label:'Beast'},{key:'star',emoji:'⭐',label:'Let’s Go'}];
const COACH_AWARDS=['Great Hustle','Best Teammate','Practice Leader','Sportsmanship','Never Quit'];
const KUDOS_LABELS=['Nice Work','Awesome','Good Teammate','Keep Going'];
const recogDate=iso=>{try{return new Date(iso).toLocaleDateString(undefined,{month:'short',day:'numeric'})}catch(e){return ''}};
function recogItemHTML(r){
  const isAward=r.kind==='award';
  const counts=r.reaction_counts||{}, mine=r.my_reactions||[];
  const btn=(x,withCount)=>{
    const n=counts[x.key]||0, on=mine.includes(x.key);
    return `<button type="button" class="recog-react${on?' on':''}" data-rec="${escapeHTML(r.id)}" data-reaction="${x.key}" aria-pressed="${on}" aria-label="${x.label}${withCount&&n?`, ${n}`:''}">${x.emoji}${withCount&&n?` <span>${n}</span>`:''}</button>`;
  };
  // Only reactions someone has actually picked show as chips; the full set
  // lives behind the small + button (hover on desktop, tap on touch).
  const chips=RECOG_REACTIONS.filter(x=>(counts[x.key]||0)>0).map(x=>btn(x,true)).join('');
  const picker=RECOG_REACTIONS.map(x=>btn(x,false)).join('');
  return `<div class="recog-item${isAward?' is-award':''}">
    <span class="recog-icon" aria-hidden="true">${isAward?'🏅':'👏'}</span>
    <div class="recog-main">
      <p class="recog-line"><strong>${escapeHTML(r.recipient_name)}</strong> — ${escapeHTML(r.label)}</p>
      <small class="muted">${isAward?'Award from Coach':'Kudos from '+escapeHTML(r.giver_name)} · ${escapeHTML(recogDate(r.created_at))}</small>
      <div class="recog-reactions" role="group" aria-label="Reactions">${chips}<span class="recog-add"><button type="button" class="recog-add-btn" aria-label="Add a reaction" aria-haspopup="true" aria-expanded="false">+</button><span class="recog-picker" role="group" aria-label="Choose a reaction">${picker}</span></span></div>
    </div>
  </div>`;
}
function renderRecognitions(){
  const feed=$('#recognitionFeed'), spot=$('#clubhouseSpotlight');
  if(!feed||!spot) return;
  const approved=!!(athleteTeamMembership&&athleteTeamMembership.status==='approved');
  const empty='<p class="muted">When a coach recognizes a teammate, the award is highlighted here for the week. No awards have been shared yet.</p>';
  if(!approved){feed.innerHTML='';spot.innerHTML='';return}
  if(recognitionsStatus==='unavailable'){
    const m='<p class="muted">Shared shout-outs are almost ready — check back soon.</p>';
    feed.innerHTML=m; spot.innerHTML=m; return;
  }
  if(recognitionsStatus==='error'){
    feed.innerHTML=`<p class="muted">Couldn’t load shout-outs (${escapeHTML(recognitionsError)}).</p>`; spot.innerHTML=''; return;
  }
  if(recognitionsStatus!=='ready'){feed.innerHTML='<p class="muted">Loading…</p>'; spot.innerHTML=''; return}
  feed.innerHTML=currentRecognitions.length
    ?currentRecognitions.slice(0,8).map(recogItemHTML).join('')
    :'<p class="muted">No shout-outs yet. When your coach recognizes someone or a teammate gives kudos, it shows up here.</p>';
  const sp=currentSpotlight;
  spot.innerHTML=sp?`<div class="spotlight-body">
      <div class="spotlight-photo">${clubhouseAvatarHTML({display_name:sp.recipient_name,avatar_url:sp.recipient_avatar_url},'large')}</div>
      <div><p class="spotlight-name">${escapeHTML(sp.recipient_name)}</p><p class="spotlight-award">🏅 ${escapeHTML(sp.label)}</p><small class="muted">Award from Coach · ${escapeHTML(recogDate(sp.created_at))}</small></div>
    </div>`:empty;
}
// Re-reads just the feed + spotlight (after a reaction or new kudos) so the
// rest of the page isn't repainted.
async function refreshRecognitions(){
  const m=athleteTeamMembership;
  if(!activeAthlete||!m||m.status!=='approved'||!m.teams) return;
  try{
    const [rows,sp]=await Promise.all([loadTeamRecognitions(m.teams.id,activeAthlete.id,20),loadTeamSpotlight(m.teams.id)]);
    if(rows===null||sp===null){recognitionsStatus='unavailable'}
    else{recognitionsStatus='ready'; recognitionsError=''; currentRecognitions=rows; currentSpotlight=sp||null}
  }catch(err){recognitionsStatus='error'; recognitionsError=err&&err.message?err.message:String(err)}
  renderRecognitions();
}
async function reactToRecognition(btn){
  if(!activeAthlete||btn.disabled) return;
  btn.disabled=true;
  try{ await reactToRecognitionRemote(activeAthlete.id,btn.dataset.rec,btn.dataset.reaction) }
  catch(err){ alert('Could not react: '+(err.message||'unknown error')) }
  await refreshRecognitions();
}
async function giveKudos(btn){
  const status=$('#kudosStatus');
  const m=athleteTeamMembership;
  if(!activeAthlete||!m||!m.teams||btn.disabled) return;
  const buttons=$$('.kudos-btn'); buttons.forEach(b=>b.disabled=true);
  try{
    await giveKudosRemote(m.teams.id,activeAthlete.id,btn.dataset.recipient,btn.dataset.kudos);
    if(status) status.textContent='Kudos sent! 🎉';
    await refreshRecognitions();
  }catch(err){
    if(status) status.textContent=(err&&err.message)||'Could not send kudos.';
    buttons.forEach(b=>b.disabled=false);
  }
}
// ---- Coach side (Coach HQ): give an award, review and remove ----
function openAwardDialog(athleteId,name,trigger){
  openClubhouseDialog(`<h2 id="clubhouseDialogTitle">Shout-out for ${escapeHTML(name)}</h2>
    <p class="muted">Pick an award. It shows to the whole team in Around the Clubhouse. You’ll be asked for your approval PIN. No XP is awarded.</p>
    <div class="award-buttons">${COACH_AWARDS.map(a=>`<button type="button" class="award-btn" data-athlete="${escapeHTML(athleteId)}" data-name="${escapeHTML(name)}" data-award="${escapeHTML(a)}">🏅 ${escapeHTML(a)}</button>`).join('')}</div>`,trigger);
}
async function giveAward(athleteId,name,award){
  const status=$('#coachRecognitionStatus');
  if(!coachTeam) return;
  closeClubhouseDialog();
  const pin=await showPinModal(`give “${award}” to ${name}`);
  if(!pin) return;
  try{
    await giveTeamAwardRemote(coachTeam.id,athleteId,award,pin);
    if(status) status.textContent=`“${award}” sent to ${name}.`;
  }catch(err){
    if(status) status.textContent='Could not give shout-out: '+((err&&err.message)||'unknown error');
  }
  await renderCoachRecognitions();
}
async function renderCoachRecognitions(){
  const list=$('#coachRecognitionList');
  if(!list||!coachTeam) return;
  try{
    const rows=await loadTeamRecognitions(coachTeam.id,null,15);
    if(rows===null){list.innerHTML='<p class="muted">Shout-outs aren’t available yet — the database update hasn’t been applied.</p>';return}
    list.innerHTML=rows.length?rows.map(r=>`<div class="pending-request-row"><span><strong>${escapeHTML(r.recipient_name)}</strong> — ${escapeHTML(r.label)}<br><small class="muted">${r.kind==='award'?'Award from Coach':'Kudos from '+escapeHTML(r.giver_name)} · ${escapeHTML(recogDate(r.created_at))}</small></span><button class="danger" type="button" data-remove-rec="${escapeHTML(r.id)}">Remove</button></div>`).join(''):'<p class="muted">No shout-outs yet.</p>';
  }catch(err){
    list.innerHTML=`<p class="muted">Couldn’t load shout-outs (${escapeHTML(err.message||'unknown error')}).</p>`;
  }
}
async function removeRecognition(id){
  const status=$('#coachRecognitionStatus');
  if(!confirm('Remove this shout-out for the whole team?')) return;
  const pin=await showPinModal('remove a team shout-out');
  if(!pin) return;
  try{ await removeTeamRecognitionRemote(id,pin); if(status) status.textContent='Removed.' }
  catch(err){ if(status) status.textContent='Could not remove: '+((err&&err.message)||'unknown error') }
  await renderCoachRecognitions();
}
function closeRecogPickers(except){
  $$('.recog-add.open').forEach(el=>{ if(el!==except){ el.classList.remove('open'); const b=el.querySelector('.recog-add-btn'); if(b) b.setAttribute('aria-expanded','false') } });
}
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ const open=document.querySelector('.recog-add.open'); if(open){ const b=open.querySelector('.recog-add-btn'); closeRecogPickers(); if(b) b.focus() } } });
// Keyboard users: leaving the picker (Tab away) closes it.
document.addEventListener('focusout',e=>{ const add=e.target.closest&&e.target.closest('.recog-add'); if(add&&!add.contains(e.relatedTarget)) closeRecogPickers() });
document.addEventListener('click',e=>{
  const addBtn=e.target.closest('.recog-add-btn');
  if(addBtn){ const wrap=addBtn.closest('.recog-add'); const open=!wrap.classList.contains('open'); closeRecogPickers(open?wrap:null); wrap.classList.toggle('open',open); addBtn.setAttribute('aria-expanded',String(open)); return }
  if(!e.target.closest('.recog-add')) closeRecogPickers();
  const react=e.target.closest('.recog-react'); if(react){reactToRecognition(react);return}
  const kudos=e.target.closest('.kudos-btn'); if(kudos){giveKudos(kudos);return}
  const award=e.target.closest('[data-award-athlete]'); if(award){openAwardDialog(award.dataset.awardAthlete,award.dataset.name,award);return}
  const pick=e.target.closest('.award-btn'); if(pick){giveAward(pick.dataset.athlete,pick.dataset.name,pick.dataset.award);return}
  const rm=e.target.closest('[data-remove-rec]'); if(rm){removeRecognition(rm.dataset.removeRec);return}
});
// Active Team Challenge card — separate from renderTeamIdentity() so a
// challenge-only repaint (e.g. after the coach saves a new one) doesn't
// have to re-run the whole team-identity paint. Hidden entirely if the
// athlete isn't on an approved team, or the team currently has no
// occupying challenge row (shouldn't normally happen since
// get_or_create_active_team_challenge always creates a system one, but
// defensive against a failed/timed-out fetch leaving currentTeamChallenge
// null).
function renderTeamChallenge(){
  const card=$('#teamChallengeCard');
  if(!card) return;
  const approved=!!(athleteTeamMembership&&athleteTeamMembership.status==='approved');
  card.classList.toggle('hidden',!approved||!currentTeamChallenge);
  const futureNote=$('#squadMissionFuture');
  if(futureNote) futureNote.classList.toggle('hidden',!approved||!!currentTeamChallenge);
  if(!approved||!currentTeamChallenge) return;
  const c=currentTeamChallenge;
  if($('#teamChallengeKind')) $('#teamChallengeKind').textContent=c.kind==='coach'?'Coach Challenge':'Team Challenge';
  if($('#teamChallengeTitle')) $('#teamChallengeTitle').textContent=c.title;
  const pct=Math.max(0,Math.min(100,Math.round((c.progress_xp/c.target_xp)*100)));
  if($('#teamChallengeMeterFill')) $('#teamChallengeMeterFill').style.width=pct+'%';
  if($('#teamChallengeMeterText')) $('#teamChallengeMeterText').textContent=
    c.status==='completed'
      ?`Complete! ${c.progress_xp} / ${c.target_xp} XP.`
      :`${c.progress_xp} / ${c.target_xp} XP · ends ${new Date(c.ends_at).toLocaleDateString()}`;
  const gearName=c.reward_type==='gear'?(findGearItem(c.reward_gear_item_id)?.name||c.reward_gear_item_id):null;
  if($('#teamChallengeReward')) $('#teamChallengeReward').textContent=
    c.reward_type==='gear'
      ?`Reward: ${gearName} — auto-granted to the whole roster on completion!`
      :`Reward: ${c.reward_description}`;
  card.classList.toggle('challenge-complete',c.status==='completed');
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
  clubhouseStatus='loading'; clubhouseError=''; renderClubhouse();
  try{
    athleteTeamMembership=await withTimeout(getAthleteTeamMembership(activeAthlete.id),10000,'Loading team membership');
    const approved=athleteTeamMembership&&athleteTeamMembership.status==='approved';
    if(approved){
      const teamId=athleteTeamMembership.teams.id;
      // The locker-room roster is allowed to fail on its own (shown in the
      // room) without taking the rest of the team stats down with it.
      const [totals,ranked,roster,activeDates,challenge,clubhouse,recs,spot]=await withTimeout(Promise.all([
        loadTeamXpTotals(teamId), loadAllTeamXpTotalsRanked(), loadTeamRoster(teamId),
        loadTeamActiveDates(teamId), loadTeamChallenge(teamId),
        loadClubhouseRoster(teamId).then(r=>({rows:r}),e=>({error:e})),
        loadTeamRecognitions(teamId,activeAthlete.id,20).then(r=>({rows:r}),e=>({error:e})),
        loadTeamSpotlight(teamId).then(r=>({row:r}),e=>({error:e}))
      ]),10000,'Loading team stats');
      if(recs.error||spot.error){recognitionsStatus='error'; recognitionsError=(recs.error||spot.error).message||'unknown error'; currentRecognitions=[]; currentSpotlight=null}
      else if(recs.rows===null||spot.row===null){recognitionsStatus='unavailable'; currentRecognitions=[]; currentSpotlight=null}
      else{recognitionsStatus='ready'; recognitionsError=''; currentRecognitions=recs.rows; currentSpotlight=spot.row||null}
      if(clubhouse.error){clubhouseStatus='error'; clubhouseError=clubhouse.error.message||String(clubhouse.error); currentClubhouseRoster=[]; clubhouseUsingFallback=false}
      else if(clubhouse.rows===null){
        // 0032 not applied yet: same approved-only rows the page already had, without avatars.
        clubhouseUsingFallback=true; clubhouseStatus='ready';
        currentClubhouseRoster=(roster||[]).filter(r=>r.status==='approved').map(r=>({athlete_id:r.athlete_id,display_name:r.display_name,avatar_url:null,total_xp:r.total_xp,workout_count:r.workout_count}));
      }else{clubhouseUsingFallback=false; clubhouseStatus='ready'; currentClubhouseRoster=clubhouse.rows}
      currentTeamXpTotals=totals;
      currentTeamRoster=roster;
      const rankIndex=ranked.findIndex(t=>t.team_id===teamId);
      currentTeamRank=rankIndex>=0?rankIndex+1:null;
      currentTeamRankTotal=ranked.length;
      currentTeamActiveDates=activeDates;
      currentTeamStreak=teamStreak(activeDates);
      currentTeamChallenge=challenge;
    }else{
      currentTeamXpTotals=null; currentTeamRoster=[]; currentTeamRank=null; currentTeamRankTotal=null;
      currentTeamActiveDates=[]; currentTeamStreak=0; currentTeamChallenge=null;
      currentClubhouseRoster=[]; clubhouseStatus='ready'; clubhouseUsingFallback=false;
      currentRecognitions=[]; currentSpotlight=null; recognitionsStatus='idle'; recognitionsError='';
    }
  }catch(err){
    currentTeamXpTotals=null; currentTeamRoster=[]; currentTeamRank=null; currentTeamRankTotal=null;
    currentTeamActiveDates=[]; currentTeamStreak=0; currentTeamChallenge=null;
    currentClubhouseRoster=[]; clubhouseStatus='error'; clubhouseError=err&&err.message?err.message:String(err); clubhouseUsingFallback=false;
    currentRecognitions=[]; currentSpotlight=null; recognitionsStatus='error'; recognitionsError=clubhouseError;
    if(statusEl) statusEl.textContent='Could not load team stats: '+(err&&err.message?err.message:String(err));
  }
  renderTeamIdentity();
  renderLeaderboard();
  renderTeamChallenge();
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
      switcher.innerHTML=coachTeams.map(t=>`<option value="${escapeHTML(t.id)}">${escapeHTML(t.name)}</option>`).join('');
      switcher.value=coachTeam.id;
    }
    // Say which team the roster and shout-out cards are showing.
    ['#teamRosterTeamName','#coachRecognitionsTeamName'].forEach(sel=>{const el=$(sel); if(el) el.textContent='— '+coachTeam.name});
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
  list.innerHTML=rows.length?rows.map(r=>`<div class="pending-request-row"><span>${escapeHTML(r.display_name)}</span><span class="roster-actions"><button class="primary" data-award-athlete="${escapeHTML(r.athlete_id)}" data-name="${escapeHTML(r.display_name)}" type="button">Shout-out</button><button class="danger" data-remove="${escapeHTML(r.athlete_id)}" data-name="${escapeHTML(r.display_name)}" type="button">Remove</button></span></div>`).join(''):`<p class="muted">No approved athletes on ${escapeHTML(coachTeam.name)} yet.${coachTeams.length>1?' Use “Managing team” above to switch teams.':''}</p>`;
  renderCoachRecognitions();
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
  if(!coachTeam||!coachTeams.some(t=>t.id===coachTeam.id)){
    let saved=null; try{saved=localStorage.getItem('lua.coachTeamId')}catch(e){}
    coachTeam=coachTeams.find(t=>t.id===saved)||coachTeams[0]||null;
  }
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
  try{localStorage.setItem('lua.coachTeamId',teamId)}catch(e){}
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
  if($('#coachRecognitionsCard')) $('#coachRecognitionsCard').classList.toggle('hidden',!isCoach||!coachTeam);
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
// Team Challenge — Coach Tools ("Set a Team Challenge"). Populates the
// gear-reward <select> once from the existing static lockerItems catalog
// (same source findGearItem already reads — no new catalog introduced)
// and toggles the gear-vs-custom-prize fields based on the reward-type
// radio.
function renderTeamChallengeRewardGearOptions(){
  const sel=$('#teamChallengeRewardGearSelect');
  if(!sel || sel.options.length) return;
  sel.innerHTML=lockerItems.map(i=>`<option value="${i.id}">${i.name} (${i.tier})</option>`).join('');
}
function toggleTeamChallengeRewardFields(){
  const gearChecked=$('input[name=teamChallengeRewardType][value=gear]').checked;
  if($('#teamChallengeRewardGearWrap')) $('#teamChallengeRewardGearWrap').classList.toggle('hidden',!gearChecked);
  if($('#teamChallengeRewardTextWrap')) $('#teamChallengeRewardTextWrap').classList.toggle('hidden',gearChecked);
}
// Sets (replaces) the team's active challenge — same PIN-modal-then-
// verify-then-RPC shape as saveTeamProgram() above.
async function saveTeamChallenge(){
  if(!coachTeam){alert('Set up your team first.');return}
  const title=$('#teamChallengeTitleInput').value.trim();
  if(!title){alert('Enter a challenge title.');return}
  const targetXp=parseInt($('#teamChallengeTargetInput').value,10);
  if(!targetXp||targetXp<=0){alert('Enter a target XP greater than 0.');return}
  const durationDays=parseInt($('#teamChallengeDurationSelect').value,10);
  const eligibleSources=[...$$('#teamChallengeCategories input[type=checkbox]:checked')]
    .flatMap(cb=>CHALLENGE_CATEGORIES[cb.value]||[]);
  if(!eligibleSources.length){alert('Pick at least one activity category.');return}
  const rewardType=$('input[name=teamChallengeRewardType]:checked')?.value;
  let rewardGearItemId=null, rewardDescription=null;
  if(rewardType==='gear'){
    rewardGearItemId=$('#teamChallengeRewardGearSelect').value;
    if(!rewardGearItemId){alert('Pick a gear reward.');return}
  }else{
    rewardDescription=($('#teamChallengeRewardTextInput')?.value||'').trim();
    if(!rewardDescription){alert('Describe the real-world reward.');return}
  }
  const pin=await showPinModal('set this team challenge');
  if(!pin) return;
  let pinOk=false;
  try{ pinOk=await verifyApprovalPinRemote(pin); }catch(err){ /* treat as failed */ }
  if(!pinOk){alert('Incorrect PIN.');return}
  try{
    await saveTeamChallengeRemote(coachTeam.id,title,targetXp,eligibleSources,durationDays,rewardType,rewardGearItemId,rewardDescription,pin);
  }catch(err){
    alert('Could not set team challenge: '+(err.message||'unknown error'));
    return;
  }
  if($('#teamChallengeSetupStatus')) $('#teamChallengeSetupStatus').textContent=`Saved "${title}". It replaces any previous active challenge.`;
  if(activeAthlete&&athleteTeamMembership?.teams?.id===coachTeam.id) await refreshTeamMembershipUI();
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
  $('#teamProgramActivityList').innerHTML='<ul>'+p.activity_names.map(n=>`<li>${escapeHTML(n)}</li>`).join('')+'</ul>'+(p.instructions?`<p class="muted team-program-notes"><strong>Coach note:</strong> ${escapeHTML(p.instructions)}</p>`:'');
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
function renderTeamEdition(){renderMission();renderLeaderboard();renderTeamFeed();renderRecognitions();renderExerciseLibrary();renderProgramBuilder();renderTeamProgramBuilder();renderTeamProgramSummary();renderClubhouseTeamProgram();renderTeamProgramLogFields();renderTeamIdentity();renderArcadeLeaderboard();if($('#gameXPToday'))$('#gameXPToday').textContent=todayArcadeGameXP();if($('#homerBest'))$('#homerBest').textContent=getArcadeBest('homeRunHero');if($('#cannonArmBest'))$('#cannonArmBest').textContent=getArcadeBest('cannonArm');if($('#dugoutDisasterBest'))$('#dugoutDisasterBest').textContent=getArcadeBest('dugoutDisaster');if($('#ballparkBreakoutBest'))$('#ballparkBreakoutBest').textContent=getArcadeBest('ballparkBreakout');if($('#skylineSlamBest'))$('#skylineSlamBest').textContent=getArcadeBest('skylineSlam');if($('#pocketPrecisionBest'))$('#pocketPrecisionBest').textContent=getArcadeBest('pocketPrecision');if($('#turfTroubleBest'))$('#turfTroubleBest').textContent=getArcadeBest('turfTrouble');renderArcadeExtras()}
// ---- Home Run Hero (v2: embedded "Wild Home Run Derby" Phaser build) ----
// The game itself lives entirely at assets/games/home-run-derby/ (a
// self-contained Vite/Phaser build, no shared code with this file) and
// runs in an iframe (#homerDerbyFrame). It reports each completed 9-pitch
// session via postMessage — {type:'LUA_GAME_COMPLETE', detail:{score, ...}}
// per that project's own LUA integration contract (see its README) — score
// is 0-100 and explicitly marked non-authoritative by the game itself, so
// XP is decided and awarded here, exactly the same way every other arcade
// game's result is: through awardArcadeXp(), which enforces the real
// 25/day cap server-side. XP formula mirrors the other full-round games,
// which also let one good round hit the full daily cap on its own:
// xp = round(score/100 * 25).
// ---- Game entry tiles / shared game modal ----
// Home Run Hero, Cannon Arm, and Dugout Disaster used to be embedded
// inline as full-width cards; they're now condensed clickable tiles
// (see .game-tile in index.html) that all open into the one shared
// #gameModal, toggling which .game-frame wrapper is visible. Each
// iframe's real src lives in data-src and is only assigned the first
// time that game's tile is clicked, so the game's JS/asset bundle isn't
// fetched at all until the athlete actually wants to play — closing the
// modal just hides it again rather than tearing the iframe down, so a
// game already in progress keeps running if you reopen it.
const GAME_MODAL_CONFIG={
  homer:{wrap:'homerFrameWrap',frame:'homerDerbyFrame',title:'Home Run Hero'},
  cannon:{wrap:'cannonFrameWrap',frame:'cannonArmFrame',title:'Cannon Arm'},
  dugout:{wrap:'dugoutFrameWrap',frame:'dugoutDisasterFrame',title:'Dugout Disaster'},
  ballpark:{wrap:'ballparkFrameWrap',frame:'ballparkBreakoutFrame',title:'Ballpark Breakout'},
  skyline:{wrap:'skylineFrameWrap',frame:'skylineSlamFrame',title:'Skyline Slam'},
  pocket:{wrap:'pocketFrameWrap',frame:'pocketPrecisionFrame',title:'Pocket Precision'},
  turf:{wrap:'turfFrameWrap',frame:'turfTroubleFrame',title:'Turf Trouble'}
};
function openGameModal(gameKey){
  const cfg=GAME_MODAL_CONFIG[gameKey];
  if(!cfg) return;
  Object.values(GAME_MODAL_CONFIG).forEach(c=>{
    const visible=c===cfg;
    if($('#'+c.wrap)) $('#'+c.wrap).classList.toggle('hidden',!visible);
  });
  const frame=$('#'+cfg.frame);
  if(frame && !frame.src && frame.dataset.src) frame.src=frame.dataset.src;
  if($('#gameModalTitle')) $('#gameModalTitle').textContent=cfg.title;
  if($('#gameModal')) $('#gameModal').classList.remove('hidden');
  document.body.style.overflow='hidden';
}
function closeGameModal(){
  if($('#gameModal')) $('#gameModal').classList.add('hidden');
  document.body.style.overflow='';
}
async function handleHomerDerbyMessage(event){
  const frame=$('#homerDerbyFrame');
  if(!frame||event.source!==frame.contentWindow) return;
  const data=event.data;
  if(!data||data.type!=='LUA_GAME_COMPLETE'||!data.detail) return;
  const score=Math.max(0,Math.min(100,Math.round(+data.detail.score||0)));
  const {isNewBest,prevBest}=recordArcadeResult('homeRunHero',{score});
  const xpEarned=Math.round(score/100*25);
  const e=await awardArcadeXp('homeRunHero',xpEarned);
  recordArcadeMetric('homeRunHero',score);
  const delta=score-prevBest;
  const deltaText=prevBest>0?(delta>=0?`+${delta} above your best`:`${Math.abs(delta)} below your best (${prevBest})`):(score>0?'First result logged!':'');
  const xpText=e===null?'Could not save XP — try again.':`+${e} XP`;
  if($('#homerResult')) $('#homerResult').innerHTML=`<strong>${score} / 100</strong> · ${xpText}${isNewBest?' · New Best! 🎉':''}${deltaText?`<br><small>${deltaText}</small>`:''}`;
}
// ---- Cannon Arm (embedded "Wild Cannon Arm" Phaser build) ----
// Same embedded-iframe/postMessage pattern as Home Run Hero above — see
// that function's comment for the full rationale (non-authoritative
// client score, XP always awarded server-side through awardArcadeXp()).
// Only the iframe id, arcadeScores/arcadeMetrics key ('cannonArm'), and
// result element differ; the game itself lives at
// assets/games/cannon-arm/, entirely separate code from this file.
async function handleCannonArmMessage(event){
  const frame=$('#cannonArmFrame');
  if(!frame||event.source!==frame.contentWindow) return;
  const data=event.data;
  if(!data||data.type!=='LUA_GAME_COMPLETE'||!data.detail) return;
  const score=Math.max(0,Math.min(100,Math.round(+data.detail.score||0)));
  const {isNewBest,prevBest}=recordArcadeResult('cannonArm',{score});
  const xpEarned=Math.round(score/100*25);
  const e=await awardArcadeXp('cannonArm',xpEarned);
  recordArcadeMetric('cannonArm',score);
  const delta=score-prevBest;
  const deltaText=prevBest>0?(delta>=0?`+${delta} above your best`:`${Math.abs(delta)} below your best (${prevBest})`):(score>0?'First result logged!':'');
  const xpText=e===null?'Could not save XP — try again.':`+${e} XP`;
  if($('#cannonArmResult')) $('#cannonArmResult').innerHTML=`<strong>${score} / 100</strong> · ${xpText}${isNewBest?' · New Best! 🎉':''}${deltaText?`<br><small>${deltaText}</small>`:''}`;
}
// ---- Dugout Disaster (embedded vanilla-JS survival-arcade build) ----
// Same embedded-iframe/postMessage pattern as Home Run Hero/Cannon Arm above
// — see handleHomerDerbyMessage's comment for the full rationale. Only the
// iframe id, arcadeScores/arcadeMetrics key ('dugoutDisaster'), and result
// element differ; the game itself lives at assets/games/dugout-disaster/,
// a self-contained Canvas build with no build step, entirely separate code
// from this file.
async function handleDugoutDisasterMessage(event){
  const frame=$('#dugoutDisasterFrame');
  if(!frame||event.source!==frame.contentWindow) return;
  const data=event.data;
  if(!data||data.type!=='LUA_GAME_COMPLETE'||!data.detail) return;
  const score=Math.max(0,Math.min(100,Math.round(+data.detail.score||0)));
  const {isNewBest,prevBest}=recordArcadeResult('dugoutDisaster',{score});
  const xpEarned=Math.round(score/100*25);
  const e=await awardArcadeXp('dugoutDisaster',xpEarned);
  recordArcadeMetric('dugoutDisaster',score);
  const delta=score-prevBest;
  const deltaText=prevBest>0?(delta>=0?`+${delta} above your best`:`${Math.abs(delta)} below your best (${prevBest})`):(score>0?'First result logged!':'');
  const xpText=e===null?'Could not save XP — try again.':`+${e} XP`;
  if($('#dugoutDisasterResult')) $('#dugoutDisasterResult').innerHTML=`<strong>${score} / 100</strong> · ${xpText}${isNewBest?' · New Best! 🎉':''}${deltaText?`<br><small>${deltaText}</small>`:''}`;
}
// ---- Ballpark Breakout (embedded Matter.js physics build) ----
// Different integration contract from the three games above: it doesn't
// postMessage the parent at all. Instead it exposes a same-origin hook,
// window.onLevelUpGameComplete(result), plus a 'lua:game-complete'
// CustomEvent dispatched on its OWN window — the game's own docs
// recommend using exactly one of the two for a same-origin iframe to
// avoid a double-fire, so this uses the direct callback. Wired via the
// iframe's 'load' event (registered once, below) rather than
// window.addEventListener('message', ...), since there's no message to
// listen for; assigning the callback after every load re-attaches it
// correctly each time the lazy src is (re)assigned.
async function handleBallparkBreakoutResult(data){
  if(!data) return;
  const score=Math.max(0,Math.min(100,Math.round(+data.score||0)));
  const {isNewBest,prevBest}=recordArcadeResult('ballparkBreakout',{score});
  const xpEarned=Math.round(score/100*25);
  const e=await awardArcadeXp('ballparkBreakout',xpEarned);
  recordArcadeMetric('ballparkBreakout',score);
  const delta=score-prevBest;
  const deltaText=prevBest>0?(delta>=0?`+${delta} above your best`:`${Math.abs(delta)} below your best (${prevBest})`):(score>0?'First result logged!':'');
  const xpText=e===null?'Could not save XP — try again.':`+${e} XP`;
  if($('#ballparkBreakoutResult')) $('#ballparkBreakoutResult').innerHTML=`<strong>${score} / 100</strong> · ${xpText}${isNewBest?' · New Best! 🎉':''}${deltaText?`<br><small>${deltaText}</small>`:''}`;
}
// ---- Skyline Slam (embedded Canvas platformer build) ----
// Same same-origin window.onLevelUpGameComplete contract as Ballpark
// Breakout above — see that function's comment for the full rationale.
// Only the iframe id, arcadeScores/arcadeMetrics key ('skylineSlam'),
// and result element differ; the game itself lives at
// assets/games/skyline-slam/, entirely separate code from this file.
async function handleSkylineSlamResult(data){
  if(!data) return;
  const score=Math.max(0,Math.min(100,Math.round(+data.score||0)));
  const {isNewBest,prevBest}=recordArcadeResult('skylineSlam',{score});
  const xpEarned=Math.round(score/100*25);
  const e=await awardArcadeXp('skylineSlam',xpEarned);
  recordArcadeMetric('skylineSlam',score);
  const delta=score-prevBest;
  const deltaText=prevBest>0?(delta>=0?`+${delta} above your best`:`${Math.abs(delta)} below your best (${prevBest})`):(score>0?'First result logged!':'');
  const xpText=e===null?'Could not save XP — try again.':`+${e} XP`;
  if($('#skylineSlamResult')) $('#skylineSlamResult').innerHTML=`<strong>${score} / 100</strong> · ${xpText}${isNewBest?' · New Best! 🎉':''}${deltaText?`<br><small>${deltaText}</small>`:''}`;
}
// ---- Pocket Precision (embedded Canvas QB-passing build) ----
// Same same-origin window.onLevelUpGameComplete contract as Ballpark
// Breakout/Skyline Slam above — see handleBallparkBreakoutResult's
// comment for the full rationale. Only the iframe id, arcadeScores/
// arcadeMetrics key ('pocketPrecision'), and result element differ; the
// game itself lives at assets/games/pocket-precision/, entirely
// separate code from this file.
async function handlePocketPrecisionResult(data){
  if(!data) return;
  const score=Math.max(0,Math.min(100,Math.round(+data.score||0)));
  const {isNewBest,prevBest}=recordArcadeResult('pocketPrecision',{score});
  const xpEarned=Math.round(score/100*25);
  const e=await awardArcadeXp('pocketPrecision',xpEarned);
  recordArcadeMetric('pocketPrecision',score);
  const delta=score-prevBest;
  const deltaText=prevBest>0?(delta>=0?`+${delta} above your best`:`${Math.abs(delta)} below your best (${prevBest})`):(score>0?'First result logged!':'');
  const xpText=e===null?'Could not save XP — try again.':`+${e} XP`;
  if($('#pocketPrecisionResult')) $('#pocketPrecisionResult').innerHTML=`<strong>${score} / 100</strong> · ${xpText}${isNewBest?' · New Best! 🎉':''}${deltaText?`<br><small>${deltaText}</small>`:''}`;
}
// ---- Turf Trouble (embedded Canvas maze-chase build) ----
// Same same-origin window.onLevelUpGameComplete contract as Pocket
// Precision/Skyline Slam — see handleBallparkBreakoutResult's comment for
// the full rationale. The game reports a normalized 0-100 score
// (min(100, round(rawScore/100))) once per run, including when the
// athlete ends a run early, and the standard round(score/100*25) XP
// formula and server-side 25/day cap apply like every other game. Only the
// iframe id, arcadeScores/arcadeMetrics key ('turfTrouble'), and result
// element differ; the game lives at assets/games/turf-trouble/.
async function handleTurfTroubleResult(data){
  if(!data) return;
  const score=Math.max(0,Math.min(100,Math.round(+data.score||0)));
  const {isNewBest,prevBest}=recordArcadeResult('turfTrouble',{score});
  const xpEarned=Math.round(score/100*25);
  const e=await awardArcadeXp('turfTrouble',xpEarned);
  recordArcadeMetric('turfTrouble',score);
  const delta=score-prevBest;
  const deltaText=prevBest>0?(delta>=0?`+${delta} above your best`:`${Math.abs(delta)} below your best (${prevBest})`):(score>0?'First result logged!':'');
  const xpText=e===null?'Could not save XP — try again.':`+${e} XP`;
  if($('#turfTroubleResult')) $('#turfTroubleResult').innerHTML=`<strong>${score} / 100</strong> · ${xpText}${isNewBest?' · New Best! 🎉':''}${deltaText?`<br><small>${deltaText}</small>`:''}`;
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
// Dimensional wheel art (LUA-Prize-Wheel asset pack) — housing/lighting/
// hub/pointer stay fixed; only #wheel-rotor (the numbered face) turns,
// via its own SVG transform attribute, so the already-tilted projection
// on wheel-plane doesn't wobble. Static markup: the wedges/labels are
// precomputed vector paths matching wheelConfig.segments exactly (see
// that const's comment), not runtime-drawn, so there's nothing to
// regenerate here — just inject once.
function buildWheelSVG(){
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200" width="1200" height="1200" role="img" aria-labelledby="wheelTitle"><title id="wheelTitle">Level Up Athletics prize wheel</title><defs><linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#5A5369"/><stop offset=".22" stop-color="#25232F"/><stop offset=".56" stop-color="#100F17"/><stop offset=".84" stop-color="#383044"/><stop offset="1" stop-color="#0D0D12"/></linearGradient><linearGradient id="gold" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#FFF6CA"/><stop offset=".35" stop-color="#FFD12F"/><stop offset=".72" stop-color="#F9B32E"/><stop offset="1" stop-color="#A86D18"/></linearGradient><linearGradient id="hub" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#39313F"/><stop offset="1" stop-color="#121116"/></linearGradient><linearGradient id="sheen" x1="0" y1="0" x2=".3" y2="1"><stop stop-color="#FFFFFF" stop-opacity=".23"/><stop offset=".43" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity=".10"/></linearGradient><radialGradient id="floor"><stop stop-color="#070710" stop-opacity=".45"/><stop offset="1" stop-color="#070710" stop-opacity="0"/></radialGradient></defs><g id="wheel-plane" transform="translate(0 60) scale(1 .90)"><g id="wheel-housing"><ellipse cx="600" cy="1139" rx="484" ry="38" fill="url(#floor)"/><circle cx="600" cy="642" r="508" fill="#090A0F"/><circle cx="600" cy="626" r="509" fill="#292231" stroke="#0A0B0F" stroke-width="6"/><circle cx="600" cy="613" r="508" fill="#433B4D"/><circle cx="600" cy="600" r="509" fill="url(#metal)" stroke="#0D0D12" stroke-width="8"/><circle cx="600" cy="600" r="497" fill="none" stroke="#766A83" stroke-width="3"/><circle cx="600" cy="600" r="486" fill="none" stroke="#00CEE8" stroke-width="4"/><circle cx="600" cy="600" r="450" fill="#111018" stroke="url(#gold)" stroke-width="8"/><circle cx="600.0" cy="130.0" r="6" fill="#FFF6DF"/><circle cx="599.0" cy="129.0" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="721.6449511981848" cy="146.0148616441379" r="6" fill="#00CEE8"/><circle cx="720.6449511981848" cy="145.0148616441379" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="835.0" cy="192.96806022131386" r="6" fill="#FFF6DF"/><circle cx="834.0" cy="191.96806022131386" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="932.3401871576773" cy="267.6598128423227" r="6" fill="#00CEE8"/><circle cx="931.3401871576773" cy="266.6598128423227" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="1007.0319397786861" cy="365.0" r="6" fill="#FFF6DF"/><circle cx="1006.0319397786861" cy="364.0" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="1053.985138355862" cy="478.35504880181526" r="6" fill="#00CEE8"/><circle cx="1052.985138355862" cy="477.35504880181526" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="1070.0" cy="600.0" r="6" fill="#FFF6DF"/><circle cx="1069.0" cy="599.0" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="1053.985138355862" cy="721.6449511981848" r="6" fill="#00CEE8"/><circle cx="1052.985138355862" cy="720.6449511981848" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="1007.0319397786861" cy="835.0" r="6" fill="#FFF6DF"/><circle cx="1006.0319397786861" cy="834.0" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="932.3401871576773" cy="932.3401871576773" r="6" fill="#00CEE8"/><circle cx="931.3401871576773" cy="931.3401871576773" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="835.0" cy="1007.0319397786861" r="6" fill="#FFF6DF"/><circle cx="834.0" cy="1006.0319397786861" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="721.6449511981848" cy="1053.985138355862" r="6" fill="#00CEE8"/><circle cx="720.6449511981848" cy="1052.985138355862" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="600.0" cy="1070.0" r="6" fill="#FFF6DF"/><circle cx="599.0" cy="1069.0" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="478.3550488018152" cy="1053.985138355862" r="6" fill="#00CEE8"/><circle cx="477.3550488018152" cy="1052.985138355862" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="365.0000000000001" cy="1007.0319397786861" r="6" fill="#FFF6DF"/><circle cx="364.0000000000001" cy="1006.0319397786861" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="267.6598128423227" cy="932.3401871576773" r="6" fill="#00CEE8"/><circle cx="266.6598128423227" cy="931.3401871576773" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="192.9680602213138" cy="835.0" r="6" fill="#FFF6DF"/><circle cx="191.9680602213138" cy="834.0" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="146.01486164413797" cy="721.6449511981849" r="6" fill="#00CEE8"/><circle cx="145.01486164413797" cy="720.6449511981849" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="130.0" cy="600.0000000000001" r="6" fill="#FFF6DF"/><circle cx="129.0" cy="599.0000000000001" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="146.0148616441379" cy="478.3550488018152" r="6" fill="#00CEE8"/><circle cx="145.0148616441379" cy="477.3550488018152" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="192.96806022131386" cy="364.99999999999994" r="6" fill="#FFF6DF"/><circle cx="191.96806022131386" cy="363.99999999999994" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="267.6598128423226" cy="267.6598128423227" r="6" fill="#00CEE8"/><circle cx="266.6598128423226" cy="266.6598128423227" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="364.9999999999998" cy="192.96806022131398" r="6" fill="#FFF6DF"/><circle cx="363.9999999999998" cy="191.96806022131398" r="2" fill="#FFFFFF" opacity=".7"/><circle cx="478.3550488018153" cy="146.0148616441379" r="6" fill="#00CEE8"/><circle cx="477.3550488018153" cy="145.0148616441379" r="2" fill="#FFFFFF" opacity=".7"/></g><g id="wheel-rotor"><circle cx="600" cy="600" r="446" fill="#101116"/><g id="slice-1000" data-value="1000"><path d="M600 600L572.37217 160.86824A440 440 0 0 1 636.01415 161.47636Z" fill="#FFD12F" stroke="#141414" stroke-width="4" stroke-linejoin="round"/><g aria-label="1000 XP" fill="#141414" transform="translate(600 600) rotate(-89.45253456221198) translate(354 0) rotate(0)"><g transform="scale(0.014843750000000001 -0.0185546875) translate(-2850.0 -745.5)"><path transform="translate(0 0)" d="M240 266H580V1231L231 1159V1421L578 1493H944V266H1284V0H240Z"/><path transform="translate(1425 0)" d="M942 748Q942 1028 889.5 1142.5Q837 1257 713 1257Q589 1257 536.0 1142.5Q483 1028 483 748Q483 465 536.0 349.0Q589 233 713 233Q836 233 889.0 349.0Q942 465 942 748ZM1327 745Q1327 374 1167.0 172.5Q1007 -29 713 -29Q418 -29 258.0 172.5Q98 374 98 745Q98 1117 258.0 1318.5Q418 1520 713 1520Q1007 1520 1167.0 1318.5Q1327 1117 1327 745Z"/><path transform="translate(2850 0)" d="M942 748Q942 1028 889.5 1142.5Q837 1257 713 1257Q589 1257 536.0 1142.5Q483 1028 483 748Q483 465 536.0 349.0Q589 233 713 233Q836 233 889.0 349.0Q942 465 942 748ZM1327 745Q1327 374 1167.0 172.5Q1007 -29 713 -29Q418 -29 258.0 172.5Q98 374 98 745Q98 1117 258.0 1318.5Q418 1520 713 1520Q1007 1520 1167.0 1318.5Q1327 1117 1327 745Z"/><path transform="translate(4275 0)" d="M942 748Q942 1028 889.5 1142.5Q837 1257 713 1257Q589 1257 536.0 1142.5Q483 1028 483 748Q483 465 536.0 349.0Q589 233 713 233Q836 233 889.0 349.0Q942 465 942 748ZM1327 745Q1327 374 1167.0 172.5Q1007 -29 713 -29Q418 -29 258.0 172.5Q98 374 98 745Q98 1117 258.0 1318.5Q418 1520 713 1520Q1007 1520 1167.0 1318.5Q1327 1117 1327 745Z"/></g></g></g><g id="slice-5" data-value="5"><path d="M600 600L636.01415 161.47636A440 440 0 0 1 870.13187 252.68347Z" fill="#00CEE8" stroke="#141414" stroke-width="4" stroke-linejoin="round"/><g aria-label="5 XP" fill="#141414" transform="translate(600 600) rotate(-68.71520737327188) translate(322 0) rotate(0)"><g transform="scale(0.024609375 -0.029296875) translate(-712.5 -732.0)"><path transform="translate(0 0)" d="M217 1493H1174V1210H524V979Q568 991 612.5 997.5Q657 1004 705 1004Q978 1004 1130.0 867.5Q1282 731 1282 487Q1282 245 1116.5 108.0Q951 -29 657 -29Q530 -29 405.5 -4.5Q281 20 158 70V373Q280 303 389.5 268.0Q499 233 596 233Q736 233 816.5 301.5Q897 370 897 487Q897 605 816.5 673.0Q736 741 596 741Q513 741 419.0 719.5Q325 698 217 653Z"/></g></g></g><g id="slice-100" data-value="100"><path d="M600 600L870.13187 252.68347A440 440 0 0 1 985.20610 387.35885Z" fill="#FF5364" stroke="#141414" stroke-width="4" stroke-linejoin="round"/><g aria-label="100 XP" fill="#141414" transform="translate(600 600) rotate(-40.51244239631336) translate(322 0) rotate(0)"><g transform="scale(0.024609375 -0.029296875) translate(-2137.5 -745.5)"><path transform="translate(0 0)" d="M240 266H580V1231L231 1159V1421L578 1493H944V266H1284V0H240Z"/><path transform="translate(1425 0)" d="M942 748Q942 1028 889.5 1142.5Q837 1257 713 1257Q589 1257 536.0 1142.5Q483 1028 483 748Q483 465 536.0 349.0Q589 233 713 233Q836 233 889.0 349.0Q942 465 942 748ZM1327 745Q1327 374 1167.0 172.5Q1007 -29 713 -29Q418 -29 258.0 172.5Q98 374 98 745Q98 1117 258.0 1318.5Q418 1520 713 1520Q1007 1520 1167.0 1318.5Q1327 1117 1327 745Z"/><path transform="translate(2850 0)" d="M942 748Q942 1028 889.5 1142.5Q837 1257 713 1257Q589 1257 536.0 1142.5Q483 1028 483 748Q483 465 536.0 349.0Q589 233 713 233Q836 233 889.0 349.0Q942 465 942 748ZM1327 745Q1327 374 1167.0 172.5Q1007 -29 713 -29Q418 -29 258.0 172.5Q98 374 98 745Q98 1117 258.0 1318.5Q418 1520 713 1520Q1007 1520 1167.0 1318.5Q1327 1117 1327 745Z"/></g></g></g><g id="slice-10" data-value="10"><path d="M600 600L985.20610 387.35885A440 440 0 0 1 949.26281 867.61070Z" fill="#FFC58A" stroke="#141414" stroke-width="4" stroke-linejoin="round"/><g aria-label="10 XP" fill="#141414" transform="translate(600 600) rotate(4.280184331797244) translate(322 0) rotate(0)"><g transform="scale(0.024609375 -0.029296875) translate(-1425.0 -745.5)"><path transform="translate(0 0)" d="M240 266H580V1231L231 1159V1421L578 1493H944V266H1284V0H240Z"/><path transform="translate(1425 0)" d="M942 748Q942 1028 889.5 1142.5Q837 1257 713 1257Q589 1257 536.0 1142.5Q483 1028 483 748Q483 465 536.0 349.0Q589 233 713 233Q836 233 889.0 349.0Q942 465 942 748ZM1327 745Q1327 374 1167.0 172.5Q1007 -29 713 -29Q418 -29 258.0 172.5Q98 374 98 745Q98 1117 258.0 1318.5Q418 1520 713 1520Q1007 1520 1167.0 1318.5Q1327 1117 1327 745Z"/></g></g></g><g id="slice-250" data-value="250"><path d="M600 600L949.26281 867.61070A440 440 0 0 1 858.31620 956.19200Z" fill="#FFD12F" stroke="#141414" stroke-width="4" stroke-linejoin="round"/><g aria-label="250 XP" fill="#141414" transform="translate(600 600) rotate(45.754838709677415) translate(346 0) rotate(0)"><g transform="scale(0.0196875 -0.0234375) translate(-2137.5 -745.5)"><path transform="translate(0 0)" d="M590 283H1247V0H162V283L707 764Q780 830 815.0 893.0Q850 956 850 1024Q850 1129 779.5 1193.0Q709 1257 592 1257Q502 1257 395.0 1218.5Q288 1180 166 1104V1432Q296 1475 423.0 1497.5Q550 1520 672 1520Q940 1520 1088.5 1402.0Q1237 1284 1237 1073Q1237 951 1174.0 845.5Q1111 740 909 563Z"/><path transform="translate(1425 0)" d="M217 1493H1174V1210H524V979Q568 991 612.5 997.5Q657 1004 705 1004Q978 1004 1130.0 867.5Q1282 731 1282 487Q1282 245 1116.5 108.0Q951 -29 657 -29Q530 -29 405.5 -4.5Q281 20 158 70V373Q280 303 389.5 268.0Q499 233 596 233Q736 233 816.5 301.5Q897 370 897 487Q897 605 816.5 673.0Q736 741 596 741Q513 741 419.0 719.5Q325 698 217 653Z"/><path transform="translate(2850 0)" d="M942 748Q942 1028 889.5 1142.5Q837 1257 713 1257Q589 1257 536.0 1142.5Q483 1028 483 748Q483 465 536.0 349.0Q589 233 713 233Q836 233 889.0 349.0Q942 465 942 748ZM1327 745Q1327 374 1167.0 172.5Q1007 -29 713 -29Q418 -29 258.0 172.5Q98 374 98 745Q98 1117 258.0 1318.5Q418 1520 713 1520Q1007 1520 1167.0 1318.5Q1327 1117 1327 745Z"/></g></g></g><g id="slice-15" data-value="15"><path d="M600 600L858.31620 956.19200A440 440 0 0 1 621.26768 1039.48571Z" fill="#00CEE8" stroke="#141414" stroke-width="4" stroke-linejoin="round"/><g aria-label="15 XP" fill="#141414" transform="translate(600 600) rotate(70.63963133640556) translate(322 0) rotate(0)"><g transform="scale(0.024609375 -0.029296875) translate(-1425.0 -732.0)"><path transform="translate(0 0)" d="M240 266H580V1231L231 1159V1421L578 1493H944V266H1284V0H240Z"/><path transform="translate(1425 0)" d="M217 1493H1174V1210H524V979Q568 991 612.5 997.5Q657 1004 705 1004Q978 1004 1130.0 867.5Q1282 731 1282 487Q1282 245 1116.5 108.0Q951 -29 657 -29Q530 -29 405.5 -4.5Q281 20 158 70V373Q280 303 389.5 268.0Q499 233 596 233Q736 233 816.5 301.5Q897 370 897 487Q897 605 816.5 673.0Q736 741 596 741Q513 741 419.0 719.5Q325 698 217 653Z"/></g></g></g><g id="slice-20" data-value="20"><path d="M600 600L621.26768 1039.48571A440 440 0 0 1 205.92460 795.71555Z" fill="#FF982D" stroke="#141414" stroke-width="4" stroke-linejoin="round"/><g aria-label="20 XP" fill="#141414" transform="translate(600 600) rotate(120.40921658986176) translate(322 0) rotate(180)"><g transform="scale(0.024609375 -0.029296875) translate(-1425.0 -745.5)"><path transform="translate(0 0)" d="M590 283H1247V0H162V283L707 764Q780 830 815.0 893.0Q850 956 850 1024Q850 1129 779.5 1193.0Q709 1257 592 1257Q502 1257 395.0 1218.5Q288 1180 166 1104V1432Q296 1475 423.0 1497.5Q550 1520 672 1520Q940 1520 1088.5 1402.0Q1237 1284 1237 1073Q1237 951 1174.0 845.5Q1111 740 909 563Z"/><path transform="translate(1425 0)" d="M942 748Q942 1028 889.5 1142.5Q837 1257 713 1257Q589 1257 536.0 1142.5Q483 1028 483 748Q483 465 536.0 349.0Q589 233 713 233Q836 233 889.0 349.0Q942 465 942 748ZM1327 745Q1327 374 1167.0 172.5Q1007 -29 713 -29Q418 -29 258.0 172.5Q98 374 98 745Q98 1117 258.0 1318.5Q418 1520 713 1520Q1007 1520 1167.0 1318.5Q1327 1117 1327 745Z"/></g></g></g><g id="slice-25" data-value="25"><path d="M600 600L205.92460 795.71555A440 440 0 0 1 262.68581 317.47719Z" fill="#FFF6DF" stroke="#141414" stroke-width="4" stroke-linejoin="round"/><g aria-label="25 XP" fill="#141414" transform="translate(600 600) rotate(186.76866359447) translate(322 0) rotate(180)"><g transform="scale(0.024609375 -0.029296875) translate(-1425.0 -745.5)"><path transform="translate(0 0)" d="M590 283H1247V0H162V283L707 764Q780 830 815.0 893.0Q850 956 850 1024Q850 1129 779.5 1193.0Q709 1257 592 1257Q502 1257 395.0 1218.5Q288 1180 166 1104V1432Q296 1475 423.0 1497.5Q550 1520 672 1520Q940 1520 1088.5 1402.0Q1237 1284 1237 1073Q1237 951 1174.0 845.5Q1111 740 909 563Z"/><path transform="translate(1425 0)" d="M217 1493H1174V1210H524V979Q568 991 612.5 997.5Q657 1004 705 1004Q978 1004 1130.0 867.5Q1282 731 1282 487Q1282 245 1116.5 108.0Q951 -29 657 -29Q530 -29 405.5 -4.5Q281 20 158 70V373Q280 303 389.5 268.0Q499 233 596 233Q736 233 816.5 301.5Q897 370 897 487Q897 605 816.5 673.0Q736 741 596 741Q513 741 419.0 719.5Q325 698 217 653Z"/></g></g></g><g id="slice-50" data-value="50"><path d="M600 600L262.68581 317.47719A440 440 0 0 1 572.37217 160.86824Z" fill="#FFB8D8" stroke="#141414" stroke-width="4" stroke-linejoin="round"/><g aria-label="50 XP" fill="#141414" transform="translate(600 600) rotate(243.17419354838705) translate(322 0) rotate(180)"><g transform="scale(0.024609375 -0.029296875) translate(-1425.0 -745.5)"><path transform="translate(0 0)" d="M217 1493H1174V1210H524V979Q568 991 612.5 997.5Q657 1004 705 1004Q978 1004 1130.0 867.5Q1282 731 1282 487Q1282 245 1116.5 108.0Q951 -29 657 -29Q530 -29 405.5 -4.5Q281 20 158 70V373Q280 303 389.5 268.0Q499 233 596 233Q736 233 816.5 301.5Q897 370 897 487Q897 605 816.5 673.0Q736 741 596 741Q513 741 419.0 719.5Q325 698 217 653Z"/><path transform="translate(1425 0)" d="M942 748Q942 1028 889.5 1142.5Q837 1257 713 1257Q589 1257 536.0 1142.5Q483 1028 483 748Q483 465 536.0 349.0Q589 233 713 233Q836 233 889.0 349.0Q942 465 942 748ZM1327 745Q1327 374 1167.0 172.5Q1007 -29 713 -29Q418 -29 258.0 172.5Q98 374 98 745Q98 1117 258.0 1318.5Q418 1520 713 1520Q1007 1520 1167.0 1318.5Q1327 1117 1327 745Z"/></g></g></g></g><g id="wheel-lighting"><circle cx="600" cy="600" r="438" fill="url(#sheen)"/><circle cx="600" cy="600" r="435" fill="none" stroke="#FFFFFF" stroke-opacity=".22" stroke-width="2"/></g><g id="wheel-hub"><circle cx="600" cy="609" r="116" fill="#08090E" opacity=".55"/><circle cx="600" cy="600" r="115" fill="url(#gold)" stroke="#151019" stroke-width="6"/><circle cx="600" cy="600" r="98" fill="url(#hub)" stroke="#FFF6CA" stroke-width="2"/><path d="M549 590 600 542 651 590V613L600 565 549 613ZM549 631 600 583 651 631V653L600 606 549 653Z" fill="url(#gold)"/></g><g id="wheel-pointer"><path d="M563 63H637Q649 63 645 77L608 168Q600 185 592 168L555 77Q551 63 563 63Z" fill="#0C0D11" transform="translate(4 8)" opacity=".8"/><path d="M563 60H637Q649 60 645 74L608 165Q600 182 592 165L555 74Q551 60 563 60Z" fill="url(#gold)" stroke="#141414" stroke-width="6"/><path d="M567 73H630L600 151Z" fill="#FFE992"/><circle cx="600" cy="87" r="9" fill="#141414"/></g></g></svg>';
}
let wheelRotation=0,wheelSpinning=false;
function spinWheel(){
  ensureArcadeDay();
  if(wheelSpinning) return;
  if(state.arcadeDaily.spinsUsed>=state.arcadeDaily.spinsAvailable){
    if($('#spinStatus')) $('#spinStatus').textContent='No spins left today — come back tomorrow!';
    return;
  }
  const rotorEl=document.getElementById('wheel-rotor');
  if(!rotorEl) return;
  wheelSpinning=true;
  if($('#spinButton')) $('#spinButton').disabled=true;
  if($('#spinResult')) $('#spinResult').textContent='';
  const segment=wheelSelectSegment(Math.random());
  const val=segment.value;
  wheelRotation=wheelTargetRotation(wheelRotation,segment.id,6);
  rotorEl.style.transform=`rotate(${wheelRotation}deg)`;
  const onDone=async()=>{
    rotorEl.removeEventListener('transitionend',onDone);
    // Cross-check the art actually landed where the awarded value says —
    // matches the pack's own "face angle, pointer and server-awarded
    // segment must agree" requirement.
    const landed=wheelSegmentAtRotation(wheelRotation);
    if(landed&&landed.value!==val) console.error('Wheel landing mismatch',landed.value,val);
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
  rotorEl.addEventListener('transitionend',onDone,{once:true});
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
// Call-Up Ladder tap-to-flip. Click/tap anywhere on a card flips just
// that card; Enter/Space does the same for keyboard users (the card
// itself is the focusable role="button" element, set in renderLadder()).
document.addEventListener('click',e=>{
  const tierCard=e.target.closest('.tier.cardtier');
  if(tierCard) toggleTierFlip(tierCard);
});
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter' && e.key!==' ') return;
  const tierCard=e.target.closest && e.target.closest('.tier.cardtier');
  if(!tierCard) return;
  e.preventDefault();
  toggleTierFlip(tierCard);
});

seedPresetPrograms();
renderLadder();renderHeroLadderPreview();renderTeamChallengeRewardGearOptions();
window.addEventListener('resize',renderCharts);render();renderTeamEdition();


if($('#completeMission'))$('#completeMission').onclick=completeDailyMission;
if($('#useRainToken'))$('#useRainToken').onclick=useRainToken;
if($('#leaderboardMetric'))$('#leaderboardMetric').onchange=renderLeaderboard;
if($('#libraryCategory'))$('#libraryCategory').onchange=renderExerciseLibrary;
if($('#goalChips'))$('#goalChips').onclick=e=>{const btn=e.target.closest('.goal-chip');if(!btn)return;$('#libraryCategory').value=btn.dataset.category;renderExerciseLibrary()};
if($('#saveTeamProgram'))$('#saveTeamProgram').onclick=saveTeamProgram;
if($('#saveTeamChallenge'))$('#saveTeamChallenge').onclick=saveTeamChallenge;
$$('input[name=teamChallengeRewardType]').forEach(r=>r.onchange=toggleTeamChallengeRewardFields);
if($('#saveTeamSetup'))$('#saveTeamSetup').onclick=saveTeamSetup;
if($('#coachTeamSwitcher'))$('#coachTeamSwitcher').onchange=e=>switchCoachTeam(e.target.value);
if($('#joinTeamIdentityBtn'))$('#joinTeamIdentityBtn').onclick=joinTeamIdentity;
if($('#teamLogoUpload'))$('#teamLogoUpload').onchange=e=>handleTeamLogoUpload(e.target.files[0]);
if($('#joinTeamProgram'))$('#joinTeamProgram').onclick=joinTeamProgram;
if($('#completeTeamProgram'))$('#completeTeamProgram').onclick=goToTeamProgramCheckIn;
window.addEventListener('message',handleHomerDerbyMessage);
window.addEventListener('message',handleCannonArmMessage);
window.addEventListener('message',handleDugoutDisasterMessage);
if($('#ballparkBreakoutFrame')) $('#ballparkBreakoutFrame').addEventListener('load',function(){
  try{ this.contentWindow.onLevelUpGameComplete=handleBallparkBreakoutResult; }catch(e){}
});
if($('#skylineSlamFrame')) $('#skylineSlamFrame').addEventListener('load',function(){
  try{ this.contentWindow.onLevelUpGameComplete=handleSkylineSlamResult; }catch(e){}
});
if($('#pocketPrecisionFrame')) $('#pocketPrecisionFrame').addEventListener('load',function(){
  try{ this.contentWindow.onLevelUpGameComplete=handlePocketPrecisionResult; }catch(e){}
});
if($('#turfTroubleFrame')) $('#turfTroubleFrame').addEventListener('load',function(){
  try{ this.contentWindow.onLevelUpGameComplete=handleTurfTroubleResult; }catch(e){}
});
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
  if($('#deviceCodeFields')) $('#deviceCodeFields').classList.add('hidden');
  if($('#deviceCodeInput')) $('#deviceCodeInput').value='';
  if($('#deviceCodeStatus')) $('#deviceCodeStatus').textContent='';
}
function hideAuthModal(){$('#authModal').classList.add('hidden')}
function showAddAthleteModal(){
  $('#addAthleteModal').classList.remove('hidden');
  $('#addAthleteStatus').textContent='';
  $('#newAthleteName').value='';
}
function hideAddAthleteModal(){$('#addAthleteModal').classList.add('hidden')}

// ---- Home Screen device pairing ----
// One-time (per browser) prompt after sign-in to generate a short pairing
// code (like pairing a smart TV) — displayed here on the parent's own
// device, then typed once on the athlete's freshly-added Home Screen icon
// via the "Enter a device code instead" option in the sign-in modal. See
// pairDeviceWithCode() below and supabase/functions/*/index.ts for the
// rest of the flow, and 0016_pairing_code.sql for why this replaced an
// earlier URL-token approach that iOS didn't reliably honor.
const HOME_SCREEN_DISMISS_KEY='lua.homeScreenPromptDismissed';
const DEVICE_TOKEN_ID_KEY='lua.deviceTokenId';
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
    // The PIN is checked with the server here (attempt_approval_pin), which
    // counts wrong guesses and locks after 5. A correct PIN resolves with a
    // short-lived approval token instead of the PIN itself; every caller
    // already just passes the resolved value on to its RPC.
    let checking=false;
    submitBtn.onclick=async()=>{
      if(checking) return;
      const v=input.value.trim();
      if(!/^[0-9]{4,6}$/.test(v)){$('#pinModalStatus').textContent='Enter a 4-6 digit PIN.';return}
      checking=true; submitBtn.disabled=true;
      $('#pinModalStatus').textContent='Checking…';
      try{
        const r=await getApprovalCredential(v);
        if(r.credential){submitBtn.disabled=false;finish(r.credential);return}
        $('#pinModalStatus').textContent=r.error;
        input.value=''; input.focus();
      }catch(err){
        $('#pinModalStatus').textContent='Could not check your PIN — check your connection and try again.';
      }
      checking=false; submitBtn.disabled=false;
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
  if(await touchPairedDeviceOnBoot()) return;
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
  currentClubhouseRoster=[]; clubhouseStatus='idle'; clubhouseError=''; clubhouseUsingFallback=false;
  currentRecognitions=[]; currentSpotlight=null; recognitionsStatus='idle'; recognitionsError='';
  currentTeamProgram=null;
  currentTeamProgramOptedIn=false;
  updateAuthUI();
  renderCoachOnlyVisibility();
  renderTeamIdentity();
  $('#pinSetupCreateFields').classList.remove('hidden');
  $('#pinChangeFields').classList.add('hidden');
}
// Called from the sign-in modal's "Enter a device code instead" field —
// the athlete's freshly-added, not-yet-signed-in Home Screen icon. Signs
// in via the same public verifyOtp() path a magic link uses, and stashes
// the (non-secret) device_tokens row id locally so this device can keep
// its pairing alive going forward — see touchPairedDeviceOnBoot() below.
async function submitDeviceCodeAction(){
  const code=$('#deviceCodeInput').value.trim();
  if(!code){$('#deviceCodeStatus').textContent='Enter the device code.';return}
  $('#deviceCodeStatus').textContent='Signing in...';
  try{
    const deviceTokenId=await redeemPairingCode(code);
    localStorage.setItem(DEVICE_TOKEN_ID_KEY,deviceTokenId);
    $('#deviceCodeStatus').textContent='';
  }catch(err){
    $('#deviceCodeStatus').textContent=err.message||'Could not sign in with that code.';
  }
}
// Runs after every sign-in (fresh or restored) on a device that previously
// paired via a code. Uses this device's own ordinary session — no
// separate secret needed — to keep its device_tokens row's expiry sliding
// forward while actively used, and to detect if it's been revoked from
// the "Your Devices" list. Best-effort: network hiccups are ignored, only
// a definitive "revoked" response forces a sign-out.
// Returns true if this forced a sign-out (device was revoked) — callers
// should stop their own sign-in flow immediately when that happens rather
// than continuing to set up UI for a session that's about to be torn down.
async function touchPairedDeviceOnBoot(){
  const deviceTokenId=localStorage.getItem(DEVICE_TOKEN_ID_KEY);
  if(!deviceTokenId) return false;
  try{
    await touchDeviceToken(deviceTokenId);
    return false;
  }catch(err){
    console.warn('This device\'s pairing is no longer valid — signing out:',err&&err.message?err.message:err);
    localStorage.removeItem(DEVICE_TOKEN_ID_KEY);
    try{ await signOutUser(); }catch(e){ /* signOutUser already falls back to local clear */ }
    afterSignedOut();
    return true;
  }
}
function initAuthUI(){
  onSupabaseReady(async()=>{
    onAuthChange((event,session)=>{
      if(session) afterSignedIn(session);
      else afterSignedOut();
    });
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
  if($('#closeBuildAvatarModal'))$('#closeBuildAvatarModal').onclick=hideBuildAvatarModal;
  if($('#viewSampleAvatarsBtn'))$('#viewSampleAvatarsBtn').onclick=()=>$('#sampleAvatarsModal').classList.remove('hidden');
  if($('#closeSampleAvatarsModal'))$('#closeSampleAvatarsModal').onclick=()=>$('#sampleAvatarsModal').classList.add('hidden');
  if($('#generateAvatarBtn'))$('#generateAvatarBtn').onclick=generateAvatarAction;
  if($('#saveAvatarBtn'))$('#saveAvatarBtn').onclick=saveAvatarAction;
  if($('#retryAvatarBtn'))$('#retryAvatarBtn').onclick=retryAvatarAction;
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
  if($('#sendDevFeedbackBtn'))$('#sendDevFeedbackBtn').onclick=sendDeveloperFeedback;
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
    $('#homeScreenStatus').textContent='Generating your code...';
    try{
      const code=await requestDevicePairingCode(label);
      const formatted=code.length===8?code.slice(0,4)+'-'+code.slice(4):code;
      $('#homeScreenCodeDisplay').textContent=formatted;
      $('#homeScreenStepIntro').classList.add('hidden');
      $('#homeScreenStepReady').classList.remove('hidden');
      await renderMyDevices();
    }catch(err){
      $('#homeScreenStatus').textContent=err.message||'Could not create a device code. Try again.';
    }
  };
  if($('#myDevicesList'))$('#myDevicesList').addEventListener('click',async e=>{
    const id=e.target.dataset.revokeDevice;
    if(!id) return;
    await removeDeviceAction(id);
  });
  if($('#showDeviceCodeFieldBtn'))$('#showDeviceCodeFieldBtn').onclick=()=>{
    $('#deviceCodeFields').classList.remove('hidden');
    $('#deviceCodeInput').focus();
  };
  if($('#submitDeviceCodeBtn'))$('#submitDeviceCodeBtn').onclick=submitDeviceCodeAction;
  if($('#deviceCodeInput'))$('#deviceCodeInput').onkeydown=e=>{if(e.key==='Enter')submitDeviceCodeAction();};
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
    if(!/^[0-9]{4,6}$/.test(oldPin)){$('#pinSetupStatus').textContent='Enter your current 4-6 digit PIN.';return}
    if(!/^[0-9]{4,6}$/.test(newPin)){$('#pinSetupStatus').textContent='Enter a 4-6 digit new PIN.';return}
    try{
      const cred=await getApprovalCredential(oldPin);
      if(cred.error){$('#pinSetupStatus').textContent=cred.error;return}
      await changeApprovalPinRemote(cred.credential,newPin);
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
