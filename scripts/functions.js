function degToRad(d) { return d * Math.PI / 180; }
function radToDeg(r) { return r * 180 / Math.PI; }

function randomizeGlobalGradient() {
    globalGradientAngle = Math.random() * Math.PI * 2;
    const rainbow = ["red","orange","yellow","green","cyan","blue","violet"];
    for (let i = rainbow.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rainbow[i], rainbow[j]] = [rainbow[j], rainbow[i]];
    }
    globalGradientStops = rainbow.map((c, i) => {
    return { offset: i / (rainbow.length - 1), color: c };
    });
}

function handleGroupAtPoint(px, py, indices) {
  const b = getGroupBounds(indices);
  if (!b) return null;
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

// --- rendering, hit test and utility functions moved from main.js ---

// buildPathFor is provided by draw.js; keep thin wrapper to avoid runtime errors if draw.js not loaded
// buildPathFor implementation lives in draw.js and is loaded before this file.

function isPointInObject(px, py, o) {
    bufferCtx.save();
    bufferCtx.beginPath();
    switch (o.type) {
        case "pencil":
        case 'highlighter':
            if (!o.points || o.points.length < 2) break;
            bufferCtx.moveTo(o.points[0].x, o.points[0].y);
            for (let i = 1; i < o.points.length; i++) bufferCtx.lineTo(o.points[i].x, o.points[i].y);
            bufferCtx.lineWidth = (o.width || 2) + 6;
            if (bufferCtx.isPointInStroke(px, py)) { bufferCtx.restore(); return true; }
            break;
        case "image": {
            const rx = Math.min(o.x, o.x + o.w); const ry = Math.min(o.y, o.y + o.h); const rw = Math.abs(o.w); const rh = Math.abs(o.h);
            bufferCtx.rect(rx, ry, rw, rh);
            break;
        }
        case "line":
        case "arrow":
            bufferCtx.moveTo(o.x, o.y); bufferCtx.lineTo(o.x + o.w, o.y + o.h); bufferCtx.lineWidth = (o.width || 2) + 8;
            if (bufferCtx.isPointInStroke(px, py)) { bufferCtx.restore(); return true; }
            break;
        case "rect": {
            const rx = Math.min(o.x, o.x + o.w); const ry = Math.min(o.y, o.y + o.h); const rw = Math.abs(o.w); const rh = Math.abs(o.h);
            bufferCtx.rect(rx, ry, rw, rh); break;
        }
        case "circle": { const cx = o.x + o.w / 2; const cy = o.y + o.h / 2; const rx = Math.abs(o.w) / 2; const ry = Math.abs(o.h) / 2; bufferCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); break; }
        case "triangle": { bufferCtx.moveTo(o.x, o.y + o.h); bufferCtx.lineTo(o.x + o.w, o.y + o.h); bufferCtx.lineTo(o.x + o.w / 2, o.y); bufferCtx.closePath(); break; }
        default: bufferCtx.rect(o.x || 0, o.y || 0, o.w || 0, o.h || 0);
    }
    let hit = false;
    if (o.fill) hit = bufferCtx.isPointInPath(px, py); else { bufferCtx.lineWidth = (o.width || 2) + 6; hit = bufferCtx.isPointInStroke(px, py) || bufferCtx.isPointInPath(px, py); }
    bufferCtx.restore();
    return hit;
}

function eraserHitIndex(pos, size) {
    const half = size / 2;
    for (let i = objects.length - 1; i >= 0; i--) {
        const o = objects[i]; const b = getObjectBounds(o);
        if (pos.x + half < b.x || pos.x - half > b.x + b.w || pos.y + half < b.y || pos.y - half > b.y + b.h) continue;
        bufferCtx.save(); buildPathFor(bufferCtx, o); bufferCtx.lineWidth = (o.width || pencilSize) + size;
        const hitStroke = bufferCtx.isPointInStroke(pos.x, pos.y);
        const hitPath = !!o.fill && bufferCtx.isPointInPath(pos.x, pos.y);
        bufferCtx.restore();
        if (hitStroke || hitPath) return i;
    }
    return null;
}

