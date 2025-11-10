//This file is part of project Codraw
//Author :  Nikhil kumar
//(c) 2025 uzumaki_arts

/////////////////////////
// Canvas & Buffers
/////////////////////////
const canvas = document.getElementById('stage');
canvas.style.backgroundImage = "none";
if (!canvas) throw new Error("Canvas element with id 'stage' not found.");
const ctx = canvas.getContext('2d');

// Offscreen buffers (committed + work)
const bufferCanvas = document.createElement('canvas');
const bufferCtx = bufferCanvas.getContext('2d');

const workCanvas = document.createElement('canvas');
const workCtx = workCanvas.getContext('2d');
function resizeCanvases() {
  const w = 1600;
  const h = 900;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
    bufferCanvas.width = w; bufferCanvas.height = h;
    workCanvas.width = w; workCanvas.height = h;
  }
}
resizeCanvases();
window.addEventListener('resize', () => { resizeCanvases(); scheduleRepaintAll(); });

canvas.style.touchAction = 'none'; // prevent scrolling on touch

/////////////////////////
// App State
/////////////////////////
let tool = 'pencil'; 
let drawing = false;
let startPos = null;
let tempShape = null;
let objects = []; 
let selectedIndex = null;
let dragging = false;
let resizing = false;
let rotateMode = false;
let activeHandle = null; 
let dragOffset = { x: 0, y: 0 };
let showGrid = false;
let pencilSize = 3;
let currentColor = 'white';
let dotted = false;
let fillMode = false;
let eraserSize = 20;
let erasing = false;
let lastEraserPos = null;
let erasedIndicesDuringDrag = new Set();
let undoStack = [];
let redoStack = [];
const MAX_UNDO = 200;
let pages = [[]];
let currentPage = 0;
ctx.lineJoin = "round";
ctx.lineCap = "round";

// New: properties panel (created if not present)
let propertiesPanel = document.getElementById('propertiesPanel');

propertiesPanel.innerHTML = `
  <h4 style="margin:0 0 8px 0;">Properties</h4>
  <div id="propContent">No selection</div>
`;

/////////////////////////
// Utilities
/////////////////////////
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (key === "img") return undefined; // skip HTMLImageElement
    return value;
  }));
}
function pushUndo() { undoStack.push(deepClone(objects)); if (undoStack.length > MAX_UNDO) undoStack.shift(); redoStack.length = 0; updateUndoRedoButtons(); }
function undo() { if (!undoStack.length) return; redoStack.push(deepClone(objects)); objects = deepClone(undoStack.pop()); selectedIndex = null; tempShape = null; repaintBuffer(); repaintWorkBuffer(); scheduleRender(); updateUndoRedoButtons(); }
function redo() { if (!redoStack.length) return; undoStack.push(deepClone(objects)); objects = deepClone(redoStack.pop()); selectedIndex = null; tempShape = null; repaintBuffer(); repaintWorkBuffer(); scheduleRender(); updateUndoRedoButtons(); }
function updateUndoRedoButtons() {
  const u = document.getElementById('undoBtn'); if (u) u.disabled = undoStack.length === 0;
  const r = document.getElementById('redoBtn'); if (r) r.disabled = redoStack.length === 0;
}

// safe DOM getter
const $ = id => document.getElementById(id);

/////////////////////////
// requestAnimationFrame batching
/////////////////////////
let needsRender = false;
function scheduleRender() {
  if (!needsRender) {
    needsRender = true;
    requestAnimationFrame(() => {
      render();
      needsRender = false;
    });
  }
}
function scheduleRepaintAll() {
  // repaint buffers and schedule render (used on resize)
  repaintBuffer();
  repaintWorkBuffer();
  scheduleRender();
}

/////////////////////////
// Geometry helpers
/////////////////////////
function getObjectBounds(o) {
  switch (o.type) {
    case 'line':
    case 'arrow': {
      const x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
      const x = Math.min(x1, x2), y = Math.min(y1, y2), w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
      return { x, y, w, h };
    }
    case 'pencil':
    case 'highlighter':
    case 'polygon': {
      if (!o.points || !o.points.length) return { x: 0, y: 0, w: 0, h: 0 };
      const xs = o.points.map(p => p.x), ys = o.points.map(p => p.y);
      const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
      return { x, y, w, h };
    }
    default:
      return { x: Math.min(o.x, o.x + o.w), y: Math.min(o.y, o.y + o.h), w: Math.abs(o.w), h: Math.abs(o.h) };
  }
}

function degToRad(d) { return d * Math.PI / 180; }
function radToDeg(r) { return r * 180 / Math.PI; }

/////////////////////////
// Path building (for hit-testing & drawing)
/////////////////////////
function buildPathFor(ctxRef, o) {
  ctxRef.beginPath();
  switch (o.type) {
    case 'pencil':
    case 'highlighter':
      if (!o.points || o.points.length === 0) break;
      ctxRef.moveTo(o.points[0].x, o.points[0].y);
      for (let i = 1; i < o.points.length; i++) ctxRef.lineTo(o.points[i].x, o.points[i].y);
      break;
    case 'polygon':
      if (!o.points || !o.points.length) break;
      ctxRef.moveTo(o.points[0].x, o.points[0].y);
      for (let i = 1; i < o.points.length; i++) ctxRef.lineTo(o.points[i].x, o.points[i].y);
      ctxRef.closePath();
      break;
    case 'line':
    case 'arrow':
      ctxRef.moveTo(o.x, o.y);
      ctxRef.lineTo(o.x + o.w, o.y + o.h);
      break;
    case 'rect':
    case 'cuboid':
    case 'image':
      ctxRef.rect(Math.min(o.x, o.x + o.w), Math.min(o.y, o.y + o.h), Math.abs(o.w), Math.abs(o.h));
      break;
    case 'circle':
    case 'cylinder':
      ctxRef.ellipse(o.x + o.w / 2, o.y + o.h / 2, Math.abs(o.w) / 2, Math.abs(o.h) / 2, 0, 0, Math.PI * 2);
      break;
    case 'triangle':
      ctxRef.moveTo(o.x, o.y + o.h);
      ctxRef.lineTo(o.x + o.w, o.y + o.h);
      ctxRef.lineTo(o.x + o.w / 2, o.y);
      ctxRef.closePath();
      break;
    case 'cone':
      ctxRef.rect(Math.min(o.x, o.x + o.w), Math.min(o.y, o.y + o.h), Math.abs(o.w), Math.abs(o.h));
      break;
    case 'text':
      // approximate by bounding rect for hit testing
      const b = getObjectBounds(o);
      ctxRef.rect(b.x, b.y, b.w, b.h);
      break;
    default:
      ctxRef.rect(o.x || 0, o.y || 0, o.w || 0, o.h || 0);
  }
}

