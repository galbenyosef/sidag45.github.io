/* Swipe detector — turns a stream of hand positions into LEFT / RIGHT / UP / DOWN flicks.
   · Distances are measured in hand-lengths, so it behaves the same close to or far from the camera.
   · A swipe is a quick flick from wherever the hand is: no centre box, no need to reach the frame edge.
   · Fires mid-motion as soon as distance + speed are met, for low latency.
   · The return stroke is ignored: a move that starts near where the last swipe ended and heads back toward where it began.
   · Slow repositioning never fires (it has to reach flick speed).
   update({t, x, y, size}) — t in seconds; x, y, size in the same aspect-corrected units (+x = user's right, +y = down).
   update(null) when the hand is lost. Returns {state, dir, progress, speed, swipe?}. */
(function(root){
 const DEFAULTS={dist:1.1,fireSpeed:7,startSpeed:3,stillSpeed:1.3,purity:1.4,maxDuration:.7,smoothing:.6,returnWindow:3};
 const OPP={LEFT:'RIGHT',RIGHT:'LEFT',UP:'DOWN',DOWN:'UP'};
 function createSwipeDetector(opts){
  const o=Object.assign({},DEFAULTS,opts||{});
  let stroke=null,hist=[],state='idle',origin=null,t0=0,peak=0,last=null,lastFire=null,sm=null,size=null,stillSince=0,coolStart=0;
  const classify=(dx,dy)=>{const ax=Math.abs(dx),ay=Math.abs(dy);return{dir:ax>=ay?(dx<0?'LEFT':'RIGHT'):(dy<0?'UP':'DOWN'),purity:Math.max(ax,ay)/(Math.min(ax,ay)+1e-6),dist:Math.hypot(dx,dy)}};
  const out=(st,c,speed)=>({state:st,dir:c?c.dir:null,progress:c?Math.min(1,c.dist/o.dist):0,speed:speed||0});
  const isReturn=(dir,t)=>{if(!lastFire||!stroke||dir!==OPP[lastFire.dir]||t-lastFire.t>o.returnWindow)return false;const ex=stroke.ex??last.x,ey=stroke.ey??last.y;return Math.hypot(origin.x-ex,origin.y-ey)<Math.hypot(origin.x-stroke.ox,origin.y-stroke.oy)};
  const ok=(c,minDist,k=1)=>c.dist>=minDist&&peak>=o.fireSpeed*k&&c.purity>=o.purity;
  function fire(c,t){state='cool';coolStart=t;lastFire={dir:c.dir,t};stroke={dir:c.dir,dist:c.dist,peak,ox:origin.x,oy:origin.y,done:false};
   const power=Math.round(Math.max(40,Math.min(100,45+(peak/o.fireSpeed-1)*45)));
   return{state:'fire',dir:c.dir,progress:1,speed:peak,swipe:{dir:c.dir,dist:c.dist,peak,power}}}
  function update(s){
   if(!s){ // hand lost — if it was mid-flick and nearly there, it probably swiped out of frame
    let ev=null;if(state==='track'&&last&&origin){const c=classify((last.x-origin.x)/size,(last.y-origin.y)/size);if(ok(c,o.dist*.45,.6)&&!isReturn(c.dir,last.t))ev=fire(c,last.t)}
    hist=[];sm=null;origin=null;last=null;stillSince=0;state='idle';return ev||out('lost')}
   size=size==null?s.size:size*.9+s.size*.1;
   sm=sm?{x:sm.x+(s.x-sm.x)*o.smoothing,y:sm.y+(s.y-sm.y)*o.smoothing}:{x:s.x,y:s.y};
   hist.push({x:sm.x,y:sm.y,t:s.t});while(hist.length>2&&s.t-hist[0].t>.6)hist.shift();
   const back=age=>{for(let i=hist.length-1;i>=0;i--)if(s.t-hist[i].t>=age)return hist[i];return hist[0]};
   const ref=back(.08),dtv=Math.max(1e-3,s.t-ref.t),speed=Math.hypot(sm.x-ref.x,sm.y-ref.y)/size/dtv;
   last={x:sm.x,y:sm.y,t:s.t};
   if(speed<o.stillSpeed){if(!stillSince)stillSince=s.t}else stillSince=0;
   const settled=stillSince&&s.t-stillSince>=.08;
   // Keep measuring the stroke after it fires, so calibration sees the full length and top speed.
   if(state==='cool'&&stroke&&!stroke.done){const along=stroke.dir==='LEFT'?stroke.ox-sm.x:stroke.dir==='RIGHT'?sm.x-stroke.ox:stroke.dir==='UP'?stroke.oy-sm.y:sm.y-stroke.oy;if(along/size>=stroke.dist){stroke.dist=along/size;stroke.ex=sm.x;stroke.ey=sm.y}stroke.peak=Math.max(stroke.peak,speed);if(settled||s.t-coolStart>.5)stroke.done=true}
   if(state==='cool'){if(settled||s.t-coolStart>o.maxDuration)state='idle';else return out('cool',null,speed)}
   if(state==='idle'){if(speed<o.startSpeed)return out('idle',null,speed);
    state='track';t0=s.t;peak=0;const org=back(.12);origin={x:org.x,y:org.y}}
   peak=Math.max(peak,speed);
   const c=classify((sm.x-origin.x)/size,(sm.y-origin.y)/size);
   if(ok(c,o.dist)){if(isReturn(c.dir,s.t)){state='cool';coolStart=s.t;return out('return',c,speed)}return fire(c,s.t)}
   if(s.t-t0>o.maxDuration||settled){state='idle';return out('idle',null,speed)}
   return out('track',c,speed)}
  return{update,set(p){Object.assign(o,p)},get options(){return Object.assign({},o)},get lastStroke(){return stroke},reset(){update(null);lastFire=null}};
 }
 root.createSwipeDetector=createSwipeDetector;createSwipeDetector.DEFAULTS=DEFAULTS;
 if(typeof module!=='undefined')module.exports=createSwipeDetector;
})(typeof window!=='undefined'?window:globalThis);
