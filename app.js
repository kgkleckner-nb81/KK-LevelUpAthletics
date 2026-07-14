const KEY='ethansBaseballHQ.logoParent.v1';
const defaults={daily:[],combine:[],quests:[],bonuses:[],claimedRewards:[],inventory:[],shoutouts:[],gameScores:{reaction:null,strike:0,homer:0},gameXP:{date:'',xp:0},rainTokens:1,parentCode:'SPARTAN9',spinLog:[],arcadeDaily:{date:'',spinsUsed:0,spinsAvailable:1,triviaAnswered:false,triviaCorrect:null,triviaSelected:null},trainingSlots:[null,null,null,null]};
let state=load();
function load(){try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return defaults}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
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
function questXP(){return (state.quests||[]).reduce((a,x)=>a+(+x.xp||0),0)}

const rewardMilestones=[
  {xp:250,title:'Ice Cream Single',icon:'🍦',desc:'Small surprise reward.'},
  {xp:500,title:'New Baseball Bonus',icon:'⚾',desc:'New baseball, eye black, or small gear item.'},
  {xp:750,title:'Batting Cage Trip',icon:'🥎',desc:'Parent-approved cage session or dad pitching session.'},
  {xp:1000,title:'Baseball Store Visit',icon:'🧢',desc:'Trip to pick a small baseball item.'},
  {xp:1500,title:'Brewers Bonus',icon:'🔵',desc:'Brewers-themed surprise.'},
  {xp:2000,title:'All-Star Outing',icon:'🏟️',desc:'Special baseball outing idea.'},
  {xp:3000,title:'MVP Surprise',icon:'🏆',desc:'Big end-of-season reward.'}
];
const bonusXPValues={
  'Great Effort Bonus':25,
  'Sportsmanship Bonus':50,
  'Helping Teammate Bonus':50,
  'Coach Compliment Bonus':100,
  'Parent Wild Card':75
};
function bonusXP(){return (state.bonuses||[]).reduce((a,x)=>a+(+x.xp||0),0)}


const tiers=[{name:'Rookie',min:0},{name:'Travel Ball',min:60},{name:'Single A',min:68},{name:'Double AA',min:76},{name:'Triple AAA',min:84},{name:'THE SHOW',min:92}];
const benches={pushups:[5,10,15,20,30],squats:[15,25,40,60,80],plank:[20,30,45,60,90],shuffleTouches:[20,30,40,50,60],skaterJumps:[10,20,30,40,50],broadJumpIn:[40,50,60,70,80],sprintSec:[4.5,4.2,4.0,3.8,3.6]};

$$('.tab').forEach(b=>b.onclick=()=>switchScreen(b.dataset.screen));
function modeForScreen(id){
  if(['clubhouse','daily','player','combine','quests','charts','library','rewards'].includes(id)) return 'athlete';
  if(['team','league'].includes(id)) return 'team';
  if(id==='arcade') return 'arcade';
  if(id==='parent') return 'parent';
  return 'home';
}
function showModeNav(mode){
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
}
function enterMode(mode){
  if(mode==='home') switchScreen('home');
  if(mode==='athlete') switchScreen('clubhouse');
  if(mode==='team') switchScreen('team');
  if(mode==='arcade') switchScreen('arcade');
  if(mode==='parent') switchScreen('parent');
}
$$('.mode-btn').forEach(b=>b.onclick=()=>enterMode(b.dataset.mode));
$$('[data-path]').forEach(b=>b.onclick=()=>enterMode(b.dataset.path));
$$('[data-home-button]').forEach(b=>b.onclick=()=>enterMode('home'));
if($('#dailyForm').date) $('#dailyForm').date.valueAsDate=new Date();
// Reads the raw field values for one activity's metrics out of a submitted
// form-data object, returning null if nothing was touched (so an athlete can
// leave a slot/dropdown blank for the day) or {error} if a required metric
// was started but left incomplete.
function collectMetricValues(a,rawGetter){
  const raw={};
  (a.metrics||[]).forEach(met=>{raw[met.key]=rawGetter(met.key)});
  const touched=Object.values(raw).some(v=>v!==undefined&&v!=='');
  if(!touched) return null;
  const missing=(a.metrics||[]).find(met=>met.required&&(raw[met.key]===undefined||raw[met.key]===''));
  if(missing) return {error:`${a.name} — ${missing.label}`};
  const values={};
  (a.metrics||[]).forEach(met=>{if(raw[met.key]!==undefined&&raw[met.key]!=='')values[met.key]=met.inputType==='decimal'?parseFloat(raw[met.key]):+raw[met.key]});
  return {values};
}
$('#dailyForm').onsubmit=e=>{
  e.preventDefault();
  const d=Object.fromEntries(new FormData(e.target).entries());
  d.custom={};
  let missingRequired=null;
  (state.trainingSlots||[]).forEach((name,i)=>{
    if(!name) return;
    const a=findActivity(name);
    if(!a) return;
    const result=collectMetricValues(a,key=>{const v=d[`skill_${i}_${key}`];delete d[`skill_${i}_${key}`];return v});
    if(result && result.error && !missingRequired) missingRequired=result.error;
    else if(result && result.values) d.custom[name]=result.values;
  });
  if(missingRequired){alert(`Please fill in ${missingRequired} before saving, or leave that exercise blank.`);return}
  state.daily.push(d);
  state.daily.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  save();openPack();e.target.reset();$('#dailyForm').date.valueAsDate=new Date();renderDailyCustomFields();render();
};
$('#combineForm').onsubmit=e=>{
  e.preventDefault();
  const d=Object.fromEntries(new FormData(e.target).entries());
  const ok=d.parentCode===state.parentCode;
  delete d.parentCode;
  d.verified=ok;
  d.status=ok?'Parent Verified':'Pending Parent Review';
  d.customCombine=[];
  let missingRequired=null;
  [0,1].forEach(i=>{
    const name=d[`combineSkillActivity_${i}`];
    delete d[`combineSkillActivity_${i}`];
    const a=name?findActivity(name):null;
    if(!a) return;
    const result=collectMetricValues(a,key=>{const v=d[`combineSkillMetric_${i}_${key}`];delete d[`combineSkillMetric_${i}_${key}`];return v});
    if(result && result.error && !missingRequired) missingRequired=result.error;
    else if(result && result.values) d.customCombine.push({name:a.name,values:result.values});
  });
  if(missingRequired){alert(`Please fill in ${missingRequired} before saving, or leave that exercise blank.`);return}
  state.combine.push(d);
  state.combine.sort((a,b)=>(+a.week||0)-(+b.week||0));
  save();
  alert(ok?'Weekly combine saved and parent verified.':'Saved as pending. Parent can approve in Parent Zone.');
  e.target.reset();
  [0,1].forEach(i=>{const f=$('#combineSkillFields_'+i);if(f)f.innerHTML=''});
  render();
};
$('#questForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target).entries());if(d.parentCode!==state.parentCode){alert('Incorrect parent code. Quest XP not awarded.');return}const q=quests.find(x=>x.id===d.questId);if(!q){alert('Select a quest.');return}state.quests=state.quests||[];state.quests.push({id:q.id,title:q.title,type:q.type,xp:q.xp,notes:d.notes||'',date:new Date().toISOString().slice(0,10)});save();alert(`${q.title} complete! +${q.xp} XP awarded.`);e.target.reset();render()};

$('#saveParentCode').onclick=()=>{const c=$('#newParentCode').value.trim();if(c.length<4){$('#codeStatus').textContent='Use at least 4 characters.';return}state.parentCode=c;save();$('#newParentCode').value='';$('#codeStatus').textContent='Parent code updated.'};
$('#approvePending').onclick=()=>{if($('#reviewCode').value!==state.parentCode){alert('Incorrect parent code.');return}state.combine.forEach(x=>{if(!x.verified){x.verified=true;x.status='Parent Verified'}});save();$('#reviewCode').value='';render()};
$('#bonusForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target).entries());if(d.parentCode!==state.parentCode){alert('Incorrect parent code. Bonus XP not awarded.');return}const xpValue=bonusXPValues[d.bonusType]||0;state.bonuses=state.bonuses||[];state.bonuses.push({date:new Date().toISOString().slice(0,10),type:d.bonusType,xp:xpValue,reason:d.reason||''});save();alert(`${d.bonusType} awarded! +${xpValue} XP.`);e.target.reset();render()};

$('#exerciseSelect').onchange=renderCharts;$('#combineMetricSelect').onchange=renderCharts;
$('#exportData').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ethans-baseball-hq-backup.json';a.click()};
$('#importData').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{state={...defaults,...JSON.parse(r.result)};save();render()}catch{alert('Could not import file')}};r.readAsText(f)};
$('#resetData').onclick=()=>{if(confirm('Reset all saved data on this device?')){state={...defaults,daily:[],combine:[],quests:[],bonuses:[],claimedRewards:[]};save();render()}};