// hit test: stroke tolerance + fill
function isPointInObject(px, py, o) {
  bufferCtx.save();
  bufferCtx.beginPath();

  switch (o.type) {
    case "pencil":
    case 'highlighter':
      if (!o.points || o.points.length < 2) break;
      bufferCtx.moveTo(o.points[0].x, o.points[0].y);
      for (let i = 1; i < o.points.length; i++) {
        bufferCtx.lineTo(o.points[i].x, o.points[i].y);
      }
      bufferCtx.lineWidth = (o.width || 2) + 6;
      if (bufferCtx.isPointInStroke(px, py)) {
        bufferCtx.restore();
        return true;
      }
      break;
    case "image": {
      const rx = Math.min(o.x, o.x + o.w);
      const ry = Math.min(o.y, o.y + o.h);
      const rw = Math.abs(o.w);
      const rh = Math.abs(o.h);
      bufferCtx.rect(rx, ry, rw, rh);
      break;
    }
    case "line":
    case "arrow":
      bufferCtx.moveTo(o.x, o.y);
      bufferCtx.lineTo(o.x + o.w, o.y + o.h);
      bufferCtx.lineWidth = (o.width || 2) + 8;
      if (bufferCtx.isPointInStroke(px, py)) {
        bufferCtx.restore();
        return true;
      }
      break;

    case "rect": {
      const rx = Math.min(o.x, o.x + o.w);
      const ry = Math.min(o.y, o.y + o.h);
      const rw = Math.abs(o.w);
      const rh = Math.abs(o.h);
      bufferCtx.rect(rx, ry, rw, rh);
      break;
    }

    case "circle": {
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      const rx = Math.abs(o.w) / 2;
      const ry = Math.abs(o.h) / 2;
      bufferCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      break;
    }

    case "triangle": {
      const x1 = o.x,
        y1 = o.y + o.h,
        x2 = o.x + o.w,
        y2 = o.y + o.h,
        x3 = o.x + o.w / 2,
        y3 = o.y;
      bufferCtx.moveTo(x1, y1);
      bufferCtx.lineTo(x2, y2);
      bufferCtx.lineTo(x3, y3);
      bufferCtx.closePath();
      break;
    }

    case "cuboid":
    case "cylinder":
    case "cone": {
      const b = getObjectBounds(o);
      bufferCtx.rect(b.x, b.y, b.w, b.h);
      break;
    }
    case "sphere":
  bufferCtx.ellipse(o.x + o.w/2, o.y + o.h/2, Math.abs(o.w)/2, Math.abs(o.h)/2, 0, 0, Math.PI*2);
  break;

case "tetrahedron":
  bufferCtx.moveTo(o.x+o.w/2,o.y);
  bufferCtx.lineTo(o.x,o.y+o.h);
  bufferCtx.lineTo(o.x+o.w,o.y+o.h);
  bufferCtx.closePath();
  break;

case "squarepyramid":
  bufferCtx.moveTo(o.x+o.w/2,o.y);
  bufferCtx.lineTo(o.x,o.y+o.h);
  bufferCtx.lineTo(o.x+o.w,o.y+o.h);
  bufferCtx.closePath();
  break;

case "rhombus":
  bufferCtx.moveTo(o.x+o.w/2,o.y);
  bufferCtx.lineTo(o.x+o.w,o.y+o.h/2);
  bufferCtx.lineTo(o.x+o.w/2,o.y+o.h);
  bufferCtx.lineTo(o.x,o.y+o.h/2);
  bufferCtx.closePath();
  break;

case "hexagon": {
  const cx=o.x+o.w/2, cy=o.y+o.h/2;
  const r=Math.min(Math.abs(o.w),Math.abs(o.h))/2;
  for(let i=0;i<6;i++){
    const angle=Math.PI/3*i-Math.PI/6;
    const x=cx+r*Math.cos(angle), y=cy+r*Math.sin(angle);
    i===0?bufferCtx.moveTo(x,y):bufferCtx.lineTo(x,y);
  }
  bufferCtx.closePath();
  break;
}

case "pentagon": {
  const cx=o.x+o.w/2, cy=o.y+o.h/2;
  const r=Math.min(Math.abs(o.w),Math.abs(o.h))/2;
  for(let i=0;i<5;i++){
    const angle=(Math.PI*2/5)*i-Math.PI/2;
    const x=cx+r*Math.cos(angle), y=cy+r*Math.sin(angle);
    i===0?bufferCtx.moveTo(x,y):bufferCtx.lineTo(x,y);
  }
  bufferCtx.closePath();
  break;
}
  }

  let hit = false;
  if (o.fill) {
    hit = bufferCtx.isPointInPath(px, py);
  } else {
    bufferCtx.lineWidth = (o.width || 2) + 6;
    hit = bufferCtx.isPointInStroke(px, py) || bufferCtx.isPointInPath(px, py);
  }

  bufferCtx.restore();
  return hit;
}

/////////////////////////
// Eraser optimized with bbox pre-check
/////////////////////////
function eraserHitIndex(pos, size) {
  const half = size / 2;
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    const b = getObjectBounds(o);
    if (pos.x + half < b.x || pos.x - half > b.x + b.w || pos.y + half < b.y || pos.y - half > b.y + b.h) continue;
    bufferCtx.save();
    buildPathFor(bufferCtx, o);
    bufferCtx.lineWidth = (o.width || pencilSize) + size;
    const hitStroke = bufferCtx.isPointInStroke(pos.x, pos.y);
    const hitPath = !!o.fill && bufferCtx.isPointInPath(pos.x, pos.y);
    bufferCtx.restore();
    if (hitStroke || hitPath) return i;
  }
  return null;
}

/////////////////////////
// Drawing primitives & render
/////////////////////////
function setLineDashFor(ctxRef, o) {
  if (o.dotted) {
    const unit = Math.max(2, Math.round((o.width || 2) / 2));
    ctxRef.setLineDash([unit * 3, unit * 5]);
  } else ctxRef.setLineDash([]);
}

function drawPencilStroke(ctxRef, o) {
  if (!o.points || o.points.length < 2) return;

  ctxRef.beginPath();
  ctxRef.moveTo(o.points[0].x, o.points[0].y);
  for (let i = 1; i < o.points.length - 1; i++) {
    const midX = (o.points[i].x + o.points[i + 1].x) / 2;
    const midY = (o.points[i].y + o.points[i + 1].y) / 2;
    ctxRef.quadraticCurveTo(o.points[i].x, o.points[i].y, midX, midY);
  }
  ctxRef.stroke();
}

function drawArrowHead(ctxRef, x1, y1, x2, y2, width) {
  const headlen = 15 + (width || 2);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctxRef.beginPath();
  ctxRef.moveTo(x2, y2);
  ctxRef.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
  ctxRef.moveTo(x2, y2);
  ctxRef.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
  ctxRef.stroke();
}

