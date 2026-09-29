(function(root,f){if(typeof module==='object'&&module.exports)module.exports=f();else root.Pocket=f();})(globalThis,()=>{
'use strict';const G=9.8,START={x:-.625,h:2.3,z:0},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const levels=[{z:10,r:1.4,base:-4,amp:0,w:0},{z:20,r:1.5,base:3,amp:0,w:0},{z:30,r:1.6,base:-2,amp:0,w:0},{z:15,r:1.35,base:0,amp:6,w:1},{z:25,r:1.4,base:0,amp:8,w:1.25},{z:35,r:1.3,base:0,amp:9,w:1.5},{z:40,r:1.15,base:0,amp:10,w:1.6},{z:45,r:1.1,base:0,amp:11,w:1.8},{z:50,r:1.1,base:0,amp:11,w:2.1},{z:50,r:.95,base:0,amp:12,w:2.2}];
const value=c=>Math.round((40+c.z*2+(1.8-c.r)*80+c.amp*c.w*4)/10)*10;
function config(i,safe=false){const c=i===9&&safe?{z:25,r:1.5,base:0,amp:5,w:.8}:levels[i];return{...c,r:c.r*1.15,w:c.w*.85,h:2.3,phase:i*.67,value:value(c)};}
function project(x,z,h=0){const s=1/(1+.07*z);return{x:450+x*70*s,y:185+300/(1+.1*z)-h*70*s,s};}
function unproject(x,y,z){const s=1/(1+.07*z);return{x:clamp((x-450)/(70*s),-20,20),h:clamp((185+300/(1+.1*z)-y)/(70*s),.15,7)};}
class Run{
 constructor(){this.time=0;this.index=0;this.state='ready';this.safe=false;this.power=55;this.aim={x:0,h:2.3};this.results=[];this.ball=null;this.events=[];this.reported=false;this.timer=0;}
 get target(){return config(this.index,this.safe);}
 ring(t=this.time){const c=this.target;return{...c,x:c.base+c.amp*Math.sin(c.w*t+c.phase)};}
 get score(){return this.results.reduce((s,r)=>s+r.points,0);}
 selectSafe(safe){if(this.index===9&&this.state==='ready')this.safe=safe;}
 throw(){if(this.state!=='ready')return false;this.lock={aim:{...this.aim},power:this.power};this.release();return true;}
 trajectory(aim=this.aim,power=this.power){const vz=16+clamp(power,0,100)*.34,t=this.target.z/vz;return{vx:(aim.x-START.x)/t,vz,vh:(aim.h-START.h+.5*G*t*t)/t,arrival:t};}
 release(){const v=this.trajectory(this.lock.aim,this.lock.power);this.ball={...START,...v,t:0,crossed:false};this.state='flight';this.releaseAt=this.time;this.events.push({type:'release'});}
 sample(t){const b=this.ball;return{x:START.x+b.vx*t,z:b.vz*t,h:START.h+b.vh*t-.5*G*t*t};}
 resolve(hit,perfect,reason,miss){const c=this.target,points=hit?Math.round(c.value*(perfect?1.25:1)):0;this.results.push({throw:this.index+1,depth:c.z,value:c.value,points,hit,perfect,reason,miss,safe:this.safe});this.events.push({type:'result',hit,perfect,points,reason});this.state='result';this.timer=2.5;}
 next(){if(this.state!=='result')return;if(this.index===9){this.state='over';this.events.push({type:'over'});}else{this.index++;this.safe=false;this.ball=null;this.impact=null;this.state='ready';this.aim={x:0,h:2.3};this.events.push({type:'next'});}}
 step(dt){if(this.state==='over')return;this.time+=dt;if(this.state==='windup'){this.timer-=dt;if(this.timer<=0)this.release();return;}if(this.state==='result'){this.timer-=dt;if(this.ball&&this.timer>1){this.ball.t+=dt;Object.assign(this.ball,this.sample(this.ball.t));}if(this.timer<=0)this.next();return;}if(this.state!=='flight')return;const b=this.ball,prev=b.t;b.t+=dt;const crossing=this.target.z/b.vz;
  if(!b.crossed&&b.t>=crossing){b.crossed=true;const p=this.sample(crossing),ring=this.ring(this.releaseAt+crossing),distance=Math.hypot(p.x-ring.x,p.h-ring.h),hit=distance<=ring.r-.11,perfect=distance<ring.r*.32;this.impact={p,ring,hit};Object.assign(b,this.sample(b.t));this.resolve(hit,perfect,hit?(perfect?'PERFECT PASS':'THROUGH THE RING'):p.h<ring.h-ring.r?'LOW / SHORT':p.h>ring.h+ring.r?'HIGH / LONG':ring.amp?((p.x-ring.x)*Math.cos(ring.w*(this.releaseAt+crossing)+ring.phase)>0?'AHEAD OF TARGET':'BEHIND TARGET'):p.x<ring.x?'MISSED LEFT':'MISSED RIGHT',distance);return;}
  const p=this.sample(b.t);Object.assign(b,p);if(p.h<0){this.resolve(false,false,'SHORT OF THE RING',null);}
 }
 result(){const max=levels.reduce((s,_,i)=>s+Math.round(config(i).value*1.25),0);return{gameId:'pocket-precision',version:'0.1.0',score:Math.round(clamp(this.score/max*100,0,100)),rawScore:this.score,throws:this.results.length,hits:this.results.filter(r=>r.hit).length,perfects:this.results.filter(r=>r.perfect&&r.hit).length,completed:this.results.length===10,throwResults:this.results};}
}
return{Run,project,unproject,config,value,START,clamp};
});