function max(arr){return Math.max(0,...arr.map(x=>+x||0))}
function minPos(arr){const v=arr.map(Number).filter(x=>x>0);return v.length?Math.min(...v):0}
function pr(){return{pushups:max([...state.daily.map(x=>x.pushups),...state.combine.filter(x=>x.verified).map(x=>x.maxPushups)]),squats:max([...state.daily.map(x=>x.squats),...state.combine.filter(x=>x.verified).map(x=>x.squat60)]),plank:max([...state.daily.map(x=>x.plank),...state.combine.filter(x=>x.verified).map(x=>x.plankMax)]),shuffleTouches:max(state.daily.map(x=>x.shuffleTouches)),skaterJumps:max(state.daily.map(x=>x.skaterJumps)),crunches:max(state.daily.map(x=>x.crunches)),broadJumpIn:max(state.combine.filter(x=>x.verified).map(x=>x.broadJumpIn)),sprintSec:minPos(state.combine.filter(x=>x.verified).map(x=>x.sprintSec)),sprints:max(state.daily.map(x=>x.sprints))}}
function score(v,k){const b=benches[k]||[5,10,15,20,30];if(k==='sprintSec'){if(!v)return 50;if(v<=b[4])return 92;if(v<=b[3])return 84;if(v<=b[2])return 76;if(v<=b[1])return 68;return 60}let i=0;b.forEach((n,idx)=>{if(v>=n)i=idx});return [50,60,68,76,84][i]}
function ratings(){
  const r=pr();
  const bonus=axis=>Math.min(15,customExerciseLogCount(axis)*2);
  const consistency=Math.min(99,50+state.daily.length*2+streak()*3+bonus('consistency'));
  const speed=Math.min(99,Math.round((score(r.sprints,'pushups')+(r.sprintSec?score(r.sprintSec,'sprintSec'):50))/2)+bonus('speed'));
  const strength=Math.min(99,Math.round((score(r.pushups,'pushups')+score(r.squats,'squats')+score(r.plank,'plank'))/3)+bonus('strength'));
  const power=Math.min(99,score(r.broadJumpIn,'broadJumpIn')+bonus('power'));
  const agility=Math.min(99,Math.round((score(r.shuffleTouches,'shuffleTouches')+score(r.skaterJumps,'skaterJumps'))/2)+bonus('agility'));
  const overall=Math.round((speed+strength+power+agility+consistency)/5);
  return{speed,strength,power,agility,consistency,overall}
}
function streak(){const dates=[...new Set(state.daily.map(x=>x.date).filter(Boolean))].sort().reverse();if(!dates.length)return 0;let s=0,d=new Date();for(let i=0;i<365;i++){const iso=d.toISOString().slice(0,10);if(dates.includes(iso)){s++;d.setDate(d.getDate()-1)}else if(i===0)d.setDate(d.getDate()-1);else break}return s}
function spinXP(){return (state.spinLog||[]).reduce((a,x)=>a+(+x.xp||0),0)}
function xp(){return state.daily.length*25+state.combine.filter(x=>x.verified).length*75+questXP()+bonusXP()+spinXP()}
function tier(){const o=ratings().overall;return [...tiers].reverse().find(t=>o>=t.min)||tiers[0]}
function openPack(){$('#packReveal').classList.remove('hidden');$('#packCards').innerHTML='<div class="pack-card"><h3>⭐ +25 XP</h3><p>Workout completed.</p></div><div class="pack-card"><h3>⚾ Card Pack</h3><p>Keep the streak alive.</p></div><div class="pack-card"><h3>🎁 Mystery Chance</h3><p>Ask Dad if the Home Run Meter is full.</p></div>'}

function renderPlatformStatus(){
  const total=xp(), current=tier(), currentIndex=Math.max(0,tiers.findIndex(x=>x.name===current.name));
  const next=tiers[Math.min(currentIndex+1,tiers.length-1)];
  const packReady=(total%250)>=200;
  if($('#statusTier')) $('#statusTier').textContent=current.name;
  if($('#statusLevel')) $('#statusLevel').textContent=Math.max(1,Math.floor(total/150)+1);
  if($('#statusXP')) $('#statusXP').textContent=total;
  if($('#statusStreak')) $('#statusStreak').textContent=streak();
  if($('#statusPack')) $('#statusPack').textContent=packReady?'READY':'LOCKED';
  if($('#homeStreak')) $('#homeStreak').textContent=streak()+' Days';
  if($('#homeNextCallup')) $('#homeNextCallup').textContent=currentIndex>=tiers.length-1?'THE SHOW':next.name;
  if($('#homePackStatus')) $('#homePackStatus').textContent=packReady?'Ready to Open':'Locked';
  if($('#homeMissionName')) $('#homeMissionName').textContent=typeof missionForToday==='function'?missionForToday().title:'Daily Mission';
}
function render(){renderPlatformStatus();const r=ratings(), rec=pr(), x=xp(), t=tier();$('#overall').textContent=r.overall;$('#overallBig').textContent=r.overall;$('#streak').textContent=streak();$('#workouts').textContent=state.daily.length;$('#xp').textContent=x;$('#levelName').textContent=t.name;$('#levelDesc').textContent=t.name==='THE SHOW'?'Major league energy. Keep building.':(t.name==='Triple AAA'?'One step from THE SHOW. Keep stacking wins.':'Keep training to get called up.');['speed','strength','power','agility','consistency'].forEach(k=>{$('#'+k).textContent=r[k];$('#'+k+'Bar').style.width=Math.min(100,r[k])+'%'});
$$('.tier').forEach((el,i)=>el.classList.toggle('active',r.overall>=tiers[i].min));$('#records').innerHTML=`<li>${rec.pushups} max push-ups</li><li>${rec.squats} max squats</li><li>${rec.plank} sec plank</li><li>${rec.shuffleTouches} shuffle touches</li><li>${rec.broadJumpIn} in verified broad jump</li><li>${rec.sprintSec||'—'} sec verified sprint</li>`;
const pct=Math.min(100,(x%250)/250*100);$('#meterFill').style.width=pct+'%';$('#meterText').textContent=`${x%250} / 250 XP to next parent surprise`;$('#rewardNotice').textContent=x>=250&&x%250<75?'🎁 Parent surprise may be unlocked. Check Parent Zone.':'';
$('#dailyLog').innerHTML=workoutHistoryTable(state.daily.slice(-10).reverse());
$('#combineLog').innerHTML=table(['Week','Push-ups','Squats','Plank','Broad','Sprint','Extra Skills','Status'],state.combine.map(a=>[a.week,a.maxPushups,a.squat60,a.plankMax,a.broadJumpIn,a.sprintSec,(a.customCombine||[]).map(x=>`${x.name}: ${formatMetricValues(x.name,x.values!=null?x.values:x.value)}`).join(', ')||'—',`<span class="status ${a.verified?'verified':'pending'}">${a.status}</span>`]));
$('#pendingList').innerHTML=table(['Week','Push-ups','Plank','Status'],state.combine.filter(a=>!a.verified).map(a=>[a.week,a.maxPushups,a.plankMax,a.status]));
$('#targets').innerHTML=Object.entries({pushups:rec.pushups,squats:rec.squats,plank:rec.plank,shuffleTouches:rec.shuffleTouches,skaterJumps:rec.skaterJumps,broadJumpIn:rec.broadJumpIn}).map(([k,v])=>`<p><strong>${k}</strong>: current ${v||0}</p>`).join('');renderQuests();renderRewards();renderCoachReport();renderTeamEdition();renderCharts()}