function drawObject(o, isSelected = false, ctxTarget = ctx) {
  ctxTarget.save();
  ctxTarget.lineJoin = "round";
  ctxTarget.lineCap = "round";

// opacity support (for highlighter & text) 
  if (o.opacity !== undefined){
    ctxTarget.globalAlpha = o.opacity;
    ctxTarget.strokeStyle = o.color || currentColor;
    ctxTarget.fillStyle = o.color || currentColor;
    ctxTarget.lineWidth = o.width || pencilSize; 
    setLineDashFor(ctxTarget, o);
    }
 // handle rotation if any 
if (o.rotation) { 
  const b = getObjectBounds(o); 
  const cx = b.x + b.w / 2; 
  const cy = b.y + b.h / 2; 
  ctxTarget.translate(cx, cy); 
  ctxTarget.rotate(degToRad(o.rotation)); 
  ctxTarget.translate(-cx, -cy); 
}
  setLineDashFor(ctxTarget, o);
  if (o.type === 'highlighter'){
      ctxTarget.lineWidth = 20;
  } else{
      ctxTarget.lineWidth = o.width || pencilSize;
  }

  switch (o.type) {
    case 'pencil':
    case 'highlighter':
      // highlighter uses low alpha
      drawPencilStroke(ctxTarget, o);
      break;
    
    case 'polygon':
      if (!o.points || !o.points.length) break;
      ctxTarget.beginPath();
      ctxTarget.moveTo(o.points[0].x, o.points[0].y);
      for (let i = 1; i < o.points.length; i++) ctxTarget.lineTo(o.points[i].x, o.points[i].y);
      ctxTarget.closePath();
      if (o.fill) ctxTarget.fill(); else ctxTarget.stroke();
      break;
    case 'line':
    case 'arrow':
      ctxTarget.beginPath();
      ctxTarget.moveTo(o.x, o.y); ctxTarget.lineTo(o.x + o.w, o.y + o.h); ctxTarget.stroke();
      if (o.type === 'arrow') drawArrowHead(ctxTarget, o.x, o.y, o.x + o.w, o.y + o.h, o.width);
      break;

    case 'rect': {
      const rx = Math.min(o.x, o.x + o.w), ry = Math.min(o.y, o.y + o.h), rw = Math.abs(o.w), rh = Math.abs(o.h);
      if (o.fill) ctxTarget.fillRect(rx, ry, rw, rh); else ctxTarget.strokeRect(rx, ry, rw, rh);
      break;
    }

    case 'circle': {
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2, rx = Math.abs(o.w) / 2, ry = Math.abs(o.h) / 2;
      ctxTarget.beginPath(); ctxTarget.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (o.fill) ctxTarget.fill(); else ctxTarget.stroke();
      break;
    }

    case 'triangle':
      ctxTarget.beginPath(); ctxTarget.moveTo(o.x, o.y + o.h); ctxTarget.lineTo(o.x + o.w, o.y + o.h); ctxTarget.lineTo(o.x + o.w / 2, o.y); ctxTarget.closePath();
      if (o.fill) ctxTarget.fill(); else ctxTarget.stroke();
      break;

    case 'cuboid': {
      const x = o.x, y = o.y, w = o.w, h = o.h, d = Math.min(40, Math.abs(w) / 3);
      ctxTarget.strokeRect(x, y, w, h); ctxTarget.strokeRect(x + d, y - d, w, h);
      ctxTarget.beginPath(); ctxTarget.moveTo(x, y); ctxTarget.lineTo(x + d, y - d);
      ctxTarget.moveTo(x + w, y); ctxTarget.lineTo(x + w + d, y - d);
      ctxTarget.moveTo(x, y + h); ctxTarget.lineTo(x + d, y + h - d);
      ctxTarget.moveTo(x + w, y + h); ctxTarget.lineTo(x + w + d, y + h - d); ctxTarget.stroke();
      break;
    }

    case 'cylinder': {
      const x = o.x, y = o.y, w = o.w, h = o.h; const rx = Math.abs(w) / 2, ry = 15; const cx = x + w / 2;
      ctxTarget.beginPath(); ctxTarget.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2); ctxTarget.stroke();
      ctxTarget.beginPath(); ctxTarget.ellipse(cx, y + h, rx, ry, 0, 0, Math.PI * 2);
      ctxTarget.moveTo(x, y); ctxTarget.lineTo(x, y + h);
      ctxTarget.moveTo(x + w, y); ctxTarget.lineTo(x + w, y + h);
      ctxTarget.stroke();
      break;
    }

    case 'cone': {
      const x = o.x, y = o.y, w = o.w, h = o.h, cx = x + w / 2, rx = Math.abs(w) / 2, ry = 15;
      ctxTarget.beginPath(); ctxTarget.ellipse(cx, y + h, rx, ry*3, 0, 0, Math.PI * 2); ctxTarget.stroke();
      ctxTarget.beginPath(); ctxTarget.moveTo(cx, y); ctxTarget.lineTo(x, y + h); ctxTarget.moveTo(cx, y); ctxTarget.lineTo(x + w, y + h); ctxTarget.stroke();
      break;
    }

    case "image":
      if (!o.img && o.imgSrc) {
        o.img = new Image();
        o.img.src = o.imgSrc;
        o.img.onload = () => scheduleRender();
        }
      if (o.img) ctxTarget.drawImage(o.img, o.x, o.y, o.w, o.h);
      break;

    case 'text': {
      ctxTarget.font = (o.fontSize || 32) + 'px ' + (o.fontFamily || 'MANIC, sans-serif');
      ctxTarget.textBaseline = 'top';
      if (o.fill) ctxTarget.fillText(o.text || '', o.x, o.y);
      else ctxTarget.strokeText(o.text || '', o.x, o.y);
      break;
    }
    case "sphere":
  ctxTarget.beginPath();
  ctxTarget.ellipse(
    o.x + o.w / 2,
    o.y + o.h / 2,
    Math.abs(o.w) / 2,
    Math.abs(o.h) / 2,
    0,
    0,
    Math.PI * 2
  );
  o.fill ? ctxTarget.fill() : ctxTarget.stroke();
  // add "equator" for 3D effect
  ctxTarget.beginPath();
  ctxTarget.ellipse(
    o.x + o.w / 2,
    o.y + o.h / 2,
    Math.abs(o.w) / 2,
    Math.abs(o.h) / 6,
    0,
    0,
    Math.PI * 2
  );
  ctxTarget.stroke();
  break;

case "tetrahedron": {
  // normalize so drawing works in any direction
  const X = Math.min(o.x, o.x + o.w);
  const Y = Math.min(o.y, o.y + o.h);
  const W = Math.abs(o.w);
  const H = Math.abs(o.h);

  // vertices
  const apex   = { x: X + W / 2, y: Y };           // top apex
  const left   = { x: X,         y: Y + H };       // base left
  const right  = { x: X + W,     y: Y + H };       // base right
  const back   = { x: X + W / 2, y: Y + H * 0.7 }; // base back (slightly raised for perspective)

  // draw base triangle (left–right–back)
  ctxTarget.beginPath();
  ctxTarget.moveTo(left.x, left.y);
  ctxTarget.lineTo(right.x, right.y);
  ctxTarget.lineTo(back.x, back.y);
  ctxTarget.closePath();
  o.fill ? ctxTarget.fill() : ctxTarget.stroke();

  // draw edges from apex
  ctxTarget.beginPath();
  ctxTarget.moveTo(apex.x, apex.y); ctxTarget.lineTo(left.x, left.y);
  ctxTarget.moveTo(apex.x, apex.y); ctxTarget.lineTo(right.x, right.y);
  ctxTarget.moveTo(apex.x, apex.y); ctxTarget.lineTo(back.x, back.y);
  ctxTarget.stroke();


  break;
}


case "squarepyramid": {
  const x = o.x, y = o.y, w = o.w, h = o.h;
  const apexX = x + w / 2;
  const apexY = y; 
  // base corners
  const bl = { x: x,     y: y + h };
  const br = { x: x + w, y: y + h };
  const tl = { x: x,     y: y + h / 2 };
  const tr = { x: x + w, y: y + h / 2 };

  // draw base
  ctxTarget.beginPath();
  ctxTarget.moveTo(bl.x, bl.y);
  ctxTarget.lineTo(br.x, br.y);
  ctxTarget.lineTo(tr.x, tr.y);
  ctxTarget.lineTo(tl.x, tl.y);
  ctxTarget.closePath();
  o.fill ? ctxTarget.fill() : ctxTarget.stroke();

  // connect apex
  
  ctxTarget.beginPath();
  ctxTarget.moveTo(apexX, apexY);
  ctxTarget.lineTo(bl.x, bl.y);
  ctxTarget.moveTo(apexX, apexY);
  ctxTarget.lineTo(br.x, br.y);
  ctxTarget.moveTo(apexX, apexY);
  ctxTarget.lineTo(tl.x, tl.y);
  ctxTarget.moveTo(apexX, apexY);
  ctxTarget.lineTo(tr.x, tr.y);
  ctxTarget.stroke();
  break;
}

case "rhombus": 
  const x = o.x, y = o.y, w = o.w, h = o.h;
  const offset = w / 4; // controls slant
  ctxTarget.beginPath();
  ctxTarget.moveTo(x + offset, y);         // top-left
  ctxTarget.lineTo(x + w, y);              // top-right
  ctxTarget.lineTo(x + w - offset, y + h); // bottom-right
  ctxTarget.lineTo(x, y + h);              // bottom-left
  ctxTarget.closePath();
  o.fill ? ctxTarget.fill() : ctxTarget.stroke();
  break;


case "hexagon": {
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  const r = Math.min(Math.abs(o.w), Math.abs(o.h)) / 2;
  ctxTarget.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i - Math.PI / 6;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    i === 0 ? ctxTarget.moveTo(x, y) : ctxTarget.lineTo(x, y);
  }
  ctxTarget.closePath();
  o.fill ? ctxTarget.fill() : ctxTarget.stroke();
  break;
}

case "pentagon": {
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  const r = Math.min(Math.abs(o.w), Math.abs(o.h)) / 2;
  ctxTarget.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    i === 0 ? ctxTarget.moveTo(x, y) : ctxTarget.lineTo(x, y);
  }
  ctxTarget.closePath();
  o.fill ? ctxTarget.fill() : ctxTarget.stroke();
  break;
}

    default:
      // unknown: draw bounding rect
      const b = getObjectBounds(o);
      ctxTarget.strokeRect(b.x, b.y, b.w, b.h);
  }

  // selection visuals (handles + rotate)
  if (isSelected) {
    const b = getObjectBounds(o);
    ctxTarget.setLineDash([6, 4]); ctxTarget.lineWidth = 1; ctxTarget.strokeStyle = '#f00';
    ctxTarget.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
    ctxTarget.setLineDash([]);
    ctxTarget.fillStyle = '#fff';
    // handles corners
    const handles = [
      [b.x - 8, b.y - 8],
      [b.x + b.w, b.y - 8],
      [b.x - 8, b.y + b.h],
      [b.x + b.w, b.y + b.h]
    ];
    handles.forEach(h => ctxTarget.fillRect(h[0], h[1], 8, 8));
    // rotate handle (top center)
    const rx = b.x + b.w / 2, ry = b.y - 28;
    ctxTarget.beginPath(); ctxTarget.arc(rx, ry, 8, 0, Math.PI * 2); ctxTarget.fill();
    ctxTarget.strokeStyle = '#fff'; ctxTarget.beginPath(); ctxTarget.moveTo(b.x + b.w / 2, b.y - 8); ctxTarget.lineTo(b.x + b.w / 2, b.y - 20); ctxTarget.stroke();
  }

  ctxTarget.restore();
}

function drawObjectOnContext(ctxRef, o) { drawObject(o, false, ctxRef); }

/////////////////////////
// Buffers: repaint & work buffer
/////////////////////////
function repaintBuffer() {
  bufferCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height);
  // background if needed
  for (let i = 0; i < objects.length; i++) drawObjectOnContext(bufferCtx, objects[i]);
}