function setLineDashFor(ctxRef, o) { if (o.dotted) { const unit = Math.max(2, Math.round((o.width || 2) / 2)); ctxRef.setLineDash([unit * 3, unit * 5]); } else ctxRef.setLineDash([]); }

function buildGradientForShape(ctxTarget, o) { let x1, y1, x2, y2; if (o.type === 'pencil' || o.type === 'highlighter' || o.type === 'polygon') { if (o.points && o.points.length >= 2) { x1 = o.points[0].x; y1 = o.points[0].y; const last = o.points[o.points.length - 1]; x2 = last.x; y2 = last.y; } else { const b = getObjectBounds(o); x1 = b.x; y1 = b.y; x2 = b.x + b.w; y2 = b.y; } } else { const b = getObjectBounds(o); x1 = b.x; y1 = b.y; x2 = b.x + b.w; y2 = b.y; } if (x1 === x2 && y1 === y2) { x2 = x1 + 1; } const g = ctxTarget.createLinearGradient(x1, y1, x2, y2); const stops = o.gradientStops || gradientStops; stops.forEach(s => g.addColorStop(s.offset, s.color)); return g; }

// drawObject implementation moved to draw.js; keep wrapper to call it
// drawObject is implemented in draw.js and available as a global function loaded before this script.

// drawObject, repaint and render functions are now moved to draw.js
// Add thin indirection to maintain backward compatibility if needed
// drawing helpers like drawObjectOnContext, repaintBuffer, repaintWorkBuffer are implemented in draw.js

function render() { if (typeof drawObject === 'function') { drawRender(); return; } ctx.clearRect(0, 0, canvas.width, canvas.height); if (showGrid) drawGrid(); if (selectedIndex !== null) ctx.drawImage(workCanvas, 0, 0); else ctx.drawImage(bufferCanvas, 0, 0); if (tempShape) drawObject(tempShape, false, ctx); if (tool === 'lasso-eraser') drawLassoPath(); if (selectedIndex !== null && objects[selectedIndex]) drawObject(objects[selectedIndex], true, ctx); if (tool === 'eraser' && lastEraserPos) { ctx.save(); ctx.strokeStyle = '#fff'; ctx.setLineDash([4, 2]); ctx.beginPath(); ctx.arc(lastEraserPos.x, lastEraserPos.y, eraserSize / 2, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); } }

function handleAtPoint(px, py, o) { const b = getObjectBounds(o); const handles = [{ name: 'tl', x: b.x - 8, y: b.y - 8 }, { name: 'tr', x: b.x + b.w, y: b.y - 8 }, { name: 'bl', x: b.x - 8, y: b.y + b.h }, { name: 'br', x: b.x + b.w, y: b.y + b.h }, { name: 'rotate', x: b.x + b.w / 2 - 8, y: b.y - 28 - 8 }]; for (const h of handles) { if (px >= h.x && px <= h.x + 16 && py >= h.y && py <= h.y + 16) return h.name; } return null; }

function normalizeShape(o) { if(o.type === "line" || o.type === "arrow") { if ("w" in o && "h" in o) { } } else if (o.type === "rhombus" || o.type == "squarepyramid" || o.type == "cone" || o.type == "triangle") { if ("w" in o && "h" in o) { if (o.w < 0) { o.x += o.w; o.w = Math.abs(o.w); } if (o.h < 0) { o.y += o.h; o.h = Math.abs(o.h); o.rotation = 180; } } } else { if ("w" in o && "h" in o) { if (o.w < 0) { o.x += o.w; o.w = Math.abs(o.w); } if (o.h < 0) { o.y += o.h; o.h = Math.abs(o.h); } } }
}

function createTextEditor(index) { const obj = objects[index]; if (!obj || obj.type !== 'text') return; const input = document.createElement('textarea'); input.value = obj.text || ''; input.style.position = 'fixed'; input.style.zIndex = 100000; input.style.background = 'transparent'; input.style.color = obj.color || '#fff'; input.style.border = '2px dashed rgba(255,255,255,0.3)'; input.style.font = (obj.fontSize || 32) + 'px ' + (obj.fontFamily || 'MANIC, sans-serif'); input.style.left = (canvas.getBoundingClientRect().left + (obj.x || 0) * (canvas.clientWidth / canvas.width)) + 'px'; input.style.top = (canvas.getBoundingClientRect().top + (obj.y || 0) * (canvas.clientHeight / canvas.height)) + 'px'; input.style.width = '240px'; input.style.height = '80px'; input.style.color = currentColor || '#ffffff'; document.body.appendChild(input); input.focus(); function commit() { obj.text = input.value; document.body.removeChild(input); repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); updatePropertiesPanel(); } input.addEventListener('blur', commit); input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.ctrlKey) { commit(); } }); }