function xpEvents(){
  const events=[];
  (state.daily||[]).forEach(x=>events.push({date:x.date||'',label:'Daily Workout',xp:25,detail:x.notes||''}));
  (state.combine||[]).filter(x=>x.verified).forEach(x=>events.push({date:'Week '+x.week,label:'Verified Weekly Combine',xp:75,detail:'Parent verified'}));
  (state.quests||[]).forEach(x=>events.push({date:x.date||'',label:x.title,xp:+x.xp||0,detail:x.type||'Quest'}));
  (state.bonuses||[]).forEach(x=>events.push({date:x.date||'',label:x.type,xp:+x.xp||0,detail:x.reason||'Parent bonus'}));
  (state.spinLog||[]).forEach(x=>events.push({date:x.date||'',label:'Prize Wheel Spin',xp:+x.xp||0,detail:`Landed on +${x.xp} XP`}));
  return events;
}
function renderRewards(){
  const total=xp();
  const unlocked=rewardMilestones.filter(r=>total>=r.xp);
  const next=rewardMilestones.find(r=>total<r.xp);
  if($('#seasonXPBig')) $('#seasonXPBig').textContent=total;
  if($('#lifetimeXPBig')) $('#lifetimeXPBig').textContent=total;
  if($('#nextRewardXP')) $('#nextRewardXP').textContent=next?next.xp-total:0;
  if($('#rewardsUnlocked')) $('#rewardsUnlocked').textContent=unlocked.length;
  const prev=[...rewardMilestones].reverse().find(r=>total>=r.xp);
  const base=prev?prev.xp:0;
  const top=next?next.xp:base+250;
  const pct=Math.min(100,((total-base)/(top-base))*100);
  if($('#vaultMeterFill')) $('#vaultMeterFill').style.width=pct+'%';
  if($('#vaultMeterText')) $('#vaultMeterText').textContent=next?`${total} XP earned. ${next.xp-total} XP until ${next.title}.`:`${total} XP earned. All listed rewards unlocked.`;
  if($('#rewardVault')) $('#rewardVault').innerHTML=rewardMilestones.map(r=>{
    const stateClass=total>=r.xp?'unlocked':'';
    return `<div class="reward-tile ${stateClass}">
      <div class="quest-icon">${r.icon}</div>
      <h3>${r.title}</h3>
      <p><strong>${r.xp} XP</strong></p>
      <p>${r.desc}</p>
      <strong>${total>=r.xp?'Unlocked':'Locked'}</strong>
    </div>`;
  }).join('');
  const events=xpEvents().slice().reverse();
  if($('#xpLedger')) $('#xpLedger').innerHTML=events.length?events.map(e=>`<div class="ledger-item"><span>${e.date}</span><span>${e.label}<br><small class="muted">${e.detail||''}</small></span><strong>+${e.xp} XP</strong></div>`).join(''):'<p class="muted">No XP events yet.</p>';
}

function renderQuests(){
  const completed=(state.quests||[]).map(x=>x.id);
  if($('#questSelect')) $('#questSelect').innerHTML=quests.map(q=>`<option value="${q.id}">${q.type}: ${q.title} (+${q.xp} XP)</option>`).join('');
  if($('#questList')) $('#questList').innerHTML=quests.map(q=>{
    const count=completed.filter(id=>id===q.id).length;
    return `<div class="quest-card ${q.type==='Boss Battle'?'battle':''} ${count?'complete':''}">
      <div class="quest-icon">${q.icon}</div>
      <h3>${q.title}</h3>
      <p><strong>${q.type}</strong></p>
      <p>${q.desc}</p>
      <span class="xp-pill">+${q.xp} XP</span>
      ${count?`<p class="verified">Completed ${count}x</p>`:''}
    </div>`;
  }).join('');
  if($('#questHistory')) $('#questHistory').innerHTML=table(['Date','Challenge','Type','XP','Notes'],(state.quests||[]).slice().reverse().map(q=>[q.date,q.title,q.type,q.xp,q.notes]));
}