function repaintWorkBuffer(excludeIndex = null) {
  workCtx.clearRect(0, 0, workCanvas.width, workCanvas.height);
  for (let i = 0; i < objects.length; i++) {
    if (i === excludeIndex) continue;
    drawObjectOnContext(workCtx, objects[i]);
  }
}
document.getElementById("toggleGrid").addEventListener("click", ()=>{
  showGrid = !showGrid;
  render();
});
/////////////////////////
// Render (batched with scheduleRender)
/////////////////////////
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
// draw grid first if enabled
if(showGrid) drawGrid();
  // If a selection is active, workCanvas contains everything except the selected item
  if (selectedIndex !== null) ctx.drawImage(workCanvas, 0, 0);
  else ctx.drawImage(bufferCanvas, 0, 0);

  // preview shape
  if (tempShape) drawObject(tempShape, false, ctx);

  // selected (drawn on top)
  if (selectedIndex !== null && objects[selectedIndex]) drawObject(objects[selectedIndex], true, ctx);

  // eraser cursor
  if (tool === 'eraser' && lastEraserPos) {
    ctx.save();
    ctx.strokeStyle = '#fff';
    ctx.setLineDash([4, 2]);
    ctx.beginPath(); ctx.arc(lastEraserPos.x, lastEraserPos.y, eraserSize / 2, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

/////////////////////////
// Selection utilities (handles)
/////////////////////////
function handleAtPoint(px, py, o) {
  const b = getObjectBounds(o);
  const handles = [
    { name: 'tl', x: b.x - 8, y: b.y - 8 },
    { name: 'tr', x: b.x + b.w, y: b.y - 8 },
    { name: 'bl', x: b.x - 8, y: b.y + b.h },
    { name: 'br', x: b.x + b.w, y: b.y + b.h },
    { name: 'rotate', x: b.x + b.w / 2 - 8, y: b.y - 28 - 8 }
  ];
  for (const h of handles) {
    if (px >= h.x && px <= h.x + 16 && py >= h.y && py <= h.y + 16) return h.name;
  }
  return null;
}

/////////////////////////
// Pointer events (draw/select/erase/drag/resize/rotate)
/////////////////////////
let pointerDown = false;
let polygonTempPoints = null;
let textEditing = null; // {index, inputElement}

canvas.addEventListener('pointerdown', (evt) => {
  const pos = getPos(evt);
  pointerDown = true;
  startPos = pos;
  activeHandle = null;

  // ERASER: start erasing — multi delete while dragging
  if (tool === 'eraser') {
    erasing = true;
    erasedIndicesDuringDrag.clear();
    // first immediate hit
    let idx = eraserHitIndex(pos, eraserSize);
    if (idx !== null) { pushUndo(); objects.splice(idx, 1); repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); erasedIndicesDuringDrag.add(idx); }
    lastEraserPos = pos;
    return;
  }

  // SELECT mode
  if (tool === 'select') {
    // if there's a selection and click on handle
    if (selectedIndex !== null) {
      const h = handleAtPoint(pos.x, pos.y, objects[selectedIndex]);
      if (h) {
        if (h === 'rotate') { rotateMode = true; activeHandle = 'rotate'; pushUndo(); return; }
        resizing = true; activeHandle = h; pushUndo(); return;
      }
    }
    // find topmost by path
    selectedIndex = null;
    for (let i = objects.length - 1; i >= 0; i--) {
      if (isPointInObject(pos.x, pos.y, objects[i])) {
        selectedIndex = i;
        const b = getObjectBounds(objects[i]);
        dragOffset = { x: pos.x - b.x, y: pos.y - b.y };
        dragging = true;
        pushUndo();
        // prepare work buffer excluding selected for smooth editing
        repaintWorkBuffer(selectedIndex);
        scheduleRender();
        updatePropertiesPanel();
        return;
      }
    }
    // clicked empty: deselect
    selectedIndex = null; repaintWorkBuffer(); scheduleRender(); updatePropertiesPanel(); return;
  }

  // POLYGON tool: if active, click adds points
  if (tool === 'polygon') {
    if (!polygonTempPoints) polygonTempPoints = [];
    polygonTempPoints.push({ x: pos.x, y: pos.y });
    tempShape = { type: 'polygon', points: polygonTempPoints.slice(), color: currentColor, width: pencilSize, dotted, fill: fillMode, opacity: 1 };
    scheduleRender();
    return;
  }

  // TEXT: click to place text object (editable)
  if (tool === 'text') {
    pushUndo();
    const newText = { type: 'text', text: '', x: pos.x, y: pos.y, fontSize: 32, fontFamily: 'MANIC, sans-serif', color: '#ffffff' || currentColor, width: pencilSize, fill: true, opacity: 1 };
    objects.push(newText);
    selectedIndex = objects.length - 1;
    repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); updatePropertiesPanel();
    // create an input overlay for editing
    createTextEditor(selectedIndex);
    return;
  }

  // DRAWING tool: start tempShape
  tempShape = { type: tool, color: currentColor, width: pencilSize, dotted, fill: fillMode, opacity: (tool === 'highlighter' ? 0.35 : 1) };
  if (tool === 'pencil' || tool === 'highlighter') tempShape.points = [{ x: pos.x, y: pos.y, w: pencilSize }];
  else if (tool === 'image') tempShape = null;
  else { tempShape.x = pos.x; tempShape.y = pos.y; tempShape.w = 0; tempShape.h = 0; }



  pointerDown = true;
  scheduleRender();
});

canvas.addEventListener('pointermove', (evt) => {
  const pos = getPos(evt);
  if (!pointerDown) {
    // update eraser cursor
    if (tool === 'eraser') { lastEraserPos = pos; scheduleRender(); }
    return;
  }

  // ERASER drag: remove any object intersecting along the path
  if (erasing) {
    lastEraserPos = pos;
    // repeatedly hit-check to remove all overlapping objects under cursor while dragging
    let hit;
    while ((hit = eraserHitIndex(pos, eraserSize)) !== null) {
      if (!erasedIndicesDuringDrag.has(hit)) {
        if (erasedIndicesDuringDrag.size === 0) pushUndo();
        objects.splice(hit, 1);
        erasedIndicesDuringDrag.add(hit);
        repaintBuffer(); repaintWorkBuffer(selectedIndex);
      } else break;
    }
    scheduleRender();
    return;
  }

  // POLYGON building: update preview last segment
  if (tool === 'polygon' && polygonTempPoints) {
    tempShape = { type: 'polygon', points: polygonTempPoints.concat([{ x: pos.x, y: pos.y }]), color: currentColor, width: pencilSize, fill: fillMode, dotted, opacity: 1 };
    scheduleRender();
    return;
  }

  // DRAW LIVE for pencil/highlighter
  if (tempShape && (tempShape.type === 'pencil')) {
    const pressure = (evt.pressure && evt.pressure > 0) ? evt.pressure : 1;
    tempShape.points.push({ x: pos.x, y: pos.y, w: pencilSize * pressure });
    // immediate drawing uses scheduleRender + draw on top inside render
    scheduleRender();
    return;
  }
  if (tempShape && (tempShape.type === 'highlighter')) {
    const pressure = (evt.pressure && evt.pressure > 0) ? evt.pressure : 1;
    tempShape.points.push({ x: pos.x, y: pos.y, w: 100});
    // immediate drawing uses scheduleRender + draw on top inside render
    scheduleRender();
    return;
  }

  // DRAW TEMP SHAPE resizing preview
  if (tempShape) {
    tempShape.w = pos.x - startPos.x;
    tempShape.h = pos.y - startPos.y;
    scheduleRender();
    return;
  }

  // SELECT dragging/resizing/rotation
  if (tool === 'select' && selectedIndex !== null) {
    const obj = objects[selectedIndex];
    if (dragging) {
      if (obj.type === 'pencil' || obj.type === 'polygon' || obj.type === 'highlighter') {
        const b = getObjectBounds(obj);
        const newX = pos.x - dragOffset.x, newY = pos.y - dragOffset.y;
        const dx = newX - b.x, dy = newY - b.y;
        obj.points = obj.points.map(p => ({ x: p.x + dx, y: p.y + dy, w: p.w }));
      } else {
        obj.x = pos.x - dragOffset.x; obj.y = pos.y - dragOffset.y;
      }
      repaintWorkBuffer(selectedIndex); scheduleRender();
      updatePropertiesPanel();
      return;
    }
    if (resizing && activeHandle) {
      // keep aspect if Shift pressed
      const keepAspect = !!(evt.shiftKey);
      switch (activeHandle) {
        case 'br':
          if (keepAspect) {
            const b = getObjectBounds(obj);
            const ratio = b.w / Math.max(1, b.h);
            obj.w = pos.x - obj.x;
            obj.h = obj.w / (ratio || 1);
          } else { obj.w = pos.x - obj.x; obj.h = pos.y - obj.y; }
          break;
        case 'tr':
          if (keepAspect) {
            const b = getObjectBounds(obj);
            const ratio = b.w / Math.max(1, b.h);
            obj.w = pos.x - obj.x; obj.h = (obj.y + obj.h) - pos.y; obj.y = pos.y; obj.w = obj.h * ratio;
          } else { obj.w = pos.x - obj.x; obj.h = (obj.y + obj.h) - pos.y; obj.y = pos.y; }
          break;
        case 'bl':
          if (keepAspect) {
            const b = getObjectBounds(obj); const ratio = b.w / Math.max(1, b.h);
            obj.w = (obj.x + obj.w) - pos.x; obj.x = pos.x; obj.h = pos.y - obj.y; obj.w = obj.h * ratio;
          } else { obj.w = (obj.x + obj.w) - pos.x; obj.x = pos.x; obj.h = pos.y - obj.y; }
          break;
        case 'tl':
          if (keepAspect) {
            const b = getObjectBounds(obj); const ratio = b.w / Math.max(1, b.h);
            obj.w = (obj.x + obj.w) - pos.x; obj.h = (obj.y + obj.h) - pos.y; obj.x = pos.x; obj.y = pos.y; // approximate
            obj.w = obj.h * ratio;
          } else { obj.w = (obj.x + obj.w) - pos.x; obj.h = (obj.y + obj.h) - pos.y; obj.x = pos.x; obj.y = pos.y; }
          break;
      }
      repaintWorkBuffer(selectedIndex); scheduleRender(); updatePropertiesPanel();
      return;
    }
    if (rotateMode || activeHandle === 'rotate') {
      // compute angle between center and pointer
      const b = getObjectBounds(obj);
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const angle = radToDeg(Math.atan2(pos.y - cy, pos.x - cx));
      obj.rotation = angle + 90; // rotate handle top center oriented
      repaintWorkBuffer(selectedIndex); scheduleRender(); updatePropertiesPanel();
      return;
    }
  }

});