function objectIntersectsPolygon(obj, poly) { if (obj.points) { for (const p of obj.points) { if (bufferCtx.isPointInPath(poly, p.x, p.y)) return true; } return false; } const b = getObjectBounds(obj); const corners = [{x: b.x, y: b.y},{x: b.x+b.w, y: b.y},{x: b.x, y: b.y+b.h},{x: b.x+b.w, y: b.y+b.h},]; for (const c of corners) { if (bufferCtx.isPointInPath(poly, c.x, c.y)) return true; } return false; }

// ---- Multi-select helpers ----
function getGroupBounds(indices) {
  if (!indices || !indices.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const idx of indices) {
    const o = objects[idx]; if (!o) continue;
    const b = getObjectBounds(o);
    minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
  }
  return { x: minX, y: minY, w: Math.max(0, maxX - minX), h: Math.max(0, maxY - minY) };
}

function applyGroupTranslation(indices, dx, dy) {
  for (const idx of indices) {
    const o = objects[idx]; if (!o) continue;
    if (o.points && o.points.length) {
      for (let i = 0; i < o.points.length; i++) { o.points[i].x += dx; o.points[i].y += dy; }
    } else {
      o.x += dx; o.y += dy;
    }
  }
}

function applyGroupScale(indices, originX, originY, scaleX, scaleY) {
  for (const idx of indices) {
    const o = objects[idx]; if (!o) continue;
    if (o.points && o.points.length) {
      for (let i = 0; i < o.points.length; i++) {
        const p = o.points[i]; p.x = originX + (p.x - originX) * scaleX; p.y = originY + (p.y - originY) * scaleY;
      }
    } else {
      o.x = originX + (o.x - originX) * scaleX;
      o.y = originY + (o.y - originY) * scaleY;
      o.w *= scaleX; o.h *= scaleY;
    }
    // scale rotation? rotation remains, but dimension changes will be visible
  }
}

function applyGroupRotate(indices, originX, originY, angleDeg) {
  const sin = Math.sin((angleDeg) * Math.PI / 180);
  const cos = Math.cos((angleDeg) * Math.PI / 180);
  for (const idx of indices) {
    const o = objects[idx]; if (!o) continue;
    const rotatePoint = (x,y)=>{
      const rx = x - originX; const ry = y - originY;
      return { x: originX + rx * cos - ry * sin, y: originY + rx * sin + ry * cos };
    };
    if (o.points && o.points.length) {
      for (let i = 0; i < o.points.length; i++) {
        const p = o.points[i]; const r = rotatePoint(p.x, p.y); p.x = r.x; p.y = r.y; }
    } else {
      const topLeft = rotatePoint(o.x, o.y); o.x = topLeft.x; o.y = topLeft.y;
      o.rotation = (o.rotation || 0) + angleDeg;
    }
  }
}

function drawLassoPath() {
  if (!lassoPath || lassoPath.length < 2) return;
  const color = (tool === 'lasso-select' || (tool === 'select' && lassoSelecting)) ? 'rgba(0,122,255,0.85)' : 'rgba(255,0,0,0.8)';
  ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(lassoPath[0].x, lassoPath[0].y);
  for (let i = 1; i < lassoPath.length; i++) { ctx.lineTo(lassoPath[i].x, lassoPath[i].y); }
  ctx.stroke(); ctx.restore();
}

function drawGrid() { const spacing = 42; ctx.save(); ctx.strokeStyle = '#777'; ctx.lineWidth = 0.5; for (let x = 0; x <= canvas.width; x += spacing) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); } for (let y = 0; y <= canvas.height; y += spacing) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); } ctx.restore(); }

function savePNG() { const link = document.createElement('a'); link.download = 'codraw.png'; link.href = canvas.toDataURL('image/png'); link.click(); }

