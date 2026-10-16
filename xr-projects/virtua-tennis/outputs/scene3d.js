/* Small self-contained WebGL tennis scene. */
window.createTennisScene=function(canvas){
 const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
 if(!gl){const c=canvas.getContext('2d');return state=>{let w=canvas.width=canvas.clientWidth*(devicePixelRatio||1),h=canvas.height=canvas.clientHeight*(devicePixelRatio||1);c.setTransform(devicePixelRatio||1,0,0,devicePixelRatio||1,0,0);c.fillStyle='#245340';c.fillRect(0,0,w,h);c.fillStyle='#648754';c.beginPath();c.moveTo(w*.2,h*.12);c.lineTo(w*.8,h*.12);c.lineTo(w*.97,h*.98);c.lineTo(w*.03,h*.98);c.fill();c.strokeStyle='#f0f0d9';c.lineWidth=2;c.strokeRect(w*.2,h*.12,w*.6,h*.86);c.beginPath();c.moveTo(w*.2,h*.55);c.lineTo(w*.8,h*.55);c.stroke();c.fillStyle='#d5ff55';c.beginPath();c.arc(w*(.5+state.ball.x/13),h*(.12+state.ball.z/24.25*.86),6,0,7);c.fill()}};
 const vs=`attribute vec3 aPosition;attribute vec3 aNormal;attribute vec3 aColor;uniform mat4 uProjection;uniform mat4 uView;varying vec3 vNormal;varying vec3 vColor;varying float vDepth;void main(){vec4 viewPos=uView*vec4(aPosition,1.0);gl_Position=uProjection*viewPos;vNormal=mat3(uView)*aNormal;vColor=aColor;vDepth=-viewPos.z;}`;
 const fs=`precision mediump float;varying vec3 vNormal;varying vec3 vColor;varying float vDepth;void main(){vec3 n=normalize(vNormal);float sun=max(dot(n,normalize(vec3(-0.45,0.85,0.35))),0.0);float light=0.48+sun*0.62;vec3 color=vColor*light;float fog=smoothstep(29.0,53.0,vDepth);vec3 fogColor=vec3(0.08,0.16,0.14);gl_FragColor=vec4(mix(color,fogColor,fog),1.0);}`;
  const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s};
 const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vs));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 const loc={p:gl.getAttribLocation(program,'aPosition'),n:gl.getAttribLocation(program,'aNormal'),c:gl.getAttribLocation(program,'aColor'),proj:gl.getUniformLocation(program,'uProjection'),view:gl.getUniformLocation(program,'uView')};
 const buffer=gl.createBuffer();gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(.055,.12,.105,1);
 const V=(x,y,z)=>[x,y,z], verts=[];
 function tri(a,b,c,col){const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],nn=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],ll=Math.hypot(...nn)||1,n=nn.map(v=>v/ll);for(const q of [a,b,c])verts.push(...q,...n,...col)}