canvas.addEventListener('pointerup', (evt) => {
  const pos = getPos(evt);
  pointerDown = false;
  lastEraserPos = null;

  // finish erasing
  if (erasing) {
    erasing = false; erasedIndicesDuringDrag.clear(); repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); return;
  }
  if (tool === "image") {
  const img = new Image();
  img.onload = () => {
    pushUndo();
    const o = {
  type: "image",
  x: pos.x - 50,
  y: pos.y - 50,
  w: 100,
  h: 100,
  imgSrc: img.src   // ✅ only keep URL
  // ❌ do not include: img: img
};
objects.push(o);

    selectedIndex = objects.length - 1;
    repaintBuffer();
    repaintWorkBuffer(selectedIndex);
    scheduleRender();
    tempShape = null;
  };
  img.src = prompt("Enter image URL:");
  drawing = false;
  return;
}
if (tool === "text") {
  const input = prompt("Enter text:");
  if (input) {
    pushUndo();
    const o = {
      type: "text",
      x: pos.x,
      y: pos.y,
      text: input,
      size: 24,
      color: currentColor
    };
    objects.push(o);
    selectedIndex = objects.length - 1;
    repaintBuffer();
    repaintWorkBuffer(selectedIndex);
    scheduleRender();
  }
  drawing = false;
  return;
}

  // finish polygon: double-click or small-time click pattern detection
  if (tool === 'polygon' && polygonTempPoints && polygonTempPoints.length >= 10) {
    // finish polygon if user did a double click: we detect by proximity to last point
    const last = polygonTempPoints[polygonTempPoints.length - 1];
    const distToStart = Math.hypot(pos.x - polygonTempPoints[0].x, pos.y - polygonTempPoints[0].y);
    const distToLast = Math.hypot(pos.x - last.x, pos.y - last.y);
    // if click near first point or double click, commit
    if (distToStart < 12 || distToLast < 6) {
      pushUndo();
      const poly = { type: 'polygon', points: polygonTempPoints.slice(0, polygonTempPoints.length - (distToLast < 6 ? 0 : 1)), color: currentColor, width: pencilSize, dotted, fill: fillMode, opacity: 1 };
      objects.push(poly);
      selectedIndex = objects.length - 1;
      polygonTempPoints = null; tempShape = null;
      repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); updatePropertiesPanel();
      return;
    } else {
      // add a visual anchor and keep going
      // handled already in pointerdown
      return;
    }
  }

  // finish drawing temp shapes
  if (tempShape) {
    normalizeShape(tempShape);
    pushUndo();
    // for pencil/highlighter: keep as drawn
    objects.push(deepClone(tempShape));
    // auto-select last drawn non-pencil (user requested)
    if (tempShape.type !== 'pencil' && tempShape.type !== 'highlighter' && tempShape.type !== 'line' && tempShape.type !== 'arrow') {
      selectedIndex = objects.length - 1;
      repaintWorkBuffer(selectedIndex);
    }
    tempShape = null; repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); updatePropertiesPanel();
    return;
  }

  // finish dragging/resizing/rotate
  if (dragging || resizing || rotateMode) {
    dragging = false; resizing = false; rotateMode = false; activeHandle = null; repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); updatePropertiesPanel(); return;
  }

});
//normize shape//
function normalizeShape(o) {
  if(o.type === "line" || o.type === "arrow"){
    if ("w" in o && "h" in o) {

  }}
  else if(o.type === "rhombus" || o.type == "squarepyramid" || o.type == "cone" || o.type == "triangle"){
    if ("w" in o && "h" in o) {
    if (o.w < 0) {
      o.x += o.w;
      o.w = Math.abs(o.w);
    }
    if (o.h < 0) {
      o.y += o.h;
      o.h = Math.abs(o.h);
      o.rotation = 180; // 🔴 flip 180° if drawn up
    }}
  }
  else{
  if ("w" in o && "h" in o) {
    if (o.w < 0) {
      o.x += o.w;
      o.w = Math.abs(o.w);
    }
    if (o.h < 0) {
      o.y += o.h;
      o.h = Math.abs(o.h);
    }
  }}
}

canvas.addEventListener("dblclick", e => {
  const pos = getPos(e);
  for (let i = objects.length - 1; i >= 0; i--) {
    if (objects[i].type === "text" && isPointInObject(pos.x, pos.y, objects[i])) {
      const newText = prompt("Edit text:", objects[i].text);
      if (newText !== null) {
        objects[i].text = newText;
        repaintBuffer();
        repaintWorkBuffer();
        scheduleRender();
      }
      break;
    }
  }
});
canvas.addEventListener('pointercancel', () => {
  drawing = false; dragging = false; resizing = false; rotateMode = false; tempShape = null; erasing = false; scheduleRender();
});

/////////////////////////
// Text editor helper
/////////////////////////
function createTextEditor(index) {
  const obj = objects[index];
  if (!obj || obj.type !== 'text') return;
  // create an input overlay positioned over 
  const input = document.createElement('textarea');
  input.value = obj.text || '';
  input.style.position = 'fixed';
  input.style.zIndex = 100000;
  input.style.background = 'transparent';
  input.style.color = obj.color || '#fff';
  input.style.border = '2px dashed rgba(255,255,255,0.3)';
  input.style.font = (obj.fontSize || 32) + 'px ' + (obj.fontFamily || 'MANIC, sans-serif');
  input.style.left = (canvas.getBoundingClientRect().left + (obj.x || 0) * (canvas.clientWidth / canvas.width)) + 'px';
  input.style.top = (canvas.getBoundingClientRect().top + (obj.y || 0) * (canvas.clientHeight / canvas.height)) + 'px';
  input.style.width = '240px';
  input.style.height = '80px';
  input.style.color = currentColor || '#ffffff';
  document.body.appendChild(input);
  input.focus();

  function commit() {
    obj.text = input.value;
    document.body.removeChild(input);
    repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); updatePropertiesPanel();
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.ctrlKey) { commit(); } });
}