function exportProject() { const data = { pages, currentPage, settings: { pencilSize, eraserSize, currentColor } }; const blob = new Blob([JSON.stringify(data)], { type: "application/json" }); const link = document.createElement("a"); link.download = "codraw.json"; link.href = URL.createObjectURL(blob); link.click(); }



function setGlobalGradient(enabled=true){
    if(currentColor === "globalgradient"){randomizeGlobalGradient();}
    useGlobalGradient = enabled;
    currentColor = enabled ? "globalgradient" : currentColor;
    repaintBuffer();
    repaintWorkBuffer();
    scheduleRender();
}

function randomizeGradient() {
    GradientAngle = Math.random() * Math.PI * 2;
    // random rainbow permutation
    const rainbow = ["red","orange","yellow","green","cyan","blue","violet"];
    for (let i = rainbow.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rainbow[i], rainbow[j]] = [rainbow[j], rainbow[i]];
    }
    gradientStops = rainbow.map((c, i) => {
    return { offset: i / (rainbow.length - 1), color: c };
    });}

function setGradient(enabled=true){
    useGradient = enabled;
    currentColor = enabled ? "gradient" : currentColor;
    randomizeGradient();
    repaintBuffer();
    repaintWorkBuffer();
    scheduleRender();
}

function resizeCanvases() {
    const w = 2880;
    const h = 1620;
    if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
    bufferCanvas.width = w; bufferCanvas.height = h;
    workCanvas.width = w; workCanvas.height = h;
    }
}

function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (key === "img") return undefined; // skip HTMLImageElement
    return value;
    }));
}

function pushUndo() {
    undoStack.push(deepClone(objects));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack.length = 0;
    updateUndoRedoButtons(); }

function undo() {
    if (!undoStack.length) return;
    redoStack.push(deepClone(objects));
    objects = deepClone(undoStack.pop());
    selectedIndex = null; tempShape = null;
    repaintBuffer();
    repaintWorkBuffer();
    scheduleRender();
    updateUndoRedoButtons(); 
}


function redo() {
    if (!redoStack.length) return;
    undoStack.push(deepClone(objects));
    objects = deepClone(redoStack.pop());
    selectedIndex = null;
    tempShape = null;
    repaintBuffer();
    repaintWorkBuffer();
    scheduleRender();
    updateUndoRedoButtons();}


function updateUndoRedoButtons() {
    const u = document.getElementById('undoBtn'); if (u) u.disabled = undoStack.length === 0;
    const r = document.getElementById('redoBtn'); if (r) r.disabled = redoStack.length === 0;
}


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


function setTool(newTool) {
    tool = newTool;
    selectedIndex = null;
    selectedIndices = [];
    tempShape = null;
    scheduleRender();
    document.getElementById('propertiesPanel').style.bottom = '-50px';

    updatePropertiesPanel();
}

function zoomObject(obj, newWidth) {
    if (!obj || obj.type !== 'image') return;
    const ratio = obj.h / obj.w;   // preserve aspect ratio
    obj.w = newWidth;
    obj.h = newWidth * ratio;
    repaintBuffer();
    repaintWorkBuffer(selectedIndex);
    scheduleRender();
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
        showToolOptions('select');
        img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    };
    input.click();
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
    showToolOptions('select');
    img.src = base64String;

}

function ensureImages(arr) {
    arr.forEach(o => {
    if (o.type === 'image' && !o.img && o.imgSrc) {
        const img = new Image();
        img.onload = () => { o.img = img; repaintBuffer(); repaintWorkBuffer(); scheduleRender(); };
        img.src = o.imgSrc;
    }
    });
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
  if (selectedIndices && selectedIndices.length > 1) {
  pushUndo();
  const toDelete = selectedIndices.slice().sort((a,b)=>b-a);
  for (const idx of toDelete) objects.splice(idx, 1);
  selectedIndices = []; selectedIndex = null; repaintBuffer(); repaintWorkBuffer(); scheduleRender(); updatePropertiesPanel();
  } else if (selectedIndex != null) {
  pushUndo();
  objects.splice(selectedIndex, 1);
  selectedIndex = null;
  repaintBuffer(); repaintWorkBuffer(); scheduleRender(); updatePropertiesPanel();
  }
}