function workoutXPForEntry(entry){
  let total=25;
  const prs=entryPRs(entry);
  total += prs.length*15;
  const s=streak();
  if(s>=3) total += 10;
  return {total,prs,base:25,streakBonus:s>=3?10:0,prBonus:prs.length*15};
}
function previousDailyBest(beforeIndex,key){
  const prior=state.daily.slice(0,beforeIndex).map(x=>+x[key]||0);
  return Math.max(0,...prior);
}
function entryPRs(entry){
  const idx=state.daily.indexOf(entry);
  if(idx<0) return [];
  const checks=[['pushups','Push-ups'],['squats','Squats'],['crunches','Sit Ups'],['plank','Plank'],['shuffleTouches','Shuffle'],['skaterJumps','Skater Jumps'],['sprints','Sprints']];
  return checks.filter(([k])=>{const val=+entry[k]||0;return val>0 && val>previousDailyBest(idx,k);}).map(([k,label])=>({key:k,label,value:+entry[k]||0,previous:previousDailyBest(idx,k)}));
}
function formatPRCell(entry,key,prs){
  const val=entry[key]||'';
  if(!val) return '';
  return prs.some(p=>p.key===key)?`${val} <span class="new-pr">▲ PR</span>`:val;
}
function workoutHistoryTable(rows){
  if(!rows.length) return '<p class="muted">No entries yet.</p>';
  return `<table class="table workout-history"><thead><tr>
    <th>Date</th><th>✓</th><th>XP</th><th>Squats</th><th>Push-ups</th><th>Sit Ups</th><th>Plank</th><th>Shuffle</th><th>Skater Jumps</th><th>Sprints</th>
  </tr></thead><tbody>${rows.map(entry=>{
    const originalIndex=state.daily.indexOf(entry);
    const xpInfo=workoutXPForEntry(entry);
    const prs=xpInfo.prs;
    return `<tr class="workout-row" data-workout-index="${originalIndex}">
      <td>${entry.date||''}${prs.length?'<span class="pr-chip">PR</span>':''}</td>
      <td>✅</td>
      <td><strong>+${xpInfo.total}</strong></td>
      <td>${entry.squats||''}</td>
      <td>${formatPRCell(entry,'pushups',prs)}</td>
      <td>${formatPRCell(entry,'crunches',prs)}</td>
      <td>${formatPRCell(entry,'plank',prs)}</td>
      <td>${formatPRCell(entry,'shuffleTouches',prs)}</td>
      <td>${formatPRCell(entry,'skaterJumps',prs)}</td>
      <td>${formatPRCell(entry,'sprints',prs)}</td>
    </tr>`;
  }).join('')}</tbody></table><p class="muted tap-note">Tap a row to view workout details.</p>`;
}
function showWorkoutDetail(index){
  const entry=state.daily[index];
  if(!entry) return;
  const xpInfo=workoutXPForEntry(entry);
  const prs=xpInfo.prs;
  const prHtml=prs.length?prs.map(p=>`<li><strong>${p.label}</strong>: ${p.value} ${p.previous?`(+${p.value-p.previous})`:''}</li>`).join(''):'<li>No new PRs this workout.</li>';
  $('#workoutDetailContent').innerHTML=`
    <p class="eyebrow dark">Workout Detail</p>
    <h2>${entry.date||'Workout'}</h2>
    <div class="xp-breakdown">
      <h3>XP Breakdown</h3>
      <p>Daily Workout <strong>+${xpInfo.base}</strong></p>
      <p>Streak Bonus <strong>+${xpInfo.streakBonus}</strong></p>
      <p>New PR Bonus <strong>+${xpInfo.prBonus}</strong></p>
      <p class="total-xp">Total <strong>+${xpInfo.total} XP</strong></p>
    </div>
    <div class="detail-grid">
      <p><strong>Squats:</strong> ${entry.squats||0}</p>
      <p><strong>Push-ups:</strong> ${entry.pushups||0}</p>
      <p><strong>Sit Ups:</strong> ${entry.crunches||0}</p>
      <p><strong>Plank:</strong> ${entry.plank||0}</p>
      <p><strong>Shuffle:</strong> ${entry.shuffleTouches||0}</p>
      <p><strong>Skater Jumps:</strong> ${entry.skaterJumps||0}</p>
      <p><strong>Sprints:</strong> ${entry.sprints||0}</p>
      <p><strong>Notes:</strong> ${entry.notes||''}</p>
    </div>
    ${entry.custom&&Object.keys(entry.custom).length?`<h3>Skill Lab Extras</h3><div class="detail-grid">${Object.entries(entry.custom).map(([k,v])=>`<p><strong>${k}:</strong> ${formatMetricValues(k,v)}</p>`).join('')}</div>`:''}
    <h3>Personal Records</h3><ul>${prHtml}</ul>`;
  $('#workoutDetailModal').classList.remove('hidden');
}
function renderCoachReport(){
  if(!$('#coachReport')) return;
  if(!state.daily.length){$('#coachReport').innerHTML='<p class="muted">Complete a few workouts to unlock a weekly coach report.</p>';return;}
  const last7=state.daily.slice(-7);
  const workouts=last7.length;
  const metrics=[['pushups','Push-ups'],['squats','Squats'],['crunches','Sit Ups'],['plank','Plank'],['shuffleTouches','Shuffle'],['skaterJumps','Skater Jumps'],['sprints','Sprints']];
  const best=metrics.map(([k,label])=>{const vals=last7.map(x=>+x[k]||0);return{label,improvement:vals.length?Math.max(...vals)-Math.min(...vals):0};}).sort((a,b)=>b.improvement-a.improvement)[0];
  const r=pr();
  $('#coachReport').innerHTML=`<p><strong>Great work this week.</strong></p><p>You logged <strong>${workouts}</strong> recent workouts. Biggest improvement area: <strong>${best.label}</strong>.</p><p><strong>Next goals:</strong> ${(r.pushups||0)+2} push-ups, ${(r.crunches||0)+5} sit ups, ${(r.plank||0)+5}-second plank.</p><p class="muted">Keep stacking small wins and chasing the next call-up.</p>`;
}
document.addEventListener('click',e=>{
  const row=e.target.closest('.workout-row');
  if(row) showWorkoutDetail(+row.dataset.workoutIndex);
  if(e.target.id==='closeWorkoutDetail' || e.target.id==='workoutDetailModal') $('#workoutDetailModal').classList.add('hidden');
});

function table(h,rows){if(!rows.length)return'<p class="muted">No entries yet.</p>';return`<table class="table"><thead><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c||''}</td>`).join('')}</tr>`).join('')}</tbody></table>`}

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

const demoAthletes=[{name:'Ethan',xp:2845,workouts:42,streak:12,improvement:21,sportsmanship:8,arcade:920},{name:'Jack',xp:2710,workouts:40,streak:9,improvement:16,sportsmanship:10,arcade:880},{name:'Mason',xp:2490,workouts:38,streak:7,improvement:24,sportsmanship:6,arcade:810},{name:'Luke',xp:2380,workouts:36,streak:11,improvement:19,sportsmanship:7,arcade:790},{name:'Noah',xp:2265,workouts:35,streak:6,improvement:14,sportsmanship:9,arcade:760},{name:'Charlie',xp:2140,workouts:33,streak:8,improvement:18,sportsmanship:7,arcade:730}];
const fixedExerciseAliases=new Set(['Push-ups','Squats','Sit Ups','Skater Jumps','Lateral Shuffle','Broad Jump','20-yard Sprint','Plank']);
const categoryAxisMap={Strength:'strength',Core:'strength',Speed:'speed',Agility:'agility',Power:'power',Throwing:'consistency',Catching:'consistency',Hitting:'consistency',Pitching:'consistency',Recovery:'consistency',Teamwork:'consistency'};