/////////////////////////
// Properties panel
/////////////////////////
function updatePropertiesPanel() {
  const el = document.getElementById('propContent');
  if (!el) return;
  if (selectedIndex === null) { el.innerHTML = 'No selection'; return; }
  const o = objects[selectedIndex];
  if (!o) { el.innerHTML = 'No selection'; return; }

  // build HTML controls
  el.innerHTML = '';
  const title = document.createElement('div'); title.textContent = `Type: ${((o.type).replace('square','')).replace('rect','retangle')  }`; title.style.fontWeight = '600'; el.appendChild(title);
  const mdiv = document.createElement('div'); mdiv.className = "mar";
  el.appendChild(mdiv)
  // Color
  const colorRow = document.createElement('div'); colorRow.style.marginTop = '8px';
  const colordiv = document.createElement('div'); colordiv.className = "checkmark2";
  const colorInput = document.createElement('input');colorInput.id = 'colorPicker'; colorInput.className = "colorPickerx";colorInput.type = 'color'; colorInput.value = o.color || currentColor; colorInput.addEventListener('input', (e) => { o.color = e.target.value; repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); colordiv.style.backgroundColor = e.target.value;});
  colordiv.style.backgroundColor = o.color;
  colorRow.appendChild(colordiv); colorRow.appendChild(colorInput); el.appendChild(colorRow);

    // Fill toggle
  const fillRow = document.createElement('div'); fillRow.style.marginTop = '8px'; fillRow.className = "con";
  const filldiv = document.createElement('div'); filldiv.className = "checkmark";
  const fillCheckbox = document.createElement('input'); fillCheckbox.type = 'checkbox'; fillCheckbox.checked = !!o.fill; fillCheckbox.addEventListener('change', (e) => { o.fill = e.target.checked; repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); if(fillCheckbox.checked){filldiv.style.backgroundColor = o.color}else{filldiv.style.backgroundColor = 'transparent'}});
  fillRow.appendChild(filldiv); fillRow.appendChild(fillCheckbox);
  if(fillCheckbox.checked){filldiv.style.backgroundColor = o.color}else{filldiv.style.backgroundColor = 'transparent'}
  el.appendChild(fillRow);

  // Stroke width
 if(o.type === 'image'){
  const widthRow = document.createElement('div'); widthRow.style.marginTop = '8px';
  widthRow.innerHTML = `<label style="display:block;font-size:12px">Size</label>`;
  const widthInput = document.createElement('input');
  widthInput.type = 'range';
  widthInput.min = 50;     // min width in px
  widthInput.max = 1600;   // max width in px
  widthInput.value = o.w || 100;  // current width
  widthInput.addEventListener('input', (e) => { 
    zoomObject(o, parseInt(e.target.value)); 
  });
  widthRow.appendChild(widthInput); 
  el.appendChild(widthRow);
}

  else{
    const widthRow = document.createElement('div'); widthRow.style.marginTop = '8px';
  widthRow.innerHTML = `<label style="display:block;font-size:12px">Stroke</label>`;
  const widthInput = document.createElement('input'); widthInput.type = 'range'; widthInput.min = 1; widthInput.max = 60; widthInput.value = o.width || pencilSize; widthInput.addEventListener('input', (e) => { o.width = parseInt(e.target.value); repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); });
  widthRow.appendChild(widthInput); el.appendChild(widthRow);
  }

  // Opacity
  const opRow = document.createElement('div'); opRow.style.marginTop = '8px';
  opRow.innerHTML = `<label style="display:block;font-size:12px">Opacity</label>`;
  const opInput = document.createElement('input'); opInput.type = 'range'; opInput.min = 0.1; opInput.max = 1; opInput.step = 0.05; opInput.value = (o.opacity !== undefined ? o.opacity : 1); opInput.addEventListener('input', (e) => { o.opacity = parseFloat(e.target.value); repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); });
  opRow.appendChild(opInput); el.appendChild(opRow);

  // Rotation
  const rotRow = document.createElement('div'); rotRow.style.marginTop = '8px';
  rotRow.innerHTML = `<label style="display:block;font-size:12px">Rotation (deg)</label>`;
  const rotInput = document.createElement('input'); rotInput.type = 'range'; rotInput.min = 0; rotInput.max = 360; rotInput.value = o.rotation || 0; rotInput.addEventListener('input', (e) => { o.rotation = parseFloat(e.target.value) || 0; repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); });
  rotRow.appendChild(rotInput); el.appendChild(rotRow);

  // Font settings for text
  if (o.type === 'text') {
    const fontRow = document.createElement('div'); fontRow.style.marginTop = '8px';
    fontRow.innerHTML = `<label style="display:block;font-size:12px">Font Size</label>`;
    const fontInput = document.createElement('input'); fontInput.type = 'number'; fontInput.value = o.fontSize || 32; fontInput.addEventListener('input', (e) => { o.fontSize = parseInt(e.target.value) || 12; repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); });
    fontRow.appendChild(fontInput); el.appendChild(fontRow);
  }


}

// Keyboard shortcut
document.addEventListener("keydown", e => {
  if (e.ctrlKey && e.key.toLowerCase() === "d") {
    e.preventDefault();
    smartDuplicate();
  }
});

///////////////////
// set tool //////
/////////////////
function setTool(newTool) {
  tool = newTool;
  selectedIndex = null;
  multiSelected = [];
  tempShape = null;
  scheduleRender();
  document.getElementById('propertiesPanel').style.bottom = '-50px';
  if(newTool === 'select'){
  document.getElementById('toolOptions').innerHTML = '';
  document.querySelectorAll('#toolbar button[data-tool]').forEach(btn => {
    document.querySelectorAll('#toolbar button').forEach(b => b.classList.remove('active'));
    tempShape = null;
    repaintWorkBuffer(); scheduleRender(); updateCursor();});
document.querySelector('#toolbar button[data-tool="select"]')?.classList.add('active');}
updatePropertiesPanel();
}

/////////////////////////
// Image helper
/////////////////////////
function addImage() {
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        pushUndo();
        let ih = 450, iw = 450;
        if(img.width > img.height){
          ih = 450;
          iw = (img.width / img.height)*450
        }else{
          ih = (img.height / img.width)*400;
          iw = 400
        }
        const obj = { type: 'image', img, imgSrc: ev.target.result, x: 300, y: 100, w: iw, h: ih, color: currentColor };
        objects.push(obj); selectedIndex = objects.length - 1; repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); updatePropertiesPanel();
      };
      setTool('select');
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  input.click();

}
window.addImage = addImage;

function zoomObject(obj, newWidth) {
  if (!obj || obj.type !== 'image') return;
  const ratio = obj.h / obj.w;   // preserve aspect ratio
  obj.w = newWidth;
  obj.h = newWidth * ratio;
  repaintBuffer();
  repaintWorkBuffer(selectedIndex);
  scheduleRender();
}

function addBase64Image(base64String) {
  const img = new Image();
  img.onload = () => {
    pushUndo();
    let ih = 450, iw = 450;
    if(img.width > img.height){
      ih = 450;
      iw = (img.width / img.height)*450
    }else{
      ih = (img.height / img.width)*400;
      iw = 400;}
    const obj = { 
      type: 'image', 
      img, 
      imgSrc: base64String, 
      x: 300, 
      y: 100, 
      w: iw, 
      h: ih, 
      color: currentColor 
    };
    objects.push(obj);
    selectedIndex = objects.length - 1;
    repaintBuffer();
    repaintWorkBuffer(selectedIndex);
    scheduleRender();
    updatePropertiesPanel();
  };
  setTool('select');
  img.src = base64String;
  
}



// ---------- Pointer position helper ----------
function getPos(evt) {
  const rect = canvas.getBoundingClientRect();
  const clientX = (evt.clientX !== undefined)
    ? evt.clientX
    : (evt.touches && evt.touches[0] && evt.touches[0].clientX);
  const clientY = (evt.clientY !== undefined)
    ? evt.clientY
    : (evt.touches && evt.touches[0] && evt.touches[0].clientY);

  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height)
  };
}

/////////////////////////
// Delete selected
/////////////////////////
function deleteaa() {
  if (selectedIndex != null) {
    pushUndo();
    objects.splice(selectedIndex, 1);
    selectedIndex = null;
    repaintBuffer(); repaintWorkBuffer(); scheduleRender(); updatePropertiesPanel();
  }
  
}
window.deleteaa = deleteaa;

/////////////////////////
// Pages support
/////////////////////////
function saveCurrentPage() { pages[currentPage] = deepClone(objects); }
function switchPage(index) {
  if (index < 0 || index >= pages.length) return;
  saveCurrentPage();
  currentPage = index; objects = deepClone(pages[currentPage]); selectedIndex = null; tempShape = null; ensureImages(objects); repaintBuffer(); repaintWorkBuffer(); scheduleRender(); updatePageCounter(); updatePropertiesPanel();
}
function addPage() { saveCurrentPage(); pages.push([]); switchPage(pages.length - 1); }
function deletePage() { if (pages.length <= 1) return; pages.splice(currentPage, 1); if (currentPage >= pages.length) currentPage = pages.length - 1; objects = deepClone(pages[currentPage]); selectedIndex = null; updatePageCounter(); repaintBuffer(); repaintWorkBuffer(); scheduleRender(); }
function prevPage() { switchPage(currentPage - 1); }
function nextPage() { if (currentPage < pages.length - 1) switchPage(currentPage + 1); else if (objects.length > 0) addPage(); }
window.addPage = addPage; window.prevPage = prevPage; window.nextPage = nextPage; window.deletePage = deletePage;
function updatePageCounter() {
  const el = $('pageCounter'); if (el) el.textContent = `Page ${currentPage + 1} / ${pages.length}`;
}
window.updatePageCounter = updatePageCounter;

