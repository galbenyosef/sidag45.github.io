/* Halden & Vey Pegasus-1 Squelette: scroll-driven exploded watch (fictional brand). Requires three.js r147 and RoundedBoxGeometry (loaded in index.html). */
(function(){
"use strict";
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI*2;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;

const SPLIT_W=1180; // phones and tablets use the split layout: watch in the top half, text in the bottom half
/* ---------- renderer ---------- */
const canvas=document.getElementById('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.18;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.VSMShadowMap; // blurred shadows, like a softbox rather than a bare bulb
renderer.setClearColor(0x000000,0);

const scene=new THREE.Scene();
/* Product-photography studio, used only for reflections: a dim room with softboxes and strip lights.
   Polished steel reads as real when it mirrors crisp, high-contrast light shapes. */
function studio(){
  const st=new THREE.Scene();
  const room=new THREE.Mesh(new THREE.SphereGeometry(100,48,24),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,
    vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec3 vP;void main(){float h=normalize(vP).y;vec3 top=vec3(.42,.44,.48),mid=vec3(.10,.11,.13),bot=vec3(.03,.03,.035);vec3 c=h>0.?mix(mid,top,smoothstep(0.,1.,h)):mix(mid,bot,smoothstep(0.,-.6,h));gl_FragColor=vec4(c,1.);}'
  }));
  st.add(room);
  const panel=(w,h,i,x,y,z,tint=[1,1,1])=>{
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(i*tint[0],i*tint[1],i*tint[2]),side:THREE.DoubleSide}));
    m.position.set(x,y,z);m.lookAt(0,0,0);st.add(m);
  };
  panel(70,26,7,0,70,8);            // overhead softbox
  panel(10,60,9,-62,18,24);         // left strip
  panel(10,60,6,60,14,-30);         // right strip
  panel(46,22,3.2,10,22,64);        // front fill
  panel(60,6,4,-20,-14,-58,[.85,.92,1.1]); // low cool kicker behind
  panel(8,40,5,40,30,55);           // front-right edge light
  return st;
}
const pmrem=new THREE.PMREMGenerator(renderer);
scene.environment=pmrem.fromScene(studio(),0.015).texture;
scene.add(new THREE.HemisphereLight(0xf2f5ff,0x15110e,0.55));
const key=new THREE.DirectionalLight(0xfff6ea,1.6); key.position.set(40,80,60); scene.add(key);
// the key light casts soft shadows: hands onto the dial, the case onto the strap, the watch onto the surface
key.castShadow=true;
key.shadow.mapSize.set(2048,2048);
Object.assign(key.shadow.camera,{left:-85,right:85,top:85,bottom:-85,near:1,far:400});
key.shadow.bias=-0.0002; key.shadow.normalBias=0.03; key.shadow.radius=6; key.shadow.blurSamples=16;
// an invisible surface under the watch that only shows its shadow
const floor=new THREE.Mesh(new THREE.PlaneGeometry(800,800).rotateX(-Math.PI/2),new THREE.ShadowMaterial({color:0x1a1d22,opacity:0.16}));
floor.receiveShadow=true; floor.position.y=-8; scene.add(floor);
const fill=new THREE.DirectionalLight(0xdfe9ff,0.7); fill.position.set(-70,20,40); scene.add(fill);
const rim=new THREE.DirectionalLight(0x9fbcff,0.9); rim.position.set(-60,30,-70); scene.add(rim);

const camera=new THREE.PerspectiveCamera(30,1,1,3000);
const WATCH_SCALE=0.8; // on-screen size of the watch (1 = original framing)
const root=new THREE.Group(); scene.add(root);

/* ---------- textures ---------- */
function canvasTex(size,draw,opts={}){
  const c=document.createElement('canvas'); c.width=c.height=size;
  const g=c.getContext('2d'); draw(g,size);
  const t=new THREE.CanvasTexture(c);
  t.encoding=THREE.sRGBEncoding;
  t.anisotropy=renderer.capabilities.getMaxAnisotropy();
  if(opts.repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping;}
  t.userData.redraw=()=>{draw(g,size);t.needsUpdate=true;};
  return t;
}
const perlageTex=canvasTex(512,(g,s)=>{
  g.fillStyle='#b9bfc6';g.fillRect(0,0,s,s);
  const step=36,r=30;
  for(let y=-step;y<s+step;y+=step*0.72){
    const row=Math.round(y/(step*0.72));
    for(let x=-step;x<s+step;x+=step){
      const cx=x+(row%2?step/2:0),cy=y;
      const gr=g.createRadialGradient(cx-4,cy-4,2,cx,cy,r);
      gr.addColorStop(0,'rgba(255,255,255,.55)');gr.addColorStop(.55,'rgba(210,215,222,.25)');gr.addColorStop(1,'rgba(60,66,74,.35)');
      g.fillStyle=gr;g.beginPath();g.arc(cx,cy,r,0,TAU);g.fill();
    }
  }
},{repeat:true});
perlageTex.repeat.set(2.5,2.5);
// perlage for the mainplate, whose UVs are in millimetres: one tile per 12 mm gives ~1 mm circles
const platePerlage=perlageTex.clone(); platePerlage.needsUpdate=true; platePerlage.repeat.set(1/12,1/12);
// snailing: concentric graining for the barrel cover
const snailTex=canvasTex(512,(g,S)=>{g.fillStyle='#c9ced4';g.fillRect(0,0,S,S);const r=rng(9);for(let rad=2;rad<S*0.72;rad+=3){const v=Math.round(160+r()*80);g.strokeStyle=`rgb(${v},${v},${v+4})`;g.lineWidth=2;g.beginPath();g.arc(S/2,S/2,rad,0,TAU);g.stroke();}});

function stripes(base,light,dark){
  return (g,s)=>{
    g.fillStyle=base;g.fillRect(0,0,s,s);
    const bands=4,bw=s/bands;
    for(let i=0;i<bands;i++){
      const gr=g.createLinearGradient(0,i*bw,0,(i+1)*bw);
      gr.addColorStop(0,dark);gr.addColorStop(.5,light);gr.addColorStop(1,dark);
      g.fillStyle=gr;g.fillRect(0,i*bw,s,bw);
    }
  };
}
const cotesTex=canvasTex(512,stripes('#c4c9cf','#f2f4f6','#9aa1a9'),{repeat:true});
cotesTex.repeat.set(1/9,1/9); cotesTex.center.set(.5,.5); cotesTex.rotation=0.55;
const goldTex=canvasTex(512,stripes('#c9a35a','#f3d995','#9b7836'),{repeat:true});
goldTex.repeat.set(1/7,1/7); goldTex.center.set(.5,.5); goldTex.rotation=-0.4;

// fine circular brushing for case flanks (lathe UVs run around the case)
function rng(seed){return()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};}
const brushTex=(()=>{
  const c=document.createElement('canvas');c.width=64;c.height=1024;const g=c.getContext('2d');const r=rng(7);
  for(let y=0;y<1024;y++){const v=Math.round(150+r()*60);g.fillStyle=`rgb(${v},${v},${v})`;g.fillRect(0,y,64,1);}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,3);return t;
})();

// pebbled calf leather with saddle stitching; UVs are in millimetres across a 20 x 56 mm strap
// glazed olive alligator: a centre row of large rectangular scales, smaller scales toward the edges,
// recessed grooves between them, and tone-on-tone saddle stitching. UVs are millimetres across a 20 x 56 mm strap.
function leatherCanvases(){
  const W=512,H=1536,r=rng(11);
  const col=document.createElement('canvas'),bmp=document.createElement('canvas'),rgh=document.createElement('canvas');
  col.width=bmp.width=rgh.width=W;col.height=bmp.height=rgh.height=H;
  const gc=col.getContext('2d'),gb=bmp.getContext('2d'),gr=rgh.getContext('2d');
  gr.fillStyle='#d8d8d8';gr.fillRect(0,0,W,H); // grooves and margins stay satin
  // grooves first; scales are drawn over them, leaving the gaps
  gc.fillStyle='#070a02';gc.fillRect(0,0,W,H);
  gb.fillStyle='#141414';gb.fillRect(0,0,W,H);
  // smooth margins where the stitching runs
  [[0,0.085],[0.915,1]].forEach(([a,b])=>{gc.fillStyle='#1f2810';gc.fillRect(a*W,0,(b-a)*W,H);gb.fillStyle='#a8a8a8';gb.fillRect(a*W,0,(b-a)*W,H);});
  const scale=(x0,x1,y0,y1)=>{
    const gap=7,x=x0+gap,y=y0+gap,w=x1-x0-gap*2,h=y1-y0-gap*2,rad=Math.min(16,w*0.25,h*0.25);
    const path=g=>{g.beginPath();g.moveTo(x+rad,y);g.arcTo(x+w,y,x+w,y+h,rad);g.arcTo(x+w,y+h,x,y+h,rad);g.arcTo(x,y+h,x,y,rad);g.arcTo(x,y,x+w,y,rad);g.closePath();};
    const cx=x+w/2,cy=y+h/2,R0=Math.max(w,h)*0.7, tint=(r()-0.5)*8;
    const gcol=gc.createRadialGradient(cx,cy-h*0.1,2,cx,cy,R0);
    gcol.addColorStop(0,`rgb(${46+tint},${54+tint},${24+tint})`);gcol.addColorStop(.7,`rgb(${36+tint},${43+tint},${18+tint})`);gcol.addColorStop(1,`rgb(${26+tint},${32+tint},${12+tint})`);
    path(gc);gc.fillStyle=gcol;gc.fill();
    // a darker rim where each scale rolls down into its groove
    path(gc);gc.strokeStyle='rgba(8,11,3,.55)';gc.lineWidth=5;gc.stroke();
    const gbg=gb.createRadialGradient(cx,cy,2,cx,cy,R0);gbg.addColorStop(0,'#f2f2f2');gbg.addColorStop(.6,'#c4c4c4');gbg.addColorStop(.9,'#7c7c7c');gbg.addColorStop(1,'#505050');
    path(gb);gb.fillStyle=gbg;gb.fill();
    // every scale is domed unevenly: off-centre swells, dips and fine pores, so highlights break up across the strap
    gb.save();path(gb);gb.clip();gc.save();path(gc);gc.clip();
    for(let k=0;k<7;k++){
      const bx=x+r()*w,by=y+r()*h,br=Math.min(w,h)*(0.2+r()*0.45),up=r()>0.4;
      const bg=gb.createRadialGradient(bx,by,0,bx,by,br);
      bg.addColorStop(0,up?'rgba(255,255,255,.22)':'rgba(0,0,0,.2)');bg.addColorStop(1,'rgba(128,128,128,0)');
      gb.fillStyle=bg;gb.fillRect(bx-br,by-br,br*2,br*2);
    }
    for(let k=0;k<Math.round(w*h/60);k++){ // pores
      const px=x+r()*w,py=y+r()*h;gb.fillStyle=`rgba(0,0,0,${(0.08+r()*0.12).toFixed(2)})`;gb.fillRect(px,py,1.6,1.6);
      if(k%3===0){gc.fillStyle=`rgba(10,14,4,${(0.06+r()*0.08).toFixed(2)})`;gc.fillRect(px,py,1.6,1.6);}
    }
    gb.restore();gc.restore();
    // glaze is uneven too: each scale gets its own gloss, with a smudgy variation inside
    const rv=Math.round(70+r()*90);path(gr);gr.fillStyle=`rgb(${rv},${rv},${rv})`;gr.fill();
    gr.save();path(gr);gr.clip();
    for(let k=0;k<5;k++){const bx=x+r()*w,by=y+r()*h,br=Math.min(w,h)*(0.2+r()*0.4),gg=gr.createRadialGradient(bx,by,0,bx,by,br);
      gg.addColorStop(0,r()>0.5?'rgba(255,255,255,.25)':'rgba(0,0,0,.25)');gg.addColorStop(1,'rgba(128,128,128,0)');gr.fillStyle=gg;gr.fillRect(bx-br,by-br,br*2,br*2);}
    gr.restore();
    // faint creases inside the larger scales
    if(w>120&&r()>0.4){const cy2=y+h*(0.3+r()*0.4);gc.strokeStyle='rgba(30,38,12,.35)';gc.lineWidth=2;gc.beginPath();gc.moveTo(x+w*0.15,cy2);gc.quadraticCurveTo(cx,cy2+(r()-0.5)*20,x+w*0.85,cy2+(r()-0.5)*10);gc.stroke();
      gb.strokeStyle='rgba(40,40,40,.5)';gb.lineWidth=3;gb.beginPath();gb.moveTo(x+w*0.15,cy2);gb.lineTo(x+w*0.85,cy2);gb.stroke();}
  };
  const column=(a,b,hMin,hMax)=>{let y=-40*r();while(y<H){const h=hMin+r()*(hMax-hMin),j=()=>(r()-0.5)*14;scale(a*W+j(),b*W+j(),y,y+h);y+=h;}};
  column(0.24,0.76,170,260);   // the large belly scales down the middle (about 6-9 mm)
  column(0.085,0.24,80,135);   // smaller flank scales
  column(0.76,0.915,80,135);
  // tone-on-tone saddle stitching in olive thread
  [0.052,0.948].forEach(u=>{
    const x=u*W;
    for(let y=8;y<H;y+=26){
      gc.fillStyle='rgba(16,22,6,.6)';gc.beginPath();gc.ellipse(x+1,y+20,2.6,2,0,0,TAU);gc.fill();
      gc.save();gc.translate(x,y+9);gc.rotate(-0.45);
      const th=gc.createLinearGradient(-3,0,3,0);th.addColorStop(0,'#3e4a1b');th.addColorStop(.5,'#5f6c30');th.addColorStop(1,'#3a4619');
      gc.fillStyle=th;gc.beginPath();gc.ellipse(0,0,3,9,0,0,TAU);gc.fill();gc.restore();
      gb.save();gb.translate(x,y+9);gb.rotate(-0.45);gb.fillStyle='#f0f0f0';gb.beginPath();gb.ellipse(0,0,3.2,9,0,0,TAU);gb.fill();gb.restore();
    }
  });
  const mk=(cv,srgb)=>{const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;
    if(srgb)t.encoding=THREE.sRGBEncoding;t.anisotropy=renderer.capabilities.getMaxAnisotropy();
    t.repeat.set(1/20,1/56);t.offset.set(0.5,0.982);return t;};
  return {map:mk(col,true),bump:mk(bmp,false),rough:mk(rgh,false),canvas:col,mk};
}
const LEATHER=leatherCanvases();
// Strap colourways: the olive map is re-toned by luminance, so scales, grooves, pores and stitching carry over.
const STRAP_COLORS={
  green:{name:'Olive green',map:LEATHER.map,edge:0x1a210a,plain:0x26301a,numeral:0x2c3712},
  navy:{name:'Navy blue',tone:[[2,4,10],[26,38,78]],edge:0x080d1c,plain:0x16223f,numeral:0x1a2850},
  red:{name:'Blood red',tone:[[9,2,2],[118,16,20]],edge:0x1c0405,plain:0x4a0b0d,numeral:0x5a0d10}
};
function toneLeather(dark,light){
  const src=LEATHER.canvas, cv=document.createElement('canvas'); cv.width=src.width; cv.height=src.height;
  const sd=src.getContext('2d').getImageData(0,0,src.width,src.height), g=cv.getContext('2d'), out=g.createImageData(src.width,src.height);
  for(let i=0;i<sd.data.length;i+=4){
    const L=Math.min(1,(0.3*sd.data[i]+0.59*sd.data[i+1]+0.11*sd.data[i+2])/72), k=Math.pow(L,0.9);
    for(let c=0;c<3;c++) out.data[i+c]=dark[c]+(light[c]-dark[c])*k;
    out.data[i+3]=255;
  }
  g.putImageData(out,0,0); return LEATHER.mk(cv,true);
}
function strapMap(key){const c=STRAP_COLORS[key]; if(!c.map) c.map=toneLeather(c.tone[0],c.tone[1]); return c.map;}
// micro-surface: soft smudges and hairline scratches that break up perfect CG reflections
const SMUDGE=(()=>{
  const cv=document.createElement('canvas');cv.width=cv.height=512;const g=cv.getContext('2d');const r=rng(23);
  g.fillStyle='#b8b8b8';g.fillRect(0,0,512,512);
  for(let i=0;i<260;i++){
    const x=r()*512,y=r()*512,rad=8+r()*60,l=r()>.5;
    const gr=g.createRadialGradient(x,y,0,x,y,rad);
    gr.addColorStop(0,l?'rgba(255,255,255,.18)':'rgba(70,70,70,.14)');gr.addColorStop(1,'rgba(128,128,128,0)');
    g.fillStyle=gr;g.fillRect(x-rad,y-rad,rad*2,rad*2);
  }
  g.lineWidth=1;
  for(let i=0;i<420;i++){
    const x=r()*512,y=r()*512,a=r()*TAU,l=6+r()*70;
    g.strokeStyle=`rgba(255,255,255,${(0.08+r()*0.18).toFixed(2)})`;
    g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke();
  }
  const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;
})();
// circular graining for the gold wheels: wheel UVs are millimetres around each wheel's own centre,
// so concentric rings here land centred on every wheel
const GOLD_GRAIN=(()=>{
  const S=512,cv=document.createElement('canvas');cv.width=cv.height=S;const g=cv.getContext('2d');const r=rng(41);
  g.fillStyle='#9a9a9a';g.fillRect(0,0,S,S);
  for(let rad=2;rad<S*0.72;rad+=1.6){const v=Math.round(110+r()*120);g.strokeStyle=`rgb(${v},${v},${v})`;g.lineWidth=1.2;g.beginPath();g.arc(S/2,S/2,rad,0,TAU);g.stroke();}
  const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.repeat.set(1/14,1/14);t.offset.set(0.5,0.5);
  t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;
})();
// ribbed rubber: grooves run down the strap's length (u = across the 20 mm width)
const RIBS=(()=>{
  const cv=document.createElement('canvas');cv.width=512;cv.height=512;const g=cv.getContext('2d');const r=rng(5);
  g.fillStyle='#d6d6d6';g.fillRect(0,0,512,512);
  for(let i=0;i<40000;i++){const v=r()>.5?255:90;g.fillStyle=`rgba(${v},${v},${v},${(0.05+r()*0.08).toFixed(3)})`;g.fillRect(r()*512,r()*512,1.5,1.5);} // moulded matte grain
  [0.31,0.39,0.47,0.55,0.63,0.71].forEach(u=>{
    const x=u*512,gr=g.createLinearGradient(x-11,0,x+11,0);
    gr.addColorStop(0,'#d6d6d6');gr.addColorStop(.35,'#5a5a5a');gr.addColorStop(.65,'#5a5a5a');gr.addColorStop(1,'#d6d6d6');
    g.fillStyle=gr;g.fillRect(x-11,0,22,512);
  });
  const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1/20,1/56);t.offset.set(0.5,0.982);
  t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;
})();

// Halden & Vey Pegasus-1 Squelette dial: an ivory chapter ring around an open centre.
// Canvas up = 12 o'clock. The ring geometry cuts the centre away at DIAL_OPEN.
// Aperture centre sits halfway between the dial centre and the inner edge (foot) of the VI numeral:
// numerals are centred at r=13.7 with height 2.7 scaled 0.7, so the foot is at 13.7-0.945=12.755 and halfway is 6.38.
const NUM_R=13.7, NUM_H=2.7*0.7;
const BEZEL_IN=17.75; // inner edge of the case/bezel opening
const DIAL_R=17.4, DIAL_OPEN=4.8, HOLE_DY=NUM_R+NUM_H/2-DIAL_OPEN; // aperture's lower edge lines up with the outer ends of the numerals (VI is omitted)
const LOGO_DY=(NUM_R-NUM_H/2)/2; // logo centred halfway between dial centre and the foot of XII
// Halden & Vey pegasus mark, cut from the supplied artwork (transparent PNG), tinted on the dial
const LOGO=new Image(); LOGO.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAkQAAAHcCAYAAAA3PbXpAAEAAElEQVR42uz9d5xc13Eljp9Ok/NgkAGCIBJJMIIEc46ixKQsB9mynHO21157f7vr3bW9trUOcs6WLFmSJSaJOQcxiTkhEUQGBmmAydPp+0ed+t16d97r7knAgLz1+cwHmOnu1+/dd9+tc0+dqgKCBQsWLFiwYMGCBQsWLFiwYMGCBQsWLFiwYMGCBQsWLFiwYDNkKf4ECxYs2KxfrIIFCxZsJizNHwAoAiiHIQkWLFiwYMGCfVA2WSkDhMIGLFiwYCfMDi5YsGDBpgsMZQDk+BO33gRQFCxYsGDBggV7X4OhuL/1AOiu4b3BggULdlwtE4YgWLBg0wCGlBGyOqHFAK4DsBTAbgAj/HsWQU8ULFiwWWbZMATBggWbAhBKQwTTY/xbN4A5ANoAXADgKgBHAPQCeBnAgPf5AIyCBQsWAFGwYMFOeEBUD2F+ShDG+SoA1wNYCWARwdFeAHsAFAC8SlBU5vtLARQFCxYsAKJgwYKdqEBImaEh/m0RgHMA3ArgBoh2SK0RwOUADgB4F0A//54mIAoWLFiwAIiCBQt2wlkaQB2AYf7eBODTAG4DsAbCCllrALCQPw1h+IIFCxYAUbBgwU5kU2aoRDCUBnAyRCt0G4BL+b4igDxcYcZ+ABsAbIGE11Q7FEJlwYIFCxYsWLATzjIQNkizUxcC+BMAb8DpgvRn1ACjNwH8BIAlEM2RbsRCHbRgwYIFCxYs2Allfu2gDgAfA7DJgKABSLZZHqIt0r+/AmGR1OrCcAYLFmy2WdihBQsWrBYwZGuWZQFcCeCjABZ4QCcTA5588XQ6rD3BggWbbRY0RMGCBasGhhTE1EHqDJ0BySa7lGvIKP9Nm8+kICGzAQDbICn3Ic0+WLBgARAFCxbshARDWQKbFIC5AD4M4EMAzgcwDy79XkFQyfz/CIAXAdwPqUVU5HEDKAoWLNiss0BbBwsWrBIgUlZnFMIQXQZpx7EgBgAp2ElDxNOjAJ4E8DiAw3DNXYthaIMFCxYAUbBgwU40QKTWDOlL1sjf82YdsQyR2gEAzwHYCBdW0/cEhihYsGCzykLILFiwYHFASENhg/zbakhbjnlweiDLDBX5txzBz3uQUNkG/h5scvdBxzfUbQoWLFiwYMGOsaURrSg9F8DfENwMECSVjJMuEvTo75sB/DSAU+BYIT1uKgxvzZaBhB7rEdj8YMGCBQsW7JiZMkOqAWogqPlxAPs8ADTGn6IHiMYAPARglTluY3Dok7oPcX8PFizYDFkImQULFsw63CwkJFYCcBLB0C0Qlsjadr5nHoBWfi4PYBeAt+GavoKAKYR7arc0XDkDazlzb4IFCxYAUbBgwWbYGZf40wXgCoh+SPuXjRLwfBeSdXYTgDaCqUMAXgfwPb4/OPCJgVELIIsQhm4FweQmCPum7w0AM1iwAIiCBQs2gw7ZOtp5cBllJQB9AF4G8FUAz0MyztZBwmplAL0AnoVklh2Ay0ILguDagKhm9SkzdBqA3+DY/y9IzzjwPYF1CxYsAKJgwYLNABjSkJc640sglajrISyPvv4UgHsgRRcb+DfNhspDhNfvQdgMyzYFSx571WWBY90CCVfezp8CpEFuCVL1e9QDRsGCBQuAKFiwYNPETtTBMTpzAfwoJM2+E07gexTSqPUIHfk5ANrNcYqQitTD/D3HYwZAVBkQAVG253wAP0ZAmuPP5yFM3B8BeIvvz/LfML7BggULFizYFJ1x2gNGKyBC6t1woa4ypLji70O63Kch2qGvQ0TUYwRLdwJYa47dgPH1ioJFgZCOf4ZA9CoAf0pQqVl7Gh7bAmHu1EL2XrBg02iBIQoW7IPtlLNwYt15AH4SwEcAzDfvOwDgzwDcBdERLQTwaYjguhnAQQDvQNp0HORnFEipNkaZjKB7cQBRNUNpAIsAXA3gEwDOhqsDVTagZxhRNiiMZbBgARAFCxZsGhmKOkim2EWQxq2r6WyPQBigZwiGtgM4FcC1ZDJ6eIzDfM+TkMKNWTruEC5LtowZH83muw3AjXD93ob5f83WO8J/gwULFgBRsGDBpgkMpQ3DMAfStPUjEJYIcALeLxLo7CNQ+nVI2GahOd4IJA3/Tf6/gQ49AKLk8VeROgCsAfBJiGbIAtV6RPvF2arfwYIFC4AoWLBg0+SQRwlgygAupkNWR52DtOh4ElJ3CACWQZihk/iZfv68CAmZDfB9A+a72gmQtOVHGHcZXxWenwvgZgAXcqwKkBBmPZxoWkNrBYQwWbBgARAFCxZsRgCRrgNrIDqWkmEhhr01op4AChAGaB+ARwB8B5Jd5luGIGsBQdXrBFBlcx74ADl57RFns/l+GsANALrh9ELau0yBEPiZA3B6rw/SuAULFgBRsGDBph0IpQh6hiAs0AqyEyfxd7U3ITWHhiGtOZYCWA9XRTlLp/0sgCfgWKE6SKr+PAArIZqYRZAMqSUEUL0GMBU/IOOe5rX282+rIbohDVOWeU80M69sQFQRwH5IfSfLsoVwZLBgwYIFCzZJhqLe/H4ygL+H1LXRNG+tOP3TkBBZFiKk/icAWwl89H1byW5oFlSOIOjHISLs1yDM0RE69G9DahepfVC6uGcgxRaVEZsL4G8gRSxtaQNtc6L/178fAXA/pDbUXG9DGzRFwYJNkwWGKFiwD4ZZsW4WQBOAswhoFvO1owQwT0KqUW+H1Lo5A8B1EKYHZDJ2QYTUW+nEGwmGLifrcYP3/WVIJls65pzez2OuDI8yaKsAXAnJKJvLcRnk+GXMWJXgmKJDkCy+V3mcUAE8WLAAiIIFCzYFx6yMQwfB0FVw9W6KkJDMPwJ4AKIPaoUwOhdDQmFq2wH8HYDHCIhSEA3STQBu4f+tDUIqXH+bx4X5zvL7fNxzcGHB+QB+BRIqm2ve4xdYLBvAU+CYPQPRYY1w3Q5Nc4MFC4AoWLBgk3DMNqusGZI6fzFcHy2tKP0sXFbZXDrvC+DqCmUB7AHwNQA7+ftFkKKCN0DaTqQg4t8yAcEBiPD6bkjoTBmO4vt4vJX9KnGM5kNYttsMGOqHMHWZmGMUISHFOt6vA3Ask2acBQsWLACiYMGCTYKp0KyyRgKX0+hw1SE3eM65HiK4PoPvU81KHqJrAV/7QUio7CREM8dyBD9HIan5WwiUcu9zhsOmyRcgWXbfB+BjiGqAGhCvofL7kzUiKngPFixYAETBggWbBFOhGpYMROdzCUQo3cT3DQDYAeA5gp1OOu6r+b5m77hzIbVztkPCZNcDWG6YDVtMsARhhXbBpex/EITUNkS5GFLdez1fGyHAzMUAoTKcCLsIYBPvi4bKNMsvWLBgARAFCxZsAoDIMkMLAfwypDbQUv4tD2FuvggRSe/ha5+DpMwv9hx2CtJ1/TfppOfBia31O+vgQnH7INlUQzGO//043v44tBNULvXAUpygvMz7oZmAuwD8Me/LNgIl1RUF/VCwYMGCBQtWo3NOQ8ItdZC+Y58m4FFAoiner0FCX2oXAXjJvG8ITuRbTvjJ82fM/O0wgK9AwkXz4UJuGbw/M8zSiLI+OQC3AvhnSPbeKKItTcrevShyrMcgTXK/Bgm3qSWF2IIFCzYNFhiiYMHev2BInW0PXPPQLr5nFC5zrBkSolFrRDSrTLvV6zHjwIxlL7TlxE4A34Ck8feZ97xfu94rI6chw25Ij7JrOe5FM1Z2DBUQaYjzICSr7B6Om9r7PSsvWLAAiIIFCzbtjtnvVaZZZcpEaFhmE6QidR8ZiJP5vhyc1sWCq6RQj82s0v/3AXgDrjJ1o3n/+228tQL4CMfuFEjD3MvhhNQF835//PIc/wa+/jR/UvzbGIJ2KFiwAIiCBQs2aUCkz/kqSPjFhlwOAPgLAA9CUu1PgmiMrkY0VJM1QCqN8WEb6+DTxvn3Iqp1eT9rh1SrVeY4/gpEq7XQvK8uAVCW+FmtCTUGaZ2yjWPeYN4XLFiwAIiCBQs2QaaijkzFRRBRrzI9w5Bw1lOQkNZuAqCbIGG1OTyesksZDwTtIYAqQ7LWFsOF6eoIhpThKPBvebw/a+f4FcAbIEUvPwQnNh9AtBK1BYjaF66df9vAcXsPLoxmGbgQMgsWLFiwYMGqmN+r7BTE9yp7B8DP0XGnIFqX34K0hvCF0gXvbyMAvgxhka4H8B88tn3fNkhtoiVwYaCkzKoTHQwpWGzgOF4B4AuQOk12zIoYL0QvQGo0qaaqF8BPQgTubRBdl46f1osKvcuCBQsWLFiwGgBRowFGN0HqC5UNG1EG8Dgk60vtVkhqt4p7h/nekgFFA2Qt7oEUGFRA8EW+P89/eyGZZTYV//2aHeUD0C4Cy+cgGXY6jrZpq46xDzQ3Qhq+doVpHCzY8bEQMgsW7P3BVNgK0S2QTvXnwelPYEBJHq5I4jxI1eol5lhaUFEbkw5BWKUnCaaeNZ9dAlcwcC8kO+puSENStfdrdpQCIlsB3Fb2HjPvs8yOgs5m/v0AgD8D8Kg3bsGCBQuAKFiwYBMERFk6YM1ysr3KbLYYIGn4twB4FxI2u4QgqgAXlikQTKnDfx7Af/Jf0OlfDyk6mDVryTP8KfOzWnPHArb3w3hra46j/NtqSFbZ6XDZdGnzfr12W4kakKKYD0Ka6g7xPi2HVBHXcVXd1wFI1e9Rc9ygKQoWLACiYMGCGcdoGYlWSO2bC8lC5L33Lwfw63Sy7ZDwWbPnwMcIaFJ01M9BCjgCkkb+C5CU8gUe87EBItguIdrFPQOnmznRnbiGJgd4LXMh2XlXQBgzzcbLYXy9IVuJ+ggky+9euEreKwB8hGPbw79puPJRAPcTFOmYhtpEwYIFQBQsWABCcGGtAf6+ikzFuXCZS379mhYyGb6pviULEfUCUqfoCYjGaISfuw6iO5pjjq/1jLYhWsSxkHDe5RN8vPv5t1UArkS0i/0Qoropv9zAIMfpfgB/y/evgbBtZxBYXe199x0eIAsp+MGCBQsWLJhxjE2GhVgIEea+DReq0vpBldpuWNH1kPl9P4Cfp7MG2Y+/J/ixn9sG4Mfo0OshbFUdooJjCyqyODGzpTTUpec+l+O9AeOzx0reuI6Ye7EBkuXXzeO0AfhrCAO3Fa5+k35+B4DPQsob6Pi+H7P2ggULFixYsEmBoTRcbZv5dJr7jCMdQHy6dxGiQxnmvwX+FCGhsjGIvujv4QoLzgHwo+b4ypLsg6Te+z23LADqgdQrWhRzDSeCxfVfWwHgx814lCB6okKF8dbfXwPwGY7LuZDw4wFEyx0cITjth2T2LfPGN/Q0CxZsmi2EzIIFO/HM9swqQlK1Pwrg43BhGyC5MnLaPPspw2rk+PftBEN3QYo2NkF0LR+DC6UVIa05nuH7DhsWxYboFgK4BpLJ9i6k0al974lQvVrrDGktpzkQ5ux6M94pRDVT/v1Km+vs4nheBGHflsGxRbou13Ec90EYOasDe79W/A4WLACiYMGCTQgMKYtQIlg5E1IZWbPKxgy4SVVw8tbB2qrIWwF8B9KHLE3H/WGISFuPp13dnyYoyvD7lGmaBxFvnw3RHJ0PyajaBdEj2bYes1VTZEsQDPJvi3k9t/P/gLA4TRXW05T32lyCqQZEm+oq4GriayMcq2cMYFU2L1iwYAEQBQv2gQZDmu5dooM8G8CNEDFuvQE7KVTXmPhMwygkdPMaXCbTAgDrCbo6vPePQHpu7YJrGaJg6WayICt5jA5IJtsPkWG5E9ICpAxXx2i2gSJtRaI1m9oA/ACkg70N/8UxQ7YRrhZizMJln3XH3B9l/dQOQ2o6PQIJxyn7VkJgiIIFC4AoWLAAiv7/TnUFgBsgGUnzjZOsVWyrobI6MhJDkEyxRyD6o8U8/hUQxkftICSU9jREUD1mXltNkHY7JFRWb76rA8AFkLT8hwyA0syt2TTGCvCG+beFkOy92wGcYwBhXcI6agHRICQMOQphh7oIomzF6qwBsoMcXy2CedCMEwIYChYsAKJgwT7IIMg2EW2AdFS/HsLCnIZoRletPa/KdNJaL6cXkt79JF+/HsD3E+A0EvgcgdTD+Q9INtteczytx3MJwVSdeU2ZjX6Crdkc9lFmaNQAuU9BNFRneOtnOmFcLWjpB/A6x3c5pHTBYo57jmNTNOvxe5BCjd+BsG9q74caTsGCBUAULFiwKVkGEk4Z5XN7MSRUdjrBkPbNiuuqHuew1QG38m+bIeGZewhYboBUs14PCXWBTMXjBE13GVCj9Y+uQLQezyC/q5nfNUSw9RwkBKRC49lUU0c1Q8oMdUM0VLcQ6MGAyPQE7p02abUFKrMG7BbhmLo0RDf0Dj/fCNcgNliwYMGCBfvAmlZGVlsA4BtwHdU1xLKbjtM2EY2rN+R3WT8IYXZW8PhzAfwb/27TyF+EhIx6vPNLqseTJzuiv+8m0zKXgKIes6ueTtqckwKRTwH4KsfCXle1uk729RGIXmobJGts0BtXbZ6rv2+GiNBhziOk2QcLNsMWGKJgwWav2VBZkc56KaStwzqIyLcEF9qp5jTjmKEtAB6GhGj6IBqgGwFcBdd5fQTSjf3bEN2QCq5zAE6BaGtuI9ApEwRpAcEmAoitEHbpGUjoCIjqi473OKfNWAJAJyRUeDPHopPXUSuAs/3L6iEar7j7UTZAbITj9BzPowESpgxVqYMFCxYs2AfaVMuidYNWAPgCXCVqdahaZFHDKkmsRRIztNqAAGV6LNO0AcAPQ/QvVhc0F8BfQjLNyjHno7+/B+BnIDV3Mt71pWbJODfBlRJoJMD7B0iVaDt+tVb9VpZojOORVCBTK1iXICGyH4FowprhwmehKnWwYMGCBfvAAyJb9fkSAK8YhzpUBQBZx5z3/raZ4EdZoNUAfgnC/lgA8DaAP4TrWwaCmjUAfooAS99/FC6cpOBsEMIsnWI+34TZEQJKxZxHI0Qz9Ldwfdm05UZhAmCoWOV+6DGHzN8ehDCAaqEidbBgx9BCyCxYsNlnKe9fkDFYimghv1qZAxUJax+ug5Au698BcAiSRfXLkNBQh/ncAQgj9QgknKY2h+DpOrjQmzpw6/gHCKieguid1GZLtlQKEqoahQtLnQVpXHslXK0hTaFPTWC8bd2hpPfo8UYhNYe2ICqcDhWpgwULgChYsA88INKsMs0cuxyi1dFCgXUYX23aB1FJ2WSPAvh3iJbnZEh46KNwLFCe73sKkk2216wXpyCaTbaZwOcUfkcBjtkagGSVPcXzUE1McRaMr9Y+0myyZZDmtFdC6jqdjGghxFoa0irTk4ELLe6GhN2KEGbsFALTMlz2WR6izXqa36HjFCpSBwsWLFiwD6ypXqjZ/O1MAF+jc1V9Ti1aFl8zdADSSFS713cB+J8Q7YoNqe2BdK8/DfGaIc0m2w7gjwH8AYGRamb0OK8DuIkAQJ3/bNDD+F3r2wH8HiQcuQPRzLgyag+TabaYvn8IwrCdDynm+H2QKuBFb5z2wDV7rYPLKgu6oWDBjqEFhihYsNll6lg15LISEsK5Gq4B6JhhOpKOkcQMfQXCDLVDCi9+GE5UnYc0YH0CUmsoKZtsAb/jkPkeDQHl+P9NAO4jABgwQETP73iBzbQBLjDXdTsBoFrJsDjVgIlqgiyQ3Qjge5AWJS+Y6x8w51Hi+57kj453vXfO/r0NYbRgwYIFC/a+NduSQ20FJB1+K8YLdkuonRnaD+DnICEhdbI3QkTV2z2m4mcg1ZhtNtg8iMjYrzN0hEBrE6J1enZCGKZTeJy0ub7jxXpoanubARldEIbrbY+xmQgzpJliR8z7eyGC87UQTVaWY/9riGbkbec4+dl3Gf5orSYt6liPyrqkYMGCBQsW7IQ3dXJZOuq1dKCHjHP2C/rVkk22icBHiym2ArgWwJ8BeIvOfAwSNvsiogUg5xAc/TikoKDNJivEgLBhSKuJf0O091kTqlfPnkmgGQfClgH4PIQRs9c1WgPgLFV4zwYAfwfpfaa2GsBvQzrXH+E92gVJ67dFLlsQWPtgwYIFC/YBZYWUOakjIzAXwCcglai3xICOqTBDKYgg+o8goSwFT7sB/Cxc6EztekiV5ncwvgK1fx6jECbri5C2H5bFmEibi+kGmXWI6qBA1ub3yAwVMPEK1HkCyRHv870AfgLjtVeXQlqi6L3ZSUB6hXde9YYFChYs2DG28OAFC3Z8AZFmk41BwiIXQ/Qst8PpTEbg+mDFWZxmaBNEM/RVAqMmAOdBRM5XQcJZKUiY7A4A/wzRt6yGNB5tgeiWboWrhTTI/+u6oVlazXBZb8/g+GdL2Swy1Vt1Q3RT7ZDU+tvhxOVD3nUljbEeO2vee5hA5zBEK3QnXFZeA6TX3HUAzoXLwtsI4AEIY6ShvAJclWzwfvXwfHX8NT2/D068recUdEXBggVAFCzYCQ2I6gmIAAmzfAbANYZRUYdZSXvj1xnaD+BPIS05VKi7FhIquw7CGDXQcd8BqUk0QGDziwAuIPhqQ7QwpF8o0K/NU4aEggYMM4Tj4Kw17X3YfPfZEOZqHUQUvsJjZlJVwJCyc1kPmL4NKaj4DCRD7ZB5rR2iEboeToi+CcCzcLole4/z5rNn836dDVcPaQ/v6RNw1cThjX+wYMECIAoW7IRjhmy202oAH4JkPHXztRFU7l5v697YbLLHICG3fQQ55xAIXUNWRAsovgPgXyBaouWQjLOPIapriQMCNtMpR+ChPbj2wXV0LydceyrmOqbDmatoW7P0AMnSW0VQcr1hhcDzrqsyvtprLGfGo5dgcg/H+kFIRplaC4AlkFDZbRA91ShEUP0oAc1BjmkBwrzBzINTICzeFbx3WcMQbeM4+2MawFCwYAEQBQt2wpl2r9cO53PhKkV3wzURrdblXJuRNvH3gwD+nE63l45+LSSj7CMEB43Gie4B8DJ//zxEu9QTs0aUMb7gYx5OG7QZokt6DtK3TMNVec9Ra42ldMx1KPCaLMDUlP+cAZndAH4eUtRyDqJVuGthhrSuUr05532QcNedBCcHICEza6dAtFsXwYnL3wFwP4BvcbyGCMY03AlIA9hfAbCe5+6LrPt4z3oNu4TADgULFixYsBORGfI3IasgYZW9qD3dW7OcbF+sdwH8FSTMpXYugN+FaFUKxvlqhtR9kLDMJxAVTh8he5Ik4tZUc/39CUjWlprtVaZ6npkSVcel8jdCwoKfR7Q56xjPO6nZqr0+P4tuB6Ti9hcB3JJwLnX83v8G1+MtD+AlAL8PqYKd8z7TAWnJcjaAnyTYsefbD9da5EWI9klBbQa1txMJFixYYIiCBZvVzNCvQMJkXR5wUoYiKcRUoAPW3mR/D+Drhq1Q8fCNkErXGXMOyvisA/B/yIDENV9N+u6UcewlOvGUx6zo+zJmnRmZgfHUQpBWf7OWzND5cPobBRAZb4z9a9Nj5eE0WUMQcfq3IRl5+701tGAYqZ/jmGsIczuk6OKdBJ0+C3YqJJx5CUGlZehycAU6VRu2E67dSMacc7BgwQIgChbshGCGVDPUb5ihKyFZXBpWGSa4GCWg6TLPqGUrYBiEQxCh7ZchIZxlEMHwUkiW2FoCHHX0NgV+DqJd7McQzaCKs6J5/ShZi2fgssryBshpKMxmma3mtVlwNQQJtQ0YoFOqMp4altPMrAZeyyIyOLcR0Gj9pmYks1RWK6SgScXkGyD6oDsg2XNqWk16lMB0GSTk+XGCmiGINutZSIjtBW8clnIOXE0AdY55bZDX2GTYoGchTXZ3IYiogwULgChYsPc5MzRClmc/RAB8mQcsNNyltWoOk334JpmLhQA+SwfbyZ9Wj02pFLrKobqmpsj3FCF1kv6OQOGA+R6t/zPmAZt5kCy2cz1GZgNEg/Smx7qUKoxnPUEHDMC8ESIcP5VgCIgyaagAiAqIMl8gOP0TSKhsW8zaqd9/Eq/rcsPwqGboPl6fBUOtAL4fwM2QEgdzYu7DiAGMvZBK4Q9ybuTMfAigKFiwAIiCBXvfMEMFOlztIdYECaGkDXNRF3N8zVJrJIA6hwzFGZ6zL8K10PDZnoJxwtV0PjarTY/3CkRfA56HhpsUuJxqQNnZZG7me8edDwn5qWUQX7vI9iIbMozTUoiA+TpIZpdeG8y4HSKb02nYn6L5Pn3fdgjzNQLR/txBQAKIPqtIBmeQnzsFwEcJRJs5Rq8SvNxDZkfHZi6//3SOw3pzbXk49s0Wk9wA4HEA9yJa3wgIobJgwQIgChbsBGeGLodr1ApI9tDfA7iLwOlDdPIpOkqfuYBxsmvJDLURWCxKAGWphPPLmfehCjtU4PloGKcZrplpLmY9mQcRNl/O629GtKWHmtXFIIb1sFlk9XA6Kc3OW48oG6Zgx4LIFzm2F8HVBFJxdasBJfdDQly7CKJ6zTHGvPuwHMAvEYzqOOwD8DyP86p5r6b+X8Z7uzKGFdL7reO4H8D/g2QN7vXOIzBDwYIFQBQs2AnNDN1GR26ZoYcB/BOd6Y1kOpYaJqZIpqCPTnwepM5NE1xdIeuoR+F0NpW6tdeSoVQ2x9LWEoNkUl40TE6e/18MyZxqhIi2b+a1w1yzgpURiLbmDjr/tAFeZQPalJka5U+OzMzl3niWzfnWQcTm7/BcNaRoj9tkzmkTgDcA3E1ANGreVw/XqmOEvy8zzFAT7+Mr/HkYEsoE2aCTAVzIe7vOjMWwucc6Z/R8dgJ4iGOz1wDQEcNsBQsWLFiwYLN+o9FqwMZcSIPVtxFN9z4I4DfhigW2A/hXAqMh8759kC70F5AR+l24pqSadl9r89GJ/GgdHr9h7JMAfggSorNp/nUAPgfgKxCh9YaYz46YMdgB4EcJ7urhtD4pA9jqYtixUwkgN1Q5//+EtCtZDeB/cvyPEOzY973D89bu9P69rPf+dg6E0dsOJ27/I35Xu3nfSojG6gUCJv97i+ZejZr7tR3Af4XrQWfPJaTYBwsWGKJgwWa92UrJlTRDY5ACew8aZmgVpFL09YbxAKSI30OQXmODcBljluUZNY4yi/jaPBO1EqIhtVFICGkzgca/mPd2kX1ZyWu4ES6EBDi9T8acWy+B1YNwGqR6w/SkDSADr7sLEmr8MJmhDrgsMs2OOwoJd71OduU9uBCVrVLdT0DaBwlv3QERqet3pXnNynw18bvnkfW6neezCVKt+j8hWWXd/L4GSOjzs3Chu16I+LweEt5sjmG2ipCq3w8SwOn5jODY94QLFiwAomDBgk0KDCmboGBIKw9rpWS1IwD+HcCXCIbaIFqUa733HQTwlwC+Y5z+jwP4JB2zBS3TyRxo2MrW7dkM0bL4bSqaIanjH4OEsRZjvAC8Dq76do7A6juQ7DirjSkYMNSAaC+ylZBeZFcS2FgmRyt6DwB4jWN7N8frcwRoK7xzeh2SAfYsJFvusHlNG+1anc4a3p/LySR18dzvhIine/n6xyDhtBREz6Vj0QdJm/8e/34rJJRm1+ICJLT3Ou+9WsgmCxYsAKJgwWa9aR8pZTPG6ASX03nfjmixvSFImvo/kV1YAWmr8Qk4ofUYJGzyKN/XR7BxIyTEdLrnKKezWrGCLHXkR8lYPEwA87QBCIsIgG4E8GnvOJo2r4UZM4im6z/IY6meqOABA2WVlvPaL4KwZ5eY8xxGNKQ1SmCyj9dwLqQKuBUwv8PreQyiFXrF3McmuK7zWhNpAYS9u4rff5Fhdfr4/m7exxsgWX72XuzgfdYmsE8RUF1sAJFm9x2AFH+8i8DIAqJgwYIFQBQs2KxnhtRB6y7+VEj20wUYX2PmLUg/q0387M9DQivdHjP012RR+sjC/BhExHuSB8amkxnSejw5A16eJ3B42jBDbRBN0zqCiPkJa4vqm2DOcxuP9TJcZ3jVDmnKuWbldULaWVxHRqjTG3efxUnxfbcA+AwBxzLzei+AL0B6rh1EtAdZ2TBDmsVVzzG/GaJDmut912K+fhXPuwfRwpWA1JX6Nr9vB695B6KVtdX2cW48jGhYNDBEwYIFQBQs2Kxnhmy9my5IKOs2/rQZxqePbMSdZCdOgYSaPkFAoYLjITrEv6PDXkkG5uNw7TU002k6+4PZlhwpSFjvdQDfgISfdvO1MyHFD3/MMDMFSFHFw3Bp7CvghOUKNnaQJXkYovOxWictOqnZXavJBt2G8SnqahkPKNTB9QVTvVaejFQfXMXpXrP+1cNpeGwNpdUQ8fRtvN6UuVYFjS2IZtCpHSIL9QairBr4/ks5V3TMS7yn++GyCBs4Hr1wLU9CV/tgwYIFCzbrwJBfyPAUAD8BCXe8h2g20SFI9tjlhlH5c0QbqmpT1ccgGiH9nj8FsBHRZqOVGpNONpvMZoONQgoB/gRZELUL4VqE2M+/CeCn+PqZkPDZKzzPMV7Xa2RnLobT/ygj1AinVQLH528hYabCBK5jmKDCfuZtAH9AULk64X7mEM2W06zAN+GatPqNbUcqnNtTHIPTEdU6tUMa8L5BFixvzvtdiLj7fwH475BmsD8CEavbDWzIMgsWLDBEwYLNGjAEwyTUQ8JY10CEsjcYxkN7er0ByRJ7grv/jwD4FCTEouyJtmM4RHBwDkQD83HjFPsJHqbzubWMQ4kM1fd4vvfxOldAtDQfI2PSRMCjjNCDAP4BLiOsk6BKK0vvItC7BxKCKxgApJ9pJWDohuh0boPTXh3lOJc4Bim+t84AOu2lplWc3yBwewmSpfeEuU7VCmkbEssMxdWLGuD55jA+DX8QEuraD6drepCA8ohZZ9cQEH8cLozqZ43NgWsMm4KULngOTk+k/duCBQsWAFGwYMcdDKk2pkgHtZog6KMATvPARZGO8mFIhlEKoi26GeO7mmv4qJvOuIvszALzPp9JmQ4wZFtx5AkiHiB4GYRUVv4E2Y41BBObAfxfMlxpSBFBBTYXEThZvc0GMmfPwYWbcnDhMWXYricYOcWMTxkuDX4fJCssRTZqnmGhFOgAotf5M4KvI4hqhQBXDyhLANWPaCXxK73zzyLaAsWyNO8SOD5MMFvg91mNUBdEK3YlopqyjLn/8+DCaNoCZA9cVXCYORLCZsGCBUAULNhxM62YnDdOTJ34RyACaq0JpA7/KICvEQws4ns/C6cZGvAYH2WbTkdUZD1CNmQmn9eUx6Ccye/8BMHeAgP0dkL0Ra+bz5wOEZN/mABR3/8iJBT0imFaimYcTyYDdSE/d4kBQkOIdp4/wuOUyeTMh6s/VCBjtYPMyh0Eo3rvNGtOmTtlp8Y8ZkizArVnWZv5fpABOgjJCDtAkHc/XGVqf309GaIVu5UgS+97kwFEGQPmiubvWk4gWLBgARAFCzZrwJAyQwXDaHzIsCdWdKshlR1wFY1/h05xvgEgPuOjBfvi6vjMhHYk5TncLESU/AlIeEd/n++NxXy+rinu6wH8LICz4ITl4Ot/BQkhHeX1qngckLDXjwK4CaK16fLOrR7jQ3oj5t+CWcOGIU1QvwzRK+33Pqd1kDT0lYLrn2aZoR4DTOL6x20hAHoYUoeoD9GaQdbaIXWjbjGMk4b2koCOnQ8HDGBDYIaCBQuAKFiw42Wa1l42jklrDN1AR34OHacyHs1kiV6DhJ2KkLTsz8ClzPeTEcjGOEOrrdGwjg2TJAGjaq/XwgylIfqVVkSzp1T4m+P5zSdr1A3RB51DsGeFyRvImtyHaE2dRoKO+ZC0/Vvh6iqB41iC0+tYzUwLJGyX41hm4dLYN0DKFNxBoJTivRgzxyia/2d5/gsgYT6tJK4hOA1VHeRPPxmoJEao0cyTFFmvS3jclYbxaogBWlruwN77tyG6p0MesAsWLFgARMGCHRdApGJndaSrCIQ+BgkR5eD0JQ2GGfrvZIZ+mEzSEs95VguF5OB0SGWPqUrFONSSeU9qBsah3gDEVoKZ5QR/LYgKjbcD+BMA3/UcOghCriNQWMVj+GtS2YyPHacuiKZJ22gAos36NgHoDjgGr2wYIAWaI2YsWyBC+E/yPqp+ZxQufAVew30QkfbRBEZIK3AP8j7Mg2jFroArvliJGSqb89LedXdByh3sM+8rBlAULFgARMGCHWsgpL20VPjbxl3/dQQ46+A62hf4/iE4DcshSFHATxun72uGkhyj1qexjBEqfCaFqYuty4aJOkRWR4sPtsFpqBRgtCPayFTZnU1kav4drtpzDhJ6WwQRnt9AQATDiNSZsfcBXcmAGG3BsYUg6A5ISK7XnJu2CikiWitKAW0P780NEAG7HbsmAqmtEPH43RCR+XbvnLQOlDJKR83xr0Q0S00ZwUyV8VewdIhM1BvmmgIYChYsAKJgwY4LIKqno1OwczFEPH0lJFyTMY5M2ZP3IPWGDkEKF55BIDARZsiGdeqrsD1xPccmC4Q02yxFsPEtAovvg6ulE5dlZe0oRDP0gAFDIKP0Y5BeX60Y31G+rsK5KeAswTVDPQrpLv80JBPrqDd+dkxUPwQCoV+EdKXPEdDFjdsrAL4IEY3vQ7TPmR37tPf5eQB+lczQ3Brveznm352Ihhn1OoKGKFiwAIiCBTumzFARrpfWHEjG1a2QLDFleywzpOzIED+7AFJvppWvDULCJdUYAg3RWY3JZoi4tp9MzRrDzNjsqQGeT7P5fLkKoEpysANkROrhBNC+01aQMsp/t0FEzf9AhqWTjFAjRCN0G+ILI2rfMtUotSIaNrPjcZSg8ylId3kVTjfA1SmymYDKKs3lfTyf93Ghdw4HCEBGea/uI/M0yNdzcOFQW9E6z3vaxWNeClc/qcx7ppqhVAXAZ4//NKRm0yH+PbTtCBYsAKJgwY65aX+sITqhDKRQ3m2QtPr5Hguhu/c8nXU7RDzdbMCQOux0FWBSiGEcDkN6mj1J538ugN8lQPPtewQvZ8NleSmLkUpgOGx4zr6n22NRLGDU89WmrBmIoPmPIZlXqtu5FKK1Oo1gZFnCte+FCIgP8rzP5Hdqlpcdt+cIuF5GNItsFNEMMlvwcCmB7DU8h+6Yc3gRwL9AagoVCUYGzet5wzrpOZUM+3UNpNDmGXBZaqoZUoYqGzMHNFtOAV8vr+9BXp+C8wCKggULgChYsGMGhNJ0euoIVxBc3A7JErONRf0QlTqsbjgRrTrqXAVmqOwxIYAUO9Tmpi9C0vaP0PH64KafDNJrdKLtZGXmmfNKV7jmJFvIa04jmgqfThi3AQNqziQwuI5AYXHM8Yu8zi2QStLv8fouIIDKmrXpPYKDfZDsrjsNa9UCCWvmDXDQqt9aXXsdRCt0jXdf3iXw2c+xuwuOFdR7rFluWgm7YMBWD8d6LURTdrsBSppNVikUqCFKBc4byLDdDwkDwrBGQTsULFgARMGCzbhp9el6AgxlSH6eoGCRx/YkPUftMc9TUqjEZ4Zs2OtfISGhEh3jEZ7b70AK/FmmZRukYvRjfO/5kMKPPgs00ayzTji9Tn0CILIgrxWSYn4WwcEaAob2hOMfgPRoe4RApw2uY7xlQvo4HvcTqB5ENIQ3asCk1V6tBPBrBCstMefRTybmcQKowx4YggFCZTM/LHOoZRdOJ4BMm3uq4DppfVVmqIn3pheSlfc4GTO1scAMBQsWAFGwYMcCCKkD04rFGTrTS7njV3ZjxDwvo5DaOzvpiNcQQCioKRgnWomFsbv+AUhW0+MA/hHRVOvTIGLkn0C0zo8CAu2GvpLOuRXRMFjZOPa0YTr6+T29BD8rDHDI1rA2WEDUAwkr1kHE574VIBqdQwQfL0Ay0fYQTJxJBud8nsMhjvFLZIRe8r5Xw2J5D3zOgeiFPgzRCllWrxeujcdrPO5m77h1cKUObBkDywytJgN2O++L3hOtn1QPl7Y/CmnMW4Iwh23mPjQbUHs/RLPUa5ivYYS+ZcGCBUAULNgxYoVSHrNwMpmFS8gM2eckRdC0EcBXIUUXF0HqDZ1vdvRZxKeO+2BIxbRZSPjmLzynCEjI7lcgoaS2mOPMg6T13wRJ9z4JopmxqfgFj+nIEkBtIkPzEqTq9g8bQFREZQG4f30dEH1TpXICz0Ay116Ba13x/QQVpxL4NRO0PMIxfotAMQ5IKnjR3+dDtEIf5rF8Vm8TJPvtuwSz78UwQqMeG5blPVLmcC6kvtDFvPdN3nn5AHgj5wcA/CYkfKdapBSZsn+AtHex930EIUwWLFgARMGCHQMwZDORGunQe+hQbzfMwlE6xEazm78DwL9B6g3VIyp4LSK+cGISSFBgMUK2JA8JO3XQoV8HKQDZaJikBvPc9pAJqfcAU6lGpkez1HzxcskDPtWux2aCFQgsBnhdwxy3Z+D0UQsh7Sw+CZd5tpfMzVYClzsNK9MCJ2TPIxo2W0QgeDYkXPcR81o/gc8OiDD9AY9tajbHLSJagkBB6wjHfxmkKORtcCn1WoixDi60uBUS6itBdEn/yWP+EFwWIQiGHud1buDfmuBakgQLFiwAomDBZpwZsqGWpQQeN5BZsGGWBgN2hskufJUOdj2Az9EZa1gqNYHzsAxMF1meiwiI5sG1lrDdzv16NnWQMFEq5viVrAESYtOq0U2IpqLbWkPVjuWDpyzHagekjs9mgr1BSA2ncyClC9YYYDEC4P9AOtkPkiWyoGAUTsheMPekiQzZh8gQzfXObSuk6/33IPqjPu91rVztVwIvet+/FqIpO998RxwjNAjgG5BsOxVug+A2ZQBXPyRk+E2IsFwtaIaCBQuAKFiwGTfbrT5Fx7YMLj38asPcDHEnr7qgw3RyX4doW84G8HmyN92eM63VLCDqplNvgMsQg2GdlHnKJAAfy3hlzbX2kXkZhOvttYT/dnrgzx+rWhmudMzfFTBo9lcLJCx2HcdOAaa2w3gJwJcQbfNRB5e1NWaur92c+xoyTZebzx2AZI4NwGWlHfAYMRhWyGqtbPh0Dn8UrN4CpwHK8ziNBFV7ISGvVwD8MyTUp3YqRDB+Gr9nF9myO8haDZFdyiNohoIFC4AoWLBjwAxp+4MynemHITWGzvLYkRSdnXVOLwL4czIN6yHVm69DfE2bWs8HHvOzKOF5zKB6fzIbiikZIPUapPv7O3zPWgA/RyAxFbPtMLIxjFGG19MMqWeUJpCxJQn+DRJSUrHzoZjjaMjPdnw/HcLmXURQu8T73PcA3AvgVUi47IB3zLwBQBkzvsoY6Xhew+9ZCUnfbzbjatPpdwJ4CJK6v8EDQ3MA/CTnynIC1K9CtFRvwVXALiBohoIFCxYs2DEAQynjuHMQkfJXyZyUza5/CC5soT+PQ8S/DWSU/owMhH3PICSLag+iYZiS975afsbInozw/9WOUUS0eJ+GlAYA/I3HAi0lK6GfO8rvytd4rrbZrP3bAEHNSJXP7wbwPIB/IqDx71Mz4otYpgjiboSE1l70jpsn+PsWAcgK77NNhnFKVwCY7QSNt5GxOpAwBof4fY8A+AJEGK52CkSUfwmA34CrKbWH7NGlHhOXrpGRCxYsWGCIggWbEhhKG2eWJUtxCSR00xTzLBQM27KfzNDdBEM/wN3+HPO5IkQ0/Aok9HERGQVlJCbafd6GxmoRNKc9Zihl2A4/ddtqg9KGgcnUeI626rKO1y6IVmaITNvaBAf/EqQr/ZNkVbbF3KtSwjUvgmTbnQsnOLd2kED1Od6zox6bNWqOnTFzYswb90sgdZxWQUKXzTHXMUgg9O+Q9iYKhgFh+n6ZrFjBHKNMEPgVOF1R3D0LFixYAETBgs0oKFJQsBCiFbqGoKVg2BIFBkVIaOMdOr7HyRx8DNKe4RQDhA5DKjS/QgbgZA+A1CqQtcLeVAKg8N+TqgKQMjzXj8IJd9fBtZbQ578SYCt7320rdB+CqzS9gYBoOcHHKXCFLvcQAD0GyfJ6wxy/GdHeYMMe06LFLs+DaHisaFprCh2A1DXS8BvIBjUY5qyEaPaYWhtZs2bOB80ytCGxA7zP/QSZmgX3bUTT9FcTLH/CG+ONcL3XXuff6s15haatwYIFQBQs2IwDIWUEtGDeOgKb8+kMbU0YBUU5iP7kd8k4LKaT+ygBjwUchyDC3XfoEE+GCIgxwZ1/rXWLSh67k67wXc2Q0OByuCrMbYi20shWAUM2/bzoXdsjkFpMrxA0FAk490Dq9MyH1P65h6yIAgsL3CxQsdbCMb+e/2/C+GrTR+BabmxAtI7PmBkbDUllDFOkdhGAH4FkCmq1cb/dxju8x88SKA/xu/3z/TxBmw1RDpG5eoJskgLusfB4BgsWAFGwYMcKDGmK9ih/vwQipNZqyMoMZYyjso56iO+7HcAPGmbIgpIMnfUSiDh7jQcapkMbopWN62q4Zms5MhU9E/iMZYPSZmxy5rWNBAl3EhTtNp/dT5an1wCi7yA+e6pkGKE0gVsbr3MlpJ7QJd5n8mSl9kJEyQqILAgcM99XigFbSyChrIUEXDcjWtpgjOffC6nk/RgB0asx11AH0StdDKkHtcocYyM/+yUPQKUCIxQsWABEwYIdS0CURbQR52fpANuNQ7K9xuyzcDKAXyeYOoMMQhzIWQApLjgGyTjr9I4zVW2IrWh9LHQm+n2qt/LT/HdBRMQvEpQMeA6+RDZoP1zvr2INYGAuGaErOI5aHsC3o5Bmt4/yuw97r494YE41T5bJ+QFI9lgbRI+U846hlbK/CdE5HYj5HrV2AD8Fqa+02DvG30FCa0diAGewYMECIAoWbMaBkK3N0wRXa+gaMgNlMhP1nsO3/58HCX/47IQ+M/odTYhmNE2XWV2TMkObICGbMgHDSXBsVJwY2WaFVQq1+axQnQdAtsNpZZ6FCIOPVjjvUUS1Nf7rcyGi9DZzXueQqbkk5jNFgp8dkAw1vweZVtm2LUpKBgwvJlBtIINzC4ALve8YJqNzmOOszJMt2JgzYLEBTpz/MTgRfYGA8HFIuYODEAH4Ko5rH69jILBFwYIFQBQs2EwDohxcGvkpAH4VEtJYYN5Xj4mFsxSg2GrDM83UDBPwaM+rP4eIhwFhrX4RUuxPHbGvB1JxdioBMPrfl+e4pAwAfB6Syq5C6EMVwFAtpl3ib4CEyBSEtnoMi/+ZNwH8JaTG0HsxQFVDe1mPFaqDFFW8ARIiS2Ke9kG0Pq9Cssb6PKCSRlT8vBzS8+4ib14dAfBXZIYO8m/rIKzUmRzHL8CJq7MeYA0WLFgARMGCTTugKEGqDF9FlgiQTKEmVG5cagGQDa01VHlfpfo2k2GGNLV8I0SU+01IyEqv40c8FiWbABAriabLBnTomGwi8NkJqc79Jbjmpha8WK2UZnUN8nyPGrapje9tJatyKwFKS5Vx2EHG5jCk0OIdPL6eQ8GwQrbCdB1ZqPkQoftH+H113vzYxusahbRkudOAGPB6tEp2gWBRNVk3Q7Rl7Xx9N0Rz9ASAv4WEChdARO1XQbRr8yHM2D97YC9Upw4WLACiYMGmnR3SwoRq3d7uu9bGq35l62rvs79PJzO0n4zCY5DsLbVliNZQSk3wu8sGUNjssYMA/gKSSj9CJ9/vffYsOvhzyLik+Pl2iND5vwF4Ga49ynpIyHIt78eiKmAI/O47ybTsIYMz6L2eNvdzyLzWQwB0K8dpQcI4P8Xjb+V1HvTek0ZUf7QYokG7gWxPu2GXHoak1T9nzuU2SGbiCrhyAf3eMYMFCxYAUbBg0w6GMsbBN0KK+F0Mp2vRjuzVgIPtQq/PxyFIqCYFCZe0G8c6XZlk2vKi1TA12g1dwdByApEb6PjL3nnW8j3KZtkO9YMQrdATAP4RTuMCApkuMiTzIT3Xrsf4tiV9cCyZrZ59IdkU2x5F09/rDKDUpq77IbWd7oK0xLBsSj2ifc2sreb5nQapB3Szd69H4Xq7bYGUA7gfTvScJsjUDEMFNidx3M+GC/fpWO6GCMyfIRjMQkJkZ0FE4pd7gHk4AKJgwQIgChbsWACiIh3bSZCQ0rUEDrYmUS2ACAY4AJLV9DdkRH4LkroPOO3OVEGRMkPKuBwA8KcEKMpcdPB7f5gOtxvRsgETqTRd553z9wiEnvPA0FwAP01w2U7AsDTmuK9Asr9eQ7QCdQrS3HShdw620KPabjI295G12Z5wb1QnZJm/eZAK0esIKJsxXutVgoTGvgypW7TbY7/SMWtiG8f7IxBhdpd3bSNwRSlvJHN0KlmpJRgfmg0C6mDBAiAKFmzGzfb26oCEapYadgA1ggYFQimyB68B+AYk86iLAEGtOMVnyAIDDSNtJgD7qgFDC8m03ARJ8W4wgKzadZUNOLBaoR1kY/aQjfkX/n0Vv68Bkgb/k+b4O8mEDBNMFMi43A/RGvmMzcWQsFURTujeZM5/gACqFxJme4DHUmvkd6uOZ9hc75k8Tpn/v4UMkbU8JOvrIER/dT+EcVOWRvum6fEVDGoW33mQ0NfZ5pgjcAJu1SudT9B4AaI1jWwl9K2QtiVH4ETaQT8ULFgARMGCTTsYss6lM2ZuV8sOK3vHGQPwNIB/hWhEACm82OGxBFM9b83uAp3lX/D7rKZlCSRT6VJExd3VmCFbZRrGWQ9AenE9CBEtbzEA4Wch6eRdBBh6/K9Biixu5/FU0HwY0eKMyiz9Ms93MUGENlmFx0z9DVmWoxhf7yepF9xcAD8HYcrKBCadMdd/BMBfQ/RCI5CQWd4DLLkY5uYcSH2hcyDhMmv15t73QMKHRY5Xo3fuOge3AfhjSAh0N1wmZCGwRsGCBUAULNh0mYbKSpBwyVo64hxBTS0hrbi6P8+TGfoP/n4ugM+QPdG6P1N5fmzIZ4iMzb104KNkjJYSgF0P0aNomGyE4CVTBdzZukJlAoLdkPT9f4FodRQonQ2p1fSTHLsBsiqHIHqmf0JU02OtlWAxS8BwTgJjM0LwpantD5CxsaJoZX38ekYrIGG7DIGQ39vMgpwBsllat2ireT0Hl+6uzBAgJRq6eS0qym42ADLrzSWtR7TYu6d5w/408feNZKd2mmtEAEPBggVAFCzYdJmtSJylU1OGY65xONWyyzTrSp+Hg2REvs3fewD8DEQnModOLofatTuVAFiOIOVLBB0KAs6m0z8PEnbqNNfcUAXkxdUVGiVT8lVIFtnbBszcBBEBX8zzOQLg9yFhrGECh3cTvutUiHZnOUQ7sxyi6YljbF6H1PvZwPE+7IGhlPevBVyfIjBs4O9zK6xpz0M0Ua8iXouk4m/tKdYJ4Ccg4cgM2Z5mD6TpfcsjWo4h4x03a14fgojxX/LAXWjoGixYAETBgs0IQ2Qzj9bBtdoYTnCwPpNij7MNkub+dYjG5jQyBrcQDAET0yRVMhV7K4DpJAO1GKLfuRGixbGONFWFGdJsNX3PZl7HTohg+St8z2JIgcc1EPH5tXz/M5AU8j9J+I45BAydkBT6D5ERmkdA5J/bfgKfXkjI7U5Excwq8NYyACP8u7ZCaeM9uBmi0bFMUIFgpcDr1Cw1ZZ70WG3m2HkzV7Tb/fkQrdBK7/h5wyhVA7c6F4q8piwkDPgUJPSaIkDNI2iHggULgChYsBm2IQOCamVqNOsqRzD0VwQO++n8fxHA1QYMKTMwFTDkg5q5ZECuIvvRwu/riWE2KlkR0TpGhyAVnp/i3/cRDDVDsqduJyjo4VrwEIA/hIh/k2wlJK39AoK3U+BKBcSN75MEKG9AwoL9MWOBGMbkPDJCCrZO9l4fhtMkHYTUa3qJ9/OIAUMg0M3EfO9FAD4HCcGdnABWVeeTq+FeaiFHDVMegITKvgsJE2YDQxQsWABEwYJNt6WMc2mk09R0+Dzim5P6ztoeKw8JsfwrHewKSLr1R8lWlOnUGlG90nUtZsFNKx1/nBUgjJRmNzUj2n3eMkO2wvUGAqE7ENXQdEH0SLdDdFFqAwRQeYiIuwuiX8rA6WK6ySR9GE470w8JhY0ZFkZrHO0BcDcB5l7zXbZCs7Jt9byHPfz+GyHM3AoPBGntInudj/M6e2OYp1EPHC3nd8zj8W9DVNSeMwyPvc+jBMmHeB7DPM4yuDR/my24gUDwe4jWOkIAQ8GCBUAULNh0mS0AWKBT+j4CmFPgtD2ZCqyKZp3ljGN/m2AoB9EifRiuAGGKYCh9jK81DxE3b+f3nwpXD6fkgaY2/t4LCXk9jqiGphUSUrwW4+sJNUK0V/MJIJrgUuTT5vrnIZpN9VVIkcMD5pxUszVCIHQ4hsny7SS4woeLIaxZp/eZtAdS7HX2JoDmLFyIrBMiGr+SoKfLgCHEAE1rGwjsvgvRfB2BaK9+inOuYJghPa9H+N40nE4tgKFgwQIgChZs2ueurUx9KaT2kAKEdA1Mjm15UeaO/8MQbczH6JhLZIZq6YE2WbOd6QsGyB0ha/UOGZiVBkyo/kmZDK3irPVu7vJYGZDJuJQ/jbyujAEDSxDf/FRtEBJWHCbY2QwRgz8xgWvNwRU5bODvrWSrboDTMtlx0XuZgYTdNCT2kmGGUpAstDycEFyB3hwCrHMxXis0xu+pR7QsQC/ZoAFIRtxzHNPnDbjSc7TZfHGMVRMBa9AOBQsWAFGwYNNuKW8ed8SwCekaP6/siWpWGuCymMqontU1HddiM9aUYTkACbtshmSdddPBlwzbYJ/hdyBZXC+QlVFmp2jAyDoCgixchpf27YoDfC+RZbKp7IfhwmPvTfBal0G0OxeQWekwoKi7AmAFz/E+SP2knQQsvd7rKY+FWUig9SFI+O1kD3DF1acqE9TcT4CjITK91jpIxXK/hcpeuHpD9ry0VUmwYMECIAoWbNpNM3s09JExzFAtYQnfCdaREVrs/T0zg8xQ3DlZIKdamcWQCtKLCR4sI9FPgHKQrMS/woWItD9XMwHeOkhWWZO5ZmtDBAADHMvtZEa2wVWV3pZw7nU81zb+NPP8Vbhe4t/PhqT3r48Za99KcA1m+yE1jO4mUBkz11hHcGYbwK4mGDqbQPdG89ogXJsUDZntJcAaItjS5rL7vXNaCxG//6gHwjdCCmrewc9o09uhwAwFCxYAUbBgMwEYUoYhyZFxOAsSwsgYUJE6Qa8v47EbnyKg0KKBqlXR63uDjvhZSFuNvAco5kMKLl4HVysoyTZAtC8b4dpL7CeAKEJCR0nWBknjP4ugYaUBXkWz3rQSSLTXMB69kBIIz0CE2wcIVsY8wOqbVso+j+dlv0vnjQ+uHyYA2kLwtQcSmrOMUxekQvYVcOJpcIy+wGPsNyzTcGCGggULgChYsJkyddQlOqWzICGYNgMSJhreUq2K/jsKSVEfhITL5tCpZs37Zwpw2eM2I6p3sfYugctDZE028u+LCXpSHJPLIDV8bBbbQYKNAbgCkUUyL/dUAT6L4YTVOg4NkHDUaQRFp2N8yYBqNszzOkDAMwipkP04RBO1w7y3gd+r3ePzBEHtBFzag8yGPbURrt7DrWSEigRZd/H6j8ScWx2EobsUUsF6ngFXm3l+d0BYphTv2zBcFexgwYIFQBQs2IwwRGqdkNDLBWQdypNkiGzlaJAd+AcyJqdBwi3nwKV6l3DsWai8YTaOAPhbuCymXeZ9H4VoW9rI0JyE8dqcVyHZYa/y93pe00FEu9371sJjXw0Xvqs3zE+z+ZmoafPV+wjWVKO0Hy6DDRXG/AJIaGwthBWzdaNKHkge5PU/AAlpjcKJteOsC8DPE1x2ecDyCxAWa29ghoIFC4AoWLBjzRBZB72azjltWID0FI6dJmPwbbIulRxrLUCrmiNP+lzZA4A5OtptZE3+wQCFHgKfMyGFBs82x+qHhNKOcnwOQLLC7sb4LDTLwCwjyMwaFmgdpH7R+irnrwUKM4iGp4YJuI5AdE+2xcVLcILpOCBcB9c2Y8QA4sU8148QEC2L+XwGwnr18XvfIiP0bMz36Dm1c351E2zdDNebTVtyPAXRGu2Dq0E0hJBeHyxYAETBgh0jlkitjg5LQUrBMEQTASy2UWseEqrZDRdyOh0SItJ+Z7WwQwpqSpg4a6UaqQzGZ5H9JYBHDRhaCCkVcAtEMG0LGR6GNHF9DBIe0qaphzC+NpC1bgCf5rU3wnWTnwNX60jtAIRRqyMwa0c0W87aXgBvQoTazxKk6Vhpe484i6sP1AjR8nw/JKzYE3Nu1t4kI/RdCBv1XsxaaENcCyC6q2sh2ivLDG2HZJN9lyxRynxeAWQhsETBggVAFCzYsQRHWQM6JuOAisaJ9dNZP0oHfS4kVNZtGI5qjWLtuU0GnGnFYxULq95nP9mIf6azPQ1Ot3MNXP2erXT2h+iwv0QGAxXAxhwyTHptlwD4PKJZYEMEPu9yHDQb6wWCyMv4OS3mqF3r3+G57IeEpV4jGHo94Xz83maAE1G3Q+oktUIKS15HIFgXc5wDZISOcvwehYTkXjXvaTBsk4JpzU6Lq4tUgIiu74L0e7MhtlFEG7gGCxYsAKJgwY45KErHsEe1ghCrHdpORuUh/r4E0ZBPagLHnej7y4ZVaDCvPQZpivo2XJf4cyBZVGcSHGhYbz8k7f4esjH7a3DSWqH6+wkytIWGDRVuBfBvBDLq+I8SIB2AhKnOR1R4DgKmPyIIGeNYHyLIizMNWZYxXpCc4Xn+EKSWUAMZoaQeYy8YANQHJ9i2x/O/Q7PT1vFafMapH8AXIWG9I+HRCxYsAKJgwWaTqV5jsgLnkscqPE3nuRYiHm5GfPiqGkgDmZMBuHpAuYTvV1CnTMcAwdlGshEqNG4iKPgMgI97wClPALKRLE6ZrM8ciLalZACX1gXKEMx8CKLB0evbDUl11+7xjxFoFT0mp4fg7CxIZpeGlQ7yGI9Bsq/iAFC9AT9jcJmDI4a9mcOfekj18OvJCDXEHO8wQdohjsN3CIi2evelzoCzFEGlslln8viaRVaEsGv9HIdnIGJ2BZmL4RixnLmeQZ5Dv/neoCkKFiwAomDBZsym6mT8kFaKjMtKAL9AoDDHgIdMBeDlg7IiJLyygcc807AuKs5OEh+/ABFNvwGXhr4UUhDwk3DVtH12pQMieJ4P0b2sJuvRCNfSQoXJei31EL2MrgXfBXAvhCXbY0CGb5+E9PI6ld+nguOjkHo8/wEJi8WBITuOJcSHOlcTAF3FcWvg9dUnjP9GMjdPQdixfTHn7a93PZC6QmfBte/o9u7pDo7FvbweBUPtEPH65RyDdt7DAoTN+wtIeFC/NwitgwULgChYsBmzNJ1QqgbQlPQeW9hvLhmCLKTeTI9hX1AFDNnQm2ZyPUlAtJKgY445njJOCmxGyQJtgIS87jIMQycky+ljBAiWHcua65gDaVyaIaDIeQCskuUJgN6AhJk2EYh1Q2rwdJjjncnxWctzOAoRLfeRnbqf56/MWjOPNWrGyrJNbQR8Teb3iyAanksSzneYDNY+/jwBEU2/YN6T4/iOGWasmePUA5c9Ns98ZtSwR9vINN0FqTfUDNFtaXbbeRD91irv3NYA+Jo3x0JNomDBAiAKFmzGQVESY1QyjigbAwr8ytBLIGnrGUQLC2ZqAF0WEG0D8HdkSvJkSb7PAzJ5RKsdvwMJjT1AMDJkXmuEhO/WeUDIf35byAzVEQwMQlL0d/Dv65FcIbrEzywkGFlJgHg2x6XFfJ/WGfoegG+RERnheQ0Q2BXN2BXhCl/G2XoAP0CmRe9LN6I6Jt+OkhH6Jsf7IMZnzqXNtaktJvN0A8HNvJg1UQXx75Ed2gGpRfURjmMjf9oQX4Cy7AE+PV5giIIFC4DoA28pxDeQLB/H80liPI7neU3UCmQJtGhhxjgeX5dTbSzU0S/3jl9rXaOUB6BaIeLfOkgmWKtxlHWGbdkA0Qt9Fy7ko1ZHYHIRJOupzRx/jIyMapSaCXaa4cJxbwD4K0iNnxUEVQp2lnpgUENnlxAE1RlWaJDfo8BiP4/9TYi2qJKNwWWJ1cFVlG7k9y8gy3ILXAf5JBuBaIIOcNwegGTelQ0AqjPfp+EtzUqbh/jssQE4xs6C5Hrew0UAPgsJoSZZkcfZCslU3GPuQ+hlFixYAETBjGPOeDvW4nFcKFPmfFIxO9viLAVFZW+3P0wwsZaMgjq0EqaninQGtafY22dpOYDfgIS8MgQWJ/G8hg0z1AvpHfYCwc2QYVQAESn/AkHKXO/7tkNCcm8TKK2DhHA64LK1xuBqKu2GaJqeIvj4PFyIyloHok1L7yLTtd2cV4HnvnWC47mS7Mx6sk51cLqdzho+vx3A/4VoebTAY9ljhOLm7QWQZqwrCcb872pM2LSsBfAr/P/SCsyaPt+bIdqhZ3mu2tw21CQKFiwAosAKzQLw45+Pgor3wwI9RrZgkODBd4h9dFIgQ9JhnFicA7S7+YlUvPaPpQAlzlr5PRsh4SytdGydczOZkwsRrZBcoqPdBMmGe4BMzQpIKKjIMSnz3NsJPho5RgcIogAJ9ayAy/KyxQ+VVdsKqXt0d4XrXsLrzRpgmPLuRQoS/jobUjtIz6mSjULCYHvgND06Xoc8EFQyQE2B5CJ+x1yCsFsxPiuvzPNV4OJXFu9CtCCjhjpVu6bAs49g804CSD0/q+EKFixYAEQfSEvDaVZsgbk4BqJ0DNgYez5arfhENTtWRbgigTZzS0MemwH8b/7/t8igqGOLK7BoGbPp7lM2QjZExbr/l6DmQMycuAhSF+h0zyH3E6DcQ2CkndX3E+C08Bq0gORCSA+uAUjm1aOQNPjnCTTaDXuR9tiuLI+TxAI1cDzPJxhr5fVpy4tmD1DWw2luGmsYr/0EfHcYwKgtPyxo8cFGC0R4/hmCtXoyQg0Ja59uEvIeUI7TnKUN2NPXhgky/wXC9B3y5mfQDQULFgDRB4oJ8v+v6dSWMVgMFyrpp1Mc8hblY3U+WZ5PpwcMRumgD9OBz/adbZHnPIRoxpUFT4UYIFXr+E3WVMytYuJ645A3Qvqk3WnAkNbH6Yak1N8K4BOItiR5lwDqnwiGmiAi5BZI2viZZn4p4NCMKss+fRcScnpzAtfTTjap0YCb1fzec8zcztYIdjQF3ZYaGIQr2ngErtXG3VXAcTPHrZvffTIZodsQ1UgVDNNkQ6HKptVVuI+qScuZ+9gPl5X3bZ7nGN/XxOcnaIeCBQuA6AMFhtLezjHFxdA64AshWTSr+fobkAJvz04zILLaILujHfbetxyS9XSJYRUA6fF0DySFeZsBRMoszYbdrj0HTVXvhehDGgxLlOZ1/qq5ZjvvZ7JTfdo4+zE4rU4vpAfWo5Awi72meRCh70cJNCw70QfgryFZaNv5t++H1AHqgYQCl9RwXnOQXNm5kp0D4McgRRxVZ9ZB9mouqgvXfZARVwZgEyRd/zGyQ/2Ir3/k26kQkfTlPJ8m/puJWevsPC6a+V2fMB8UBCnwti1Vnuf9eBoSLhsz9/JE2EwECxYsAKJpBUNxNVXUVpGBmU9HdytcltAK7i6H6AhGPeAxWdbCppnHOQ4Na6znDvos7z0jkDDTSzMMGKYLEA3zfN+F6FPaeN5FjmU3HWUcYJnpc1QtTh3/H6cZ0tpBSyChp5vhMplGIGGufrI6/0jmZCUkJPRDAC72GJZezqU858EY59gcfq4VLmVeGaQ8ouyhZYBaOIevgzR7jRu3Ilzn+kZ+1hcS2zCczQTTAoq9vMYHCDD8e2XBRRvPScHYpQRE58ewUAWPEUrFACW1zbyOPEHVMoK+MqIlDvZxQ3MnAdxGcy9zcFWwgwULFgDRB8JUk6PaA996APwSRFirugrbF6kTEhJJAfh7OJ1GxnMi9icJGNkKyWMJO9O5PJ+z+B0aWvCtnz+DMYv6bGGHbIr1IKQa8Eo67QVVWIhjeZ4jhhnaSWboGUQ1MFkCoOsJQE4xr71HgPAMpFDiEQKaX4Kkzy/2mLInIXWB3iOzMgCnrToPwK8RRCz1AHCc824H8BOQMFwdnGA9zt4mqM/x/Fca4JM398sHIrsIKL7D8TnssWZ202HtNAKgi/mcdSOqs/IZoZQBaBqm86/lIKRH2XMck1Mh2X3n8XN15vm6i2DoFUTF8EWcWCUrggULFgDRlIGQMhC6q24hC9RjFsWzyAgtMJ/Nw9H0jXQcZ8EVytPU3amW+O8mAOo0bJGez1zvvdqos5GOYjfZlkOGZSlXYcmqMVjT7SQsICpAwivvIVrIsGTeawszzjTrpdeqvctGDLD5mnH4OQhLeAaAT0GK/qm9CQmLvUzA8AT/vprg6ZNw7SV20Ym/SjD0FuJF0Bsh4dHzyJjtIZA8BFcbaL65l+eRgbJsUi/nR78BNwcJxF7nNZ8N4HZIpeYGRIXJQ/w+7UL/KsflO1XGs5lzeQ7P8XIConO9944ZEGxFz3EaoYMcJ91MvALgy3Ai9Syv035uA8/5DgCPwPVcqzPg71gkSAQLFiwAouNqytLkOGaD5rV1dFTrjQNpMQ4GxgkqA6TZMXk4Qa3ejzwmT7k3Q8Jz13CXW2fOZ27C/bcVlvcREB0xu/piAuuU8pxPEntVxPSm+Zc98Ag62HzCOWZrAG3TCYjG4DQprwP4S0g4yLIfXWR6LvFYob0AvkBwc4TABQRXv8h72+29/6/IIg1VOK8DEM3LGkhYbjGAf4eEp1ohYadrCerTBB/N3jGegmhmNplxHyNI2mlAwxwIG7qAQDttQNkDEP3UfjJYfTWM6QoyaFfzmUpihHIeGLGC6EaPFXscwJd47lmeh4IhDUnacd5jGL6diIYYFYTlEG2gGyxYsACI3pdgSHf+yqjojv0USKjmOkiKtO8cRxAVOlsKXzuCHzDH1H+1Fk0jd9r1/MmYY6cMU1Iyi/lH6DzmxpzPKKINTXN0tiU6zEfgCvClKzBEVph6PItLpgxjV0J81/sU4mvMTDcQUmCpWUivQyo5/zsdaB1BQifBszJ2qoM6TIdrs8+yZJGugHS3nwMXplWBb5MBH20GMGYRrcujXeMXmO+dS7B8OaKVm0E2ZID/300G5Z6Y+63VptsgwvWFEIF4qwFjGzm37uU1Jlkdnyn9bCskNHYjonopBWPlBECeNmMAA9YOwbXjuNewPCAAOhOurccZ5nMPkxnabwCqZm5WKqsRLFiwAIjeV2BIwYN1BHMB/DKkAm4Povog+9k6zylbZ6yiV78mUBd3xau4k19AB7MQrtO3dfz22C18b3eF87GaCrVdkCymRwnUGsz1ZmPO3dZtOZ6mQMemuSeJZgvGWWam+Ty0ArUFAX8DScdWNkHTwa+F60JfgISuHiGL9C6kR5faKZxnF8Olz9vih8sB/FcCl6y5v3pOGsLNEYgtNCDmarhstoXe9bwO4E8JZFJkn95MAL/rCVjO4nFOM+xSERL2+zYkLLWnyjguBfAziAqkezC+35jPCPki7px3j5XheZnXMhgD9K8he3YW70+GDNwfw2W+wWxcchgv+A4WLFgARO9L8/sQ6a63DaKxuM2wMKNwqe0pRAshWuft74YX0aG8B9c7aimZnpWQ7CMFRPUTPH8rsE57C7gyK0chIRDtCXV4gt+hNWDa4FLeLVgbplPpQ3xIa7pMi/5lKwDb3Ax9t4KwVl7jVjrQf+d4dpBtuJDMwzXms71k5F5AfL2duWSHTuZ9O8IxV5DahvHZVdVMgWEnXAuLPCSzcB8B8YMY36OsGxKGVYF1PefljfxRMLifc6rIa/vPGDYGPHdlrvQ5uQTSViSuhIACcJ8RSiWA3C0cryIkBHmHB2oUOK3i/fkoAWs7v+ttSGhNP5fiOY8iKkbv5MZFq4FvM8xaAEzBggVA9L5ghlTPU4ZQ5OvNrnoRxveW8ivcxlVBtuyOOrNGLrBz6FSa+NMCl8Y8mWypnMfsWN2Sht+2Avg/GJ/9VIu1QIStl0FCDYuNo9Zr3wkJGz0BCbsUzVhMt9g6WwF8zpRp2KSB17wFwJ8REOl4ng8Jj10OSeW21sr7ntTHq8kAGNtHrIwoAzkRi2PHtkO0SI/QqR+MAZyfIGBYwnnZyn/nmPt9CMD/g2sPMgYJB47EfKdqg66Ca6nSzmcraT6XvJ+koop9AP4DEhobJPDfb56FsgFlP0LWbh5cgsNLkJ5kz3uf0ybC9nqugNQYWwIJr2mvNZ2TQVMULFgARCc0GFIHpGDoNLhaQicZZ6gZWpNxTDkeaz5cP6VKLETBAzjlBFarFqGzvlebdO7nNTSac6vjtbea67OF7JZ5gChuDNbD1eG5D67QXhpT1x7Z6+8H8A5ckUJ/LIfIfhTJSrRjamEzqxlqNIzENyD1gkYh4aMLIPqyqyFhGBgHqZ89iU51kACyYMDQxeYe5hKAU8EcM2PGYzPHu4nXO4/XXm/mbtYAmZ2Q0FIbz7XDzMv1kKyzNeZ7D/J79vL7tYXFP/Jv1rp4b1QL1wERcl9P5sy3kZiNRpwuSG2QrJSGJzeQcXvWW+s0GyxNQHYJhOldbsbtFYL4/+Q1aZmKIUSF66vJmN0OVxV7HqSMhgWfQV8ULFgARCcsGNLMqiIX79MhWWTXIlrDpTTJ8UvF7L5r2dVXS4H32apK16e2CFLxeD5EI5LnTncJnegySDih3QAzPYY62u4qgPBCSBjh+WkERGXv83sgoY0igCsxvm7OboKVfjISFyGaRVXGxITWmk2WNeDgLwF8C66i8ccgYZgVBsiU4cTQep8WEhicw8/auj1dGK/vSXqGbb2cvTyfx3iM0wjmL6PTTiOqR+uEhPPWEfTM5/3NkP1aSECjdj+kjMAOOAH+KIF1HBi6gPNgDeecVpOek3BNFoAXzb9a/NC3V8nobOHvo3BNfe1zptmhcyB1hi5DtJ7Tm5B6RE/ChcA1M9SGv1RDeBEkpK3P1BFEQ8MhBT9YsACITkggZH+Uil8M0XxcT8embEMaLptoNx3+KBf61QZAVCoOaENGZcNIpar8TNUsIOrhDncJd9P9EL3KUl7DSYi2vKjEYOXNWNabnftmw85MZ6jM6qMOQ/QebZBaOL6j7YMLfyiz1TxJIGbDVQXe+0fIjPTR6V9KMHRlFTCc4jyaj/FlGuzY7oXLRiwjWol7IZyY2mba1XOu7oCItTVbLWOAmdoKuLpDceD2KMHCQbIvDxBgxlkLXJ+8FohG5yyI7u60mA1AHuMF78puZmPWqBHex/383CBcz7OBGBCk4HXQMJuXQypvdxlAvZnHuJfXm+PPED/fzp8uMma3G5BYQrQWUbBgwQIgOiHNX4SVnu/irvbDdLJ1ZvHWCsTD3Cl/ia+dCuC/wLXEUM2BZXdSCUxO3HuA6U0R979TW0dcTGel16aFGhtrPG4GUX2Q2rtwdXL2wWkqplp80hZAzNJh7YK0VDgSA0SzkNDfCP9fmgQrpN+b51zIQrQ3X4SEA/vg6gtdRoBTKeutVjsE0WDdCQlr6bV3QEJxnyDrkuF8LPK7f4739L9zTGztrALGd22PC8cNQQTJT0Gy4A7ANWFNsjMhpR8u4DGb4cT39QlzRzMFbWHDpIarG8hQPcrzKMBV5o4D/naenQrgpznfuwzgfBHSNPdFbgo0ZGy1QqvIol1KUNVjxjJrwGBYU4MFC4DohGSFgOSigau4kzyTC7rqNDTFfhsd/R10GuAiOmwWYXWIldidcgJYmWkrG6fYASds9c1mq6ViWCwFlLa9wV6INukOOvIjZnyA6Q0lZIxjOsJ/fQF7F+/lUbIhdZMcL8tM5SFp3P9Ch6w1oD5qGKo82QdldzrInjQjKgpOxXyXhieLBHvf9Bz0xd7czcJ1uwcBSBmS7fYGwekrEN1MqxmzfoK5Pt477cXVB8l+/B7n+eaYMWkjo9hmQNWVEN3U2gpMoi2uma1wP4Z5Dv2GqXqagOi7MfNAmTKtD6TPXw9B48cgIuoMAdQWjsv9/Bky900Zz9UEQJcQEK031zIMV6x1L8e3L2bOBAsWLACiWc0KZY0D962RO9yLzGKfNwt3P4B/BvB1AiPQ0V5Gp6cVqP36OOkY4HM8mqhaDU61OZBDcsPZuPDXLkgI415IjZ0jHjNRnoFrsf8f8RxwFqL5+BB/10y+idyDsgeah8jWPGHYkp/ld3R4369FAA9wPv0QpL6Q1qFqiLkHtsJ2FxmfBnNtp9Gx6/wciWHzdpPZ0c88zTnYybmt73mTgOcFw66pGHiYf9ufMC5LAXye56HP1Twka4MUQNvq55kK4/+mYW70PvTCFa70wVbJMIBqcyFh7w/zPBVAvwIpNPksQddozDFVK7Se4+bf23o+H30E/t8ia2jnewihBQsWANGsBUJ+L7IUd5AL4Cj9ZdzpngRXFdhmEz1N9uNN/m0lpMfUJxHNxMnN0nFIxdx7XbxtMcoUKmerpQwI2cexeYwA4EUz5g2IdgFPTeMO2rJXyqb0837payoMniqA1Ey8w3R+9xEUXEtmaLEBz1vgemQ9Tud6NqKp4gqwBwg6RjgHm3k9mtp+GiQ09g4/8/0APuedYx/BSx9E6/McRNu0jcfdzjm7iN+nKfFvcj6/UWUM5vAaOuA0TJcTaMTpzEa9+ZTxmERrWrV92IzPEY7bXXCtQXygnjH3vYBoJfkVvNa1ZO60X9wGXvNTBKuvm2NqpWwd/7MRrTemINHW9eoni/Ztnu+IeS4CGAoWLACiWQkAlBXKIJo+u5AO7Qa4vlINBEPaoFM1Q4fgNCPvmmNoNtraE3R8ihhf3K5aw1ZlX1TUfC933HEd3YFoaQFbRXmq7JAVph8kEFsEERFraGo6ut7bLK5eAF+FVHL+DQDfh2gWVh9cXZ+3eR63QYoOzok57ouQYog7yQadTqC1jCBrOaSC8xBB0sqYY7xCMPoi52kfQVa/ed8AgK/wvPL8fdBj8ZLsbIKKM+HqLnUivop03rsvCozi9FSHCEy+SaamzLkySiZoV8L5qIA5Z+ahsmHdZOwuhksOUGbvi2SFDmJ8vaVmAJ/hepDB+B6A2vtP2d4xAs87ILWLRswmIDR6DRYsAKJZCYbi+m6tJit0OtmgG+C0FdZUl7GNC/e3uHArcCpyIdwK0TV0wIkyi3BdvnfxWBeaRbZYgYGZTlOnpA7pMCSctZ3nN4/OYzLnZbVYdZCMtXkQvcdBOraxCozdZJkiq+nRMOQR3oMeOm5l/EYwvj5TqsbvsFllI2R+HiFTcDmZodOMk36XTMFXCEi6ANxEVucic84bOT576KAf4BxbQLbkOoJ1DfOdZc5rL1zKe4b/vx/SOd5nUxbwODkedzuiYZ046+TmoIHXvZBg7gbEt6mJY2/i2NFhw+DlOTc2EQzeifiwlT5ndh7H9dKzZQougOiFFpvvfY335e8RTak/i0CoCKcDOyfmvHVDVW/A1Vsc80cJkjMBBAULFgDRbAZDWeOs1OYD+BVI3ZVWAhUfDI2YhfgIJK36PzxnorvZg2QMHiUDMJ/AqJ/gaSskpHQ6AYOl4HPHCBAVDCDaDumq/jQdwYXcRdd6Xv5uvxNSmmA9XBHEe+jo9lRxnAoQgPjMr3IMuLWOUQFRjo7rdQKiz8JlTo1BQk/ZSYybzSrbAOB/EcxcDwljrfbYjj8ncN7P+fNxvs+GUndAKhq/xnk2zDHTUFYrpF5Se8w5Pw0JI73Mz2mvsS0Y3z2+DsCnIDWI6nlP/hQu4yyD+HpQqwD8FM+5HS6Vfqr2FqTg4QsEzCVe84EKYAgGUJfN3NOK0To/WiFaoU9CmNrFZm49DuDf+L3D5rhtAH4Qov1T4LUyYZ7mzaaiSEbu2xC2eAtcaL2M6a/CHixYsACIpmRKW+fNTrmdu8HzISGMHs/xWSet7M9mOFp8AxfkZjqVUbODPAynR2imM+6DSwfWFOSMceITYUKmO/0+i6hWJTuJY+j5NcDVabJOpAESMtL6OSrWPUAmY3Qa7nHZY6kGIRqRe+noVhtWYzKMnB5fw1Jf4d9/iQwReJ93E6x8kyCwCxJ6+RTBTYoswh4C5zsQTV/PGSB+hCCkg2N2mOP4No//UAzrplqjHrjss5Mh9XIuN9+xGVJ4cI9hmOaQ1Wvg/2+GiL9h2NE3OM/94pFJomgf3B4ke3cngZFvtuiiZf+KHguoz6o+rysJ5JcTpN4GV4rhbbhM0Af4/tW8xiIB360xc3cE0SxKWw9pGKLlupfH3ASX2RhCZcGCBUA0K8FQnVm8s5CidNebBdRqPnQR8wWf27iTf5b/VzFltSrLg4jWfekC8DtwNUy0dkk1dsgKM6cSWvObmy4D8Jtw2pFORPtsTYS1sjWBrF0BqfvSj2iK+RAd8r8gPpV7InM3a5y/ra2zA9Kl/AUA/xPRJrwNqC2rzLIRIzzmC8Z529DRdjJDT5PpaSIIuR2ivUlxHB6B1K16DeNr+RQ8xm2OmY9bAPwhpLhkEuN2M39WGvau3ruvqyEFCUtwhRXrIeG5m8le+nPhX8iE7CUI0XIAFtTXAojGeM1J5x+nKfPrTSkD42uFLiEg7DJr2hG4+kIvGEbo5+DCjw0Y319OmTWbfGEZ0VfJtN3F+VvwWNgAhoIFC4BoVphtYqqL5mI6pZshadGdBgRp2rPudMcg4S1ldZ7i7tKKL0eNI+nhotxgdsq2zYCGni4H8GNw1ZHHDMipdj2ZaRwXGMdwXhVAORHwaU1LDthu6r5102E9TYA0aoCTLYlQ8ECthiv6+blCzLloheZ36IDXkaFZDhcCrYUpKsJpYY5Cwn8vEXBcBAmLaphkL8GOCu3PIsi4jE66l8zIfwB42JxrU4zTnUsHv8ic3xjn4BCvQzMilZlYAicGTtLuKJN3qWE3D/JcPwMXNgJByy4yOX/H+zSdVodo1XLLBPn3M2WeVV2z5nAM1pMRWuoBS806q+NcOw3CDl8B4Me9MSpxLuoGJWu+0zJDezin7idD96Y3X/MBDAULFgDRbANEWbN4dnJHfAvZis4Yh2dtC3eUz5mFMikD5zQ6vcvpxFIxzJGGiboRbRWRxfGpP3QsrJZSA6sA/CREkHyQDMu7dPjaUBYEIr10bi0cw2FI+OaZBFbChuF6AfwJJJT56wQOBcMUZSowRHZ+7CSz8x6B7cd4rDTB817jDFsgGW7r4FL9t0LEvM97jlibhyoQ6IFkcn0IrpVHmeDohyChxkX87hYDohoJ/HMV2C5l6boh4ugz+fpcRNuGPEJG6HV+37YZmCN5b/7HaW4sK+Trfq6D6LJOxXhtk2acdRDknQxXp2lpzBj1cZ7NMcyozhGtVzUKCVXeBQnDHTD3rBSYoWDBAiCajWDIghBtvXGz2f1qMTxbHfdtMg5jkNDYtzFe49BBJ6QMQztct+6Lajw/1T5ka2RgytzJ9/N62hFtyDkVQKWLeMlzPrWeV8qM51G41gnNBAHKfNgwiK1yXQ/JYjrFAI73EgCR9kFTQDQE1zC1l2PaD1fHxnah74fovvJkT7p4jCyigmzfOcOwBEOQENfzPIdL4LLKDkDCMfdxDBoIkK+kI7ZNYFfRMe/i32zNnbIBJ7fxXFOGgVhA8FjC+Ma11sbMNZUxvrK4hmp74ELG2vJkgMDtK5DMqYk2380h2i4jThxvmaByBSaz7LFCgIT7enjvr4dof3QcBhCtS5Tm/V+G8SGxtwjCC5wXYxz3LvNsZMwGZhOkztC3CBatfiqVwGwFCxYsAKLjCoYyZqHt4qJ5M3fr/u60wTAIX4CIZZVd2JnAaPy4OZYWc5w7wXOspM3xHViJ5/IGAcR6uJov6ignC4pUCzXRtiF++v4wAeWTkMyrFRAR8SnmfvhsWNz3LCLA0VBjUsgszb+dyfs7BAllPAnJXtphvsM604MQAWw7XMNVdbj1HpjW68sRkL4OqUg9xntudWb7CKC/RbCzBFKT6FoyMWM8/1MA/A/Os9/jMcved4NOeKX5m20N0ZVwT/p4nmkCtkZEs51sZp4/Z56HVFzfyPMc4P+Lk5hTeURT4pN0RdWe4YzZPFig+Mtk3Zp4Hy0obDT3VM+9LuYcXgTwN5Bw1wjn3EW8X2mzBjQYwPtnBEI7vPMvmrENFixYAESzDhSpwHYORDdyFRe9UXO92ol+AyQd904CI2t1ZAG0+/cVBFdzE3bl8BylahjsbnIyYTLtz6V6keker9QM3490AnCzYQYdm7ju8/UJf++EC5VoledG77uLBviVIHow/f9a3stGD2BahiBNIPUomcM2SNkEDcmmOa+G+NoSMpFXEDgpKGg3c0+Zs7z5LlsZXOsoFXm85gTgocBtHyS8O8JrWh7Dcvls0ij/NgzRRP2dN7eaCWy7zZxVMK/3so7XXObY74KEPS3rVZrgHNQ5oefSDddhXrNC58awYVnD1mQ88LWX5zZMcHMvJHSpdjKkQW67uec6JzZyffgWXHHIJjiNUsgmCxYsAKJZCYSsE0hzR36mWUB1sa03zNCfcMHrTXC4PwsRnOrOu6cCa+LrEjIY370+VeN1WBZnLiRUoALcYwVmqoEcuzM/lcyVhszme+OQqsCWxWWnTdR6IeGqIsbXKdL7nqeDOwTRid0C0eTUebt9IKoN2Ud2YCPn1AWQ8JUK5pshIbSlkFDh6YbFKyJaxO/3Od/e43OnjjVrgNo2AH8EKZL5w2QF/dICNlQzBAnpFOEKUWqpiYzHYOi4qNi4jvM854GQSyDh4DMJeurhWpbUmXVDw447ICG2f4KE3OAxVNWYSn1WLFCEYQHPJ/idG/PZsjeOFhAdgCukqhlyOzxW8sMEREu8c+2FZCk+BgnFqo144xksWLAAiGYVGMqYnWWWzuQaLnJF4+y0jcNmLnR3cOFTAabqiubQ8fmMUAnRGiya0VTPv6kWqYNOsxlTq8SsXdrX8PPNnjM43gBU508XksM5qSp/twCmnAByfQ2SFpjUkKJqXnZifIgIBhyN8D29nBPtkIrEiwygtXoQDc9tpTO9kD9dcKGd1bzfwxDdUwei2qlBzouHIQUd1Vo4l/IeCMhDwmn7CcD3wYX1LoTrYJ82Y7+Kvy/D+AavcZYz/54Nac66mYD7IkhYar0338oQPdcIXE86ZaqKk5g7KTPe9vPdBJZL4NrpnGaevyED5rLe+qVs1R6e60aItuub3jmcRmZoPcGQrwFU5vgOs1lq4z3OB5cRLFgARLMZEOWMA1oM4Ee50PVw8dYqxVqf5o8gmpBe4/hKfP9lkDYLqxN2pDlE03qVAdgD4A/o/NZBdDTr4Np+TETz4wOOTrjQ0vvRUkjWYsSF2spm3h6EaHieNU7eP5YfuhmDZKjtIHD+aUiISEXH5Zj3d/C9Z3lMHcgIlT0nr4BpI4D/DUnZt+zjfAKiXYgvTnmIzMZ3CKq0UanOhTGexzxIRlo65rxqsVUAfo2OXuv4NHjv2cnn5UUyWP0eyB8lENlnPpPUp842ebX1hECAeg2fneV8Hru8+5ipsBk4AEmJ/yacwN7vVdYDKaipz2a79/oeMkN2fVCGr4hgwYIFQDSLHSmME2sHcC5ENLvIvEcXvT5IPZW7IRS6gikVvqpO4Qaz4A+anahdzPX1PjoM1RocpZObDwmj+IBoMuYDofIE2ZiZtpIBKsrYpaZwP6u9J21ATwPZhEMc+wG4GlLwwFHG/Gg5hQykBk/aG2+teL2d86uLrILez310ngUyGvMMo6TjUaRTLvD10zgv5pNNGoVUoO4joHiH566A501zTvMRreScNfNW2dFDiGrXMobBVPbJNiZVUfdivtYH19tOxeyHIMLrJyHZdEMTmBMW7ALx/QSbyGx1EgTdAMkey5hn2wrLbbXoPo7XUf6+ASKcv8N7Rk4i89QIV7fINtjdwrlQgGST3cH7Ad4nvYfBggULgGjWgiGtUqxajvUQzUGHWYDrzWcew/h2CWNmd3oTovR5yjBLcXqIUe4kvwTJHjpqdqrPQij/k6uAmIlYGePDS6kYx4+Y12bSfOYrNcPflTPOdRmA/0Lm4lGIZuQt7/2255l/fv59VYZpmMd5gvOly3OKmyHZiTshNYk+CRd6yxBgDNHx/gYcS6nhHp0/DZy7b0Aqmb8Sc82XQmruLPDm3g6e4wayNppVdZTf3wxhOefx7308pwZzDvU83+0QgbWWMdBnY4yfOzgBMGTngW3t4afRg4zbz0AY2SYCI18Y7W8mhiBM7MscrzcJXhUk+c/BFZDaTgq8Wrzn/24ySwcJjPab14cDMxQsWABEsx0M2fofKS5210H0Q7qzVMC0mQvondzlapVcLby3EJKNdgFEK6C70iZE+46l6Cx20XFs50J6JxdWFcaOcpE+WgOrM5nrngyDEwdWprs32lTBXq3Hs2L1NogO6Bw6uwaCl+2ec/dTzzWzrcVzwPr/EUihyDfgBMoaNknTcT7J79CsxpsMU6Qhox7Et4awdtQwXzmClG5+9mSI8FdrKO2HiLL15w1IK4l+shk5A4g0pKaA6DDntdW9qdPfAieIrsRU5hIAZdFjCYHxWWPgeJ9McNgEV0+oxQN7CtZyhhXbwOvfDlcb6GWML5OhOsAFECH8zfyeNg/obIbUl7qLYNrOvXo+04EZChYsAKJZzwxZMedi7qKvhtRwsdkmeyF1RJ7j/wfhRNiAhFt+FMBH4KoKZ+lYbRaL7qh7IV2zH6LjOWicbj1cuCaP8YLPiRZTtOLeyVgpxlGlEc0UO97Vsv2MML3edJXrjmtpsg4SWroIkhmm6dKaBVjwWIc8kisMj/JeH/TAQNowh3P4njcg6dznwWWYqYi/WtXuYYjY+gkyPt0QvdDlnNOLecwOftfDEI3MVn52hAxWAdHWJhoy24toyMxq2QqIhvaqMXMZRPVeVjxeNs9m2mxKijH36Cfg6lT5jI3teWdNs0JfghM374fTM1lrhGgBtR7WPESZYkBCnv8PwuTuiJmTYwjFFoMFC4BoloMh25UeEJ3OtXBNWxvMwrqfDuSfEdWVWGvi4rnGOKgG48hsrZECd5V3QQSmvg3weMvh0rP9OjO1ggT7GXU6CgQ100f/lkO0CJ39fHoW3b+4TLLUJMbHfl77gGXoWFcT2O4ne1dOAJXVUsKVJRxMOMdGSIjsPTJH2nbEZxn0/il4OwwRWis4ew3APxjgtQCS9n4bRNOmtgsizL6TP0gAcTNlceEueGNbigERc3g/GgjqVCPU5I21Aty0eYa3cNNRIBN0B+JLZChgXUJAvAquKKtd347AVVXX+mM67s0GHBYCGAoWLACi2Q6G7O5Xncc1AH4QUkG60eyABwlaHqoAhvS4dQmApGR2vQp43kM0m8a3MyH1i84lWLOVl2tti+EzSXvp7Fq5WO+C6JS0nYWmvTfAhSmydEC5WXL/yoah8O9pdorzwme5DtLp5b3vn4hpA9kjiBYaLGN8SYAMHKPogwhfX7UZwJ9CQj4KYo56AP0SjK+uvglSifu5ab4vFsxMdvzrML6HnIKhGwB8nKAoR0aoKQHQ+JuL/yQIPArX087/XhteuxWScbcYrjSCtUM8nrbmOegxdbUA5WDBggVAdFyBkIauFAw1c9G7BKLbuADR+isaAihCRKU3coEtGtbkMFmEdjjxaFwlaRua0XpG2qOqRJDSzPc08btug6vhkk9gKJJAg++Qt0GyfPbAiXUnAoi64WosaZ2lbvP3nAcCZ/I+1lW47j7+lHhNrR7ISOqNZRkFQNKt74dUez5i5s5EHb6mkmtaeI73N+29ro50LIb9KhsgeASifbmTDtmCoAZe70JImGwt/zZqwMJhSGhOBb/d3vxMwxVP1Ploz8GWicgi2uMN5phz4EJ9tvO7BbRFjstegpQRA+Y0Vb7FMDW3ePPfF0nr+Ww1x9oC4B6ITsuCpixcLTBtvrqMG5GbuUHymb6tcP3a7udxdeya4DL1ggULNvvxwGQ3ue8bQFQHp/mohxSTu567zxUYrw/YQYboNL6uabMlc71bISm6zVy8cxifMu474DpIOOw67vQLPP55BF4Z41DsIj7ZHmGbIPVyHuJirg0pR7zJkIETiluHkzM/qtdYQvbqEgLJjgpsxrGyXQR9L/Menw7Rmiw3YMfPqit7AFdtA5x4vt+wisUJgr5hziMFwTmPbSshWkNnEFG9TNoA4l1wZRle8cCQgqlVkF5dFxLsFw0QS3FezSND2Ub2sZNAqg0uJLUEEjZsMWM0Bgnn9UPCfM0Q0f/vwuln6iAavGshuht9LurgNHdDcGGx3ZDQ8bcI1sDv/QjnVjeP0RmzGYi7B68A+Ee4DMFRgiKfRfKBy2kAfgGSrbbQbAbU+iEVtO/n/w95z9wIQngsWLATBQxZH1WcCVCUncUXr2ErK/hUzdBH6Nitg9oM0XK8Q+dwC5IrKJ9ldoftGN8IM27R1g7t9VyIC3Ta53nv03ovVtw9EWec8r5zHhmGOgPqsua6kxy+39EexxD02IwudUybeB2a9q1p0tshfcYe5/lexXszH1FNmD+WOgaHyZjtgIibnzOOLzfJ3UQeTqysv/fC6cS6INqzVr5+NoGJLRyZ4vufhuhf7jb3oNUwI1pk8TK4XmT9cCJuQGrp3Eqn38rnoIvf2c7Pz+Xnk+b8iBnPFZCQ8nM8zzWQekwf8j6jzGpDzMZDw4hv8ZwuJUuzrsrYlgju98DVOnqE43MwZhOi83jMgKAWjt91XAs6zGcO8bwPEWjdiWgphqxhW0NKfbBgJ4bFVcWf9ubKsxUQKcNhW2V0cAf9ITgRtNpBAH9OxzpAsLS+gnPIcQHPc7Ef88BInDYlx516O4FRKcZJwDjFgsdiVAIjvmi3ASISnwspJTBoxsKyInG1iXzWqWycSyPPvwvjW4Gkpnny2uy87ZAsoed4H1t4Tdq6Yq9xhu+RgRitcFzbauNpMgAvQ0KMlgWotIuoVMYg7d3bQ2SduiH6nlMA/KL5rlaIpk3DShrC3U+H/IQ3P4bNe+KAv6+tmgfg+yAp+FpwUWv8qKi+FclhSSAaWuwE8FOQTKwUJNS1ynv//RzbATJLZxP8a6HTyzgOA3Ah2rk1zI29cAUU9yJa6wgxc9IC+rkc97Pgwqv1Mcd/kD/vcqNkzRbPDBYs2Oy3OK2j+sFpZYpmGyBKmYtUNLiSbMEKCK2/Ck6YWSTz8CQXWK1J0gJXj0V7IFlNSgbjy/bXcm4aOqnUJqF+CtduHWKHt/Od6XGfSWSv37EnxkGpraLjPZ2OLxezE1AQM0ZW6B2IJuRegi59UOoMA5DygG7asBtJD1MTWZlXOHcOQsKXCyGalXk8zzhTh9sPqX/1Gh2+AlJNGx/zwPYROC2brYiuc+qkGpiXA968V8DZyrHNGsDmn/8mODH6VgK57/L6u/kcXgkRSZ9U4/xUFrCfPwOQcN0DkJAbvDmvAm0NZY0SrLWTDVtHFmq+99kxzqu9kPpED0BCzWrNcDWRAhgKFuzEMbsp0g39GNeq0nQzRbMNEKV50YO8wG4APwfRJTTzx+6CD0AqBj+G8QXa7DXWIRqCmExdIOt40mGeVp3Etl7UUohGZjWZosPe++ci2mOqCS4cZR8KBQt9ZAMfIvuy3wOtcaxX2TAvWVTWTXWQDdlGQNMPKYB4OqRG0Lwqz9QIRAPzGh9eyxDaMBD4gK/kvxlMvgDn2zzHnQQeyrwMktX6NAFdXPXn13lf3jagbg8/n4KEI7cRbF0FV4G9iMo99rYRVL0ACVsNcCwPJjz7cQvb+RDN4BmcJ3Gs72FIXaHvwbVlsTaCZCY1WLBgs5cVUoKkHpI8cTbXj3vgdJyZ6WKKZgsgsl3rNU1+NYSWvx0iNLWAJE+H8wSiXetzZgdsez9lYlgodZLvmgW6AS4DqzEGQNlw1Rgd8QGz2/e722v2WSd/JpLVVUK0T1h5GsY45Tnn1AzeT+vcWiHVpBfTQd8LCY0NcFyuA/BRJIdc0hjfeqMACa1t8EBPpXo8RY+Z8cdAGaV2iOh8N+fHEc6xfWYuHaTDHzH3c77HXvTBiZFHML6ZqYairoAT5iNh3lkGqhci1s7zew8SdLzBcxzga/18xpvN/7N87XX+bZDA8muo3J6ji2yNFfDb50pFy4d4D/bx3nwXEird4x2vzoDmUcNm6XctIhP1IUj25nKPEdrGcx+D0wr1mvtaZ8YraIWCBTvxNtVaWFjX46u4Xu7jmvEqn/nCdDFFswUQKTOkzS3nklG4wgND+t7d3NHartQZuPTnYQIVCy5sVeJGs7P8G4igF5Asnev5vSebRTWugu4uiM7iXgIjXYRT5gY1kVW4lMxCt8cyVWtRoUCxPI2TLO7/Mw101XoA/Bid2x8QaJwDEcC31zBHFCS08QHZBBHkDk/y/HoQDXEWzfxYSyd+H1zF6z4zbnsgWVYvE5CUIIL/7+f1nUxwlJTSfTEd/fmcd53mtQyihScbzPcegbSa+DqfA51PB+HCZQW4kgRryUD5zOpfEhRpeC9fZZ34PkhJiUUJ79kMCVU9xnMZhes4fygBMPtgV8HzVWS0Tobo9jpjNguPEMjt5HPc6wHjPGZAdBksWLBj5jd0PT6NfuMC+onDJC0e4EZoN1wyy5SYouwsufACXBn+VVwQb6fDKnGhr+cCf4BA6C64IokaV1RHoNVoOyFCbL8y7iE6uRfJMGmhvHe4CK8zg2qrHY+Q2ejlrvQBSF2ZSnaQO93JFAo8Vg1aZ/oea9p2G8GCioobCQwughMWKxjw60JZQFQHEfReTwZnAz9fZ77rCJ2yPlh5uDpWbQQhV3COlD3gWwfXd2shRPdS5LzZSpCe5Xfcb0BPC4Af4DxVMHIdz9Fex0kQQfNNiNbQGuTntIdexryuvbw2QgTDdyNeC2MBRj0k3Hw5r3cIorV6jIxQX8zn2whCegw4OwPAzxNYAa46twLRoxAB9n1khOLOSUOFYzFMXorPfSfH/HoyhnYDchiuXtUWPnf3e4xfI6LVpgMYChbsxPIVabMRzEISKLTGWKd5zscgYfgcxpdlOWEZokwMM/QrEPFmjwEwWixugIzMNzC+0qxWls4RsHyFgGkZomGMQe6wv0JHZ51VPcFTPaKtM9RJ74JUGn4Nrg1ANdPCibkP8ERPe9df4OQ+lah/Id9jC2SmamC5zoB0kx80AKJMp/8y54EKmTXctYpAZQXZjrmICqytE+0gw/cadyG76fQXERRdwR3KdnNdNptrDYBfRTRUliVTeIrHnu3jdcznOY8aMKS9vL7H9xxFsjC4AS70VU8G6gz+/XkAfwvp4dWX8PllXHyu4nk2ECAtNe/ZANHubTD3pBfJVdyzHnPq20KIhmwtr7kD43V6u7gBeRiiadqB8e1ERg2wDRYs2IkHiHKGGVoE4Gc8MKTP+RYIKz04CaJh1gGiJGboSo8ZGoDrLXaEDuHb3I1qv6i82f2rPmYYrhv9RZA0/DIHbyf/focZeHVinRhfDFDPN08G6WseENJKw438t9M47W46zVM9lmoqSDZOTzSTeqDpnOglw+Jdwb+diqh2ptq12ArMLRA61bdzycJYQLSX810BUUsMOLeWJxC/hHPpG/z3QYi471RIyOtJSJuJo5xfT/Kzq3gOSdlhW8n45AmYDnO+tHGuWGbocYzv5VVngHrJsC9D/PtKiAbvTF73Fkhj4n/g51sJClvM89NFIPQRXp9aP1zGHSChqrswXrxszws8H1+3tYAAq9X8/QJIHaQ2b+OynxufwxA2936yW3YDk0J8za1gwYKdWJtmG0Zvh0uoWARXciXFtfwxrgn9cKz4lJ//7HG8+EYDhuKYIRVHZwmMnoKECZ4xgCQbA160u3meC+kX4YrmjdE59howlDIL8ygX4iG4OjoZ4xR2ert9XeBX0vGtgWhiWo2T7SZIqvd2r5Np/GoLMVpglUHtVbGPJwBWYLQcwI/w2hd6oCRV4/FSVZjHtYiGzEb5mRZEw1RJVuR9u4Jz6bu8/5sgIdvbOK8+yvn0FCSc9YeQENV/N3PZtycB/CtEBF3kcdZw/tvQ6h4Af4yoVs7fDZUxXqs1H1LB+SoyWTsBfJVg3oLG28mAaUmKZkhozWZybeIm5EEClDKfqyMV5qhtHWKth+N2FRe5kgFibd5790LY4PvgMt787LQxDyAHCxbsxGSGMuY57oBrzdXhvUelC98jQ6RRhWnZEB0PQKQxwn64dhiXI14zpA1bt3JBfhgStkibwbPZR35LhRFIuCPJaSqVP4Jo9pLPDpUMcPsoJMOlxJu1ChL+UEC0ogqzU2vn9XTC3/zw04k06fXfZrjUbXWiaUy8nIGCwxKibT1ycDqeJKed5/dpxejN/NsSzkPVMXXx4bwdErLZQKbiPzgXLucDuhkSxnmT83cdQZkymEoF7+A8/gZcRmUzma5uPhNDcAUGNXtKd00qVs574CnDc13Ic7rFgM0Rfv5sfmYpJHvrJkTLGygIe5UbA9XrPRjzHGk5C5vOrjo+Gxo7zbBxayEVt6+NYeT28buH+fMqx/l+733KCtkK7QEMBQt24oKhlGGACtwsXcl1N2U2s5rh2sDN0ZBZ+6alH+GxBkRaAVhTlddAsskuMrvpIqIps3u4O3+SwMhqRSwYSmNi6bW6mGaNY9TwV2sM6GiFCIBXGtCV5WLfTPDWUsUB+01ObdNM69DT5rw+CJaewudSkzheClHh9rsQTUwfgB+EhIwaPBbw58mm/DYZlz8hq/EpiHC/w7x/P19vMXNU+5JpBqQF7vMgmYhncZ5tAfBlgqHDNT70rZBY+6cIPOYYFmUepKDih+D6ns2POcbrAP4dojHSSuIHEM3YjBvjVMIzqJWlz+bvddw4xNUueoJs0LtcAI/A1Zey31n27n0RQUAdLNiJvPb7a/gySKeJk+EaOpe8TdGMkALHChCp88nDZaas4Q77o1zMtaJ0i7nYIxD9xAPcgdseYXnPUaj4eSUc/Z42A7qHC6yf3aLxxzE6gbncqec8oJKjY5lX5VptjyStheS3grCIt67K8WwRvaN0lofMpMhBQjsLENU/1Ro+K1dgc2bKSt4Ypacwr1IJ11RKuM5qpQfKHpM5RrC7gvPqNbIW7wD4O459iXNVQ4JlRPtnxVm9ef4Wct5qqKoXUnjsdW9e5c15L4bTvCnTeiMkJGUBh86xTrMROMzzGzSLzT5I2O+bSC5yam0M40XNaY6TbijOJiPk15cahCv0OMzv+xokRFasMm/GqjCQARgFC3ZiMEN+f7IObjqvh0Rdcp4vG+Hm7GU41ntaK88fK0CkNJcu6D2QrJIb4Sj7Qgw42AIJLTzJxVM7t6cMMKrjAqtU269AhKTWYe6CCF/vR1SLkTWMlZ7nUrh6QXlEK1zXYjmML7BnrZfgTPUz3VXAih2X98hkPMlxa+HnL4fUbVlixjJbA7ApexPK7vRTMzwfZrKkQC3aLPu9J3M+Fgg06s151scwHqcB+DVI6Osw78Vmw/jV4pRHzTmOwGVaKuvRX+Gz87iRuIJzSIsvdiO5cvQhiGbpZUhFas3Q0AVpmNeyt8LiVc3mAfgEXDmDNsQX2zwKEUU+BmF9j3BuT7aAomroKrVjCRYs2OwBQ2lv49oIYcl/BNIlYC4c+6v1hXZDkku+DRctUn83LaAoewwu3M8mW41oNlmBDkHDTUrRH+WOUUXU6kR9UbMyTlrN8sNkS6ydaxzQywQkR7nbHDXndQl32lkkN0stVgAQKQ8IDfEmHub3DEBCAnv53gVEwu1mnEqQLKNlhukqxTiU9wyqXoJoccLyBO9PpgJTMpPVrGd67tX6ejvnSNL1K7PZYhjIt8nivOQ55pIBUraexjICdtUIbTHgQ+se6Tk1QcJeCvrbDFBKGeblioR7N8h5pqHpQTJbL/B8N04QfGhGXxs3NvUEYGkzb1Mcw5shIXBrQ/y+BsO8jZAlepHv6SQYbTKAcQQu1KzP5Ai/swGuIvaAdz1pHPuMs8nM5wDcgs0mkGL/nSltXsr4NG2nNJcg6DaIrrHe8+2NZp15mhupwonIECVVoL4SUc1Qo/n/o2RyNkAEqPvNsSpV070Eov3oSDiPS7mbfhIShnsFrm7KAjJLlxFc5OHCXX5j0FSVhbBgANEBSAjiETo/zXbKG0eo+qN689opHKfz4RT0KTrVX+J5fh2ukORKRDOnpgo2SoiG6lIfwAXCalN0l6JjMg+iKVoD4Ne9B3fYPFtj5u8f408b5/b/McC4CdHMri6I3udCiNZniQFMKTJSCyuwQfsgvb3eMPP/EFx22GSYmHMhGZQLeP3L4Spoa2i5A+Mry4Nzu2TWmw6Cpn64Imtncb4v5LEO89nXxsyapr+X4zUfLrT4pFkUNUyex7EDHCnvpxYgVA6gKNgsA0QZw9wUZmBu+m2zwE3itZAIx1mIMvI5z+cXuLYVvNdnPSCyAku/ztBthg4bNuhvFySz5C4Cov3mHLVoX5rH6eLnVLcxnzvTC83uUz+nN2AhfzYYh6ddza/geSlIG0G8tqXaguej6jwX7Y2k+Gq1QbiCU2njiNvolM7hGLxJ53Q2oq0v0lXOUa9hjI5HK0RrU9U67xgTbYRbPoZM0HSYbe2iWXxJz0Y/QewqiHD5LYgYeCuBf8q8DwSrlwD4LCTUVia7Vzb3di+A7xAQrIKEvq7i/VmE8a0r7Hkra6TZdQNwOqddk1wTegh8dAzmcNGygKijwjG0/pCfHFA2DNiZ/HcF378Coh/oMs/gfs7N+gqASAtdvkfmdw+ivQVL07impSo88+UZOG5gkoIdyzWwFDM3yzPw/BQNEXE1hO2+Gi6tfgyu5I12GThKAuCwAW3T7ltmChD5XettnaG55gY08b19EI3PPXTyfeZYjXBhsoU8ztkcrEG4FOseRDuGx13bUUgI7lU6jlVkXC5GtGZM3RQG2+7a20gF5gmKdnERV3CXgcuoUdPQ31xvPH024CoeW8MtTd77K4mN9Vh9kAy+jfzbUjql1d73TQYQFTxAO9t3R1nDChUqPBt1BqB2QWLezQD+ivPRloSYA+DnICLB1fzbP0J0cVvgRIObyBidB+C/8R60cJ601LDI2HN9lQzoYIVnsxJIWAzgBrKtc81n5hMENdSwbthssEICSM6S3dRK4VrYVK2BC6Yyrqqj64QrmdEE4JNcTLdDQuz/iGgX7OlqjJyNea702MVJsm5JgBGINnUuIxSdDHbsLYfp0eekEa1NpmTEekiPxPONv1FdcNk8d4cgLPDd3PCUDLCa1s3CdAMiywxpjZXl3F3eZha/ATjxcR9Bylcg6b5xO3LQ+VxKJmh+DeeS525yrxm81yEhub0GoV4DCUmUCZiapzguaQ8QXQQJde0hINplGJk6ntdB/qTJKFyOqA5KJ1TJ7Ly7EA2zoEZWxl90tcjVuwRjp0PCI2fAZTJlJgiMrAObDKCK2xXPFNNk60PZe3eI80S71dcZdkTnV5ogZgSiFXvcsDLL6ag/zs+9RybpHyFaHrvopMiGHIbLpNRrzicAYn1dGdGjZKm+w+epmLDDU0DcQ2al2bzWBKGtb+RPkumuzWZh6uJlf6pZPcYXZPTXp2zMZ2DGSZnfM+F6Hb7E+zDZLti+nkLLZlRbSxsQrSBeRrQAq7YvGYPTR41NYocdai8Fm06frdmx8+ijB7lJG5sGpkg3R/b56YCTuFzIjZDKSVRnaLPIhwiIniAesL5wVjNEmk02xEHohvQi+bDHeCgzNArXmuDNKse+CpJZ01XjuWymA3qUoKtMIKZgqNkDHbbw01Qml88maKuCVVwER4yz0smiKcxatNCv3DuR1hYTOccWSMiwg+PVx3uxEtKU9EYCunbjhCZTETs/QaaobHbI/vVOJzCydaBUM6Z/f5iMpdbF6SG1+8O8r6oRyhBA/jYB5J9yfv80nMB/D4C/hmRIbPfOYQ5Ei3Q6d0yLvfteTBi3PJnFw5C09VchurgXCQYGKyxiCyHixUvJ0uTM/GpH5dISPltRNnM5cwwX8rjvOpfrzf2Qekrb4UKJtWoi0t4PeJ9LVdbRZdxYzeH9z5rnOmMW+qPc/Ozh+Q3U+MzmPJAVsumCTRUE6dyt59y9DaJd3ALgf0MiB3YdKk/ie1R7aWuonQfgxyGRkFbz3GkPUT98d5Rkxg6ue/WYZu3QdAMiW89HqfqlZIZuh6tKPIBoUSXd6bRCKvse4DGUPdKd+1LeLO2KPoJoFpDWMumj8zoMUaNrvRjf5vJYF5jj1SEqop6ucdE6MM3TBGIs7ai7z8wEgFLaA6aryUjthyuF3mYcjh63WvE7ywL1QcRv2qajzuy0aznPFJIz30oVHu7JsEJ1Buztp6PaQvDyHUTDt2UChrMJGus5Xk0QfdDtZIKa+f/lPO73IOGcDWbcWwhM1pEyXs9jthiHlzXPyjuGLdWCpQqItvM7XjXvSRHYdJsNSJnndoYBRC0VQKyCCA1R2fYrSYXRhvg8DvK5GsX47vNlsx708dw64DLz+uC0bTmO07lmM1Q0u8Qxcz5dBCbtiFaYr9YoOOXNr7iFVhsB13nMWCPB8mQB0XaznqU9xm8ArnL3WIVnOQi0g00GqOj8rIPIRm7jWnQWN4L30CcMe8CoVjxg+xi28PlZxY3i1WatG+Wzn4lZp3Vd7kW0DtuM2HQBImWGhnkRnQA+B6lJYrtkN3gXXU+H3AqhvA9wAJVKb+MC3sqddqe5KQWzKO+FVPV9gAuM1lSJo7lzpOt+lI6tyzjV2dwPLGknO5F6PqmYY8yFhA1Ph0tfznCs53hoPIX48JevTXoHwJd4737ZMA7FKYyxLXlgiydmMPG6SepIG8znDhFA/ycBkQIOa89wl3IRROuzCFFN0ZkA/ivnmDZ13cVFxdYV6uYcvJpAaD6duC2sOWbmdy8ka+xVA+K0knSeIOSQ9x1LyKpeBREs15nNRgu/s2UCALKWmlZ7CQi3cUHdRWB8FK4ApAXFRUS1ZnrdCqr6+b7zuGOdg2gGjIbubFXxJyBZnba6drHCLtnOn6TCj6pVuoHrhX0WdIfdyJ9qITO9ZyO8xiEzp5U13wURxm/kevYuxlcLt+HEuGcjWLBq/lrneivn9lrz+0/w99+DZKuWzTNaquH4mjWtz956foeWtmkx77WaXXvsEa59b3lM6oyFjKcKiOKYoflwWVun82+DBgzZ3Zg63k7usLVeT45gqC5h4fUpbV//0cBB1y709kYthISDrjKvzSTy9MWR5QoOBTGLdDXKc6pWx3s2fxquM2Mc+Hc4rsshYvql3gKeruB0C2ZXnON9mmiBzErMUMbce3XcGwio7/DGxs61I3AtJa4gA9oNJ5JvIvsCA4YehgjX9VryPK7G0G3Y1oIDZRQ3QcKY38T4Vha+zSEQ6uazdzlBV0fC+3UHZ0FK2jAuuRj2Z4AAp98sdgXe890EQ+/B9XbbN8l1ZTHXgLJhbktmp1pnGBoF4a9CKl4/74HDuNBrEhuUIYBfaObbcq5nlx8jhzXK79zgjecAfw5yLhSqsEYBHAXznyut53OUf9MIwXq4BCb1k0vMRqqaf0x5Gx3tMzaPwOoWiARjlfEBWvg4Y/6mhYi1ztgzEP3QEFziS2GC11yz9m6qgEiRpupimiE6n49DdBH2fZotkk1w6CnUpg+yHd7VeuAq5A4bJqjOW9RTcBlpjd4iOFPMULqGhSkuTX02M1XlBOdid9QpSBjzTyHx358nU6G7ZD+7xgKqfn5mL8HyUrIxLTWAyWrnbSt/HwXwNwAeMiyLtTHE67YOQpq7jhHUdCWwZ/vJXD7N78qbubkmBoRm4Ao5gqzAnxMQVQNDLQQ/nyY7pQxrR5XxKBqQiAq7vz466Ld4b94yi54WTB3h34Z4vYOTmFuLIXW2rodLdmjk/8dinn0QdH2Bi+cuRIuU+n3r7HyLY5BP4sL9Ybh+cPWQ2mDHyurpRJbBhR51XDeRyfx6zL1S56KMURHBgkV9UVxdwCvgtIu68XuLm9o93gaqXIEY0YbP/WZDeTNEe3kOotrENMZLVDR8puvzYa6fD3M9yZpNTK16QOtnFHCVZgIQaYxw0CDBiyDaicvh+o3lPPDh79btxdnCUCVvB5fxgItlCxoh+ouVE2Q0SphaL62JoNSpvD4VEFDLcWzncNsv7hBc5/MegpL5cJk+SaGURZwDhyEVnYcJkldVcLpFj2H6Fh1vD4BTITq0BYiKzRsJltprvN8wgGsLRIB8J5y2R52KFsMsIKoXyZpdytP83nVwJRuG4DRFOTqyTXDhDg1XreYYpfh+rbVjqzHvgeiO/haumvoiuCrRrQasaQr79WQyUh7r5AuKlWHJVgCZ23j/tV7Y2wYMvUpQWKtzb+b3ZM0utRlR3UAzAYhWjL+6ytxWGj3F87nTsFEN3uKZBA7qDROV4zmcDaH2b4h5f947TiphhwyMz8yJ26XGscYpw2A2IloOBGT+dPe82wD3LZzX+ZhzCmxRYIb8jhFaF1A7RpQNiCkTDH2Ta3Ea4/uOWRxgn7FRPnsrIBKC2/gsN5p1uOz5XVv8VkXWGyDh72fMWhNXnqISK1Sp9+G0AiIVC4+YheV2SCXeC8wil6vgnAreg2qrWPpVM4HpDRMB05OxdbxYGQ1RluEEnFN9WNJmsmp4aid33m9zN3ErgO+H08cUDEi1u/aFnAsHIbUjRhENYaSqMEyHyYq8zOMuJtPRaOZdmSDgs3ywmyswWMoGKAjYAOAPIELknd6csDsh35no+OQJFjYh2hvPFnXU+Wwrr3aSmr4JLuuy7LFRWTJjd0F0WAqGOggM9WcN770yAg08Zq2VkitZH4CvQjI0te3GAd6XwxOgrLU0xBJuVloNm7Wc86TZzIkc31ONKT4E4B8gzWgViB5IWNsKFc53NUQbdAFcIkGHYYbi1svMDGxqkjaKcRu1TkiodpVxUFsJnB/x3msTBkJWWmCGLDOkdQF7zPqja9UIRMO2DZWzunS988NYyyEV/M/n2p1FNJElbs6PGdDUC+BP6AN2exuSchVfZmsejU50oCbqSC3yUq3PKRBV+m0QqlsHT0MjqrkY5EK4hDvruiq7+YmWwq/1oU/FsE0nmh0gSEkjWt23NEm2y+/DZqtj1/P+vcf7ebUBRJbVsei9HZLBtJksTJfnSFIVHIpmQq3hQ3KUD8i2mM+8Dlcs8AJ+rox48bbVkQxDBKubEljDSmNjgfpIzHuzhj3V/me6aMyBaNcuM0Cg3gNN9nznQup0NBH8rYVo7c7A+H599hpGDPuSVBOoyHHdS7A6Zu779wD8HVkHeMxSM8fcZq/5LFyOC20n58Ii7hgtIDoZyRW4fdsPERfruvAWpMHjhoT3+/ellXNWQ7lFfvdFEG3DGTHHsEDK3vfpZJNrWX/s5jFlxtYyR2vJKNZzEzLI53UwYTf/fmE9Ko1hYMUqM0O3wdUF1No+Ra4Hj3PtzlcBHkUDOvR5byFgv9XzS3btLRoWt2ywSJ7P+cMQLWevYY9HUDkEnPLAv9pKs84chegaB5Oeh8kAohwHoUxw86t0RkvhNBA6GfsgxRYfovM5FVLH5ZwaEO1kWY6JAoATxSzrsRfAc7wXixIm3mQfIK2eXCDS/y0C3v/ORXegwnjakFsHJPxwptl5V7rfObMzXsYdxkGIWPZeOkDfRkntZsg2rEA0FduK0+3c6IFk1vVBRNXVxiPt/T5m2LHmGNCgO679cIUVUwQR67iJyCE55NhNR30px1PDOS0GkKjZPmp2rlR7FrZBtCjfgau1pOxXn8fogc/6Ki6iy3hfF8V8r84FLa+R4/9thqm2ianVXoEUtNxudn4TaUuyHsCPEYSlzG60i/MmabOYrtH5zvTuPod4YbhaE4Shv5L3bzOk7tUT3rzUuXuig6IUoskOqSlskD+ozJDtGNHIsdoGYaXvRrRemg2527IbFnBfDAkzn851IamV1F6Cm8VwBRl1br4Hqfh/D6LM+2iVOWs1gjZENheiXV3P31+GaFrfNs94RFOUneAktLulOu5Wb+QAAEJdN3kLe4NBbmqDHPA+REMuXRCNSkMMCHg/gpzJmsZa67x7mJqGhcZqH9pIey4idTmMaDgjUwW8LYeIU8ue40knPLxls6M/m/8/l8xKCxd6rTelwHsnpPKzTVOvTzi+Asa5dCDtdBqHzfVrA9QBOE0QYgCICvRTFZyV7r5GDXNhsycPEGRqWnoLQUcHx255wviO8X68y4e7SJB1Cpm1ZsOsDPEcDpmH/wgkE+sxgg0FCE08t7mQcJJeXwfvw8m8/4u4uWmchrl8kOPQh2jTxpShz++FtDupFKpTDdIcRCurz+NCfSui6fn+eNrNxEywQbVsdDQ75xDnRCOfG2W2bLNhy2ZmyYCdZBijvXwO9nAe7DNrcAYnZoq+v/GqRTSe/gCyRXHM0Eqy08oMaWcGm9Gahmh2XjPrqPYltGM/ZtbF1VxzbiUztCSB4d1Mv99ExsaXIxQhod8HDPPbwuehUANTlTcgqAOutuFtcILxNgD/6vmvwmQYopQ3sXThvtBbFP3j1ZGWXkhHo2nB2yExwte8HeNVAH4A0ZDMsVqYTgS0b3frN/Fvc7z3pKbpgbL3cgEkGyFv7g0QzdyxD2LKfO5jcFXL7URMVZhn1trg6iRt4IR+yFvgigkgyO5wCgbMN0LCJAsJ6IsGqL/Gn7f5fYcSjqkP034CnUaPgq0jE5XyHK+Na+8A8EUCuj6yLr8DqbtTac4PQFL5H+a59nFRuwJSr6eJQOJBLkSb4XoEausI1QKt5Fis5Lyab5ionNkRthvA1FABXEzExiA1Th4lk9xvvq9odod7UV23tJbA51JEK6s3EhRVOt8cxicpHIvNVdkDRCO8V09AhOInA/gMmU8gmvCQQbQel7VGiDbqMjqZ+wD8G5yUwWYGn0hAyGod8zWumZbx/qD0g/OZoR5Iz85rDDOU4nsK3noel6FpGZiSBz5+mT6+Ul2zh+nvmyAV/c80rJSG+PdCJBB95nPVNEN+Zwxlqq6jv5iPqLTA10GV45iGiTjIUTh9wiX8cqXZNUSxEa4LfRt3uWd5x3sdrogiPMf2oRhANJutWpXYmVhgWxFthIkZ+A5deDRNfU2N32e1QDnEhySq1bOw6ZFps/NfTUfewB1vH39vgehKtNhdnkzGHAKxuO71LXCtS6ydzDm7moBoM6LNQpVa3se5/hIfvpM8livDB/JMuPT01eb6NL31GTjRehf/1eMMeAtRzhx7Dt+32TBc/XzWTiZgupev9/K82wzQUUbhIwRSayYIcuKy8FIJIF5BzW6OWz3Hvg8upP5Kle9r4b2sg8tc07HuZBjgBiSH4+0uMk4TljrO64cCoh1wmXwpRPVQcaDNtvLQEFE9WbxFBLsNnBsvm536icAUpbxrtM5Mkwi6MT55ZxgSUj3kbUBmE1sUl1gyHU2IK2WTzTfrSoMBi/30xS/AdZMomA1qAdEijnO5/lxgGCeY56vE4+3jz1089plcg1rMNWc5x5+G1BvSgrljqFxQVc9r0KzbZ0LS/G+Ai1oVePwUXOHhRKsVEGk1yVEzKFeSkmo0E/IAgD+DCGmz3LX9MJkk/6LidvRHPeQ/22lO20IjbkJXi3WfCDuN3BQezql+r6+FyZEZuxAu7fghLn6PQGLPW/gwreLO5QpIeKdWW0rK9Rw+QP2eI+qDFP/7e/7/bX7/PDppSwV3ciE6k78v544lbRb1ZQRCn4MI1pd5OzhbRVnBRSvZ1KNcRBQQ9QL4fUNTHzbXdRN3iNq7rJ7ndwpqFzcDyb20bJhJnwtbafvbZCo2whVeTdNp7anhe8/gOPYQZNvQYJYLdKUebJkYIDHbnkcd1y44/V1bAksMRAXXtheffV89maLl3Kn/D0iYUufX8CxmijTrsozxoevTye5ejvH6xB2QLMl7EdW51GF86YTjBYb856UwDeC0kmZovvnuBg9cboZoa17gZs9mDdd5LNIySHmPazin5hq2N2c2Zv/CZ15JlGsJVpYZ8K8YoA+iW3qEa1rObGLiSlKohknX5g5I54mbuQZ0ec9IzqwT6akAIkVjFnGuppM5yzysY1zUHkNUkPUqHdMSnrRqXhq4O91tFs8CXBrxbAdBZe+BnchnU9N0DrZBbGqGH17bnG+iTVrt51IT/F5fL6DiaWWd1nHOvEWn28fFcCtEI/MaRJR9tgE6iwkAbBPBsgf8O1C9oOFhfudqj1mxTnc+JGR4iCyRMiP6ffO4w8oSsDTzWrTUQLN5qNWpN/F505YY9l7086eBn1/MxWAFpBT/1THXMmhYXU2x19B2o7l3WW9RytTwfJRjNgdjvD++dcO1MNGwUN68dilEs6j1sJLE0NbhpbznND1DbOpEWCD/u1Oew15IIK89HDs9h5eK2agmPXcl4zA6CKRfI4jeCJcgMVuYIr+qsNUJtXEedNAJX0om4PyY45xrmI73uFHfYNi2LI6P4DoVs55OJ8CqlE2mzFCTYWWUmMiQUdZmro0eAK0n+FnE8b6BGADGdyu42QhJ+LmL7Llihk+Tje4xm0HA1Rt6Fk6ekIlhRO24aScDvU7tw3aaOSfLMNXFrA2TBkQ5wwzFVbYsEQx9mTv0Ax51eZCOqsM4xWaIZmEjXM+xBi7CTRVoxdnCCBUN3VcrIComLGpJdHgtD8CxWtgt8EtP8EHNTvE8q4lczyNbMEiQsIo7k+chYZg3uWPo5Ps+D1cozHZjnshcu4COa5gOvBvJGibNLus280bn0QIuEv1kVR81AO6H4QqN6oOs5/w6JC3++RhwsQ4SQ78YrvVFO8aHrZVFuosbmW0EWE38/A/x86UJblLyiIp/wWf/I1xM3+LO/Zsx9/FGMnPKtBXNot0Fl0jQUGVNy1RwtMd6vYAHNuwmxj8nLTexHE4f0VCBIarlubO2GMCvQbJufgcuk2c2aIrSMayJDReexfmx3jxPXRXmwDWcb8OQMhL2epvgQuvH4xorAaLUJIBaLdlkKUTrllmzEoy452cN/f4ZfJYtazlqfPZ+SN26Jw0p0sZ7pgVs7Zy39YZ2mWvPx2ymshgvpNfrvAxOZ2fZYJvWPwRJwBlO2LxVBUQ25bSZjM6liMYMYWjvJ4kyFZEtI+W7AuPLZ3eS6twOl059MR2VbZ54vNkif6ebjgFBfbyx/TELinbg7vGAXhxT5FeyrbaIp47DwzxZQDNdOyvd+SqwSNPZt5vdgnYln2segD4CDc36sjsOP5xpw5+26aYNHbbwe7TytG8Ffud+uGyhxTFUbgOBlabAf4mfG4KE2uw8UsD1GiRk9zdmbBaT1VlEpulGjM9Q28fnTXdOO7mTu8/sDMFnNm0W7wzPaTecFirtAZ56sl1zkVxfrAUSnlsPl3K7hcdYQEr9eiRn1vlm08f90HT6GK8R5Qrzvto6lvLW42pV122tMa0EP8L1WSuZ+9mieT4HbdytdxIkPERAPWTm+bHS2MTpoOIc9VL+XMP5cYY39iPePEgZhlVtCa/3SUh46GjM2Jdn8Dptj6+i2SQsom+1mqfyBI9dKzPU6AGEDP/+LtmZIbN2DfCZ7OL5fYjHa4s5hyY4DdIzkIrxGgLv4VqkobK0+Y6t3ADegeR6Q/osWw3TGrPRO9vDI0cRrVKfNSz4MwRefd6cq4khUsev8elTICr1izwwpA/obkRL+bdBsiNuJg2uOzvdGXdxgu82gOiTkBTtLkRF2sdT7GjTW8twzT6tPUGn8lYM+uyEiM+v49hZtijp2grmZs728OFsYewy3uJ3CxmHUfPwPUKnvMI47XIMOE2bv9ky89Y28GGuIwBZ5L3eT/bmbjI/iyAVvjUs5gPM7QRsR8wciAOj+yF1Ou42r63lgnUVF7G5MTvnIiQ77z64Gkp7uQjb/mo3APg+7ubsc/4GpDL0Zrgq9UXjjObDiRmXVLlnWbi6ZeqItb9gzwTufQ7HvwdgJe1HymM9psNskgN4P/4X19Ef5Bq6ANGQg+6UG72d9S9zXf9/xoHZNX+mwZCtKBynEVIm9kcJ4uZgvNYtrohqLuZ5VSbhIgB/CFeHpt5cb3EGr1M30VbPdDmAT3E92snn80EDTGphi/S+9ldhhhrhshJtxX7VDj2KaIJTlj7reojmcFECGFJ7luvDax4OqCczfBWiSUC7IVrjBxGtN2TBrWqF6gyA7SBzfQ1cAd+5HjhLez5Wk2C+zA3AAURbM02IIdKK1CrMO4UHGOIg54m8n+AXKZN0IZ3SuQkTWKutXsbFvJ4XucDQcMeDBfHZmTitxBaiTK3qeQd397sTjtnL60lDQiBxO0Ct+Ol3GJ+Nws/jaSnEd2H3HaXVGQES4l3JRXcFags3lhDN9trCOT5mmJUC2ZWbuXPtNA/2ToIh/dFGwxeRTVHAVeTOcK95OP0U4UEe7ynOt718zs4k8LuWDKudT/u5OO3kgvWXiIqXm7lra+GcPI2A5mYzLgfJ+n4DIpKs5qxH4VJq9W/NfNbtwtWJZCH3mDfvy95u0Tqa46UDsudUS9LBCFzftRYkh1fL3k8t7YVSNb4nx/sxzHuyms7qu1y/+zG+EOVMrcFx/eXqCXp64EpW+PWjdJ1UUJ6kZbPNe8fojLWo6CZ+fjvGF5mdTLiqmv+0Pb4ayICu5HXdyntxHp/X/ZAwv2ViixXY8rzZ0FTTDAHj9ZLDXNe2cg3o4r/L6b+vN0DGbg7LXPeUBX+QxIaOZx3X2YuJBeZ4a9lrkLD5FsMEqn7RJmXopkt7o13I9el0b0zUd/rXqZuBAUiG5S4z12JZwWyNNLBN/1SVepogQJHtLgKmX+Wiv6wCxad2OqRuStqjynPHAQjYRpB6Dv7O7iCAfyfSHIErkFepE7k2Nz3IB/wyTjqrKRhlSKMB0boJBRyb5rMfBDub97bZW7RSFXb+dXx9B6Tr/MO8R3m4oofv8PX/Ypy8PthdZpfyMFyRsSvh0t+1infOe8DtjvldSIjsKQLsHohI8cNkWubEPGd9nKdfhmiO7O60AcDPcD4qxdyBaK0ocGelO7lqphkq7WbBzpAxup7MUy2MZ84LgeAYOela2OJizMau2jUNklHcyDmxhot7owf6Ugksl/9/u2avBPC7cJV/52C8cDwVA4zUFtMppwiM+jyWdDpKEsSxeLYEgtoKzsdr4TR5XYhqqDKoTQ9mdYc2maMDUrF8LaT322Mxx54OsXOS5uU0AL8I0UPN99jiiwjSdhq2Jo3x+rOMmQPqk+dVYIbSMYyV3ZhcRfanlf74XLiSDVYOkDdAYj9E+/My16pBbwPXyeu8FC67Tf3Zqxz3w94myLJ7fv/BZZDOBRcSY8StGXG9MfW5OhpzX1O1AiKbBqi1Hs41tKaedJ7O/l5zA3WXqbtzjenlvJ2MIsAmuIrESQCgPEMIPi4Dxs8aO8rd+BCv93WICPXFmMGt83ZY+nCNwmU4NPB653iOU20PnYru3ls9tuKDaH7hOs0ms8K7OrhGok1mISqaB605YeGqxhba349CslbsPW/3HsiycSZtfBb2kAV6jOeYI2ulTEobF6B34WoE1XkU8zfgurmfD4nNXxbDrKTNAq9zej6dQRPfcxZEXL4q5rqHzO47zc+cahZN1aP0kjHTXeE+c36+bee9WwMnyuz2njWrWZptoeJKmXX7OBYj3rM/RkexHyLsf43v0Z38ld46UIuz91/vgGtLgBrnt+orxnifL+Nm7RlzDZqOP5OFDDs5B9r4TKyn77g8hj0vINpGp8wxPwgXFlfWc6n3rCswGeZ1LePzsJ/HeovzuOCNcWmS80RZHd3Q9MBlx91EBqfVPLOql+0kQG30IhQWENksqzQ/s4jAw3at95kheMBPbQ5ZwrMMy3RahWs7yLXouwC+FUMEaEbrZQTac711ZSOZ9Wd4nhplss1h8wbkdfJeaoVt25MsZ8Ch7aOpxUtVs/sKN5IaKqxYoDMbA4YU7JR4QZ/hyZzsLfz9pNpU97CUwKnBo0Hj0q2ThIYZVO6CPpFO3inEZ25ZbVDZc24pb2f3AiQc9jpcS4f3Er4zH7Mbsx3Td0DSEHdwLO0Dr6LUzdy5pCBp0teYSZL7AIIiBea2ztUdnOAHMT4t+ypIyCaLaA+zzAS/U58NfcAWk1E5FyJ8fpbHXQXgp7hzWWbOd4znuhfRlhSDXBDy3I11mIXkNH5OdWed3jlpGLkdro1G3LOsc3A+F+Az4bI41Rk2IzltvcEsyMshlWWHeI4NPJe9fC4epkOpZk9wU7CY13Yt/20yGyHfBuD6LOViwPHxAORxdjfv6V6zhqoQVJmQQwROQxAt2244XYzdGM30tVlnrw7pJDImdeY99ajeP2qqdiGZw7M5p+MYSuvAC57vuZ8bDG1ObBmYNd66aXs06hz/BN93B1yvTRh/NZnK1lmO47ABOlcQ6K2hj7Ramjq4UPNBuN6HmZjNuYLsogF/V9E/a32uJGYoCVA3c7Oz3PyOhE34UTLFX+czHxcV6eL4X+GBoTJEh/gdSGjtXbhQmAV6FodcxfmxklETux42IT6crEBfj9sL4C+4Tu1DVNRdrgUQwUNbnUR7F3pUccoM4Fp+8TUQEZze4Cwq157xy4DnvO8uT8KZ1WpxxyzSie3jA/YeRBj7AMMi8ICeZbp8gGXHst6g4Hd5c7rp0FRoroi2BMmE2Mf39HCy13sM2gdJV1Tydhmv0wn5Hc3f5DzM0dnUGUDkx85TCWyQr8dQh9ZKELKWc+EFuPCbhq3sLqmJ1Ld2Vtbef6NcSJ7hMVrh4vaXcE7M58JuqeYF3JRs5rVdws/YyrA+oG8iSFtWZXzzZsfpC/m1l10ScFIm8xCiJQz8Ba6P7znsLfj2ecyYa3mTzq6OTNhJMUxKLRuiyYCfsvf86nG07tRewz5uhZQ/eLGGY/cQEGpvuAxqyyat9mzYwowTWRvSZu1ZDhHRPgWnDbHZi3WTHFv7XOXMnJgHlw3pz0/LmliWU893iKGarzA6YW0DJDS7xpsvGbOGjvBcFsDJE9QXbUU0lFdL1l2SpmcppITErQREPeaeaQ0glZ4cgVRqVoBXMGPh2wJuZlZD9Le3m7k0ZDY+tfrBJsQ3WlaN0Xuc+5sIQu8yLEwD31MmcLnSMFW6Xo9wXO8lIHop4VzaiDe6OCdu5vzoMnNpBOP7d9q5ptej3/kkpBTQPuO3Uel+ZqvQrDlEC9TZhbOVN/wWToKr6DCavIlSi9jPfm/JgIwMJlb4cCq2i+DnbrgU4wGz8/Mf2lTCIhrHHBUNvf4V/u2HeOOzHgW+lO+7g6/9Ny5KZU6+E6F45XTvau181Pojvoh9E8dsDcFED6JZLOmExdwvAGd1EyrK1IWrn4uX7bPVH3POKrbey3lcb+a0Otf7+HBfCVdobgQutGVtOUSbNwyJ68/nApKaBuYkZ3bfEznGegK4fm/hLphnR9u3HCWYaCQ9v8zQ5baSrI7pEwD+gPd5jQFEhSpMimWUJ8q4lLx7lDJAYISbo/vouA7AhQ4P1nj827nj7ebCvxRR4edk7p+t6D6R+2cZkyLP5Vch2YW/TUA0D6JTu9owNxNlssoGINR5G8p5GJ+xDIzPHrQRBU1keTEBhCZ1C/A3s/Y9F8HVvfoOXF0v9T2V+mnZTYStm9QK4LPcxJzkMV+6SbaM11G4HopDFcazAcBHDZCch2iCSMM0RxHehvRafJvP82Gz9tkq55q1eCWimaL63DxIZnRThe86jc/HJQasdnr3sb7C3LORhC0A/pgbz33e5q9cjeKrtli2eyxKyry2ykyeU83NKaJ28Vtc/yN7U4e54NYbirGcsCssJzwgtiDWMG/sIYPEh8k83AdXBsAfhwzG9wyqZUGwOpYxTorn+MDUeyGDRZDU2SHukv+VoZXrIGKy1g8gU5T2dhEX8vrf4DhpfY9hAoWGhMWwElOZVGDTFsY7Cqlj8Tbn4XKeS9HQtCMQvdDjZHNstmQRUVHsG3x+tNBcvZmLffxdw1cqeEwK56QqzD1bDLLA69jHc27nzq4xwamUDQNhwZduiFprYAf0/g0gWk/JtxFE08oV+NbVcA/tWEw0PFpGVEPovzbCEME9XB92mXnRThalw6yTg2Y+6NidTHBxVQL7ORUnNhmGKeUx9I1cv9vJXL5JRvQ2OqiZNKt98+tI+V0BSgZwXEBgatnGUw3IsuUyFLhmCCLSvK8ZHut8PhcZAt6t9A92k+SzzDZEo+/ppiM/h2O3zvjDYowv0fOs4zxaaUD/Qp5bBi6z7hQe91rPJ6s+ZqIbZb/cgGa8HoTo/u4G8I8Jn02qe1Q0DNJBSF2ir5uNwwJu8DUs2cjfLyeTts4DMEUD/NMJGxkF6SpVeAiicVKmsxk1tqipxhBlML4qrD2pRlJ3fmhrsvHwuJ3uqxzM+VwgizFIz68ZBO+B1wWsQArwexAdyEHz+SNIFoValqc8yUXLjpuf7jlsHtZPc4H9L7y5/48g6rd5/R8kpsh3cG1kUk6Ha9Rn77Om3LdX2SWiCrPSbxZetXfoFDfyO34RrmK77mp3Qepx3AUJl8EDvFbTVBezGz7EXeIwF8flmHxxzpSh/NMGDD0NEWi/x13Zb8NVxC4iGl+3tWJSCWtArY66pcJ78wQdJe58b+C6kkW0qXBS9mnJY68nygr5DAbMgr2f68VLfP8tvO9Luf7Vw9VLSRmWyWoYmxBfnyk1C54ve90LINk8/QbszbTlvOew0iZGGybfSMfpM4bNhnlTp5zmun4/v+sWOuAG81zWQVLET+Jxv02HquHdegKosuecR8w9boXIRj4FV20cHutsr9NqFOdBtEArID3YUtwYrzSOPsNnaGnMmKSmCKozZt37HiMlj0JCkJWsB5LdZjVDNju3jwzRQYMXbiKY1fVvEceuHeM1ZDlULpFSNoBIC8g+SYZ52LxnrFa/nU1YJGCo/RcMirM31tJ0QPXWFLXs1PTk+0ixbyVwOQxXcG46ANFLSI5lWgrUaoOmKjAsmQW7nyxCigt/K1wG32LS62+Rwt3AB3o1HzjLFE205cSJYHEdve0DMgfj08xrWfiT/l7k/NpNUHwQLo10AR/UPj5kjxFUnMF7scI71gDfZwu/qThVGYNRLgbn8DhNZn7t4kKU51xfbhYZG0auJR3askKN5nPf5a5tjODudFLVWviuqcL89YFEKeG58Kt/pzBe0DtqmNoNZMw66ByWxiz8SUBMnZQNb2mGbLZCKAUYr13aRYZP9Vf15j6eDqkXcxMZ28k4IJshlMPsAEQZj5k7tcJmcKJZvqkKz3YGtTW99gFSswE+lea+rVR8lOv9ENfX8+GqHaveVSvez4NrHPoSnBge3jOstpK+aTmB/G1mbmgyQhbxJRDKBiis4Hqjzvu2Cs9iwQMC6Qmsq+UEhtRnDksE8VqQ8Qi/t5XXkyN4vM2AoSN8rd5sBM4w830Vfds6zrV6xGf/IoaNqzQ//DnZSnC124zXpACRL4bcDinIdogXvsDsnDIxi8tEtQx2odLsnO10PPdCUtAPG5o+VwGcxC16fshMhWdHqixapSoL6WScfMHc4G2Qni8vAfifnFBaybSJN/NnuNP4DTrkP6Hj+C2DpPOzZGGdTjBUnsEdtB/GKXHBewTAf5LVyRuAr7v/POfhHjrt1YiGfsrmM6MxLInuxMfMA3s1d0qtiIq/98PpamyYKjeBMInuPMfgNFApw8SMmQXsr/m8aWXa06owpHGLVjWWymZcZvgMvs3vfQoS8++HZBxdh+rVrn3HZ9civb5VcIJMKz5OmXlgQ4U7IDXGvg0Jcf0KXPbOZZAQUh0Zisnuxm3242x6Zisxa1OtmJ9KmCvHcgw0Q3IPGRAtRNocc23dkJBUO1mif+V80hIUQ2Yt7wbws2SXmuCaRsMA6XSVDZn9fm2TgQpgSO/JRDbDcV0X4K07CjbPI2tznQHve8mQ57khPwWuiOZc7/zt+ZwE0RYNGYbL1z9Ohv2OY8GLPO5lHPetBhDV7McrMURpw2S0kRZbaBb+jPdFk5ngtgBeHQf8uxBx7IPH4CHJeANWadc7XY5YQdkGOtl1hvnRBn2N/L2Tu/h7+P4D3MFdTXBqY+0nOiiK08P4PYpsgbwkAWW2yiJk00mV+bmTP9UemgaO/WVwBTWtwxg1wL1gzicPV6l4FT+/HtEWGykuwqfy/3MSGJZa55nqonRh3QrXxFX1BnlI5uO7cFq9XrjwlvaSakRtFZkrsaN5Q6UfZAjjTjLQah3cfKnYWhtHJq1TKbMT306Q9TgX5s/ChZhTiNcujfDaeyEawm9wk/IypBWGNs1cnnA95SpMSNy8nK2lM9LmumwobbqAS2oa14kkHactxJj25tV6OvBOj1mE2TzofeqB03spu6Q90Dr5bGpS0W0eW1XwmNxaxkX9YNYAjBLGJ+/UOo/ienDWcj45MmTzEK0PuIPrVoGbBb9+mV8pWq2Fm4pqNmbGN83xjdODpiqMn2qxFvLebeR5vWEYvgwm0e3eLqhjXDR2EBzl4WKfZYyvgjlR09LcdWby3QcJk820+bveco273qk+zDatU7v9vgPgN/kwNMCJMrsgdW5WQWL7ByGVgzdBKq4u9xi7E7VOUdk4OFsromAmcha1tWyotIBbbQG4g/gWnWgt930eJLZ/JRfGslmYByDh2AFzj8uGYQIf8l+GCAgXxgDZeZA0XXg7r1oF9EWzWbHP9hBEHKkZlPoMZ8wYv8ad4F1mHM+D9GA7bxrusQUw+8nKvRbznkOGIUsnMM82xJOGqyT+FAHfWjoqe8/jno03IL2c3uEYbTXAN5cAotXB1GHi4aPZvmmZSsbbsTzHpLXOjnHGY32uMUxFm8fApGM2HXUQQflSSBj7N/n5NZDU/rV8nhdXYG+mMu42DDyReRQnH6m1xUySaeJAOYG5ihM8T2ST3kem+ll+5joAPwAJW6cMW5+pMn5qbZA6U3MA/BGchMFKYWoGRHGLsDZSqzMLxGTrfZQ9Z5EjknuXC9oLBF857s5GMT5rbSqgpYzk7srHwvGXDf06QOZnjE7nGrg+V/0cc2WK3oGo9V+n07gJTsNSxIkrsPazg8bMgpSdAccSp5HbbxbKETPfbIpsI+/RBbxHdtyLkBTPx3hMu/PU3eI8Pui3GbAzSOer196IeG1ELVohP1tuM69rlMDjHxDtZebbQYxPIdc02e0851QMQEghqonR82iG02X4O1rd/fp1VoZ4ziOI79rugz/9/l5IiH0r7+EyuHBYmsfdxH9VWzLMzdfdiIbQz4KkYi8wc2XUOM0Mjm/YK073MRPPYR/HuBXROkSzASzVmsEMs5bMr/F4ZbMZazc/z3IO3cxneLE3bzNTZAFtXTtMcoNr76HvD4Yh8gCtLl+AK3/Qw+cmHeMX9Xlu9ViwosdYxdXwSrLDPBdtUfQqn8P3+LoyvA01gqyUAU6DvJaTuQb8qweIChNliPwHLw6AaM5/ZpIPnk33BE/4C5B09F3m4oYQn2Y/XQvA8QQBox4l+c+cqJ82Oxh1PF0Afpr36/8iKvQ73tcyHcxQJsYJn36MFlYLXvKGOcyYnV4rJLR5HRzlbiuiHoDoTx4mWK3z2MC5AD4O4GMe81M3RVbP1rmyCQ4DAL4GCT0fpnM7MInj7+OCcg9cdVifHdaSEu1mMW7jTvpC/nR4O9Ru7r4PIFr0dJg/I+Z4SQuhX32+EULR/xB38Is8sPfnkHRy3dEOEEjZHm9dEE3IZRAdk2r06r3vPF6gwNdCpTE95Td85nQQko04xvu3wAPC7+dyH+rkMx5D8lscl/ne3IIH3lNT/O7MJOdYCdGClr69zk3DU3CtdOZDCsveAJfgYfvYpSrgBsvc+sWJU0hOk++D1JB6jM/jPv5tj7cOZKtsBKphlkk9p5UAkd0l90O0FvUQQWmbt9uuVd8ARHuGjUAElXfw56jZKY9hehrtzVYgYLNNxiDpgtoN+Tw64QLHqIls0MfJKGmcFTH08Ik0Bjp3Rumc3jG06Ta43jxtdFDN07BT9esanUEQ0weX4aG7nlE6xWayBhebhUB3zRsgIbfH4Ip4qohZF6ilBFMXI9pHKhvj2IsxDG2l3WCdeV6119D3CNDe5LmrAFL7LKU90GbZWq29c5SgYYjjM1G7gKDmTAIim3Y8B5I63UCGbi8XweWQUGK2hvts164eSDr1CMHQ+WbjdgSiS/wy4otoNsFlLV3K48w1zFC13e6xtKQwynRtDIu8708C+CcCzGUGEBUx+8Ly1Qox2ucqqeZUJcZBmRR/gzbmgYPpBGSTYYXsNanM5RBB3D5IbZ7HyMJoHzQbLUliyyzQiGMmK/X5O0KgM2DWvS0ERI8TpMFsUuyG7gmuZw30hYsrrAsW0GvJlS2QUGdvDPs2YUBkkV6WiPLPeQH/0ywYI4hW60xVAQBAtGbRm5AY/uMGDOlkK+H9bTYzSZ3Q9yDZTiPcmbUgKgY9A8D/gCv2Zu9j+gS79qIBBEfIrtwHacZXgmhZtBDnZRDN1Arj6CZDKftiyx6IHugopF6GiqJVdDxqAPo6SIqtbZFxCFIn6jGzw9FsLgW7cyBhmBVwjSZLGK/Bm8gOMW63NABJRPgan9PNENHnR8nWjBD05eDK5Jfg2mk0EByMctF8g+9v5jnvgQtlq75Qs+o0c7PPe4YLMQ43w2OeQ2d7Oxe+HRznc+Ho+TLia6z4LMVSSLPaMlziR4lj8gbZjv4KG7+lZGCv9hi891MGZzWGVrP/3jEb1JWIhhNLmF0JHHFAJ1WFeZkI6KikvcklPMPHYwz869kI4JsEttt5Dw/wvWshCVIaFp6PaHuWuOfLCpcLHhGSBAiHubm9AxKy17VgwJyPNVuEcSuAPyS4Wcjn8lOGBCh4m8mSIQ7SXM+/TF+63WwEi9VwRbbGgR6E63GzjjvdxXBxR8QwRhZdZszEKhC1bTcPXj+crqamipLvs0VJ0X0vRGzaxnFuMMBTm/adVYX1OFGBoe7It8MV1bLX98kYxzoVhqhE5uJyPkDbuKuwzIAydpeQGdX70Q+nedMqrCneN21dob3OLiPo6jbMT1OFxaxWIJQy43WAi8g9cL2GLgbwOYjeYQ7nUC8Xvg5zLVpZuZF/U0C0nPdhDteJfQYQZcwCNspF7iCZniME8Ss5Zo0J96Ad0QKaWuekE7UXflRrRrQmlIZ2WnlN8yChAd10qaboKM9fgfEqjm8/XOHTJBr+WIECq9ca5P3u4/1s5Ti3x7x3KsxEMzdcyxGtEzMd/eGmU3uVQu2FOFOTPL4yvX722PEOHdq1o8g5uwuix3marOhuOB3kKm5AbuHP4gRwDHPNvi9PYigH4Zrs6kZoG1wG754K+CODaEX8Mo/3tnlfHyRCcClcyr4FaZrSDz4f+r2vmTUXU2GI7CDFZUU9BElLvdYseEVDI6a9HYXtsbKXO9lv8eb1m/cOfwCYobhJqLubMTral+kgbOy+/n103SnvQWiHCMqbOcee8d7fiYnV4anGEOnOsoHsySDH/F1v8V4L4BcgIUxbG2cbpFfOk3BCZM3cqjOLwlyIbuhKPsgl79koTJDds2UqwIXmb7kTGyJoKfGafolj2mnA3ZKYcWv2nF49RMjfwzGqM+CriPEFFksGGI3ClRtoIvCyYsxKLHL7JJyYDxCBaI+oDFnVHkiNJR3nVyA9AhUgLUI0zdzuKC1oT2G8sHqmwZC939vJSL7MczsbUi+p3ds5pyf4PMCs02sggtbzOS+WTIGJLnmMQnoax24q4G8ym6jsDAC66WD2UgTHm+DaZGwh4PkQ2aAeziEF0N0xx8xjfPN2f9Map3ks8Xn6NuflIePLD6FyIkfB8/e2WKfFHa9DWPhOMsvNBnOUzPPRD9E8fp0ETtyme8qASBmMRrj6Oe/CVVdeScfdk7AbVDsAocWfg4i77jaTrQEuu+eDZnZB1xYLmyHl09N0Tk0xtOKJFiaLW4zLxgkv4YTfxx39qEH+FyFasyczTd+rrNupEGFhioBdQ16aUdLiLcIjvEfvmV3OqPcQt0HCP+fDhWEO0wkrazGZ7B0bat3CRdBvmlgP18KkhPFdsG3LCtsAt2R23V0zdM/tgl7yvjMds3iVquzeUzFr2lGITiFPQLQc0VpCi7gOvcpxudiAvnpUbjNyLJhSeLt/u1N+0uyeRxENaRUx8WbYfqumTs7Zc+FE5ZN97pIYBZ+NSE1ivVTQepDPYyMdZcMMrYvpWbyOWl+tetNryRCv894/xnXrKOd6N8aHzCrZe3DhLm1X9CwB0RsJ51ef8OyXvZ+4Z72Na1lzhXVhkNjiRbgQnW4CJyS/yU5gEtq+LXkIPf8yncmHIL1Ykh6Yo5BCbA9BdDI7vAsbxYmbKTVdi2HegM+dAP6Cju43DL1ZQnW91onIFKm1QDQvl3uOsh3RLspTvX7/e7tII18M12ojRdDSEgNauiFx7RR3QL2IZg0CIir+EFkSNS0cOAfR5r5F1C6i1vMeSfheZbAep3PTgp9+r8F0BbbgWNz3NKJC65QHWAuonGGaRnKF5U2QrNXDAH4EUkvJMqzzyKD1mfvcdRzXIFsU1hfI+rVpmjzgO9VacEmfrbWw4GSsYDZ2E2WMLOjbz43jDkg46CwC3yazXr7fWhvFPas5SIhTa6SlIFWiV3qfG4ZEZ57i2C2EaFUvTmCNEPP5L3HMdY4M8jnam/CZjHcf4upIFb3NpLXTuY5+iPe2wawNylhtgWiRn0O0/9qEtcjZCT6wqgXKczHu5eIzCldDRZ27LTb1Nhmhxwy6VMee/4AyQ0lMXJ2hQAuQqpvNcKGHdJVj4ARbBNKIUsAL4YSxtS7eU9nxKeuzAC5E6e9ErEi6zMXjZi7CG7kg7+PiUKaDvR6iH2rjg/mKeQa0Ns+ZkNh+c8ICHlfbw1ZXnwPRxrzhOdVOsxHRkIvNbExXmTdxmSe+kLtcYf5ZwFJJ6Gr/LXm7/1oLyWmH7h1wiRv38AeQel1H4PRdqqk4rcIxD3OdGkQ001XrsXTwHtaSDVcr45GtgTXK8joazX3OJuycJ7sGlDxgNtmsJ2W0tpKhrOO5J1U+r1bXztfMDEB0Ml+CCMFP53PW4wGi2ZiBOx3tify2Pj3ephHcrO2EC2dv4PrzIp+JRQRGB8gqWfmLDYXruvcmpJ7ZexMEv7VYHdfVbrjEDd14Xo+odlYTOnSO90JE5Pv5ejvnXH6ig5qdxMPio64BSHrbRjOgJc/p9NNhHPIGaqZqDJ3IwMiCw/2kIrNE8Z1w+o2050z8WP2JFFJLHcdzrbYg2aKDVvezgsDtSkT1M7pj6+CCk4GIG/8KIpg/xGO+DYmH///4sGtXa7+HWd57VvW1Bn5+MVwtnbLnOLsRraGTjVlMrVbGtj6YbI2xJMBTy4agaBb4WufDTi7y3zS7VP13Lh2lCjHzqF5hei9ElPoYJCw6hGhH87UQceelBnjWwvAlraeFKmxMOYFJKmB8k2vbizKDyWViTqW9iILunGHqtBK/Nvr8HNlTxPiCpErZfjaclmt5BhKu6efPmRDNDGYRICrHPHM++E9N8fhxn9dih08T/Ggm1n4C1TyBzRFIhq3t62YLp9rejn304zNhK+FaGi2FKwg6J4a9qlZgMY9JapGzkxj8skd7FbjI11KrRCe8fbCDjd/xqhMucUJ38mG3aYd+mmTdCX7dfqjEfwBmKkyYQnJ/pIwHLLXuTx1cE95qtp/38CE6b7VhuJ5ASQUI00gW02c5H+ZMAfxpAbWJlPVPqlkymd2uv55kPKDTCyeSLiFaGHKATnAbwcvd3r3rIlg9DS6jzo7lKMHPXrhMlRFIc9gnIKGF/QmOJkXn3hnjeGthaKyD1+f2IB2OZuC1xoyJzS60ztbWpMpO03NRqU9bpUatZW8nv53sKCAhjTo64S5uoBdjvKC+EuNm2cpuSMjnEJ+Dxd49nonm0EnsXdK5pmLY3+kAaSUDXkcJ3vu5hh2ASFTug2tHkwQc+nmPasEKuiFoR1SMX8J4TaA9vhaxbeSPgl5ledoJhC6DJLB0V1h3bKhc58FciNbzeV6vynvSmKGQWRKTUZwgw2PrEQVmKNlB6K5hmDf4FTjxZPl9PHYWMKOC452J743bTU/1e4ch9ZX+E9E6Wx2QnmW3QsJu9nlM1bAIHi8rxezmp7LDLRnAYwH9EICvclE/mgCItGjeMMGEnTPNEFHwZYhquKz1EvR8h8BH7/VhvrY/4XN7+DMS4xxLHqOXqXDdI3Ch0gLnyXMEb+shpR7meGt0PaJ1kuwaPJEU9Mkyp3Hrvg9m7fxcAgktD3ENK0LqwzzNDcVJEH3X9d5YlWNYRj+0fhJEb3g1j6tho+4JPE8TXZvjhMDlGtg2G4LOTcMz7Pfn2w3pBfaKmRdbkazrqcXaIJqdBXyGeiCM+GrOwboYv1VCtCRKHzcYvXCNopdivMZLGfVuuKLPcWNZjvETBc6zn+Pz8wUykqoxKmAGRNXVdhD+Dj6uGaPfcC5YbWM8xsX5iLc42F2p1icZ4O8tnHjNs8SRTnQhno5WBJggsEp6za8Ds5VOesQ8dHO4cDTB6VTGIOmi90AygzTUVg8JdX0fHQE8lsQ+O0chtHaZwKnde39SsTEL8NIVHM0QmRjt5dbFxaUxYd5MFxNZ9pg/ZUg0C0+LAz49gWPWw1Uab4WrLN7EXepOXm+B3/MsJNv1+YTjNfGezkU0O6+Lu2S/OWg1Rs86jox5NjdAsmK+Bana3ci5dRrnld3ldhDkvQ3Xzdve4z2QUNIwRMemteJsJuFUhdfZCn7DL1OwAJKs0EHwuYX39iW+/hT/PUSA08P51xAz/1LenKmvwI5Ots9mEhM2ncyOPncjHMcmTEyLZte0Alzm4b9jfJSmnfe/nj/Kbqe8Z1C1iSXzuVMhQm0FRHP4LMyd4LWugoTZWniP22q4vjyiOrZMzPqcNpuiFjK2cyGasrfMtU2o20V2mha3WsJf72dmY6aYIss0bKOzaIOreKwPqHb7fpUT4CxI/ZzTOIkmWp/kRB+7ktnF+kLfbAJIiNsZV6oDM8gdzRWQthwL+D5tVryXDu5lwzY0coG4FC5cBnMvy2a3Czq93+c5/AJEYK/vz3o70FoAnn/8PZC6Hd/muV8O4CchmWm64E53tWbLMljw8CIZoVe4o3xvCkArS9B5Kr/jdQBfJPgYNRuIoxUc/xlkH66EK0Ggc6HTcwwTSU7Jm+vWum5Pw1UCr+OCPmA+p/XdeiCVvbMAfs8APJj58t8IPD5C0H0WxpeNmAm21WYK6WYtSyd4K8HpZjJE95hruhOSeazFMT8H1+W8MIkNUgHVe3FNhAnVdWO6ngOtnr6LIGOtYbWq3R9fSzUIV4jRB0OnQPRzCzlf58MljtTHfJ8FSTnOmUa4qv3ZSW6GFvL5yWF86nzSs5dLYAkrgXBMB9kynfHmAHam1wpmVzLM3ZTuEDu8m38Qkgq5xTAZn0c0KyP7PhufJBYojeopwxPJxCl64/wkHY82MW30dnl+sTtLly8yTrbbsEn+9ylgeRcSbgMd2zmIFjosT8LB+ZXBd8JR7WOQEMcpMQuwZSIHeb09XNTrJ7DDtSyD6hfeJVtj5zAwvtt1ocKOLwPXs+0CRKtk7wPwDTJDCkzncQfc4rGuDXQeKtBdX8O6lzYbly0EBosMaPLnqI7jU2TCes1reTgxt71uZX4XQ3QWY2RbXiC47kC0UXGO87IJU28gnDLzpZfOdxSuxsw8/mRinjOtD7SAY5ri/zfxvmzkdQxA6h9ZDUo55tkY5rwpIF7Hl5R1l7TpibveJCZ0hOc5yPujtces87YgYwSu2XMXz3kLJLSzhfdtrrmGifSKs++bx+e2j793Q4p2ruAz0W4A0UwW+NXem7rBa+Lz1OCtOUWM1x76TFC6hk1v2qyH2yFawv1TAUjvNyf5fmM5FBDth4hGD3PH1e5NmCyixeTqMXPl8mfL+NieYGVvd1HtYbIV1f0Cf2mM1y7A7JwW8aG+iT+6qGkqdMm87zxISOYg7+OFXLgU2FjQC4wPcY2Z/2+gozzdLDC1dIBGzMKj1kHwsJGgSMNLfvE7Pb/3yJBtIPC4FVLQcp7HdFULPeq5vwBpIvomHW2f95lRz4ElLXA57kTPh4Qh1/E5sdddNO/9fp63snp2w6CFYttQXTTvMz5bAfxvPqc/ARF6wsyLLL//XTJDzxgwlDHnOFplMc+be/84nd86zo3fg0ujPsVb4ycDnm3W2AFINt/DBDMKbm5CtK6Wv6mz9/1SnucgQdHXOAYX8jh+vTELyAc4V14nIDkV0QrkcQ66mMA2xCUE6HvjQMMRuJDfFv5op/ZSDCDKmHtlmykP8DnqI4v8Ge8ZqSYot9eqrZyWkDnU+VNHH9FsWOt6zHyEYIBM5xC/eyGqh8iAiVd/L/MZ0SSCIxAt4DcRrXE4If1QAESz3+nrAzDMifb6/9fee0dZdl3pfb/3XsWu7q7O3Wg0uhuxARCRJBgAkiBBkKAYMRwONUEz0iRL1gRzguxZlmxrWZYsK4w9kmYkz4zpCZocCDBnAAxgJkGCIHIGutE5V3zBf+y9ffc9de8LVa+qq6r3t9Zb3VV13333nXvu2d/5dtL/+/YJFV1E3umOq5H1hup3N+b5qoX97AHVKYD0lC42p5Lr2UJW3KubsU8/x7IZJpBCYdeXqElVJajX6X3ZpOe6RY3X+mQHnPYLMuzSBfMFVTzowxj6829UtWoUkd6taq0/1tfy2A/8hZKmbapWNkrUp3aK2xElin+D+PxTpadGPt6w5RSSPeSl9/VK7C5So/pWskBqM047kADcJ/We/TgSY9QNfJ20SqJCpgv014E/09+9q2BhNrfLYV3A9ztiagT/YiWpm931DyQbgUHETfuEGh2b45uUcHhF4xjzi1Up2mUfI8voS8doIxK3aBuyy8nHWXm3n5Gea9SonVBCdzVzs+rq7neHkFirz+vvb9Jxv9Bd61q9ls30nnVXSzYgp921P6UEzjYmTznFsVes0Y3UVXq9rR42rZXEfnebadpyc7nJ3HicMjtxWu/7UbL6ghXmlnuwNfeA2qEx3SiZArbNbRwXKhT4fpCndGP1cVXvpyiupRaEaBViKJm0tlhcgPSWa+qO+wXdSV2nk3KAuS0rFlO5aRQoVN6ILKZaNYEUbLPmfr7j+huBf1KwgPjCo3btAwU7MjOsTaeK0GYHPq4G2twum8inGNcKiKK/v9cD/6M+5Fate2gBO/500R1RA7xZDWnNkTcKFr6GU22udgt6O6KWxkVMqjLy23qfigiTny+WVlxRMvur+rlmiEd0TEbVEG4ouJ6LgV/Xz17P3MaW7TDYZkPh4x2OkAVzGnlOibJ/n7+P1szYvt+rlfjZhmYo2UnvA/6pqizrmJv1gxrvx3Tu7NQx21BAxDs9zynxOVlw3P1qCC3z53Lgl8nXG7ISLenY3qrnXV8yzikh+zxZUPZh3SQOu2d2r5KrW5E4sPngCBKT+T13nSeVHHiX2XywVTdT71YFbw/5oseLpeI0ShSoopIXfl7+QFXIe8kXVW4UKIlTTt00W2Uu1TcBb6O4OXm3sOzMEXe9X1Fl6FtkmZ9V5lnjMAjR8od3nY2SVc/1u71RXSRfqzvuF5Bg3tfqIliWNdRvdMpC8QrSQirgTulu5LA+tFbZtInI0V9Aur6/mJzjpC7W1znyNE3WnX4H4uYaKRmv0cSY1t0DWGVuPZYKczMzvP+72mEHuJGs1k2n3eJ875f5+LeV/N0vlNuB96my8aM6jmMl6lPZXD6DyNrP6GJ5PdJQdNapoIeSNarplIdbyHe2L9sJ+yDYtYibpp3y0ywg8J6Ulc1h/94LlXTv0uexWfKeccRtelrVkWk3vreRufsmmZsEUFHycE3JNc0qEfooko22AQloviS5D7Ue5ogn0LvVqBshmFalxKsljygxmdKd/Fb9ecC9xxSzjQUErKi2VcspKzOqDBxibvPQMZ1fJxEX5nbyMX3D+hyP6P9tE2RrgFXA/kPyge29blx3uw2Mkfw1+szcgTReLlpH5mMffHFV3xPQZ692WpdNCTqmc2gScQk+oITo/gWuNaf0vh/R+W/1tOq6CdvL3OB/P6/T7Mz9SljvQgpDH6Q8wSQI0SqBnwyWLvygLphWBbmVGNA1+rvvq0p0qSNEyyHwve7mXi8NTX2cx3Gk6NhndNGzuI8BXcSOuN2Mx9NIl/r1yYM3qZ9xo+6mL3HX2i67ZKANuesUB7ASYrpSl+FlwG+oQdqpSlutAyHyalNdF8FNavjX6k7+Ch3HR1Xh/BSZi6WRkJiJLq65m4wgr/ykFbs7JYkUFbjcgsRU3aJz8SKnThoJNqK2BcnoO6YbF6u1tKuADPQSH2abhe8hbq3HlThdU0DO5qMoblD1ZT+SFXiK4rZLp5E08E8p6Xgb8AGyANhGl+Pq2+U01Wj+D2r8voUE4n8pec9ZHdMXyaodmzpi7SAu1LHerveqqcT0WSVzjy+ADKHryw8jDVY3kk8hHy/YfLTLiOuk5lXJ1yUamMd9nlDV7T4kY+0EWUr78ZK1tFc8qBvYT7hnb1Lv1+tVUbzSrbsDbrMxQ5Zeb/X5/kLJ0GOIO69B3lU2L1sXhGhlKEQ28Y/qpF1PFpvSdIRpVBeNJ5UQfQ1xhWybx85wPsrNpC5Ex5MJabV6tpIPWJyvUuQl3UfpTr621hiPtDnmiBq0O1QtqiXX2SpRhToRObtHZYpDu3s/63ZH82nF0M1nNBMlslpCctYxfzeEVxmu0vHdhMRU2Wfs0Tk+qPf1mN5jUwG3kQ80T8e4WmJcfBp10THzaWRaKVDa9pIvtIlTtjzG1QgcRuJRZpF4mJvJ3ALt4l/s+5gRsCaXZ5QMfB6JCTurCspx5t8vspoY+muUMDzoPn84UcymVQF8xilCe3XDcaESK58B69uXVEoMvs2/G/T/l5IVDDyka8BJVcc7dU64QAmrxbS09L0PkcV1XaLHtAqIclqU0Z4bWxuuIWsW3W5j2CxQdMo2E+3WGD9/p91GbsiRRMsOteObjkC/gMTh3KdEk5I5XCshaa2SjUTFbYTO6Fx/ouDc1zM3Jsk3MvdxR4+RdbX/QjJPfGB8KESrVCHyzP8k4sttIJV4NyY7+W1KgJ7UifcweZ//fN1V7a7PZ6EcRCoMf0F3ifbQbVEl4A7yPuRue0D5ooUN/d5vUwO6Cwmoe7EHIlWGY0idlNNI52jbsc+6HctAFypQkRrkF41uXZcVN7aLlSlYYXE7m6fEY4OqmE3mZr6MIcHI16vB/TYSw3BUydPNzG1gmVY3r5QYdV8WIVWEBlm6xANTia7UZ/U+Vdt+XlWzTeQLAbb7PmaEbQyP6rP3dUccrY/k9DzXgUqysdmq68xIMp/rBZs4w0PA/464LX8CCQgfK1jjOj1HHnuQzKrXqbF9GnF1farE6KbP+aQStppbx444wvRziFvLGpBXmFvmIi3c2HTEcXcXtrdFvkdis2DMq+RduOmalm5yH1NyuEc3Hej3/A9qD+w+1h3xmFRV6GjJtdaYG0+Y3p80MLzb+fXDwI+QNda2zaNtBH1boUOIwv9l5tYpa/ZjfQxCtDJIkS2OM/rQPqy7vkqyixhHpPgDusisc7uPxTKoadDtYcTvnLY+OEHWZuESfVh7yXrxD6TfjVt15a+RZZXZzsckWWu+ahViyzCDSPA7kMDHasECXyn5/q0uF3J6UMjmc89aHRauShuD14tiNUDvxe+skvNwMmfMtTREVtPmUr2vlympv0A3AevI+pw1EwPdbjGuFtwXv9geVuJgFcgHEffKdvJ1lsrGzAeDWyadGV5LP1+PBHhbxeArdZMwoP9udaSp072pUtwRwOa9neNFVT2m+vCcW9D9JuYGcaeKyQD5AoIPq7I0ps/i5UoE03WgbIw9cbBYoAucIb2WrNP9QzpnZnXdOZIoRtMJQfSE/Cq9F+/Ta1wo+W0UPH+pGtZrBfiU0J5SRfURJcPrdUNnhOglJPB4vq6vxgIURj+2/n6hpPGnlNSucYTTK0LP6b2c1g3SXWQxhmvJ3Gl9aRQfhGjlkKK0ZPtLOkm8cVmrsvSAMxLj5FO6+02KvKHZhLicXtSdmvfDf08X5k/rgvNTuoupuF1uJ9WkqHz+tfrgv8vtUi149yVVy17Sh+gRxJXYDsPkOz+3M0xpY8NWiXpRK1lk+n1P0p1mETlbSH+n6iIoVqlh8HPp1UoaKqosjakScJeqgsN639+BuGIqXRCXIrLURGLSPkLW/2knEgPyTmdY6hTXrrI4B1NNzuj8vwcJ8LX07RuB/1nPbcrp3yMrclk0Jr08fxuUND6s877lDPN8Y4j8fLXr3MHcJqqpCupden7d+jjilrlYNx0/4841Q7nbkwIS67EOKbtwMVniySGkRcvn6C4o+BXAP0ayQi/qw9wuevb78cz4+ldVVUv+NZJ2fgJJDLkjuXfnOn70ar2mN5Jl2g6pDVjD3NIUNh8+jsSK7ifrM2iYZJ7p9UGIVj7qzsDWVTbcog/vGrcorUPiEdbqg7CTfK+lfsP7v8eVEJ1QlegMWQ+dCbK4ggE1YnvdA9vttXmXh2Vu7CFfiM8w4QjRQX0o9+qOo+XI2IwuMENIdtDryKdvl2UZdVMVu2i3OMLcOjaVPt2LoUWeh/1oTNlKSLrPKPEBsOvJAuBP6u73c8Afk8WCvSYhNpU2n2lkZpqsF1hT58j/qwTG8KbkmorKIniXhe1qH1W18m7EfeV35S8gsUO36YZljCzQ2Jd+qM7zfqxXY3jaqUMD+rv1Pd7DVgFphKwR52APmzhLKZ9VJe6wqjgWYP8yJbRpF/UiZduT0EZyXeuZWwhwu47zeqcSDbpnctoR4LcjsT+jjtim96PV5T2pddjk+Wf+OOLmO0O+S/uU3st1iBv5wg6K9aiO4R7yFe23I+VCHnFExG+c0o0dHdS/btR870LcTBab+coOXOSk2o9jqih+VDcrXqEaKVDfghCdZwqRv/kvIUXtTupkv5wsfXRQX/v0fSN9NGbtJr7tWKwlgt+dWBsBW6hPk485aM3jc7vZRa/RcdijpOcNSKFDn6paV+J0TMfnQpV1N5F3VxYtxNUuDANqAI7pzrWii+/2gu9fOQ/mcqXkX39f03l6VonQR5EYuqedInKNbgwsaH6wYNFOK0ofAH5HjXKDLKDWsAMpK/AWNTBTFDdIbZHvWm+9yb6gBDwN9j+GlMWYQFwa4/OY00XPn1eWdqry8nKyInVbk/nWSSX0u+6imi5rulRQSRS0VKX6qpK2q5DYojc7Q26q1lAbtahC53CAlyn5vIN8hXqcigzivtlL3l0zuoBnstJBWfaxlw+rwvMDMtexrUt1HZ//wREiI3V2T/Yi2Z/H9PgN5IP7LwF+RZ+jdBObrkGtNooUdJfBmSq11rpkW8lG0a+hP0C8CPerKvR8AfGZWSzFKwjRyiJF5vawzIBv60M96CaKLYzDzphYT6GBRb4+m1N7kRpIkzqpjyUPy1oWHsRaodxl5atMD/WgmrQKDKn/LAp2fRNqCI+7RcOK0J3R+2RjcMYtYK9F4mO2Mr8KwqnyARJLYCnDpkLN6rywXl+7yaq8LnZdqk4LZru/1d39PelI9GadP+vV6L+cudVvKyVku0WWYvznZK1Camo4rTjgLYgr7oKSa2y4cbcA8ceRAOm7yGT9dN5N6W53Ukn6q/TaG+RjoBaCQbI4rPmMvydnRQRpPo1T05o49v5TSkQfVVLZQtxWO5Oxa1Ie/1YpUTkszs1KIJS5wKbIarnZZ3Vb4b9dvF6nv/mWONO6PhwgizUbcnNoKFGGWswN4r6phIiiJPOqZWLHppONpDXDfoqsH9lnyGe7DVMcfB6E6DxHuig0HOunQKY9g7gGWmRpqouhSKTZV7uRrJnNwAedMmS7rovIl/WfbzyKz75odbFDm0JiiA7odVzO3J5XZTsdn/XgScQDauS+ogu8xelYV/Xjeh8abmezFYmpeqeqEKZw1Hs0NrbTtAXzWeDfICnXG9QYnNHXBt2B/yxZnaUGy7PPnZ9PFd1dvhlxeR4miynanJCWwQIyZMZjUL/vAZ0DPvvyLWQxbahxHi+5tqN6b9eQFZh7Acl++YIjQxXybU88vo3Ee2xRQ+UX/HNdo6oTSV7ItaVlKHDk9+NqEN+jCtcV7j3Wt6rW41rQDdkfKVCeuo2zazE3O6xb5aLhNrAXAT+NxKxZnNY2N5/HdP2eScifV3UGCpQXX6xxOdh6G6u0DMXjwL/Tdesoc6uhz7ixXdRYqCBEKw8+DX8WyYrawNzeQU3ddfxAJ9N25vZ46qcBq7lzDyOxEnYNDztDsxMJrNuUELmFqg1lbSPMjdJSw/UJ3YGApHH/pI6d9e0y/3+q2gw5UnUMiQ05gMSdfIqsY3yKjWRZORYbs4a5QakLVeZ8bM4T5GXmIV1QGyXvXa7k3xutXZS33GhX+duTY1N2rIjiYSVU7wP+bsl7TyupPYm4Vx5WMn27Pk/W3+tuJUOWJWMblX16XM3NL9/CpUJ/U/5NIWmQV5W7cZP5rMiTep6xArWkucD56tXkISU8h3Uca/rzK5QoXOHUm3oX95kOqlER+YG5lZ67Qb9i9i7TVz9LogxS7s4vanrb6rC+lD1TRS7wsntkxKyuG/Uzevxn9fnxiu1wybUuKoIQrSz4XjQVxL/6B2oA/wki+/uMnYZj27NLZMCq7udX6k7njJvoI2Spu54QLVaNHb/It9S4fZMsJf9dbidWTxbE1NdvKsynlQgdUCNYlM46igRn365kxEjZOv3/Ot0Jji9gHHwNnroShl/R8/6OHnMpEij6ciTeZgfFsVErgRj1ekxZRenbdW5aXNHONuf+HlLo8AFVMF7ScXyVvv8+xP121N1D6022DelN9nJHpq3jvW9A6g3sQu9HlbnlHjqpgGkl+JNIDIc1UN1Bb/W3etncTZMvfPgdxH0yjmQZ/q86n1v6vFqSRrfBvWUKMm0M+nKe6/2y+7UuSIYvc9BubCv0pjQ/jdRF+o7+fMKRIcg3oF3STVsQopUHv5Ob1MWjAvy35AN/K2TuKSjuMtxapIfQiNtaxM3RSd1YzIXAG5m1ZD3fDitZGKO48a0Pmq4r6TyA+LY/Tj4jCV2oLQNnD5JJ9Fby3cf7vSB6dWFQSeZrVfVo6ty4XQnRvoJxr62gOZ9mwDQdIayWKGb+d6YGlPWHqyOxXvvJ4mRO6n3+GFmjz6re24v0//cj7lKLjbHU8X1IMdI7KQ4mLXoO++nCrsxznK31x926ZljNsOoi3ddGQs6POnJ5QMnkG3Q8xwvmRLXLZ6rSpzXIr5lH9RmbKCBeRYShm+soapBd6VG58qqP36iam3e9/r9aYgdMxevF1earp8/qPJohq/l0yn2G9Zo8kKzTg+STVpZcwQ5CtDqQBkzPOgNpacnjyeRrLuKuqNu03npi2Pt9HT4WpaXj8XZdZKeVDF3ijh1yY+Ozkg4Cv6UqwSn9OcW0ql9X6mf8MJ2r1S4W9iK9gU4pOdp5jnai/byP1QLiU2lDnNIg+1qH9e4QIt1/hCxOqeKMnuFO3Xxs0vc8pLtb75LaBfyaGvJOZKg+T3WwX4TEl4+YQcpifAbJ6NuLZMMtxXUUpVC/hMRmfRP4F8lYzjobVl3g3OqFCHkl7UEkq/AxsgDu2YSA+7IcnfoYejLQXCDJTQnRCOKWuxlRRy9nbo9L306lwdxYnyKF7wxZex2LmzyhG4vDZA14nyYrcXCMuU15fdHXc+bKD0K0cuF3yGt1Ys6Ql+CH6K6L+WLu6hvMrQ8zSHHKequLHRTzXBhMxWmXcVJNFua6Prz3AX9Jli1XReqCjJP1CTruFjIrnGk1NSZUOdqGuEmG3cI4X0PYShYwi206qZ9zVcHiBSunsWyZ4WoXMNupDclZsoy/GXeOWSQ26JO6cy3C1UhhxR9D4lseRQKjnyKflrwOcae9kyzg+wRzg4Jt/g8sg3XE5sQEUqvmi0g6/Chze8ct5nrhx2WYrALzcR3zV+paN04+i84nB1SW6DptfTjC3Ji95Yqv6Xzb4zaCNge8C82UoQYS8GwdAHybk1NkCRvtCNFh/f+pgusZcfdvUbPHghCtbvgA2joS+PksEkO0he5qRSzVrr5SQEyqJbuNRsmOz3aQLbprqlr23nZF7+y4abezO4u4yO4hX3V7B9K9+xrd+fy5kqaTiLvhKBJoXdfFoaUE6g4ko6lT1+9uyaYZ2Ek1ZF9Ww34dc12otVUy9xcyrx9AWhh8WwlMzd2DU2SNPVNsRCoYvxGpBfMEks33Veb2VHqV3mdfIHCUuU08m8toLcHNo+fJ+gIOnYN5Y0pBI1HvflOfu6sRV/SdyXXX3HNbXaR510rOfQWSHXajKh7TbhN4AlGSX1hG99pKDAxS3hfNK0PPAf9WlTDbUM66TZ+9Gslm0LvMZiiPX51J7Nk5RxCi1UGOZtQYp4XHGsmO1CsK1rBwod3nOy0ifmdv1zWtpOGM/s4CTGvu+lIyNbCAaxgoGC8va1fdcUWfYxW4j6pxew2SpbQRaR1ywBGhI8wNst7J3MaNCx1nT3JOIXEsf6WE6CHdfd2IFMkcccphdRXOf1+76LQao+NuzJtq6D8L/GnJbtVwkZKetWR9zax7uSmL30Ayop5x8+NinQvv0rli9cKsjkx6342MHSXrQzi0SM9hr8/KWl0X1p0jIt1083tICc+j+nqCrJbNFYjrZ23B+/v5rJGso4bdSIbia3QNmHDr1wkyl5Glkk+5TZ8pMNZ37oxTU/z9GCIf69PtZqHp1rlBVYRehgTJbyMfSkCy0TyupPjTSF2tY30Ys4HELjWWEVEMQrTKUOabLus+fFYVpSoSWDziHqLFcKmkisZJVTO+ow/GK5HO1ZYxZT3aagv8zErJWA0mD2vTKUgeaxCpfrMaxVldWPaQBeYOqyFcX3Idt6qRvFkX0HE3zguJG/GL4wQibT+ui9d3kSyOm5CsM+sHNsvCYy6WGxny88oUvS8icSe+/tUJ3fGe6rBwvxuJAdvh5sUYedfzaHK/96pi+A5EofUGqZ1Bfl6VxWGdJxc4g7FUMUWVZL5fgqiZp/U7D53D+9tkbhPWw0h80zd13fin5N0/JBvDSh9Vo0qJemjtgxrJpsviw84oMZpQ8rZF/23qvDyFxCF9Cvhr8gUYW24s2pEI3y4k7S23FumZ925dyyzTtemu0ebcGZ2Tf6Lr87E+3cfZxBYty5IfQYhWj2GAfFq+f4hb5PuFHVA1YRYJ/r2hQEWpLNI1+mt9BnFjPKq/v5F8PSW7jklEfm7oYjLeJRFqOvJnnbZvJGuk6VtwoA//o/r/K3Tx2KavXbpgWOyCyfqWQj3qFqMxPf5apIfQ7eTLDDT6sHP1i8uwGuVXqEL0DFmRs59Kdmar7ZlPlbL7VQV6ouDYMb0nG9zvhtxO+mKkZUdRZuCE7vCHlQwZWbBimuZiPahz4opko+EJ9xm9Px9V47MLCXi9oOA7LTaqCdG7EnH5WdHLTclmaanXtVTJbSq5OKQqxrWqyFmboquYW2wxNcL9ijWytWaY9gHIT5G17rFxbulaYokXV+p8mkXcbJNOqSnb5PrrqJNvhzSsc3Q7kkTyHh0r/9xUEsJ7VDeqd+mr7tazBsUFKFslm7RWyWtZIwjRyidBkAW5ndIHoFowKf3O4iASPHoUcQNcqbsIM+hN+u8689c0rorJC2rAPq0G7DakG/gWRzoGkADlv1VDchsSpzHcQTGw3lbPqYH8U91J/quEELXcue4F/g8lZP9SrxG3eKVGyuRsK9BW08/fhgTVvk0XoU0FRmihZGjAEd2tqrDt0x3mn5FVU6502OGupudgUufUCwXHbSVr3rk7IYh+J31Zl0R7kiwQ9AXgt5GaYNOqXPxzR9x9Sx1Thn4PiT2bViN+rOQ7LbY6lCY7XKAE/iad01udkjC0xNdXpDA0EwP+ezrf0XH8DV3PUsy6da2XatS9KkYkG5/vIGU6PqkExxdlfQPw3+mYb0HiC68na/nzKeCPyGJwTN2uFoxPGvy+BYm1eo+S80sTBc02c8YBppUM/S7SRLnu7vUk+arv7Z5B5vH3IESBvmKGLHZlD8UVSlNp/GKyehRLYTCriaJxkS4IX0WqRz+kRuE6xH1wuVuATyFBwy+QFTS82C0snXav1lfsjFNnmm7XWUdSjT+oi8HLEyVryu06Z91uyYotntFrT4MHB50aUXeLULVkh9XLztXv0kZ0PPaQpa4+q8TRu3pqq3Dup92+9ykRPeHutXULv10JdTtYuxVfyqJG1sDVintOOON8lKxlBzr2lyOxJZeR70VVdXPD+spdx9yyGOdqLE3t2JIY3EYBMTwXapHPJKwjlfgNTyBB16fcOO7U9WKohGixwE1Ds2DjadlYp3VdOK7z48nkveuUHG9mbg86Cxs4pd/rmM7pkyXXsVbPs0nPe7U+B+9J5vZYgSp0QNfXTyAJJBNkRXQnyceitljFCEK0OnbGnhDNJIs35EvUo4v1P1PjuYu5EnNlCa4Z3bW8VxeRT+qD+Zu6q/qfkDgOMx67dHF4EXFrbXWEyC+WVbdQmdH5ESVgY0oa0u7nzwP/JxJ0+yak39cVbix8YKPtLP2uzVxzhiPAh3QRu1DJSo28pJ3Wy0kbX3ZrwNJU7luVFEyokd2ZPO+rSSVKA+a3Ii7gNydjPaDkf2uH880qMZ9VlWFNAUHZr8ecTq7BG42XkOycV+g8vtadf1Dn4i8iHd6tavnuFXKfzrXrw/dDS+NpjgH/D/A3TiW5Q4nBFW1UFV/RvtojIU2rYPuNzjrERb9ZifE3Edf9tK4Lt+vzWZQVPKwbxkt0XTQl/f6S67hOFaGblRQZQSLZAKZj+VklQg/qhtMHhk+tdgIUhGh1wrIVUjZPya5zXBfrbnbdi2HEbFHbqARkFgmWtLTxk7qjf70aio1InICV8B/psIP0RHAdIv9f60iQ7YTriH//s0j6/NVKhn7MLXRGOvxuspoQkY2qBswqYTuhryYSk7KnYJGt9Umx8eNZobwS82Lf1+WgEI0gsVR0UAvrybyxcxxWMuP72tmG47gajG8glXatkW9R4O8sEse1i6z/ljeWa3V+swzvkyfqnnBW3b/neh75Z933WZtBgpM9pvRlNYwGlDDsLVlHikhfJwWpKGbTNnJb9WXB6k+6jeg+/VtRJ/cqoi5vQBI6tun1rmduoPMmpCTE2wrm1ZSOj9V2elHfP6Xz+S4lWseSzXOdlVFbKQhRoPCBXGjW0lIbL1vQtusu6lolJy+qYfptJGPoA6okvUL/tRL065LzNpLFJCUbI/ryvvbngP+IpMzfimQJ3cLckvZF/Y5q7pi9wC/oovdnugtEFanJJTAmK6Uv2XJZ88oqXo/pfEwzDo/qLvpziIvmsO6kh8niMVLchqifFyYkeLnfoypzlcfUlTuVqDPnSkVoJYa7KAPrG0pO/0q/2xgSq/OPKU/OmE02QEU90dq5t8uy0W5Upco2dWsSwtmuX9yVSnzuYG680BBZAkjRBmDQfa9PILFJL5AvVOoJcf18U4aCEK2++ziuJKGbe+on/QBLG1vid1C2C71ICcmkqkSPkdX1+XtIsORQG+WjTOZuURwM2FKD9g2kAnUD+IdIYDLJrr5sgfJjNqYK0bB+hw/rTjBNkzVXiCkOh8i6iltV8Z1u59pLvIZXimyHX2V1pdl3YyDTPlDeeNVo3wJkDaJINsjHWRxCgvo/VvK5G3THb60QLkTq07yJ4hiu1JAvt/tUKSA7RgYmdTymlwEhStWcVDGyulSnybdfmdR7ZMHXDVVeNlMeb9SNklT096Z79sfIwhnK1rF0Ltta1KnKvsGKQ1oNJ6vR9AQSivBhVYSmk3k5wDKuDxSEKNDLomXF1MYKdnZlD95AyTFL0XDVS/FNJXO3KeE5TSZ7j3RxHe0Cqn1ckf1/UHdGDyBdzE8o4do9zzHwx1wN/CPERfYvydK00wXvLBK8/QklZWd1MX4n4q7b7Rb0XuJJ0porS9HKYLk9E2U1Z8qK9FUKdtrNRPU5S6b6pViHuHbfjbg2zHhdqPO5WmLwvOFervcp7XU2rePwMPkaT8slpbobxQjdbP0bR04GEHX3ZlVgLumSeDfbfPdOlfm7mcvWxqTbuVF31+Pn7zHgd5DEkReY6+L1JOi8VIaCEK0+QzCkO9Ru1Z5qFwZ+KZSiOllWy2sQN9YEEqPxat1h205rhnxlaS9jH9CdawORli9gbq8cqxj8PCKhf0k/462qzMwwVxbvBtbywwrb3Ql8H5God5YQTvTzDur1WGbI5AJ33ucbCern9686dcBnDI7r3NzkCNe0HnsxEr/xTjo3cl2J98kXaz2LuAy/Rz7baTkpCqli5EMJLFZnAgmMT0nSId3EXEtWQHWQrJjiOrdBmY/tnCXvhu8UwO0LLKZd4NNYJVN5Bhw5sgyyryOxQk+7jaYndo3znQgFIVpdsLTyCRYWCLcYxcs6GYXBZLf9TiReqK6L0oVu8RhOiJQZrxNIVtdHdQxej7jarnQLtneNPKPHnkRif96BZLT5QM1evnuVfIDmTqRCdKNAeWrpAvsqNbBX6uI8Sb6Y33x3lgu590tJiFfS2rgH+HXy8WA2V9aosdy2SsfBG8pTOle/v0wVoqJr9wHi7TYZZ5ASIE/pOjSk71urG5U36r/r9Bnd0uOz4lXHGr1ls1XcnGx1qUCdUEXor5XEPuv+Ns0KqBodhCjQ687NHgbr9fNdJKV+zO2GejGqS7lrTd1ZVjre1+JIj60k/28oqfkmkrb/ST1+QhevC3QBqyTjYCmoFyOprXv095MFx/YybrbbGmJumq+HrzmyD/HvH0dcLOeqHk0QoXJiuJZ8ld8yTJPPTKyy8uO3vCtlAomN208W29Jc5ga1qN5Xjbxr1cpwWHHbFI/pOvNYQojW61rrz1N1/9rYbUGU45GSse1m3U1dvr435FHd5PmGxY8iLvkPue8+pnP0vA2aDkK0ehdtHzRrPZxGVB3ZQZYq3ktgboOsjcHQIs4PH+zss1qKrtNkZl+63+ThCaSg2H3kYzyO6q7oSiVGI8kCsAepVzNEvo3DQuu/dCOBp9iiKsOMfq/Rc0SIAgsnhoOLsLk4l8pdWnBwAolBOe2eF58qvpJIXrMHlWS/bra+7NahITJXVaWAENnYoOrSb5BPCrFYJ0+eK13eE9t82fr8EJIt+yyiog+Stf3w32uK8zhgOgjR6idF9jBZ1tKz5AOmu5n8psyApBN/Rc/7WqfUNOhvyniRsfBZUn5uDhYYh6LvcDo510jBWBl2KyEyNcdahNT68L1s3Ovue1QLvmfT7VbXkK8YvtSG0Foj2HgHEZs7PnWKA0+L4lSWC0Hr5zXYBmsyWXvqK3Tt7PY+WuyiFb6dD04giRtX6/nHkUKNAwXzrNLlffdr+wTixnykxMbXyCrsB4IQnTcYIp8y2urioao7IvC07jSsPtAWstYWvWQ7LHThbVffw3Zgs0p6rkQCk+9yx1mF2Esd4fHXb3EBpoT125hVHZGrtPkelTYLtneJLsa4e5I4rWQYJO14tIRInq+wTYZXS5rJz2mwbLeGbTmThrSe11nyLTxWk9ulKN6IPn3Hp5DK5WtVwXkr0sPM11LzvdbaKUaVgmvahWTIvZhsDFml9yoIUaAtqfEZFI8rmdno7m87w+Z3GseQwMIm4naqLeI1zzgSV02u8QySeXXaEZzdZLFRPlZnk5KfVyB+/mmkUOLlZPE4qeuwSt41tVjkrls1qZUY3wpLWxtqCnEL2FiPxmM1xyDOJ7asF2NUVA25rvcGJf/dPM+LQQatNc0L5LPvmqv0XrcKxqBKeZHWdhuOCqKq+Z5rtkZZU+0NZG2Kitbmos2an4sXIUVANyEtOE7oWn5Y/9+OTAUcajEEq4YUWebVrBKFnWrYKglpKtoVDTiF6CNKVm4nKwPvjUGlx8Wlwlz3zwSSXm9NNIed4agjwYu/hXQP/wQSMHgVWS+q2WT3aju7NUi2zw1Iuw5PiJZrleBKwWspFv6UgD6rC/V25vbCO19VojQtudf70yBzVVjKdKPglZLiilNkXkACfX1TzsUmRD5GsaLP6wNI3a5vuY1KlfMjJiVVBv2r0eaelqW0H0NcXF9Egp8HEMW6kihGdeaqjxSsFYNI/axrkRjS1yrJOqnzxwsgQYhCIVr1ZMgWp2PAvWTdvTe7hbkbjCJp7s8hBQNvIusqb8pMtyS6UrCg2HsP6uJaBf4OmXRcdYrR13S3Ywb7HyTfedCddxiRjLcgfn6rQdSkuI3HUrikeiVFrUQ1miAr8T+4yJ8/qLtLluCzVtJzVS1YI6eUoJxWwjLr1tJRJS5r9TWffnVFbptz9f3t2o/quvJ1NbJVipurrnZS1O7ndrB5ZOPpFaOHdU4NqdKzHlH3txQ8i2WKUU2P3+J+t9l95lO6LjZDKQpCdD7sXMzFMou4Pr6NuM4uI99BvdPOckhVlkkkJmcH0pz0In04m3TvOvAZKukC8hLStXkAKXi3J7mutMT92hLDYtczqufYquqWfY+yHmLzUbyWUrE5hZRQaAIvI98AsleVokjlqRSM9+X6/zXJQn6+kqGiuDnLanwQKeT3FFkfqHEkluMypJTClTone11j627zMELWqmGkZLOxmAqRKWQHkSKmD+raMJCoF4HO42mKT4qjSG+xB5UIXYvEGL2r4NgZ91z6VxGu0Gf5Yt18fkzvo2XARTHGIESrHmY0n0U6uI8hlZjXOKWoU9CyVV1+Aanv8yNkUn2zR4XIf04jUaJ26fwbcseb6+bbZP29ZguuuWjnXqW8WWOly98tlx3oM7qADapB3ObGcGAec6KMGHmFaDwen/9/nHzF6iNILMZLSNVfI0QPIjV5PC5QQnSlHrcXcV2bAaon89WCZ0edKjBccG/Oxdz13e5HdAzOOEUiatn0/my33PjZva+Tz2B7kixubDtZVtrFzK1j5MmrkfiGzqExJeYXK5H6ss5hm3uRcRaEaFU/cD5d/TBSofSwqjxXkcXn9OIiOk4+iLLbxXhWd9MDTumpORXkUuCn9Wdf4fdZ4N8h7roXyWoQnU6MyWrLbkkl7CeQStrrkDYgdEloO+1Q51OF+3xUh4z0n0EaYX5WCc4p/d0Z8q0rDAf0mMeR2lhryQLUZ8kab9p9sA3BTt243A5ctwzHZCnctufbHPMNrj32I3Gc39S5MYIUj/05sgKy6VrbznVpank3PS6DEMUQrKqHzHa2E0oovobIpFdR7mpJK/Je4nYpx3RhryBZXkPJZxV9Pvq+b+g5rtH3+syl9fryylFLCdgXyDpTV3XnfBlzu0TPkC9dn7ZUqK6wB98Tomm9fzUk0P1a3fVV53FOu+9DBb/3P6ctWxaSqltZgWPvidApJLD/G0j7gy8jfa6K1s+qm/8NJK7orNuNd4vv6r1+oxKkC3Tuj9G9y7uf89Aq4B9W4zzF+Rk7tFhj7J+3mtswWn/Dg+74E4jb/DVkLYx2IHF/Q202sy/pWvp13VSmNdACCSLLbHXBiICpKePAK3VnMUJxLA3k42kauvhZY8BHEPfZFarm2PnT4mW+ntETwH9BMsSa+r7xkl2mFX1s6Od82hmfzWog3o1kjq3V30/qw35IyUPNEYbqCjPIvjfbgFMaPq+L2FU69uvIZPZmm52eN5qzqmS0mFvgsmwe+AKZ8321Vhgh9a1jKkqG/nfgz1TtmWKuUgpzM458nawUa5BMoqv1eVynhs42BEeVFH0JcRkP6nOz0T1Xi531579HU5/HvwD+FAn+nU6ODfSXkJe5sU7onLxHCfojul5sIF/92uNevXd/oRvjQ4kqFe7OUIjOiwfLysFbiuX9upt4NVk2V4N8wLE9JOPALbpDflIN86N6zC85o1oUy+IXyFO6qD+qu5iXI7EwI85Qt9z1Dur5NqsRsKq4lwFvAd6UPPgHkG71x/VvNxcQjJW4IBqGdYzMPUOXhrCV3JvDuoCeUCN8ORJTMOruWVG6f+U8XBvSMhGn1YjMdEFmK8zt67XJEZqNSDzHZfr7FhIz8oQSrpNkiuwJJUczCUFdKnJZ1+fUMkvvV5KGey6DDC2eYmSbOq8KTishMnxf19jjiAK/nrwa/BISg/gpJB4xFUCCDAUhOq8IkT1gB4G79T5fpEpDxZGmqtsNWvf4i5FCh5vceX0sRLeqhy3gLyiBmS6YeykRqKphaOjnv1bJzi7yauaLwB+p4dgDvJm5xR1XMsw4grhOrLO2qUiVNuqQJ0QHgT9Him2uBX5Iie3lzvhFTNHcQpi7gZ9HSlB8lLz7oowQDSZz/BrgbboR2URWpdieoxky99oMWYbo84ib7LWI66yWGLulcpnZ9zuePLOdYlYCC0OTzm6tk0gow/d1kzvI3MrzB5nr5g1lKAjReflA2WJmFYi/R9bJnZKHzeTaIVWKpt0cGXAP35Zkp1FU7NGylgbUsD+uSse2gt24lQs4jsRsHFWj8TpVf/Yy17VrWWrjiG99ZBXsfPx33AjcpoTl+h6/n78fQ3q/NiBxZWfI3J3p+fy9nFISe4ys6axXK4qKCJordVp3rJeQKZJFMWdlhrhVQqz7YeRbJeetFIz/uxFldRyJwZh05OSsqjszjohP67y8WOfsbUj69LU9Xquvzl6kXi2FQjZBlmp/nCxLLrD0ihFOMfJxRscTslqGwWSjHAhCdN6h6ogGusA1S3aBRag7QlRHgj3/QHcc71FDUSVrilq0sNbIaph8F5F4PWnzrrIjiGvnD/T4PcCPKSlaRxafZAbhSuBf6e8vKTDOlRV4v/w4Xgn8C/3/3oLntV3ZBN/eYQ/w68CP6xhvI5/VN0A+Zsjeewz4OBLH9KK7PlOpGgmRsN5tRrpeqZ/7skSJqnYwAr5qcyX53IUaGN+ctVZw3krB2niDjtf79bsN63t/gMQYPaGk01rRXA/8oqpDRkR7xboOJHexNlGetD6PxA19VJ/9hhvDMKrnhiDVyav/3aK+CjaLQYgCfUHF7SpOkQWO1kqMsj04NVVgnlFDcASRaNcBtyJSfpnSVEUk/2G3mzlMPhaj6XYvVd3p3Ad8zhGC63WnbrvvEXfdGxBXxFIbjk4764WSIsO4GuNUvemmP1olMa43uHM1mFvhtkgpMhxHAjJ7xcWJotDqYvyq9LcQZBqXMTSPe7oGifu5LPn7hcDfkAVcg6TL36mvMTfe0+7eVAuuLy2uasS/LL5rMQ3uiL4sdujb7jmth0p0TglRutZ41bbSZnMR7s0gRPEAke9vdhJ4SNWUC91u3S+6Nfew7UDk/lnE3XaYLJV4qsTQ+f8PFxjeovYUhrNkqfYgMRfV5OFfjqpPc4kIWaVP76l1QZwtfusdiOtrokdS9A5VVHYW3P8yQ2xGt5/z32e8jfR5vEeQOLuvIi7e9cDfR4qYjiXfu1NsW6uEFC91lfB6YhfOJt8jXC7La31vFGxwyjYEgSBE5z18LNEJpL7PONI7bLM7puYWYCNSG1QJsiJztlieJJ9+3HKkyqrXnkBSdM+4h3Wow053SknXiKoLt5AFcBYpWk3yPaTOVfmI6iLeu358v6a7d1U6VylvOYO/V+eJdea2JqOWCTWlCspOspIKlwI/jLg6N7UhYrZYVx0RqiMu2SN67jridtpFVmm926B5X/gQHcsnyeJztirpH2lz3ob794Q+BwM6P0GC/V9EYuv2AW9HEhesD92Q23hUuiRfXi1aqia/5iob0zF/QoneabJsxzCsy181CgQhCnTYQZgRPIHEgzSY2/TV1+6xWIghJBPpJiS93RvYVoHRHdTXGSRe6Iv6mVV3zuk2RKKpi+9lwC+rOrWNfJfx1IgMLrIqcy7Rr+9X7fE8aXDxOuCdSEG4I0p0v4S4Uw4g2VjvVAK7EcmkupCs6GaZ4mJzwhebfBr4JFJr5SU1xG9Dmvpe6khT31GHJgAAW9FJREFUjc6xSOnnPQX8eyUvVT3v33PkJj2vLwdRVeLze3reX0ZihF6rZG1Cx+lSN+ajzK8O01LXz2oq+TR39Is6Tvcj7nJfzyoMbyAIUWBFkyIzcFNq0B7RBTxVkfyCPKTvGdUd72VqoCr6/zVdLODTZDFLFbfLniYLTPXYjLQtGEBiMLa666suA8PRScmp0Dlo+FwZxm56mRUpRdbcdIe+QMo2bFLl5oCSACNEvSgSNr9QI/w0ksn1EaSgnOHldB+L5OfKhBr0M/q7e5HyE4fdRuBtjhA1CuakvwdV8krqIKKibkjeY0kGK6HgrY3XGv2ep5Asz4/pvYVMQYs4lEAQosCqvN/VHhSCtYjrbKO+7wbmukKqbkc9qgrUAd3tQ5b2eRCJt9jh5p0tyruBn9XzbW2jJC0nzOj3OagkcjdZJe35dKVfCtWpl2OL1oYLlLi+QsntGvJZa53QcO+rIKnsf4lUNLcaPIY3A68nUzNpo7r4OloVPdcfIi03qkrGfZbjCea6fts9BxerMtRyJKrs+VoJiqUnvJY5+BV9Zk8l9yuUoUAQosCqVIpGyQofFrkeZtVIDeqxFyghutgRlw0lhMi6029B0q5vVGXpjKoA+8kCNVPVYozM5eDbWEzqAl3Rzx1OvtO52FEbGTqA9Hh6UL/zOxNCtNLb4qQtPEw93JyQFCMYz+j92oB06V6fEN8m+bieR5Espg8nqtCliKv2TsQttaFLgpwG6X9fCZGfq+bWu8rdq7Lz+t+tV6Lvn6lmMjYrSRmy8bDCiz9AUuy/rL+z2KHIKgsEIQqsOkJkhu2sEhOLe0jv/ynErTaspGYA6b20iyw2YrDEaPj/bwfehQTJ3qdKyiTdZYv5juzPIvFIQ6oYXJSQk8oSj6FhCgnS/QRSKuBy4FVkNYMarLzmsmX3otbFd9kP/D4SeHwT4o66nqymTl3HzGKLDgG/iQTvvuDOM4rE9vywknHr3+brEpVdp//bGiXxI2RZkaNKhPbpvdqakKVeFTRfqNIUKiN91WW8FtTJ4gZPIskWH9N5/IL7e2QpBYIQBVY1MZrRRXBajU012VmfQIJmT6uRu0INy6Yuzl91ZGAMyTQ6qCRsVHf+69rsWr08bzVjngf+WH/e5whRnd7qyvRr/Pz1nlRS9IxTJYqOXelIm/ia8Z8hCx4+qvPmu3qPX+/GwAo+Ghl6TI3w3WQtMQaQ2lM3Ie1Frp3HdXoSsglx7VVV/agj6ubLdB5dRb43XicC4xtv+tYppqaslOefhLC9AHwWaaj8bHLPA4EgRIFVR4LShd0yvmzX7d07p5EMkweQANfXAr9G1vuqTPkoCkC9CHF7XKq/uwZxf1QKdvw+y202UWK+RVa80X+Pc9m3bEAN//ouDepqQVoIztaPYSSW6FIl0Tv1d01HnEBcp/+nzrFjCYH5ZSVSF5eQsk6kzbur1ishvxpx2bb0GtYhrrIxypXOdt97pZKFVsEzdwxxWX6FLHbLK16hDgWCEAVWNaxq9EEkDmQkWeBnVBl6Tl+zwE+StcfwKbrdzK3LEDdSi86F94qq8l6A9ISCfNzKuYjV8CnZFkR9le6wR5lfYcEit8RyC8Yuuk9pS41tSEHGk2TNeE2JMDL0OBK0+8dkatoGJc43Iy1hLED7lBKqAbqv1uz/PojEdW3pYuyL+rJV2pzfx5JN6vNyUJ+dMSWE4+7Yc30/fb2aqm5qXkIUvU8jJQlsU2TtfoIMBYIQBVYlvEtsEpHJX1CSk5KbVrJbXkteYu8mLqbSxRyrtCEdnlhcifSMAunL5c+5lKqMDwK37JxdiPtlVMd1hkxB68agpNWUvdJRZXmrTqkiswOJ+6kjrqgx8srjAeC3lDx61+JVSO+vV5DPVrO2L7P0t6eZH/dWASnq9Dk+mw0lFn+IBCSfQRSpf07WKmWWLJPrXCpDkLXe2I/UJPsTpAr9CTLXecQNBYIQBZbMiHSzMC5WBdJKCbHxrqchJUGDZMUSa8zPXdCkuHN5p3N4IrCO4niS6jm6f74y9xpEwRomq6xc6+H60mrKK3E+G0aUIHrMqtLzGOJ+/S9qkHeqKrQWeIsqQ2M6tmd0XBcal+NJz2DJuPdjg3FMlZbv6DXvW4b3yQpMDpMFUd+NJCv4GlqzRL2hQBCiwBLuqDtls/h03n6RIr/DXo/EaFyshscMhzf2TXcNU8w/9XY+pMW3dEDVhBf1/zs593V+0h20Veg+TVb0z56rdj2szmX801KMkRnZZ4B/DXycrNTDnUibix2qCo259/VLTbE5X12E5zg95xiidL1LXxcnY3Cu3WUzjhQ+DfytkiIfqxdd7AOBIERLQoQsWLhOvoHifBZfT5JaXZ7Ddn8WTH0xEv8ySL41hlWUNtfPGt3JrylRBXpZlHt5r4/ROIy0cgC4g6Wt89Nq8719xeURvc77kcrKlu7d7jrtfMfJyiBYu45xxO20jnzc0nImUOZKNCI9mlzvhUgM2LWIa+22xBj7TuumvBxQommxOZeTBbE325CdpiNDTSTF38o+mAIyrONbQVSpKf3/OiVq423GvSib7XYlQ5ckc6d2Du+HZff5HmUfRYKoT+i1DeuaEPWGAoEgRIsOU2bq81h0fKG3VqJQmIrT6uIcQ7rg27E7HLFoJAv8EbIGmC9Tw7Ul+T7z6c80X0zr4l3pkUz2w6D4TLbUxWh/H9SxnELcEBcidXR2O+PslSw/FieRGk1/qUpKTe/N65Bsq6sTYrWc6xoZ8W4lqshe4Dd0Tq1RonFh8t50Dp5AYlz+FgnEnkUyFH9D/4UsNqdaQswsxucUUmPns0gm1Yxe23ad3wP6Gc/r+F+n9+81CaH1m4Y0duq9eh07+jTn+4GmPjsDThn6N7q5OJwcE26yQCAI0aIbCFvsG27x3Ka7stS4+grIR3RXO0Ne1i4jXO2M+oy+QLJfXkcW69F0xn5Kd5CfQGrrVJHMn9cjmUBN2hfG6zeJNKxRo1pR1WGpgj4rbXb3Vfdao9fVRFx7X0OyrXYXKEQN97wdV+P0IeBv3D0adCrDSlCG0jFLr3U9UuAzxay+hsjihU4hwf7f0Xn4IbKiir7AIiVzwCuRLVWEfgB8BolhmkiO/4p+/n73u0eRuKYyspaSHev3579XjXMXEJ8qQy0khutu4C6y0hVrQhkKBIIQLZUqZPFCtogPI7ETb0MCcf1OrunuwzHdHX8KyQDpdO8GCoyBN05mBLYCHwDeiGRr2U7ZYjaOqBG6S9+zU4+9Qo3RjNuRL5aBLnKtbUVah7RUXagn5Kxyju6tYSr5+zGKe2S1EkL0AvCnSEDujDt+XFWQS9VY+xYrqynmqFJANu5HYo2+hqSC29huVDVnbRvy5TcWA3ruQ0g9rUfV+Kc4ov/WHDGY1Pnua3S1eiA45zpmqKHfwQqgvgj8W11TfB2vUIYCgSBEi77Ie3fWrBq4i3RBv1N3n50W1/W689yOuFVw5GoScT8cV+JS72C8Nyi5uUU//wK38HsjO43EWdSQGJjX6jWPtiErizF+KUbIuyIWe3ddceNzmKyi93qyAOqqqhkPI+6Yg84Qt4M3QKeRFilWqfkCxJX0WqStxHjynnMRPJ7e9/lcg29p4SslDzqj/biOxcdUzXnKHWfPwYZkfLu9lmkkFqmRENr1et7tSj5PIq66S/TVbValz2Y7V8qQnyNWMHQWUXo/o5uco2SK5mQoQ4FAEKKlIkQ4VegW4O8rudjV5YJ5g5KY9ySExwJwv4/0gLq/w3lGgTcAP4Y0WvXKVJqKPIbET9ScSrF9Ge18l4IAePfWYUSlO6T37gYkKNgI0TPA/4W4vU6RdVlvNzeqyXhfirgzRhH35I/qPdhNviFv5RyNR90ZWyN8vRp8qyvlkwp81tMRpD7RF3WsTybvnUDUtB+QxbZ5RSglLrYRGULc05cna5w1IL4J+HEkTX4Tmao3TL58wGAX9/VcNnS179tyGwgjmf8WUSCPumMnQxkKBIIQLRUhMsOxRUnIe1SZsSBPizHwO0u/yNfI4mb2FnzGcaT6s8Uj7XfGw8fX1NSw3oH0hrI4jbO6aA4kn71OjcQ1aqw3k7VeqC6BYW6QtRMZKjBi0/rdD+l3GNfxWeeOWWgafqvgM8tcC3U1NKmL7DjlcV/ecG4F3k3WI+5N+rPNkxmWrqBfq+D/VfrTK853Vq+Rjxd6HonjuYustMKg+94DOg5ndJ5Pl1xz0YbE6kS9DHgn0qJiWuf+hUhG2E8m93PAXXOnZrLMQ63q9z0zV56v2WTjajFDJ/T6xkIZCgSCEC0FCfJ9nQYRF9kbkeyTaxPDMpgYyGaymHdagDeSpXbfQRZnUUkMhQUhb0sWzBH3GWlw6G73PWoF51uMRd277F7SBXuLEh7vhjgDfBlxqzymY/ALSCaWEaqFkLbU+G1CAspnlHxuTu7dLuDvIq6cr5B1bE+NTqtESdiC1OK52f08lDyXS0WGfO2pVGlY6HktqWAkmaP3A3+AxPj4oGZfmbo2j/GoJPdpJxI7d1gJ7ACifF7mPu8BxE3X0uflQn3fGMu37IEpQ8PJdX0N+KD+e8JdeyhDgUAQoiWB9f+xNNebVRW63RnrCV1cZ5TEDKjRH3KLVrWNgfLq05i+dvWgvjQSopMi3Wm2WD49tZbqOjwhWg9c3+bYraoy7FADau7Ll5Hvol4rURKGEBfmBSX3aTFjUdLeVrWCedFQkmAurLVK9MecQa72eN4nlZQcQNyRdznVZ63+v87cdhoVHa9qj3PFKq1fqa9mQnDuV+XoB4gLdFoJ0SsQV/e1LG3dq16UIT+2jyNK5WGkN9ldZHWVImYoEAhCtKTG2gofmiF9GxIc643iIOJOeQZxD2xA4lK2JAbGV9jtV9PP+WQpVZZo7AzDSi7MZZZ+V+tefjmZy+yi5DtWlvi+b1XDuQ+J0zLDPt+ea0uRTeaVGyMuRU1pnwP+o6onILFNv6jEAjIXU7XL8x5HWnfcR+b+9C6wScrras23+3q7gopPAf9ZCdFZsvIUw3pto4hLdm3B89lawmckHQeLw7JkB4vB+rpe/wky1bhFvv5YIBAIQrToqkWTLO7nZiQWZx1ZAOlIj4YuDRT1O+Yi9ajdebppF5J+Rrc9x/oJi50qwzDixtjZhbrTSRnp1pilKkWlYHw36Iser8tiyHzQ8lKQukqBcjOBxGYdcdf2eaRp6SlHkH40UZBqBdfvz7tfDfQE8KAqF08ka4+pq41F+q4WzO1ddy3Exfk1VVc81uizu859v/TZPVcZf+YOHKA8BsvGtcL8isEGAkGIAvNabAfJGiJeCvy6KkMXku9l1HDG80olTtZXzBvOooXWpy0XGdtO/Zq6JTaVRdr9diIVS2lUvHrRDUFdzOv1Xe2XamyaJSTtQcTV8lUkk6uJuLVOJYS1UnC+Voki1FBS9WlVY44i6qhH3ZH7xYJdV41M1Wrps3dJASG6BokNew2iQjbafP+leh6aybydVSL0/zI3BsvGtRLKUCAQhGipYQv6JiRTaK/+/gwSb+F3zIOUB6tW2izonbJ9+kli+mmUW4kBTlOlabNol/UOa7pdey+Bx/PpcN5pXJvJC3pLTy8ziP2qAeTP54PGj6lyc1KVhY8gBRFfSN53HVk9pBsR927TrRupq+0w4m46DTyr5/0U+VR6qzZu6sVSBPqmbmhr3XGnKkEHydxQbwfe6jYrs8kcWAjBb5UQ0k73za8hx4Fvqip0F5nb0WoP1ZmbvRoIBIIQLeoC2yKfXr05WdxrJca/l6q33WKW5dFZOyULtlMddDtX39E8JRLtDEyRUVsK91In9aHi7nW/yEvTkYXqAu9rWiF7Vg3q54HvqrpQVMn5euCXyALLR5REzLQx6l9WReghsppZJ5NjpguIxVI9s34ctyBlDm4hK/dQQ4Kq1yfPcSWZ176dSC0hL708D93MA09kzyAxWB9EYobKYrCCDAUCQYiWDFW3C1uLpIDfoj9P64JnWTGn9TWiKlK3ErktgqcQWX+SfKaNBSFvTRSkdgtz2WLZb3LRSpQt+8zBgmN6IYfdVg8uGouziBtoRu/DRvLFFOebVt3rNXVzvqKsr/neB0ND5+H3gT9H+oSd0L9ZmvmIzr2NiNr5HvKNfVMcVLXprFOaPknehWPtZdq5fpcSNiZDtI9Ja1Cc3FAnKxA50OV9Sp8HaF83y2+cbONwEHFp3o1Un57Sz7Yeb3UCgUAQonNAhgbcgnkJ8I+UEG11i2hdjcUDaoQuQAokdtPeweqLgHSp/ldKita692/XHe5byVeULuuK7lWHVoEB7pWc0IF0+c/f7wxvN8StX4bPKyMvIU1UjyGB769FVL3aEl3PuTD8TfI99Z5QBeczjgxtB/5HJfVWCHFYidCGDvP0Hj3f40rcXyILzPYEollA0M7FeDQcERns4jmvlBAl6w+4fh7EHB37acQdOZIc03JKkl3DfuCzSO+7B5xC1dD/R32hQCAI0TklRWYURpC6JbudAQBxFXxBjYYRojoSfL1FF9MNzG3O6lOMrQHmESTwNcWM7s5fRlYPZ7hkEe4X4emWCJ1CCig+q/9WyALKrWHsUR2nmpK99c5QrTaC0q3BnNH7vR9xkazVObNxAePij1+DBA7vUMXijcDf68K41/U+nnEk98OqCB1P5tmwM9hLFSfUzRgMFJCbejKmnVyU/vt1ep680ntGNzfPIC7K9cDfISsd0XDk3JO1A4h7827gXrJK90NEt/pAIAjRMsMM+Y7nNWcw/hQp/nZWF9HvIBL9HWqIriHfLsB31zYF6iKkF9ooEqDq8SXd9W9EOsL/DFljylm3sC8FuWgVKFv/EqnzMqXfZS3SuPR/1ev8ARILMYZUnL7OqRJNFlaTJw1G3QH8MJnLbDwxaIutVpV9RqpknUL6ev2FEul9wG8gCqQRk25iitLK20NIdeYNwJvVmFYQlWxNF9/hBPC7SHaTGfBnEzJk923GzbvlHM/i44P8c1JpQyiHdMzs/2XzJ60k/Rzwm0ic1RFEkXuFI0T1AmXqjI73f0Xivmbd2E8TsUKBQBCiZQAjK2OIy2EqISAgcQYPkY+nOIS4bG4qWcxMxfE7xC1ILMe4Ep8X1eAcJ6tQixKm97nPb5APJJ3Vazma7NiHyWJqRll4TA1O2Tqt12lk6aASwml3TZNkReYWQxUwjJG1a+h07FIQoXbHoyT6ebJKw0XH9PL9a3SumWSY1rl6wP3uISRG6KmCzxhKFKHlQoT8HJ5CsuBO6zOxQee8VySrJedIq8WPzOP+23rwuD4D1lInDca3avYHgW/omNumyitD4SYLBIIQnTNUyBd6GwGuQmJRthXs2q3FhsceVYZuRlxHw8mutIiEzKpRvEUN+rSSoC8iMTGP6nHbCnasXnk4qDvNexNFawcSh/R6VW2G5mnMU5fERcB/q9/3iCoMTaQ6txnlS3WMNuque4x8ivhKdpk13a5/gPIAWq9kWX2c1+s9fwWSTr07ITbzvZ5Wl+/3LSAO6e8mVeUoMvrLURGyWJxBN/8/pKRkmz5PryFrrlvUC6/lSJ7dx1oPz0M1IeQ3Ie7ityBq6B7ydY5sLB8HPqfj/30lQ3YPQxkKBIIQLQtUyVLF1yK9jl5Flj3WYm6TVVsMrwduQ1xb1yMB2P44H2twXO/LDkdQRvVnwwY95gdkbS02uXPW3LWeRST3P9XjU4zq4rwrIUS9tvpIu7nfqYbngBKiqu6Ox/W6diJxT2lne/qgUhUZyF4LMy50rgz1MHYGn/10nRLiCxKC2upRMSrq2n4QqTs06a61hQQMP4S4Zz9acK4Rd5+ay0wRKiKBhiNKMh5EMui6mWNG8gdKxrvT/Emfh3fr+N3qfu9LUYCouPcgMUP3uLnki8AGAoEgRMtCJfIk4kI1Vj6I1MZzmqwGy+WIO+t2JR5rmZt221Li8nWkpcAGxFVWlhZ8pRKgCTVmprL47CLLdnsWiV96uuRcE8y/AWSRkuQLym3R72v1awbJ3ALVRFloJOeqlBjz+d67Wg/GbKHky59/Ur/vGtpnN6XXdJHev1oBCfI1Z1oFhjr92TfunUXcMX/k5sQQWZDxaacMpZhJ7vtKUStmdZ5vQBTaVyLqm296XOkwr3H3o9rFfPPHbAJeXbDeVty8bwDfUzL09YTYBRkKBIIQLVs01NCVEQnrZj6tROitSDaYX6BxBvI4EkD5KSVEm3WxfLkuzgNKjraSxUBsKNkVFwWHbkWk+sNq1CwOajsi5W+jOOOt1aUBb5V87gBZg8xeVYxO56aL49sZ7X6TIp9VNIHEAB1UhWydjvNWN39qBdfji1UO9KAydcJZJMPpNBKH9hkkPmWqw9rgg/6XQx2hXuArpG9GFNqK/rvN3YcyQo8Sw+f1Ob3EzeVu1Ev/90H3vHo33BCZmvsl4GPAtxCl2KqBR8xQIBCEaNnBG9bTSPzO40hsz5rEwG1WAjIFvENVonSx9sXUXtQd+5eUHK0lC6ptIe6sHwPepsa1bPfu0/Wt4eZu4F2I++q0GugJPfc2PfdWssaXRQpE0WKfKlymevUSa9Ht7t7maicjZIa71UbJqtD/Zqr2uVbs8XngPyFZdtNkMSOeEFWY29bEp6m3ulQjusG3kG7zT+icPNGBDMHcGkIrKXbF5qHFEu0AfkLHckcBafIkx77rKcRt+EeIm/dXydxdC3HnmuI35QjvfuD3EbfecUeOZ4iYoUAgCNEyhG8zcRaJtdiDBFZvdYtYVQnR7Tq+15C5JBrk0+E9wXqALCttRtUcw3fIXE97dec4ikjxO8ln+6SL73p97XHqxVklRGMlKsdCjfCsfsa0XvO0/mwLvO+Obu4sq/A9pP8f1u/cbYVfuzdD52h+eKXwEOL6eF5/Pg78bHJsqsiVjbu5TOxvpkxOqFGdIl90sEk+pu0EUi/oLvIZawPJNVQSQrycaggtpIr4oL7WtZlHpswNuOf7Szpm9+kxl+nzdglZZmSD7qtVe/XWlNMWUt/pM/o6qH8fIVNyA4FAEKJlpw6ZIbeKvi8oKTqd7Kqtk/21ZOX1cca/qBN1GudRtFv/tO701+g59ynpem8bElAvuM/DBSqOxY9U+kAoppHYlKfJGn4eBJ5UdWpaP3+dfo8BstYmm5RcbkLceZeT1Wqxcw/1WYHqp+H2BrfV5udUWWpXPfkFHUMLfH4RiQt7RgnXS4iLpV5CiGaVoE22UYCK1LTWMhnTfqh500hgdY182xav9NTdc7If+BMkm9PwIX3WfwWJ4bPnpps4NyP99pzZ/D2I1Ce6R/+P2xCFmywQCEK07FFzi+wxskBTv/NP4y9SBSANkq0pQRgkq4BdTxbrg8mi+YgaucGENGwhKz44UHL9tTa/a6gBPpGoOjgjYinAlgY8qtc8qwbcCNGRhBBNl1xPSog2IzFYlyDlDS5E0vSLduZpz7Ln1HDNkm9N4smCKWujBedY6LxAv8N7kCDZFuIy25IoWaZIDDkjeEjHzObUKSQzsB0hOtXl9flssuVURbrTRqSh97XR5fGWVGBZc08g2WWP6Ly6E7jYzaNqQlBn9D1f12dgSOfS06r6/YTOSXsuOzUmpkCFm9TNgqXXWxD7Wuaf4BAIBIIQnZNF2huZSolK4I8pUoR8/M2MLrr1RLFpJaTK4wgisz/k1KV1SCmAm5GaP7vm8f2eRRpJfkMNwxH3+albxZM9Cw6dUkM0oQRo1v1bBDN4E2oYniJzlw3qv9cBv6aqmzXRHXEKiJGK54D/S8dkRt/vi1S2kODWNwJ/l7mtE+ZLitJ5sAf4RbJWF2vdZ7UcofbP32OqAt6nqo/d95NkWXm48Z1MyHgnNMlniS332JRKF2pW0bNpJMUyLH8HqRB9VOfPGxJChCPNE0p8vkVW/6feRjVruWsbaKMUNclnfz4P/HVChmxOhDIUCAQhWnGwHXe1zU61yFiWEaYmczO8PBHxTViNRB0mH2sE4pY6pArCXlUmUmWq4s7jd8lnkFgmI0TP9FlZqxV831aB6nSafKPQp8gKR+4jazdhJNII0SHEtXG4zXXc5MagSX871RvGyNwqqWG0flhGYh9VIvc1VQzu7XEO1jrMMRvblZIl5uN6LNbGZ3jR4Z6ZEjOo8/k+HeMqoggOFoyNKXVTSp7ud79v6P28FCnmuM2R7OEe1tC6+5wGEqP0Vf3bqM77OhFEHQgEIVqBaNI+C6tasni3mBt30CmbpCgDqez4x5VMfEGJwxBzU9BrzjD4z66rImEus36ikRCQXlSKk8AHEXfRvyBLm56lc2mAihu3EeCnkX5yW/T9g/Q346yTQuPjxQ4hMSTmnjk9zznYjbtmJRhaey4aem/Gkfo9d7h7Tpv7ldab8u6nNwM/irhfPaH0JPE4orp+RcmUEdi9SJbZq5CsTbuPvcTbpW7y4x2OCQQCQYhWFLqt01O2u7dK0hZs3O68qVGrJi+cITlEeXG9XudHmfEpcgO2EkMNcwsIpinw6Xj539uO+gzi/rgLaWnxOsQtVU2M2jbgh5RgPOl23RsQN8nrgB8hi+eZ7vJezYf8+Dgdy3QaURXiEOIW+yp5t0mqOhaVPigay9XkZqm5cVuPuLhuRYKhmwXzz8e1mQp5Wu//3+qztR54O1K2YqMj5qZWTiMutS8jGZ3pZmAjeVfbrNtQPKU/X0hxnSK/CZlVIvR9JParRnnAfSAQCEK0qkhRGamxxXgSCfZ8OFEHutnRN51yVJnHtXSD+bpZWl38rujnNAMvdfWYovJVJKboSn2PxcbsBj6gf//XSFwOSLbaf6c7fB/cPLhIypAPtPXxPyDuvM8iAbqPJMTVUuwrXc6v1WZIKwnB34hUlb6crLGpzw4zAmSxPD5G57eQdjUzOi+u1vOhv6s5QnIQ+DjwYbL4LY/1TmnyBTgPAb+rz/HPIyU2bGNic8AnWljc34f1GhvuOQtSFAgEIVrx6LVmT9MtllO6k32KLIizlx1/q2C37FWjSht1p0ipSQOmW0usPhSRJIvlWKO76kfVoP0M+cy4ChLrcZXu1D+q4zuO9JF6N1ktmgnEbVVbxO/RJJ9t+Jy+HkQqkt/tjrcaU/VzMObLcYNh338NUn5h2D1rQyXvKZrne8kSDS5Jjm+Q1b6qqzr0JUeWmvq3i5H+g3Xy2Y1P6H38IKJA/pA7v4/L87GEx5QMf17nso/jCwQCQYhWxQLeS9q2N/ozukj6VOt+EIpGohy1O7bSgWQtB/ju8SBBqLWElHpiOoxU5n6ZKgw3kC/MN0x/KkC3u94pvc4qov79V1UhDpMPGEcVhvOdCFUSclBDXKBDXaxXleRvFyGK4D9A3JQbVSUyWLNUwyz5EgZ2LduAdyKV3re7OXcU+I/AJ/R+bk2us1VA7kBcv4+7+29kLDLLAoEgRKuGEM3X7WIxP/2UzHvthr5SpHpT1gaQejKDCSGqkXexvVaN4Y3u/Ytd2NHHslgV8OeQAn93IZl7/tmzuJLzXSEw91ddX8NIRtfrlVQauT+FuLdO6f3frKRlmLwrbZ2S4KI55IskziAxPd8jc13682zUeXSDzpsJJCbp00jhxqNI1qMRpqabi+2+50Dc80AgCNFqIUCe0EwUKBXdkqQK/WmVcT6NvalfKfGzcTRDuY65KtIwi5tN1kTUnjH9nNNIL6y/IotnMhhxC3UgU3jqTuH5OSSY2triWF2h31diuQUJlH4PWeaYpbZX2nyOd1lbccSPIBmMuPdamv42sgKezyNxSX+mZGgLUrn6zUihTwu29u15/LM9BlyBuNtechuhxYoBDAQCQYiWDDO6MJry0CuxqTC3UWqgMyFqV8DOatAMOiPZon3hvH5dl9XNQQnQV5G6SN/T35nasZx6hS0nGKG9HMkI9BXY7fmyTDBUlbktIaR2P+pOhakm82FYz9fU832RrMN8layP2AT50gZH9NjHlQy9C6l8vV3PPZWQKpI5twFRLJ9CSklY3GAt5kIgEIRoJRpkv4ubQFwiLyBp4DW3MJcVy6sU/BwKUffksTWPOd6P1hztYMrQWv2cQ8C/V+P5tDtumuUZo3Wu76mNxxolQddT3FYlVfjSwHhfusH36/P1qNIYvif1flkLGp+12Cg47xiiBt2KxBetd+erlTzfhrVI0P/VSGbp2ZI1IRAIBCFaEfA7uSlERn8B6b21psdzWR+v+ahL5xu8m2xNh7nbS6XwhRJkU4YsaPsxpNr0XWRxKeuUMNXjNs4hCxZHZa1MbtaXucnMlfYUoubMIL3oXonEGa13G5BqCdnyBNQUoKPANxFXWYu59a/GkCw1/0xvRtxjN+jr1freWeY2TE4JUUuf9d1I5tpYm01SIBAIQrQi0EoI0X5dVK9xi2e3BRuHdJHdQj5LJRbI/Dj4LLMtwGWJQSnqKVddgrEsU4buJV9faIJwiZTBZ3yNI8UTX6djagTjRaSu0H2IInspUnHcCjbW6VxE1NcDegkpy2D1gGyeWLr8RsS1dQeiBhl2Au/V48YRF1ilhIBRQMgGdP6mSQHzVT8DgUAQomWDKV1cD1Pcyb0TsRrR3aLtGA87Ax9ZKALLPmqSVQz2lYvLgtIXmwhZnaEyZahC1r08lKG598YIgDXhvQiJB7qJrIBik6y/3icRlQgkZuc1iCqLjvFAh3tuhMjKIHwRUZwmybLO7BkeQ1SqNyp5sey0deTLNyzku8emJxAIQrSikcYQGSF6ic6tN1LlooGoQpchFZfXJ7vE2DHmU6QHkDitH1cFYVMXysBizYG63vt1lCtDLfK9tAL5+zpAVnJiN5JVdif5jLHTSED6PWSV3AeUCFUKSEYvz+1+RLkbUEI2Q6ZUjSAuuX1InNI0C69qXknIdKhBgUAQolW1qDeQWIT9ZBkmtuh1ozJYrMJ2snR9iHiidJx9nMbVZFk93SgD/SRCdj1DZC7OMmVoglCG2qHq1qBLgNuRgGMb6wG9v/fr+B5TcvI6RB2y4OfBLtcxP0eOIq4yXwx1LeLy3qJk6EqyCtn+mfWp8tYqpNLjfPaV5IMYBQJBiFYsfPG1WaQR5PO6eKc70rIss7T+zChzA0IDc8epkpCMpRwni0NpOTLUThmKmKHiuV9J5v0FSIDyNnfP7ZiXkM7zP9Cx34lUn34zohCa0tJOIfQ1qjwhOuV+HkOU2puBtyhBuyhZJ9OWNmXfqQwNtwEaJ6uWHvMkEAhCtOLhqwyfXoAaYJWNrZCgFR4MBSEzPmuAHaoMWEyRNedcbBLUSnb1k0p+DqqxvotQhnohRAOIMmOtTW4hq0hdd2vSo0ivsO/rz5cDb0WUpB36u+keiLEnRJv1PE+4c1+OxKe90R03k8yzGvlg6F6fc1tz1+j3bxRcWyAQCEK04tGL9J1mQa3VHepjZBVs/U75fJPVTYGz3f1u4CeQGJM9bldeW2RjYq66mntWDiIxLXcjtWRCGept3g+Tuao2ILV8blXVxI/xf0J6hR1AFJt/CLyDzF1q61eli89MScf1wG+Qqbpj+tpcsOmxApqDC/jORYpwq+AaA4FAEKIVv8h3kuyLFj1PiNYjboMnESn/bKKSnI/w9WmaiDvjGv3bLIvb8qTlyJjFkdSRlO97kHTtD7v7Zzv+UIbabwBMTQUJWH4DUsvHiMgkkml5r47vc/r7nUgG2hX68wRzG/x2cw2GzQXkB3efLb7Pq0MNJb+H9DtMI6ruZYj7DjJ3eqfPH0cUqZf0XL4AZMQUBQJBiFYsWm0WsbR7d6VkgdyIBHI+i7QFCEKUH586+QJ5DRY3s6yo2N6Tqlj8DZkbx46dIpShTvdymKzv33bgVxFlaJcjuS8irU7uRlQiT2BGCzYTi7UmFmWBPYe48D6jz+hpJei/gbj9bF6W1SPy17wd6cPWQILGT5K5ziMDLRAIQrRqDcFAYjwryQJp9YguQzKo1pM1mqyeh+Pl05NHERfZaxC34gyLm1VWpAwdVTL0BaQWzlfIAmSHVCmImK/299NIYxVJq38r4v7cRuZOGlRC8A2kPhBkXe9v1rGe0n8XGjtm2WJpNXP/bLaU9DyhG5WvAZ9FqltDpgr557odfFufcSWDpxC36/HYAAUCQYhWE1ol//eLcMMZdDMUdTUGm9RYjBQYlfNlx+i7nreQ1gkfQFKt97hjFloTpt09nCbLAJpRVeBjwLeQ8goNpwZMhwHr6n7O6jhtB34KeB9ZVtmUm/MDSCFGwzbgZxF32RbygcmVPlxX+jt7Ri027Tng3ykZPqLXOoi4+n4MuFY3MvaeMtXS91Kz5rKXAC9XckRCzEIhCgSCEK1oVAt2g1NI/ZQBXdyrBTtKv0sdY/Ezp1bCODaVjKxX43OlG890rPtFhMxlYa6ZA8C3kSyyzyDlFXDGMrIBO99HTw7GkGDmtyPxcuaWNFfoE2Sd5AeQGJvbETXJd5NvOXIx34rPlTbExcf8zSLurEkkjmkHEsf0duBH3PvqPcxLmzPWtmc4+fxAIBCEaFWg6XafVTWqn9Jd5d9F3D64HSXJbjBt8nq+L5DjzI27WozO9U2nVNSQGK6/ReJZvuPIkN27iPPoTIb82rIW6Q32VlVG7F5aPadjwH9GXJJPIHFFv4qkwKdZZQ0yBbHqnrV+IFWOLgD+PvAeRL3dpCR9W/K+XuLZ/HGzhMIYCAQhWmWw4Om0oehxpCHlWd0Jvl4XU5PXmwUqxfloaH0W0pT+fCMSrFqlf7EjRffNlCFrFmvFAD8EfM4Z+JpTA4IMtSdD1qPMsEPJza1KKCxLcBpxS90LfFCJ56WqwNyJuMlA3GijS7BeVZI5tgV4F3Pd2DYPmgskZEvZciYQCAQhWlQS5BfHkyWL5n6k0u5TSHDm+8niYRrkJfrzdXG0uCBzJ2wH/jFSkXj7IhoQU4bWkLWC+BCSSfaN5F7XC+57oPg+Nsn6goG4md4EvIx8DZ7ngf9A5pLcAPwTve9b3PtHOTcJBu2Kf1bmOR/9/BkkijIGAkGIVhkhmgReQKT/dWRF3Bq6uz2ir68irrOhAkLkF+HzyYD64pODqibcjhThs4rEU+74ft0730oBpCjmd5CYoS+SVSmukC+fsBzHkJLxaS0RifMKn+8Yvw24GLgDyaAcJV+r5xDwaSSLb5/e8x9BXFMtfXZG3PN0Vp8zq2W0DnGvjTmCuxgEw9x03s1Xm+d6Ye1nbM2YLFlTAoFAEKIVQ4b84nUGUYEu113w5pIxPpMspK2C+2EF55q0r3G0WgiRb1dyAZK980OODNm49FsZmkRiW3y3+i+ralF3hrCyAsavkpDLips7SxHzZGUKfD2mG4G3IRmCl5IpPnVHKozUXAr8ClmPMvsOI+Tdys8Dvw18V3++HvhFJVN27n7GFPnvV1nAemmuWbs/p4AHEVfh4WReBikKBIIQrTj4hdrqiexDUsU3u8X+Bt0JnkHcal/ShXFHm11m4zzaMfrWBlsR18pr9G/TZPVp+kFMvDK0Tn+XdqsHcaHN0v94oX67RZuc2+rYXhmyoou7EDXorYgydI07fjp5/1bg3Uqm3qfPTYusEvUAmTqIkoe7lRgBPIO4oPe556afa5qPMTMS9xyiUI0reRvpgoCZy3VYj59ECjLei8QZVt1nBQKBIEQrCqlycxbJjnk6WfS3IW6AGV38ntMd7gHEdXZRwU50xBmb1U6E/DgOIrFVuxaRRJQpQ/c6MgRZene/yZBlRXk34XxiUGzseslSWoz6NgNq5M/quceAH0eysvaQjwOye+xxEZLFNeA2EaYMLZd6PD4j9DTwl/qsvwopCXERWep8WSmAJll9K5TwfQWpeD6pZGs2FKJAIAjRSiZFuB3yISU8nhBtRHo1HUCq3B7V124lSunOcgxxH+xAsp1myNwiq2mxtO9UV0MwiLhW3ogE1lpD1Wof71UnZaiif5skHxBMn6+h37FIG1StGFXDaqUbrIbOEUTBbPXpvqVp4zZWVyhJuBN4bXKMxYcVzfdL3Pik7VJa5FXUbUq2vMvMp8D3M/7Ok5uz+mx/DYl5OqNEaKLDuJryOYBk1wE8isSoPUSmqqVrSiAQCEK04giR7fhndPf4PHmJf5AssNQbkvUUt/TYgqQmH0TqF53S4waUaK0mQmQVqUFqvPwM4i6zdg7tKv8uhjJkrprGIn3fxTB461SleLmO4VadQ0NI1tYDwOeRKttHmNtouNXjd6g5olol67m3Dfg1pKzEnpI1ppuu9GkF8rSe0S4kZigNqvafVe3Ts90gc9fuB/4QcXc3get047I+IWG+Ar1l2k3rcTbvfhMpxfG82+jMBhkKBIIQrQaY0W6qQW0mhriqu8k3I3FGO9RwbChYhNcBryDrn/VAsgtfDUpRJSGMa5AA3DeoUYcs82ahxq1bZWit3rvFisdpOTVnF1l15l6qLfuilEbGL1cSaYQodVHt0e+2FrhH55WNa7OLz/PEyeJg/BiN6/e5haw3GaqgDNI5rbxJvvlx0bHVRFHa1+Z8i5Fh5s+5CUmauEXHfqNedysZp6ojjyMl8w6dB9EYOBAIQrTq1KJ0523ptUNIoPU/0R31kBqOjck5zHDvQppZPoyk8T/jDMYwixPsu5RkqJoQhBuRNPvxZF4upTI02WejVKTArEXcgj+l88G7iOZDiCpKELbo2A0XvGcP4prdBDziCNFAB1XCq0G+B1czuUe3IDFAqetqlLkd3svIRqVLBWmp56lXfnbq9zyjc3YzmYvSJwXYZqVGPl7K5t195GPVVpPqGwgEIQrkyFCNfHqtxYyMIpk33WBQDebtep6vI0UdX2JuzMFKJETm/ptSknAzWUVqn1W20pUhiy2z2KTXqopyJ3ODi/s1D22+mZIzjsSrNckrktUOilCzQA2qKunZofN5J5JFdidZBpbVDRro4nlp939KiFJRl/rFSLNPx2gMuKrNsUUFHF9EXN4TiMuyaN5FL7xAIAjRqiRE5lI4636u9rD79wvqOlUT9iHpyx9FWhtMrQJCNEQWeD4CvFK/5xBZu4eFGrhzpQxRQI6rSkp+HKnLM7iIYztQQjAmE+NbRD58BtxsgbHeoQToPUqGhhHlaShRhqodnpVWoqaUbS7smmoJORrk3Fd39/WdishQA3FRfkY3M4eXaN4FAoEgRMsGvlJvxRmYhltAU3dEuiO2nmgb9HW5GoFjiBvtiJKu06yceCJfr+a0/nyFkr4r6V+pgeUSM2Skzq5nCAnE3UZWvXyIvPvQj5URh0qigFjMjc9wrJIvzGhB+MP6OU8iAfqHk2tqufc0mZsBtwdxDQ3o/XmZErp3J9fre3rV2mwW/DyoLmAe9WOetLvGTmpREfk8i2SSTujz/zzwEaRZ7Sl33AiZyzsQCAQhWpXqkGEGidM4hWSWeGPV7c62SFV6NVLF+WnddX4ZSd+dcErUcq5qXVEDPeHUhg8gGXUXOaI4uEBjd66VoSLjjSPDkMWXmGuwiBBZ5lFqeE3FaSbzyEhOqjQ+CPwnJF18P1lV8HrB+XypgTHgR1URGtPzjiNZbEVrSFE9pZYjWul3X07PbzP5t5UQU5u7ZZhBkh8+rf8eUoK0PyFDdmzEDAUCQYhWLbxhPYn0w9qLZIutcQtvmfusVUCUbIG23fc63aG/TA3X80qIms5oesOznBZdI2vTZBW6b0dcLxfoMZNqdOarHCwnZcgHVFsrlgvIXKq1RCUpyubybhhzw9bJsvIGku/t09NnlZQ/hVR1vpvMjTuUXKtXhS5EFMk1iHr3HvL1hLwiVKdc6fTjUOROmkWqM59GXMAz+ppMiNqYErCdZApir4Us28Uo2efUunzGX0RU2il3DXWkCv03daPyQPK+miOMdcJNFggEIVrlCpF3MxxB3BNjupBfTJbiXJR100qIjI+ZqJbcn91KuEbI0puHdcG1czWXyeJrRtFiUjYjfcreR75X2WpRhtIsuvVI64o3Advd/fRzAkeWLfNsyP3tGeBZHb/tSP2btY7QWBFL31ris8CHge85MkRCZCyI3daBt+prj6pBe9usGUVkrojkFxHcp5Amx99H6m2d1JcpKy2d25fr9byPrBxDg+5rUxUpPz5Lz75LN2vgC8CfAV9AXI/+8yeQmk+HC963XDcpgUAgCNGiKkQ1NTAPI5V0p8nHftRKDOhABzLRdIavhaRZX4NU+D3pdthF76+0UaOWggx5kjesCtffQbLKYOG9ypaTMuTvp2XRjSJZdG9EApC9olctMJ42TiDtIR5T8nAUuFYVk0qiJHll6Gngc0qGPunGf0TniG9aixKfi5A4rnchLrI17pqmyKubqbrVbhwqStifIav+fQQpbvglJUSndYzWJarNQBfztFOGWtU9l+0wpYrVSZ0j5qq0Z7YOfEPn01e7WE9rifoWRCgQCEJ0XsEWcVsAjybKUXOB5/bZLBcgMUWPITEKj5S8zxfFa7nrWIoaRl4psbTzfUhxymucmlFlYZlCpgyN6bnOZcyQfW+fRbdGCdE1avhnKC5WWE8UrmPA7yB1a55B1MYblLyMkLmtht3YPQF8DPhbpC2EH6MZ8hlk6HVaHaGrVYVZk1zXUAHBrbQhKOnfvgv8HvC4fr8JxPV0xh1zMRJcfy0SdD6s83yzKmKb3bGeOBdlq/lg86Eu79kPkL5i31J17RT54pdNVYBe6OJc9UQRCjIUCAQhOi/hM31s4b+EfDfstIDjjO5OT+lCul6VhOHEyPiXFXq8XY/ZSZa5NYMEcx4qUY38tS72Yl3Ta5jS73MLcJuqHHW6L0lQZnyNJJq68KSqI+dKGfJZdCgBfJ2qYmsKiJxlG1k1Y/seB5AMpQ+qajGu57iCrBu8D05+QknTNxBX2ded2jRE1i/OxmAUcVdeo6rQnY48TCWqXm0e9wPE9fVN4A+Qlhc4RWonWVHDzTpGtyLlF0baEF+cctNNtlpLidcZvSdn3GbAyPoBJUJGiI53+J5pjSy/0WgQHesDgSBEgTmxCuYa2IAUdBt1i3nLjfsxpNfU19QYvQpJbU5jJnA/V/V8r9Td9Xvd3w+oQvApJD6jk+q0WKQojZdai7TmuFHVnGnm1pjpVRmadkTjGPDbqpCcC2XI3FKW9bcd+FWybugNZ1CNMD+rBnjUzZGTwN/odzmpx/48UsPoYrKyDqN6vqPAf0SahZ7Q9zTcXLFAbK8KXoe4LW9TkuWVlOEC0t7t/Pdz1ebhn7ljrgHeqYrZJke4rP9aGRlKM7NaXSpA+xH39SP678NkMUpGiKZ0zI45ItsORfWZoLvU/UAgEITovIHvyXQKCcDciASH2uJdTwjRcVU1/kQN3YtkfakswNZiN9J7tUFflxaQhVHEFTDtFIVZJQvPu2tdjHT9lAjtAV6jhniMuVl18yGeVSVDLcQd8yXgQ6qUVMh6RC2VMtQkC16+iKyCs7WzmCAfH3RQr/dJVUleqff8u8DvqxHfp8rJP1CFyObYmP7fuqbfhbh6vDJXcQbcXGSX61y5FXgLkgWJI1lDLKxlSvq+NUr0RlQVepOS/cvaPD9WOsCn5pcRn7oSmRM69j5m76zOf0+I9ndx/WW913z5gFCAAoEgRIEuDfWALsgPKGG5kywOolmw+32JLObkSacyWOyHKQvd3qs3IjEhvnBjVX/+JPC7uiu2+9/PmKJqcs5LgV9BYp52kbk7hph/ELVXSPYjMUNfcKTAdv5LqQxNqcHchMTkvJ98b6/BhJwdQdxi31bSfJ+OybNIrMoapE7TmxC3q5EqU1EOk++anhILK6ZosTqbgV9GmgpvIt83zojaQqqDp8kBF+g4vEO/14iqQNs6bChaPczzJ5F6XN9EMtdOuHnc0E3JGffqZm7NUp41FwpQIBCEKNCDsbY4H4sleQhxh61Vw+fTqy3Y+OVqIKu6ox53qpA3XGf1ZbVtzIh5GX9QP2djyTWOqSH5CuJuSYvQ9YskmEtrEIkRMRXrjF77fHqVGZkaIUutvweps2PuwfUsbcyQV4a2IC6y9yABwpDVV6qRT/0eVeXsJSVBh9zzeBUSfP4+su71p8ln0d1Dvmv6eh1vS6uvOxKwT4nQnUpKjTB49bHWh/FI59mVJcfOOvJTdeTYK0HH9J6eIR+nY+N4Con5MUJ0oItrHCIfy+frffng7CA9gUAQokCfSJE3xi8Bf6VKz9vcDtnUJNtJv9MZ+51qNNKKvt9WMrMWCarerefzgZ6ddvn71GBXkEysY25X3o8U4dSgmFrj1YjKAsbVXBonkf5uf61kEkdAliqbbFhJSEOv621KYvYlylAlUVAaev9+A1ER/0hJ8wYkrudOpHv8lhJlKM2is2MshmfUEYltSCzTrWRxaXYfqiVkZrFh97Be8vnH9ft9BHF1GXGy+DlTciz250SXnxvqTyAQCEK0xPAtFKZ1F7sRqfprxQhnyIKjL6M4ruIwWUXf/WQp2OvU0G0iy2Qy4+nrzFh/qUFHwk6zeB22q27HbYUpbyZzcw3Nc775VGoLSP4e8AngfkdOlqJHlM8mszYkO4GbkIKTb1DCOlugvPiCjeuQAPNr9ZxXIm6t2/Rl93KGLHA8VYbSLDqrmWPBwVcg7tM7HRE/pWOVxsqUKSPzLYngKzO33PNQcYSs5sjcEUSxPINkzRkhOt7l5w2Sz1r0TWTT/wcCgUAQoiVSiMz4GSE6oov8KTWUA4mhKMOXkGyxR9TIHSOrPTOlhuQVqhR5QjTkSNFgoiJ8TRWrB/Sc1ttqoepQ1Z2ririDfkaVrwudMazRW6yKL7w4oOP3PSQW6jtksVAVlsbdkWaTrUF6fr0XidvaWKDApASjljx/b1eyPEi+V9g0WRC2xQzdQz6LbsKNub+ubcCvqTLk43bWUJyuXtZawmLCeo0vMkUsbUljAdy+FMVDOs+/pM/KhBKh4z18Xp3iIqSE+hMIBIIQnXv4eKEJ5mbP2EI960jJLJJp9pjukD9FeXzEdlUIrJq1/zxPIJ7U3bc1hr2HzI012EeDYZlsltl2M5n7yFKneyVDkM+Yehhxk30cCaTFnbM6j+/R6mDUccTV3DwWM3QZEiz+Q2SVt5vJe8vmhRXIHFDC4knLFFkvL68M/S1Z24i1CRnysUx7kZYXqTK0puR57zaNfT5qWiUhtjWneL2IZMp9Xuf5NwvGaSi5B/6amwUKUCAQCAQhWqZqUcvtYM8UGAs7xuq/PI9UKP4iWTuBIuwFfl0N8sVk8TWWzWQqxOPAv0W6nk/q+aaSnXW/ds/eYM0kSkg3iliZoTbCcxIJpP2EEiObvzXmlg+odHFuaO8q8v9WdWxP6/GbgV9C0td3J0a8W7Jc1r9t1pEGrwwddtc8SeaaHSDLRtwC/BwSy+RJVlkguxGzoUV+FtK6UZPAXyrpf5LiPmA+y7LTPQwEAoEgRMsYDacsnFWSsxHJIhpOCEnVqQMPI32eDCP6vg1qREeROjc/7QyMBfdazNC0Kih36etEouR4krJQ+H5tVnfoJr3uaRbeuNWrDENq6K3v1ARZyYLFxqT+ewVZ1paRoQmy0giVHr6XKScW8zXE3GyyImWo7ki1ucs2ueva565rhGJl0uaLkaFHybsgK6pS7XZqVZPeVb6WU4Za+r2+rfPyC+5YGz8bi0aoPoFAIAjRyodXRAYQ98AfIG6rf0qWhl5PDMw4kob/kNs1b0EKG96AuGl2MbfvlAXUmkF+Dvh3alBPlBC1fpEhc801yeoO3aTEqOWMXa+kqJIY4XHENTWIxBF9F4mFemEJ7+sORJl7PVkKu5HWyjy/o8XaTDmi7HuypcqQbyZs8+wCpObPu8kH6A9RXmhw0pGvQ6pEfdudexCJi/qAknjcHOuWFJlL2L7XAf2cLyMJAh51soD/SH8PBAJBiFYRfF2iSVVsZpEA3J3OiNbcsZuRINthxD1URzKQrNLzleT7nE0zt75Kgyxe6Hk977ga3Fn6n21jPcssYPwWZ5QnExVpPoTIG/e9SkquQgoW7kYqEk+4zykzpq2EZE3ra5a5sT9GCEaVeJrr5uWqwFjw8yk9ZnABc8SC38edMnQv7Xuymcttkkwhu0WJmgXdDzHXTeaVoXVOGboXqZyduq4eRdqGXOXI9EAP380wg8SxfZ583SjLyJsl4oACgUAQolVPivwiP4E04bzQkZuKU0HWkvUo+xF9vxV1XO/IkBnvQfKxFFNI7aOHyVo2tBaRDKWYduSkX0iJ0QjiEtqOlBw4w9yaNp0I0Ywa/4NI9t5MovCsUXK6Tf81QjdOPhNsDQsratgg3+XeK0PterLZvZ9y39WaprYbu2bB5/1mokT1a95bEPWAzsmPFJCuKfIFKwOBQCAI0SpGg3wQrdUl2ka+iaulro+Tr1DtUSeLHxlwxseqV0/p+b9MVuhxZpHIUMVduykcl+pnzZCvddNrQHXR57TceSyWaNsCjXYnQrSx5H2mhg0s4LNTpaYbZcinr5/S3+1B6g1tI3OHVkqIeY25MUpGUgb1e0/ofTNlchtZlfBeyJ+512pKWr9AVjdqhHyF9SBDgUAgcB7AAl+H1UCMI26xb5AVE7QU6labV52s/tCE7vQnyKoSt5ACju9XY249pKr0vxqxJ2RVJM7p/UjV5UPuembIYkOaHb7fuXrN6LhOkXejtXtPY4GfOauEpumI2X+DBGynGxZ/79L0+PXA/4JkEfo5VE/G2wo2ttzn/cPk89aRuf52AL+HKI1nyHq1dfu9rXCl/fw9VfO8yleNpSEQCIRCdH7B17GZRjJ5XiDfwb6shk7T7fjb9Zw6icQLfQX4KhKvAfl4o37DZ5dtRIoAvlHJWNORpkrBWJSNU1rIr91xC+k/VXHjP9hBxfFFK+dbqNDfz+Y8lSE/7muUtNyCxDRd41SZqpsnPstrrf7/cf08y14zdTGtcP1up8BNJ/e8G9g1mBv3DEvfJiQQCASCEC1zDJKPB2okxIkeDNAsUuX3j3Qn/mLyt8UgQ+l1rkcyknY64pe2h6g7Q1nk0vFZRu2IR9r+oTXP6690ccxA8hnzbWVhZMjciUaGXqL7mKGaG589wE8C7wIubzNf0iwv+7z7yGJ5RshqU21Fep+9ibw7spcsQYuHs/i2Y0hG2QSd6z8FAoFAEKLzAE3yXdIfQdxn68hnKp0hi+OwTuBn1IBZEKpXZ15EihXeRZYNNaqkZKkanZor0CsTngTUkrmWKkUWJFxUL6dS8pkLMard9LaqJCSosoDPMrIyTFaE8zEk68pieIqUoXR8ZnUONFUdMmXI6g1VCj7XshGPAJ8jU6JqSH0hc6VdAtyOVN7epr87w/wDx31pB68wRU+xQCAQhOg8hikgZoifB/4cSY+/DmnyuUMN27f09wO6Y68h6c+fQeq4WBC1uV+m1MD5qr5LSYZ8pWg/rypqbJ9XY35FMhbd9DXzLUnS8exHD7ZuMV9XWdNdo3d5Po/UifoC5XWGigiRwas+KXnz42NEdL8SoQ+RKVE+S20T8AtILaNt7lyjzK+PGe7zN+ncHnHfv0L/amEFAoFAEKIVqBCZsTqGuC0OIPWJnkHcIEeQYOun1WBtcYTosx3Obwa3vkRkyAfszjgSZjEsFf2e9yKVul+u5G8bmTvFrnNSjbY19LSMtQE3dpXE8A8s4/nbdCTICMVZpEjmEb33H0Jivawi9GSJMmT31KpI70Oawa5RQjNYQlrqbowm9DPvd9dkbrLdThm6WH93RsnQQrPoakqEtpEV8CSIUCAQCEJ0fitEqcE8rEbyScR1MqrE4gRZM1jvMusEn8m1FAbfk67RREEx4nKUrPfYXuCn1PCu1+s1AvAM8PtqsAFegVT0vtApIgttAbJU99lIovUks2t+Cvi03uvHyALf2ylDVR1byyTchsT4vJ6sbUilYGxSd+KUkm/rMWexSOuQFjDvV0JuWEgWWKVgHlotrXSuBgKBQBCiAC0lRGcp72if3itfeyh1jyyl+8gI0SDSY+1KJTkpppXsPKWvHUisyivId1+vAF8Dvq4/HwDegAT3bio47xlEUTqsZMLiqmpunGp03+S1yKhXndFeo4ShrKeXr5FksV9D7rs8ibjHPoEEwNtnWO2oRsnnN5ib/XUn3WV/1ZxSdEIJmtUwqiAK3C1KUK/WYyfJykP0Y57YWG3S+3lSyfGEu8ZGLAWBQCAIUaAXtHOFLVXWTiUhRJZufyuSbp+SBUvpNnwL+Jj+/Rb3+2HyMTKTqqSs0+PGE3LzItIt/bNI3zZzDw0nr0oJAWrRPuPJzmVxWfuQHm1Xu3thipgnpNXkexwF/lqVoYeRLC9/LdMl982UobNOGfo1sgKMhjJlyGKeGjpWD5Ovar0DiRl6mxJUfx+qfZon1mutjlQV/1FE8fv3ej1GiKJlRyAQCEJ0nsPIhf+3rI2Br7tzruGrT2/Qnf+tqgK0HDHwSoWpN4eQ6shNJQs79Xt/i7xKtoHO/cE8obFCgJNk/dP6iScRd58np1U3Hl69O4PETh3T73U3Er9TdyTG+r+1U4bMTXoZcJtThjplf/lA9GNI1fIvIrFLVaQR7FtUGdqr7zmNuMkGyPd1m4+L0mfVmetwDFG4xoE/TghRPZaCQCAQhOj8ht8ZN2jfhwuWTyCqN5JDSCbcdjWAswlpsyaqTWcgH1cydC9ZqvhB/b1ht6oXr1RjmmalXYj0ertNidCMO8e3EdfbyT5+Z08+7L6ZCyoN7n4Y+BTiGntWFRpv9K1lRVnM0DCZG3Az8EvAHXSX/eUJaR0pAPoRxF13SO/V+5EGw7uTz/UxaEZgaz3OZ8gXy7S6S2MFcycQCASCEAUKSc5KybxpOiN6FviuGtdXq/rhjf+wGuFhJUYWD3NcVRePyxCVaT3wZsRVZvFD04kxXUvWgd3jGeCbwA1Ikcqz7lpnk9e0Gmt71d01jyvJszikm5CMP9+E14/HYUThOqBqzKeRbEE/Di1HOpoFJNOCkS2+Zg+S/XWnIy+dsr/sM4aVrFaRth779XevRlLrb9HPm9Hjxtqcr9t56SuqG6w/Wgt4CAmaP0Te1RgIBAJBiAIrksCZu2hQjdtfqDpzkb78nNqENAh9SQ1zGfYA/z1wvZ53nZIOi0HxWUu+gnSKnWrsr1aFyNL1W0o0TiMBxkf12g/r/4/p35pKfF6ppGyrU2S2kjWt9Z99VBWhv1FF6ChZ+QDDTAfia5liFiS9FfhZRAXb5Y7rlP1lqownJEY6bkTcZNc6ctkpXmg2GcN2ZMhch0Uq0GHgPyCq2XNkRSaXqkREIBAIBCEKLAopMjVgEqmZNI24dd6MBFpbDIsFXU8piTiuZGdclQlTZd4MvI/i7vJDba5lSs9hHdSHkBiZC0qOt7IGx5TEHdb/H1X1pYm4qV6JBDCXff8jqgadQGpEfRqJFfKkza670UEJ8a7SqpLI1yG9xK7Uv1kl6k7KkFUMB6mEfq9+p71IQ+E36PmtRlDFjcFZdz/W6XtG5zE/JvR8hxyRfUDHx4pCWlHJIEOBQCAIUWDFkyJv5I8hlZBBUuU36Nxai7ibxpHMpjNIuvdeNfDmkjFXWS+YJKvlVNXP3N7hPVYmYMwpPhbnYmUL7JgyHCFThF4gC6JuFSg13Sgrlo1l6el3AO/RcfLX3S7+pqnjsVaPOwD8JhI7VEPiht6FuN78M38KydS7B3Fhntb3Xw38I8TF1guOKxH7BhLM/YKSrNOODMHi9dgLBAKBIESBJYcF79oc+rIa9FeRBQC3lOjcqCRkRg392i7O/5ySj7ojFlZHx3q7HXWEaK1+7hby2VJj+vtdTrlpFzdThClECTtSoggZabGSBL0UybQA6KYSuttUybEaRUOUBzd7Zcgaxj4JfBz4oP7tR5E4pGvIUvHtOp9F+pvdrd/N8BhZK5kxN/Zp/Sv//+NKxB5B4ri+ShYPhVOGZkMZCgQCQYgCq0khMhdPRQ33i0ic0EGyFhBTathr+rsm3blhTgN/qkrMRGKMLa5ohnzq+gCiOg07IjKgn/s24McXMN9fRHqPfU/J2IkCsjNLFizcDRHyTWMtu2wf0t7ElK46c/uUtVOGjgH/GfiwjstmJG7oBkcSGzpuh5BimN9IyBD6/f5Eid9Al4TIAtVPI/FbEwXXG2QoEAgEIQqsanJkxvJZxAWzHnG7ePIzUvL+WVV79jtj+YSqFl/tw/U9qIZ6DRL0bZ9pMTS+OW3DEZoGWeuULyIuwWMFilC77LF2ZGjAkYgKEgx+u16jz+QrIkNlytDngP9HCc1VwDuRNh/WFqam32kayfj6DKLE1dzfGkpkn9fXfGGB957EBhkKBAJBiAKrlgzVHbE4gLhqngP+N/JVlctwBol1+QslRajBfrxP13gWCS5+nKzuUdORknWqzjSVCEw5JcMIydGEDBmpMkIEvcXEWFaZZYRtRQo/3o64/BqOpPSiDH1UydAG4AN6vh1KhiYdeTquhPMeVXPMlTZJ/6qeN8k3c42YoUAgEIQosKoJkW8VYVlndyOZWq9C1KJhVWhmydwp5vJ6AnGNfYS52VhDjnSkLSr856dupdSVc6yA0PQKiz+ajyLkz2FqmmXe7UWy7N5Mlh1nak61YLw7KUP7EGXofWQZZXWy7LNHlYDer2NixHCafJVqa01S6XEu+KrqoQgFAoEgRIHzjhj5WjuHkCynPUhA9XWIWnQU+A7wAyRuZVYVnCMUp6bPdjDIrQLCUaRU9Os7zi5Q7TBlaEav60LgHyIp9hckRHC+ytCvIK05rKjlFJm70u7LfYgaV3EELM2Sq7Ow1h2hCAUCgUDgvEWVubFC+5BMp18Cfoystk6Kmr7X6gnV+nRNpnYMu/Pby5rKWvuNIXfccHI91T5ch2/+OobUBvq+I1lnybe+8IrLbPK7J4D/m6xEwD6kAexRR95OksXuPKrHezfmWB/HORAIBAKBQGL0PQaQbKedSHzMYAdCZW6ayiJcV9GrkhxX6XDMQkiZ9QgbQ4Kd/z0SUG4kZ7qEENWRmkH2t6NKfvbp+TcA/wVxn3lyZcrPC8B/4473JDT6iwUCgUAgsEioIqpKGfkxxcZ6bg2cQ8NcWQQCVvQZfiwuAf4XpAntKcQNZrE+nhDNRxmqI8qQkaHDSAq9L1q5nnCXBwKBQCCwpESjHWnqlwKz3MfA6gzVkPif9yKp/BNk2W0+ELmdMvSr5JWh/5u8MmSNaltITaD/ilS+9oTMSgYEAoFAIBBYIkJgGWgWq7OaCVAR6RtMfn4r8Ltk7T6aZEHWvgZSmTJkwdL7lBwdde+xDL6GEqn7kLitrWTxUYvhkgwEAoFAINAFKUpf5wsGyPdo2wb8MfASmQJk1aONHNURF9oJR5KOINljpgxtVHL0BHk1yeoNHUEKZP4qWdVwu54gQoFAIBAIBJaMBKbZW/uQwOYXHfk5m5ChVsHrcURR2qrn2YMUXTzqjjmh57KfDyExSteRucfsmoIQBQKBQCAQWBJYrJBhG6LoPOqIj29nUUcyzGYSMnQY+GUyZWgd8M+Ah5LjphB3mf38JPB3EBcZCSkKBAKBQCAQWFQUqTBXIMrQQUdYzpAFPqfK0LNIE9lvAr9HVrBxK/CTwLcpTq231yPAbyMVsCGrDRVB1IFAIBAIBJYEVmPICNEORBl6hLl1hXy8kK9D9F+AH0bqFF2l5xkBfgL4EBIs7ZWh0+7ng0q+riAfxB7qUCAQCAQCgUVHhbnZWzuBnyavDJ1kbvZYS0nO95EGt+8gXyOoBtyMpM8fIkvTnyEff1RUiXqUUIYCgUAgEAgsEazOkJGhjUiG11cS4mM1gkwdshYbn0Ham7yMrAmr4SLgF8i3+JhE3G7mbttPVKIOBAKBQCBwjsmQvYwMvR24JyEwDfIp9lY48R4lPKPJOUFUpn8A/A1wnKw+0bT+21Qy9AfklaH1RI+yQCAQCAQCS4QK+cav65D4nz9CagEZ8THykrrK7gPej6hABl/I8Y3Ax8iKOE4j7jJTl44AvwW8IbmuQUIZCgQCgUAgsERkyNcbGgRegdQMeg5RcyzOp04+dugU8CnEzTVQcu5XAf+GfCXqCSVFLf3/vUh6vV2Dr0QdCAQCgUAgsOhkqJaQoquAX0difcwtZspQA1F2jBB9F+kvNl5y/h3AB4HnybfysNck0hj2f0IKNeJIWZChQCAQmAei43UgMH9S1NL/7wJuB96C1P+pKhHyaLn/TyFFF2eV/GxBYoia+t6XI3FI1qF+Qp/VEf35ReDz+jqif2smnxEIBAKBIESBwKKRIPu3puRlHEmL/2HgRqQOUZO5RRp9kPM24F1KnkaQfmP7kCDqQT3ndnf8MFlQ9hTwAPAJ/fesvseUpCBFgUAgEIQoEFh0QlQjy/QaVDL0DiR+aC1Z4cXUfeUJ0VbEZXaDkpidwJXkM81AYpBAAreN9HwZ+DhSzfos+dpHQYYCgUAgEAgsyQbCd6/fDvwJ4v4yhSZNrS96WUzRCX1Nlhw3S74S9UtI+47tjmRZUchAIBAIBAKBRUWFuWqqda/3gc9nyVLiy17NDiRpiqzOkP/bw0gl6p3umtYEGQoEAoFAILBUqCE1hsw15bvX+/YZ9TaEx46ZYW5DVv/3oh5nzwM/ryQsdcNFVlkgEAgEAoFFha8zZOjUvb5XZaieECmfpl/Xz/kT8kHWa4lK1IFAIBAIBJYINSUfRcpQUff6TnFDnchSE3GVWd2hg0g9oneRd9kNEq6yQCAQ6CsiyywQmAsLVG4g6g+IMvRG4E4lRqYMjRY8Ry33b4us11kdqSF0FknP36j/1pL32vGHkFpDX9ZrGiFrEBsIBAKBIESBwKKiquRjQgnKduDXgFvJmqgaQYGs7lCFvCJk7rBhJHX+APCHwFNImv6twOUUN3adBZ5AgqmPub+1iPT6QCAQCEIUCCwiTBlqOjK0C3grmTIE0otsDflGrJ4YmcLj/94AHgQ+jKhEm5UQQV5JqiHxQ18GPqfHGhFqxi0KBAKBIESBwGKjiig51pR1E/ATwI84MgSi6KTZXaYG1QqIEsAzwBeAx5BaRnuQStVDZPWLhvTY55DYofuQ1hw1PSYqUQcCgUAQokBg0WDuriaS7g4S33MLEtD8Cv3dJFnVaMNZJSwj7nmaRtxjp/T/p5GGrvfp/zcrGbIij7PufA3gWeCriDoEokYZaQoEAoFAEKJAYNEI0RBZhtcI8GbgvcDVyfOSNmn9vr73Rvf7x4GPIh3pD+h5J4Cn9e/WA81/fk0Jz34kbmg6IUmhDAUCgUAQokBg0YiQxQxN6e82KLl5FxLjM66EpupIS4NM9flr/fvNSBXp48D9wGeAhwo+7yLgNWSZakaQqoh77F59v7nQzBUXCAQCgUAg0HdYvNCY2xgMIsHTf4BUh7b6QHUlPVZJegJRf/6ZkqAq4ga7CNhCln2WYhvwC8CnkJR9X8OoAXxbP3+LXtuwnjuqUQcCgcAiIxSiwPmCtCu8b6OBEpobkC70b0ayyyAft+OJSQuJ7bkcKd44jShIQ0jn+l1Koh4AXtDzXIjUMno9EphdVyI0rOduIO62I/oZo+6zAoFAIBCEKBBYMBmqkfX+sk7yRnaqZKn1twAXFBCpVvLcXAy8G3GVTevfa/q37Yjr7WHgf0Zih1qIGrXLEZ3Z5LyDZJlmgUAgEAhCFAj0lQz5nmGGUSSTbCtwqZKh2xB3lREmI0v2ajnislVfRZhEYonOIgqUL9w45H628zf02P2OuDWJrLJAIBAIQhQI9IkMDZDF6HjsRVShtwC7kVigDfo3O77liEzVEZThks87CHwR+AaiDr0EPOmuxStSKDmqIPFE30IKMb7krrVJuMsCgUAgCFEgsAAYgTGlZxdZsPI64JXA25CYHsMsmULTrpt8HXGDHSErmHhQSdD9SA2hU8l7LBh72hEt+4yTwFeQOkXHyFStUIgCgUAgCFEgMG/4uj4g7rH3AncoKRpA1KAt8zz/08DvIZWnG0q+JhC319GEDA050mTXlmaNnUSCr3+AuNusMnUoRIFAIBCEKBCYNxnCEaGdwE1I9thtBcfXyafdTyBd5o+TqUtNxK1lrrKvAncjbTiKUHXHGhmqIDWNfNC09TCbQAo4Trj3N+JWBgKBQBCiQGA+sOKJVnF6N/BzSJHF3W3e4/EA8EklPSfdMTOObB1H+o2VoeZIjZGqC5Cq1+sSQlRH3GiTCanzMUeBQCAQCEIUCPQEI0RNJIvsVuBl+rcJR4CMtMwi6s8BpF7QPcCnkSrUnTCa/GwFHGfJZ6nt1eu4Va/JMsgGEMVoC1kRxmYBSQsEAoFAEKJAYEHkaDj52VQkC1w+jsQC/RWSEXZEfzefZ6eoovQe4B3A+4GrkNilWUQVsuauI4QiFAgEAkGIAoFFQsuRjwGyAGhTYE4j6e4fAT7kCIl1r7fjzPXlCUtZj7HN+lqnhOdGJLX/tWQlACqOqD2KZJidIKt1FPFDgUAgEIQoEOgrrIaQqTee1JwAvonEDZW16DBi1a168wakvtHVSEuPccRNNqDnOYtUrAYJ3v5N4EvAs0hQ9yxZf7NAIBAIBCEKBPqGQf23Rr6fWRXYhFScHiHreF+k/owhqo81XV2j/w6QxQvtRNp53EG+/YcnWhZU/TTwGeAuJUaQqUZBhgKBQCAIUSCwIPi6PTNIoUM/3y12qIEEM79bj3vIEaIi3Ahci7jDtgGX6P/NFWeEZhud6xsdAv4z8GFHhoyIRd2hQCAQCEIUCCwYpq5UkODo+xAV6BokK6ziiMcIWQuPbwHf1r+NIQqQkZMtwJsSQrS7x+t6CXHRTSCtPT4EPKHXswZJu4/YoUAgEDhHqMQQBFbpnPad5+8APgBcRpZqP+A2BKeArwOPI7WHNumxa/Xvg2SB0oP6Gu6RpP01ks7/GKIKPeEIUC3IUCAQCJxbhEIUWG3wfcKmkGDlryG1hiyWyGJ+rIr0GuB1SFr8SSQQ+sJ5fO4Ekrl2ElGDjJztRzLZPoG09jCMIu66IEOBQCAQhCgQ6DvSfmF1JUSGJnPjdUwFGp/nc9FAqld/C3GJfY+sFccM8GJChiBr9BoIBAKBIESBwKLAag5ZFtiXkKKIV5Clvado1+F+WgnOlJKrk2TxSg2k0vVjjhA9W0LUhshadkQ2WSAQCCyjnXQgsFrndgVRfqrADuBVwD9GagX1iqeRGKPngEeQ2kWn3WdNKlE6oa9mF89cqEOBQCCwTBAKUWC1wmKJmoi68zRwEKkVNIWoRf5YK5zYIOtCb4rRaeBBJUTPKiF6ssPnD5FVum4mr0AgEAgsw110ILCa53faI+xCJG1+kHwAtmWNTZMVZbTno45kop1F3GZn6BwI7eOYWsm/gUAgEAhCFAick3luBRT7pdAMkilIRnSaZG0+QgkKBAKBIESBwLKc660+n6+o5xmEEhQIBAJBiAKBZT7fB8g3ezUC0+pAdEz58f8PBAKBQBCiQGDFzvmied/q8Ey0OvwcCAQCgUAgEAgEAoFAIBAIBAKBQCAQCAQCgUAgsFLx/wFSAP5h49c3vgAAAABJRU5ErkJggg==';
const dialTex=canvasTex(1536,(g,s)=>{
  const c=s/2, ink='#16181b', inkSoft='rgba(22,24,27,.65)', open=c*DIAL_OPEN/DIAL_R, hc=c*HOLE_DY/DIAL_R;
  g.save();g.translate(c,c);
  const bg=g.createRadialGradient(0,0,open,0,0,c);
  bg.addColorStop(0,'#fff9f3');bg.addColorStop(1,'#fff9f3'); // dial colour #FFF9F3
  g.fillStyle=bg;g.fillRect(-c,-c,s,s);
  // matte grid: a fine stamped square grid across the ring (0.5 mm pitch)
  g.save();g.beginPath();g.arc(0,0,c*0.878,0,TAU);g.moveTo(open,hc);g.arc(0,hc,open,0,TAU,true);g.clip();
  const pitch=c/DIAL_R*0.5;
  for(let x=-c;x<=c;x+=pitch){
    g.fillStyle='rgba(120,105,90,.16)';g.fillRect(x,-c,2.2,s);g.fillRect(-c,x,s,2.2);
    g.fillStyle='rgba(255,255,255,.14)';g.fillRect(x+2.2,-c,1.4,s);g.fillRect(-c,x+2.2,s,1.4);
  }
  g.restore();
  // fine lacquer grain so the ivory doesn't read as flat print
  {const r=rng(31);for(let i=0;i<30000;i++){const v=r()>.5?255:110;g.fillStyle=`rgba(${v},${v},${v-20},${(0.04+r()*0.05).toFixed(3)})`;const a=r()*TAU,d=r()*c;g.fillRect(Math.cos(a)*d,Math.sin(a)*d,1.6,1.6);}}
  // bevelled inner edge where the dial is cut away
  g.strokeStyle='rgba(30,32,28,.5)';g.lineWidth=6;g.beginPath();g.arc(0,hc,open+3,0,TAU);g.stroke();
  g.strokeStyle='rgba(255,255,255,.7)';g.lineWidth=3;g.beginPath();g.arc(0,hc,open+9,0,TAU);g.stroke();
  // minute track
  g.strokeStyle=inkSoft;g.lineWidth=2.5;
  [0.885,0.965].forEach(r=>{g.beginPath();g.arc(0,0,c*r,0,TAU);g.stroke();});
  for(let i=0;i<60;i++){
    const a=i/60*TAU-Math.PI/2,five=i%5===0;
    g.strokeStyle=five?ink:inkSoft;g.lineWidth=five?7:3;
    const r0=five?c*0.895:c*0.915,r1=c*0.958;
    g.beginPath();g.moveTo(Math.cos(a)*r0,Math.sin(a)*r0);g.lineTo(Math.cos(a)*r1,Math.sin(a)*r1);g.stroke();
  }
  g.textAlign='center';g.textBaseline='middle';
  // curved wordmark along the bottom of the ring
  // text set on an arc just outside the opening; bottom reads left to right with letters upright, top likewise
  const arcText=(text,r,font,color,spacing,top)=>{
    g.font=font;g.fillStyle=color;
    const widths=[...text].map(ch=>g.measureText(ch).width+spacing), total=widths.reduce((a,b)=>a+b,0);
    let off=0;
    [...text].forEach((ch,i)=>{
      const d=(total/2-off-widths[i]/2)/r;
      const a=top?-Math.PI/2-d:Math.PI/2+d;
      g.save();g.translate(Math.cos(a)*r,Math.sin(a)*r);g.rotate(top?a+Math.PI/2:a-Math.PI/2);g.fillText(ch,0,0);g.restore();
      off+=widths[i];
    });
  };
  // logo under XII, wordmark beneath it
  if(LOGO.complete&&LOGO.naturalWidth){
    const lw=c*0.34, lh=lw*LOGO.naturalHeight/LOGO.naturalWidth, tc=document.createElement('canvas');
    tc.width=LOGO.naturalWidth;tc.height=LOGO.naturalHeight;const tg=tc.getContext('2d');
    tg.drawImage(LOGO,0,0);tg.globalCompositeOperation='source-in';tg.fillStyle='#232427'; // charcoal blacktg.fillRect(0,0,tc.width,tc.height);
    const ly=-c*LOGO_DY/DIAL_R;g.drawImage(tc,-lw/2,ly-lh/2,lw,lh);g.drawImage(tc,-lw/2,ly-lh/2,lw,lh); // twice for a solid print
  }
  g.fillStyle=ink;g.font=`600 ${Math.round(s*0.024)}px "Bodoni Moda", Didot, Georgia, serif`;
  if('letterSpacing' in g) g.letterSpacing='5px';
  g.fillText('HALDEN & VEY',0,-c*0.185);
  g.fillStyle=ink;g.font=`500 ${Math.round(s*0.0115)}px "JetBrains Mono", monospace`;
  if('letterSpacing' in g) g.letterSpacing='3px';
  g.fillText('SQUELETTE · AUTOMATIQUE',0,-c*0.125);
  if('letterSpacing' in g) g.letterSpacing='0px';
  g.restore();
});

// relief for the stamped grid, same layout as the dial texture
const dialBump=(()=>{
  const S=1536,c=S/2,cv=document.createElement('canvas');cv.width=cv.height=S;const g=cv.getContext('2d');
  g.fillStyle='#808080';g.fillRect(0,0,S,S);
  g.save();g.translate(c,c);g.beginPath();g.arc(0,0,c*0.878,0,TAU);g.moveTo(c*DIAL_OPEN/DIAL_R,c*HOLE_DY/DIAL_R);g.arc(0,c*HOLE_DY/DIAL_R,c*DIAL_OPEN/DIAL_R,0,TAU,true);g.clip();
  const pitch=c/DIAL_R*0.5;g.fillStyle='#2a2a2a';
  for(let x=-c;x<=c;x+=pitch){g.fillRect(x,-c,2.6,S);g.fillRect(-c,x,S,2.6);}
  g.restore();
  const t=new THREE.CanvasTexture(cv);t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;
})();

/* ---------- materials ---------- */
const MAT={
  polished:new THREE.MeshStandardMaterial({color:0xcbced2,metalness:1,roughness:0.16,roughnessMap:SMUDGE}),
  brushed:new THREE.MeshStandardMaterial({color:0xc2c6cb,metalness:1,roughness:0.58,roughnessMap:brushTex}),
  rhodium:new THREE.MeshStandardMaterial({color:0xd5dae0,metalness:1,roughness:0.3,map:perlageTex}),
  cotes:new THREE.MeshStandardMaterial({color:0xe0e4e8,metalness:1,roughness:0.26,map:cotesTex}),
  gilt:new THREE.MeshPhysicalMaterial({color:0xf2c36b,metalness:1,roughness:0.3,roughnessMap:GOLD_GRAIN,clearcoat:0.25,clearcoatRoughness:0.08}), // 18k yellow gold, circular-grained and polished
  rotor:new THREE.MeshStandardMaterial({color:0xffffff,metalness:1,roughness:0.24,map:cotesTex}),
  roseBrushed:new THREE.MeshPhysicalMaterial({color:0xecb89c,metalness:1,roughness:0.5,roughnessMap:brushTex}), // satin-brushed 18k rose gold
  giltEdge:new THREE.MeshPhysicalMaterial({color:0xf5c977,metalness:1,roughness:0.05,clearcoat:0.3,clearcoatRoughness:0.03}), // polished gold bevels
  roseGold:new THREE.MeshPhysicalMaterial({color:0xf0bea4,metalness:1,roughness:0.15,roughnessMap:SMUDGE,clearcoat:0.2,clearcoatRoughness:0.06}), // 18k rose gold
  numeral:new THREE.MeshPhysicalMaterial({color:0xd8957a,metalness:1,roughness:0.2,clearcoat:0.3,clearcoatRoughness:0.08}), // polished rose gold, matched to the case
  lacquer:new THREE.MeshPhysicalMaterial({color:0x121417,metalness:0.15,roughness:0.28,clearcoat:1,clearcoatRoughness:0.05}), // black lacquered numerals
  plate:new THREE.MeshStandardMaterial({color:0xd3d7dc,metalness:1,roughness:0.42,map:platePerlage}), // rhodium-plated, perlage
  springSteel:new THREE.MeshStandardMaterial({color:0xa4acb5,metalness:1,roughness:0.22}), // cobalt-nickel spring alloy
  hairspring:new THREE.MeshStandardMaterial({color:0xdfe4ea,metalness:1,roughness:0.12}),
  snail:new THREE.MeshStandardMaterial({color:0xffffff,metalness:1,roughness:0.3,map:snailTex}),
  blued:new THREE.MeshStandardMaterial({color:0x22408c,metalness:0.9,roughness:0.12}), // heat-blued steel
  ruby:new THREE.MeshPhysicalMaterial({color:0x6e0818,metalness:0,roughness:0.02,clearcoat:1,clearcoatRoughness:0,emissive:0x0c0003}), // synthetic ruby
  crystal:new THREE.MeshPhysicalMaterial({color:0xf2f6ff,metalness:0,roughness:0,transparent:true,opacity:0.09,clearcoat:1,depthWrite:false}),
  glass:new THREE.MeshPhysicalMaterial({color:0xe6f0ff,metalness:0,roughness:0,transparent:true,opacity:0.1,clearcoat:1,depthWrite:false}),
  dial:new THREE.MeshStandardMaterial({color:0xffffff,map:dialTex,bumpMap:dialBump,bumpScale:0.025,metalness:0,roughness:0.88}), // matte grid
  lume:new THREE.MeshStandardMaterial({color:0xe8f0da,roughness:0.6,metalness:0,emissive:0x1d2a16}),
  leather:new THREE.MeshPhysicalMaterial({userData:{strap:'leather'},color:0xb4b4b4,map:LEATHER.map,bumpMap:LEATHER.bump,bumpScale:0.32,roughness:0.75,roughnessMap:LEATHER.rough,metalness:0,clearcoat:0.6,clearcoatRoughness:0.3,clearcoatRoughnessMap:LEATHER.rough,clearcoatNormalMap:null}), // hand-glazed alligator: uneven gloss and relief

  rubber:new THREE.MeshStandardMaterial({color:0x1b1d20,map:RIBS,bumpMap:RIBS,bumpScale:0.22,roughness:0.72,metalness:0}),
  rubberPlain:new THREE.MeshStandardMaterial({color:0x141518,roughness:0.8,metalness:0}),
  rubberEdge:new THREE.MeshStandardMaterial({color:0x0d0e10,roughness:0.82,metalness:0}),
  edgePaint:new THREE.MeshStandardMaterial({color:0x1a210a,roughness:0.35,metalness:0,userData:{strap:'edge'}}), // glossy painted edge
  leatherPlain:new THREE.MeshPhysicalMaterial({userData:{strap:'plain'},color:0x26301a,bumpMap:LEATHER.bump,bumpScale:0.06,roughness:0.42,clearcoat:1,clearcoatRoughness:0.14,metalness:0}),
  steelDark:new THREE.MeshStandardMaterial({color:0x7d838a,metalness:1,roughness:0.5,roughnessMap:SMUDGE}),
};
Object.values(MAT).forEach(m=>{m.color&&m.color.convertSRGBToLinear();m.sheenColor&&m.sheenColor.convertSRGBToLinear();m.emissive&&m.emissive.convertSRGBToLinear();m.envMapIntensity=1.15;});
MAT.dial.envMapIntensity=0.35;
MAT.gilt.envMapIntensity=1.35;MAT.giltEdge.envMapIntensity=1.5;MAT.ruby.envMapIntensity=1.6;MAT.roseGold.envMapIntensity=1.3;MAT.numeral.envMapIntensity=1.0;MAT.roseBrushed.envMapIntensity=1.25; // gold reads by what it reflects
MAT.rubber.envMapIntensity=0.4;MAT.rubberPlain.envMapIntensity=0.5;MAT.rubberEdge.envMapIntensity=0.5;
MAT.leather.envMapIntensity=0.7;MAT.leatherPlain.envMapIntensity=0.9; // glazed leather reads by its reflections
MAT.crystal.envMapIntensity=0.25; // anti-reflective coating: keep the dial readable through the glass
function mesh(geo,mat){return new THREE.Mesh(geo,Array.isArray(mat)?mat.map(m=>m.clone()):mat.clone());}
// smooth shading for non-indexed extrusions, per material group so caps stay crisp
function smoothNormals(geo){
  const pos=geo.attributes.position,n=new Float32Array(pos.count*3);
  const groups=geo.groups.length?geo.groups:[{start:0,count:pos.count}];
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),cb=new THREE.Vector3();
  const key=i=>pos.getX(i).toFixed(3)+','+pos.getY(i).toFixed(3)+','+pos.getZ(i).toFixed(3);
  groups.forEach(g=>{
    const map=new Map();
    for(let i=g.start;i<g.start+g.count;i+=3){
      a.fromBufferAttribute(pos,i);b.fromBufferAttribute(pos,i+1);c.fromBufferAttribute(pos,i+2);
      cb.subVectors(c,b);ab.subVectors(a,b);cb.cross(ab);
      for(let k=0;k<3;k++){const kk=key(i+k);const v=map.get(kk)||[0,0,0];v[0]+=cb.x;v[1]+=cb.y;v[2]+=cb.z;map.set(kk,v);}
    }
    for(let i=g.start;i<g.start+g.count;i++){const v=map.get(key(i)),l=Math.hypot(v[0],v[1],v[2])||1;n[i*3]=v[0]/l;n[i*3+1]=v[1]/l;n[i*3+2]=v[2]/l;}
  });
  geo.setAttribute('normal',new THREE.BufferAttribute(n,3));
  return geo;
}

/* ---------- part registry ---------- */
const parts=[];
function part(key,o){
  const g=new THREE.Group();
  g.userData=Object.assign({key,baseY:0,dy:0,dx:0,dz:0,w0:0,w1:1,bx:0,bz:0},o);
  g.position.set(g.userData.bx,g.userData.baseY,g.userData.bz);
  root.add(g);parts.push(g);return g;
}
function sub(parent,key){const g=new THREE.Group();g.userData={key};parent.add(g);return g;}

function lathe(pts,seg=128){
  return new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg);
}
// smooth only across faces within `deg` of each other, so rounded bevels shade softly but gear-tooth corners stay crisp
function smoothNormalsAngle(geo,deg){
  const pos=geo.attributes.position,n=new Float32Array(pos.count*3),cos=Math.cos(deg*Math.PI/180);
  const fn=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),cb=new THREE.Vector3();
  const key=i=>pos.getX(i).toFixed(3)+','+pos.getY(i).toFixed(3)+','+pos.getZ(i).toFixed(3);
  const map=new Map();
  for(let i=0;i<pos.count;i+=3){
    a.fromBufferAttribute(pos,i);b.fromBufferAttribute(pos,i+1);c.fromBufferAttribute(pos,i+2);
    cb.subVectors(c,b);ab.subVectors(a,b);cb.cross(ab);
    const area=cb.length()||1e-9,u=cb.clone().divideScalar(area);fn.push({u,area});
    for(let k=0;k<3;k++){const kk=key(i+k);(map.get(kk)||map.set(kk,[]).get(kk)).push(i/3);}
  }
  for(let i=0;i<pos.count;i++){
    const own=fn[Math.floor(i/3)].u,acc=new THREE.Vector3();
    for(const f of map.get(key(i))){if(fn[f].u.dot(own)>=cos)acc.addScaledVector(fn[f].u,fn[f].area);}
    acc.normalize();n[i*3]=acc.x;n[i*3+1]=acc.y;n[i*3+2]=acc.z;
  }
  geo.setAttribute('normal',new THREE.BufferAttribute(n,3));
  return geo;
}
// bevelled extrusion: caps (group 0) carry the face finish; the bevel and walls (group 1) take a polished edge, the
// thin bright outline that hand-bevelled (anglage) movement parts show
function bevelGeo(shape,depth,bevel,seg=24){
  const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelOffset:-bevel,bevelSegments:2,curveSegments:seg});
  geo.rotateX(-Math.PI/2);
  return smoothNormalsAngle(geo,50);
}
function flatShapeGeo(shape,depth,seg=24){
  const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:seg});
  geo.rotateX(-Math.PI/2); // shape plane -> XZ, extrude along +Y; shape +y -> world -z
  return geo;
}

/* ---------- case middle ---------- */
const caseG=part('case',{});
{
  const body=mesh(lathe([[17.7,-4],[19.2,-4],[19.9,-3],[20.3,-0.5],[20.1,2.2],[19.4,3],[17.7,3],[17.7,-4]]),MAT.roseBrushed);
  body.material.side=THREE.DoubleSide; caseG.add(body);
  const lugGeo=THREE.RoundedBoxGeometry?new THREE.RoundedBoxGeometry(3.2,3.4,9,4,0.9):new THREE.BoxGeometry(3.2,3.4,9);
  [[-11.4,-1],[11.4,-1],[-11.4,1],[11.4,1]].forEach(([x,s])=>{ // inner gap 19.6 mm: the strap fits between the lugs
    const l=mesh(lugGeo,MAT.roseGold); l.position.set(x,-0.6,s*20.1); l.rotation.x=s*0.16; caseG.add(l);
  });
  const barGeo=new THREE.CylinderGeometry(0.45,0.45,21,12); barGeo.rotateZ(Math.PI/2);
  [-1,1].forEach(s=>{const b=mesh(barGeo,MAT.steelDark);b.position.set(0,-1.1,s*19.4);caseG.add(b);});
  const crownGeo=new THREE.CylinderGeometry(2.7,2.7,3.2,144,1); // knurled grip
  {const cp=crownGeo.attributes.position;for(let i=0;i<cp.count;i++){const x=cp.getX(i),z=cp.getZ(i),r=Math.hypot(x,z);if(r<2.6)continue;
    const a=Math.atan2(z,x),k=1+0.045*Math.sign(Math.sin(a*36));cp.setX(i,x*k);cp.setZ(i,z*k);}crownGeo.computeVertexNormals();}
  crownGeo.rotateZ(Math.PI/2);
  const crown=mesh(crownGeo,MAT.roseGold); crown.position.set(21.9,-0.4,0); caseG.add(crown);
  const stemGeo=new THREE.CylinderGeometry(1.2,1.2,1.6,20); stemGeo.rotateZ(Math.PI/2);
  const stem=mesh(stemGeo,MAT.roseBrushed); stem.position.set(20.4,-0.4,0); caseG.add(stem);
  const capGeo=new THREE.SphereGeometry(6,48,12,0,TAU,0,Math.asin(2.5/6)); capGeo.translate(0,-6*Math.cos(Math.asin(2.5/6)),0); capGeo.rotateZ(-Math.PI/2);
  const cap=mesh(capGeo,MAT.roseGold); cap.position.set(23.55,-0.4,0); caseG.add(cap);
  // a pusher either side of the crown, at 2 and 4 o'clock
  [-1,1].forEach(side=>{
    const ang=side*0.5, pg=new THREE.Group(); pg.rotation.y=-ang; pg.position.y=-0.4;
    const tube=mesh(new THREE.CylinderGeometry(1.0,1.15,2.0,28).rotateZ(Math.PI/2),MAT.roseBrushed); tube.position.x=20.6; pg.add(tube);
    const body=mesh(THREE.RoundedBoxGeometry?new THREE.RoundedBoxGeometry(2.4,2.3,2.3,3,0.55):new THREE.BoxGeometry(2.4,2.3,2.3),MAT.roseGold); body.position.x=22.6; pg.add(body);
    caseG.add(pg);
  });
}

/* ---------- crystal & bezel ---------- */
const crystalG=part('crystal',{baseY:4.9,dy:46,w0:0.04,w1:0.3});
{
  const cr=mesh(new THREE.CylinderGeometry(17.95,17.95,0.9,96),MAT.crystal); crystalG.add(cr);
  const dome=mesh(new THREE.SphereGeometry(60,96,8,0,TAU,0,Math.asin(17.95/60)),MAT.crystal);
  dome.position.y=0.45-60*Math.cos(Math.asin(17.95/60)); crystalG.add(dome);
}
const bezelG=part('bezel',{dy:36,w0:0.08,w1:0.34});
{
  const b=mesh(lathe([[17.75,2.9],[19.5,2.9],[19.65,3.2],[19.15,3.9],[18.1,4.15],[17.75,3.9],[17.75,2.9]]),MAT.roseGold);
  b.material.side=THREE.DoubleSide; bezelG.add(b);
}

/* ---------- dial ---------- */
const dialG=part('dial',{baseY:2.74, /* face sits just under the crystal */dy:14,w0:0.26,w1:0.52});
{
  const dialShape=(R)=>{const sh=new THREE.Shape();sh.absarc(0,0,R,0,TAU,false);const h=new THREE.Path();h.absarc(0,-HOLE_DY,DIAL_OPEN,0,TAU,true);sh.holes.push(h);return sh;};
  const base=mesh(flatShapeGeo(dialShape(DIAL_R+0.05),0.5,96),MAT.brushed); base.position.y=-0.25;
  base.material.side=THREE.DoubleSide; dialG.add(base);
  const fg=new THREE.ShapeGeometry(dialShape(DIAL_R),128);
  {const pp=fg.attributes.position,uv=fg.attributes.uv;for(let i=0;i<pp.count;i++)uv.setXY(i,pp.getX(i)/(2*DIAL_R)+0.5,pp.getY(i)/(2*DIAL_R)+0.5);}
  fg.rotateX(-Math.PI/2);
  const face=mesh(fg,MAT.dial); face.position.y=0.26; dialG.add(face);
  // applied Roman numerals, built stroke by stroke from polished bars and set radially (feet toward the centre).
  // IIII at four, as watchmakers traditionally write it.
  const ROMAN=['XII','I','II','III','IIII','V','VI','VII','VIII','IX','X','XI'];
  const H=2.7, SW=0.42, DEPTH=0.42, GAP=0.3, VW=1.6;
  const bar=(g,x0,y0,x1,y1,w)=>{ // a stroke between two 2D points; 2D y is outward, mapped to -z
    const len=Math.hypot(x1-x0,y1-y0), th=Math.atan2(y1-y0,x1-x0);
    const geo=THREE.RoundedBoxGeometry?new THREE.RoundedBoxGeometry(len+w*0.4,DEPTH,w,2,Math.min(0.12,w*0.3)):new THREE.BoxGeometry(len+w*0.4,DEPTH,w);
    const m=mesh(geo,MAT.numeral); m.position.set((x0+x1)/2,DEPTH/2,-(y0+y1)/2); m.rotation.y=th; g.add(m); // applied rose-gold numerals
  };
  const glyph=(g,ch,x)=>{ // returns advance width
    const t=H/2,b=-H/2;
    if(ch==='I'){bar(g,x,b,x,t,SW);bar(g,x-0.42,t,x+0.42,t,0.2);bar(g,x-0.42,b,x+0.42,b,0.2);return 0;}
    if(ch==='V'){bar(g,x-VW/2,t,x,b,SW);bar(g,x+VW/2,t,x,b,SW*0.55);bar(g,x-VW/2-0.35,t,x-VW/2+0.35,t,0.2);bar(g,x+VW/2-0.35,t,x+VW/2+0.35,t,0.2);return 0;}
    bar(g,x-VW/2,t,x+VW/2,b,SW);bar(g,x+VW/2,t,x-VW/2,b,SW*0.55); // X
    [[-1,t],[1,t],[-1,b],[1,b]].forEach(([sx,y])=>bar(g,x+sx*VW/2-0.35,y,x+sx*VW/2+0.35,y,0.2));
    return 0;
  };
  const adv=ch=>ch==='I'?0.42:VW;
  ROMAN.forEach((txt,i)=>{
    if(i===6) return; // no VI: the aperture takes its place
    const grp=new THREE.Group(), chars=[...txt];
    const total=chars.reduce((w,ch)=>w+adv(ch),0)+GAP*(chars.length-1);
    let x=-total/2;
    chars.forEach(ch=>{glyph(grp,ch,x+adv(ch)/2);x+=adv(ch)+GAP;});
    const a=i/12*TAU, r=NUM_R;
    grp.scale.set(0.7,0.85,0.7); // numerals at 0.7x
    grp.position.set(Math.sin(a)*r,0.26,-Math.cos(a)*r); grp.rotation.y=-a; dialG.add(grp);
  });
}

/* ---------- hands ---------- */
const handsG=part('hands',{baseY:3.25,dy:25,w0:0.2,w1:0.46});
function sword(len,w,tail){
  const s=new THREE.Shape();
  s.moveTo(-w*0.35,-tail); s.lineTo(w*0.35,-tail); s.lineTo(w/2,len*0.55); s.lineTo(0,len); s.lineTo(-w/2,len*0.55); s.closePath();
  return s;
}
// skeletonised baton hands: cut open along their length so the movement stays visible
function skeletonBaton(len,w,tail,mat){
  const s=new THREE.Shape();
  s.moveTo(-w/2,-tail); s.lineTo(w/2,-tail); s.lineTo(w*0.42,len-1.3); s.lineTo(0,len); s.lineTo(-w*0.42,len-1.3); s.closePath();
  const iw=w/2-0.3, h=new THREE.Path();
  h.moveTo(-iw,1.5); h.lineTo(iw,1.5); h.lineTo(iw*0.82,len-2.1); h.lineTo(-iw*0.82,len-2.1); h.closePath(); s.holes.push(h);
  const g=new THREE.Group(); g.add(mesh(flatShapeGeo(s,0.18,4),mat)); return g;
}
function needle(len,tail,mat){
  const sh=new THREE.Shape(); sh.moveTo(-0.11,-tail); sh.lineTo(0.11,-tail); sh.lineTo(0.06,len); sh.lineTo(-0.06,len); sh.closePath();
  const g=new THREE.Group(); g.add(mesh(flatShapeGeo(sh,0.1),mat));
  const cw=new THREE.Shape(); cw.absarc(0,-tail+0.6,0.6,0,TAU,false); g.add(mesh(flatShapeGeo(cw,0.1,20),mat));
  const hub=mesh(new THREE.CylinderGeometry(0.45,0.45,0.5,20),mat); hub.position.y=0.05; g.add(hub);
  return g;
}
const hourHand=new THREE.Group(), minHand=new THREE.Group(), secHand=new THREE.Group();
{
  hourHand.add(skeletonBaton(9.8,1.7,1.6,MAT.roseGold));
  minHand.add(skeletonBaton(15.0,1.35,1.9,MAT.roseGold));
  secHand.add(needle(16.2,3.6,MAT.roseGold));
  hourHand.position.y=0; minHand.position.y=0.38; secHand.position.y=0.76;
  handsG.add(hourHand,minHand,secHand);
  const pin=mesh(new THREE.CylinderGeometry(0.7,0.7,1.2,24),MAT.roseGold); pin.position.y=0.45; handsG.add(pin);
}

/* ---------- gears ---------- */
function gearShape(teeth,r,toothDepth,holeR,pointed,spokes=0){
  const s=new THREE.Shape(), rr=r-toothDepth, step=TAU/teeth;
  for(let i=0;i<teeth;i++){
    const a0=i*step;
    const pts=pointed?[[rr,a0],[r,a0+step*0.62],[rr*0.98,a0+step*0.7]]
                     :[[rr,a0],[r*0.985,a0+step*0.1],[r,a0+step*0.24],[r,a0+step*0.32],[r*0.985,a0+step*0.46],[rr,a0+step*0.56]];
    pts.forEach(([rad,a],j)=>{const x=Math.cos(a)*rad,y=Math.sin(a)*rad;(i===0&&j===0)?s.moveTo(x,y):s.lineTo(x,y);});
  }
  s.closePath();
  if(holeR>0){const h=new THREE.Path(); h.absarc(0,0,holeR,0,TAU,true); s.holes.push(h);}
  if(spokes&&rr>1.6){ // crossings: straight spokes between a hub and the rim, as on a real train wheel
    const hubR=Math.max(0.85,rr*0.22), rimR=rr*0.82, half=TAU/spokes, sw=0.32;
    for(let k=0;k<spokes;k++){
      const a0=k*half, a1=a0+half, wr=sw/rimR, wh=sw/hubR, w=new THREE.Path();
      w.absarc(0,0,rimR,a0+wr,a1-wr,false); w.absarc(0,0,hubR,a1-wh,a0+wh,true); w.closePath(); s.holes.push(w);
    }
  }
  return s;
}
// a flat spiral ribbon (mainspring, hairspring): pitch must exceed width so coils never touch
function spiralRibbon(r0,r1,turns,width,seg=56){
  const N=Math.ceil(turns*seg),inner=[],outer=[];
  for(let i=0;i<=N;i++){const t=i/N,a=t*turns*TAU,r=r0+(r1-r0)*t;
    inner.push(new THREE.Vector2(Math.cos(a)*r,Math.sin(a)*r));outer.push(new THREE.Vector2(Math.cos(a)*(r+width),Math.sin(a)*(r+width)));}
  return new THREE.Shape(inner.concat(outer.reverse()));
}
// a leaved pinion on a thin arbor; real wheels ride on a small toothed pinion, not a plain post
function pinion(leaves=10,len=1.5,up=false){
  const g=new THREE.Group();
  const p=mesh(bevelGeo(gearShape(leaves,0.6,0.2,0,false),len,0.02,4),[MAT.polished,MAT.polished]); p.position.y=up?0.2:-len-0.02; g.add(p);
  const arbor=mesh(new THREE.CylinderGeometry(0.15,0.15,3.4,14),MAT.polished); arbor.position.y=-0.5; g.add(arbor);
  return g;
}
function wheel(teeth,r,{thick=0.18,pointed=false,mat=MAT.gilt,edge=MAT.giltEdge,pinion:withPinion=true,spokes=5,pinionUp=false}={}){
  const g=new THREE.Group();
  const depth=pointed?r*0.22:r*0.035+0.06;
  g.add(mesh(bevelGeo(gearShape(teeth,r,depth,withPinion?0:0.3,pointed,pointed?0:spokes),thick,0.025,6),[mat,edge]));
  if(withPinion) g.add(pinion(10,1.5,pinionUp));
  return g;
}
// a domed ruby jewel set flush in a polished oil-sink, with an optional gold chaton around it
function jewel(parent,x,y,z,{chaton=false,r=0.46}={}){
  const g=new THREE.Group(); g.position.set(x,y,z);
  const sink=mesh(lathe([[r*0.95,-0.05],[r*1.65,0.005],[r*1.65,-0.02],[r*0.95,-0.07]],40),MAT.polished); g.add(sink);
  if(chaton){const ch=mesh(lathe([[r*1.65,-0.02],[r*2.35,-0.02],[r*2.35,0.03],[r*1.65,0.03]],40),MAT.giltEdge); g.add(ch);}
  const R0=r/Math.sin(0.5), stone=mesh(new THREE.SphereGeometry(R0,28,8,0,TAU,0,0.5),MAT.ruby);
  stone.position.y=-0.06-R0*Math.cos(0.5); g.add(stone);
  const hole=mesh(new THREE.CircleGeometry(0.08,16).rotateX(-Math.PI/2),MAT.lacquer); hole.position.y=-0.06+R0*(1-Math.cos(0.5))+0.002; g.add(hole);
  parent.add(g); return g;
}
// a heat-blued screw with a domed, chamfered head and a cut slot
function screw(parent,x,y,z,rot){
  const g=new THREE.Group(); g.position.set(x,y,z); g.rotation.y=rot;
  g.add(mesh(lathe([[0,0],[0.6,0],[0.6,0.1],[0.5,0.24],[0.3,0.3],[0,0.31]],36),MAT.blued));
  const slot=mesh(new THREE.BoxGeometry(1.3,0.14,0.13),MAT.lacquer); slot.position.y=0.27; g.add(slot);
  parent.add(g); return g;
}

/* ---------- mainplate ---------- */
const plateG=part('mainplate',{baseY:-0.2,dy:-12,w0:0.38,w1:0.64});
{
  // a hub and three spokes inside a rim: the windows let you see the wheels from the dial side
  const sh=new THREE.Shape(); sh.absarc(0,0,14.2,0,TAU,false);
  // spokes sit in the gaps between wheel centres so they never cut across an arbor
  const SPOKES=[30,150,330]; // the 161°-319° window opens over the balance, which sits under the dial aperture
  SPOKES.forEach((sp,i)=>{
    const next=SPOKES[(i+1)%3]+(i===2?360:0);
    const a0=(sp+11)*Math.PI/180, a1=(next-11)*Math.PI/180, w=new THREE.Path();
    w.absarc(0,0,13.0,a0,a1,false); w.absarc(0,0,3.3,a1,a0,true); w.closePath(); sh.holes.push(w);
  });
  const m=mesh(bevelGeo(sh,0.75,0.06,48),[MAT.plate,MAT.polished]); m.position.y=-0.4; plateG.add(m);
  // jewels visible on the plate
  [[0,0],[3.9,-1.3],[6.6,1.2],[6.2,3.67]].forEach(([x,z])=>jewel(plateG,x,0.41,z)); // the balance pivot shows through the window instead
}

/* ---------- gear train & escapement ---------- */
function capsule(ax,az,bx,bz,r){
  // world (x,z) -> shape (x,-z)
  const ay=-az,by=-bz,th=Math.atan2(by-ay,bx-ax);
  const s=new THREE.Shape();
  s.absarc(bx,by,r,th-Math.PI/2,th+Math.PI/2,false);
  s.absarc(ax,ay,r,th+Math.PI/2,th+Math.PI*1.5,false);
  s.closePath(); return s;
}
const trainG=part('train',{baseY:-2.1,dy:-22,w0:0.44,w1:0.7});
const spinners=[]; let MOVE=null, MS=null, HS=null;
{
  // Layout: each wheel's teeth sit on the next wheel's pinion (centre distance = wheel pitch radius + pinion radius),
  // and wheels alternate levels so every pinion spans the plane of the wheel that drives it.
  const P={barrel:[-5.4,-3.1],centre:[0,0],third:[3.9,-1.3],fourth:[6.6,1.2],escape:[6.2,3.67],balance:[0,HOLE_DY]}; // balance under the dial aperture
  MOVE=P;
  const barrel=sub(trainG,'barrel'); barrel.position.set(P.barrel[0],0,P.barrel[1]);
  const drum=mesh(new THREE.CylinderGeometry(5.0,5.0,1.6,64),[MAT.polished,MAT.snail,MAT.snail]); drum.position.y=-0.6; barrel.add(drum);
  const bw=wheel(100,5.6,{thick:0.22,pinion:false,spokes:6}); bw.position.y=0.2; barrel.add(bw);
  const arbor=mesh(new THREE.CylinderGeometry(1.0,1.0,2.4,20),MAT.polished); arbor.position.y=0; barrel.add(arbor);
  spinners.push({o:bw,w:0.02});
  MS=sub(barrel,'mainspring');
  MS.add(mesh(flatShapeGeo(spiralRibbon(1.15,4.45,9,0.14),1.2,1),MAT.springSteel));
  const hook=mesh(new THREE.BoxGeometry(0.5,1.2,0.25),MAT.springSteel); hook.position.set(4.6,0.6,0); MS.add(hook); // bridle at the outer end
  MS.position.y=-1.2;

  const centre=wheel(84,4.3,{pinionUp:true}); centre.position.set(P.centre[0],-0.3,P.centre[1]); trainG.add(centre); spinners.push({o:centre,w:-0.09});
  const third=wheel(78,3.5); third.position.set(P.third[0],0.6,P.third[1]); trainG.add(third); spinners.push({o:third,w:0.32});
  const fourth=wheel(80,3.1,{spokes:4,pinionUp:true}); fourth.position.set(P.fourth[0],-0.2,P.fourth[1]); trainG.add(fourth); spinners.push({o:fourth,w:-TAU/60*6});

  const esc=wheel(20,1.9,{pointed:true,thick:0.16,mat:MAT.polished,edge:MAT.polished}); esc.position.set(P.escape[0],0.5,P.escape[1]); trainG.add(esc);
  spinners.push({o:esc,escape:true});

  // pallet fork: pivots between the escape wheel and the balance, its lever reaching the balance roller
  const ex=P.escape[0],ez=P.escape[1],bx=P.balance[0],bz=P.balance[1],L=Math.hypot(bx-ex,bz-ez),ux=(bx-ex)/L,uz=(bz-ez)/L;
  const fork=new THREE.Group(); fork.position.set(ex+ux*2.5,0.5,ez+uz*2.5);
  const base=Math.atan2(ux,uz); fork.rotation.y=base;
  const lever=mesh(bevelGeo(capsule(0,0,0,L-3.5,0.22),0.2,0.02,8),[MAT.polished,MAT.polished]); fork.add(lever);
  const arms=mesh(bevelGeo(capsule(-1.4,-0.6,1.4,-0.6,0.24),0.2,0.02,8),[MAT.polished,MAT.polished]); fork.add(arms);
  [-1.4,1.4].forEach(x=>{const pl=mesh(new THREE.BoxGeometry(0.3,0.3,0.8),MAT.ruby);pl.position.set(x,0.1,-1.1);fork.add(pl);});
  const forkPin=mesh(new THREE.CylinderGeometry(0.15,0.15,1.6,12),MAT.polished); fork.add(forkPin);
  trainG.add(fork); spinners.push({o:fork,fork:true,base});

  // balance wheel with hairspring
  const balance=sub(trainG,'balance'); balance.position.set(P.balance[0],0.9,P.balance[1]);
  const osc=new THREE.Group(); balance.add(osc);
  const ring=mesh(new THREE.TorusGeometry(3.3,0.34,14,72).rotateX(Math.PI/2),MAT.gilt); osc.add(ring);
  for(let k=0;k<3;k++){
    const sp=mesh(new THREE.BoxGeometry(0.32,0.2,3.3),MAT.gilt); sp.position.z=1.65; const pg=new THREE.Group(); pg.add(sp); pg.rotation.y=k/3*TAU; osc.add(pg);
  }
  for(let k=0;k<4;k++){ // timing screws
    const a=k/4*TAU+0.4; const sc=mesh(new THREE.CylinderGeometry(0.32,0.32,0.5,12).rotateZ(Math.PI/2),MAT.polished);
    sc.position.set(Math.cos(a)*3.75,0,Math.sin(a)*3.75); sc.rotation.y=-a; osc.add(sc);
  }
  const staff=mesh(new THREE.CylinderGeometry(0.35,0.35,2.8,12),MAT.polished); osc.add(staff);
  const roller=mesh(new THREE.CylinderGeometry(0.9,0.9,0.25,24),MAT.polished); roller.position.y=-0.7; osc.add(roller);
  HS=sub(balance,'hairspring');
  HS.add(mesh(flatShapeGeo(spiralRibbon(0.6,2.65,12,0.055),0.13,1),MAT.hairspring));
  const collet=mesh(new THREE.CylinderGeometry(0.5,0.5,0.25,24),MAT.polished); collet.position.y=0.06; HS.add(collet);
  const stud=mesh(new THREE.BoxGeometry(0.35,0.35,0.5),MAT.polished); stud.position.set(2.75,0.06,0); HS.add(stud);
  HS.position.y=0.45;
  const hs=HS;
  spinners.push({o:osc,balance:true});
  spinners.push({o:hs,hair:true});
}

/* ---------- bridges ---------- */
const bridgesG=part('bridges',{baseY:-3.9,dy:-40,w0:0.5,w1:0.76});

{
  const defs=[
    [-5.4,-3.1,0,0,3.4,[[-5.4,-3.1],[0,0]]],        // barrel bridge
    [3.9,-1.3,6.6,1.2,2.3,[[3.9,-1.3],[6.6,1.2]]],  // train bridge
    [6.6,1.2,6.2,3.67,1.7,[[6.2,3.67]]],            // escape bridge
    [-7.2,11.0,0,HOLE_DY,2.2,[[0,HOLE_DY]]],        // balance cock
    [-11.5,-4,-6,-9,1.9,[]],
  ];
  defs.forEach(([ax,az,bx,bz,r,jewels])=>{
    const b=mesh(bevelGeo(capsule(ax,az,bx,bz,r),0.75,0.06,24),[MAT.cotes,MAT.polished]); bridgesG.add(b);
    jewels.forEach(([x,z])=>jewel(bridgesG,x,0.81,z,{chaton:true}));
    // blued screws near the ends
    const th=Math.atan2(bz-az,bx-ax), nx=-Math.sin(th), nz=Math.cos(th);
    [[ax,az],[bx,bz]].forEach(([x,z],k)=>{
      const off=r*0.55, sx=x+nx*off*(k?1:-1), sz=z+nz*off*(k?1:-1);
      if(jewels.some(([jx,jz])=>Math.hypot(jx-sx,jz-sz)<1.4)) return;
      screw(bridgesG,sx,0.81,sz,th+k*1.1);
    });
  });
}

/* ---------- rotor ---------- */
const rotorG=part('rotor',{baseY:-5.0,dy:-50,w0:0.56,w1:0.82});
const rotorSpin=new THREE.Group(); rotorG.add(rotorSpin);
{
  const s=new THREE.Shape();
  s.absarc(0,0,13.4,0,Math.PI,false); s.absarc(0,0,2.4,Math.PI,TAU,true); s.closePath();
  const r=mesh(bevelGeo(s,0.45,0.05,64),[MAT.rotor,MAT.polished]); rotorSpin.add(r);
  const rim=new THREE.Shape(); rim.absarc(0,0,13.4,0,Math.PI,false); rim.absarc(0,0,11.2,Math.PI,0,true); rim.closePath();
  const rm=mesh(bevelGeo(rim,0.9,0.06,64),[MAT.gilt,MAT.giltEdge]); rm.position.y=-0.5; rotorSpin.add(rm);
  const hub=mesh(new THREE.CylinderGeometry(2.4,2.4,1.0,40),MAT.polished); hub.position.y=0.25; rotorSpin.add(hub);
  jewel(rotorSpin,0,0.75,0,{chaton:true,r:0.55});
  rotorSpin.rotation.y=0.9;
}

/* ---------- caseback ---------- */
const backG=part('caseback',{dy:-62,w0:0.62,w1:0.88});
{
  // solid caseback, gently domed, no display window
  const ring=mesh(lathe([[0,-4],[19.2,-4],[19.2,-4.6],[18.4,-5.7],[12.7,-5.95],[6,-6.1],[0,-6.15]]),MAT.roseBrushed);
  ring.material.side=THREE.DoubleSide; backG.add(ring);
  for(let k=0;k<6;k++){ // wrench notches
    const a=k/6*TAU; const n=mesh(new THREE.BoxGeometry(1.6,0.6,1.2),MAT.steelDark);
    n.position.set(Math.cos(a)*17.2,-5.75,Math.sin(a)*17.2); n.rotation.y=-a; backG.add(n);
  }
}

/* ---------- strap ---------- */
// Strap runs outward along +z from the lug, tapers 20 -> 16 mm and curls downward like a strap lying open.
const STRAP_L=56;            // texture scale reference (mm per pattern repeat)
const LEN_A=75, LEN_B=86;   // buckle-side and tail straps, typical proportions for a 40 mm watch
// Each strap follows a path from its lug: arc, straight drop, arc, then straight under the wrist.
// w=0 straightens every arc (strap lying flat with a slight sag); w=1 wraps it around the wrist.
const WRAP_H=4, R_A=16, R_B=16.9; // tail strap runs on a slightly larger path so it lies over the buckle strap
function wrapPath(s,w,r){
  const k=w/r, segs=[[r*Math.PI/2,k],[WRAP_H,0],[r*Math.PI/2,k],[1e9,0]];
  let z=0,y=0,th=0,rem=s;
  for(const [len,kk] of segs){
    const ds=Math.min(rem,len); if(ds<=0) break;
    if(kk>1e-6){z+=(Math.sin(th+kk*ds)-Math.sin(th))/kk; y+=(Math.cos(th+kk*ds)-Math.cos(th))/kk; th+=kk*ds;}
    else {z+=ds*Math.cos(th); y-=ds*Math.sin(th);}
    rem-=ds;
  }
  return [z,y,th];
}
function strapXform(x,y,z,L=STRAP_L,w=0,r=R_A){
  const taper=1-0.2*(z/L), [bz,by,pth]=wrapPath(z,w,r), flat=1-w, th=pth+flat*Math.atan(0.0012*z);
  return [x*taper, by-flat*0.0006*z*z+y*Math.cos(th), bz+y*Math.sin(th), th];
}
function roundedRect(w,h,r,crown=0){
  const s=new THREE.Shape(),x0=-w/2,x1=w/2,y0=-h/2,y1=h/2;
  s.moveTo(x0+r,y0);s.lineTo(x1-r,y0);s.quadraticCurveTo(x1,y0,x1,y0+r);s.lineTo(x1,y1-r);
  s.quadraticCurveTo(x1,y1,x1-r,y1);s.quadraticCurveTo(0,y1+crown,x0+r,y1);s.quadraticCurveTo(x0,y1,x0,y1-r);
  s.lineTo(x0,y0+r);s.quadraticCurveTo(x0,y0,x0+r,y0);return s;
}
// roundTip: the tail strap tapers a little more and finishes in a rounded end over its last TIP mm
const TIP=8.5;
function strapGeo(dir,roundTip=false,L=STRAP_L,r=R_A){
  const geo=new THREE.ExtrudeGeometry(roundedRect(19.4,1.7,0.75,0.55),{depth:L,steps:roundTip?220:110,bevelEnabled:false,curveSegments:6});
  const p=geo.attributes.position;
  const src=new THREE.BufferAttribute(new Float32Array(p.count*3),3), th0=new THREE.BufferAttribute(new Float32Array(p.count),1);
  for(let i=0;i<p.count;i++){
    let px=p.getX(i),py=p.getY(i);const pz=p.getZ(i);
    if(roundTip){
      px*=1-0.06*(pz/L);                                        // extra taper toward the tip
      const u=(pz-(L-TIP))/TIP;
      if(u>0){const f=Math.sqrt(Math.max(0,1-u*u));px*=Math.max(0.04,f);py*=0.75+0.25*f;} // elliptical rounded end, edges thinning
    }
    src.setXYZ(i,px,py,pz);
    const [x,y,z,th]=strapXform(px,py,pz,L,0,r);
    p.setXYZ(i,x,y,dir*z); th0.setX(i,th);
  }
  if(dir<0){ // mirrored along z: flip winding so faces point outward
    const idx=[];for(let i=0;i<p.count;i+=3){idx.push(i,i+2,i+1);}
    const swap=(attr)=>{const src=attr.array.slice(),n=attr.itemSize;for(let i=0;i<idx.length;i++){for(let k=0;k<n;k++)attr.array[i*n+k]=src[idx[i]*n+k];}attr.needsUpdate=true;};
    swap(p);swap(geo.attributes.uv);swap(src);swap(th0);
  }
  smoothNormals(geo);
  geo.userData={src,th0,n0:geo.attributes.normal.array.slice(),dir,L,r};
  return geo;
}
// re-bend a strap: recompute each vertex along the path, and rotate its normal by the change in path angle
function bendStrap(geo,w){
  const {src,th0,n0,dir,L,r}=geo.userData,p=geo.attributes.position,n=geo.attributes.normal;
  for(let i=0;i<p.count;i++){
    const [x,y,z,th]=strapXform(src.getX(i),src.getY(i),src.getZ(i),L,w,r);
    p.setXYZ(i,x,y,dir*z);
    const d=dir*(th-th0.getX(i)),c=Math.cos(d),sn=Math.sin(d),ny=n0[i*3+1],nz=n0[i*3+2];
    n.setXYZ(i,n0[i*3],ny*c-nz*sn,ny*sn+nz*c);
  }
  p.needsUpdate=true;n.needsUpdate=true;
}
const STRAP_ITEMS=[], STRAP_GEOS=[];
function onStrap(obj,dir,z,yLocal,L=STRAP_L,r=R_A,w=0){
  const [ ,y,zz,ang]=strapXform(0,yLocal,z,L,w,r);
  obj.position.set(0,y,dir*zz); obj.rotation.x=dir*ang;
  if(!obj.userData.strapAt){obj.userData.strapAt={dir,z,yLocal,L,r};STRAP_ITEMS.push(obj);}
  return obj;
}
function bendAll(w){
  STRAP_GEOS.forEach(g=>bendStrap(g,w));
  STRAP_ITEMS.forEach(o=>{const a=o.userData.strapAt;onStrap(o,a.dir,a.z,a.yLocal,a.L,a.r,w);});
}
const STRAP_Z=18.0; // strap ends tuck against the case between the lugs
const strapA=part('strap',{bz:-STRAP_Z,baseY:-1.1,dz:-42,dy:-4,w0:0.7,w1:0.96});
{const m=mesh(strapGeo(-1,false,LEN_A,R_A),[MAT.edgePaint,MAT.leather]);m.frustumCulled=false;STRAP_GEOS.push(m.geometry);strapA.add(m);}
const strapB=part('strap',{bz:STRAP_Z,baseY:-1.1,dz:42,dy:-4,w0:0.7,w1:0.96});
{const m=mesh(strapGeo(1,true,LEN_B,R_B),[MAT.edgePaint,MAT.leather]);m.frustumCulled=false;STRAP_GEOS.push(m.geometry);strapB.add(m);}
{
  // keepers (leather loops) near the buckle end of strap A
  [LEN_A-12,LEN_A-7].forEach(z=>{
    const t=1-0.2*(z/LEN_A), w=19.4*t+1.1;
    const sh=roundedRect(w,3.0,1.1); sh.holes.push(roundedRect(w-1.1,1.9,0.6));
    const g=smoothNormals(new THREE.ExtrudeGeometry(sh,{depth:2.4,bevelEnabled:false,curveSegments:6}));
    g.translate(0,0.15,-1.2);
    strapA.add(onStrap(mesh(g,[MAT.edgePaint,MAT.leatherPlain]),-1,z,0,LEN_A));
  });
  // pin buckle at the end of strap A: a thick, sturdy rose-gold frame with a heavy tang
  const buckle=new THREE.Group();
  const rr=(path,cx,cy,w,h,r)=>{const x0=cx-w/2,x1=cx+w/2,y0=cy-h/2,y1=cy+h/2;
    path.moveTo(x0+r,y0);path.lineTo(x1-r,y0);path.quadraticCurveTo(x1,y0,x1,y0+r);path.lineTo(x1,y1-r);path.quadraticCurveTo(x1,y1,x1-r,y1);
    path.lineTo(x0+r,y1);path.quadraticCurveTo(x0,y1,x0,y1-r);path.lineTo(x0,y0+r);path.quadraticCurveTo(x0,y0,x0+r,y0);return path;};
  const BL=11, frameShape=rr(new THREE.Shape(),0,BL/2-0.8,22.6,BL+3.2,4.2);
  frameShape.holes.push(rr(new THREE.Path(),0,BL/2+0.3,17.4,BL-1.6,2.4));
  const frame=mesh(bevelGeo(frameShape,1.7,0.35,16),[MAT.roseGold,MAT.roseGold]); frame.position.y=-1.0; buckle.add(frame);
  const tang=mesh(THREE.RoundedBoxGeometry?new THREE.RoundedBoxGeometry(1.7,1.1,BL+0.6,3,0.45):new THREE.BoxGeometry(1.7,1.1,BL+0.6),MAT.roseGold);
  tang.position.set(0,1.05,-(BL/2)); tang.rotation.x=0.05; buckle.add(tang);
  const hinge=mesh(new THREE.CylinderGeometry(1.0,1.0,4,24).rotateZ(Math.PI/2),MAT.roseGold); hinge.position.set(0,0.6,0.3); buckle.add(hinge);
  strapA.add(onStrap(buckle,-1,LEN_A-0.6,0.2,LEN_A));
  // adjustment holes on strap B
  for(let k=0;k<7;k++){ // seven holes in the middle of the tail strap
    const h=mesh(new THREE.CylinderGeometry(0.62,0.62,0.06,20),MAT.lacquer); // punched hole, read as a dark recess
    strapB.add(onStrap(h,1,36+k*5.5,1.08,LEN_B,R_B));
  }
}

/* ---------- interior shading ---------- */
// The movement sits under the dial, so it receives far less of the studio light than the case does.
[plateG,trainG,bridgesG,rotorG].forEach(g=>g.traverse(o=>{
  if(!o.isMesh) return;
  (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.envMapIntensity*=0.55;});
}));
// A soft dark falloff just under the dial: the movement darkens toward the edge of the opening, like ambient occlusion.
const apertureShade=(()=>{
  const cv=document.createElement('canvas');cv.width=cv.height=256;const g=cv.getContext('2d');
  const gr=g.createRadialGradient(128,128,0,128,128,128);
  gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(0.7,'rgba(0,0,0,0.04)');gr.addColorStop(0.9,'rgba(0,0,0,0.28)');gr.addColorStop(1,'rgba(0,0,0,0.45)');
  g.fillStyle=gr;g.fillRect(0,0,256,256);
  const m=new THREE.Mesh(new THREE.CircleGeometry(DIAL_OPEN+0.6,64).rotateX(-Math.PI/2),
    new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),transparent:true,depthWrite:false,toneMapped:false}));
  m.position.set(0,2.3,HOLE_DY); m.renderOrder=3; m.raycast=()=>{}; m.userData.noShadow=true; caseG.add(m); return m;
})();

/* ---------- shadows ---------- */
root.traverse(o=>{
  if(!o.isMesh) return;
  let glass=false;for(let p=o;p;p=p.parent){if(p===crystalG)glass=true;}
  if(o.material&&o.material.opacity<0.5) glass=true;
  if(o.userData.noShadow) glass=true;
  o.castShadow=!glass; o.receiveShadow=!glass;
});

/* ---------- part info ---------- */
const INFO={
  crystal:{name:'Sapphire crystal',spec:'Synthetic corundum · 9 Mohs',body:'Grown from aluminium oxide and second only to diamond in hardness. A double-domed profile with anti-reflective coating on the underside keeps the dial legible at an angle.'},
  bezel:{name:'Bezel',spec:'18k rose gold · mirror polish',body:'A slim mirror-polished rose-gold ring that catches light against the brushed case. It seats the crystal in its gasket and is polished by hand on a buffing wheel.'},
  hands:{name:'Hands',spec:'Skeletonised batons · 18k rose gold',body:'The hour and minute hands are cut open along their length so they never hide the wheels beneath, and match the rose-gold bezel. The slim centre seconds hand moves in eight small steps a second. All three show your local time.'},
  dial:{name:'Dial',spec:'Grid-matte cream · rose-gold Roman numerals',body:'A cream dial stamped with a 0.5 mm grid and left matte. The Roman numerals are applied stroke by stroke in polished rose gold, matching the case, with IIII at four as watchmakers traditionally write it. Its centre is cut away so the movement stays in view.'},
  case:{name:'Case middle',spec:'40 mm · 18k rose gold',body:'The structural core in rose gold: satin-brushed flanks, polished lugs and spring bars for the strap. The crown at 3 o’clock winds the mainspring and sets the time, flanked by a pusher at 2 and at 4.'},
  mainplate:{name:'Mainplate',spec:'Openworked · hub and three spokes',body:'The foundation every other component mounts to, cut back to a rim, a hub and three spokes. Those windows are what let you watch the gear train from the dial side.'},
  train:{name:'Gear train',spec:'18k gold wheels · 25 jewels',body:'Solid gold wheels, circular-grained and polished at the edges. Energy flows from the barrel through the centre, third and fourth wheels. The escape wheel and pallet fork release it in equal pulses, which is what makes the second hand tick forward.'},
  mainspring:{name:'Mainspring',spec:'Spring alloy · 42 h reserve',body:'A long, thin ribbon of cobalt-nickel alloy wound tight inside the barrel. As it unwinds over about 42 hours it turns the barrel, and the barrel drives the whole gear train.'},
  hairspring:{name:'Balance spring',spec:'Flat spiral · 28,800 vph',body:'A hair-thin spiral fixed to the balance staff at its centre and to a stud at its outer end. It pulls the balance back after every swing, and its length and stiffness set the rate of eight beats a second.'},
  barrel:{name:'Mainspring barrel',spec:'42 h power reserve',body:'A coiled spring sealed in a toothed drum. Winding tightens the spring; as it unwinds, the drum turns and drives the whole gear train.'},
  balance:{name:'Balance wheel',spec:'Gold ring · 4 Hz',body:'The timekeeping organ. The gold ring and its flat hairspring oscillate at a fixed rate, eight beats a second. Each beat unlocks the escape wheel by one tooth.'},
  bridges:{name:'Bridges',spec:'Côtes de Genève · blued screws',body:'Plates that hold the wheel arbors from the caseback side. Each pivot runs in a synthetic ruby jewel set in a gold chaton to cut friction and wear.'},
  rotor:{name:'Rotor',spec:'Rhodium-plated · bidirectional winding',body:'A weighted half-disc on a jewelled pivot. Every movement of the wrist swings it and winds the mainspring, so the watch keeps running while worn.'},
  caseback:{name:'Caseback',spec:'Solid 18k rose gold · screw-down',body:'A closed, gently domed caseback that seals the case to 100 m with a gasket. The movement is seen only through the open dial. The notches take a case-opening wrench.'},
  strap:{name:'Strap',spec:'Olive alligator · 20/16 mm',body:'Glazed alligator in olive green, with large rectangular scales down the centre and tone-on-tone saddle stitching. It tapers from 20 mm at the lugs to 16 mm at the buckle.'},
};

/* ---------- labels ---------- */
// [key, group, local anchor point, radius out to camera-right]
const LABEL_DEFS=[
  ['crystal',crystalG,new THREE.Vector3(0,0,0),17.5],
  ['bezel',bezelG,new THREE.Vector3(0,3.6,0),20],
  ['hands',handsG,new THREE.Vector3(0,0.5,0),13.5],
  ['dial',dialG,new THREE.Vector3(0,0,0),17],
  ['case',caseG,new THREE.Vector3(0,-0.4,0),21],
  ['mainplate',plateG,new THREE.Vector3(0,0,0),14.8],
  ['balance',trainG,new THREE.Vector3(0,1,HOLE_DY),4.2],
  ['mainspring',MS,new THREE.Vector3(0,0.6,0),5],
  ['hairspring',HS,new THREE.Vector3(0,0,0),3.2],
  ['bridges',bridgesG,new THREE.Vector3(0,0.5,0),14],
  ['rotor',rotorG,new THREE.Vector3(0,0,0),14],
  ['caseback',backG,new THREE.Vector3(0,-5,0),19.6],
];
const labelsEl=document.getElementById('labels');
const labels=LABEL_DEFS.map(([k,g,v,r])=>{
  const el=document.createElement('div'); el.className='lbl'; el.tabIndex=-1;
  el.innerHTML=`<span>${INFO[k].name}</span>`;
  el.addEventListener('click',()=>select(k));
  labelsEl.appendChild(el);
  return {k,g,v,r,el};
});

/* ---------- selection ---------- */
const infoEl=document.getElementById('info');
let selected=null;
function belongs(o,k){while(o){if(o.userData&&o.userData.key===k)return true;o=o.parent;}return false;}
let hintDone=false, clickTarget='crystal';
const clickEl=document.getElementById('clickme'), clickBtn=clickEl.querySelector('button'), clickPath=clickEl.querySelector('path');
clickEl.querySelector('button').addEventListener('click',()=>select(clickTarget));
function select(k){
  if(k) hintDone=true;
  selected=k;
  root.traverse(o=>{
    if(!o.isMesh&&!o.isLine) return;
    const mats=Array.isArray(o.material)?o.material:[o.material];
    mats.forEach(m=>{
      if(!m.userData.orig) m.userData.orig={t:m.transparent,op:m.opacity,dw:m.depthWrite};
      const ghost=k&&!belongs(o,k)&&!(k==='train'&&(belongs(o,'barrel')||belongs(o,'balance')));
      if(ghost){m.transparent=true;m.opacity=Math.min(m.userData.orig.op,0.1);m.depthWrite=false;}
      else{m.transparent=m.userData.orig.t;m.opacity=m.userData.orig.op;m.depthWrite=m.userData.orig.dw;}
      m.needsUpdate=true;
    });
  });
  labels.forEach(l=>l.el.classList.toggle('sel',l.k===k));
  if(!k){infoEl.hidden=true;return;}
  const d=INFO[k];
  document.getElementById('infoName').textContent=d.name;
  document.getElementById('infoSpec').textContent=d.spec;
  document.getElementById('infoBody').textContent=d.body;
  infoEl.hidden=false;
}
document.getElementById('infoClose').addEventListener('click',()=>select(null));

const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
let down=null;
canvas.addEventListener('pointerdown',e=>{
  down={x:e.clientX,y:e.clientY};
  if(turnable){turning=true;lastX=e.clientX;lastY=e.clientY;spinX=spinY=0;canvas.setPointerCapture(e.pointerId);document.documentElement.classList.add('turning');}
});
// Free rotation in the final frame: drag turns the watch about the screen axes (trackball), so any face can be shown.
const userQ=new THREE.Quaternion(), qTmp=new THREE.Quaternion(), qId=new THREE.Quaternion(), axU=new THREE.Vector3(), axR=new THREE.Vector3();
let turnable=false, turning=false, lastX=0, lastY=0, spinX=0, spinY=0, resetView=false;
function turnBy(dx,dy){
  axR.setFromMatrixColumn(camera.matrixWorld,0).normalize(); axU.setFromMatrixColumn(camera.matrixWorld,1).normalize();
  userQ.premultiply(qTmp.setFromAxisAngle(axU,dx*0.009)).premultiply(qTmp.setFromAxisAngle(axR,dy*0.009)).normalize();
}
addEventListener('pointermove',e=>{
  if(!turning) return;
  const dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY;
  turnBy(dx,dy); spinX=dx; spinY=dy;
});
const endTurn=()=>{turning=false;document.documentElement.classList.remove('turning');};
addEventListener('pointerup',endTurn); addEventListener('pointercancel',endTurn);
canvas.addEventListener('dblclick',()=>{if(turnable)resetView=true;});
document.getElementById('frontView').addEventListener('click',()=>{resetView=true;});
canvas.addEventListener('pointerup',e=>{
  if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6){down=null;return;}
  down=null;
  const r=canvas.getBoundingClientRect();
  ndc.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc,camera);
  const hits=ray.intersectObject(root,true).filter(h=>h.object.isMesh);
  let hit=null;
  for(const h of hits){
    if(belongs(h.object,'crystal')&&explodeCur<0.2&&hits.length>1) continue;
    const hm=Array.isArray(h.object.material)?h.object.material[0]:h.object.material;
    if(selected&&hm.opacity<0.12) continue;
    hit=h;break;
  }
  if(!hit){select(null);return;}
  let o=hit.object,k=null;while(o){if(o.userData&&o.userData.key){k=o.userData.key;break;}o=o.parent;}
  select(k===selected?null:k);
});

/* ---------- scroll ---------- */
const chapEl=document.getElementById('chap');
const sections=[...document.querySelectorAll('.ch')];
let explodeTarget=0, explodeCur=0, scrollP=0, explodeProg=0, wrapTarget=0, wrapCur=0, wrapShown=0;
const camTarget=new THREE.Vector3();
function maxScroll(){return Math.max(1,document.documentElement.scrollHeight-innerHeight);}
function onScroll(){
  scrollP=clamp(scrollY/maxScroll());
  // all but the last chapter take the watch apart; the last one reassembles it and wraps it on the wrist
  const N=sections.length-1, pEx=(N-1)/N;
  explodeProg=Math.min(1,scrollP/pEx);
  document.documentElement.classList.toggle('final',scrollP>pEx+(1-pEx)*0.6);
  if(scrollP<=pEx){explodeTarget=explodeProg;wrapTarget=0;}
  else{const k=(scrollP-pEx)/(1-pEx);explodeTarget=1-clamp(k/0.5);wrapTarget=clamp((k-0.3)/0.6);}
  const i=Math.min(N,Math.round(scrollP*N));
  chapEl.innerHTML=`<b>${String(i).padStart(2,'0')}</b> / ${String(N).padStart(2,'0')} · ${sections[i].dataset.name}`;
}
addEventListener('scroll',onScroll,{passive:true});
addEventListener('keydown',e=>{if(e.key==='Escape'&&selected)select(null);});
function setStrap(key){
  const c=STRAP_COLORS[key], map=strapMap(key);
  [strapA,strapB,dialG].forEach(g=>g.traverse(o=>{
    if(!o.isMesh) return;
    (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{
      const role=m.userData.strap;
      if(role==='leather'){m.map=map;m.needsUpdate=true;}
      else if(role==='edge') m.color.set(c.edge).convertSRGBToLinear();
      else if(role==='plain') m.color.set(c.plain).convertSRGBToLinear();
    });
  }));
  document.querySelectorAll('.swatch').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.strap===key)));
  INFO.strap.name='Strap'; INFO.strap.spec=c.name+' alligator · 20/16 mm';
}
// Swapping straps: the current pair slides out along the strap line, the new pair is fitted while off-frame,
// then slides back in to the lugs. A click mid-swap just retargets which strap comes back in.
let swap=null, strapOff=0, strapKey='green';
const EM_COLORS={green:'#4b5e22',navy:'#1f3166',red:'#8a161b'};
function requestStrap(key){
  document.documentElement.style.setProperty('--em',EM_COLORS[key]);
  if(key===strapKey&&!swap) return;
  document.querySelectorAll('.swatch').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.strap===key)));
  if(swap){swap.key=key;return;}
  if(REDUCED){setStrap(key);strapKey=key;return;}
  swap={key,t0:performance.now(),t:0,fitted:false};
}
function stepSwap(dt){
  if(!swap) return;
  swap.t=Math.min(1,(performance.now()-swap.t0)/1300);
  const t=swap.t;
  if(t<0.45) strapOff=ease(t/0.45);
  else if(t<0.55){ strapOff=1; if(!swap.fitted){setStrap(swap.key);strapKey=swap.key;swap.fitted=true;} }
  else { if(swap.key!==strapKey){setStrap(swap.key);strapKey=swap.key;} strapOff=1-ease((t-0.55)/0.45); }
  if(t>=1){strapOff=0;swap=null;}
}
document.querySelectorAll('.swatch').forEach(b=>b.addEventListener('click',()=>requestStrap(b.dataset.strap)));

/* ---------- layout ---------- */
let W=1,H=1;
function viewOffset(){
  const k=clamp(explodeProg*5); // desktop opening shot sits a little further left, easing to the usual offset as you scroll
  camera.setViewOffset(W,H,W>SPLIT_W?-W*lerp(0.10,0.17,k):0,W>SPLIT_W?0:H*0.25,W,H); camera.updateProjectionMatrix(); // phones: watch centred in the top half
}
function resize(){
  W=innerWidth;H=innerHeight;
  renderer.setSize(W,H,false);
  camera.aspect=W/H;
  if(W>SPLIT_W) camera.setViewOffset(W,H,-W*0.17,0,W,H);
  else camera.setViewOffset(W,H,0,H*0.25,W,H);
  camera.updateProjectionMatrix();
}
addEventListener('resize',resize);
resize(); onScroll();

/* ---------- animation ---------- */
function applyExplode(e){
  for(const g of parts){
    const u=g.userData, t=ease(clamp((e-u.w0)/(u.w1-u.w0)));
    u.t=t;
    const so=(u.key==='strap'&&strapOff)?strapOff:0; // strap swap: slide out along the strap line and lift slightly
    g.position.set(u.bx+u.dx*t,u.baseY+u.dy*t+so*6,u.bz+u.dz*t+Math.sign(u.bz)*so*150);
  }
  // the springs slide out of their housings as the train separates, so both are visible when exploded
  const tt=trainG.userData.t||0;
  if(MS){MS.position.set(-9*tt,-1.2-9*tt,2*tt);MS.userData.t=tt;}
  if(HS){HS.position.set(4*tt,0.45+4.5*tt,0);HS.userData.t=tt;}
}
function setHands(now){
  const d=new Date(now);
  let s=d.getSeconds()+d.getMilliseconds()/1000;
  s=REDUCED?Math.floor(s):Math.floor(s*8)/8;
  const m=d.getMinutes()+s/60, h=(d.getHours()%12)+m/60;
  secHand.rotation.y=-s/60*TAU; minHand.rotation.y=-m/60*TAU; hourHand.rotation.y=-h/12*TAU;
}
// desktop opening shot: case large on the right, buckle top-centre, tail strap running off the bottom-right edge
const OPEN_DIST=156, OPEN_Z=6, OPEN_AZ=-0.62;
const tmp=new THREE.Vector3(), camRight=new THREE.Vector3(), tmpP=new THREE.Vector3(), tmpT=new THREE.Vector3();
const clock=new THREE.Clock();
let rotorV=0;
function frame(){
  const dt=Math.min(clock.getDelta(),0.05), t=clock.elapsedTime;
  explodeCur+= (explodeTarget-explodeCur)*(1-Math.exp(-dt*7));
  wrapCur+=(wrapTarget-wrapCur)*(1-Math.exp(-dt*5));
  if(Math.abs(wrapTarget-wrapCur)<1e-4) wrapCur=wrapTarget;
  stepSwap(dt);
  {
    const on=wrapCur>0.95||(scrollP<0.015&&explodeCur<0.02); // final frame, and the opening view at the top of the page
    if(on!==turnable){turnable=on;document.documentElement.classList.toggle('turnable',on);}
    if(!turning&&(Math.abs(spinX)+Math.abs(spinY))>0.05&&!REDUCED){turnBy(spinX,spinY);spinX*=0.92;spinY*=0.92;} // a little inertia after release
    if(!turnable||resetView){userQ.slerp(qId,1-Math.exp(-dt*6)); spinX=spinY=0; if(userQ.angleTo(qId)<0.002){userQ.identity();resetView=false;}}
    root.quaternion.copy(userQ);
  }
  const wc=ease(wrapCur);
  viewOffset();
  if(Math.abs(explodeTarget-explodeCur)<1e-4) explodeCur=explodeTarget;
  applyExplode(explodeCur);
  setHands(Date.now());

  if(!REDUCED){
    const beat=t*4; // 4 Hz
    for(const s of spinners){
      if(s.balance) s.o.rotation.y=Math.sin(beat*TAU)*1.7;
      else if(s.hair){const k=1+Math.sin(beat*TAU)*0.035;s.o.scale.set(k,1,k);}
      else if(s.escape){const k=Math.floor(t*8),f=clamp((t*8-k)*5);s.o.rotation.y=(k+ease(f))*(TAU/20)/2;}
      else if(s.fork) s.o.rotation.y=s.base+(Math.floor(t*8)%2?1:-1)*0.09;
      else s.o.rotation.y+=s.w*dt;
    }
    rotorV+= (Math.sin(t*0.7)*0.6-rotorV)*dt*0.5;
    rotorSpin.rotation.y+=rotorV*dt*(0.3+explodeCur);
  }

  {
    const e=explodeCur, a=camera.aspect;
    const sway=REDUCED?0:Math.sin(t*0.25)*0.05;
    const az=(W>SPLIT_W?OPEN_AZ:-0.72)+explodeProg*1.9+sway;
    const el=lerp(0.66,0.3,e);
    const fit=lerp(Math.max(1,0.95/a),Math.max(1,(W>SPLIT_W?0.62:0.78)/a),e)*(W>SPLIT_W?1:lerp(1,1.85,e)); // phones: the exploded stack must fit the top half
    const dist=lerp(W>SPLIT_W?OPEN_DIST:275/1.3,300,e)*fit/WATCH_SCALE*(W<=SPLIT_W?lerp(1.3,1,e):1); // phones: pull back so the buckle and tip both fit
    camTarget.set(0,W>SPLIT_W?lerp(-8.5,-5,clamp(explodeProg*5)):lerp(-4,-5,e),W<=SPLIT_W?0:lerp(OPEN_Z,0,e)); // phones: aim at the case so the watch sits dead centre // assembled framing includes both curled straps
    floor.position.y=lerp(-8,-92,e); apertureShade.material.opacity=1-clamp(e/0.2); apertureShade.visible=e<0.2; floor.material.opacity=lerp(0.16,0.07,e)*(1-clamp(userQ.angleTo(qId)/0.5)); // ground shadow fades once the watch is turned
    camera.position.set(camTarget.x+dist*Math.cos(el)*Math.sin(az),camTarget.y+dist*Math.sin(el),camTarget.z+dist*Math.cos(el)*Math.cos(az));
    if(wc>0){ // finale: straight-on front view of the dial, 12 at the top
      const wd=150*Math.max(1,0.75/a)/WATCH_SCALE*(W<=SPLIT_W?1.6:1), wel=1.36, waz=0; // ~78°: face-on, just off the overhead softbox glare
      tmpT.set(0,2,0);
      tmpP.set(tmpT.x+wd*Math.cos(wel)*Math.sin(waz),tmpT.y+wd*Math.sin(wel),tmpT.z+wd*Math.cos(wel)*Math.cos(waz));
      camera.position.lerp(tmpP,wc); camTarget.lerp(tmpT,wc);
    }
    camera.up.set(0,1-wc,-wc).normalize(); // keep 12 o'clock at the top as the view turns face-on
    camera.lookAt(camTarget);
    crystalG.traverse(o=>{if(o.isMesh)o.material.opacity=lerp(0.09,0.03,wc);}); // less glass glare face-on
    [strapA,strapB].forEach(g=>g.traverse(o=>{if(o.isMesh)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m.clearcoat!==undefined){m.envMapIntensity=lerp(0.7,0.3,wc);}});})); // keep the glazed strap from mirroring the front softbox
  }

  // labels
  const showAll=(W>SPLIT_W||explodeProg>0.93)&&wrapCur<0.05;
  root.updateMatrixWorld();
  camRight.setFromMatrixColumn(camera.matrixWorld,0).setY(0).normalize();
  const shown=[];
  for(const l of labels){
    const u=l.g.userData;
    const on=showAll&&!selected&&explodeCur>0.3&&(l.g===caseG?explodeCur>0.6:u.t>0.92);
    tmp.copy(l.v).applyMatrix4(l.g.matrixWorld).addScaledVector(camRight,l.r).project(camera);
    l.x=(tmp.x*0.5+0.5)*W; l.y=(-tmp.y*0.5+0.5)*H;
    const vis=on&&tmp.z<1&&l.y>64&&l.y<H-24;
    l.el.classList.toggle('on',vis);
    if(vis) shown.push(l);
  }
  // keep labels at least 18px apart vertically so neighbours never overprint
  shown.sort((a,b)=>a.y-b.y);
  for(let i=1;i<shown.length;i++){ if(shown[i].y-shown[i-1].y<18) shown[i].y=shown[i-1].y+18; }
  for(const l of labels) l.el.style.transform=`translate(${l.x.toFixed(1)}px,${(l.y-8).toFixed(1)}px)`;
  { // the signifier sits up and to the right of the topmost visible label, arrow pointing at it
    const first=shown[0], show=!!first&&!hintDone&&!selected;
    clickEl.classList.toggle('on',show);
    if(first){
      clickTarget=first.k; const x=first.x+first.el.offsetWidth+8, y=first.y-52;
      clickEl.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      // keep the tag on screen: slide it left when it would run off the right edge, and re-aim the leader
      const bw=clickBtn.offsetWidth, bl=Math.min(46,W-20-x-bw);
      const side=bl>=12, bh=clickBtn.offsetHeight; let bt=side?-4:-bh-6; const below=!side&&y+bt<64; if(below) bt=70; // clear of the top bar
      clickBtn.style.left=bl+'px'; clickBtn.style.top=bt+'px';
      const sx=side?bl:Math.max(bl+bw*0.6,14), sy=side?14:below?bt:bt+bh;
      clickPath.setAttribute('d',`M${sx.toFixed(1)} ${sy} Q 3 ${sy}, 3 49`);
    }
  }

  renderer.render(scene,camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// redraw dial once fonts arrive so canvas text uses the real faces
LOGO.onload=()=>dialTex.userData.redraw(); if(LOGO.complete) dialTex.userData.redraw();
if(document.fonts&&document.fonts.load){
  Promise.all([document.fonts.load('500 60px "Bodoni Moda"'),document.fonts.load('italic 400 40px "Bodoni Moda"'),document.fonts.load('400 20px "JetBrains Mono"')])
    .then(()=>dialTex.userData.redraw()).catch(()=>{});
}
})();