// ---- Skills Lab activity catalog ----
// Each activity: {id, name, category, sportTags, ageBand, media, metrics}
// media.video.plannedUrl is reserved for a future pass — no component in this
// build ever reads it. See renderActivityDetail(): the Demo Video section is
// always the "coming soon" placeholder, regardless of this field's value.
function slug(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}
function emptyMedia(){return {instructionText:null,formCues:[],commonFaults:[],video:{plannedUrl:null}}}
const MetricBuilders={
  repsSets:()=>[{key:'reps',label:'Reps',unit:'reps',inputType:'integer',required:true,min:1,order:1},{key:'sets',label:'Sets',unit:'sets',inputType:'integer',required:true,min:1,order:2},{key:'rpe',label:'Effort',unit:'RPE 1–10',inputType:'scale_1_10',required:false,order:3}],
  repsSetsPlain:()=>[{key:'reps',label:'Reps',unit:'reps',inputType:'integer',required:true,min:1,order:1},{key:'sets',label:'Sets',unit:'sets',inputType:'integer',required:true,min:1,order:2}],
  repsOnly:(label)=>[{key:'reps',label:label||'Reps',unit:'reps',inputType:'integer',required:true,min:1,order:1}],
  duration:()=>[{key:'duration_sec',label:'Duration',unit:'sec',inputType:'integer',required:true,min:0,step:5,order:1}],
  time:()=>[{key:'duration_sec',label:'Time',unit:'sec',inputType:'decimal',required:true,min:0,step:0.01,order:1}],
  distanceYd:()=>[{key:'distance_yd',label:'Distance',unit:'yd',inputType:'integer',required:true,min:0,order:1}],
  distanceIn:()=>[{key:'distance_in',label:'Distance',unit:'in',inputType:'integer',required:true,min:0,order:1}],
  weightSetsReps:()=>[{key:'weight_lb',label:'Weight',unit:'lb',inputType:'integer',required:true,min:0,step:5,order:1},{key:'sets',label:'Sets',unit:'sets',inputType:'integer',required:true,min:1,order:2},{key:'reps',label:'Reps',unit:'reps',inputType:'integer',required:true,min:1,order:3},{key:'rpe',label:'Effort',unit:'RPE 1–10',inputType:'scale_1_10',required:false,order:4}]
};
const M=MetricBuilders;
const activityDefs={
  Strength:[['Push-ups',M.repsSets],['Wide Push-ups',M.repsSets],['Squats',M.repsSets],['Jump Squats',M.repsSets],['Wall Sit',M.duration],['Calf Raises',M.repsSetsPlain],['Glute Bridge',M.repsSetsPlain]],
  Core:[['Sit Ups',M.repsSetsPlain],['Dead Bugs',M.repsSetsPlain],['Bicycle Sit Ups',M.repsSetsPlain],['Plank',M.duration],['Side Plank',M.duration],['Superman',M.repsSetsPlain],['Hollow Hold',M.duration]],
  Speed:[['10-yard Sprint',M.time],['20-yard Sprint',M.time],['Flying Sprint',M.time],['Shuttle Run',M.time],['First-Step Reaction',()=>M.repsOnly('Reps')],['Base-Stealing Starts',()=>M.repsOnly('Reps')]],
  Agility:[['Skater Jumps',()=>M.repsOnly('Reps')],['Lateral Shuffle',()=>M.repsOnly('Touches')],['Carioca',M.duration],['Zig-Zag Cones',M.duration],['Crossover Runs',()=>M.repsOnly('Reps')],['Box Drill',M.duration],['Mirror Drill',M.duration]],
  Power:[['Broad Jump',M.distanceIn],['Vertical Jump',M.distanceIn],['Lateral Hops',M.repsSetsPlain],['Single-Leg Hops',M.repsSetsPlain]],
  Throwing:[['Target Throws',()=>M.repsOnly('Reps')],['One-Knee Throwing',()=>M.repsOnly('Reps')],['Long Toss',M.distanceYd],['Crow Hop',()=>M.repsOnly('Reps')],['Quick Release',()=>M.repsOnly('Reps')],['Pivot Throws',()=>M.repsOnly('Reps')]],
  Catching:[['Tennis Ball Reaction',()=>M.repsOnly('Reps')],['Barehand Catches',()=>M.repsOnly('Reps')],['Blocking Drill',()=>M.repsOnly('Reps')],['Transfer Drill',()=>M.repsOnly('Reps')]],
  Hitting:[['Tee Work',()=>M.repsOnly('Swings')],['Front Toss',()=>M.repsOnly('Swings')],['Bat-Speed Swings',()=>M.repsOnly('Swings')],['One-Hand Drills',()=>M.repsOnly('Swings')],['Balance Drills',M.duration],['Launch Position',()=>M.repsOnly('Reps')]],
  Pitching:[['Balance Drill',M.duration],['Arm Care',M.repsSetsPlain],['Hip Rotation',()=>M.repsOnly('Reps')],['Towel Drill',()=>M.repsOnly('Reps')]],
  Recovery:[['Shoulder Mobility',M.duration],['Band Work',M.repsSetsPlain],['Hip Mobility',M.duration],['Foam Rolling',M.duration],['Stretching',M.duration]],
  Teamwork:[['Sportsmanship Challenge',()=>M.repsOnly('Times')],['Encourage a Teammate',()=>M.repsOnly('Times')],['Equipment Cleanup',()=>M.repsOnly('Times')],['Coach Helper',()=>M.repsOnly('Times')]]
};
const categoryOrder=Object.keys(activityDefs);
const baseballCategories=new Set(['Throwing','Catching','Hitting','Pitching']);
// A handful of activities ship with real content to prove the "present" and
// "partially present" states render correctly. Everything else intentionally
// ships with null/empty media — the "absent" state — until a content pass fills it in.
const sampleMedia={
  'Wall Sit':{instructionText:'Slide your back down a wall until your knees are bent to about 90 degrees, like sitting in an invisible chair. Hold the position with your core tight and weight even through both feet.',formCues:['Back flat against the wall','Knees stacked over ankles, not past toes','Squeeze your quads and glutes','Breathe steady, don’t hold your breath'],commonFaults:['Letting the knees drift past the toes','Sliding too low or too high on the wall']},
  '10-yard Sprint':{instructionText:'A short, explosive sprint from a stopped start. Drive out low for the first few steps, then accelerate through the line without slowing down.',formCues:['Lean forward out of the start','Drive your arms front to back','Push the ground away, don’t reach with your feet','Run through the line, not to it'],commonFaults:['Standing up too tall too early','Taking choppy first steps instead of driving out low']},
  'Box Drill':{instructionText:'Set up four cones in a square. Sprint, shuffle, backpedal, and shuffle again around the box, staying low and under control at every corner.',formCues:['Stay low through every direction change','Chop your feet at each corner','Keep your eyes up, not on your feet','Push off the outside foot on every turn'],commonFaults:['Standing up tall at the corners and losing speed','Crossing your feet during the shuffle sections']},
  'Hip Mobility':{instructionText:'A continuous flow through 90/90 switches, world’s greatest stretch, and lateral lunges to open the hips before training.',formCues:['Keep both hips square to the front','Move slow and controlled, no bouncing','Breathe out on every stretch position'],commonFaults:['Rushing through positions','Letting the back knee collapse inward']},
  'Tee Work':{instructionText:'Hit off the batting tee focusing on a consistent, repeatable swing path rather than power.'}
};
const activities=categoryOrder.flatMap(cat=>activityDefs[cat].map(([name,metricsFn])=>{
  const m=sampleMedia[name];
  return {
    id:slug(name),
    name,
    category:cat,
    sportTags:baseballCategories.has(cat)?['baseball']:['multi-sport'],
    ageBand:'all',
    media:m?{instructionText:m.instructionText,formCues:m.formCues||[],commonFaults:m.commonFaults||[],video:{plannedUrl:null}}:emptyMedia(),
    metrics:metricsFn()
  };
}));
function findActivity(name){return activities.find(a=>a.name===name)}
function exerciseCategory(name){const a=findActivity(name);return a?a.category:null}
function allExerciseNames(){return activities.map(a=>a.name).filter(x=>!fixedExerciseAliases.has(x))}
function primaryMetricKey(activity){const sorted=(activity.metrics||[]).slice().sort((a,b)=>a.order-b.order);return sorted.length?sorted[0].key:null}
// Custom logs are stored per-metric (e.g. {reps:8,sets:3}) as of the Skills
// Lab metrics upgrade. hasLoggedAny() also accepts the older flat-number
// shape ({"Wide Push-ups": 12}) shipped before that upgrade, so previously
// saved data keeps working.
function hasLoggedAny(raw){
  if(raw==null) return false;
  if(typeof raw==='number') return raw>0;
  return Object.values(raw).some(v=>(+v||0)>0);
}
function customExerciseLogCount(axis){
  let count=0;
  state.daily.forEach(d=>{if(d.custom)Object.keys(d.custom).forEach(name=>{const cat=exerciseCategory(name);if(cat&&categoryAxisMap[cat]===axis&&hasLoggedAny(d.custom[name]))count++})});
  state.combine.filter(x=>x.verified).forEach(c=>{(c.customCombine||[]).forEach(x=>{const cat=exerciseCategory(x.name);if(cat&&categoryAxisMap[cat]===axis&&hasLoggedAny(x.values!=null?x.values:x.value))count++})});
  return count;
}
function loggedCustomExerciseNames(){
  const set=new Set();
  state.daily.forEach(d=>{if(d.custom)Object.keys(d.custom).forEach(k=>{if(hasLoggedAny(d.custom[k]))set.add(k)})});
  state.combine.forEach(c=>{(c.customCombine||[]).forEach(x=>{if(hasLoggedAny(x.values!=null?x.values:x.value))set.add(x.name)})});
  return [...set].sort();
}
// Formats a logged custom value for display, e.g. "Weight 95lb, Sets 3, Reps 8".
// Handles both the current per-metric shape and the legacy flat number shape.
function formatMetricValues(name,raw){
  if(raw==null) return '—';
  if(typeof raw==='number') return String(raw);
  const a=findActivity(name);
  return Object.entries(raw).map(([mk,mv])=>{
    const met=a&&(a.metrics||[]).find(m=>m.key===mk);
    return `${met?met.label:mk} ${mv}${met&&met.unit?' '+met.unit:''}`;
  }).join(', ');
}
function dailyValueFor(entry,key){
  if(key.startsWith('c:')){
    const name=key.slice(2);
    const raw=entry.custom&&entry.custom[name];
    if(raw==null) return 0;
    if(typeof raw==='number') return raw;
    const a=findActivity(name), pk=a?primaryMetricKey(a):null;
    return pk&&raw[pk]!=null?+raw[pk]:0;
  }
  return +entry[key]||0;
}
function combineValueFor(entry,key){
  if(key.startsWith('c:')){
    const name=key.slice(2);
    const f=(entry.customCombine||[]).find(x=>x.name===name);
    if(!f) return 0;
    if(f.value!=null) return +f.value||0;
    const a=findActivity(name), pk=a?primaryMetricKey(a):null;
    return pk&&f.values&&f.values[pk]!=null?+f.values[pk]:0;
  }
  return +entry[key]||0;
}
const avatarOptions=['⚾','🧢','🦸‍♂️','🐻','🦅','🔥','⭐','💪'];
const lockerItems=['Blueprint Card Background','Gold Bat Grip','Fire Player Frame','Pinstripe Jersey','Stadium Lights Background','Lightning Eye Black','Captain Title','Diamond Card Border'];

