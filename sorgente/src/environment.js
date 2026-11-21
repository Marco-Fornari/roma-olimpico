import * as T from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import site from '../assets/site.json';
import elevations from '../assets/relief.json';
import aerialUrl from '../assets/foroit-albedo.webp';
import woodUrl from '../assets/wood.webp';
import pineUrl from '../assets/pine.webp';
import concreteUrl from '../assets/concrete.webp';
import eastUrl from '../assets/facade-east.webp';
import facadeUrl from '../assets/facade.webp';
import skyUrl from '../assets/daylight.hdr';
import grassUrl from '../assets/grass.webp';

const V=(x,y,z)=>new T.Vector3(x,y,z);
const smooth=T.MathUtils.smoothstep;
const mix=T.MathUtils.lerp;
function noise(i){const v=Math.sin(1.71+i*39.186)*29563.39;return v-Math.floor(v);}
const loader=new T.TextureLoader();
function texture(url,repeat=false){
  const t=loader.load(url);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;
  if(repeat){t.wrapS=t.wrapT=T.RepeatWrapping;}
  return t;
}
export function grassTexture(){return texture(grassUrl,true);}
export function groundHeight(x,z){
  const gx=T.MathUtils.clamp((x+900)/15,0,119.9999),gz=T.MathUtils.clamp((z+900)/15,0,119.9999);
  const i=Math.floor(gx),j=Math.floor(gz),a=j*121+i;
  const h=mix(mix(elevations[a],elevations[a+1],gx-i),mix(elevations[a+121],elevations[a+122],gx-i),gz-j);
  const west=smooth(-z,133,267),outside=smooth(Math.abs(x),170,310);
  return Math.max(-3, h-elevations[60*121+60])*Math.max(west,outside,smooth(z,325,450))-.16;
}
// Distanza dal centro alla sagoma rilevata dalla cartografia per ogni azimut.
function radii(loop){
  return Array.from({length:720},(_,i)=>{
    const a=i*Math.PI/360,dx=Math.cos(a),dz=Math.sin(a);
    let nearest=Infinity;
    for(let j=1;j<loop.length;j++){
      const [ax,az]=loop[j-1],[bx,bz]=loop[j],vx=bx-ax,vz=bz-az,den=dx*vz-dz*vx;
      if(Math.abs(den)<1e-8)continue;
      const l=(ax*vz-az*vx)/den,k=(ax*dz-az*dx)/den;
      if(l>0 && k>=0 && k<=1)nearest=Math.min(nearest,l);
    }
    if(!Number.isFinite(nearest))throw Error('Contorno cartografico aperto');
    return nearest;
  });
}
const outer=radii(site.rim);
export function measuredRadius(x,z){
  const t=((Math.atan2(z,x)*360/Math.PI)%720+720)%720,i=Math.floor(t);
  return mix(outer[i],outer[(i+1)%720],t-i);
}
function instanceSet(geometry,material){
  const matrices=[],colors=[],m=new T.Matrix4(),q=new T.Quaternion(),scale=new T.Vector3(),e=new T.Euler(),center=new T.Vector3(),up=V(0,1,0);
  const push=(p,rot,s,color)=>{matrices.push(m.compose(p,rot,s).clone());if(color!==undefined)colors.push(new T.Color(color));};
  return {
    add(x,y,z,sx,sy,sz,ry=0,rz=0,color){push(center.set(x,y,z),q.setFromEuler(e.set(0,ry,rz,'YXZ')),scale.set(sx,sy,sz),color);},
    span(a,b,r,depth=r,color){const axis=b.clone().sub(a);const len=axis.length();if(!len)return;push(center.copy(a).lerp(b,.5),q.setFromUnitVectors(up,axis.normalize()),scale.set(r,len,depth),color);},
    finish(parent,shadow=true){
      if(!matrices.length)return;
      const mesh=new T.InstancedMesh(geometry,material,matrices.length);
      matrices.forEach((v,i)=>mesh.setMatrixAt(i,v));colors.forEach((c,i)=>mesh.setColorAt(i,c));
      mesh.castShadow=shadow;mesh.receiveShadow=true;parent.add(mesh);return mesh;
    }
  };
}
function mesh(geo,mat,parent,shadow=false){const m=new T.Mesh(geo,mat);m.receiveShadow=true;m.castShadow=shadow;parent.add(m);return m;}
function geoSurface(pos,uv,idx){
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  if(uv.length)geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return geo;
}
const standard=(color,roughness=.82,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
const tubeGeo=(top=1,bottom=1,sides=8)=>new T.CylinderGeometry(top,bottom,1,sides);
function makeGround(scene){
  const g=new T.PlaneGeometry(1800,1800,120,120).rotateX(-Math.PI/2),p=g.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,groundHeight(p.getX(i),p.getZ(i)));
  g.computeVertexNormals();
  const mat=standard('#c3c6be');mat.map=texture(aerialUrl);
  mesh(g,mat,scene);
}
function marmi(scene){
  const outerCurve=new T.CatmullRomCurve3(site.marmiOuter.slice(0,-1).map(p=>V(p[0],0,p[1])),true);
  const base=outerCurve.getSpacedPoints(220),pos=[],idx=[],uv=[];
  const center=base.reduce((c,p)=>c.add(p),V(0,0,0)).multiplyScalar(1/base.length);
  function band(scale,y){for(const v of base){const p=v.clone().sub(center).multiplyScalar(scale).add(center);pos.push(p.x,y,p.z);}}
  const marble=standard('#dddcd6',.64);marble.side=T.DoubleSide;
  for(let i=0;i<9;i++){
    const s=1+.009*i,at=i*2*base.length;band(s,.16+i*.34);band(s+.009,.16+i*.34);
    for(let j=0;j<base.length-1;j++){const a=at+j,b=a+base.length;idx.push(a,b,a+1,b,b+1,a+1);
      if(i){const c=a-base.length;idx.push(c,a,c+1,c+1,a,a+1);}}
  }
  mesh(geoSurface(pos,uv,idx),marble,scene,true);
  const innerCurve=new T.CatmullRomCurve3(site.marmiInner.slice(0,-1).map(p=>V(p[0],.09,p[1])),true);
  const inside=innerCurve.getSpacedPoints(220),nr=inside.length;
  const grassShape=new T.Shape(inside.slice(0,-1).map(p=>new T.Vector2(p.x,-p.z)));
  const turfMat=standard('#83975b');turfMat.map=grassTexture();turfMat.map.repeat.set(.085,.085);
  const turf=mesh(new T.ShapeGeometry(grassShape).rotateX(-Math.PI/2),turfMat,scene);turf.position.y=.05;
  const laneLines=[];
  for(let i=0;i<nr-1;i++){
    const a=inside[i],b=inside[i+1],dir=b.clone().sub(a).normalize();
    let nx=-dir.z,nz=dir.x;if(nx*(a.x-center.x)+nz*(a.z-center.z)<0){nx=-nx;nz=-nz;}
    for(let k=0;k<=4;k++){laneLines.push(a.x+nx*k*1.22,.12,a.z+nz*k*1.22,b.x+nx*k*1.22,.12,b.z+nz*k*1.22);}
  }
  const lineG=new T.BufferGeometry();lineG.setAttribute('position',new T.Float32BufferAttribute(laneLines,3));scene.add(new T.LineSegments(lineG,new T.LineBasicMaterial({color:'#e0d9c8',transparent:true,opacity:.72})));
  const stone=instanceSet(new T.BoxGeometry(1,1,1),marble);
  const body=instanceSet(new T.SphereGeometry(1,9,7),marble);
  const limbs=instanceSet(tubeGeo(.92,1,7),marble);
  for(const [i,[x,z]] of site.statues.entries()){
    const y=3.1,heading=Math.atan2(center.x-x,center.z-z);
    const at=(a,b,c)=>V(x+a*Math.cos(heading)+c*Math.sin(heading),y+b,z-a*Math.sin(heading)+c*Math.cos(heading));
    stone.add(x,y+.48,z,1.35,.96,1.35,heading);
    body.add(x,y+2.9,z,.43,.69,.27,heading);body.add(x,y+3.78,z,.235,.30,.22,heading);
    for(const sign of [-1,1]){
      const knee=at(sign*.21,1.59,sign*.10);limbs.span(at(sign*.21,2.37,0),knee,.18);limbs.span(knee,at(sign*.26,.96,-sign*.09),.13);
      const elbow=at(sign*.52,2.69+.24*noise(i),.06);limbs.span(at(sign*.35,3.35,0),elbow,.13);
      limbs.span(elbow,at(sign*(.32+.32*noise(i+1)),2.4+.65*noise(i+4),.13),.105);
    }
  }
  stone.finish(scene);body.finish(scene);limbs.finish(scene);
}
function vegetation(scene,low){
  const bark=standard('#776451');const trunks=instanceSet(tubeGeo(.76,1,7),bark);
  const foliage=new T.MeshLambertMaterial({map:texture(pineUrl),side:T.DoubleSide,alphaTest:.40,color:'#faf7df'});
  const crowns=instanceSet(new T.PlaneGeometry(1,1),foliage);
  const woody=new T.MeshLambertMaterial({map:texture(woodUrl),alphaTest:.43,color:'#d4d3bc',side:T.DoubleSide});
  const broad=instanceSet(new T.PlaneGeometry(1,1),woody);
  const pine=(x,z,i)=>{
    const y=groundHeight(x,z),h=12+6.7*noise(i+2),r=h*.35;
    const t=V(x+.4*noise(i),y+h*.73,z+.35);trunks.span(V(x,y,z),t,.26);
    for(let j=0;j<8;j++){
      const a=j*2.4+i,dist=r*Math.sqrt((j+.4)/8),cx=x+Math.cos(a)*dist,cz=z+Math.sin(a)*dist,cy=y+h-1.9*dist/r;
      trunks.span(t,V(cx,cy-.45,cz),.11);
      for(let k=0;k<3;k++)crowns.add(cx,cy,cz,r*1.43,r*.63,r,Math.PI*k/3+a,.10*Math.sin(j));
    }
  };
  site.trees.forEach(([x,z],i)=>pine(x,z,i));
  site.treeRows.forEach((row,id)=>{
    for(let i=1;i<row.length;i++){const [x,z]=row[i-1],[ex,ez]=row[i],n=Math.floor(Math.hypot(ex-x,ez-z)/10);
      for(let j=0;j<n;j++){const px=mix(x,ex,(j+.5)/n),pz=mix(z,ez,(j+.5)/n);
        if(!site.trees.some(([tx,tz])=>Math.hypot(tx-px,tz-pz)<5))pine(px,pz,id*300+i*17+j);}}
  });
  site.woodCrowns.forEach(([x,z],i)=>{
    if(low && i%2)return;
    const y=groundHeight(x,z),h=6+noise(i)*7,r=h*.54;
    for(let k=0;k<3;k++)broad.add(x,y+h*.62,z,2.7*r,h,1,i*.31+k*Math.PI/3,.1*Math.sin(i));
    if(Math.abs(x)<230 && Math.abs(z)<335)trunks.span(V(x,y,z),V(x+.3,y+h*.7,z),.23);
  });
  trunks.finish(scene);crowns.finish(scene);broad.finish(scene);
}
function buildings(scene){
  const mat=standard('#cdc5af');const geo=[];
  for(const [points,h] of site.buildings){
    const shape=new T.Shape(points.slice(0,-1).map(([x,z])=>new T.Vector2(x,-z)));
    const g=new T.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false}).rotateX(-Math.PI/2);
    g.translate(0,groundHeight(...points[0]),0);geo.push(g);
  }
  // I volumi di sfondo hanno impronte cartografate. I fronti non documentati restano semplici.
  const positions=[];for(const g of geo){for(const val of g.attributes.position.array)positions.push(val);g.dispose();}
  const group=new T.BufferGeometry();group.setAttribute('position',new T.Float32BufferAttribute(positions,3));group.computeVertexNormals();mesh(group,mat,scene,true);
}
// Paesaggio cartografato (OSM, ortofoto AGEA, rilievo SRTM): incluso nel file, funziona offline.
export function buildTerrain(scene,low){
  const group=new T.Group();group.name='Paesaggio OSM';
  makeGround(group);marmi(group);vegetation(group,low);buildings(group);
  const marble=standard('#dcdad1',.47);
  const fountain=mesh(new T.SphereGeometry(1.5,32,20),marble,group,true);fountain.position.set(-170.5,2.24,121.5);
  const base=mesh(new T.CylinderGeometry(2,2.8,.9,40),marble,group,true);base.position.set(-170.5,.4,121.5);
  scene.add(group);return group;
}
// Piazzale attorno allo stadio quando il contesto arriva dalle 3D Tiles di Google:
// copre la fascia dove le tile sono spianate sotto il modello ricostruito.
export function buildPlaza(scene,margin){
  const pts=Array.from({length:180},(_,i)=>{const a=i/180*Math.PI*2,r=measuredRadius(Math.cos(a),Math.sin(a))*1.03+margin;return new T.Vector2(Math.cos(a)*r,-Math.sin(a)*r);});
  const mat=standard('#b3b0a7',.95);
  const plaza=mesh(new T.ShapeGeometry(new T.Shape(pts)).rotateX(-Math.PI/2),mat,scene);plaza.position.y=-.08;plaza.name='Piazzale';
  return plaza;
}
export function buildLandscape(scene,renderer,low,terrain=true){
  if(terrain)buildTerrain(scene,low);
  const hemi=new T.HemisphereLight('#d8e8fc','#8d8779',.82);scene.add(hemi);
  const sun=new T.DirectionalLight('#fff1d9',2.2);sun.position.set(-168,218,142);scene.add(sun);
  sun.castShadow=true;const sc=sun.shadow.camera;
  sc.left=sc.bottom=-226;sc.right=sc.top=226;sc.near=12;sc.far=730;sun.shadow.bias=-.00033;sun.shadow.normalBias=.11;
  sun.shadow.mapSize.setScalar(low?1024:2048);sc.updateProjectionMatrix();
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false, uniforms:{sun:{value:sun.position.clone().normalize()}},
    vertexShader:'varying vec3 world;void main(){world=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 world;uniform vec3 sun;void main(){vec3 d=normalize(world);float h=max(0.,d.y);vec3 c=mix(vec3(.78,.86,.90),vec3(.18,.42,.70),pow(h,.55));float mu=max(0.,dot(d,sun));c+=vec3(1.,.82,.59)*(.16*pow(mu,16.)+3.*smoothstep(.9994,.99987,mu));gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`});
  const sky=new T.Mesh(new T.SphereGeometry(2300,36,16),skyMat);sky.renderOrder=-10;scene.add(sky);
  const hdr=new RGBELoader().load(skyUrl,()=>{hdr.mapping=T.EquirectangularReflectionMapping;scene.environment=hdr;scene.environmentIntensity=.24;});
}

