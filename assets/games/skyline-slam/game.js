(()=>{'use strict';
const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d'),H=640;
let W=600;
const screenX=x=>x*W/600;
new ResizeObserver(()=>{const r=canvas.getBoundingClientRect();W=Math.round(H*r.width/r.height);canvas.width=W;canvas.height=H;}).observe(canvas);
canvas.height=H;
const colors={blue:'#00b5ff',gold:'#ffcc79',green:'#c4ff67',pink:'#ff79b0'};
const atlas=[[157,12,325,486],[660,56,244,444],[1087,8,291,487],[110,500,415,486],[661,509,250,490],[1115,595,324,399]];
let run=new Skyline.Run(),started=false,paused=true,mode='intro',camera=650-60-H*.52,drag=null,toastUntil=0,particles=[],best=0,last=0,acc=0,muted=true,audio=null,runId='';
try{best=Number(localStorage.getItem('lua-skyline-best')||0);}catch{}$('best').textContent=best.toLocaleString();
const art={};let loaded=0;$('modal-main').disabled=true;$('modal-main').textContent='LOADING COURT…';
for(const name of ['skyline','athlete-poses']){const im=new Image();im.onload=()=>{loaded++;if(loaded===2){$('modal-main').disabled=false;$('modal-main').textContent='LET’S PLAY →';}};im.onerror=()=>{$('modal-text').textContent='An artwork file could not load. Keep the assets folder next to index.html, then reload.';$('modal-main').disabled=true;};im.src=(window.SS_ASSETS||{})[name]||`assets/${name}.png`;art[name]=im;}
function text(s,x,y,size=18,color='#fff',align='center'){ctx.font=`600 ${size}px Teko, sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(s,x,y);}
function round(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}}
function beep(freq=500,duration=.1){if(muted)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*1.45,audio.currentTime+duration);g.gain.setValueAtTime(.08,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch{}}
function toast(s){$('toast').textContent=s;$('toast').style.opacity=1;toastUntil=performance.now()+1900;}
function syncAim(){$('aim').value=run.aim.vx;$('lift').value=-run.aim.vy;}
function report(){if(run.reported)return;run.reported=true;const r={...run.result(),runId};window.dispatchEvent(new CustomEvent('lua:game-complete',{detail:r}));if(typeof window.onLevelUpGameComplete==='function'){try{window.onLevelUpGameComplete(r);}catch(e){console.error('Host score callback failed',e);}}}
function saveBest(){if(run.score>best){best=run.score;try{localStorage.setItem('lua-skyline-best',best);}catch{}}$('best').textContent=best.toLocaleString();}
function show(which){mode=which;paused=true;drag=null;$('modal').hidden=false;const conf={intro:['OWN THE SKY.','Drag up and toward the next hoop to jump. Tap when the rim lights green to slam. Land, breathe, then climb again.','LET’S PLAY →',null],pause:['TAKE A BREATHER.','Your climb is paused. Pick up exactly where you left off.','RESUME →','FINISH RUN'],over:['GOOD RUN.','Every climb teaches you the timing. Take another shot at your personal best.','PLAY AGAIN →',null],circuit:['SKYLINE CLEARED.','All 12 hoops are yours. Keep climbing in Overtime with smaller ledges and faster moving hoops.','KEEP CLIMBING →','FINISH RUN']}[which];$('modal-title').textContent=conf[0];$('modal-text').textContent=conf[1];$('modal-main').textContent=conf[2];$('modal-secondary').textContent=conf[3]||'';$('modal-secondary').hidden=!conf[3];$('modal-stats').textContent=['over','circuit'].includes(which)?`${run.score.toLocaleString()} PTS · ${run.cleared} HOOPS · ${run.result().height} M`:'';$('pause').textContent='PAUSE';if(which==='over'){saveBest();report();}}
function start(){run=new Skyline.Run();runId=typeof crypto.randomUUID==='function'?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;started=true;paused=false;camera=run.p.y-60-H*.52;particles=[];drag=null;syncAim();$('modal').hidden=true;toast('DRAG UP TO JUMP · TAP GREEN TO DUNK');}
$('modal-main').onclick=()=>{if(loaded<2)return;if(mode==='intro'||mode==='over')start();else if(mode==='circuit'){run.continue();paused=false;$('modal').hidden=true;syncAim();toast('OVERTIME · THE CLIMB CONTINUES');}else{paused=false;$('modal').hidden=true;}canvas.focus({preventScroll:true});};
$('modal-secondary').onclick=()=>{run.finish();show('over');};
$('pause').onclick=()=>{if(!started||run.state==='over'||run.state==='circuit')return;if(paused){paused=false;$('modal').hidden=true;}else show('pause');};
$('finish').onclick=()=>{if(!started)return;run.finish();show('over');};
$('sound').onclick=()=>{muted=!muted;$('sound').textContent=muted?'SOUND OFF':'SOUND ON';$('sound').setAttribute('aria-label',muted?'Enable sound':'Mute sound');beep(550);};
$('aim').oninput=$('lift').oninput=()=>{run.aimAt(+$('aim').value,-$('lift').value);};
function action(){if(paused||!started)return;if(run.state==='ready'){run.launch();beep(250);}else if(run.state==='flight'){run.dunk();}events();}
$('action').onclick=action;
function coords(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*600/r.width,y:(e.clientY-r.top)*H/r.height};}
canvas.addEventListener('pointerdown',e=>{if(paused)return;e.preventDefault();canvas.focus({preventScroll:true});if(run.state==='flight'){action();return;}if(run.state==='ready'){const p=coords(e);drag={start:p,end:p};canvas.setPointerCapture(e.pointerId);}});
canvas.addEventListener('pointermove',e=>{if(!drag)return;drag.end=coords(e);const dx=drag.end.x-drag.start.x,dy=drag.end.y-drag.start.y;if(Math.hypot(dx,dy)>8){run.aimAt(dx*3.2,-580-Math.max(0,-dy)*2.2);syncAim();}});
canvas.addEventListener('pointerup',e=>{if(!drag)return;drag=null;action();});canvas.addEventListener('pointercancel',()=>{drag=null;});
window.addEventListener('keydown',e=>{if(e.code==='Escape'){e.preventDefault();$('pause').click();return;}if(e.target.tagName==='INPUT')return;if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();if(e.repeat&&e.code==='Space')return;if(e.code==='Space'){if(!paused)action();}else if(!paused&&run.state==='ready'){const {vx,vy}=run.aim;if(e.code==='ArrowLeft')run.aimAt(vx-15,vy);if(e.code==='ArrowRight')run.aimAt(vx+15,vy);if(e.code==='ArrowUp')run.aimAt(vx,vy-15);if(e.code==='ArrowDown')run.aimAt(vx,vy+15);syncAim();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!paused&&run.state!=='over')show('pause');});
function burst(x,y,perfect){for(let i=0;i<32;i++)particles.push({x,y,vx:(Math.random()-.5)*360,vy:-Math.random()*240,life:.8+Math.random()*.4,color:perfect?colors.green:i%2?colors.blue:colors.gold});}
function events(){for(const e of run.events.splice(0)){if(e.type==='dunk'){toast(e.perfect?`PERFECT SLAM! +${e.points}`:`SLAM! +${e.points}`);burst(run.p.x,run.pos(run.cleared).y-135,e.perfect);beep(e.perfect?950:650,.18);saveBest();}if(e.type==='early')toast('NOT YET — GET CLOSER TO THE RIM');if(e.type==='recover')toast('NICE SAVE · CLIMB BACK UP');if(e.type==='retryDunk')toast('SAFE LANDING · JUMP AGAIN TO SLAM');if(e.type==='fall'){toast(run.lives?'MISSED IT · BACK TO YOUR LAST HOOP':'LAST CHANCE USED');beep(130,.18);}if(e.type==='over')show('over');if(e.type==='circuit')show('circuit');}syncAim();}
function drawBackground(){const im=art.skyline;if(im.complete&&im.naturalWidth){const scale=Math.max(W/im.width,H/im.height)*1.2,sw=im.width*scale,sh=im.height*scale;ctx.drawImage(im,(W-sw)/2,(H-sh)/2+Skyline.clamp(-camera*.07,-55,55),sw,sh);}else{ctx.fillStyle='#123050';ctx.fillRect(0,0,W,H);}const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#06112633');g.addColorStop(.45,'#06112644');g.addColorStop(1,'#020919a0');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  const offset=(-camera*.14)%120;ctx.strokeStyle='#d2e9ff16';ctx.lineWidth=1;for(let y=offset;y<H;y+=120){ctx.beginPath();ctx.moveTo(12,y);ctx.lineTo(24,y);ctx.stroke();}text(`${Math.floor(run.maxHeight/10)} M`,W-22,32,20,'#d5e8ff','right');
}
function drawPad(p){p={...p,x:screenX(p.x),w:screenX(p.w)};const y=p.y-camera;if(y<-50||y>H+100)return;const active=p.i===run.cleared+1,done=p.i<=run.cleared,future=p.i>run.cleared+1;ctx.save();ctx.globalAlpha=future?.28:1;const left=p.x-p.w/2;
  ctx.strokeStyle='#7395ba32';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x<W/2?0:W,y+66);ctx.lineTo(p.x,y+15);ctx.stroke();
  if(p.spring){ctx.strokeStyle=colors.gold;ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<9;i++){const x=left+15+i*(p.w-30)/8;ctx.lineTo(x,y+16+(i%2)*12);}ctx.stroke();}
  const g=ctx.createLinearGradient(0,y,0,y+23);g.addColorStop(0,'#31567a');g.addColorStop(1,'#0b182c');round(left,y,p.w,21,5,g,'#6091b9');round(left,y-4,p.w,6,3,p.spring?colors.gold:active?colors.blue:'#92c7e8');
  for(let i=0;i<4;i++){round(left+14+i*(p.w-35)/4,y+8,10,3,1,'#00b5ff66');}
  if(p.i===0){text('STREET LEVEL',p.x,y+44,17,'#b8d7f2');ctx.restore();return;}
  const rimY=y-135,win=active?run.window():null,c=win?colors.green:active?colors.gold:'#7192ac';
  // Glass backboard and separate rim/net stay attached to the moving ledge.
  ctx.strokeStyle='#2b5072';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(p.x+59,y);ctx.lineTo(p.x+59,rimY-36);ctx.stroke();
  round(p.x+27,rimY-64,62,76,5,'#a7daff1a',c);round(p.x+37,rimY-35,32,27,2,null,'#e6f5ff99');
  ctx.strokeStyle='#e1efffb3';ctx.lineWidth=1.5;for(let j=-2;j<=2;j++){ctx.beginPath();ctx.moveTo(p.x+j*13,rimY+4);ctx.lineTo(p.x+j*8,rimY+38);ctx.stroke();}ctx.beginPath();ctx.ellipse(p.x,rimY+36,17,4,0,0,Math.PI*2);ctx.stroke();
  ctx.shadowColor=c;ctx.shadowBlur=win?24:active?9:0;ctx.strokeStyle=c;ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(p.x,rimY,34,9,0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
  if(active){round(p.x-40,rimY-67,80,25,6,win?'#3a5c1a':'#091526e6',c);text(win?'DUNK!':`HOOP ${p.i}`,p.x,rimY-49,18,win?colors.green:colors.gold);if(p.amp>0){text('↔',p.x,rimY+66,22,'#d3e6f8');}}
  else if(done){text('✓',p.x,rimY-25,22,'#8dd3c7');}
  ctx.restore();
}
function drawAthlete(){if(run.state==='respawn')return;const p=run.p;let pose=0;if(run.state==='hang')pose=4;else if(run.state==='flight')pose=(run.window()||p.vy>0)?3:2;else if(drag)pose=1;else if(run.timer>0)pose=5;const [sx,sy,sw,sh]=atlas[pose],s=.27,ww=sw*s,hh=sh*s;let px=screenX(p.x),py=p.y-camera;if(pose===4)py=run.pos(run.cleared).y-camera-135+hh;
  if(run.state==='ready'){ctx.fillStyle='#02091c66';ctx.beginPath();ctx.ellipse(px,py,36,5,0,0,Math.PI*2);ctx.fill();}
  ctx.save();ctx.translate(px,py);ctx.scale(p.face<0?-1:1,1);if(art['athlete-poses'].complete&&art['athlete-poses'].naturalWidth)ctx.drawImage(art['athlete-poses'],sx,sy,sw,sh,-ww/2,-hh,ww,hh);ctx.restore();
  if(run.state==='flight'){ctx.fillStyle='#00b5ff55';for(let i=1;i<4;i++){ctx.beginPath();ctx.arc(px-screenX(p.vx)*.018*i,py-10-p.vy*.014*i,Math.max(1,5-i),0,Math.PI*2);ctx.fill();}}
}
function render(){ctx.clearRect(0,0,W,H);drawBackground();for(let i=Math.max(0,run.cleared-2);i<=run.cleared+3;i++)drawPad(run.pos(i));
  if(run.state==='ready'&&started&&!paused){const points=run.preview();for(let i=0;i<points.length;i++){const p=points[i];ctx.fillStyle=`rgba(183,232,255,${.85-i/points.length*.7})`;ctx.beginPath();ctx.arc(screenX(p.x),p.y-camera-12,3.5-i/points.length*1.5,0,Math.PI*2);ctx.fill();}}
  drawAthlete();for(const p of particles){ctx.globalAlpha=Math.min(1,p.life);ctx.fillStyle=p.color;ctx.fillRect(screenX(p.x),p.y-camera,5,5);}ctx.globalAlpha=1;
  if(run.cleared>=7){round(16,14,116,29,8,'#06152ac9');text(`${run.wind()<0?'←':'→'} WIND ${Math.round(Math.abs(run.wind()))}`,74,35,18,'#b9daf3');}
  if(drag){ctx.strokeStyle='#c4ff67aa';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(screenX(drag.start.x),drag.start.y);ctx.lineTo(screenX(drag.end.x),drag.end.y);ctx.stroke();}
}
function ui(){const t=run.target;const win=run.window();$('score').textContent=run.score.toLocaleString();$('hoops').textContent=run.endless?run.cleared:`${run.cleared} / 12`;$('combo').textContent=`×${run.combo}`;$('lives').textContent='● '.repeat(run.lives)+'○ '.repeat(3-run.lives);$('district').textContent=run.district;$('progress').style.width=`${Math.min(100,run.cleared/12*100)}%`;$('challenge').textContent=run.cleared<2?'Find your arc. The first two hoops hold still.':run.cleared<4?'Read the moving ledge. Aim ahead of the rim.':run.cleared<7?'Gold ledges boost your next jump. Plan for the extra lift.':run.cleared<12?'Watch the wind. Smaller ledges reward a precise approach.':'Keep climbing. Each new hoop adds to your score.';
  $('action').textContent=run.state==='flight'?(win?'DUNK NOW!':'DUNK'):run.state==='hang'?'SLAM!':'JUMP ↑';$('action').classList.toggle('hot',!!win);$('action').disabled=paused||!['ready','flight'].includes(run.state);$('aim').disabled=$('lift').disabled=paused||run.state!=='ready';$('hint').textContent=run.state==='flight'?'Tap DUNK when the rim turns green. Centered timing earns PERFECT.':run.state==='ready'?(run.pad(run.p.pad).spring?'SPRING LEDGE · Your next jump gets extra lift.':'Drag upward toward the hoop and release · Or adjust AIM / LIFT and press JUMP'):'Land, reset, and climb again.';if(performance.now()>toastUntil)$('toast').style.opacity=0;}
function followCamera(dt){
  // Track actual body position every frame, including descents and recovery ledges.
  camera=run.p.y-60-H*.52;
}
function loop(now){const dt=Math.min(.05,(now-last)/1000||0);last=now;if(!paused){acc+=dt;while(acc>=1/120){run.step(1/120);acc-=1/120;}events();followCamera(dt);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=400*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);}else acc=0;render();ui();requestAnimationFrame(loop);}syncAim();requestAnimationFrame(loop);
if(new URLSearchParams(location.search).has('test'))window.SSTest={get run(){return run;},get camera(){return camera;},followCamera,start,action,step(n=1){for(let i=0;i<n;i++)run.step(1/120);events();},get paused(){return paused;},render,report,show};
})();