/////////////////////////
// Save PDF (kept as original behavior)
/////////////////////////
async function savePDF(fname) {
  saveCurrentPage();
  const { jsPDF } = window.jspdf;
  render(); // ensure current view
  const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'l' : 'p', unit: 'px', format: [canvas.width, canvas.height] });
  for (let i = 0; i < pages.length; i++) {
    if (i > 0) pdf.addPage([canvas.width, canvas.height], canvas.width > canvas.height ? 'l' : 'p');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const settings = JSON.parse(localStorage.getItem("appSettings") || "{}");
    ctx.fillStyle = settings.backgroundColor || "#1618211";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const pageObjects = pages[i];
    for (const o of pageObjects) {
      if (o.type === 'image' && o.imgSrc && !o.img) {
        await new Promise(resolve => {
          const img = new Image();
          img.onload = () => { o.img = img; drawObject(o, false); resolve(); };
          img.src = o.imgSrc;
        });
      } else {
        drawObject(o, false);
      }
    }
    const imgData = canvas.toDataURL('image/jpeg');
    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
    // watermark
    pdf.setTextColor(28, 227, 117);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(20);
    pdf.text(settings.watermark, 10, canvas.height - 10);
    pdf.setTextColor(255, 255, 255); pdf.setFont('times', 'normal'); pdf.setFontSize(15);
    const now = new Date();
    const dateStr = now.toLocaleDateString().replaceAll('/', '-');
    const dateWidth = pdf.getTextWidth(dateStr);
    pdf.text(dateStr, canvas.width - 10 - dateWidth, canvas.height - 10);
  }
  const now = new Date();
  const dateStr = now.toLocaleDateString().replaceAll('/', '-');
  const filename = fname+dateStr+'.pdf' || dateStr+'.pdf';
  pdf.save(filename.endsWith('.pdf') ? filename : filename + '.pdf');
  scheduleRender();
}




/////////////////////////
// Ensure images load their base64
/////////////////////////
function ensureImages(arr) {
  arr.forEach(o => {
    if (o.type === 'image' && !o.img && o.imgSrc) {
      const img = new Image();
      img.onload = () => { o.img = img; repaintBuffer(); repaintWorkBuffer(); scheduleRender(); };
      img.src = o.imgSrc;
    }
  });
}

/////////////////////////
// Cursor & UI wiring
/////////////////////////
const customCursor = $('customCursor');
function updateCursor() {
  if (!customCursor) return;
  if (tool === 'eraser') { customCursor.style.width = eraserSize + 'px'; customCursor.style.height = eraserSize + 'px'; customCursor.style.borderColor = 'red'; }
  else if (tool === 'pencil') { customCursor.style.width = pencilSize * 2 + 'px'; customCursor.style.height = pencilSize * 2 + 'px'; customCursor.style.borderColor = currentColor; }
  else if (tool === 'select') { customCursor.style.width = '20px'; customCursor.style.height = '20px'; customCursor.style.borderColor = '#b00bfd6c'; }
  else { customCursor.style.width = pencilSize * 2 + 'px'; customCursor.style.height = pencilSize * 2 + 'px'; customCursor.style.borderColor = currentColor; }
}
window.updateCursor = updateCursor;

document.addEventListener('mousemove', e => {
  if (!customCursor) return;
  customCursor.style.left = e.clientX + 'px';
  customCursor.style.top = e.clientY + 'px';
});

// toolbar data-tool wiring (preserve your existing toolbar ids)
document.querySelectorAll('#toolbar button[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#toolbar button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tool = btn.dataset.tool;
    tempShape = null;
    repaintWorkBuffer(); scheduleRender(); updateCursor();
  });
});
document.querySelector('#toolbar button[data-tool="pencil"]')?.classList.add('active');

// color & sliders
$('colorPicker')?.addEventListener('input', e => { currentColor = e.target.value; updateCursor(); });
$('pencilSize')?.addEventListener('input', e => { pencilSize = parseInt(e.target.value); updateCursor(); });
$('eraserSize')?.addEventListener('input', e => { eraserSize = parseInt(e.target.value); updateCursor(); scheduleRender(); });

// dots toggle
window.dotsmaker = function () { dotted = !dotted; const el = $('dot'); if (el) el.style.borderStyle = dotted ? 'dotted' : 'solid'; el.innerHTML = dotted ? '' : ''; };

// fill toggle
$('fillToggle')?.addEventListener('click', () => { fillMode = !fillMode; $('fillToggle')?.classList.toggle('active', fillMode); });

// showToolOptions (keep consistent with your HTML)
function showToolOptions(which) {
  const panel = $('toolOptions'); if (!panel) return;
  dotted = false;
  document.getElementById('dot').style.borderStyle = 'solid';
  selectedIndex = null;
  tempShape = null;
  scheduleRender();
  panel.innerHTML = ''; panel.style.display = 'flex';
  if (which === 'pencil') {
    panel.innerHTML = `
      <button data-tool="pencil" class="active"></button>
      <button data-tool="line">󰕞</button>
      <button data-tool="arrow">󰁜</button>
      <button data-tool="highlighter">󰸱</button>
    `;
  } else if (which === 'rect') {
    panel.innerHTML = `
      <button data-tool="rect" class="active">󰝣</button>
      <button data-tool="circle"></button>
      <button data-tool="triangle">󰔷</button>
      <button data-tool="rhombus">󰜌</button>
      <button data-tool="pentagon">󰜀</button>
      <button data-tool="hexagon">󰋙</button>
    `;
  } else if (which === 'cuboid') {
    panel.innerHTML = `
      <button data-tool="cuboid" class="active">󰆧</button>
      <button data-tool="cylinder">󱥎</button>
      <button data-tool="cone">󱥌</button>
      <button data-tool="sphere">󱥔</button>

      <button data-tool="tetrahedron">󱥒</button>
      <button data-tool="squarepyramid"><img src="images/pyramid.svg" height="20px" style="margin-left: -3px;margin-top: auto"></button>
    `;
  }
  panel.querySelectorAll('button[data-tool]').forEach(b => {
    b.addEventListener('click', () => {
      panel.querySelectorAll('button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      setTool(b.getAttribute('data-tool') || tool)
      updateCursor();
    });
  });
}
window.showToolOptions = showToolOptions;


function drawGrid() {
  const spacing = 42; // size of grid cells
  ctx.save();
  ctx.strokeStyle = '#777'; // semi-transparent
  ctx.lineWidth = 0.5;

  // vertical lines
  for(let x = 0; x <= canvas.width; x += spacing){
    ctx.beginPath();
    ctx.moveTo(x,0);
    ctx.lineTo(x,canvas.height);
    ctx.stroke();
  }

  // horizontal lines
  for(let y = 0; y <= canvas.height; y += spacing){
    ctx.beginPath();
    ctx.moveTo(0,y);
    ctx.lineTo(canvas.width,y);
    ctx.stroke();
  }
  ctx.restore();
}


/////////////////////////
// Date/time and startup
/////////////////////////
function updateDateTime() {
  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const el = $('dateTime'); if (el) el.textContent = `${dateStr} ${timeStr}`;
}
updateDateTime(); setInterval(updateDateTime, 1000);


/////////////////////////
// Export quick PNG
/////////////////////////
function savePNG() {
  const link = document.createElement('a'); link.download = 'blackboard.png'; link.href = canvas.toDataURL('image/png'); link.click();
}
window.savePNG = savePNG;
// ---------- EXPORT PROJECT AS JSON ----------
function exportProject() {
  const data = {
    pages,
    currentPage,
    settings: {
      pencilSize,
      eraserSize,
      currentColor
    }
  };
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const link = document.createElement("a");
  link.download = "blackboard.json";
  link.href = URL.createObjectURL(blob);
  link.click();
}


/////////////////////////
// Expose useful functions to window (your HTML used them)
/////////////////////////
window.deleteaa = deleteaa;
window.savePDF = savePDF;
window.undo = undo;
window.redo = redo;


/////////////////////////
// Final initial paint
/////////////////////////
ensureImages(objects);
repaintBuffer();
repaintWorkBuffer();
scheduleRender();




/////////////////////////
// Auto Save & Load Session
/////////////////////////

const DB_NAME = 'CodrawDB';
const DB_VERSION = 1;
const PAGE_STORE = 'pages';
const META_STORE = 'meta';
let db = null;

// --- open DB ---
function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const d = ev.target.result;
      if (!d.objectStoreNames.contains(PAGE_STORE)) d.createObjectStore(PAGE_STORE, { keyPath: 'id' });
      if (!d.objectStoreNames.contains(META_STORE)) d.createObjectStore(META_STORE, { keyPath: 'key' });
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

// --- helper: put into store ---
async function dbPut(storeName, value) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(storeName, 'readwrite');
    const s = tx.objectStore(storeName);
    const r = s.put(value);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function dbGetAll(storeName) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(storeName, 'readonly');
    const s = tx.objectStore(storeName);
    const r = s.getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function dbGet(storeName, key) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(storeName, 'readonly');
    const s = tx.objectStore(storeName);
    const r = s.get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

// --- convert remote/cross-origin images to dataURL (uses fetch -> blob -> FileReader)
// If the image is already a data: URL it returns immediately.
async function convertImageToDataURL(url, useProxyIfNeeded = true) {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  // if images.weserv.nl should be used to avoid CORS, route through it
  const tryUrl = useProxyIfNeeded ? ('https://images.weserv.nl/?url=' + encodeURIComponent(url.replace(/^https?:\/\//, ''))) : url;
  try {
    const res = await fetch(tryUrl);
    if (!res.ok) throw new Error('Fetch failed: ' + res.status);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('convertImageToDataURL failed for', url, err);
    // last attempt: try original URL without proxy
    if (useProxyIfNeeded) {
      return convertImageToDataURL(url, false);
    }
    return null;
  }
}


function toggleFullscreen() {
  if (!document.fullscreenElement) {
    const elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen();
  } else if (elem.mozRequestFullScreen) {
    elem.mozRequestFullScreen();
  } else if (elem.webkitRequestFullscreen) {
    elem.webkitRequestFullscreen();
  } else if (elem.msRequestFullscreen) {
    elem.msRequestFullscreen();
  }
  } else {
    if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }
  }
}

// --- ensure every image object in page has imgSrc as data: URL (non-blocking conversion)
async function ensureImageDataInPage(pageObjects) {
  // returns a clone with image data-URLs ensured (deep clone except DOM img)
  const clone = JSON.parse(JSON.stringify(pageObjects, (k, v) => (k === 'img' ? undefined : v)));
  for (let o of clone) {
    if (o.type === 'image') {
      if (o.imgSrc && o.imgSrc.startsWith('data:')) continue;
      // if there is an in-memory HTMLImageElement in original objects, prefer it:
      const orig = objects && objects.find(x => x.imgSrc === o.imgSrc);
      if (orig && orig.img && orig.img.src && orig.img.src.startsWith('data:')) {
        o.imgSrc = orig.img.src;
        continue;
      }
      // otherwise convert the o.imgSrc (remote) to data URL
      if (o.imgSrc) {
        const data = await convertImageToDataURL(o.imgSrc);
        if (data) o.imgSrc = data;
      }
    }
  }
  return clone;
}

// --- save one page to DB (converts images to data URLs first)
async function savePageToDB(pageIndex) {
  try {
    await openDB();
    const pageObj = pages[pageIndex] || [];
    // ensure current objects kept in sync
    if (pageIndex === currentPage) saveCurrentPage();
    // convert images to dataURL and get serializable clone
    const serial = await ensureImageDataInPage(pageObj);
    await dbPut(PAGE_STORE, { id: pageIndex, timestamp: Date.now(), data: serial });
    // store meta: highest page index and currentPage
    await dbPut(META_STORE, { key: 'meta', value: { pageCount: pages.length, currentPage } });
    console.log('Saved page', pageIndex+1);
  } catch (err) {
    console.error('savePageToDB', err);
  }
}

async function saveAllPagesToDB() {
  for (let i = 0; i < pages.length; i++) {
    await savePageToDB(i);
  }
}

// --- load all pages from DB into pages[] and objects
async function loadSessionFromDB() {
  try {
    await openDB();
    const rows = await dbGetAll(PAGE_STORE);
    if (!rows || rows.length === 0) {
      // no saved session
      console.log('No saved pages in DB');
      return false;
    }
    // sort by id to build pages array
    rows.sort((a, b) => a.id - b.id);
    const loadedPages = rows.map(r => r.data || []);
    pages = loadedPages.length ? loadedPages : [[]];
    const meta = await dbGet(META_STORE, 'meta');
    currentPage = meta && meta.value && typeof meta.value.currentPage === 'number' ? meta.value.currentPage : 0;
    if (currentPage >= pages.length) currentPage = pages.length - 1;
    objects = deepClone(pages[currentPage]) || [];
    selectedIndex = null;
    ensureImages(objects); // creates Image elements where needed
    // redraw
    updatePageCounter();
    repaintBuffer();
    repaintWorkBuffer();
    scheduleRender();
    updatePropertiesPanel?.();
    updateCursor?.();
    console.log('Loaded session from DB, pages:', pages.length);
    return true;
  } catch (err) {
    console.error('loadSessionFromDB', err);
    return false;
  }
}

// --- fallback: if IndexedDB not available, store brief copy to localStorage (page-by-page)
function savePageToLocalStorage(pageIndex) {
  try {
    saveCurrentPage();
    const key = 'codraw_page_' + pageIndex;
    localStorage.setItem(key, JSON.stringify(pages[pageIndex]));
    localStorage.setItem('codraw_meta', JSON.stringify({ pageCount: pages.length, currentPage }));
  } catch (e) { console.warn('localStorage fallback failed', e); }
}

// --- debounce auto-save to avoid heavy writes while drawing
let autosaveTimer = null;
function autoSaveDebounced(delay = 800) {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    try {
      saveCurrentPage();
      // try IndexedDB first
      if (window.indexedDB) {
        await savePageToDB(currentPage);
      } else {
        savePageToLocalStorage(currentPage);
      }
    } catch (err) {
      console.error('autoSaveDebounced error', err);
    }
    autosaveTimer = null;
  }, delay);
}