/////////////////////////
// Pages support
/////////////////////////

function saveCurrentPage() { 
    pages[currentPage] = deepClone(objects);
  invalidatePageThumbnails();
  if (pageViewerOpen) buildPageViewer();
}

// Invalidate cached thumbnails when pages change
function invalidatePageThumbnails() {
  pageThumbnails = new Array(pages.length);
}

function switchPage(index) {
    if (index < 0 || index >= pages.length) return;
    saveCurrentPage();
    currentPage = index; objects = deepClone(pages[currentPage]); selectedIndex = null; tempShape = null; ensureImages(objects); repaintBuffer(); repaintWorkBuffer(); scheduleRender(); updatePageCounter(); updatePropertiesPanel();
      if (pageViewerOpen) buildPageViewer();
}
function addPage() { saveCurrentPage();
    pages.push([]);
    switchPage(pages.length - 1);
  invalidatePageThumbnails();
}
function deletePage() { 
    if (pages.length <= 1) return;
    pages.splice(currentPage, 1);
    if (currentPage >= pages.length) currentPage = pages.length - 1;
    objects = deepClone(pages[currentPage]);
    selectedIndex = null;
    updatePageCounter();
    repaintBuffer();
    repaintWorkBuffer();
    scheduleRender();
    invalidatePageThumbnails();
}

function prevPage() { 
    switchPage(currentPage - 1);
}

function nextPage() { 
    if (currentPage < pages.length - 1) switchPage(currentPage + 1);
    else if (objects.length > 0) addPage();
}

function updatePageCounter() {
    const el = $('pageCounter');
    if (el) el.textContent = `${currentPage + 1} / ${pages.length}`;
}

// Page viewer: show a modal listing pages with thumbnails
async function generatePageThumbnail(index, maxWidth = 240) {
  if (!pages[index]) return null;
  if (pageThumbnails[index]) return pageThumbnails[index];
  // create a temporary canvas scaled down to thumb size
  const ratio = canvas.height / canvas.width;
  const tw = maxWidth; const th = Math.round(tw * ratio);
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = tw; thumbCanvas.height = th;
  const tctx = thumbCanvas.getContext('2d');
  // draw background
  // use settings stored in localStorage if any
  const settings = JSON.parse(localStorage.getItem("Codraw_Settings") || "{}");
  tctx.fillStyle = settings.backgroundColor || '#161821';
  tctx.fillRect(0, 0, tw, th);
  // scale draw to thumb size
  const scaleX = tw / canvas.width; const scaleY = th / canvas.height;
  tctx.save();
  tctx.scale(scaleX, scaleY);
  // ensure any images are loaded first
  const pageObjects = pages[index];
  const imagesToLoad = [];
  for (const o of pageObjects) {
    if (o.type === 'image' && o.imgSrc && !o.img) {
      imagesToLoad.push(new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => { o.img = img; resolve(); };
        img.onerror = () => { resolve(); };
        img.src = o.imgSrc;
      }));
    }
  }
  await Promise.all(imagesToLoad);
  // draw objects to thumb
  for (const o of pageObjects) {
    try { drawObject(o, false, tctx); } catch (e) { console.error('Thumb draw error', e); }
  }
  tctx.restore();
  const dataUrl = thumbCanvas.toDataURL('image/png');
  pageThumbnails[index] = dataUrl;
  return dataUrl;
}

async function buildPageViewer() {
  const grid = $('pageViewerGrid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < pages.length; i++) {
    const item = document.createElement('div');
    item.className = 'page-viewer-item';
    item.dataset.index = i;
    const img = document.createElement('img');
    img.alt = `Page ${i+1}`;
    img.src = '';
    const label = document.createElement('div');
    label.className = 'pv-label';
    label.textContent = `Page ${i+1}`;
    item.appendChild(img);
    item.appendChild(label);
    item.addEventListener('click', (e) => {
      const idx = parseInt(item.dataset.index, 10);
      if (!isNaN(idx)) {
        // cancel the auto-close timer because the user made a selection
        clearPageViewerAutoCloseTimer();
        closePageViewer();
        switchPage(idx);
      }
    });
    grid.appendChild(item);
    // highlight active page
    if (i === currentPage) item.classList.add('active');
    // load thumbnail
    generatePageThumbnail(i).then((data) => { if (data) img.src = data; }).catch((err) => console.error(err));
  }
}

