(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Skyline=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const G=1080,W=600,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function platform(i){
    const y=650-i*155-Math.max(0,i-4)*4;
    return {i,base:i===0?165:(i%2?423:167),x:0,y,w:i===0?210:Math.max(92,184-i*5),amp:i<3?0:Math.min(60,16+(i-3)*5),speed:Math.min(2.8,.6+i*.095),phase:i*1.71,spring:i>0&&i%4===0};
  }
  class Run{
    constructor(){this.time=0;this.cleared=0;this.score=0;this.perfects=0;this.combo=0;this.bestCombo=0;this.lives=3;this.jumps=0;this.state='ready';this.endless=false;this.pads=Array.from({length:18},(_,i)=>platform(i));this.events=[];this.aim={vx:220,vy:-780};this.cooldown=0;this.timer=0;this.landedAt=0;this.maxHeight=0;this.dunkFlash=0;this.reported=false;this.place(0);this.recommend();}
    pad(i){while(i>=this.pads.length)this.pads.push(platform(this.pads.length));return this.pads[i];}
    pos(i,t=this.time){const p=this.pad(i);return {...p,x:p.base+Math.sin(t*p.speed+p.phase)*p.amp};}
    get target(){return this.pos(this.cleared+1);}
    get district(){return this.cleared<4?'STREET COURT':this.cleared<8?'ROOFTOP RUN':this.cleared<12?'SKYLINE FINALS':'OVERTIME';}
    wind(t=this.time){return this.cleared<7?0:Math.sin(t*.65)*Math.min(48,20+(this.cleared-7)*3);}
    place(i){const p=this.pos(i);this.p={x:p.x,y:p.y,vx:0,vy:0,pad:i,face:i%2? -1:1};this.state='ready';this.landedAt=this.time;this.timer=.17;}
    recommend(){const p=this.target,dy=this.p.y-p.y,vy=-780*(this.pad(this.p.pad??this.cleared).spring?1.08:1),disc=Math.max(0,vy*vy-2*G*dy),t=(-vy+Math.sqrt(disc))/G;this.aim={vx:clamp((p.base-this.p.x)/Math.max(.5,t),-440,440),vy:-780};}
    aimAt(vx,vy){this.aim={vx:clamp(vx,-460,460),vy:clamp(vy,-910,-580)};}
    launch(){if(this.state!=='ready')return false;const spring=this.pad(this.p.pad).spring;this.p.vx=this.aim.vx;this.p.vy=this.aim.vy*(spring?1.08:1);this.p.pad=null;this.p.face=this.p.vx<0?-1:1;this.state='flight';this.jumps++;this.flightStart=this.time;this.cooldown=0;this.events.push({type:'jump'});return true;}
    window(){if(this.state!=='flight')return null;const t=this.target,dx=this.p.x-t.x,dy=(this.p.y-117)-(t.y-135),range=Math.max(25,49-this.cleared*1.2),dist=Math.hypot(dx,dy*.85);return dist<range?{perfect:dist<range*.43,dist,range}:null;}
    dunk(){if(this.state!=='flight'||this.cooldown>0)return false;this.cooldown=.3;const win=this.window();if(!win){this.events.push({type:'early'});return false;}this.cleared++;this.combo=this.time-this.landedAt<5?this.combo+1:1;this.bestCombo=Math.max(this.bestCombo,this.combo);if(win.perfect)this.perfects++;const points=(win.perfect?180:100)+Math.min(this.combo,10)*25;this.score+=points;this.state='hang';this.timer=.48;this.p.vx=this.p.vy=0;this.p.pad=this.cleared;const t=this.pos(this.cleared);this.p.x=t.x;this.p.y=t.y-4;this.dunkFlash=1;this.events.push({type:'dunk',perfect:win.perfect,points});return true;}
    finish(){if(this.state==='over')return;this.state='over';this.events.push({type:'over'});}
    continue(){if(this.state!=='circuit')return;this.endless=true;this.place(this.cleared);this.recommend();}
    result(){return {gameId:'skyline-slam',version:'0.1.0',score:Math.round(clamp(this.cleared/12*70+this.perfects/12*30,0,100)),rawScore:this.score,hoopsCleared:this.cleared,perfectDunks:this.perfects,bestCombo:this.bestCombo,jumps:this.jumps,height:Math.floor(this.maxHeight/10),completed:this.cleared>=12};}
    step(dt){if(this.state==='over'||this.state==='circuit')return;this.time+=dt;this.cooldown=Math.max(0,this.cooldown-dt);this.dunkFlash=Math.max(0,this.dunkFlash-dt*2);this.timer=Math.max(0,this.timer-dt);
      if(this.state==='hang'){const p=this.pos(this.cleared);this.p.x=p.x;this.p.y=p.y-4;if(!this.timer){this.place(this.cleared);this.recommend();if(this.cleared===12&&!this.endless){this.state='circuit';this.events.push({type:'circuit'});}}return;}
      if(this.state==='respawn'){if(!this.timer){this.place(this.cleared);this.recommend();}return;}
      if(this.state==='ready'){const p=this.pos(this.p.pad);this.p.x=p.x;this.p.y=p.y;return;}
      const prev={x:this.p.x,y:this.p.y};this.p.vx+=this.wind()*dt;this.p.vy+=G*dt;this.p.x+=this.p.vx*dt;this.p.y+=this.p.vy*dt;
      if(this.p.x<24||this.p.x>W-24){this.p.x=clamp(this.p.x,24,W-24);this.p.vx*=-.45;}
      this.maxHeight=Math.max(this.maxHeight,650-this.p.y);
      // One-way pads catch a falling athlete, including lower recovery pads.
      if(this.p.vy>0){for(let i=this.cleared+1;i>=Math.max(0,this.cleared-2);i--){const q=this.pos(i);if(prev.y<=q.y&&this.p.y>=q.y&&Math.abs(this.p.x-q.x)<q.w/2+9){this.p.y=q.y;this.p.pad=i;this.state='ready';this.timer=.22;if(i<this.cleared){this.combo=0;this.events.push({type:'recover'});}else if(i>this.cleared)this.events.push({type:'retryDunk'});this.p.vx=this.p.vy=0;this.recommend();return;}}}
      const cutoff=this.pos(Math.max(0,this.cleared-1)).y+430;
      if(this.p.y>cutoff){this.lives--;this.combo=0;this.events.push({type:'fall'});if(!this.lives)this.finish();else{this.state='respawn';this.timer=.8;}}
    }
    preview(){const pts=[],p={x:this.p.x,y:this.p.y,vx:this.aim.vx,vy:this.aim.vy*(this.pad(this.p.pad??this.cleared).spring?1.08:1)};for(let i=0;i<45;i++){const dt=.033;p.vx+=this.wind(this.time+i*dt)*dt;p.vy+=G*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.x<24||p.x>W-24){p.x=clamp(p.x,24,W-24);p.vx*=-.45;}if(i%2===0)pts.push({...p});if(p.y>this.p.y+30)break;}return pts;}
  }
  return {Run,G,W,clamp};
});
