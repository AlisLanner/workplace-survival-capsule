export interface PrismCanvasController { setMotion:(enabled:boolean)=>void; destroy:()=>void }
export function createPrismCanvas(hero:HTMLDivElement,visual:HTMLDivElement,canvas:HTMLCanvasElement,image:HTMLImageElement,enabled:boolean,onReady:()=>void):PrismCanvasController {
  let motion=enabled;
  const context=canvas.getContext('2d',{alpha:false});
  const texture=document.createElement('canvas'),lightField=document.createElement('canvas');
  const textContext=texture.getContext('2d'),lightContext=lightField.getContext('2d');
  if(!context||!textContext||!lightContext)return {setMotion:()=>{},destroy:()=>{}};
  const ctx=context,tx=textContext,light=lightContext;
  let raf:number|null=null;
  let width=1,height=1,wordStep=600,fontSize=165,lastFrame=0,elapsed=0,visible=true,ready=false;
  let prismY=260,prismSize=330,mistGuideY=540,mistEndY=820;
  let pointerX=0,pointerY=0,easedX=0,easedY=0;
  function resizeVisual(){
    if(!hero.clientWidth||!hero.clientHeight)return;
    width=hero.clientWidth;height=hero.clientHeight;
    prismY=visual.offsetTop+visual.clientHeight*.5;prismSize=Math.min(338,width*.79);
    mistGuideY=prismY+prismSize*.84;mistEndY=Math.min(height-18,mistGuideY+280);
    const dpr=Math.min(devicePixelRatio||1,1.25);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    fontSize=Math.min(205,Math.max(108,width*.152));
    texture.width=Math.ceil(width*2+fontSize*8);texture.height=Math.ceil(fontSize*1.55);
    tx.font=`500 ${fontSize}px Arial, sans-serif`;
    tx.textBaseline='middle';tx.fillStyle='#f3f3f3';
    const letters='MACST';const letterGap=fontSize*.065;
    const measure=Array.from(letters).reduce((sum,char)=>sum+tx.measureText(char).width+letterGap,0);
    wordStep=measure+fontSize*.43;
    for(let x=-wordStep;x<texture.width;x+=wordStep){let lx=x;for(const char of letters){tx.fillText(char,lx,texture.height*.50);lx+=tx.measureText(char).width+letterGap;}}
    buildLightField();
    if(ready)drawVisual();
  }
  function textBands(offset:number,dy:number,alpha:number){
    ctx.save();ctx.globalAlpha=alpha;ctx.filter='blur(7px)';
    ctx.drawImage(texture,offset+wordStep,0,width,texture.height,0,dy,width,texture.height);
    ctx.restore();
  }
  const spectralColors=[[250,145,119],[249,191,125],[228,223,153],[166,222,190],[133,210,228],[144,178,237],[190,157,226]];
  function spectralPlaneX(lane:number){
    return width*(.67+lane*.29);
  }
  function buildLightField(){
    const resolution=.7;
    lightField.width=Math.ceil(width*resolution);lightField.height=Math.ceil(height*resolution);
    light.setTransform(resolution,0,0,resolution,0,0);light.globalCompositeOperation='screen';
    const cx=width*.5,cy=prismY,size=prismSize;
    const entry={x:cx-size*.223,y:cy+size*.005};
    const start={x:cx-Math.min(620,width*.56),y:cy-size*.55};
    light.save();light.translate(cx-size*.73,cy-size*.20);light.scale(1,.52);
    const daylight=light.createRadialGradient(0,0,0,0,0,size*.93);
    daylight.addColorStop(0,'rgba(255,240,210,.13)');daylight.addColorStop(.38,'rgba(255,241,218,.07)');daylight.addColorStop(1,'rgba(255,246,227,0)');
    light.fillStyle=daylight;light.fillRect(-size,-size,size*2,size*2);light.restore();
    const white=light.createLinearGradient(start.x,start.y,entry.x,entry.y);
    white.addColorStop(0,'rgba(255,244,221,0)');white.addColorStop(.25,'rgba(255,244,224,.10)');white.addColorStop(.68,'rgba(255,248,233,.29)');white.addColorStop(1,'rgba(255,253,243,.57)');
    const sunWidth=Math.min(78,size*.24);
    light.fillStyle=white;light.filter='blur(22px)';light.beginPath();light.moveTo(start.x,start.y-sunWidth);light.lineTo(entry.x,entry.y-sunWidth*.48);light.lineTo(entry.x,entry.y+sunWidth*.48);light.lineTo(start.x,start.y+sunWidth);light.closePath();light.fill();
    light.filter='blur(11px)';light.strokeStyle=white;light.lineWidth=sunWidth*.65;light.beginPath();light.moveTo(start.x,start.y);light.lineTo(entry.x,entry.y);light.stroke();

    const exit={x:cx+size*.225,y:cy+size*.10};
    const extension=(mistEndY-exit.y)/(mistGuideY-exit.y);
    spectralColors.forEach((rgb,index)=>{
      const u=index/6,planeX=spectralPlaneX(u);
      const farX=exit.x+(planeX-exit.x)*extension;
      const spread=Math.max(20,width*.036)*extension;
      const color=(a:number)=>'rgba('+rgb.join(',')+','+a+')';
      const gradient=light.createLinearGradient(exit.x,exit.y,farX,mistEndY);
      gradient.addColorStop(0,color(.50));gradient.addColorStop(.15,color(.35));gradient.addColorStop(.43,color(.24));gradient.addColorStop(.73,color(.10));gradient.addColorStop(1,color(0));
      light.fillStyle=gradient;light.filter='blur(16px)';light.beginPath();
      light.moveTo(exit.x-5+u*6,exit.y-6);light.lineTo(farX-spread,mistEndY);light.lineTo(farX+spread,mistEndY);light.lineTo(exit.x+5+u*6,exit.y+7);light.closePath();light.fill();

      const mistX=planeX+(planeX-exit.x)*.18,mistY=mistGuideY+65+u*35;
      const rx=Math.min(230,width*.20),ry=96+u*40;
      light.save();light.translate(mistX,mistY);light.scale(1,ry/rx);light.filter='blur(15px)';
      const haze=light.createRadialGradient(0,0,0,0,0,rx);
      haze.addColorStop(0,color(.085));haze.addColorStop(.35,color(.055));haze.addColorStop(.72,color(.018));haze.addColorStop(1,color(0));
      light.fillStyle=haze;light.fillRect(-rx,-rx,rx*2,rx*2);light.restore();
    });

    // Fine, deterministic grain stays inside the light instead of covering the UI.
    light.filter='none';
    let seed=74129;
    const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
    for(let i=0;i<1700;i++){
      const t=.13+random()*.87,lane=random(),rgb=spectralColors[Math.min(6,Math.floor(lane*7))];
      const y=exit.y+(mistEndY-exit.y)*t;
      const x=exit.x+(spectralPlaneX(lane)-exit.x)*(y-exit.y)/(mistGuideY-exit.y)+(random()-.5)*width*.035*t;
      const alpha=Math.sin(t*Math.PI)*(.065+random()*.11),grain=.45+random()*.55;
      light.fillStyle='rgba('+rgb.join(',')+','+alpha+')';light.fillRect(x,y,grain,grain);
    }
  }
  function drawFallingLight(){
    ctx.save();ctx.globalCompositeOperation='screen';
    const exitX=width*.5+prismSize*.225,exitY=prismY+prismSize*.10;
    for(let i=0;i<72;i++){
      const t=(elapsed*.031+i*.6180339)%1,lane=(i*.381966)%1;
      const y=exitY+(mistEndY-exitY)*t;
      const x=exitX+(spectralPlaneX(lane)-exitX)*(y-exitY)/(mistGuideY-exitY)+Math.sin(t*5+i)*5*t;
      const rgb=spectralColors[Math.min(6,Math.floor(lane*7))];
      const alpha=Math.sin(t*Math.PI)*(.13+t*.16),radius=1.05+(i%4)*.35;
      const dust=ctx.createRadialGradient(x,y,0,x,y,radius);
      dust.addColorStop(0,'rgba('+rgb.join(',')+','+alpha+')');dust.addColorStop(.25,'rgba('+rgb.join(',')+','+alpha*.52+')');dust.addColorStop(1,'rgba('+rgb.join(',')+',0)');
      ctx.fillStyle=dust;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
    }
    ctx.restore();
  }
  function drawVisual(){
    if(!ctx||!ready)return;
    ctx.clearRect(0,0,width,height);ctx.fillStyle='#030303';ctx.fillRect(0,0,width,height);
    easedX+=(pointerX-easedX)*.035;easedY+=(pointerY-easedY)*.035;
    const cx=width*.5+easedX*4,cy=prismY+Math.sin(elapsed*.22)*1.6+easedY*2;
    const size=prismSize,angle=Math.sin(elapsed*.16)*.009+easedX*.009,scaleX=.97;
    const offset=((elapsed*10+wordStep*.20+easedX*8)%wordStep+wordStep)%wordStep;
    const textY=cy-texture.height*.5+fontSize*.015;
    textBands(offset,textY,.23);
    const vignette=ctx.createLinearGradient(0,0,width,0);vignette.addColorStop(0,'#030303b8');vignette.addColorStop(.20,'#03030300');vignette.addColorStop(.80,'#03030300');vignette.addColorStop(1,'#030303b8');ctx.fillStyle=vignette;ctx.fillRect(0,0,width,height);
    const bloom=ctx.createRadialGradient(cx,cy,size*.12,cx,cy,size*.72);bloom.addColorStop(0,'#a9d0f006');bloom.addColorStop(.65,'#75a1be06');bloom.addColorStop(1,'#00000000');ctx.fillStyle=bloom;ctx.fillRect(cx-size,cy-size,size*2,size*2);
    ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.93+Math.sin(elapsed*.23)*.05;ctx.drawImage(lightField,0,0,lightField.width,lightField.height,0,0,width,height);ctx.restore();
    drawFallingLight();
    ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);ctx.scale(scaleX,1);
    ctx.filter='brightness(.76) contrast(1.08) saturate(.55)';ctx.drawImage(image,-size*.5,-size*.5,size,size);ctx.filter='none';
    ctx.save();ctx.beginPath();ctx.moveTo(-size*.012,-size*.39);ctx.lineTo(-size*.365,size*.29);ctx.lineTo(size*.31,size*.325);ctx.closePath();ctx.clip();
    ctx.globalCompositeOperation='screen';
    ctx.globalAlpha=.62;
    const paneLeft=-size*.39,paneWidth=size*.77;
    const refractionOffset=offset+wordStep+cx+paneLeft+Math.sin(elapsed*.16)*2;
    ctx.drawImage(texture,refractionOffset,0,paneWidth,texture.height,paneLeft,textY-cy,paneWidth,texture.height);
    ctx.globalAlpha=1;
    const sweep=Math.sin(elapsed*.35)*size*.5;
    const sheen=ctx.createLinearGradient(sweep-size*.15,-size*.3,sweep+size*.13,size*.3);sheen.addColorStop(0,'#d9f1ff00');sheen.addColorStop(.49,'#c9e2f900');sheen.addColorStop(.5,'#d5f0ff1c');sheen.addColorStop(.65,'#d5f0ff06');sheen.addColorStop(1,'#d9f1ff00');ctx.fillStyle=sheen;ctx.fillRect(-size*.5,-size*.5,size,size);
    ctx.restore();
    ctx.save();ctx.globalCompositeOperation='screen';
    [[-size*.223,size*.005,.085],[size*.225,size*.10,.09]].forEach(([x,y,r])=>{
      const contact=ctx.createRadialGradient(x,y,0,x,y,size*r);contact.addColorStop(0,'rgba(224,242,255,.23)');contact.addColorStop(.22,'rgba(191,225,249,.09)');contact.addColorStop(1,'rgba(171,217,250,0)');ctx.fillStyle=contact;ctx.fillRect(x-size*r,y-size*r,size*r*2,size*r*2);
    });ctx.restore();
    const glint=ctx.createRadialGradient(-size*.30,size*.27,0,-size*.30,size*.27,size*.13);glint.addColorStop(0,'#d8f3ff28');glint.addColorStop(.2,'#a3d4f30c');glint.addColorStop(1,'#a3d4f300');ctx.globalCompositeOperation='screen';ctx.fillStyle=glint;ctx.fillRect(-size*.5,-size*.1,size*.5,size*.6);
    ctx.restore();
  }
  function tick(now:number){raf=null;if(!ready)return;const advance=motion&&visible&&!document.hidden;if(advance){if(!lastFrame)lastFrame=now;if(now-lastFrame>=42){elapsed+=Math.min((now-lastFrame)/1000,.07);lastFrame=now;drawVisual();}raf=requestAnimationFrame(tick);}else{lastFrame=0;drawVisual();}}
  function schedule(){if(ready&&raf===null)raf=requestAnimationFrame(tick);}
  function setMotion(value:boolean){motion=value;if(!motion){if(raf!==null)cancelAnimationFrame(raf);raf=null;lastFrame=0;if(ready)drawVisual();}else schedule();}
  const pointerMove=(event:PointerEvent)=>{if(!motion||event.pointerType!=='mouse')return;const b=hero.getBoundingClientRect();pointerX=(event.clientX-b.left)/b.width*2-1;pointerY=(event.clientY-b.top)/b.height*2-1;};
  const pointerLeave=()=>{pointerX=0;pointerY=0;};
  hero.addEventListener('pointermove',pointerMove);hero.addEventListener('pointerleave',pointerLeave);
  document.addEventListener('visibilitychange',schedule);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();},{threshold:0});intersection.observe(hero);
  const resize=new ResizeObserver(resizeVisual);resize.observe(hero);
  function initialize(){if(ready||!image.naturalWidth)return;ready=true;resizeVisual();onReady();schedule();}
  image.addEventListener('load',initialize);if(image.complete)initialize();
  return {setMotion,destroy:()=>{ready=false;if(raf!==null)cancelAnimationFrame(raf);hero.removeEventListener('pointermove',pointerMove);hero.removeEventListener('pointerleave',pointerLeave);document.removeEventListener('visibilitychange',schedule);image.removeEventListener('load',initialize);intersection.disconnect();resize.disconnect();}};
}
