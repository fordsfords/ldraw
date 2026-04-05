// =============================================================================
// SYMBOL LIBRARY
// Pin-to-grid guarantee: with ox/oy snapped to PIN_SPACE multiples, every
// pin tip also lands on a PIN_SPACE multiple.
//   STUB   = PIN_PITCH     = 20  (plain stub)
//   BUBBLE = PIN_SPACE / 2 =  5  (inversion bubble radius; effective reach = STUB = 20)
// Box widths/heights are multiples of PIN_SPACE.
// NAND internal pitch = 2*PIN_SPACE so arc centre is always on grid.
// =============================================================================

const SYM_FG  = '#2c2c2a';
const SYM_MID = '#5f5e5a';
const SYM_BG  = '#f1efe8';
const NET_ORPHAN = '#cc0000';  // Phase 5: red — netsink with no matching netsource
const NET_NOSRC  = '#cc9900';  // Phase 5: yellow — netsource with unconnected input

const PIN_SPACE  = 10;               // fine grid pitch (snap unit)
const PIN_PITCH  = PIN_SPACE * 2;   // device pin-to-pin spacing (2 grid ticks)
const STUB       = PIN_PITCH;       // regular pin stub length = 20
const BUBBLE     = PIN_SPACE / 2;  // active-low bubble radius  = 5
const BUBBLE_STUB = STUB - 2*BUBBLE; // line portion before bubble = 10
// Active-low total reach = BUBBLE_STUB + 2*BUBBLE = STUB (same as regular pins)

// --- Shared helpers ---
function _l2c(pvX,pvY,tW,tH,cos,sin,lx,ly){
  const dx=lx-tW/2,dy=ly-tH/2;
  return [Math.round(pvX+dx*cos-dy*sin), Math.round(pvY+dx*sin+dy*cos)];
}
function _p(n){return Math.round(n*100)/100;}

function _renderShapesCanvas(ctx,shapes,fg,bg){
  for(const s of shapes){
    ctx.lineWidth=s.lineWidth; ctx.strokeStyle=fg; ctx.fillStyle=bg;
    if(s.type==='rect'){ctx.fillRect(s.x,s.y,s.w,s.h);ctx.strokeRect(s.x,s.y,s.w,s.h);}
    else if(s.type==='circle'){ctx.beginPath();ctx.arc(s.cx,s.cy,s.r,0,Math.PI*2);ctx.fill();ctx.stroke();}
    else if(s.type==='line'){ctx.beginPath();ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);ctx.stroke();}
    else if(s.type==='polygon'){
      ctx.beginPath();ctx.moveTo(s.points[0][0],s.points[0][1]);
      for(let i=1;i<s.points.length;i++)ctx.lineTo(s.points[i][0],s.points[i][1]);
      ctx.closePath();ctx.fillStyle='transparent';ctx.fill();ctx.stroke();
    }else if(s.type==='clockTriangle'){
      const{x,y,size,dir}=s;ctx.beginPath();
      if(dir==='down'){ctx.moveTo(x-size,y);ctx.lineTo(x,y+size*1.4);ctx.lineTo(x+size,y);}
      else if(dir==='left'){ctx.moveTo(x,y-size);ctx.lineTo(x-size*1.4,y);ctx.lineTo(x,y+size);}
      else{ctx.moveTo(x,y-size);ctx.lineTo(x+size*1.4,y);ctx.lineTo(x,y+size);}
      ctx.closePath();ctx.fillStyle='transparent';ctx.fill();ctx.stroke();
    }
  }
}
function _renderShapesSVG(shapes,fg,bg){
  const out=[];
  for(const s of shapes){
    if(s.type==='rect')out.push(`<rect x="${_p(s.x)}" y="${_p(s.y)}" width="${_p(s.w)}" height="${_p(s.h)}" fill="${bg}" stroke="${fg}" stroke-width="${s.lineWidth}"/>`);
    else if(s.type==='circle')out.push(`<circle cx="${_p(s.cx)}" cy="${_p(s.cy)}" r="${_p(s.r)}" fill="${bg}" stroke="${fg}" stroke-width="${s.lineWidth}"/>`);
    else if(s.type==='line')out.push(`<line x1="${_p(s.x1)}" y1="${_p(s.y1)}" x2="${_p(s.x2)}" y2="${_p(s.y2)}" stroke="${fg}" stroke-width="${s.lineWidth}" stroke-linecap="round"/>`);
    else if(s.type==='polygon'){const pts=s.points.map(p=>`${_p(p[0])},${_p(p[1])}`).join(' ');out.push(`<polygon points="${pts}" fill="none" stroke="${fg}" stroke-width="${s.lineWidth}" stroke-linejoin="round"/>`);}
    else if(s.type==='clockTriangle'){
      const{x,y,size,dir}=s;let pts;
      if(dir==='down')pts=`${_p(x-size)},${_p(y)} ${_p(x)},${_p(y+size*1.4)} ${_p(x+size)},${_p(y)}`;
      else if(dir==='left')pts=`${_p(x)},${_p(y-size)} ${_p(x-size*1.4)},${_p(y)} ${_p(x)},${_p(y+size)}`;
      else pts=`${_p(x)},${_p(y-size)} ${_p(x+size*1.4)},${_p(y)} ${_p(x)},${_p(y+size)}`;
      out.push(`<polygon points="${pts}" fill="none" stroke="${fg}" stroke-width="${s.lineWidth}" stroke-linejoin="round"/>`);
    }
  }
  return out;
}
function _renderLabelsCanvas(ctx,labels,fg,mid){
  for(const l of labels){
    ctx.fillStyle=fg;
    ctx.font=l.kind==='name'?'bold 11px sans-serif':'10px sans-serif';
    ctx.textAlign=l.align||'center';ctx.textBaseline='middle';
    ctx.fillText(l.text,l.x,l.y);
  }
}
function _renderLabelsSVG(labels,fg,mid){
  return labels.map(l=>{
    const fill=fg,weight=l.kind==='name'?'bold':'normal',size=l.kind==='name'?11:10;
    const anchor=l.align==='left'?'start':l.align==='right'?'end':'middle';
    return `<text x="${_p(l.x)}" y="${_p(l.y)}" font-family="sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" dominant-baseline="central">${l.text}</text>`;
  });
}
function _mirrorBoxGeo(geo,axisX){
  function mx(x){return 2*axisX-x;}
  for(const s of geo.shapes){
    if(s.type==='rect'){s.x=mx(s.x+s.w);}
    else if(s.type==='circle'){s.cx=mx(s.cx);}
    else if(s.type==='line'){s.x1=mx(s.x1);s.x2=mx(s.x2);}
    else if(s.type==='polygon'){for(const p of s.points)p[0]=mx(p[0]);}
    else if(s.type==='clockTriangle'){s.x=mx(s.x);if(s.dir==='right')s.dir='left';else if(s.dir==='left')s.dir='right';}
  }
  for(const l of geo.labels){l.x=mx(l.x);if(l.align==='left')l.align='right';else if(l.align==='right')l.align='left';}
  for(const k of Object.keys(geo.pins)){
    geo.pins[k].x=mx(geo.pins[k].x);
    if(geo.pins[k].dir==='left')geo.pins[k].dir='right';
    else if(geo.pins[k].dir==='right')geo.pins[k].dir='left';
  }
  return geo;
}
// Map a local pin direction through a device orientation rotation
function _rotateDir(localDir,orientation){
  const m={
    right:{left:'left',right:'right',up:'up',down:'down'},
    left:{left:'right',right:'left',up:'down',down:'up'},
    up:{left:'down',right:'up',up:'left',down:'right'},
    down:{left:'up',right:'down',up:'right',down:'left'},
  };
  return m[orientation][localDir];
}