// --- wrapper to instrument functions that modify state (so they auto-save)
// safeWrap will preserve original function
function safeWrap(name) {
  try {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function(...args) {
      const res = orig.apply(this, args);
      try { autoSaveDebounced(); } catch (e) {}
      return res;
    };
  } catch (e) { console.warn('wrap failed', name, e); }
}

// list of functions to wrap (adjust as necessary)
const AUTO_WRAP = [
  'addPage','deletePage','prevPage','nextPage',
  'deleteaa','addImage','addBase64Image',
  'undo','redo','pushUndo'
];

// call to wrap existing functions (if already defined)
function wrapAllModifyingFunctions() {
  AUTO_WRAP.forEach(fn => safeWrap(fn));
}

// --- public initializer you should call on startup
async function initAutoSave() {
  try {
    await openDB();
    wrapAllModifyingFunctions();
    // attempt load from DB; if fails, fallback to localStorage
    const ok = await loadSessionFromDB();
    if (!ok) {
      // try localStorage fallback
      const meta = localStorage.getItem('codraw_meta');
      if (meta) {
        try {
          const m = JSON.parse(meta);
          const pageCount = m.pageCount || 1;
          pages = [];
          for (let i = 0; i < pageCount; i++) {
            const p = localStorage.getItem('codraw_page_' + i);
            pages.push(p ? JSON.parse(p) : []);
          }
          currentPage = m.currentPage || 0;
          objects = deepClone(pages[currentPage]) || [];
          ensureImages(objects);
          updatePageCounter(); repaintBuffer(); repaintWorkBuffer(); scheduleRender();
          console.log('Loaded fallback from localStorage');
        } catch (e) {
          console.warn('fallback localStorage parse failed', e);
        }
      }
    }
  } catch (err) {
    console.warn('initAutoSave error', err);
  }
}

function clearLocalStorageData() {
  try {
    // Remove all page data
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('codraw_page_') || key === 'codraw_meta') {
        localStorage.removeItem(key);
      }
    });
    console.log('LocalStorage cleared');
  } catch (e) {
    console.error('Failed to clear localStorage', e);
  }
}
async function clearIndexedDB() {
  return new Promise((resolve, reject) => {
    if (db) db.close(); // close current connection
    const req = indexedDB.deleteDatabase('CodrawDB');
    req.onsuccess = () => { console.log('IndexedDB cleared'); resolve(); };
    req.onerror = (e) => { console.error('Failed to clear IndexedDB', e); reject(e); };
    req.onblocked = () => { console.warn('Delete blocked'); };
  });
}
async function clearAllSavedData() {
  clearLocalStorageData();
  await clearIndexedDB();
  // Reset in-memory state if needed
  pages = [[]];
  currentPage = 0;
  objects = [];
  console.log('All saved data cleared');
}
// --- auto-save

 async function handleLoad() {
    document.getElementById('modalOverlay').style.display = 'none';
    if (typeof initAutoSave === 'function') {
      await initAutoSave(); // load session
    }
    startAutoSaveLoop();
  }

  async function handleDelete() {
    document.getElementById('modalOverlay').style.display = 'none';
    if (typeof clearLocalStorageData === 'function') clearLocalStorageData();
    if (typeof clearIndexedDB === 'function') await clearIndexedDB();
    pages = [[]];
    currentPage = 0;
    objects = [];
    if (typeof initAutoSave === 'function') await initAutoSave(); // start fresh
    startAutoSaveLoop();
  }

function savecatch(){
        repaintBuffer(); repaintWorkBuffer(); scheduleRender(); updatePageCounter(); updateCursor();
        console.log('saving')
        try {
        saveCurrentPage();
        autoSaveDebounced(0);
      } catch (e) {
        console.warn("Periodic autosave failed:", e);
      }
}

  function startAutoSaveLoop() {
    setTimeout(() => {
    const s = $('startup'); if (!s) return; s.classList.add('fade-out'); setTimeout(() => { try { s.remove(); } catch (e) {} }, 1000);
  }, 2500);
  repaintBuffer(); repaintWorkBuffer(); scheduleRender(); updatePageCounter(); updateCursor(); 
    setInterval(() => {
      try {
        saveCurrentPage();
        autoSaveDebounced(0);
      } catch (e) {
        console.warn("Periodic autosave failed:", e);
      }
    }, 5000);
  }