export function buildArchitecture(scene,G,pt){
  const roofGroup=new T.Group();scene.add(roofGroup);
  const white=standard('#dedfdc',.54,.36),shell=standard('#dcdcd4',.83,.025);
  shell.side=T.DoubleSide;shell.vertexColors=true;
  const steel=instanceSet(tubeGeo(1,1,7),white),wire=instanceSet(tubeGeo(1,1,5),standard('#a6aba8',.5,.58));
  const posts=instanceSet(tubeGeo(1,1,14),standard('#c4c9c8',.7,.12));
  const walls=instanceSet(new T.BoxGeometry(1,1,1),standard('#bab9ae'));
  const glassMat=standard('#56717b',.23,.48),glass=instanceSet(new T.BoxGeometry(1,1,1),glassMat);
  const slabs=instanceSet(new T.BoxGeometry(1,1,1),standard('#8b8e8b'));
  const lamp=instanceSet(new T.BoxGeometry(1,1,1),standard('#d7dddd',.40));
  const facadeMat=standard('#ffffff',.68,.18);facadeMat.map=texture(facadeUrl);
  const facade=instanceSet(new T.BoxGeometry(1,1,1),facadeMat);
  // Parametrizzazione a lunghezza d'arco per ripartire le 88 campate sull'intero contorno.
  const ring=new T.CatmullRomCurve3(site.rim.slice(0,-1).map(([x,z])=>V(x,0,z)),true);
  function edge(v){return ring.getPointAt((v%1+1)%1);}
  function point(v,t,y){const p=edge(v),l=Math.hypot(p.x,p.z);
    // Apertura longitudinale della copertura: sagoma misurata dell'anello interno.
    const k=innerRoofRadius(p.x,p.z)/l;
    return V(p.x*mix(k,1,t),y,p.z*mix(k,1,t));}
  const pos=[],idx=[],uv=[],fabric=[];
  const height=(t,along)=>25.7+1.1*t+1.65*Math.sin(t*Math.PI)-2.2*Math.sin(along*Math.PI)**2 + .46*Math.sin(t*Math.PI*7+.28)*Math.sin(Math.PI*along);
  const N=88,na=8,nr=25;
  for(let i=0;i<N;i++){
    const v=i/N,w=(i+1)/N,base=pos.length/3;
    for(let j=0;j<=na;j++)for(let k=0;k<=nr;k++){
      const t=k/nr,a=j/na,p=point((i+a)/N,t,height(t,a));pos.push(...p.toArray());uv.push((i+a)/N,t);
      const shade=.91+.08*Math.cos(a*Math.PI*2)-.14*Math.sin(t*Math.PI*7+.28)*Math.sin(Math.PI*a);fabric.push(shade,shade,shade*.99);
      if(k&&j){const b=base+j*(nr+1)+k;idx.push(b-nr-2,b-1,b,b-nr-2,b,b-nr-1);}
    }
    const outerA=point(v,1,27.1),outerB=point(w,1,27.1),outerTop=point((i+.5)/N,1.001,35.8);
    steel.span(outerA,outerB,.36);steel.span(outerA,outerTop,.27);steel.span(outerB,outerTop,.27);
    steel.span(outerTop,point((i+1.5)/N,1.001,35.8),.48);
    const innerA=point(v,0,25.6),innerB=point(w,0,25.6);steel.span(innerA,innerB,.23);
    for(let k=0;k<7;k++){
      const a=k/7,b=(k+1)/7;wire.span(point(v,a,height(a,0)+.09),point(v,b,height(b,0)+.09),.075);
      const y=25.9+9.1*a*a;
      if(k>0)wire.span(point(v,a,height(a,0)+.05),point(v,a,y),.045);
      wire.span(point(v,a,y),point(v,b,25.9+9.1*b*b),.095);
    }
    lamp.add(innerA.x,25.1,innerA.z,1.35,.42,.7,Math.atan2(innerA.x,innerA.z));

    const theta=Math.atan2(outerB.z-outerA.z,outerB.x-outerA.x),mid=outerA.clone().lerp(outerB,.5),width=outerA.distanceTo(outerB);
    // Portico aperto al suolo, fasce finestrate e aggetti della facciata.
    const side=mid.z>0 && Math.abs(mid.x)<91;
    slabs.add(mid.x*.975,7.8,mid.z*.975,width+1,1.15,4.9,-theta);
    slabs.add(mid.x*.979,15.2,mid.z*.979,width+1,.55,3.4,-theta);
    slabs.add(mid.x*.982,22.6,mid.z*.982,width+1,1.0,4.8,-theta);
    if(side){facade.add(mid.x*.984,12,mid.z*.984,width,7.5,1,-theta);}
    else{glass.add(mid.x*.973,12.1,mid.z*.973,width,7.4,1,-theta);}
    walls.add(outerA.x*.980,14.55,outerA.z*.980,.64,17.2,.84,-theta);
    for(const y of [10.5,13.8,18.7,21])slabs.add(mid.x*.984,y,mid.z*.984,width,.24,.6,-theta);
    glass.add(mid.x*.97,19,mid.z*.97,width,5.4,.7,-theta);
  }
  const fabricGeo=geoSurface(pos,uv,idx);fabricGeo.setAttribute("color",new T.Float32BufferAttribute(fabric,3));
  // Tamponamento fotografico della sola facciata visibile nella vista di riferimento.
  const eastPos=[],eastUV=[],eastIx=[];
  for(let i=0;i<=90;i++){
    const a=mix(.21,Math.PI-.21,i/90),cx=Math.cos(a),cz=Math.sin(a),r=measuredRadius(cx,cz)*.988;
    const x=cx*r,z=cz*r;
    eastPos.push(x,4.9,z,x,24.4,z);const u=.5+x/301;eastUV.push(u,0,u,1);
    if(i){const j=i*2;eastIx.push(j-2,j-1,j+1,j-2,j+1,j);}
  }
  const front=standard('#e6e9e5',.84,.08);front.map=texture(eastUrl);front.side=T.DoubleSide;
  mesh(geoSurface(eastPos,eastUV,eastIx),front,scene,true);
  const canopy=mesh(fabricGeo,shell,roofGroup,true);canopy.name='Membrana a 88 campate';
  steel.finish(roofGroup);wire.finish(roofGroup,false);lamp.finish(roofGroup,false);
  const tower=instanceSet(tubeGeo(1,1,20),standard('#a5a9a6'));
  const glazing=instanceSet(tubeGeo(1,1,20),standard('#344850',.30,.3));
  for(const [x,z] of [[36,115.5],[91.5,98.5],[130,69],[152.5,20.5],[152.5,-20.5],[130,-69],[91.5,-98.5],[36,-115.5],[-36,-115.5],[-92,-98.5],[-130,-69],[-152.5,-20.5],[-152.5,20.5],[-130,69],[-92,98.5],[-36,115.5]]){
    posts.span(V(x,0,z),V(x,28.4,z),.92);
    if(Math.abs(Math.abs(x)-92)<1){
      for(let level=0;level<4;level++){const y=2.65+level*5.3;
        glazing.add(x*.99,y,z*.99,3.35,4.8,3.35);
        tower.add(x*.99,y+2.1,z*.99,3.7,1.05,3.7);}
    }
  }
  const pressZ=pt(G.R0+G.DEPTH+1,.5).z;
  slabs.add(0,G.TOP+1.65,pressZ,53,.40,5.8);
  slabs.add(0,G.TOP+4.35,pressZ,53,.55,6.1);
  glass.add(0,G.TOP+3.1,pressZ+1.7,52,2.4,.24);
  for(let x=-25;x<=25;x+=2.5)walls.add(x,G.TOP+3.06,pressZ+1.97,.095,2.56,.14);
  for(const x of [-1,1]){
    const dz=pt(G.R0+G.DEPTH+2,x<0?1.5:3.5).x;
    const display=standard('#232e31',.42,.18);
    const screen=mesh(new T.BoxGeometry(.78,4.1,10.6),display,scene,true);screen.position.set(dz,G.TOP+2.95,0);
  }
  tower.finish(scene);glazing.finish(scene);posts.finish(scene);facade.finish(scene);slabs.finish(scene);glass.finish(scene);walls.finish(scene);
  const cement=standard('#bbbdb9');cement.map=texture(concreteUrl,true);cement.map.repeat.set(2,1);cement.side=T.DoubleSide;
  const rampEnd=pt(G.R0+G.RD*16,2.5).z,rampRise=G.BASE+G.RISE*16+.1;
  const profile=[[122,.09],[112,.09],[rampEnd,rampRise],[rampEnd-4,rampRise]];
  const rampPos=[],rampUv=[],rampIx=[];
  function quad(a,b,c,d){
    const i=rampPos.length/3;rampPos.push(...a,...b,...c,...d);const length=(p,q)=>Math.hypot(...p.map((v,i)=>v-q[i]));
    const u=length(a,b)/2.8,v=length(b,c)/2.8;rampUv.push(0,0,u,0,u,v,0,v);rampIx.push(i,i+1,i+2,i,i+2,i+3);
  }
  const lights=instanceSet(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial({color:'#fff2c9'}));
  for(let i=1;i<profile.length;i++){
    const [za,ya]=profile[i-1],[zb,yb]=profile[i];quad([-2.3,ya,za],[2.3,ya,za],[2.3,yb,zb],[-2.3,yb,zb]);
    if(i===2){
      for(const x of [-2.35,2.35])quad([x,ya,za],[x,ya+3.1,za],[x,yb+3.1,zb],[x,yb,zb]);
      quad([-2.35,ya+3.12,za],[2.35,ya+3.12,za],[2.35,yb+3.12,zb],[-2.35,yb+3.12,zb]);
      for(let k=0;k<7;k++){const f=(k+.5)/7;lights.add(0,mix(ya,yb,f)+3.07,mix(za,zb,f),1.4,.045,.16);}
    }
  }
  mesh(geoSurface(rampPos,rampUv,rampIx),cement,scene,true);lights.finish(scene,false);
  const rail=instanceSet(tubeGeo(1,1,8),standard('#919798',.46,.55));
  for(const x of [-2.09,2.09]){
    rail.span(V(x,1.14,112),V(x,rampRise+1.06,rampEnd),.044);
    for(let k=0;k<=10;k++){const f=k/10,z=mix(112,rampEnd,f),y=mix(.09,rampRise,f);rail.span(V(x,y,z),V(x,y+1.06,z),.036);}
  }
  rail.finish(scene);
  return {roofGroup,rampEnd,rampRise};
}
const inner=radii(site.inner);
function innerRoofRadius(x,z){const p=((Math.atan2(z,x)*360/Math.PI)%720+720)%720,i=Math.floor(p);return mix(inner[i],inner[(i+1)%720],p-i);}
