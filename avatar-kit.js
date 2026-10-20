// Level Up Athletics — avatar kit compositor (proof of concept).
// The avatar is a stack of transparent 900x1200 layers rendered from the
// NORTH14 Blender kit (assets/avatar-kit). Every layer is rendered from the
// same camera and pose, so stacking them in a fixed order gives the full
// body. Choices are small whitelisted values, never free text.
(function(){
  const W=900, H=1200, BASE='assets/avatar-kit/';
  const OPTIONS={
    palette:['A','B'],            // A: light skin, brown hair, blue eyes. B: deep skin, black hair, green eyes.
    team:['green','blue'],        // jersey, cap and shoe colors
    outfit:['baseball','basketball']
  };
  const DEFAULT={palette:'A',team:'green',outfit:'baseball',cap:true,hair:true};
  const cache={};
  function load(name){
    if(!cache[name]) cache[name]=new Promise((res,rej)=>{
      const i=new Image(); i.onload=()=>res(i); i.onerror=()=>rej(new Error('missing layer '+name)); i.src=BASE+name+'.webp';
    });
    return cache[name];
  }
  function normalize(c){
    const o=Object.assign({},DEFAULT,c||{});
    ['palette','team','outfit'].forEach(k=>{ if(!OPTIONS[k].includes(o[k])) o[k]=DEFAULT[k]; });
    o.cap=!!o.cap; o.hair=!!o.hair;
    return {palette:o.palette,team:o.team,outfit:o.outfit,cap:o.cap,hair:o.hair};
  }
  // Bottom to top. Hair has two fits so it never pokes through the cap.
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
    const imgs=await Promise.all(layersFor(c).map(load));
    imgs.forEach(i=>g.drawImage(i,0,0,W,H));
    return cv;
  }
  async function toDataURL(c){ return (await compose(c)).toDataURL('image/png'); }
  const key=id=>'lua.avatarKit.'+(id||'guest');
  function getSaved(id){ try{ const r=localStorage.getItem(key(id)); return r?normalize(JSON.parse(r)):null }catch(e){ return null } }
  function save(id,c){ try{ localStorage.setItem(key(id),JSON.stringify(normalize(c))); return true }catch(e){ return false } }
  function clear(id){ try{ localStorage.removeItem(key(id)) }catch(e){} }
  window.AvatarKit={OPTIONS,DEFAULT,normalize,layersFor,compose,toDataURL,getSaved,save,clear,W,H};
})();
