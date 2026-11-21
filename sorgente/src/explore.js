import {Vector3, MathUtils} from 'three';

// Itinerario dimostrativo nello stesso modello. Le quote del passaggio dipendono dalla gradinata.
export function createVisit(st,openBooking){
  const $=s=>document.querySelector(s);
  const range=$('#visitProgress'),play=$('#visitPlay'),canvas=$('#gl');
  const v=(x,y,z)=>new Vector3(x,y,z);
  const e=st.rampEnd,h=st.rampRise;
  const waypoints=[
    [0, v(-44,152,451),v(0,10,5),30],
    [.14,v(29,74,309),v(-3,12,15),50],
    [.30,v(2,12,161),v(0,14,64),61],
    [.43,v(0,1.74,124),v(0,3,89),68],
    [.54,v(0,1.83,112),v(0,h+1.0,e),69],
    [.70,v(0,h+1.7,e),v(0,h+.8,e-14),68],
    [.81,v(0,h+1.70,e-2.0),v(0,4,0),68],
    [1,v(0,h+1.70,e-2.0),v(-16,3,-10),59]
  ];
  const chapters=[['Panorama',0],['Piazzale',.43],['Ingresso',.58],['Tribuna',1]];
  let transition=null,orbitAngle=0,orbitLift=0;
  const still=window.matchMedia('(prefers-reduced-motion: reduce)');
  let position=0,playing=false,yaw=0,pitch=0,fovOffset=0,drag=null,last=0,active=false;
  const buttons=$('#visitChapters');
  for(const [name,at] of chapters){const b=document.createElement('button');b.type='button';b.textContent=name;b.addEventListener('click',()=>moveTo(at));buttons.append(b);}
  function sync(){
    range.value=Math.round(position*1000);
    const chapter=position<.30?0:position<.50?1:position<.70?2:3;
    [...buttons.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===chapter)));
    play.textContent=playing?'Pausa':'Avvia visita'; play.setAttribute('aria-pressed',String(playing));
    range.setAttribute('aria-valuetext',chapters[chapter][0]+' · '+Math.round(position*100)+'%');
  }
  function moveTo(value){
    if(still.matches){seek(value);return;}
    playing=false;transition={from:position,to:value,start:performance.now(),duration:600+5500*Math.abs(value-position),yaw,pitch};
    sync();
  }
  function seek(value){transition=null;position=MathUtils.clamp(value,0,1);playing=false;yaw=pitch=fovOffset=0;sync();}
  function enter(){active=true;last=0;orbitAngle=orbitLift=0;seek(0);st.setMode('visit');st.setRoof(.98);}
  function leave(){transition=null;active=false;playing=false;sync();}
  function frame(){
    if(!active)return;
    const now=performance.now();
    if(transition){const t=MathUtils.smootherstep(now,transition.start,transition.start+transition.duration);
      position=MathUtils.lerp(transition.from,transition.to,t);yaw=transition.yaw*(1-t);pitch=transition.pitch*(1-t);
      if(t===1)transition=null;sync();}
    if(playing){position=Math.min(1,position+Math.min(.12,(now-last)/1000)/43);
      if(position>=1)playing=false;sync();}
    last=now;
    let i=1;while(i<waypoints.length-1 && position>waypoints[i][0])i++;
    const [t0,p0,g0,f0]=waypoints[i-1],[t1,p1,g1,f1]=waypoints[i];
    const t=MathUtils.smootherstep(position,t0,t1);
    const p=st.cam.pos.lerpVectors(p0,p1,t),g=st.cam.tgt.lerpVectors(g0,g1,t);
    const weight=1-MathUtils.smoothstep(position,0,.3);
    if(weight>0 && (orbitAngle||orbitLift)){
      const dx=p.x-g.x,dz=p.z-g.z,a=Math.atan2(dx,dz)+weight*orbitAngle,r=Math.hypot(dx,dz);
      p.x=g.x+r*Math.sin(a);p.z=g.z+r*Math.cos(a);p.y+=weight*orbitLift;
    }
    const dir=g.clone().sub(p).normalize();
    const heading=Math.atan2(dir.x,dir.z)+yaw,tilt=MathUtils.clamp(Math.asin(dir.y)+pitch,-1.42,1.42);
    const camera=st.camera;camera.position.copy(p);camera.lookAt(p.x+Math.sin(heading)*Math.cos(tilt),p.y+Math.sin(tilt),p.z+Math.cos(heading)*Math.cos(tilt));
    const fov=MathUtils.clamp(MathUtils.lerp(f0,f1,t)+fovOffset+(1-MathUtils.smoothstep(position,0,.35))*Math.max(0,49*(1.30-camera.aspect)),26,86);
    if(camera.fov!==fov || camera.view?.enabled){camera.clearViewOffset();camera.fov=fov;camera.updateProjectionMatrix();}
    st.cam.fov=fov;st.cam.offX=st.cam.offY=0;
  }
  play.onclick=()=>{transition=null;if(position>=1)seek(0);playing=!playing;last=performance.now();sync();};
  range.oninput=()=>seek(Number(range.value)/1000);
  $('#visitTickets').onclick=openBooking;
  function turn(dx,dy){
    if(position<.001){orbitAngle+=dx;orbitLift=MathUtils.clamp(orbitLift-dy*145,-72,155);}
    else{yaw+=dx;pitch=MathUtils.clamp(pitch+dy,-1.2,1.2);}
  }
  canvas.addEventListener('pointerdown',event=>{if(!active)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{if(!drag || drag.id!==event.pointerId)return;turn((drag.x-event.clientX)*.004,(event.clientY-drag.y)*.004);drag.x=event.clientX;drag.y=event.clientY;});
  canvas.addEventListener('lostpointercapture',()=>drag=null);
  canvas.addEventListener('wheel',event=>{if(active){event.preventDefault();fovOffset=MathUtils.clamp(fovOffset+event.deltaY*.03,-28,24);}}, {passive:false});
  window.addEventListener('keydown',event=>{
    if(!active || /INPUT|BUTTON|SUMMARY/.test(document.activeElement.tagName))return;
    if(event.key==='ArrowLeft')turn(.08,0);else if(event.key==='ArrowRight')turn(-.08,0);
    else if(event.key==='ArrowUp')turn(0,.05);else if(event.key==='ArrowDown')turn(0,-.05);else return;
    event.preventDefault();
  });
  return {enter,leave,frame};
}