// =============================================================================
// NAND GATE
// PITCH = PIN_SPACE (20px per input row).
// Floor at max(numInputs, 2) so 1-input == 2-input size (item 8).
// pinStart = PIN_SPACE/2 centers pins in rows; pins land at 10px multiples.
// Output arc centre at bodyH/2, on 20px grid when max(numInputs,2) is even.
// For odd numInputs>=3 the output is 10px off grid — accepted limitation.
// =============================================================================
function nandGeometry(ox,oy,name,orientation,numInputs){
  const PITCH=PIN_PITCH;  // 20px between input rows
  const rows=Math.max(numInputs,2);
  const bodyH=rows*PITCH;
  const arcR=bodyH/2,arcCx=bodyH*0.4,arcCy=bodyH/2;
  const arcRightX=arcCx+arcR;
  const bubbleCx=arcRightX+BUBBLE,bubbleCy=arcCy;
  const outBase=bubbleCx+BUBBLE;
  const totalW=Math.ceil(outBase/PIN_SPACE)*PIN_SPACE+PIN_SPACE;
  const totalH=bodyH;
  // For 1 input: place pin at bodyH/2 so it's co-linear with output arc centre.
  // For 2+ inputs: start half a pitch from top so inputs straddle the centre.
  const pinStart = numInputs===1 ? bodyH/2 : PIN_PITCH/2;
  const angles={right:0,left:Math.PI,up:-Math.PI/2,down:Math.PI/2};
  const angle=angles[orientation]??0;
  const cos=Math.cos(angle),sin=Math.sin(angle);
  let pivotX,pivotY;
  if(orientation==='right'||orientation==='left'){pivotX=ox+totalW/2;pivotY=oy+totalH/2;}
  else{pivotX=ox+totalH/2;pivotY=oy+totalW/2;}
  function l2c(lx,ly){return _l2c(pivotX,pivotY,totalW,totalH,cos,sin,lx,ly);}
  const shapes=[];
  shapes.push({type:'nandBody',arcR,angle,
    topLeft:l2c(0,0),botLeft:l2c(0,bodyH),
    botArcStart:l2c(arcCx,bodyH),topArcEnd:l2c(arcCx,0),lineWidth:1.5});
  const [bcx,bcy]=l2c(bubbleCx,bubbleCy);
  shapes.push({type:'circle',cx:bcx,cy:bcy,r:BUBBLE,lineWidth:1.5});
  for(let i=0;i<numInputs;i++){
    const py=pinStart+i*PITCH;
    const [x1,y1]=l2c(-STUB,py),[x2,y2]=l2c(0,py);
    shapes.push({type:'line',x1,y1,x2,y2,lineWidth:1.5});
  }
  const [lox1,loy1]=l2c(outBase,bubbleCy),[lox2,loy2]=l2c(totalW,bubbleCy);
  shapes.push({type:'line',x1:lox1,y1:loy1,x2:lox2,y2:loy2,lineWidth:1.5});
  const [nlx,nly]=l2c(arcRightX/2,bodyH/2);
  const labels=[{x:nlx,y:nly,text:name,kind:'name',align:'center'}];
  const pins={};
  for(let i=0;i<numInputs;i++){
    const py=pinStart+i*PITCH;
    const [px,py2]=l2c(-STUB,py);
    pins[`i${i}`]={x:px,y:py2,dir:_rotateDir('left',orientation)};
  }
  const [opx,opy]=l2c(totalW,bubbleCy);
  pins['o0']={x:opx,y:opy,dir:_rotateDir('right',orientation)};
  return{totalW,totalH,pivotX,pivotY,shapes,labels,pins,angle};
}
function renderNandCanvas(ctx,geo,fg,mid,bg){
  for(const s of geo.shapes){
    ctx.lineWidth=s.lineWidth;ctx.strokeStyle=fg;ctx.fillStyle=bg;
    if(s.type==='nandBody'){
      ctx.save();ctx.translate(geo.pivotX,geo.pivotY);ctx.rotate(geo.angle);
      ctx.translate(-geo.totalW/2,-geo.totalH/2);
      const bodyH=geo.totalH,arcCx=bodyH*0.4,arcCy=bodyH/2;
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,bodyH);ctx.lineTo(arcCx,bodyH);
      ctx.arc(arcCx,arcCy,s.arcR,Math.PI/2,-Math.PI/2,true);ctx.lineTo(0,0);ctx.fill();ctx.stroke();
      ctx.restore();
    }else if(s.type==='circle'){ctx.beginPath();ctx.arc(s.cx,s.cy,s.r,0,Math.PI*2);ctx.fill();ctx.stroke();}
    else if(s.type==='line'){ctx.beginPath();ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);ctx.stroke();}
  }
  _renderLabelsCanvas(ctx,geo.labels,fg,mid);
}
function renderNandSVG(geo,fg,mid,bg){
  const out=[];
  for(const s of geo.shapes){
    if(s.type==='nandBody'){
      const [tlx,tly]=s.topLeft,[blx,bly]=s.botLeft,[bax,bay]=s.botArcStart,[tax,tay]=s.topArcEnd;
      const d=`M ${_p(tlx)} ${_p(tly)} L ${_p(blx)} ${_p(bly)} L ${_p(bax)} ${_p(bay)} A ${_p(s.arcR)} ${_p(s.arcR)} 0 0 0 ${_p(tax)} ${_p(tay)} Z`;
      out.push(`<path d="${d}" fill="${bg}" stroke="${fg}" stroke-width="${s.lineWidth}" stroke-linejoin="round"/>`);
    }else{out.push(..._renderShapesSVG([s],fg,bg));}
  }
  return[...out,..._renderLabelsSVG(geo.labels,fg,mid)].join('\n');
}

