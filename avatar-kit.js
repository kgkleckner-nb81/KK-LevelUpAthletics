// Level Up Athletics — avatar kit and card compositor (proof of concept).
//
// Avatar: a stack of transparent 900x1200 layers rendered from the NORTH14
// Blender kit (assets/avatar-kit), stacked in a fixed order.
// Card: background, avatar (placed per frame), frame, name plate, then live
// text. Any background works with any frame because frames only have a
// see-through window; each frame carries its own avatar placement.
(function(){
  const W=900, H=1200;
  const AV_BASE='assets/avatar-kit/', CARD_BASE='assets/card-kit/';
  // Full-body reference extents inside a 900x1200 avatar layer (cap top to sole).
  const REF_TOP=44, REF_FEET=1010;

  // ---- Gear Locker catalog (proposal; nothing reads tier or xpCost yet) ----
  // tier and xpCost reuse the Locker's current ladder: Common 75, Uncommon 150,
  // Rare 250, Legendary 400. free marks the starter items every athlete owns.
  const BACKGROUNDS=[
    {id:'sandlot',name:'Sandlot',file:'bg_sandlot',tier:'Common',xpCost:75,free:true},
    {id:'stadium',name:'Baseball Stadium',file:'bg_stadium',tier:'Uncommon',xpCost:150},
    {id:'football',name:'Football Stadium',file:'bg_football',tier:'Uncommon',xpCost:150},
    {id:'concert',name:'Arena Concert',file:'bg_arena_concert',tier:'Rare',xpCost:250},
    {id:'laser',name:'Laser Arena',file:'bg_laser',tier:'Rare',xpCost:250},
    {id:'lava',name:'Hot Lava',file:'bg_lava',tier:'Legendary',xpCost:400}
  ];
  // A frame is a bundle: border artwork + matching name plate + type style +
  // where the avatar stands. Standard plates are separate images; Heritage
  // frames have the name area built in and carry their own text layout.
  const STD_PLACE={feet:90.5,top:22};
  const FRAMES=[
    {id:'sandlot',name:'Sandlot',collection:'Classic',type:'standard',file:'frame_sandlot',plate:'plate_sandlot',style:'sandlot',tier:'Common',xpCost:75,free:true,place:STD_PLACE},
    {id:'retro',name:'Retro All-Star',collection:'Classic',type:'standard',file:'frame_retro',plate:'plate_sandlot',style:'retro',tier:'Common',xpCost:75,place:STD_PLACE},
    {id:'platinum',name:'Platinum',collection:'Classic',type:'standard',file:'frame_platinum',plate:'plate_platinum',style:'platinum',tier:'Uncommon',xpCost:150,place:STD_PLACE},
    {id:'gold',name:'Gold',collection:'Classic',type:'standard',file:'frame_gold',plate:'plate_gold',style:'gold',tier:'Uncommon',xpCost:150,place:STD_PLACE},
    {id:'charged',name:'Charged Chrome',collection:'Classic',type:'standard',file:'frame_charged_chrome',plate:'plate_charged',style:'charged',tier:'Rare',xpCost:250,place:STD_PLACE},
    {id:'backstage',name:'Backstage Voltage',collection:'Classic',type:'standard',file:'frame_backstage',plate:'plate_backstage',style:'backstage',tier:'Rare',xpCost:250,place:STD_PLACE},
    {id:'magma',name:'Magma Forge',collection:'Classic',type:'standard',file:'frame_magma_forge',plate:'plate_magma',style:'magma',tier:'Legendary',xpCost:400,place:STD_PLACE},
    {id:'wood',name:'Woodgrain',collection:'Heritage',type:'heritage',file:'heritage_wood',tier:'Rare',xpCost:250,place:{feet:88,top:18},
      text:{family:'HeritageSlab',color:'#181310',x:57,y:90.6,w:64,size:6.5,rotation:0,stack:true,firstScale:0.7},
      extra:{kind:'initials',family:'HeritageSlab',color:'#181310',x:18,y:13,w:17,size:6}},
    {id:'signature',name:'Signature',collection:'Heritage',type:'heritage',file:'heritage_signature',tier:'Rare',xpCost:250,place:{feet:92,top:24},
      text:{family:'HeritageScript',color:'#fff7dc',x:53,y:8.3,w:74,size:11,rotation:-9,keepCase:true}},
    {id:'pennant',name:'Pennant',collection:'Heritage',type:'heritage',file:'heritage_pennant',tier:'Rare',xpCost:250,place:{feet:92,top:17},
      text:{family:'HeritageSlab',color:'#16120f',x:75,y:82,w:43,size:4.8,rotation:-42,stack:true,firstScale:0.85},
      extra:{kind:'team',family:'HeritageSlab',color:'#087ebc',x:50,y:12,w:82,size:11,outline:true}},
    {id:'foil',name:'Heirloom Foil',collection:'Heritage',type:'heritage',file:'heritage_foil',tier:'Legendary',xpCost:400,
      place:{bust:true,zoom:1.7,headTop:17.5},
      text:{family:'HeritageSerif',color:'#e7cf8b',x:50,y:71.8,w:58,size:4.5,rotation:0,weight:700}}
  ];
  const OPTIONS={palette:['A','B'],team:['green','blue'],outfit:['baseball','basketball']};
  const DEFAULT={palette:'A',team:'green',outfit:'baseball',cap:true,hair:true,bg:'stadium',frame:'platinum'};
  const bgOf=id=>BACKGROUNDS.find(b=>b.id===id)||BACKGROUNDS.find(b=>b.id===DEFAULT.bg);
  const frameOf=id=>FRAMES.find(f=>f.id===id)||FRAMES.find(f=>f.id===DEFAULT.frame);

  const cache={};
  function load(name,base){
    const key=base+name;
    if(!cache[key]) cache[key]=new Promise((res,rej)=>{
      const i=new Image(); i.onload=()=>res(i); i.onerror=()=>rej(new Error('missing '+key)); i.src=base+name+'.webp';
    });
    return cache[key];
  }
  function normalize(c){
    const o=Object.assign({},DEFAULT,c||{});
    ['palette','team','outfit'].forEach(k=>{ if(!OPTIONS[k].includes(o[k])) o[k]=DEFAULT[k]; });
    return {palette:o.palette,team:o.team,outfit:o.outfit,cap:!!o.cap,hair:!!o.hair,bg:bgOf(o.bg).id,frame:frameOf(o.frame).id};
  }
  // Avatar layers, bottom to top. Hair has two fits so it never pokes through the cap.
  function layersFor(c){
    c=normalize(c);
    const L=['body_'+c.palette,'shoes_'+c.team];
    if(c.outfit==='basketball') L.push('basketball_'+c.team);
    else L.push('bottom_baseball','top_baseball_'+c.team);
    if(c.hair) L.push('hair_'+c.palette+(c.cap?'_cap':'_classic'));
    if(c.cap) L.push('cap_'+c.team);
    return L;
  }
  async function compose(c){
    const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const g=cv.getContext('2d');
    const imgs=await Promise.all(layersFor(c).map(n=>load(n,AV_BASE)));
    imgs.forEach(i=>g.drawImage(i,0,0,W,H));
    return cv;
  }
  async function toDataURL(c){ return (await compose(c)).toDataURL('image/png'); }

  // Where the avatar goes inside a frame: scale and offset applied to the 900x1200 layer.
  function placement(frame){
    const p=frame.place;
    if(p.bust){ const s=p.zoom, topPx=p.headTop/100*H; return {s,x:W/2-W/2*s,y:topPx-REF_TOP*s,shadow:false}; }
    const feet=p.feet/100*H, top=p.top/100*H, s=(feet-top)/(REF_FEET-REF_TOP);
    return {s,x:W/2-W/2*s,y:top-REF_TOP*s,shadow:true,feetY:feet,halfW:(504*s)*0.34};
  }
  // Card image without text: background, avatar, frame, plate. Text is live HTML on top.
  async function composeCard(c){
    c=normalize(c);
    const bg=bgOf(c.bg), fr=frameOf(c.frame);
    const [bgImg,frImg,plImg,avatar]=await Promise.all([load(bg.file,CARD_BASE),load(fr.file,CARD_BASE),fr.plate?load(fr.plate,CARD_BASE):null,compose(c)]);
    const cv=document.createElement('canvas'); cv.width=W; cv.height=H; const g=cv.getContext('2d');
    g.drawImage(bgImg,0,0,W,H);
    const p=placement(fr);
    if(p.shadow){ // soft contact shadow so the feet read as standing on the ground
      g.save(); g.translate(W/2,p.feetY+4); g.scale(1,0.16);
      const r=p.halfW*1.6, grad=g.createRadialGradient(0,0,0,0,0,r);
      grad.addColorStop(0,'rgba(0,0,0,.6)'); grad.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle=grad; g.beginPath(); g.arc(0,0,r,0,Math.PI*2); g.fill(); g.restore();
    }
    g.drawImage(avatar,p.x,p.y,W*p.s,H*p.s);
    g.drawImage(frImg,0,0,W,H);
    if(plImg) g.drawImage(plImg,0,0,W,H);
    return cv;
  }
  async function cardDataURL(c){ return (await composeCard(c)).toDataURL('image/png'); }

  // ---- Live text on the card (position and size are percentages of the card) ----
  function fitLine(el,box,start,floor){
    let size=start; el.style.fontSize=size+'px';
    while(Array.from(el.children).some(l=>l.offsetWidth>el.clientWidth+1)&&size>floor){ size-=0.25; el.style.fontSize=size+'px'; }
  }
  function textBlock(layer,spec,value,pw){
    const el=document.createElement('div'); el.className='kit-text';
    const v=spec.keepCase?value:value.toUpperCase();
    const parts=spec.stack?v.trim().split(/\s+(.*)/s).filter(Boolean):[v];
    parts.forEach((p,i)=>{ const s=document.createElement('span'); s.textContent=p; s.style.display='block'; s.style.width='max-content'; s.style.margin='0 auto'; s.style.fontSize=(spec.stack&&parts.length>1&&i===0?spec.firstScale:1)+'em'; el.appendChild(s); });
    Object.assign(el.style,{left:spec.x+'%',top:spec.y+'%',width:spec.w+'%',fontFamily:spec.family,fontWeight:String(spec.weight||(spec.family==='HeritageSerif'?700:400)),color:spec.color,
      transform:`translate(-50%,-50%) rotate(${spec.rotation||0}deg)`});
    if(spec.outline) el.style.textShadow='1px 1px #111,-1px -1px #111,1px -1px #111,-1px 1px #111';
    layer.appendChild(el); fitLine(el,spec,pw*spec.size/100,pw*0.012);
    return el;
  }
  // layer: an absolutely positioned overlay the size of the card.
  const FONT_SPECS=['700 20px KitTeko','italic 900 20px KitRacing','400 20px KitPower','700 20px KitHand','400 20px KitRetro','400 20px HeritageSlab','400 20px HeritageScript','700 20px HeritageSerif'];
  let fontsReady=false, fontsWait=null;
  // Measure only once the card fonts are loaded; otherwise fallback-font widths make long names overflow.
  function layoutText(layer,c,name,teamText){
    if(!fontsReady && document.fonts && document.fonts.load){
      if(!fontsWait) fontsWait=Promise.all(FONT_SPECS.map(f=>document.fonts.load(f,'Aa'))).catch(()=>{}).then(()=>{fontsReady=true});
      fontsWait.then(()=>layoutText(layer,c,name,teamText));
    }
    c=normalize(c); const fr=frameOf(c.frame);
    layer.replaceChildren();
    const pw=layer.clientWidth||layer.parentElement.clientWidth||300;
    const nm=(name||'Athlete').trim()||'Athlete';
    if(fr.type==='standard'){
      const el=document.createElement('div'); el.className='kit-name'; el.dataset.style=fr.style; const t=document.createElement('span'); t.textContent=(fr.style==='sandlot'||fr.style==='retro')?nm:nm.toUpperCase(); el.appendChild(t);
      layer.appendChild(el);
      let size=pw*(fr.style==='sandlot'?0.107:0.095); el.style.fontSize=size+'px';
      const maxW=el.clientWidth*0.9; while(t.offsetWidth>maxW&&size>pw*0.02){ size-=0.25; el.style.fontSize=size+'px'; }
      return;
    }
    textBlock(layer,fr.text,nm,pw);
    if(fr.extra){
      if(fr.extra.kind==='initials'){
        const ini=nm.split(/\s+/).map(x=>x[0]||'').slice(0,2).join('').toUpperCase();
        textBlock(layer,{...fr.extra,keepCase:true},ini,pw);
      }else if(fr.extra.kind==='team'){
        textBlock(layer,fr.extra,(teamText||'ALL-STARS'),pw);
      }
    }
  }

  const key=id=>'lua.avatarKit.'+(id||'guest');
  function getSaved(id){ try{ const r=localStorage.getItem(key(id)); return r?normalize(JSON.parse(r)):null }catch(e){ return null } }
  function save(id,c){ try{ localStorage.setItem(key(id),JSON.stringify(normalize(c))); return true }catch(e){ return false } }
  function clear(id){ try{ localStorage.removeItem(key(id)) }catch(e){} }
  window.AvatarKit={OPTIONS,DEFAULT,BACKGROUNDS,FRAMES,bgOf,frameOf,normalize,layersFor,compose,toDataURL,composeCard,cardDataURL,layoutText,getSaved,save,clear,W,H};
})();
