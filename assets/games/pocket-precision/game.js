(()=>{'use strict';const $=s=>document.getElementById(s),c=$('game'),g=c.getContext('2d'),W=900,H=506;let run=new Pocket.Run(),paused=true,mode='intro',last=0,acc=0,drag=false,activePointer=null,feedbackUntil=0,best=0,muted=true,audio=null,runId='',ready=0;const art={};
try{best=Number(localStorage.getItem('lua-pocket-best')||0);}catch{}$('best').textContent=best;
for(const name of['field','quarterback']){const im=new Image();im.onload=()=>{if(++ready===2){$('start').disabled=false;$('start').textContent='TAKE THE FIELD →';}};im.onerror=()=>{$('modal-copy').textContent='Artwork could not load. Keep the assets folder with the game and reload.';};im.src=(window.PP_ASSETS||{})[name]||`assets/${name}.png`;art[name]=im;}
function text(s,x,y,size=20,color='#fff',align='center'){g.font=`600 ${size}px Teko`;g.textAlign=align;g.fillStyle=color;g.fillText(s,x,y);}
function box(x,y,w,h,fill,stroke){g.beginPath();g.roundRect(x,y,w,h,6);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=1.5;g.stroke();}}
function tone(freq){if(muted)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),v=audio.createGain();o.frequency.value=freq;v.gain.setValueAtTime(.07,audio.currentTime);v.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.2);o.connect(v);v.connect(audio.destination);o.start();o.stop(audio.currentTime+.2);}catch{}}
function feedback(s,color='#fff'){$('feedback').textContent=s;$('feedback').style.color=color;$('feedback').style.opacity=1;feedbackUntil=performance.now()+1400;}
function report(){if(run.reported)return;run.reported=true;const result={...run.result(),runId};window.dispatchEvent(new CustomEvent('lua:game-complete',{detail:result}));if(typeof window.onLevelUpGameComplete==='function'){try{window.onLevelUpGameComplete(result);}catch(e){console.error(e);}}}
function save(){best=Math.max(best,run.score);try{localStorage.setItem('lua-pocket-best',best);}catch{}$('best').textContent=best;}
function show(type){mode=type;paused=true;drag=false;activePointer=null;$('modal').hidden=false;$('finish').hidden=type!=='pause';$('modal-title').innerHTML=type==='pause'?'HUDDLE UP.':'ROUND COMPLETE.';$('modal-copy').textContent=type==='pause'?'Your targets and ball flight are paused.': 'Lead the ring, choose your power, and take another shot at your best.';$('summary').textContent=type==='over'?`${run.score} PTS · ${run.result().hits}/10 COMPLETE · ${run.result().perfects} PERFECT`:'';$('start').textContent=type==='pause'?'RESUME →':'PLAY AGAIN →';if(type==='over'){save();report();}}
function start(){run=new Pocket.Run();runId=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`;paused=false;drag=false;activePointer=null;$('modal').hidden=true;$('range').value=55;feedback('AIM YOUR PASS · CHOOSE LOFT OR BULLET');}
$('start').onclick=()=>{if(ready<2)return;if(mode==='pause'){paused=false;$('modal').hidden=true;}else start();};$('pause').onclick=()=>{if(mode==='intro'&&paused)return;if(run.state==='over')return;if(paused){paused=false;$('modal').hidden=true;}else show('pause');};$('finish').onclick=()=>{run.state='over';show('over');};$('sound').onclick=()=>{muted=!muted;$('sound').textContent=muted?'SOUND OFF':'SOUND ON';tone(500);};
function shoot(){if(paused||run.state!=='ready')return;drag=false;activePointer=null;run.throw();events();}
$('range').oninput=()=>{if(!paused&&run.state==='ready'&&!drag)run.power=+$('range').value;};
$('safe').onclick=()=>run.selectSafe(true);$('deep').onclick=()=>run.selectSafe(false);
function point(e){const r=c.getBoundingClientRect(),scale=Math.min(r.width/W,r.height/H);return{x:(e.clientX-r.left-(r.width-W*scale)/2)/scale,y:(e.clientY-r.top-(r.height-H*scale)/2)/scale};}
function aim(e){if(paused||run.state!=='ready')return;const p=point(e);if(p.x<0||p.x>W||p.y<0||p.y>H)return;run.aim=Pocket.unproject(p.x,p.y,run.target.z);}
c.onpointerdown=e=>{if(!e.isPrimary||e.button!==0||paused||run.state!=='ready')return;const p=point(e);if(p.x<0||p.x>W||p.y<0||p.y>H)return;e.preventDefault();drag=true;activePointer=e.pointerId;c.setPointerCapture(e.pointerId);aim(e);};
c.onpointermove=e=>{if(drag&&e.pointerId===activePointer)aim(e);};
c.onpointerup=e=>{if(!drag||e.pointerId!==activePointer)return;const p=point(e);if(p.x>=0&&p.x<=W&&p.y>=0&&p.y<=H){aim(e);shoot();}else{drag=false;activePointer=null;feedback('THROW CANCELLED');}};
c.onpointercancel=c.onlostpointercapture=()=>{drag=false;activePointer=null;};
window.addEventListener('keydown',e=>{if(e.code==='Escape'){$('pause').click();return;}if(e.target.tagName==='INPUT')return;if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();if(paused)return;if(e.code==='Space'&&!e.repeat)shoot();if(run.state==='ready'){if(e.code==='ArrowLeft')run.aim.x-=.25;if(e.code==='ArrowRight')run.aim.x+=.25;if(e.code==='ArrowUp')run.aim.h+=.15;if(e.code==='ArrowDown')run.aim.h-=.15;run.aim.x=Pocket.clamp(run.aim.x,-20,20);run.aim.h=Pocket.clamp(run.aim.h,.15,7);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!paused)show('pause');});
function events(){for(const e of run.events.splice(0)){if(e.type==='result'){feedback(e.hit?`${e.perfect?'PERFECT PASS':'COMPLETE'} · +${e.points}`:e.reason,e.hit?'#c4ff8d':'#ffd0c9');tone(e.hit?e.perfect?950:700:160);save();}if(e.type==='next')feedback(run.index===9?'FINAL THROW · CHOOSE YOUR RISK':`THROW ${run.index+1} · ${run.target.z} YARDS`);if(e.type==='over')show('over');}}
function drawRing(){const t=run.state==='result'&&run.impact?run.impact.ring:run.ring(),p=Pocket.project(t.x,t.z,t.h),ground=Pocket.project(t.x,t.z),r=t.r*70*p.s;const color=run.state==='result'?(run.results.at(-1).hit?'#b8ff72':'#ff867b'):'#ffce74';
g.save();g.strokeStyle='#06121aaa';g.lineWidth=6*p.s;g.beginPath();g.moveTo(p.x,ground.y);g.lineTo(p.x,p.y+r);g.stroke();g.fillStyle='#06121a55';g.beginPath();g.ellipse(p.x,ground.y,r*.8,r*.14,0,0,Math.PI*2);g.fill();
if(t.amp){const a=Pocket.project(t.base-t.amp,t.z),b=Pocket.project(t.base+t.amp,t.z);g.setLineDash([5,7]);g.strokeStyle='#e5faff66';g.lineWidth=1.5;g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();g.setLineDash([]);}
g.shadowColor='#071b26';g.shadowBlur=8;g.lineWidth=Math.max(4,10*p.s);g.strokeStyle='#533715';g.beginPath();g.arc(p.x+1,p.y+2,r,0,Math.PI*2);g.stroke();g.shadowBlur=0;g.strokeStyle=color;g.lineWidth=Math.max(3,7*p.s);g.beginPath();g.arc(p.x,p.y,r,0,Math.PI*2);g.stroke();g.lineWidth=1.2;g.strokeStyle='#fff6';g.setLineDash([3,4]);g.beginPath();g.arc(p.x,p.y,r*.32,0,Math.PI*2);g.stroke();g.setLineDash([]);
box(p.x-51,p.y-r-39,102,28,'#061b2dea',color);text(`${t.z} YD · ${t.value} PTS`,p.x,p.y-r-19,17,color);text(t.amp?(Math.cos(t.w*run.time+t.phase)>0?'MOVING →':'← MOVING'):'STATIONARY',p.x,ground.y+21,15,'#fff');g.restore();}
function football(p){
 const q=Pocket.project(p.x,p.z,Math.max(0,p.h)),r=Math.max(5,20*q.s),t=p.t||0;
 // The silhouette follows the trajectory; only surface markings roll around its long axis.
 const next=run.sample(t+.012),ahead=Pocket.project(next.x,next.z,next.h);
 const angle=Math.atan2(ahead.y-q.y,ahead.x-q.x),roll=t*Math.PI*2*7;
 g.save();g.translate(q.x,q.y);g.rotate(angle);
 const leather=g.createLinearGradient(0,-r*.6,0,r*.6);
 leather.addColorStop(0,'#e9a15b');leather.addColorStop(.35,'#a95829');leather.addColorStop(1,'#46200f');
 g.fillStyle=leather;g.strokeStyle='#f3c28c';g.lineWidth=Math.max(.8,1.3*q.s);
 g.beginPath();g.moveTo(-r,0);g.quadraticCurveTo(0,-r*1.2,r,0);g.quadraticCurveTo(0,r*1.2,-r,0);g.closePath();g.fill();g.stroke();g.clip();
 // Rotating longitudinal panel seams provide continuous axial motion.
 for(let panel=0;panel<4;panel++){
  const phase=roll+panel*Math.PI/2;if(Math.cos(phase)<=0)continue;
  g.strokeStyle='#4d230fcc';g.lineWidth=Math.max(.6,q.s);g.beginPath();
  for(let i=0;i<=20;i++){const u=-1+i/10,y=r*.6*(1-u*u)*Math.sin(phase);if(i===0)g.moveTo(u*r,y);else g.lineTo(u*r,y);}g.stroke();
 }
 // Laces disappear on the far side, then return, rather than tumbling end over end.
 if(Math.cos(roll)>0){
  const y=Math.sin(roll)*r*.51,span=Math.cos(roll)*r*.18;
  g.strokeStyle='#fff5dd';g.lineWidth=Math.max(.9,1.8*q.s);g.beginPath();g.moveTo(-r*.44,y);g.lineTo(r*.44,y);
  for(let i=-2;i<=2;i++){g.moveTo(i*r*.18,y-span);g.lineTo(i*r*.18,y+span);}g.stroke();
 }
 g.restore();
}
function drawQB(){let frame=0;if(drag&&run.state==='ready')frame=1;else if(run.state==='flight'||run.state==='result')frame=run.time-run.releaseAt<.19?2:3;const im=art.quarterback;if(im.naturalWidth)g.drawImage(im,frame*543,0,543,724,280,308,543*.255,724*.255);}
function guide(){if(run.state!=='ready'||paused)return;const t=run.target,p=Pocket.project(run.aim.x,t.z,run.aim.h);g.strokeStyle='#93eaff';g.lineWidth=1.6;g.beginPath();g.arc(p.x,p.y,8,0,Math.PI*2);g.moveTo(p.x-13,p.y);g.lineTo(p.x+13,p.y);g.moveTo(p.x,p.y-13);g.lineTo(p.x,p.y+13);g.stroke();const {vz,vh,arrival}=run.trajectory();g.fillStyle='#d8f7ff99';for(let i=1;i<=18;i++){const a=arrival*i/18,h=Pocket.START.h+vh*a-4.9*a*a;if(h<0)break;const q=Pocket.project(Pocket.START.x+(run.aim.x-Pocket.START.x)*i/18,vz*a,h);g.beginPath();g.arc(q.x,q.y,2,0,Math.PI*2);g.fill();}}
function drawImpact(){if(run.state!=='result'||!run.impact)return;const {p,ring,hit}=run.impact,q=Pocket.project(p.x,p.z,p.h),target=Pocket.project(ring.x,ring.z,ring.h);g.save();g.strokeStyle=hit?'#b8ff72':'#ff867b';g.lineWidth=2;g.setLineDash([4,4]);g.beginPath();g.moveTo(target.x,target.y);g.lineTo(q.x,q.y);g.stroke();g.setLineDash([]);g.beginPath();g.arc(q.x,q.y,7,0,Math.PI*2);g.moveTo(q.x-10,q.y);g.lineTo(q.x+10,q.y);g.moveTo(q.x,q.y-10);g.lineTo(q.x,q.y+10);g.stroke();text('PASS CROSSED HERE',q.x,q.y+26,15,hit?'#b8ff72':'#ffb0a4');g.restore();}
function render(){g.clearRect(0,0,W,H);if(art.field.naturalWidth)g.drawImage(art.field,0,0,W,H);g.fillStyle='#03122418';g.fillRect(0,0,W,H);if(run.ball&&run.ball.z>run.target.z)football(run.ball);drawRing();guide();drawQB();if(run.ball&&run.ball.z<=run.target.z)football(run.ball);drawImpact();}
function ui(){const t=run.target;$('round').textContent=`${Math.min(10,run.index+1)} / 10`;$('score').textContent=run.score;$('hits').textContent=run.result().hits;$('range-value').textContent=`${Math.round(run.power)}% · ${run.power<34?'LOFT':run.power<70?'DRIVE':'BULLET'}`;$('target-name').textContent=`${t.z} YD · ${t.amp?t.w>1.6?'FAST CROSSING':'MOVING':'STATIONARY'}`;$('value').textContent=`${t.value} POINTS + PERFECT BONUS`;$('size').textContent=t.r>=1.4?'WIDE OPENING':t.r>=1.15?'MEDIUM OPENING':'SMALL OPENING';$('choice').hidden=drag||run.index!==9||run.state!=='ready';$('safe').classList.toggle('selected',run.safe);$('deep').classList.toggle('selected',!run.safe);$('safe').textContent=`25 YD · ${Pocket.config(9,true).value} PTS`;$('deep').textContent=`50 YD · ${Pocket.config(9).value} PTS`;$('range').disabled=paused||drag||run.state!=='ready';$('aim-status').textContent=drag?'RELEASE TO THROW':run.state==='ready'?'DRAG ON THE FIELD TO AIM':'PASS IN FLIGHT / RESULT';
if(performance.now()>feedbackUntil)$('feedback').style.opacity=0;$('history').innerHTML=Array.from({length:10},(_,i)=>{const r=run.results[i];return `<span class="${r?r.hit?'hit':'miss':''}">${r?r.hit?'+'+r.points:'MISS':i+1}</span>`;}).join('');}
function loop(now){const dt=Math.min(.05,(now-last)/1000||0);last=now;if(!paused){acc+=dt;while(acc>=1/120){run.step(1/120);acc-=1/120;}events();}else acc=0;render();ui();requestAnimationFrame(loop);}requestAnimationFrame(loop);
if(new URLSearchParams(location.search).has('test'))window.PPTest={get run(){return run;},get paused(){return paused;},start,shoot,report,events,render};
})();
