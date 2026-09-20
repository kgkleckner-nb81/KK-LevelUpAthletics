'use strict';
(() => {
const $=id=>document.getElementById(id), canvas=$('game'), ctx=canvas.getContext('2d');
const VERSION='0.1.2', C={blue:'#00b5ff',green:'#b4f46b',red:'#ff707a',gold:'#ffcc65'};
const LANES=4;
function laneX(i){return W/H<.9?.22+.185*i:.14+.24*i;}
const mascots=['BRATWURST','POLISH','ITALIAN','HOT DOG','CHORIZO'];
const titles=['THE WARM-UP','DOUBLE PLAY','HOOP CHAOS','GRIDIRON MIX','SMALL BALL','ALL-SPORTS CIRCUS'];
// Source rectangles retain the approved artwork; Canvas draws each sprite directly.
const balls=[
 {name:'Baseball',sx:110,sy:180,sw:300,sh:300,size:22},
 {name:'Soccer',sx:1070,sy:116,sw:420,sh:420,size:34},
 {name:'Basketball',sx:492,sy:30,sw:530,sh:530,size:38},
 {name:'Football',sx:43,sy:567,sw:560,sh:400,size:38},
 {name:'Tennis',sx:680,sy:630,sw:290,sh:290,size:21},
 {name:'Volleyball',sx:1082,sy:556,sw:418,sh:418,size:33}
];
const art={}, reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let W=1200,H=720,scale=1,last=0,audio=null,sound=false,completion=null;
let state='loading',wave=1,lives=3,raw=0,combo=0,bestCombo=0,catchCount=0,misses=0,dodges=0;
let selectedBoost='shield';
let lane=1,playerX=laneX(1),stepDir=0,poseTime=0,pose='ready',elapsed=0,waveTime=0,nextSpawn=0,spawned=0,resolved=0;
let items=[],particles=[],floats=[],shield=false,slow=0,runId='',result=null,best=0,toastUntil=0,lastLane=-1,completed=false;
try{best=Number(localStorage.getItem('lua.dugout.best.v2'))||0;}catch{}
function config(n){return {count:Math.min(10+(n-1)*4,24),interval:Math.max(420,1100-(n-1)*120),flight:Math.max(1150,2100-(n-1)*140)*(1+slow),types:Math.min(n+1,6)};}
function resize(){const rect=canvas.getBoundingClientRect();W=rect.width;H=rect.height;scale=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*scale);canvas.height=Math.round(H*scale);ctx.setTransform(scale,0,0,scale,0,0);}
new ResizeObserver(resize).observe(canvas);
function announce(text){$('live').textContent=text;}
function toast(text,color=C.green){$('toast').textContent=text;$('toast').style.color=color;toastUntil=elapsed+1600;announce(text);}
function hud(){ $('wave').textContent=String(wave).padStart(2,'0');$('waveName').textContent=titles[Math.min(wave-1,5)];$('points').textContent=String(raw).padStart(4,'0');$('lives').textContent='● '.repeat(lives)+'○ '.repeat(3-lives);$('lives').setAttribute('aria-label',`${lives} chances remaining`);$('progress').style.width=(100*resolved/config(wave).count)+'%';document.querySelectorAll('[data-lane]').forEach(b=>b.classList.toggle('active',Number(b.dataset.lane)===lane));$('bank').disabled=!['play','paused','upgrade'].includes(state);$('pause').disabled=!['play','paused'].includes(state);$('pause').textContent=state==='paused'?'Resume':'Pause';}
function overlay(html){$('card').innerHTML=html;$('overlay').classList.remove('hidden');}
function hide(){ $('overlay').classList.add('hidden');canvas.focus({preventScroll:true});}
function menu(){state='menu';overlay(`<p class="eyebrow">LEVEL UP ATHLETICS / SURVIVAL ARCADE</p><h1>DUGOUT<br><em>DISASTER.</em></h1><p>The sausages have taken over the stadium.<br>Catch their sports balls. Stay out of trouble.</p><div class="rules"><div><b>01</b>MOVE BETWEEN<br>FOUR LANES</div><div><b>02</b>CATCH BALLS<br>AUTOMATICALLY</div><div><b>03</b>DODGE THE RED<br>X-MARKED HAZARDS</div></div><button class="primary" data-action="start">Enter the circus →</button><p class="minor">3 chances · Endless waves · Upgrades between waves<br>Touch: tap or drag a lane. Keyboard: ← →, A / D, or lane keys 1–4.</p>`);hud();}
function start(){runId=globalThis.crypto?.randomUUID?.()||`dugout-${Date.now()}`;wave=1;lives=3;raw=combo=bestCombo=catchCount=misses=dodges=elapsed=0;shield=false;slow=0;lane=1;playerX=laneX(1);items=[];particles=[];floats=[];result=null;completed=false;beginWave();}
function beginWave(){state='play';waveTime=0;nextSpawn=1100;spawned=resolved=0;lastLane=-1;pose='ready';poseTime=0;hide();toast(`${mascots[(wave-1)%5]} • ${wave===1?'CATCH EVERY BALL':`WAVE ${wave}`}`,C.blue);hud();}
function move(n){if(state!=='play')return;const next=Math.max(0,Math.min(LANES-1,n));stepDir=Math.sign(next-lane);lane=next;hud();}
function pause(){if(state==='play'){state='paused';overlay(`<p class="eyebrow">TAKE A BREATHER</p><h2>TIME OUT.</h2><p>Your wave is paused.</p><button class="primary" data-action="resume">Back to the circus →</button><button class="secondary" data-action="finish">End & score run</button>`);}else if(state==='paused'){state='play';hide();}hud();}
function waveEnd(){
 state='upgrade';items=[];combo=0;selectedBoost=shield?'none':'shield';
 const nextBall=balls[Math.min(wave+1,5)].name;
 overlay(`<p class="eyebrow">WAVE ${wave} COMPLETE</p><h2>READY FOR WAVE ${wave+1}?</h2>
 <p>${wave<5?`Next up: ${nextBall.toLowerCase()}s join the mix.`:'Next up: a faster all-sports wave.'}<br>You have ${lives} ${lives===1?'chance':'chances'} remaining.</p>
 <button class="primary" data-action="next">Play wave ${wave+1} →</button>
 <p class="minor">${shield?'Your unused shield carries forward.':'A free safety shield is selected for your next wave.'}</p>
 <details class="boost-options"><summary>Change boost (optional)</summary>
 <label for="boost">Next-wave boost</label><select id="boost">
 <option value="shield" ${selectedBoost==='shield'?'selected':''}>Safety shield · absorb one mistake</option>
 <option value="heart" ${lives===3?'disabled':''}>Second wind · restore one chance${lives===3?' (already full)':''}</option>
 <option value="slow" ${slow>=.35?'disabled':''}>Extra airtime · slower balls${slow>=.35?' (maximum reached)':''}</option>
 <option value="none" ${selectedBoost==='none'?'selected':''}>Keep current boosts</option></select></details>
 <button class="end-run-link" data-action="finish">End run & save ${raw} points</button>`);
 announce(`Wave ${wave} complete. Press Play wave ${wave+1} to continue. Upgrades are optional.`);hud();
}

function upgrade(kind){if(state!=='upgrade')return;if(kind==='shield')shield=true;if(kind==='heart')lives=Math.min(3,lives+1);if(kind==='slow')slow=Math.min(.35,slow+.1);wave++;beginWave();}
function rating(){const total=catchCount+misses+dodges;return total?Math.max(0,Math.min(100,Math.round(100*(catchCount+dodges)/total))):0;}
function finish(){if(completed||!['play','paused','upgrade'].includes(state))return;completed=true;state='results';best=Math.max(best,raw);try{localStorage.setItem('lua.dugout.best.v2',String(best));}catch{}result={gameId:'dugout-disaster',version:VERSION,scoreVersion:'survival-accuracy-v1',runId,score:rating(),maxScore:100,arcadePoints:raw,waveReached:wave,wavesCompleted:wave-(resolved===config(wave).count?0:1),catches:catchCount,dodges,misses,bestStreak:bestCombo,durationMs:Math.round(elapsed),authoritative:false};overlay(`<p class="eyebrow">RUN COMPLETE / PERSONAL BEST ${best}</p><h2>${lives?'A GOOD DAY AT THE CIRCUS.':'THE CIRCUS WINS. THIS TIME.'}</h2><div class="result">${raw}<small> PTS</small></div><div class="stats"><div><strong>${wave}</strong><small>WAVE REACHED</small></div><div><strong>${bestCombo}</strong><small>BEST STREAK</small></div><div><strong>${result.score}/100</strong><small>ACCURACY</small></div></div><p>${catchCount} catches · ${dodges} hazards avoided · ${misses} mistakes</p><button class="primary" data-action="start">Run it back →</button><p class="minor">Accuracy measures resolved catches and dodges.<br>Your arcade points reward longer survival.</p>`);hud();announce(`Run complete. ${raw} arcade points. Accuracy ${result.score} out of 100.`);const payload=structuredClone(result);queueMicrotask(()=>{try{completion?.(structuredClone(payload));}catch(e){console.error(e);}window.dispatchEvent(new CustomEvent('lua:game-complete',{detail:structuredClone(payload)}));if(parent!==window){try{const origin=new URL(window.LUA_PARENT_ORIGIN||document.referrer).origin;if(origin!=='null')parent.postMessage({type:'LUA_GAME_COMPLETE',detail:payload},origin);}catch{}}});}
function spawn(){
 const cfg=config(wave),i=spawned++;
 const routes=[[0,1,3,2,0,3,1,2],[3,1,0,2,3,0,2,1],[1,3,2,0,3,1,0,2]];
 const route=routes[(wave-1)%routes.length];
 // Hazard slots become denser quickly. Follow a catch with a hazard in that
 // same lane to require a dodge, rather than rewarding standing still.
 const hazard=wave===1?[3,6,8].includes(i):wave===2?i%3===2||i===4:i%5===1||i%5===3;
 const dest=hazard&&lastLane>=0?lastLane:route[i%route.length];
 const type=i%cfg.types;
 items.push({lane:dest,type,hazard,hazardKind:i%3,age:0,duration:cfg.flight,seed:i,done:false});
 lastLane=dest;
 if(hazard&&wave===1&&i===3)toast('RED X! SWITCH LANES.',C.red);
}

function tone(freq){if(!sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.setValueAtTime(freq,audio.currentTime);g.gain.setValueAtTime(.04,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.13);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.15);}catch{}}
function burst(x,y,color){for(let i=0;i<(reduced?5:20);i++)particles.push({x,y,vx:(Math.random()-.5)*180,vy:-Math.random()*170,life:650,color});}
function resolve(item){item.done=true;resolved++;const hit=Math.abs(playerX-laneX(item.lane))<.10;const good=item.hazard?!hit:hit;const x=laneX(item.lane)*W,y=H*.80;if(good){if(item.hazard){dodges++;raw+=35;floats.push({text:'DODGED +35',x,y,life:900,color:C.blue});tone(480);}else{catchCount++;combo++;bestCombo=Math.max(bestCombo,combo);const pts=100+Math.min(100,Math.floor(combo/5)*20);raw+=pts;pose='catch';poseTime=500;floats.push({text:`+${pts}${combo%5===0?' • '+combo+' STREAK':''}`,x,y,life:900,color:C.green});burst(x,y,C.green);tone(combo%5===0?900:660);}}else{misses++;combo=0;pose='duck';poseTime=500;if(shield){shield=false;toast('SHIELD SAVED YOU',C.blue);burst(x,y,C.blue);}else{lives--;toast(item.hazard?'HAZARD COLLISION!':'MISSED THE CATCH',C.red);burst(x,y,C.red);}tone(150);}hud();if(lives<=0)finish();}
function update(dt){if(state!=='play')return;elapsed+=dt;waveTime+=dt;const dest=laneX(lane);playerX+=(dest-playerX)*Math.min(1,dt/65);poseTime=Math.max(0,poseTime-dt);if(!poseTime)pose='ready';if(elapsed>toastUntil)$('toast').textContent='';if(spawned<config(wave).count&&waveTime>=nextSpawn){spawn();nextSpawn+=config(wave).interval;}for(const item of items){item.age+=dt;if(item.age>=item.duration&&!item.done){resolve(item);if(state!=='play')break;}}items=items.filter(i=>!i.done);particles.forEach(p=>{p.life-=dt;p.x+=p.vx*dt/1000;p.y+=p.vy*dt/1000;p.vy+=dt*.25;});particles=particles.filter(p=>p.life>0);floats.forEach(f=>{f.life-=dt;f.y-=dt*.035;});floats=floats.filter(f=>f.life>0);if(state==='play'&&spawned>=config(wave).count&&items.length===0)waveEnd();}
function line(x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function text(str,x,y,size,color='#fff'){ctx.fillStyle=color;ctx.font=`900 italic ${size}px Arial`;ctx.textAlign='center';ctx.fillText(str,x,y);}
function ballSprite(item,x,y,r){const b=balls[item.type];ctx.save();ctx.translate(x,y);ctx.rotate(reduced?0:Math.sin(item.age/330)*.3);ctx.drawImage(art.balls,b.sx,b.sy,b.sw,b.sh,-r,-r*b.sh/b.sw,2*r,2*r*b.sh/b.sw);ctx.restore();}
function hazard(x,y,r,kind=0){ctx.save();ctx.translate(x,y);ctx.shadowColor=C.red;ctx.shadowBlur=reduced?0:15;if(kind===1){
 ctx.fillStyle='#ff5c32';ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r*.8,r*.85);ctx.lineTo(-r*.8,r*.85);ctx.closePath();ctx.fill();
 ctx.fillStyle='#fff';ctx.fillRect(-r*.28,-r*.06,r*.56,r*.24);ctx.fillStyle='#d72c46';ctx.fillRect(-r,r*.78,r*2,r*.23);
 }else if(kind===2){
 ctx.fillStyle='#262a39';ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle=C.red;ctx.lineWidth=3;ctx.stroke();
 ctx.fillStyle='#080e18';for(const [dx,dy] of [[-.3,-.5],[.12,-.6],[.02,-.23]]){ctx.beginPath();ctx.arc(dx*r,dy*r,r*.12,0,Math.PI*2);ctx.fill();}
 }else{ctx.fillStyle='#f74d62';ctx.beginPath();ctx.moveTo(-r,-r*.6);ctx.lineTo(r,-r*.6);ctx.lineTo(r*.72,r);ctx.lineTo(-r*.72,r);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#fff';ctx.lineWidth=r*.22;for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(i*r*.53,-r*.5);ctx.lineTo(i*r*.4,r*.88);ctx.stroke();}ctx.fillStyle='#ffdf96';for(let i=0;i<7;i++){ctx.beginPath();ctx.arc(-r*.85+i*r*.28,-r*.7-Math.sin(i*2)*r*.15,r*.27,0,Math.PI*2);ctx.fill();}}ctx.shadowBlur=0;ctx.fillStyle='#bc1734';ctx.beginPath();ctx.arc(0,r*.1,r*.52,0,Math.PI*2);ctx.fill();text('×',0,r*.43,r,'#fff');ctx.restore();}
function mascot(){if(!art.mascots)return;const n=(wave-1)%5;const rects=[[0,10,354,850],[342,8,338,855],[675,0,356,860],[1020,0,370,845],[1384,0,390,868]];const [sx,sy,sw,sh]=rects[n];const h=Math.min(H*.23,W*.20),w=h*sw/sh;const x=W*.5,y=H*.465;ctx.fillStyle='#071423';ctx.fillRect(x-w*.7,y-2,w*1.4,7);line(x-w*.7,y-2,x+w*.7,y-2,C.blue,2);ctx.save();ctx.globalAlpha=.98;ctx.drawImage(art.mascots,sx,sy,sw,sh,x-w/2,y-h,w,h);ctx.restore();ctx.fillStyle='#071423d9';ctx.fillRect(x-58,y+3,116,17);text(mascots[n],x,y+15,10,C.gold);}
function launchX(i){return W/H<.9?(.17+.22*i)*W:(.29+.14*i)*W;}
function draw(){ctx.clearRect(0,0,W,H);if(!art.stadium){ctx.fillStyle='#0b1a2c';ctx.fillRect(0,0,W,H);return;}const bgScale=Math.max(W/1672,H/941), bgW=1672*bgScale;ctx.drawImage(art.stadium,(W-bgW)/2,0,bgW,941*bgScale);const shade=ctx.createLinearGradient(0,H*.5,0,H);shade.addColorStop(0,'#041b2900');shade.addColorStop(1,'#041b2980');ctx.fillStyle=shade;ctx.fillRect(0,H*.45,W,H*.55);
 for(let i=0;i<LANES;i++){const bottom=laneX(i)*W,top=launchX(i);ctx.fillStyle=i===lane?'#00b5ff13':'#ffffff04';ctx.beginPath();ctx.moveTo(top-30,H*.49);ctx.lineTo(top+30,H*.49);ctx.lineTo(bottom+W*.09,H*.94);ctx.lineTo(bottom-W*.09,H*.94);ctx.closePath();ctx.fill();line(top,H*.51,bottom,H*.89,'#ffffff20');ctx.strokeStyle=i===lane?C.blue:'#ffffff44';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(bottom,H*.87,W*.085,H*.015,0,0,Math.PI*2);ctx.stroke();}
 mascot();
 // Draw approaching objects in depth order, with low-opacity landing markers.
 for(const it of [...items].sort((a,b)=>a.age/a.duration-b.age/b.duration)){const p=Math.min(1,it.age/it.duration),d=p*p;const start=launchX(it.lane),end=laneX(it.lane)*W,x=start+(end-start)*d,y=H*(.49+.32*d)-Math.sin(p*Math.PI)*H*.09;const r=(8+(balls[it.type].size-8)*d)*Math.min(1,W/760);ctx.fillStyle=it.hazard?'#ff4e6260':'#b4f46b40';ctx.beginPath();ctx.ellipse(end,H*.87,18+12*d,4+3*d,0,0,Math.PI*2);ctx.fill();if(it.hazard)hazard(x,y,r*1.25,it.hazardKind);else ballSprite(it,x,y,r);}
 if(art.athlete){let frame=0;if(pose==='catch')frame=poseTime>330?3:poseTime>180?4:5;else if(pose==='duck')frame=6;else if(Math.abs(playerX-laneX(lane))>.006)frame=stepDir<0?1:2;else frame=Math.floor(elapsed/900)%2?7:0;const height=Math.min(H*.29,W*.40),width=height*.75;ctx.drawImage(art.athlete,(frame%4)*384,Math.floor(frame/4)*512,384,512,playerX*W-width/2,H*.945-height,width,height);if(shield){ctx.strokeStyle='#00b5ffbb';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(playerX*W,H*.80,width*.62,height*.53,0,0,Math.PI*2);ctx.stroke();}}
 for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/650);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,7);}ctx.globalAlpha=1;
 for(const f of floats){ctx.globalAlpha=Math.min(1,f.life/300);text(f.text,f.x,f.y,Math.max(14,W*.018),f.color);}ctx.globalAlpha=1;
}
function tick(now){const dt=Math.min(now-last||0,50);last=now;update(dt);draw();requestAnimationFrame(tick);}
function pointer(e){if(state!=='play')return;const r=canvas.getBoundingClientRect();move(Math.min(LANES-1,Math.floor((e.clientX-r.left)/r.width*LANES)));}
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointer(e);});canvas.addEventListener('pointermove',e=>{if(e.buttons||e.pointerType==='touch')pointer(e);});
document.querySelectorAll('[data-lane]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();move(Number(b.dataset.lane));}));
$('card').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const a=b.dataset.action;if(a==='start')start();else if(a==='resume')pause();else if(a==='finish')finish();else if(a==='next')upgrade(selectedBoost);});
$('card').addEventListener('change',e=>{if(state==='upgrade'&&e.target.id==='boost'&&['shield','heart','slow','none'].includes(e.target.value))selectedBoost=e.target.value;});
$('pause').onclick=()=>{pause();if(state==='play')canvas.focus({preventScroll:true});};$('bank').onclick=finish;$('sound').onclick=()=>{sound=!sound;$('sound').textContent=sound?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(sound));tone(600);if(state==='play')canvas.focus({preventScroll:true});};
window.addEventListener('keydown',e=>{if(e.target.tagName==='BUTTON'||e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='SUMMARY')return;if(['ArrowLeft','ArrowRight',' ','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();if(/^[1-4]$/.test(e.key))move(Number(e.key)-1);if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a')move(lane-1);if(e.key==='ArrowRight'||e.key.toLowerCase()==='d')move(lane+1);if(e.key.toLowerCase()==='p'||e.key==='Escape')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='play')pause();});window.addEventListener('blur',()=>{if(state==='play')pause();});
window.LUA_GAME={start:()=>{if(state!=='loading')start();},restart:()=>{if(state!=='loading')start();},getState:()=>({gameId:'dugout-disaster',version:VERSION,status:state,wave,lives,arcadePoints:raw,score:rating(),lane,catches:catchCount,misses,dodges,shield,slow,elapsedMs:Math.round(elapsed),result:result?structuredClone(result):null}),setCompletionHandler:fn=>{if(fn!==null&&typeof fn!=='function')throw new TypeError('Expected function or null');completion=fn;}};
overlay('<p class="eyebrow">OPENING THE GATES</p><h2>WELCOME TO THE CIRCUS.</h2><p id="loading">Loading stadium and athletes…</p>');
Promise.all(['stadium','balls','mascots','athlete'].map(name=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{art[name]=im;resolve();};im.onerror=()=>reject(new Error(name));im.src=`assets/${name}.png`;}))).then(menu).catch(error=>overlay(`<h2>ASSET COULD NOT LOAD</h2><p>Please reload the page. Missing asset: ${error.message}.</p><button class="primary" onclick="location.reload()">Reload</button>`));
resize();requestAnimationFrame(tick);
})();