function openPageViewer() {
  const viewer = $('pageViewer');
  if (!viewer) return;
  viewer.style.display = 'block';
  viewer.setAttribute('aria-hidden', 'false');
  pageViewerOpen = true;
  // rebuild viewer and then start auto-close timer
  buildPageViewer().then(() => {
    clearPageViewerAutoCloseTimer();
    startPageViewerAutoCloseTimer();
  }).catch(() => startPageViewerAutoCloseTimer());
}

function closePageViewer() {
  const viewer = $('pageViewer');
  if (!viewer) return;
  viewer.style.display = 'none';
  viewer.setAttribute('aria-hidden', 'true');
  pageViewerOpen = false;
  clearPageViewerAutoCloseTimer();
}

function togglePageViewer() { if (pageViewerOpen) closePageViewer(); else openPageViewer(); }

// Attach handlers
function setupPageViewerHandlers() {
  const el = $('pageCounter');
  if (el) {
    el.addEventListener('click', (e) => { e.stopPropagation(); togglePageViewer(); });
  }
  const pv = $('pageViewer');
  if (pv) {
    pv.addEventListener('click', (e) => { if (e.target === pv) closePageViewer(); });
    // Hover behavior: if user hovers inside viewer, prevent auto-close until they leave.
    pv.addEventListener('mouseenter', () => clearPageViewerAutoCloseTimer());
    pv.addEventListener('mousemove', () => clearPageViewerAutoCloseTimer());
    pv.addEventListener('mouseleave', () => startPageViewerAutoCloseTimer());
  }
  // Close page viewer when clicking outside it (and not clicking the pageCounter itself)
  document.addEventListener('click', (e) => {
    const pv = $('pageViewer');
    if (!pv || !pageViewerOpen) return;
    if (pv.contains(e.target)) return; // ignore clicks inside viewer
    if (e.target && e.target.id === 'pageCounter') return; // clicking counter should not close
    closePageViewer();
  });
  const pvclose = $('pvClose');
  if (pvclose) pvclose.addEventListener('click', closePageViewer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePageViewer(); });
}

function startPageViewerAutoCloseTimer() {
  // safety: clear existing first
  clearPageViewerAutoCloseTimer();
  pageViewerAutoCloseTimer = setTimeout(() => {
    if (pageViewerOpen) {
      closePageViewer();
    }
  }, pageViewerAutoCloseMs);
}

function clearPageViewerAutoCloseTimer() {
  if (pageViewerAutoCloseTimer) {
    clearTimeout(pageViewerAutoCloseTimer);
    pageViewerAutoCloseTimer = null;
  }
}

// call setup once the DOM is ready
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupPageViewerHandlers); else setupPageViewerHandlers();

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
        const settings = JSON.parse(localStorage.getItem("Codraw_Settings") || "{'watermark':'codraw'}");
        ctx.fillStyle = settings.backgroundColor || "#161821";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const pageObjects = pages[i];
        for (const o of pageObjects) {
            if (o.type === 'image' && o.imgSrc && !o.img) {
            await new Promise(resolve => {
          if (tool === 'lasso-eraser' || tool === 'lasso-select' || (tool === 'select' && lassoSelecting)) drawLassoPath();
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
    const timeStr = now.toLocaleTimeString();
    const dateTimeStr = `${dateStr} ${timeStr}`;
    const dateWidth = pdf.getTextWidth(dateTimeStr);
    pdf.text(dateTimeStr, canvas.width - 10 - dateWidth, canvas.height - 10);
    }
    const now = new Date();
    const dateStr = now.toLocaleDateString().replaceAll('/', '-');
    const timeStr = now.toLocaleTimeString();
    const dateTimeStr = `${dateStr} ${timeStr}`;
    const filename = fname || dateTimeStr+'.pdf';
    pdf.save(filename.endsWith('.pdf') ? filename : filename + '.pdf');
    scheduleRender();
}



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
      }
    }
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
    }
  }
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
  drawing = false; dragging = false; resizing = false; rotateMode = false; tempShape = null; erasing = false;
  // reset group and lasso states
  groupDragging = false; groupResizing = false; groupRotationMode = false; groupActiveHandle = null; maybeStartLasso = false; maybeClickedIndex = null; lassoSelecting = false; groupPointerStart = null; groupLastPointer = null; groupOriginalObjects = null; groupStartBounds = null;
  // clear per-object resize snapshots
  resizingOrig = null; resizePointerStart = null;
  scheduleRender();
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

