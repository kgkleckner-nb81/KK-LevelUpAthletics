(function(root,f){if(typeof module==='object')module.exports=f();else root.Turf=f();})(globalThis,()=>{
'use strict';const W=22,H=16,TUNNEL=7,D=[{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}],key=(x,y)=>y*W+x;
// Single-cell corridors on an original connected loop network.
const map=Array.from({length:H},()=>Array(W).fill(1));
const xs=[1,4,7,10,13,16,20],ys=[1,4,7,10,14];
for(const y of ys)for(let x=1;x<=20;x++)map[y][x]=0;
for(const x of xs)for(let y=1;y<=14;y++)map[y][x]=0;
// Close selected links to form varied islands without broad open patches.
for(const [x,y,w,h] of [[4,2,1,2],[13,2,1,2],[7,5,1,2],[16,5,1,2],[4,8,1,2],[13,8,1,2],[7,11,1,3],[16,11,1,3],[2,4,2,1],[11,4,2,1],[8,7,2,1],[17,10,3,1],[8,10,2,1]])
 for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)map[j][i]=1;
// Extra single-lane routes split the larger islands and add escape choices.
for(let x=1;x<=20;x++)map[12][x]=0;
for(let y=1;y<=7;y++)map[y][18]=0;
for(const [x,y] of [[4,2],[4,3],[13,8],[13,9],[8,7],[9,7]])map[y][x]=0;
map[TUNNEL][0]=map[TUNNEL][W-1]=0;
const walk=(x,y)=>y>=0&&y<H&&x>=0&&x<W&&!map[y][x];
function neighbor(x,y,d){let nx=x+D[d].x,ny=y+D[d].y;if(y===TUNNEL&&ny===TUNNEL)nx=(nx+W)%W;return walk(nx,ny)?{x:nx,y:ny}:null;}
const cells=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(walk(x,y))cells.push({x,y});
function nearest(x,y){return cells.reduce((a,b)=>Math.abs(b.x-x)+Math.abs(b.y-y)<Math.abs(a.x-x)+Math.abs(a.y-y)?b:a);}
function distances(goal){goal=nearest(goal.x,goal.y);let q=[goal],dist=new Map([[key(goal.x,goal.y),0]]);for(let i=0;i<q.length;i++){let p=q[i];for(let d=0;d<4;d++){let n=neighbor(p.x,p.y,d);if(n&&!dist.has(key(n.x,n.y))){dist.set(key(n.x,n.y),dist.get(key(p.x,p.y))+1);q.push(n);}}}return dist;}
function actor(x,y,dir=1){return{x,y,dir,to:null,p:0};}
function position(a){if(!a.to)return{x:a.x,y:a.y};let dx=a.to.x-a.x;if(Math.abs(dx)>1)dx=dx>0?-1:1;return{x:a.x+dx*a.p,y:a.y+(a.to.y-a.y)*a.p};}
class Game{
 constructor(){this.level=1;this.score=0;this.lives=3;this.time=0;this.charges=1;this.boost=0;this.invincible=0;this.state='ready';this.events=[];this.totalBalls=0;this.makeLevel();}
 makeLevel(){this.balls=new Set(cells.map(p=>key(p.x,p.y)));this.balls.delete(key(10,14));this.pickups=new Set([key(1,1),key(20,1),key(1,14),key(20,14)]);for(const k of this.pickups)this.balls.delete(k);this.bonus=null;this.bonusClock=10;this.resetActors();this.state='ready';this.timer=1.5;}
 resetActors(){this.player=actor(10,14,3);this.want=3;this.invincible=3;this.boost=0;this.enemies=[actor(10,1,2),actor(1,7,1),actor(20,7,3),actor(4,4,1),actor(16,10,3)].slice(0,this.level>=4?5:this.level>=2?4:3).map((a,i)=>({...a,type:i%3,stun:0,patrol:i}));}
 turn(d){if(Number.isInteger(d)&&d>=0&&d<4)this.want=d;}
 juke(){if(this.state!=='play'||this.charges<1||this.boost>0)return false;this.charges--;this.boost=1.65;this.events.push({type:'juke'});return true;}
 chooseEnemy(a){let p=position(this.player),target=p;const scatter=(this.time%19)<4;
 if(a.type===1){target={x:p.x+D[this.player.dir].x*3,y:p.y+D[this.player.dir].y*3};}
 if(a.type===2||scatter){const corners=[{x:1,y:1},{x:20,y:1},{x:20,y:14},{x:1,y:14}];target=corners[(a.patrol+a.type)%4];if(Math.abs(a.x-target.x)+Math.abs(a.y-target.y)<2)a.patrol++;if(a.type===2&&!scatter&&Math.hypot(p.x-a.x,p.y-a.y)<5)target=p;}
 const dist=distances(target),options=[];for(let d=0;d<4;d++){const n=neighbor(a.x,a.y,d);if(n)options.push({d,n});}const forward=options.filter(o=>o.d!==(a.dir+2)%4),choices=forward.length?forward:options;choices.sort((a,b)=>(dist.get(key(a.n.x,a.n.y))??999)-(dist.get(key(b.n.x,b.n.y))??999));return choices[0]?.d??a.dir;
 }
 move(a,amount,choose,onArrive){while(amount>0){if(!a.to){a.dir=choose(a);a.to=neighbor(a.x,a.y,a.dir);if(!a.to)return;}let step=Math.min(amount,1-a.p);a.p+=step;amount-=step;if(a.p>=1-1e-8){a.x=a.to.x;a.y=a.to.y;a.to=null;a.p=0;onArrive?.();if(this.state!=='play')return;}}}
 collect(){let k=key(this.player.x,this.player.y);if(this.balls.delete(k)){this.score+=10;this.totalBalls++;this.events.push({type:'ball',x:this.player.x,y:this.player.y});}if(this.pickups.delete(k)){this.charges=Math.min(3,this.charges+1);this.score+=50;this.events.push({type:'pickup'});}if(this.bonus&&k===key(this.bonus.x,this.bonus.y)){this.score+=this.bonus.points;this.events.push({type:'bonus',points:this.bonus.points});this.bonus=null;}if(!this.balls.size&&!this.pickups.size){this.score+=500*this.level;this.level++;this.state='level';this.timer=2.5;this.events.push({type:'level'});}}
 step(dt){if(this.state==='over')return;this.time+=dt;if(this.state!=='play'){this.timer-=dt;if(this.timer<=0){if(this.state==='level')this.makeLevel();else this.state='play';}return;}
 this.invincible=Math.max(0,this.invincible-dt);this.boost=Math.max(0,this.boost-dt);this.bonusClock-=dt;if(this.bonus){this.bonus.ttl-=dt;if(this.bonus.ttl<=0)this.bonus=null;}if(this.bonusClock<=0){const candidates=cells.filter(p=>p.x>0&&p.x<W-1&&Math.hypot(p.x-this.player.x,p.y-this.player.y)>6);const p=candidates[(this.level*37+Math.floor(this.time)*13)%candidates.length];this.bonus={...p,ttl:9,points:250+this.level*50};this.bonusClock=19;this.events.push({type:'bonusSpawn'});}
 const speed=Math.min(6.4,4.4+(this.level-1)*.15)*(this.boost>0?1.5:1);
 // Reversals remain responsive between junctions; other turns are buffered.
 if(this.player.to&&this.want===(this.player.dir+2)%4){let a=this.player,old={x:a.x,y:a.y};a.x=a.to.x;a.y=a.to.y;a.to=old;a.p=1-a.p;a.dir=this.want;}
 this.move(this.player,speed*dt,a=>neighbor(a.x,a.y,this.want)?this.want:a.dir,()=>this.collect());if(this.state!=='play')return;
 for(const e of this.enemies){if(e.stun>0){e.stun-=dt;continue;}this.move(e,Math.min(5.9,2.7+(this.level-1)*.3+e.type*.12)*dt,a=>this.chooseEnemy(a));let p=position(this.player),q=position(e),dx=Math.abs(p.x-q.x);if(Math.abs(p.y-TUNNEL)<.6&&Math.abs(q.y-TUNNEL)<.6)dx=Math.min(dx,W-dx);if(Math.hypot(dx,p.y-q.y)<.58){if(this.boost>0){e.stun=2;this.score+=100;this.events.push({type:'dodge'});}else if(!this.invincible){this.lives--;this.events.push({type:'tackle'});if(!this.lives){this.state='over';this.events.push({type:'over'});}else{this.resetActors();this.state='ready';this.timer=1.8;}return;}}}
 }
 result(){return{gameId:'turf-trouble',version:'0.1.0',rawScore:this.score,score:Math.min(100,Math.round(this.score/100)),level:this.level,balls:this.totalBalls,xpCap:25};}
}
return{W,H,TUNNEL,D,map,cells,walk,neighbor,distances,key,position,Game};
});