// LED — radius=PIN_PITCH (20px)
function ledGeometry(ox,oy,name,orientation){
  const radius=PIN_PITCH,totalW=radius*2+STUB,totalH=radius*2;
  const angles={right:0,left:Math.PI,up:-Math.PI/2,down:Math.PI/2};
  const angle=angles[orientation]??0,cos=Math.cos(angle),sin=Math.sin(angle);
  let pivotX,pivotY;
  if(orientation==='right'||orientation==='left'){pivotX=ox+totalW/2;pivotY=oy+totalH/2;}
  else{pivotX=ox+totalH/2;pivotY=oy+totalW/2;}
  function l2c(lx,ly){return _l2c(pivotX,pivotY,totalW,totalH,cos,sin,lx,ly);}
  const [ccx,ccy]=l2c(STUB+radius,radius);
  const [sx1,sy1]=l2c(0,radius),[sx2,sy2]=l2c(STUB,radius);
  const shapes=[{type:'circle',cx:ccx,cy:ccy,r:radius,lineWidth:1.5},{type:'line',x1:sx1,y1:sy1,x2:sx2,y2:sy2,lineWidth:1.5}];
  const labels=[{x:ccx,y:ccy,text:name,kind:'name',align:'center'}];
  const pins={i0:{x:sx1,y:sy1,dir:_rotateDir('left',orientation)}};
  return{totalW,totalH,shapes,labels,pins,angle};
}
// SWITCH — radius=PIN_PITCH (20px)
function swtchGeometry(ox,oy,name,orientation,initialState){
  const radius=PIN_PITCH,totalW=radius*2+STUB,totalH=radius*2;
  const angles={right:0,left:Math.PI,up:-Math.PI/2,down:Math.PI/2};
  const angle=angles[orientation]??0,cos=Math.cos(angle),sin=Math.sin(angle);
  let pivotX,pivotY;
  if(orientation==='right'||orientation==='left'){pivotX=ox+totalW/2;pivotY=oy+totalH/2;}
  else{pivotX=ox+totalH/2;pivotY=oy+totalW/2;}
  function l2c(lx,ly){return _l2c(pivotX,pivotY,totalW,totalH,cos,sin,lx,ly);}
  const [ccx,ccy]=l2c(radius,radius);
  const [isx,isy]=l2c(radius,radius+10); // initial state label position
  const [sx1,sy1]=l2c(radius*2,radius),[sx2,sy2]=l2c(radius*2+STUB,radius);
  const shapes=[{type:'circle',cx:ccx,cy:ccy,r:radius,lineWidth:1.5},{type:'line',x1:sx1,y1:sy1,x2:sx2,y2:sy2,lineWidth:1.5}];
  const labels=[
    {x:ccx,y:ccy-5,text:name,kind:'name',align:'center'},
    {x:isx,y:isy,text:String(initialState||0),kind:'pin',align:'center'},
  ];
  const pins={o0:{x:sx2,y:sy2,dir:_rotateDir('right',orientation)}};
  return{totalW,totalH,shapes,labels,pins,angle};
}
// GND — half-size triangle, name label below
function gndGeometry(ox,oy,name){
  const w=PIN_PITCH,h=PIN_SPACE,stubLen=PIN_PITCH,totalW=w,totalH=stubLen+h,cx=ox+totalW/2;
  const shapes=[
    {type:'line',x1:cx,y1:oy,x2:cx,y2:oy+stubLen,lineWidth:1.5},
    {type:'polygon',points:[[ox,oy+stubLen],[ox+w,oy+stubLen],[cx,oy+stubLen+h]],lineWidth:1.5},
  ];
  const labels=[{x:cx,y:oy+totalH+8,text:name,kind:'name',align:'center'}];
  const pins={o0:{x:cx,y:oy,dir:'up'}};
  return{totalW,totalH,shapes,labels,pins};
}
// VCC — half-size triangle, name label above
function vccGeometry(ox,oy,name){
  const w=PIN_PITCH,h=PIN_SPACE,stubLen=PIN_PITCH,totalW=w,totalH=stubLen+h,cx=ox+totalW/2;
  const shapes=[
    {type:'line',x1:cx,y1:oy+totalH,x2:cx,y2:oy+h,lineWidth:1.5},
    {type:'polygon',points:[[ox,oy+h],[ox+w,oy+h],[cx,oy]],lineWidth:1.5},
  ];
  const labels=[{x:cx,y:oy-8,text:name,kind:'name',align:'center'}];
  const pins={o0:{x:cx,y:oy+totalH,dir:'down'}};
  return{totalW,totalH,shapes,labels,pins};
}
// CLK — boxW=4*PIN_PITCH, boxH=5*PIN_PITCH; q0 at oy+PIN_PITCH, Q0 at oy+3*PIN_PITCH
// R0 at bottom centre. BUBBLE/BUBBLE_STUB make q0 and Q0 extend equally from box.
function clkGeometry(ox,oy,name,orientation){
  const boxW=4*PIN_PITCH,boxH=5*PIN_PITCH,PAD=10;
  const q0Y=oy+PIN_PITCH,Q0Y=oy+3*PIN_PITCH;
  const R0X=ox+boxW/2;
  const shapes=[
    {type:'rect',x:ox,y:oy,w:boxW,h:boxH,lineWidth:1.5},
    {type:'line',x1:ox+boxW,y1:q0Y,x2:ox+boxW+STUB,y2:q0Y,lineWidth:1.5},
    {type:'circle',cx:ox+boxW+BUBBLE,cy:Q0Y,r:BUBBLE,lineWidth:1.5},
    {type:'line',x1:ox+boxW+BUBBLE*2,y1:Q0Y,x2:ox+boxW+BUBBLE*2+BUBBLE_STUB,y2:Q0Y,lineWidth:1.5},
    {type:'circle',cx:R0X,cy:oy+boxH+BUBBLE,r:BUBBLE,lineWidth:1.5},
    {type:'line',x1:R0X,y1:oy+boxH+BUBBLE*2,x2:R0X,y2:oy+boxH+BUBBLE*2+BUBBLE_STUB,lineWidth:1.5},
  ];
  const labels=[
    {x:ox+boxW/2,y:oy+boxH/2,text:name,kind:'name',align:'center'},
    {x:ox+boxW-PAD,y:q0Y,text:'q',kind:'pin',align:'right'},
    {x:ox+boxW-PAD,y:Q0Y,text:'Q',kind:'pin',align:'right'},
    {x:R0X,y:oy+boxH-PAD,text:'R',kind:'pin',align:'center'},
  ];
  const pins={
    q0:{x:ox+boxW+STUB,              y:q0Y,dir:'right'},
    Q0:{x:ox+boxW+BUBBLE*2+BUBBLE_STUB,y:Q0Y,dir:'right'},
    R0:{x:R0X,                       y:oy+boxH+BUBBLE*2+BUBBLE_STUB,dir:'down'},
  };
  const geo={boxW,boxH,shapes,labels,pins};
  return orientation==='left'?_mirrorBoxGeo(geo,ox+boxW/2):geo;
}
// MEM — dataSpacing=PIN_SPACE (exact), w0 pin at ox+PIN_SPACE
function memGeometry(ox,oy,name,numAddr,numData,orientation){
  const MIN_PINS=4;
  const effData=Math.max(numData,MIN_PINS),effAddr=Math.max(numAddr,MIN_PINS);
  const boxH=(effData+1)*PIN_PITCH;
  const boxW=Math.max(5*PIN_PITCH,(effAddr+1)*PIN_PITCH);
  const PAD=10,addrSpacing=boxW/(effAddr+1);
  const shapes=[{type:'rect',x:ox,y:oy,w:boxW,h:boxH,lineWidth:1.5}];
  const labels=[{x:ox+boxW/2,y:oy+boxH/2,text:name,kind:'name',align:'center'}];
  const pins={};
  for(let i=0;i<numAddr;i++){
    const px=ox+addrSpacing*(i+1);
    shapes.push({type:'line',x1:px,y1:oy-STUB,x2:px,y2:oy,lineWidth:1.5});
    labels.push({x:px,y:oy+PAD,text:`a${i}`,kind:'pin',align:'center'});
    pins[`a${i}`]={x:px,y:oy-STUB,dir:'up'};
  }
  for(let i=0;i<numData;i++){
    const py=oy+PIN_PITCH*(i+1);
    shapes.push({type:'line',x1:ox-STUB,y1:py,x2:ox,y2:py,lineWidth:1.5});
    labels.push({x:ox+PAD,y:py,text:`i${i}`,kind:'pin',align:'left'});
    pins[`i${i}`]={x:ox-STUB,y:py,dir:'left'};
    shapes.push({type:'line',x1:ox+boxW,y1:py,x2:ox+boxW+STUB,y2:py,lineWidth:1.5});
    labels.push({x:ox+boxW-PAD,y:py,text:`o${i}`,kind:'pin',align:'right'});
    pins[`o${i}`]={x:ox+boxW+STUB,y:py,dir:'right'};
  }
  const wX=ox+PIN_PITCH;
  shapes.push({type:'line',x1:wX,y1:oy+boxH,x2:wX,y2:oy+boxH+STUB,lineWidth:1.5});
  labels.push({x:wX,y:oy+boxH-PAD,text:'w',kind:'pin',align:'center'});
  pins['w0']={x:wX,y:oy+boxH+STUB,dir:'down'};
  const geo={boxW,boxH,shapes,labels,pins};
  return orientation==='left'?_mirrorBoxGeo(geo,ox+boxW/2):geo;
}
// SRLATCH — boxW=4*PIN_PITCH, boxH=4*PIN_PITCH; S0/q0 at oy+PIN_PITCH, R0/Q0 at oy+3*PIN_PITCH
function srlatchGeometry(ox,oy,name,orientation){
  const boxW=4*PIN_PITCH,boxH=4*PIN_PITCH,PAD=10;
  const S0Y=oy+PIN_PITCH,R0Y=oy+3*PIN_PITCH,q0Y=oy+PIN_PITCH,Q0Y=oy+3*PIN_PITCH;
  const shapes=[
    {type:'rect',x:ox,y:oy,w:boxW,h:boxH,lineWidth:1.5},
    {type:'line',x1:ox-BUBBLE*2-BUBBLE_STUB,y1:S0Y,x2:ox-BUBBLE*2,y2:S0Y,lineWidth:1.5},
    {type:'circle',cx:ox-BUBBLE,cy:S0Y,r:BUBBLE,lineWidth:1.5},
    {type:'line',x1:ox-BUBBLE*2-BUBBLE_STUB,y1:R0Y,x2:ox-BUBBLE*2,y2:R0Y,lineWidth:1.5},
    {type:'circle',cx:ox-BUBBLE,cy:R0Y,r:BUBBLE,lineWidth:1.5},
    {type:'line',x1:ox+boxW,y1:q0Y,x2:ox+boxW+STUB,y2:q0Y,lineWidth:1.5},
    {type:'circle',cx:ox+boxW+BUBBLE,cy:Q0Y,r:BUBBLE,lineWidth:1.5},
    {type:'line',x1:ox+boxW+BUBBLE*2,y1:Q0Y,x2:ox+boxW+BUBBLE*2+BUBBLE_STUB,y2:Q0Y,lineWidth:1.5},
  ];
  const labels=[
    {x:ox+boxW/2,y:oy+boxH/2,text:name,kind:'name',align:'center'},
    {x:ox+PAD,y:S0Y,text:'S',kind:'pin',align:'left'},
    {x:ox+PAD,y:R0Y,text:'R',kind:'pin',align:'left'},
    {x:ox+boxW-PAD,y:q0Y,text:'q',kind:'pin',align:'right'},
    {x:ox+boxW-PAD,y:Q0Y,text:'Q',kind:'pin',align:'right'},
  ];
  const pins={
    S0:{x:ox-BUBBLE*2-BUBBLE_STUB,y:S0Y,dir:'left'},R0:{x:ox-BUBBLE*2-BUBBLE_STUB,y:R0Y,dir:'left'},
    q0:{x:ox+boxW+STUB,y:q0Y,dir:'right'},Q0:{x:ox+boxW+BUBBLE*2+BUBBLE_STUB,y:Q0Y,dir:'right'},
  };
  const geo={boxW,boxH,shapes,labels,pins};
  return orientation==='left'?_mirrorBoxGeo(geo,ox+boxW/2):geo;
}
// DFLIPFLOP — boxW=4*PIN_PITCH, boxH=5*PIN_PITCH
// d0=oy+PIN_PITCH, c0=oy+4*PIN_PITCH; S0 top, R0 bottom
function dflipflopGeometry(ox,oy,name,orientation){
  const boxW=4*PIN_PITCH,boxH=5*PIN_PITCH,PAD=10,TRI=7;
  const d0Y=oy+PIN_PITCH,c0Y=oy+4*PIN_PITCH,q0Y=d0Y,Q0Y=c0Y;
  const S0X=ox+boxW/2,R0X=ox+boxW/2;
  const shapes=[
    {type:'rect',x:ox,y:oy,w:boxW,h:boxH,lineWidth:1.5},
    {type:'line',x1:S0X,y1:oy-BUBBLE*2-BUBBLE_STUB,x2:S0X,y2:oy-BUBBLE*2,lineWidth:1.5},
    {type:'circle',cx:S0X,cy:oy-BUBBLE,r:BUBBLE,lineWidth:1.5},
    {type:'circle',cx:R0X,cy:oy+boxH+BUBBLE,r:BUBBLE,lineWidth:1.5},
    {type:'line',x1:R0X,y1:oy+boxH+BUBBLE*2,x2:R0X,y2:oy+boxH+BUBBLE*2+BUBBLE_STUB,lineWidth:1.5},
    {type:'line',x1:ox-STUB,y1:d0Y,x2:ox,y2:d0Y,lineWidth:1.5},
    {type:'line',x1:ox-STUB,y1:c0Y,x2:ox,y2:c0Y,lineWidth:1.5},
    {type:'clockTriangle',x:ox,y:c0Y,size:TRI,dir:'right',lineWidth:1.5},
    {type:'line',x1:ox+boxW,y1:q0Y,x2:ox+boxW+STUB,y2:q0Y,lineWidth:1.5},
    {type:'circle',cx:ox+boxW+BUBBLE,cy:Q0Y,r:BUBBLE,lineWidth:1.5},
    {type:'line',x1:ox+boxW+BUBBLE*2,y1:Q0Y,x2:ox+boxW+BUBBLE*2+BUBBLE_STUB,y2:Q0Y,lineWidth:1.5},
  ];
  const labels=[
    {x:ox+boxW/2,y:oy+boxH/2,text:name,kind:'name',align:'center'},
    {x:S0X,y:oy+PAD,text:'S',kind:'pin',align:'center'},
    {x:R0X,y:oy+boxH-PAD,text:'R',kind:'pin',align:'center'},
    {x:ox+PAD,y:d0Y,text:'d',kind:'pin',align:'left'},
    {x:ox+boxW-PAD,y:q0Y,text:'q',kind:'pin',align:'right'},
    {x:ox+boxW-PAD,y:Q0Y,text:'Q',kind:'pin',align:'right'},
  ];
  const pins={
    S0:{x:S0X,y:oy-BUBBLE*2-BUBBLE_STUB,dir:'up'},R0:{x:R0X,y:oy+boxH+BUBBLE*2+BUBBLE_STUB,dir:'down'},
    d0:{x:ox-STUB,y:d0Y,dir:'left'},c0:{x:ox-STUB,y:c0Y,dir:'left'},
    q0:{x:ox+boxW+STUB,y:q0Y,dir:'right'},Q0:{x:ox+boxW+BUBBLE*2+BUBBLE_STUB,y:Q0Y,dir:'right'},
  };
  const geo={boxW,boxH,shapes,labels,pins};
  return orientation==='left'?_mirrorBoxGeo(geo,ox+boxW/2):geo;
}
// REG — boxW=4*PIN_PITCH, boxH=max(numBits+1,4)*PIN_PITCH, pin spacing=PIN_PITCH, BUBBLE_STUB
function regGeometry(ox,oy,name,numBits,orientation){
  const boxW=4*PIN_PITCH,TRI=7,PAD=10;
  const boxH=Math.max(numBits+1,4)*PIN_PITCH;
  const cX=ox+boxW/2,rX=ox+boxW/2;
  const shapes=[
    {type:'rect',x:ox,y:oy,w:boxW,h:boxH,lineWidth:1.5},
    {type:'line',x1:cX,y1:oy-STUB,x2:cX,y2:oy,lineWidth:1.5},
    {type:'clockTriangle',x:cX,y:oy,size:TRI,dir:'down',lineWidth:1.5},
    {type:'circle',cx:rX,cy:oy+boxH+BUBBLE,r:BUBBLE,lineWidth:1.5},
    {type:'line',x1:rX,y1:oy+boxH+BUBBLE*2,x2:rX,y2:oy+boxH+BUBBLE*2+BUBBLE_STUB,lineWidth:1.5},
  ];
  const labels=[
    {x:ox+boxW/2,y:oy+boxH/2,text:name,kind:'name',align:'center'},
    {x:rX,y:oy+boxH-PAD,text:'R',kind:'pin',align:'center'},
  ];
  const pins={c0:{x:cX,y:oy-STUB,dir:'up'},R0:{x:rX,y:oy+boxH+BUBBLE*2+BUBBLE_STUB,dir:'down'}};
  for(let i=0;i<numBits;i++){
    const py=oy+PIN_PITCH*(i+1);
    shapes.push({type:'line',x1:ox-STUB,y1:py,x2:ox,y2:py,lineWidth:1.5});
    shapes.push({type:'line',x1:ox+boxW,y1:py,x2:ox+boxW+STUB,y2:py,lineWidth:1.5});
    labels.push({x:ox+PAD,y:py,text:`d${i}`,kind:'pin',align:'left'});
    labels.push({x:ox+boxW-PAD,y:py,text:`q${i}`,kind:'pin',align:'right'});
    pins[`d${i}`]={x:ox-STUB,y:py,dir:'left'};
    pins[`q${i}`]={x:ox+boxW+STUB,y:py,dir:'right'};
  }
  const geo={boxW,boxH,shapes,labels,pins};
  return orientation==='left'?_mirrorBoxGeo(geo,ox+boxW/2):geo;
}
// PANEL — boxW=4*PIN_PITCH, boxH=max(numBits+1,4)*PIN_PITCH, pin spacing=PIN_PITCH
function panelGeometry(ox,oy,name,numBits,orientation){
  const boxW=4*PIN_PITCH,PAD=10;
  const boxH=Math.max(numBits+1,4)*PIN_PITCH;
  const shapes=[{type:'rect',x:ox,y:oy,w:boxW,h:boxH,lineWidth:1.5}];
  const labels=[{x:ox+boxW/2,y:oy+boxH/2,text:name,kind:'name',align:'center'}];
  const pins={};
  for(let i=0;i<numBits;i++){
    const py=oy+PIN_PITCH*(i+1);
    shapes.push({type:'line',x1:ox-STUB,y1:py,x2:ox,y2:py,lineWidth:1.5});
    shapes.push({type:'line',x1:ox+boxW,y1:py,x2:ox+boxW+STUB,y2:py,lineWidth:1.5});
    labels.push({x:ox+PAD,y:py,text:`i${i}`,kind:'pin',align:'left'});
    labels.push({x:ox+boxW-PAD,y:py,text:`o${i}`,kind:'pin',align:'right'});
    pins[`i${i}`]={x:ox-STUB,y:py,dir:'left'};
    pins[`o${i}`]={x:ox+boxW+STUB,y:py,dir:'right'};
  }
  const geo={boxW,boxH,shapes,labels,pins};
  return orientation==='left'?_mirrorBoxGeo(geo,ox+boxW/2):geo;
}
// ADDWORD — all pin spacings = PIN_PITCH
// iX=ox+PIN_PITCH, coX=ox+boxW-PIN_PITCH
function addwordGeometry(ox,oy,name,numBits,orientation){
  const PAD=10;
  const boxH=Math.max(numBits+1,3)*PIN_PITCH;
  const boxW=Math.max(numBits+1,4)*PIN_PITCH;
  const shapes=[{type:'rect',x:ox,y:oy,w:boxW,h:boxH,lineWidth:1.5}];
  const labels=[{x:ox+boxW/2,y:oy+boxH/2,text:name,kind:'name',align:'center'}];
  const pins={};
  for(let i=0;i<numBits;i++){
    const px=ox+PIN_PITCH*(i+1);
    shapes.push({type:'line',x1:px,y1:oy-STUB,x2:px,y2:oy,lineWidth:1.5});
    labels.push({x:px,y:oy+PAD,text:`a${i}`,kind:'pin',align:'center'});
    pins[`a${i}`]={x:px,y:oy-STUB,dir:'up'};
  }
  for(let i=0;i<numBits;i++){
    const py=oy+PIN_PITCH*(i+1);
    shapes.push({type:'line',x1:ox-STUB,y1:py,x2:ox,y2:py,lineWidth:1.5});
    labels.push({x:ox+PAD,y:py,text:`b${i}`,kind:'pin',align:'left'});
    pins[`b${i}`]={x:ox-STUB,y:py,dir:'left'};
  }
  for(let i=0;i<numBits;i++){
    const py=oy+PIN_PITCH*(i+1);
    shapes.push({type:'line',x1:ox+boxW,y1:py,x2:ox+boxW+STUB,y2:py,lineWidth:1.5});
    labels.push({x:ox+boxW-PAD,y:py,text:`s${i}`,kind:'pin',align:'right'});
    pins[`s${i}`]={x:ox+boxW+STUB,y:py,dir:'right'};
  }
  const iX=ox+PIN_PITCH;
  shapes.push({type:'line',x1:iX,y1:oy+boxH,x2:iX,y2:oy+boxH+STUB,lineWidth:1.5});
  labels.push({x:iX,y:oy+boxH-PAD,text:'i0',kind:'pin',align:'center'});
  pins['i0']={x:iX,y:oy+boxH+STUB,dir:'down'};
  const cX=ox+boxW-PIN_PITCH;
  shapes.push({type:'line',x1:cX,y1:oy+boxH,x2:cX,y2:oy+boxH+STUB,lineWidth:1.5});
  labels.push({x:cX,y:oy+boxH-PAD,text:'o0',kind:'pin',align:'center'});
  pins['o0']={x:cX,y:oy+boxH+STUB,dir:'down'};
  const geo={boxW,boxH,shapes,labels,pins};
  return orientation==='left'?_mirrorBoxGeo(geo,ox+boxW/2):geo;
}
// NETSOURCE — "-->" style: shaft extends from pin all the way to arrow tip,
// two wing lines go back from tip forming the ">" chevron.  No filled shape.
// In right orientation: i0 pin at left, tip at right.
// arrowH=20, arrowW=10, shaft+arrow span = totalW=30.
function netsourceGeometry(ox,oy,name,orientation){
  const arrowW=10,arrowH=20,totalW=STUB+arrowW,totalH=arrowH;
  const angles={right:0,left:Math.PI,up:-Math.PI/2,down:Math.PI/2};
  const angle=angles[orientation]??0,cos=Math.cos(angle),sin=Math.sin(angle);
  let pivotX,pivotY;
  if(orientation==='right'||orientation==='left'){pivotX=ox+totalW/2;pivotY=oy+totalH/2;}
  else{pivotX=ox+totalH/2;pivotY=oy+totalW/2;}
  function l2c(lx,ly){return _l2c(pivotX,pivotY,totalW,totalH,cos,sin,lx,ly);}
  const [px,py]  =l2c(0,          arrowH/2);   // pin (shaft start)
  const [v2x,v2y]=l2c(STUB+arrowW,arrowH/2);   // tip  (shaft end, chevron vertex)
  const [v1x,v1y]=l2c(STUB,       0);           // chevron back-top
  const [v3x,v3y]=l2c(STUB,       arrowH);      // chevron back-bottom
  const [nx,ny]  =l2c(STUB+arrowW+4,arrowH/2); // name label
  const shapes=[
    {type:'line',x1:px, y1:py, x2:v2x,y2:v2y,lineWidth:1.5},   // shaft → tip
    {type:'line',x1:v2x,y1:v2y,x2:v1x,y2:v1y,lineWidth:1.5},   // tip → back-top
    {type:'line',x1:v2x,y1:v2y,x2:v3x,y2:v3y,lineWidth:1.5},   // tip → back-bottom
  ];
  let nameAlign;
  if(orientation==='right')nameAlign='left';else if(orientation==='left')nameAlign='right';else nameAlign='center';
  const labels=[{x:nx,y:ny,text:name,kind:'name',align:nameAlign}];
  const pins={i0:{x:px,y:py,dir:_rotateDir('left',orientation)}};
  return{totalW,totalH,shapes,labels,pins,angle};
}
// NETSINK — half-size chevron (chevW=10, chevH=20)
function netsinkGeometry(ox,oy,name,orientation){
  const chevW=10,chevH=20,totalW=chevW+STUB,totalH=chevH;
  const angles={right:0,left:Math.PI,up:-Math.PI/2,down:Math.PI/2};
  const angle=angles[orientation]??0,cos=Math.cos(angle),sin=Math.sin(angle);
  let pivotX,pivotY;
  if(orientation==='right'||orientation==='left'){pivotX=ox+totalW/2;pivotY=oy+totalH/2;}
  else{pivotX=ox+totalH/2;pivotY=oy+totalW/2;}
  function l2c(lx,ly){return _l2c(pivotX,pivotY,totalW,totalH,cos,sin,lx,ly);}
  const [v1x,v1y]=l2c(0,0),[v2x,v2y]=l2c(chevW,chevH/2),[v3x,v3y]=l2c(0,chevH);
  const [px,py]=l2c(chevW+STUB,chevH/2),[nx,ny]=l2c(-6,chevH/2);
  const shapes=[
    {type:'line',x1:v1x,y1:v1y,x2:v2x,y2:v2y,lineWidth:1.5},
    {type:'line',x1:v3x,y1:v3y,x2:v2x,y2:v2y,lineWidth:1.5},
    {type:'line',x1:v2x,y1:v2y,x2:px,y2:py,lineWidth:1.5},
  ];
  let nameAlign;
  if(orientation==='right')nameAlign='right';else if(orientation==='left')nameAlign='left';else nameAlign='center';
  const labels=[{x:nx,y:ny,text:name,kind:'name',align:nameAlign}];
  const pins={o0:{x:px,y:py,dir:_rotateDir('right',orientation)}};
  return{totalW,totalH,shapes,labels,pins,angle};
}
// =============================================================================
// DISPATCH TABLES
// =============================================================================
const SYMBOL_FACTORIES={
  nand:      (ox,oy,name,params,orient)=>nandGeometry(ox,oy,name,orient,params.numInputs),
  led:       (ox,oy,name,params,orient)=>ledGeometry(ox,oy,name,orient),
  swtch:     (ox,oy,name,params,orient)=>swtchGeometry(ox,oy,name,orient,params.initialState),
  gnd:       (ox,oy,name)              =>gndGeometry(ox,oy,name),
  vcc:       (ox,oy,name)              =>vccGeometry(ox,oy,name),
  clk:       (ox,oy,name,params,orient)=>clkGeometry(ox,oy,name,orient),
  mem:       (ox,oy,name,params,orient)=>memGeometry(ox,oy,name,params.numAddr,params.numData,orient),
  srlatch:   (ox,oy,name,params,orient)=>srlatchGeometry(ox,oy,name,orient),
  dflipflop: (ox,oy,name,params,orient)=>dflipflopGeometry(ox,oy,name,orient),
  reg:       (ox,oy,name,params,orient)=>regGeometry(ox,oy,name,params.numBits,orient),
  panel:     (ox,oy,name,params,orient)=>panelGeometry(ox,oy,name,params.numBits,orient),
  addbit:    (ox,oy,name,params,orient)=>addwordGeometry(ox,oy,name,1,orient),
  addword:   (ox,oy,name,params,orient)=>addwordGeometry(ox,oy,name,params.numBits,orient),
  netsource: (ox,oy,name,params,orient)=>netsourceGeometry(ox,oy,name,orient),
  netsink:   (ox,oy,name,params,orient)=>netsinkGeometry(ox,oy,name,orient),
};
// Default renderers: used by all device types except those with custom rendering (NAND)
function _defaultRenderCanvas(ctx,geo,fg,mid,bg){_renderShapesCanvas(ctx,geo.shapes,fg,bg);_renderLabelsCanvas(ctx,geo.labels,fg,mid);}
function _defaultRenderSVG(geo,fg,mid,bg){return[..._renderShapesSVG(geo.shapes,fg,bg),..._renderLabelsSVG(geo.labels,fg,mid)].join('\n');}
// Override tables: only device types with custom rendering need entries here
const CANVAS_RENDERERS={nand:renderNandCanvas};
const SVG_RENDERERS={nand:renderNandSVG};
function renderDevice(ctx,type,geo,fg,mid,bg){(CANVAS_RENDERERS[type]||_defaultRenderCanvas)(ctx,geo,fg,mid,bg);}
