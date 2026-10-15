/* Small self-contained WebGL tennis scene. */
window.createTennisScene=function(canvas){
 const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
 if(!gl){const c=canvas.getContext('2d');return state=>{let w=canvas.width=canvas.clientWidth*(devicePixelRatio||1),h=canvas.height=canvas.clientHeight*(devicePixelRatio||1);c.setTransform(devicePixelRatio||1,0,0,devicePixelRatio||1,0,0);c.fillStyle='#245340';c.fillRect(0,0,w,h);c.fillStyle='#648754';c.beginPath();c.moveTo(w*.2,h*.12);c.lineTo(w*.8,h*.12);c.lineTo(w*.97,h*.98);c.lineTo(w*.03,h*.98);c.fill();c.strokeStyle='#f0f0d9';c.lineWidth=2;c.strokeRect(w*.2,h*.12,w*.6,h*.86);c.beginPath();c.moveTo(w*.2,h*.55);c.lineTo(w*.8,h*.55);c.stroke();c.fillStyle='#d5ff55';c.beginPath();c.arc(w*(.08+state.ball.x*.84),h*(.13+state.ball.y*.78),6,0,7);c.fill()}};
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
 function racket(x,y,z,scale){const r=.43*scale;const color=[.83,.88,.72],segments=24;for(let i=0;i<segments;i++){const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments;const p=V(x+r*Math.cos(a),y+r*1.32*Math.sin(a),z),q=V(x+r*Math.cos(b),y+r*1.32*Math.sin(b),z);tube(p,q,.018*scale,color,8)}tube(V(x,y-r*1.27,z),V(x-.04*scale,y-.78*scale,z),.06*scale,[.69,.4,.19],6);for(let j=1;j<8;j++){let yy=y-r*1.15+j*r*.31;box(x,yy,z-.009,r*1.55,.009,.008,[.76,.83,.68])}for(let j=-3;j<=3;j++){let xx=x+j*r*.34;box(xx,y,z-.01,.009,r*2.25,.008,[.76,.83,.68])}}
 function player(x,z,scale,shirt,shorts,pose,skin=[.66,.43,.3],hair=[.08,.065,.05],facing=-1){const S=scale,lean=pose||0,move=Math.min(1,Math.abs(lean)*2.8),phase=performance.now()/150,step=Math.sin(phase)*.17*S*move,bob=Math.abs(Math.sin(phase))*.035*S*move;const headY=1.53*S+bob,neckTop=1.34*S+bob,neckBase=1.18*S+bob,shoulderY=1.12*S+bob,hipY=.78*S+bob;
 const shoulderL=V(x-.205*S,shoulderY,z),shoulderR=V(x+.205*S,shoulderY,z),elbowL=V(x-.34*S,.86*S+step*.22,z-.02*S),elbowR=V(x+.37*S,.82*S-step*.22,z-.11*S),handL=V(x-.27*S,.57*S+step*.55,z-.08*S),handR=V(x+.52*S,.47*S-step*.55,z-.28*S);
 const hipL=V(x-.1*S,hipY,z),hipR=V(x+.1*S,hipY,z),kneeL=V(x-.15*S,.39*S-step,z),kneeR=V(x+.15*S,.39*S+step,z),ankleL=V(x-.2*S,.1*S,z-.035*S),ankleR=V(x+.2*S,.1*S,z-.035*S),sole=[.055,.075,.07],shoe=[.87,.89,.79];
 // Subtle contact shadow, articulated legs, tennis socks, and shaped shoes.
 sphere(x,.085*S,z,.39*S,.045*S,.3*S,[.025,.055,.044],10,16);
 tube(hipL,kneeL,.095*S,skin,16);sphere(kneeL[0],kneeL[1],kneeL[2],.088*S,.09*S,.086*S,skin);
 tube(kneeL,ankleL,.064*S,skin,14);tube(V(ankleL[0],ankleL[1]+.12*S,ankleL[2]),ankleL,.075*S,[.91,.91,.8],14);
 tube(hipR,kneeR,.095*S,skin,16);sphere(kneeR[0],kneeR[1],kneeR[2],.088*S,.09*S,.086*S,skin);
 tube(kneeR,ankleR,.064*S,skin,14);tube(V(ankleR[0],ankleR[1]+.12*S,ankleR[2]),ankleR,.075*S,[.91,.91,.8],14);
 sphere(x-.2*S,.095*S,z-.13*S,.19*S,.09*S,.31*S,shoe,12,18);sphere(x+.2*S,.095*S,z-.13*S,.19*S,.09*S,.31*S,shoe,12,18);
 tube(V(x-.2*S,.035*S,z-.16*S),V(x-.2*S,.035*S,z+.06*S),.055*S,sole,12);tube(V(x+.2*S,.035*S,z-.16*S),V(x+.2*S,.035*S,z+.06*S),.055*S,sole,12);
 for(let j=-1;j<=1;j++){box(x-.2*S+j*.035*S,.16*S,z-.25*S,.012*S,.012*S,.11*S,[.68,.69,.63]);box(x+.2*S+j*.035*S,.16*S,z-.25*S,.012*S,.012*S,.11*S,[.68,.69,.63])}
 // Tailored shorts and a fitted technical jersey, modeled with smooth anatomical volumes.
 sphere(x,hipY,z,.22*S,.205*S,.17*S,shorts,17,24);sphere(x,.88*S+bob,z,.235*S,.34*S,.16*S,shirt,20,28);sphere(x,1.08*S+bob,z,.25*S,.19*S,.165*S,shirt,17,25);
 tube(V(x-.15*S,.85*S,z-.005*S),V(x-.205*S,.61*S,z-.012*S),.012*S,[.92,.92,.82],8);tube(V(x+.15*S,.85*S,z-.005*S),V(x+.205*S,.61*S,z-.012*S),.012*S,[.92,.92,.82],8);
 tube(V(x-.07*S,neckBase,z),V(x+.07*S,neckBase,z),.065*S,skin,14);tube(V(x,1.1*S+bob,z),V(x,1.16*S+bob,z),.15*S,shirt,16);tube(V(x-.11*S,1.13*S+bob,z-facing*.01),V(x+.11*S,1.13*S+bob,z-facing*.01),.012*S,[.91,.93,.82],12);
 // Shoulder caps, sleeves, forearms, articulated elbows and wrist bands.
 for(const side of [-1,1]){const sh=side<0?shoulderL:shoulderR,el=side<0?elbowL:elbowR,hand=side<0?handL:handR;sphere(sh[0],sh[1],sh[2],.105*S,.12*S,.13*S,shirt,14,18);tube(sh,el,.079*S,shirt,14);sphere(el[0],el[1],el[2],.064*S,.068*S,.065*S,skin,12,16);tube(el,hand,.048*S,skin,13);sphere(hand[0],hand[1],hand[2],.057*S,.055*S,.06*S,skin,12,16);tube(V(hand[0],hand[1]+.055*S,hand[2]),V(hand[0],hand[1]+.09*S,hand[2]),.055*S,[.91,.91,.79],12)}
 // Neck, ears, face planes and hair make the head read as a person at match scale.
 tube(V(x,neckBase,z),V(x,neckTop,z),.065*S,skin,14);sphere(x,headY,z,.098*S,.13*S,.1*S,skin,20,28);sphere(x,headY+.075*S,z+facing*.005*S,.103*S,.052*S,.105*S,hair,16,22);
 // Smaller head and clean jaw proportions keep the model close to adult anatomy.
 for(const side of [-1,1]){sphere(x+side*.099*S,headY+.012*S,z,.024*S,.05*S,.032*S,hair,12,16);sphere(x+side*.099*S,headY-.015*S,z,.018*S,.032*S,.021*S,skin,12,16)}
 const faceZ=z+facing*.086*S;for(const side of [-1,1]){sphere(x+side*.034*S,headY+.018*S,faceZ,.012*S,.01*S,.01*S,[.055,.045,.038],10,12);sphere(x+side*.034*S,headY+.02*S,faceZ+facing*.006*S,.0045*S,.005*S,.0045*S,[.93,.91,.78],8,10)}
 sphere(x,headY-.012*S,z+facing*.108*S,.015*S,.019*S,.018*S,skin,12,16);tube(V(x-.022*S,headY-.055*S,faceZ),V(x+.022*S,headY-.055*S,faceZ),.0055*S,[.31,.12,.1],7);
 // A restrained headband, wrist bands, and jersey trim read as tennis kit.
 tube(V(x-.091*S,headY+.073*S,z),V(x+.091*S,headY+.073*S,z),.014*S,[.89,.92,.81],14);
 const racketY=.69*S, racketX=x+.71*S, racketZ=z-.37*S; tube(V(handR[0],handR[1],handR[2]),V(racketX,racketY-.5*S,racketZ),.043*S,skin,12);racket(racketX,racketY,racketZ,S);
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
 addCourt();const courtMesh=verts.slice();
 return function(state){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;if(canvas.width!==Math.round(w*devicePixelRatio)||canvas.height!==Math.round(h*devicePixelRatio)){canvas.width=Math.round(w*devicePixelRatio);canvas.height=Math.round(h*devicePixelRatio)}gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);verts.length=courtMesh.length;for(let i=0;i<courtMesh.length;i++)verts[i]=courtMesh[i];
  // The court is retained in a compact cache; append animated models each frame.
  const playerX=(state.player.x-.5)*9.0,opX=(state.opponent.x-.5)*7.6,bx=(state.ball.x-.5)*10.3,bz=.48+state.ball.y*23.77,bh=.17+Math.sin(Math.max(0,Math.min(1,(state.ball.y-.16)/.72))*Math.PI)*1.6;
  sphere(playerX,.15,12.25,.65,.055,.55,[.045,.095,.075],8,12);sphere(opX,.12,1.65,.46,.045,.39,[.04,.085,.075],8,12);
  player(playerX,23.2,1.06,[.12,.31,.79],[.12,.16,.3],(state.player.tx-state.player.x)*2.2,[.72,.49,.35],[.065,.045,.032],-1);player(opX,1.25,1.06,[.76,.12,.09],[.32,.34,.29],0,[.88,.7,.54],[.17,.1,.055],1);
  sphere(bx,bh,bz,.15,.15,.15,[.83,1,.31],10,14);tube(V(bx-.43,bh+.12,bz+.38),V(bx-.17,bh+.04,bz+.15),.035,[.79,.96,.36],6);tube(V(bx-.17,bh+.04,bz+.15),V(bx,bh,bz),.025,[.79,.96,.36],6);
  const data=new Float32Array(verts);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);const stride=9*4;gl.enableVertexAttribArray(loc.p);gl.vertexAttribPointer(loc.p,3,gl.FLOAT,false,stride,0);gl.enableVertexAttribArray(loc.n);gl.vertexAttribPointer(loc.n,3,gl.FLOAT,false,stride,12);gl.enableVertexAttribArray(loc.c);gl.vertexAttribPointer(loc.c,3,gl.FLOAT,false,stride,24);
  gl.uniformMatrix4fv(loc.proj,false,perspective(Math.PI/3.4,w/h,.1,90));gl.uniformMatrix4fv(loc.view,false,lookAt([0,7.3,33.2],[0,1.35,12.35],[0,1,0]));gl.drawArrays(gl.TRIANGLES,0,verts.length/9);
 }
};