function objectIntersectsPolygon(obj, poly) {
    // 1. If object has points (pencil, highlighter, polygon)
    if (obj.points) {
        for (const p of obj.points) {
            if (bufferCtx.isPointInPath(poly, p.x, p.y)) return true;
        }
        return false;
    }

    // 2. If rectangle-like object
    const b = getObjectBounds(obj);
    const corners = [
        {x: b.x, y: b.y},
        {x: b.x+b.w, y: b.y},
        {x: b.x, y: b.y+b.h},
        {x: b.x+b.w, y: b.y+b.h},
    ];

    for (const c of corners) {
        if (bufferCtx.isPointInPath(poly, c.x, c.y)) return true;
    }

    return false;
}


/////////////////////////
// Properties panel
/////////////////////////


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


/////////////////////////
// Cursor & UI wiring
/////////////////////////
const customCursor = $('customCursor');
function updateCursor() {
  if (!customCursor) return;
  if (tool === 'eraser') { customCursor.style.width = eraserSize + 'px'; customCursor.style.height = eraserSize + 'px'; customCursor.style.borderColor = 'red'; }
  else if (tool === 'pencil') { customCursor.style.width = pencilSize + 'px'; customCursor.style.height = pencilSize + 'px'; customCursor.style.borderColor = currentColor; }
  else if (tool === 'highlighter') { const hw = Math.max(1, Math.round(pencilSize * 1.5)); customCursor.style.width = hw + 'px'; customCursor.style.height = hw + 'px'; customCursor.style.borderColor = currentColor; }
  else if (tool === 'select') { customCursor.style.width = '20px'; customCursor.style.height = '20px'; customCursor.style.borderColor = '#b00bfd6c'; }
  else if (tool === 'lasso-select') { customCursor.style.width = '20px'; customCursor.style.height = '20px'; customCursor.style.borderColor = 'rgba(0,122,255,0.6)'; }
  else { customCursor.style.width = pencilSize + 'px'; customCursor.style.height = pencilSize + 'px'; customCursor.style.borderColor = currentColor; }
}

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
$('pencilSize')?.addEventListener('input', e => { pencilSize = parseInt(e.target.value); updateCursor();
  // sync settings panel
  const s = document.getElementById('pencilSizeSetting'); if (s && parseInt(s.value) !== pencilSize) s.value = pencilSize;
  // update numeric readout (if present)
  const pv = document.getElementById('pencilSizeValue'); if (pv) pv.textContent = String(pencilSize);
});
// settings panel sync
$('pencilSizeSetting')?.addEventListener('input', e => { const v = parseInt(e.target.value); if (!isNaN(v)) { pencilSize = v; const main = document.getElementById('pencilSize'); if (main && parseInt(main.value) !== v) main.value = v; updateCursor(); } } );
// initialize size inputs on load
window.addEventListener('load', ()=>{ const s = document.getElementById('pencilSizeSetting'); if (s) s.value = pencilSize; const main = document.getElementById('pencilSize'); if (main) main.value = pencilSize; const pv = document.getElementById('pencilSizeValue'); if (pv) pv.textContent = String(pencilSize); });
// sync radio quick-preset controls (S/M/L/XL)

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
  }else if (which === 'eraser') {
    panel.innerHTML = `
      <button data-tool="eraser"></button>
      <button data-tool="lasso-eraser" class="active">󱟁</button>
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
  else if (which === 'select') {
    panel.innerHTML = `
    <button data-tool="select" class="active">󰇀</button>
    <button data-tool="lasso-select">󰒅</button>
      
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
function updateDateTime() {
  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  document.getElementById("dateTime").innerHTML = ` ${dateStr}<br>  ${timeStr}`;

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