const wheelSegments=[10,10,15,20,20,25,25,50,50,100,250,1000];

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
function missionForToday(){const m=[{title:'Speed Day',tasks:['6 Sprints','40 Shuffle Touches','20 Skater Jumps'],reward:'+40 XP + Mystery Pack'},{title:'Power Day',tasks:['35 Squats','12 Push-ups','10 Broad Jumps'],reward:'+40 XP + Mystery Pack'},{title:'Core Day',tasks:['30 Sit Ups','45-Second Plank','20 Dead Bugs'],reward:'+40 XP + Mystery Pack'},{title:'Baseball IQ Day',tasks:['Strike Zone Challenge','Target Throws','Coach Helper'],reward:'+35 XP + Card Unlock'},{title:'Recovery Day',tasks:['Shoulder Mobility','Hip Mobility','Easy Stretching'],reward:'+25 XP + Rain Token Chance'}];return m[new Date().getDay()%m.length]}
function unlockRandomItem(){state.inventory=state.inventory||[];const item=lockerItems[Math.floor(Math.random()*lockerItems.length)];if(!state.inventory.includes(item))state.inventory.push(item);return item}
function completeDailyMission(){const m=missionForToday();state.bonuses=state.bonuses||[];if(state.bonuses.some(x=>x.type==='Daily Mission'&&x.date===todayISO())){alert('Today’s mission is already complete.');return}state.bonuses.push({date:todayISO(),type:'Daily Mission',xp:40,reason:m.title});unlockRandomItem();save();alert('Mission complete! +40 XP and a mystery item unlocked.');render()}
function useRainToken(){state.rainTokens=state.rainTokens??1;if(state.rainTokens<=0){alert('No Rain Delay Tokens available.');return}state.rainTokens-=1;state.bonuses=state.bonuses||[];state.bonuses.push({date:todayISO(),type:'Rain Delay Token',xp:0,reason:'Streak protected'});save();alert('Streak protected for one missed day.');renderTeamEdition()}
function renderMission(){const m=missionForToday();if($('#missionTitle'))$('#missionTitle').textContent=m.title;if($('#missionTasks'))$('#missionTasks').innerHTML='<ul>'+m.tasks.map(t=>`<li>☐ ${t}</li>`).join('')+'</ul>';if($('#missionReward'))$('#missionReward').textContent=m.reward;if($('#streakLarge'))$('#streakLarge').textContent=streak();if($('#rainTokens'))$('#rainTokens').textContent=state.rainTokens??1}
function renderLocker(){if(!$('#lockerInventory'))return;const inv=state.inventory||[];$('#lockerInventory').innerHTML=lockerItems.map(i=>`<div class="locker-item ${inv.includes(i)?'unlocked':''}"><div class="locker-icon">${inv.includes(i)?'🔓':'🔒'}</div><strong>${i}</strong></div>`).join('')}
function renderLeaderboard(){if(!$('#teamLeaderboard'))return;const metric=$('#leaderboardMetric')?.value||'xp';const sorted=[...demoAthletes].sort((a,b)=>b[metric]-a[metric]);$('#teamLeaderboard').innerHTML=`<table class="table"><thead><tr><th>#</th><th>Athlete</th><th>${metric}</th></tr></thead><tbody>${sorted.map((a,i)=>`<tr><td>${i+1}</td><td>${a.name}</td><td>${a[metric]}</td></tr>`).join('')}</tbody></table>`}
function renderTeamFeed(){if(!$('#teamFeed'))return;$('#teamFeed').innerHTML=['🏆 Ethan reached Single A','👏 Jack completed today’s mission','🔥 Mason extended a 7-day streak','⭐ Coach awarded Luke Great Hustle','⚾ Noah set a new sit-up PR'].map(x=>`<div class="feed-item">${x}</div>`).join('')}
function renderShoutouts(){if(!$('#shoutouts'))return;const demo=[{type:'Great Hustle',from:'Coach',date:'Today'},{type:'Great Attitude',from:'Dad',date:'Yesterday'}];$('#shoutouts').innerHTML=[...demo,...(state.shoutouts||[])].slice(-6).reverse().map(x=>`<div class="shoutout"><span>🏅</span><div><strong>${x.type}</strong><br><small>${x.from} · ${x.date}</small></div></div>`).join('')}
function addShoutout(){state.shoutouts=state.shoutouts||[];state.shoutouts.push({type:$('#shoutoutType').value,from:$('#shoutoutFrom').value,date:todayISO()});save();renderShoutouts()}
function renderExerciseLibrary(){
  if(!$('#libraryCategory'))return;
  if(!$('#libraryCategory').options.length)$('#libraryCategory').innerHTML=categoryOrder.map(c=>`<option>${c}</option>`).join('');
  const cat=$('#libraryCategory').value||categoryOrder[0];
  $('#exerciseLibrary').innerHTML=activities.filter(a=>a.category===cat).map(a=>{
    const isFixed=fixedExerciseAliases.has(a.name);
    const active=(state.trainingSlots||[]).includes(a.name);
    const label=isFixed?'Tracked Daily':(active?'In Training':'Add');
    return `<div class="library-card${active?' active':''}"><span>⚾</span><strong>${a.name}</strong><div class="library-card-actions"><button type="button" class="view-activity-btn" data-exercise="${a.name}">View</button><button type="button" class="add-exercise-btn" data-exercise="${a.name}" ${(isFixed||active)?'disabled':''}>${label}</button></div></div>`;
  }).join('');
}
function whyTrackLine(category){
  const axis=categoryAxisMap[category]||'consistency';
  const axisLabel={speed:'Speed',strength:'Strength',power:'Power',agility:'Agility',consistency:'training consistency'}[axis];
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
  const sortedMetrics=(a.metrics||[]).slice().sort((x,y)=>x.order-y.order);
  const legend=sortedMetrics.map(met=>`<div class="metric-legend-item"><strong>${met.label}</strong><span>${met.unit||'—'}</span></div>`).join('');
  const isFixed=fixedExerciseAliases.has(a.name);
  const active=(state.trainingSlots||[]).includes(a.name);
  const addLabel=isFixed?'Tracked Daily':(active?'In Training':'Add to Daily Training');
  $('#activityDetailContent').innerHTML=`
    <p class="eyebrow dark">${a.category}</p>
    <h2>${a.name}</h2>
    <h3>How to Perform</h3>${perform}
    <h3>Demo Video</h3>${video}
    <h3>How to Track</h3>
    <div class="metric-legend">${legend}</div>
    <p class="muted">${whyTrackLine(a.category)}</p>
    <button type="button" class="primary add-exercise-btn" data-exercise="${a.name}" ${(isFixed||active)?'disabled':''}>${addLabel}</button>
  `;
  $('#activityDetailModal').classList.remove('hidden');
}
function renderTrainingSlots(){
  if(!$('#trainingSlots')) return;
  state.trainingSlots=state.trainingSlots||[null,null,null,null];
  $('#trainingSlots').innerHTML=state.trainingSlots.map((ex,i)=>ex
    ?`<div class="slot-card filled"><strong>${ex}</strong><button type="button" class="slot-remove" data-slot="${i}">Remove</button></div>`
    :`<div class="slot-card empty"><span>Empty Slot ${i+1}</span></div>`
  ).join('');
}
function assignExercise(name){
  state.trainingSlots=state.trainingSlots||[null,null,null,null];
  if(state.trainingSlots.includes(name)){alert(`${name} is already one of your 4 training slots.`);return}
  const idx=state.trainingSlots.findIndex(x=>!x);
  if(idx===-1){alert('All 4 training slots are full. Remove one first in the Skill Lab.');return}
  state.trainingSlots[idx]=name;
  save();
  renderTrainingSlots();
  renderExerciseLibrary();
  renderDailyCustomFields();
  if($('#activityDetailModal')) $('#activityDetailModal').classList.add('hidden');
  alert(`${name} added to slot ${idx+1}! It now shows up on your Daily Check-In.`);
}
function removeSlot(i){
  state.trainingSlots[i]=null;
  save();
  renderTrainingSlots();
  renderExerciseLibrary();
  renderDailyCustomFields();
}
// Renders one input per activity metric, in metric.order, with a persistent
// unit badge (not placeholder text) so the unit stays visible while typing.
// scale_1_10 metrics render as a 1-10 segmented control instead of a number field.
function metricInputHTML(fieldName,activityName,metric){
  if(metric.inputType==='scale_1_10'){
    return `<div class="metric-field"><span class="metric-field-label">${activityName} · ${metric.label}</span><div class="rpe-scale" data-name="${fieldName}"><input type="hidden" name="${fieldName}">${Array.from({length:10},(_,i)=>i+1).map(n=>`<button type="button" class="rpe-btn" data-value="${n}">${n}</button>`).join('')}</div></div>`;
  }
  const step=metric.step!=null?metric.step:(metric.inputType==='decimal'?0.01:1);
  const min=metric.min!=null?` min="${metric.min}"`:'';
  const max=metric.max!=null?` max="${metric.max}"`:'';
  return `<div class="metric-field"><span class="metric-field-label">${activityName} · ${metric.label}</span><div class="unit-input"><input type="number" name="${fieldName}" step="${step}"${min}${max} placeholder="0"><span class="unit-badge">${metric.unit||''}</span></div></div>`;
}
function renderDailyCustomFields(){
  const c=$('#dailyCustomFields'); if(!c) return;
  const slots=(state.trainingSlots||[]).filter(Boolean);
  c.innerHTML=slots.map((name,i)=>{
    const a=findActivity(name);
    if(!a) return '';
    return (a.metrics||[]).slice().sort((x,y)=>x.order-y.order).map(met=>metricInputHTML(`skill_${i}_${met.key}`,a.name,met)).join('');
  }).join('');
}
function renderCombineSkillFields(slot,name){
  const c=$('#combineSkillFields_'+slot); if(!c) return;
  const a=name?findActivity(name):null;
  c.innerHTML=a?(a.metrics||[]).slice().sort((x,y)=>x.order-y.order).map(met=>metricInputHTML(`combineSkillMetric_${slot}_${met.key}`,a.name,met)).join(''):'';
}
function renderCombineCustomFields(){
  const c=$('#combineCustomFields'); if(!c || c.children.length) return;
  const opts='<option value="">— Select exercise —</option>'+allExerciseNames().map(n=>`<option value="${n}">${n}</option>`).join('');
  c.innerHTML=[0,1].map(i=>`<div class="combine-skill-block wide"><label>Extra Exercise ${i+1}<select name="combineSkillActivity_${i}" class="combine-skill-select" data-slot="${i}">${opts}</select></label><div id="combineSkillFields_${i}" class="combine-skill-fields"></div></div>`).join('');
}
document.addEventListener('click',e=>{
  const rpeBtn=e.target.closest('.rpe-btn');
  if(rpeBtn){
    const scale=rpeBtn.closest('.rpe-scale');
    scale.querySelector('input[type=hidden]').value=rpeBtn.dataset.value;
    scale.querySelectorAll('.rpe-btn').forEach(b=>b.classList.toggle('selected',b===rpeBtn));
  }
});
document.addEventListener('change',e=>{
  const sel=e.target.closest('.combine-skill-select');
  if(sel) renderCombineSkillFields(sel.dataset.slot,sel.value);
});
document.addEventListener('click',e=>{
  const addBtn=e.target.closest('.add-exercise-btn');
  if(addBtn && !addBtn.disabled) assignExercise(addBtn.dataset.exercise);
  const rmBtn=e.target.closest('.slot-remove');
  if(rmBtn) removeSlot(+rmBtn.dataset.slot);
  const viewBtn=e.target.closest('.view-activity-btn');
  if(viewBtn) renderActivityDetail(viewBtn.dataset.exercise);
  if(e.target.id==='closeActivityDetail' || e.target.id==='activityDetailModal') $('#activityDetailModal').classList.add('hidden');
});
function renderArcadeLeaderboard(){if(!$('#arcadeLeaderboard'))return;$('#arcadeLeaderboard').innerHTML=`<table class="table"><thead><tr><th>#</th><th>Athlete</th><th>Score</th></tr></thead><tbody>${[...demoAthletes].sort((a,b)=>b.arcade-a.arcade).map((a,i)=>`<tr><td>${i+1}</td><td>${a.name}</td><td>${a.arcade}</td></tr>`).join('')}</tbody></table>`}
function renderTeamEdition(){renderMission();renderLocker();renderLeaderboard();renderTeamFeed();renderShoutouts();renderExerciseLibrary();renderTrainingSlots();renderArcadeLeaderboard();ensureGameXPDay();if($('#gameXPToday'))$('#gameXPToday').textContent=state.gameXP.xp;if($('#reactionBest'))$('#reactionBest').textContent=state.gameScores?.reaction??'—';if($('#strikeBest'))$('#strikeBest').textContent=state.gameScores?.strike??0;if($('#homerBest'))$('#homerBest').textContent=state.gameScores?.homer??0;renderArcadeExtras()}
let reactionStart=0,reactionTimer=null;function startReactionGame(){$('#reactionResult').textContent='Get ready...';$('#reactionBall').classList.add('hidden');clearTimeout(reactionTimer);reactionTimer=setTimeout(()=>{const b=$('#reactionBall');b.style.left=(10+Math.random()*70)+'%';b.style.top=(18+Math.random()*55)+'%';b.classList.remove('hidden');reactionStart=performance.now();$('#reactionResult').textContent='TAP!'},800+Math.random()*1800)}function hitReactionBall(){const ms=Math.round(performance.now()-reactionStart);$('#reactionBall').classList.add('hidden');state.gameScores=state.gameScores||{};if(!state.gameScores.reaction||ms<state.gameScores.reaction)state.gameScores.reaction=ms;const e=awardGameXP(5);$('#reactionResult').textContent=`${ms} ms · +${e} XP`;save()}
let strikeTarget=0,strikeRound=0,strikeScore=0;function startStrikeGame(){strikeRound=1;strikeScore=0;nextStrike()}function nextStrike(){strikeTarget=1+Math.floor(Math.random()*9);const names={1:'High & Inside',2:'High Center',3:'High & Away',4:'Middle Inside',5:'Middle',6:'Middle Away',7:'Low & Inside',8:'Low Center',9:'Low & Away'};$('#strikePrompt').textContent=`Round ${strikeRound}/5: ${names[strikeTarget]}`}function chooseStrike(z){if(!strikeRound)return;if(z===strikeTarget){strikeScore+=100;$('#strikeResult').textContent='Correct! +100'}else $('#strikeResult').textContent='Missed. Keep learning the zone.';strikeRound++;if(strikeRound>5){state.gameScores=state.gameScores||{};state.gameScores.strike=Math.max(state.gameScores.strike||0,strikeScore);const e=awardGameXP(10);$('#strikePrompt').textContent=`Final Score: ${strikeScore} · +${e} XP`;strikeRound=0;save()}else nextStrike()}
let homerAnimation=null,homerStart=0,homerActive=false;function startHomerGame(){const ball=$('#timingBall');cancelAnimationFrame(homerAnimation);homerStart=performance.now();homerActive=true;function move(t){const pct=Math.min(100,((t-homerStart)/1800)*100);ball.style.left=pct+'%';if(pct<100&&homerActive)homerAnimation=requestAnimationFrame(move);else if(homerActive){$('#homerResult').textContent='Strike! Try again.';homerActive=false}}homerAnimation=requestAnimationFrame(move)}function swingHomer(){if(!homerActive)return;homerActive=false;cancelAnimationFrame(homerAnimation);const left=parseFloat($('#timingBall').style.left)||0;let score=0,msg='';if(left>=70&&left<=82){score=500;msg='HOME RUN!'}else if(left>=60&&left<=90){score=250;msg='Solid Contact!'}else{score=50;msg=left<60?'Early!':'Late!'}state.gameScores=state.gameScores||{};state.gameScores.homer=Math.max(state.gameScores.homer||0,score);const e=awardGameXP(score>=500?10:5);$('#homerResult').textContent=`${msg} ${score} points · +${e} XP`;save()}
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
  const seg=wheelSegments.length,cx=150,cy=150,r=145,anglePer=360/seg;
  const palette=['#00E5FF','#FF9A45','#FF2E9A','#39FF88','#1F7AE0','#FFC98B'];
  let shapes='';
  wheelSegments.forEach((val,i)=>{
    const start=i*anglePer-90-anglePer/2, end=start+anglePer;
    const x1=cx+r*Math.cos(start*Math.PI/180), y1=cy+r*Math.sin(start*Math.PI/180);
    const x2=cx+r*Math.cos(end*Math.PI/180), y2=cy+r*Math.sin(end*Math.PI/180);
    const color=val>=250?'#F9FF3D':palette[i%palette.length];
    shapes+=`<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 0 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${color}" stroke="#161616" stroke-width="2"/>`;
    const mid=start+anglePer/2;
    const lx=cx+(r*0.66)*Math.cos(mid*Math.PI/180), ly=cy+(r*0.66)*Math.sin(mid*Math.PI/180);
    shapes+=`<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" transform="rotate(${(mid+90).toFixed(2)},${lx.toFixed(2)},${ly.toFixed(2)})" text-anchor="middle" dominant-baseline="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="${val>=250?22:15}" fill="#161616">${val}</text>`;
  });
  return `<svg viewBox="0 0 300 300"><circle cx="150" cy="150" r="147" fill="#161616"/>${shapes}</svg>`;
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
  const idx=Math.floor(Math.random()*wheelSegments.length);
  const val=wheelSegments[idx];
  const anglePer=360/wheelSegments.length;
  const targetMod=(360-((idx*anglePer)%360))%360;
  const curMod=((wheelRotation%360)+360)%360;
  let delta=targetMod-curMod;
  if(delta<=0) delta+=360;
  wheelRotation+=6*360+delta;
  wheelEl.style.transform=`rotate(${wheelRotation}deg)`;
  const onDone=()=>{
    wheelEl.removeEventListener('transitionend',onDone);
    wheelSpinning=false;
    state.arcadeDaily.spinsUsed+=1;
    state.spinLog=state.spinLog||[];
    state.spinLog.push({date:todayISO(),xp:val});
    save();
    if($('#spinResult')) $('#spinResult').textContent=`🎉 You landed on +${val} XP!`;
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

function handlePhotoUpload(file){if(!file)return;const r=new FileReader();r.onload=()=>{localStorage.setItem('ethansBaseballHQ.profilePhoto',r.result);renderProfilePhoto()};r.readAsDataURL(file)}function renderProfilePhoto(){if(!$('#profilePhoto'))return;const saved=localStorage.getItem('ethansBaseballHQ.profilePhoto');if(saved){$('#profilePhoto').src=saved;$('#profilePhoto').classList.remove('hidden');$('#avatarFallback').classList.add('hidden')}else{$('#profilePhoto').classList.add('hidden');$('#avatarFallback').classList.remove('hidden')}}function randomAvatar(){const icon=avatarOptions[Math.floor(Math.random()*avatarOptions.length)];$('#avatarFallback').textContent=icon;$('#profilePhoto').classList.add('hidden');$('#avatarFallback').classList.remove('hidden');localStorage.removeItem('ethansBaseballHQ.profilePhoto')}

window.addEventListener('resize',renderCharts);render();renderTeamEdition();renderProfilePhoto();


if($('#completeMission'))$('#completeMission').onclick=completeDailyMission;
if($('#useRainToken'))$('#useRainToken').onclick=useRainToken;
if($('#leaderboardMetric'))$('#leaderboardMetric').onchange=renderLeaderboard;
if($('#libraryCategory'))$('#libraryCategory').onchange=renderExerciseLibrary;
if($('#addShoutout'))$('#addShoutout').onclick=addShoutout;
$$('.reaction-btn').forEach(b=>b.onclick=()=>{$('#reactionStatus').textContent=`${b.textContent} sent to the team feed.`;});
if($('#startReaction'))$('#startReaction').onclick=startReactionGame;
if($('#reactionBall'))$('#reactionBall').onclick=hitReactionBall;
if($('#startStrike'))$('#startStrike').onclick=startStrikeGame;
$$('#strikeZone button').forEach(b=>b.onclick=()=>chooseStrike(+b.dataset.zone));
if($('#startHomer'))$('#startHomer').onclick=startHomerGame;
if($('#swingButton'))$('#swingButton').onclick=swingHomer;
if($('#wheelInner'))$('#wheelInner').innerHTML=buildWheelSVG();
if($('#spinButton'))$('#spinButton').onclick=spinWheel;
if($('#photoUpload'))$('#photoUpload').onchange=e=>handlePhotoUpload(e.target.files[0]);
if($('#randomAvatar'))$('#randomAvatar').onclick=randomAvatar;
renderDailyCustomFields();
renderCombineCustomFields();

// Version 3.1 initial route
showModeNav('home');
$$('.screen').forEach(s=>s.classList.toggle('active',s.id==='home'));