function smoothTri(a,b,c,na,nb,nc,col){for(const [q,n] of [[a,na],[b,nb],[c,nc]])verts.push(...q,...n,...col)}
function quad(a,b,c,d,col){tri(a,b,c,col);tri(a,c,d,col)}
function smoothQuad(a,b,c,d,na,nb,nc,nd,col){smoothTri(a,b,c,na,nb,nc,col);smoothTri(a,c,d,na,nc,nd,col)}
 function box(cx,cy,cz,sx,sy,sz,col){const x0=cx-sx/2,x1=cx+sx/2,y0=cy-sy/2,y1=cy+sy/2,z0=cz-sz/2,z1=cz+sz/2;const p=[V(x0,y0,z0),V(x1,y0,z0),V(x1,y1,z0),V(x0,y1,z0),V(x0,y0,z1),V(x1,y0,z1),V(x1,y1,z1),V(x0,y1,z1)];quad(p[0],p[1],p[2],p[3],col);quad(p[5],p[4],p[7],p[6],col);quad(p[4],p[0],p[3],p[7],col);quad(p[1],p[5],p[6],p[2],col);quad(p[3],p[2],p[6],p[7],col);quad(p[4],p[5],p[1],p[0],col)}
 function sphere(cx,cy,cz,rx,ry,rz,col,lat=15,lon=22){const norm=v=>{let l=Math.hypot(...v)||1;return v.map(q=>q/l)};for(let i=0;i<lat;i++){const a0=-Math.PI/2+i*Math.PI/lat,a1=a0+Math.PI/lat;for(let j=0;j<lon;j++){const b0=j*2*Math.PI/lon,b1=b0+2*Math.PI/lon;const pt=(a,b)=>{const u=[Math.cos(a)*Math.cos(b),Math.sin(a),Math.cos(a)*Math.sin(b)];return{p:V(cx+rx*u[0],cy+ry*u[1],cz+rz*u[2]),n:norm([u[0]/rx,u[1]/ry,u[2]/rz])}};const p1=pt(a0,b0),p2=pt(a0,b1),p3=pt(a1,b1),p4=pt(a1,b0);smoothTri(p1.p,p2.p,p3.p,p1.n,p2.n,p3.n,col);smoothTri(p1.p,p3.p,p4.p,p1.n,p3.n,p4.n,col)}}}
 function tube(a,b,r,col,sides=12){const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],len=Math.hypot(...d)||1,u=d.map(v=>v/len),ref=Math.abs(u[1])>.9?[1,0,0]:[0,1,0],cross=(x,y)=>[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]],n0=cross(u,ref),nl=Math.hypot(...n0),v=n0.map(q=>q/nl),w=cross(u,v);for(let i=0;i<sides;i++){let t0=i*2*Math.PI/sides,t1=(i+1)*2*Math.PI/sides;const point=(p,t)=>V(p[0]+r*(v[0]*Math.cos(t)+w[0]*Math.sin(t)),p[1]+r*(v[1]*Math.cos(t)+w[1]*Math.sin(t)),p[2]+r*(v[2]*Math.cos(t)+w[2]*Math.sin(t))),normal=t=>v.map((q,k)=>q*Math.cos(t)+w[k]*Math.sin(t));smoothQuad(point(a,t0),point(a,t1),point(b,t1),point(b,t0),normal(t0),normal(t1),normal(t1),normal(t0),col)}}
 /* ---------- Swing rig ----------
    Each swing is keyframed on two shoulder angles: th = yaw around the vertical axis
    (backswing → contact → follow-through) and ph = pitch in the frontal plane
    (low-to-high for topspin, high-to-low for slice, overhead for the serve).
    Keyframes sit at phase 0 / .32 (loaded) / .5 (contact) / 1 (finish). */
 const SW_REST=-.35,KP=[0,.32,.5,1],SW={fore:[-.35,-1.55,.25,2.0],back:[-.35,2.6,1.3,-.6],serve:[-.35,-.8,.15,1.9],
  ph:{'FLAT SHOT':[0,-.2,.1,.65],'TOPSPIN':[0,-.55,-.1,1.15],'SLICE':[0,.75,.2,-.35],'DROP SHOT':[0,.5,.25,0],'SERVE':[0,1.9,2.4,-.5]}};
 function curve(k,p){if(p<=0)return k[0];if(p>=1)return k[3];for(let i=0;i<3;i++)if(p<=KP[i+1]){const u=(p-KP[i])/(KP[i+1]-KP[i]),e=u*u*(3-2*u);return k[i]+(k[i+1]-k[i])*e}return k[3]}
 function swingPose(sw,t){if(!sw)return{th:SW_REST,ph:0,p:-1};const p=(t-sw.t0)/sw.dur;if(p<0)return{th:SW_REST,ph:0,p};
  let th=curve(sw.type==='SERVE'?SW.serve:sw.back?SW.back:SW.fore,p),ph=curve(SW.ph[sw.type]||SW.ph['FLAT SHOT'],p);
  if(sw.type==='DROP SHOT')th=SW_REST+(th-SW_REST)*.55;
  if(p>1){const r=Math.min(1,(p-1)/.6),e=r*r*(3-2*r);th+=(SW_REST-th)*e;ph-=ph*e}
  return{th,ph,p}}
 // Rotate every vertex from index i0 to the end of the buffer around a pivot (axis 1 = Y yaw, 3 = Z pitch).
 function rot(i0,cx,cy,cz,axis,a){if(!a)return;const c=Math.cos(a),s=Math.sin(a);for(let i=i0;i<verts.length;i+=9)for(let o=0;o<6;o+=3){const P=o===0,ox=P?cx:0,oy=P?cy:0,oz=P?cz:0,x=verts[i+o]-ox,y=verts[i+o+1]-oy,z=verts[i+o+2]-oz;if(axis===1){verts[i+o]=x*c+z*s+ox;verts[i+o+2]=-x*s+z*c+oz}else{verts[i+o]=x*c-y*s+ox;verts[i+o+1]=x*s+y*c+oy}}}
 const nrm=v=>{const l=Math.hypot(...v)||1;return v.map(q=>q/l)},add=(p,v,k)=>[p[0]+v[0]*k,p[1]+v[1]*k,p[2]+v[2]*k],lerp=(a,b,t)=>a.map((q,i)=>q+(b[i]-q)*t);
 // Racket held in the hand: grip, open throat, oval head and a light string bed. Face normal points at the net at contact.
 function racketFrom(h,S){const d=nrm([1,.18,-.25]),u=nrm([-d[0]*d[1],1-d[1]*d[1],-d[2]*d[1]]),frame=[.86,.9,.75],str=[.78,.84,.7],a=.17*S,b=.13*S;
  const gripEnd=add(h,d,-.08*S),throat=add(h,d,.2*S),c=add(h,d,.41*S);
  tube(gripEnd,throat,.019*S,[.13,.15,.14],8);let prev=null;
  for(let i=0;i<=22;i++){const t=i/22*2*Math.PI,p=add(add(c,d,a*Math.cos(t)),u,b*Math.sin(t));if(prev)tube(prev,p,.012*S,frame,6);prev=p}
  tube(throat,add(add(c,d,-a*.84),u,b*.55),.01*S,frame,5);tube(throat,add(add(c,d,-a*.84),u,-b*.55),.01*S,frame,5);
  for(let j=-3;j<=3;j++){const k=j/4,hw=Math.sqrt(1-k*k);tube(add(add(c,u,b*k),d,-a*hw),add(add(c,u,b*k),d,a*hw),.0035*S,str,3);tube(add(add(c,d,a*k),u,-b*hw),add(add(c,d,a*k),u,b*hw),.0035*S,str,3)}}
 // Players are modelled facing the far end (-z); the far player is the same rig turned 180°.
 function player(x,z,S,shirt,shorts,o){const skin=o.skin,hair=o.hair,facing=-1,t=o.time||0,move=Math.min(1,(o.run||0)/4),phase=t*7.5,step=Math.sin(phase)*.17*S*move,bob=Math.abs(Math.sin(phase))*.035*S*move,pose=swingPose(o.swing,t),i0=verts.length;
 const headY=1.53*S+bob,neckTop=1.34*S+bob,neckBase=1.18*S+bob,shoulderY=1.12*S+bob,hipY=.78*S+bob,white=[.91,.91,.79];
 const shoulderL=V(x-.205*S,shoulderY,z),shoulderR=V(x+.205*S,shoulderY,z),elbowL=V(x-.34*S,.86*S+step*.22+bob,z-.02*S),handL=V(x-.27*S,.57*S+step*.55+bob,z-.08*S),elbowR=V(x+.34*S,.9*S+bob,z-.1*S),handR=V(x+.47*S,.79*S+bob,z-.25*S);
 const hipL=V(x-.1*S,hipY,z),hipR=V(x+.1*S,hipY,z),kneeL=V(x-.15*S,.39*S-step,z),kneeR=V(x+.15*S,.39*S+step,z),ankleL=V(x-.2*S,.1*S,z-.035*S),ankleR=V(x+.2*S,.1*S,z-.035*S),sole=[.055,.075,.07],shoe=[.87,.89,.79];
 sphere(x,.03,z,.42*S,.012,.33*S,[.025,.055,.044],8,14);
 for(const [hp,kn,an] of [[hipL,kneeL,ankleL],[hipR,kneeR,ankleR]]){tube(hp,kn,.095*S,skin,16);sphere(kn[0],kn[1],kn[2],.088*S,.09*S,.086*S,skin);tube(kn,an,.064*S,skin,14);tube(V(an[0],an[1]+.12*S,an[2]),an,.075*S,[.91,.91,.8],14)}
 sphere(x-.2*S,.095*S,z-.13*S,.19*S,.09*S,.31*S,shoe,12,18);sphere(x+.2*S,.095*S,z-.13*S,.19*S,.09*S,.31*S,shoe,12,18);
 tube(V(x-.2*S,.035*S,z-.16*S),V(x-.2*S,.035*S,z+.06*S),.055*S,sole,12);tube(V(x+.2*S,.035*S,z-.16*S),V(x+.2*S,.035*S,z+.06*S),.055*S,sole,12);
 for(let j=-1;j<=1;j++){box(x-.2*S+j*.035*S,.16*S,z-.25*S,.012*S,.012*S,.11*S,[.68,.69,.63]);box(x+.2*S+j*.035*S,.16*S,z-.25*S,.012*S,.012*S,.11*S,[.68,.69,.63])}
 sphere(x,hipY,z,.22*S,.205*S,.17*S,shorts,17,24);
 tube(V(x-.15*S,.85*S,z-.005*S),V(x-.205*S,.61*S,z-.012*S),.012*S,[.92,.92,.82],8);tube(V(x+.15*S,.85*S,z-.005*S),V(x+.205*S,.61*S,z-.012*S),.012*S,[.92,.92,.82],8);
 const iUp=verts.length; // ---- upper body: turns with the swing
 sphere(x,.88*S+bob,z,.235*S,.34*S,.16*S,shirt,20,28);sphere(x,1.08*S+bob,z,.25*S,.19*S,.165*S,shirt,17,25);
 tube(V(x-.07*S,neckBase,z),V(x+.07*S,neckBase,z),.065*S,skin,14);tube(V(x,1.1*S+bob,z),V(x,1.16*S+bob,z),.15*S,shirt,16);tube(V(x-.11*S,1.13*S+bob,z+.01),V(x+.11*S,1.13*S+bob,z+.01),.012*S,[.91,.93,.82],12);
 sphere(shoulderL[0],shoulderL[1],shoulderL[2],.105*S,.12*S,.13*S,shirt,14,18);tube(shoulderL,elbowL,.079*S,shirt,14);sphere(elbowL[0],elbowL[1],elbowL[2],.064*S,.068*S,.065*S,skin,12,16);tube(elbowL,handL,.048*S,skin,13);sphere(handL[0],handL[1],handL[2],.057*S,.055*S,.06*S,skin,12,16);tube(V(handL[0],handL[1]+.055*S,handL[2]),V(handL[0],handL[1]+.09*S,handL[2]),.055*S,white,12);
 tube(V(x,neckBase,z),V(x,neckTop,z),.065*S,skin,14);sphere(x,headY,z,.098*S,.13*S,.1*S,skin,20,28);sphere(x,headY+.075*S,z+facing*.005*S,.103*S,.052*S,.105*S,hair,16,22);
 for(const side of [-1,1]){sphere(x+side*.099*S,headY+.012*S,z,.024*S,.05*S,.032*S,hair,12,16);sphere(x+side*.099*S,headY-.015*S,z,.018*S,.032*S,.021*S,skin,12,16)}
 const faceZ=z+facing*.086*S;for(const side of [-1,1]){sphere(x+side*.034*S,headY+.018*S,faceZ,.012*S,.01*S,.01*S,[.055,.045,.038],10,12);sphere(x+side*.034*S,headY+.02*S,faceZ+facing*.006*S,.0045*S,.005*S,.0045*S,[.93,.91,.78],8,10)}
 sphere(x,headY-.012*S,z+facing*.108*S,.015*S,.019*S,.018*S,skin,12,16);tube(V(x-.022*S,headY-.055*S,faceZ),V(x+.022*S,headY-.055*S,faceZ),.0055*S,[.31,.12,.1],7);
 tube(V(x-.091*S,headY+.073*S,z),V(x+.091*S,headY+.073*S,z),.014*S,[.89,.92,.81],14);
 const iArm=verts.length; // ---- racket arm: driven by the swing keyframes
 sphere(shoulderR[0],shoulderR[1],shoulderR[2],.105*S,.12*S,.13*S,shirt,14,18);tube(shoulderR,elbowR,.079*S,shirt,14);sphere(elbowR[0],elbowR[1],elbowR[2],.064*S,.068*S,.065*S,skin,12,16);tube(elbowR,handR,.048*S,skin,13);sphere(handR[0],handR[1],handR[2],.057*S,.055*S,.06*S,skin,12,16);tube(lerp(elbowR,handR,.74),lerp(elbowR,handR,.88),.055*S,white,12);
 racketFrom(handR,S);
 rot(iArm,shoulderR[0],shoulderR[1],shoulderR[2],3,pose.ph);rot(iArm,shoulderR[0],shoulderR[1],shoulderR[2],1,pose.th);
 rot(iUp,x,0,z,1,pose.th*.35);
 if(o.far)rot(i0,x,0,z,1,Math.PI);
}
 function addCourt(){
  const near=24.25,far=.48,mid=(near+far)/2,length=near-far,doubles=5.485,singles=4.115,serviceNear=mid+6.4,serviceFar=mid-6.4,netZ=mid;
  box(0,-.28,12.35,48,.3,58,[.055,.12,.105]);
  // Broad courtside apron inspired by Arthur Ashe: roughly 5 m at the sides
  // and 8 m behind each baseline before the lower seating bowl begins.
  box(0,-.105,mid,20.8,.07,40.2,[.09,.22,.17]);
  box(0,-.065,mid,12.05,.12,length+.45,[.12,.31,.23]);
  box(0,.012,mid,11.05,.035,length,[.18,.39,.28]);
  // The 1.37 m doubles alleys are tinted separately and bounded by both singles and doubles lines.
  box(-4.8,.033,mid,1.37,.006,length,[.15,.345,.245]);box(4.8,.033,mid,1.37,.006,length,[.15,.345,.245]);
  const line=[.92,.94,.83],y=.047;
  box(0,y,far,10.97,.045,.05,line);box(0,y,near,10.97,.045,.05,line);
  box(-doubles,y,mid,.05,.045,length,line);box(doubles,y,mid,.05,.045,length,line);
  box(-singles,y,mid,.05,.045,length,line);box(singles,y,mid,.05,.045,length,line);
  box(0,y,serviceFar,8.23,.045,.05,line);box(0,y,serviceNear,8.23,.045,.05,line);
  box(0,y,(serviceFar+serviceNear)/2,.05,.045,12.8,line);
  // Short center marks point into court at each baseline.
  box(0,y,far+.11,.05,.045,.22,line);box(0,y,near-.11,.05,.045,.22,line);
  // Regulation net: 0.914 m at center and 1.07 m at the doubles posts.
  const netTop=x=>.914+(.156*Math.abs(x)/6.4);
  box(-6.4,.535,netZ,.12,1.07,.12,[.76,.83,.68]);box(6.4,.535,netZ,.12,1.07,.12,[.76,.83,.68]);box(-(singles+.914),.51,netZ,.045,1.02,.045,[.87,.9,.8]);box(singles+.914,.51,netZ,.045,1.02,.045,[.87,.9,.8]);box(0,.45,netZ-.012,.035,.9,.022,[.91,.93,.84]);
  for(let x=-6.4;x<=6.401;x+=.19){const h=netTop(x);box(x,h/2,netZ+.02,.012,h,.012,[.48,.62,.51]);box(x,h+.012,netZ+.02,.035,.024,.035,[.94,.95,.86])}
  for(let yy=.1;yy<.91;yy+=.105)box(0,yy,netZ+.02,12.8,.01,.012,[.48,.62,.51]);
  // Lower bowl starts beyond the wide courtside apron and climbs in stepped rows.
  // Seat fronts sit about 5 m outside the doubles sideline; long platforms make
  // continuous side galleries rather than isolated bleachers.
  for(let side of [-1,1]){
    for(let row=0;row<7;row++){
      const x=side*(10.55+row*.58),y=.68+row*.39;
      box(x,y-.19,mid,.66,.34,40.5,[.075+row*.006,.145+row*.009,.13+row*.008]);
      for(let seat=0;seat<26;seat++)box(x,y,.05+seat*1.5,.4,.2,.82,(seat+row)%4?[.12+row*.006,.28+row*.009,.23+row*.006]:[.72,.79,.65]);
    }
    // Dark outer vomitory wall and a restrained roof-edge lighting rail.
    box(side*15.25,3.5,mid,.24,6.4,42.5,[.035,.075,.068]);
    for(let z=-7;z<33;z+=2.5)box(side*14.95,6.85,z,.35,.12,.85,[.77,.9,.73]);
  }
  // Far end stands complete the bowl beyond the baseline run-off, like the end
  // sections that close Arthur Ashe's stadium around the show court.
  for(let row=0;row<7;row++){
    const z=-(7.9+row*.58),y=.68+row*.39;
    box(0,y-.19,z,20.2,.34,.66,[.075+row*.006,.145+row*.009,.13+row*.008]);
    for(let seat=0;seat<25;seat++)box(-9.1+seat*.76,y,z,.62,.2,.4,(seat+row)%4?[.12+row*.006,.28+row*.009,.23+row*.006]:[.72,.79,.65]);
  }
  // Sponsor fascia lines the far baseline without consuming the courtside apron.
  box(0,2.3,-16.6,18,.22,.3,[.15,.31,.25]);box(0,3.7,-17,22,.18,.3,[.11,.23,.2]);
  for(let x=-8;x<=8;x+=4)box(x,6.5,-17,.15,.15,.15,[.85,.95,.8]);
}
 function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0])}
 function lookAt(eye,center,up){const norm=v=>{let l=Math.hypot(...v)||1;return v.map(x=>x/l)},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],sub=(a,b)=>a.map((x,i)=>x-b[i]);let z=norm(sub(eye,center)),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-x[0]*eye[0]-x[1]*eye[1]-x[2]*eye[2],-y[0]*eye[0]-y[1]*eye[1]-y[2]*eye[2],-z[0]*eye[0]-z[1]*eye[1]-z[2]*eye[2],1])}
 // The static court is uploaded once; only players, ball, trail and bounce mark are rebuilt per frame.
 addCourt();const courtBuf=gl.createBuffer(),courtCount=verts.length/9;gl.bindBuffer(gl.ARRAY_BUFFER,courtBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);verts.length=0;
 function bindDraw(buf,count){gl.bindBuffer(gl.ARRAY_BUFFER,buf);const st=36;gl.enableVertexAttribArray(loc.p);gl.vertexAttribPointer(loc.p,3,gl.FLOAT,false,st,0);gl.enableVertexAttribArray(loc.n);gl.vertexAttribPointer(loc.n,3,gl.FLOAT,false,st,12);gl.enableVertexAttribArray(loc.c);gl.vertexAttribPointer(loc.c,3,gl.FLOAT,false,st,24);gl.drawArrays(gl.TRIANGLES,0,count)}
 // state: { time, ball:{x,y,z,visible}, trail:[{x,y,z}], mark:{x,z,out}, player/opponent:{x,z,run,swing} } — all in metres.
 return function(state){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;const dpr=devicePixelRatio||1;if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);verts.length=0;
  const T=state.time||0,P=state.player,O=state.opponent,B=state.ball;
  player(P.x,P.z,1.06,[.12,.31,.79],[.12,.16,.3],{skin:[.72,.49,.35],hair:[.065,.045,.032],run:P.run,swing:P.swing,time:T,far:false});
  player(O.x,O.z,1.06,[.76,.12,.09],[.32,.34,.29],{skin:[.88,.7,.54],hair:[.17,.1,.055],run:O.run,swing:O.swing,time:T,far:true});
  if(B.visible){const R=.11; // drawn ~3x real size so it reads at broadcast distance
   const sh=Math.max(.35,1-B.y/5);sphere(B.x,.05,B.z,.13*sh,.006,.13*sh,[.03,.07,.055],6,10);
   const tr=state.trail||[];tr.forEach((p,i)=>{const k=(i+1)/(tr.length+1),r=R*.6*k;sphere(p.x,Math.max(R,p.y),p.z,r,r,r,[.25+.5*k,.4+.55*k,.15+.12*k],5,7)});
   sphere(B.x,Math.max(R,B.y),B.z,R,R,R,[.83,1,.31],10,14)}
  if(state.mark){const m=state.mark;sphere(m.x,.052,m.z,.17,.006,.12,m.out?[1,.52,.36]:[.86,1,.42],6,12)}
  gl.uniformMatrix4fv(loc.proj,false,perspective(Math.PI/3.4,w/h,.1,90));gl.uniformMatrix4fv(loc.view,false,lookAt([P.x*.22,7.3,33.2],[P.x*.12,1.35,12.35],[0,1,0]));
  bindDraw(courtBuf,courtCount);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.DYNAMIC_DRAW);bindDraw(buffer,verts.length/9);
 }
};
