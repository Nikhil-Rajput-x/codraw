// Drawing-specific logic moved from functions.js
// This file exposes the drawing helpers: buildPathFor, drawPencilStroke, drawArrowHead, drawObject, drawObjectOnContext

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
            // Cuboids use the rect bounding box for hit detection
            ctxRef.rect(Math.min(o.x, o.x + o.w), Math.min(o.y, o.y + o.h), Math.abs(o.w), Math.abs(o.h));
            break;
        case 'sphere':
        case 'circle':
        case 'cylinder':
        case 'cone': // Cone often shares the circle/ellipse bounding logic or triangle, depending on preference. Here mapped to ellipse.
            ctxRef.ellipse(o.x + o.w / 2, o.y + o.h / 2, Math.abs(o.w) / 2, Math.abs(o.h) / 2, 0, 0, Math.PI * 2);
            break;
        case 'tetrahedron':
        case 'squarepyramid':
        case 'triangle':
            // These 3D shapes share the same triangular silhouette for hit detection
            ctxRef.moveTo(o.x, o.y + o.h);
            ctxRef.lineTo(o.x + o.w, o.y + o.h);
            ctxRef.lineTo(o.x + o.w / 2, o.y);
            ctxRef.closePath();
            break;
        case 'rhombus':
            ctxRef.moveTo(o.x + o.w / 2, o.y);
            ctxRef.lineTo(o.x + o.w, o.y + o.h / 2);
            ctxRef.lineTo(o.x + o.w / 2, o.y + o.h);
            ctxRef.lineTo(o.x, o.y + o.h / 2);
            ctxRef.closePath();
            break;
        case 'pentagon':
            {
                const px = o.x, py = o.y, pw = o.w, ph = o.h;
                ctxRef.moveTo(px + pw / 2, py);
                ctxRef.lineTo(px + pw, py + ph * 0.38);
                ctxRef.lineTo(px + pw * 0.81, py + ph);
                ctxRef.lineTo(px + pw * 0.19, py + ph);
                ctxRef.lineTo(px, py + ph * 0.38);
                ctxRef.closePath();
            }
            break;
        case 'hexagon':
            {
                const hx = o.x, hy = o.y, hw = o.w, hh = o.h;
                ctxRef.moveTo(hx + hw * 0.25, hy);
                ctxRef.lineTo(hx + hw * 0.75, hy);
                ctxRef.lineTo(hx + hw, hy + hh * 0.5);
                ctxRef.lineTo(hx + hw * 0.75, hy + hh);
                ctxRef.lineTo(hx + hw * 0.25, hy + hh);
                ctxRef.lineTo(hx, hy + hh * 0.5);
                ctxRef.closePath();
            }
            break;
        default:
            ctxRef.rect(o.x || 0, o.y || 0, o.w || 0, o.h || 0);
    }
}
function getSvgPathFromStroke(stroke) {
    if (!stroke.length) return "";
    const d = stroke.reduce(
        (acc, [x0, y0], i, arr) => {
            const [x1, y1] = arr[(i + 1) % arr.length];
            acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
            return acc;
        },
        ["M", ...stroke[0], "Q"]
    );
    d.push("Z");
    return d.join(" ");
}

function drawPencilStroke(ctxRef, o) {
    if (!o.points || o.points.length < 2) return;
    if (o.dotted || o.dashed) {
        ctxRef.save();
        ctxRef.lineJoin = "round";
        ctxRef.lineCap = "round";
        ctxRef.lineWidth = (o.width)*1 || 20;
        const dashSize = o.width ? o.width * 4 : 10; 
        ctxRef.setLineDash([dashSize, dashSize]); 

        ctxRef.beginPath();
        ctxRef.moveTo(o.points[0].x, o.points[0].y);

        for (let i = 1; i < o.points.length - 1; i++) {
            const midX = (o.points[i].x + o.points[i + 1].x) / 2;
            const midY = (o.points[i].y + o.points[i + 1].y) / 2;
            ctxRef.quadraticCurveTo(o.points[i].x, o.points[i].y, midX, midY);
        }
        
        const last = o.points[o.points.length - 1];
        ctxRef.lineTo(last.x, last.y);
        ctxRef.stroke(); 
        ctxRef.restore();
        return;
    }
    const inputPoints = o.points.map(p => [
        p.x, 
        p.y, 
        p.pressure || 0.5 
    ]);
    const stroke = getStroke(inputPoints, {
        size: o.width * 1.6 || 10,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
        start: { taper: 0, cap: true },
        end: { taper: 0, cap: true }
    });
    const pathData = getSvgPathFromStroke(stroke);
    const myPath = new Path2D(pathData);
    ctxRef.fill(myPath);
}
function drawArrowHead(ctxRef, x1, y1, x2, y2, width) { const headlen = 15 + (width || 2); const angle = Math.atan2(y2 - y1, x2 - x1); ctxRef.beginPath(); ctxRef.moveTo(x2, y2); ctxRef.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6)); ctxRef.moveTo(x2, y2); ctxRef.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6)); ctxRef.stroke(); }

function drawObject(o, isSelected = false, ctxTarget = ctx) {
    ctxTarget.save(); ctxTarget.lineJoin = "round"; ctxTarget.lineCap = "round"; ctxTarget.globalAlpha = (o.opacity !== undefined ? o.opacity : 1);
    let strokeStyleValue = o.color || currentColor; let fillStyleValue = o.color || currentColor;
    if (o.strokeType === 'gradient' || o.color === 'gradient') { strokeStyleValue = buildGradientForShape(ctxTarget, o); fillStyleValue = strokeStyleValue; }
    if (o.color === "globalgradient") { const diag = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height); const cx = canvas.width / 2; const cy = canvas.height / 2; const x1 = cx + Math.cos(globalGradientAngle) * diag; const y1 = cy + Math.sin(globalGradientAngle) * diag; const x2 = cx - Math.cos(globalGradientAngle) * diag; const y2 = cy - Math.sin(globalGradientAngle) * diag; const g = ctx.createLinearGradient(x1, y1, x2, y2); globalGradientStops.forEach(s => g.addColorStop(s.offset, s.color)); strokeStyleValue = g; fillStyleValue = g; }
    ctxTarget.strokeStyle = strokeStyleValue; ctxTarget.fillStyle = fillStyleValue; ctxTarget.lineWidth = o.width || pencilSize; setLineDashFor(ctxTarget, o);
    if (o.rotation) { const b = getObjectBounds(o); const cx = b.x + b.w / 2; const cy = b.y + b.h / 2; ctxTarget.translate(cx, cy); ctxTarget.rotate(degToRad(o.rotation)); ctxTarget.translate(-cx, -cy); }
    if (o.type === 'highlighter') { ctxTarget.lineWidth = o.width || Math.max(1, Math.round(pencilSize * 1.5)); }
    switch (o.type) {
        case 'pencil': case 'highlighter': drawPencilStroke(ctxTarget, o); break;
     case 'rhombus': { 
            ctxTarget.beginPath(); 
            const slant = o.w * 0.2; 
            ctxTarget.moveTo(o.x + slant, o.y);        
            ctxTarget.lineTo(o.x + o.w, o.y);
            ctxTarget.lineTo(o.x + o.w - slant, o.y + o.h); 
            ctxTarget.lineTo(o.x, o.y + o.h);  
            ctxTarget.closePath(); 
            if (o.fill) ctxTarget.fill(); else ctxTarget.stroke(); 
            break; 
        }
        case 'pentagon': { ctxTarget.beginPath(); const px = o.x, py = o.y, pw = o.w, ph = o.h; ctxTarget.moveTo(px + pw / 2, py); ctxTarget.lineTo(px + pw, py + ph * 0.38); ctxTarget.lineTo(px + pw * 0.81, py + ph); ctxTarget.lineTo(px + pw * 0.19, py + ph); ctxTarget.lineTo(px, py + ph * 0.38); ctxTarget.closePath(); if (o.fill) ctxTarget.fill(); else ctxTarget.stroke(); break; }
        case 'hexagon': { ctxTarget.beginPath(); const hx = o.x, hy = o.y, hw = o.w, hh = o.h; ctxTarget.moveTo(hx + hw * 0.25, hy); ctxTarget.lineTo(hx + hw * 0.75, hy); ctxTarget.lineTo(hx + hw, hy + hh * 0.5); ctxTarget.lineTo(hx + hw * 0.75, hy + hh); ctxTarget.lineTo(hx + hw * 0.25, hy + hh); ctxTarget.lineTo(hx, hy + hh * 0.5); ctxTarget.closePath(); if (o.fill) ctxTarget.fill(); else ctxTarget.stroke(); break; }
                case 'sphere': { 
            const sx = o.x + o.w / 2, sy = o.y + o.h / 2, srx = Math.abs(o.w) / 2, sry = Math.abs(o.h) / 2; 
            ctxTarget.beginPath(); 
            ctxTarget.ellipse(sx, sy, srx, sry, 0, 0, Math.PI * 2); /
            if (o.fill) { 
                ctxTarget.fill(); 
            } else { 
                ctxTarget.stroke(); 
                ctxTarget.beginPath(); 
                ctxTarget.ellipse(sx, sy, srx, sry * 0.3, 0, 0, Math.PI * 2); 
                ctxTarget.stroke(); 
            } 
            break; 
        }
        case 'tetrahedron': { const tx = o.x, ty = o.y, tw = o.w, th = o.h; ctxTarget.beginPath(); ctxTarget.moveTo(tx + tw / 2, ty); ctxTarget.lineTo(tx, ty + th); ctxTarget.lineTo(tx + tw, ty + th); ctxTarget.closePath(); if (o.fill) { ctxTarget.fill(); } else { ctxTarget.stroke(); ctxTarget.beginPath(); ctxTarget.moveTo(tx + tw / 2, ty); ctxTarget.lineTo(tx + tw / 2, ty + th * 0.8); ctxTarget.lineTo(tx, ty + th); ctxTarget.moveTo(tx + tw / 2, ty + th * 0.8); ctxTarget.lineTo(tx + tw, ty + th); ctxTarget.stroke(); } break; }        
        case 'squarepyramid': { 
            const spx = o.x, spy = o.y, spw = o.w, sph = o.h;
            const baseX = spx;
            const baseY = spy + sph * 0.5;
            const baseH = sph * 0.5;
            const apexX = spx + spw / 2;
            const apexY = spy; 
            if (o.fill) {
                ctxTarget.beginPath();
                ctxTarget.moveTo(apexX, apexY);
                ctxTarget.lineTo(spx, spy + sph);
                ctxTarget.lineTo(spx + spw, spy + sph);
                ctxTarget.closePath();
                ctxTarget.fill();
            } else {
                ctxTarget.strokeRect(baseX, baseY, spw, baseH);
                ctxTarget.beginPath();
                ctxTarget.moveTo(apexX, apexY); ctxTarget.lineTo(baseX, baseY);
                ctxTarget.moveTo(apexX, apexY); ctxTarget.lineTo(baseX + spw, baseY);
                ctxTarget.moveTo(apexX, apexY); ctxTarget.lineTo(baseX, baseY + baseH);
                ctxTarget.moveTo(apexX, apexY); ctxTarget.lineTo(baseX + spw, baseY + baseH);
                ctxTarget.stroke();
            }
            break; 
        }
        case 'polygon': if (!o.points || !o.points.length) break; ctxTarget.beginPath(); ctxTarget.moveTo(o.points[0].x, o.points[0].y); for (let i = 1; i < o.points.length; i++) ctxTarget.lineTo(o.points[i].x, o.points[i].y); ctxTarget.closePath(); if (o.fill) ctxTarget.fill(); else ctxTarget.stroke(); break;
        case 'line': case 'arrow': ctxTarget.beginPath(); ctxTarget.moveTo(o.x, o.y); ctxTarget.lineTo(o.x + o.w, o.y + o.h); ctxTarget.stroke(); if (o.type === 'arrow') drawArrowHead(ctxTarget, o.x, o.y, o.x + o.w, o.y + o.h, o.width); break;
        case 'rect': { const rx = Math.min(o.x, o.x + o.w), ry = Math.min(o.y, o.y + o.h), rw = Math.abs(o.w), rh = Math.abs(o.h); if (o.fill) ctxTarget.fillRect(rx, ry, rw, rh); else ctxTarget.strokeRect(rx, ry, rw, rh); break; }
        case 'circle': { const cx = o.x + o.w / 2, cy = o.y + o.h / 2, rx = Math.abs(o.w) / 2, ry = Math.abs(o.h) / 2; ctxTarget.beginPath(); ctxTarget.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); if (o.fill) ctxTarget.fill(); else ctxTarget.stroke(); break; }
        case 'triangle': ctxTarget.beginPath(); ctxTarget.moveTo(o.x, o.y + o.h); ctxTarget.lineTo(o.x + o.w, o.y + o.h); ctxTarget.lineTo(o.x + o.w / 2, o.y); ctxTarget.closePath(); if (o.fill) ctxTarget.fill(); else ctxTarget.stroke(); break;
        case 'cuboid': { const x = o.x, y = o.y, w = o.w, h = o.h, d = Math.min(40, Math.abs(w) / 3); ctxTarget.strokeRect(x, y, w, h); ctxTarget.strokeRect(x + d, y - d, w, h); ctxTarget.beginPath(); ctxTarget.moveTo(x, y); ctxTarget.lineTo(x + d, y - d); ctxTarget.moveTo(x + w, y); ctxTarget.lineTo(x + w + d, y - d); ctxTarget.moveTo(x, y + h); ctxTarget.lineTo(x + d, y + h - d); ctxTarget.moveTo(x + w, y + h); ctxTarget.lineTo(x + w + d, y + h - d); ctxTarget.stroke(); break; }
        case 'cylinder': { const x = o.x, y = o.y, w = o.w, h = o.h; const rx = Math.abs(w) / 2, ry = 15; const cx = x + w / 2; ctxTarget.beginPath(); ctxTarget.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2); ctxTarget.stroke(); ctxTarget.beginPath(); ctxTarget.ellipse(cx, y + h, rx, ry, 0, 0, Math.PI * 2); ctxTarget.moveTo(x, y); ctxTarget.lineTo(x, y + h); ctxTarget.moveTo(x + w, y); ctxTarget.lineTo(x + w, y + h); ctxTarget.stroke(); break; }
        case 'cone': { const x = o.x, y = o.y, w = o.w, h = o.h, cx = x + w / 2, rx = Math.abs(w) / 2, ry = 15; ctxTarget.beginPath(); ctxTarget.ellipse(cx, y + h, rx, ry*3, 0, 0, Math.PI * 2); ctxTarget.stroke(); ctxTarget.beginPath(); ctxTarget.moveTo(cx, y); ctxTarget.lineTo(x, y + h); ctxTarget.moveTo(cx, y); ctxTarget.lineTo(x + w, y + h); ctxTarget.stroke(); break; }
        case 'image': if (!o.img && o.imgSrc) { o.img = new Image(); o.img.src = o.imgSrc; o.img.onload = () => scheduleRender(); } if (o.img) ctxTarget.drawImage(o.img, o.x, o.y, o.w, o.h); break;
        case 'text': { ctxTarget.font = (o.fontSize || 32) + 'px ' + (o.fontFamily || 'MANIC, sans-serif'); ctxTarget.textBaseline = 'top'; if (o.fill) ctxTarget.fillText(o.text || '', o.x, o.y); else ctxTarget.strokeText(o.text || '', o.x, o.y); break; }
        default: const b = getObjectBounds(o); ctxTarget.strokeRect(b.x, b.y, b.w, b.h);
    }
    if (isSelected) { const b = getObjectBounds(o); ctxTarget.setLineDash([6, 4]); ctxTarget.lineWidth = 1; ctxTarget.strokeStyle = '#f00'; ctxTarget.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12); ctxTarget.setLineDash([]); ctxTarget.fillStyle = '#fff'; const handles = [[b.x - 8, b.y - 8], [b.x + b.w, b.y - 8], [b.x - 8, b.y + b.h], [b.x + b.w, b.y + b.h]]; handles.forEach(h => ctxTarget.fillRect(h[0], h[1], 8, 8)); const rx = b.x + b.w / 2, ry = b.y - 28; ctxTarget.beginPath(); ctxTarget.arc(rx, ry, 8, 0, Math.PI * 2); ctxTarget.fill(); ctxTarget.strokeStyle = '#fff'; ctxTarget.beginPath(); ctxTarget.moveTo(b.x + b.w / 2, b.y - 8); ctxTarget.lineTo(b.x + b.w / 2, b.y - 20); ctxTarget.stroke(); }
    ctxTarget.restore();
}

function drawGroupBoundingBox(indices, ctxTarget = ctx) {
    if (!indices || indices.length === 0) return;
    const b = getGroupBounds(indices);
    ctxTarget.save();
    ctxTarget.setLineDash([6, 4]); ctxTarget.lineWidth = 1; ctxTarget.strokeStyle = '#f00'; ctxTarget.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
    // handles
    const handles = [[b.x - 8, b.y - 8], [b.x + b.w, b.y - 8], [b.x - 8, b.y + b.h], [b.x + b.w, b.y + b.h]];
    ctxTarget.setLineDash([]);
    ctxTarget.fillStyle = '#fff';
    for (const h of handles) ctxTarget.fillRect(h[0], h[1], 8, 8);
    // rotate handle
    const rx = b.x + b.w / 2; const ry = b.y - 28;
    ctxTarget.beginPath(); ctxTarget.arc(rx, ry, 8, 0, Math.PI * 2); ctxTarget.fill(); ctxTarget.strokeStyle = '#fff'; ctxTarget.beginPath(); ctxTarget.moveTo(b.x + b.w / 2, b.y - 8); ctxTarget.lineTo(b.x + b.w / 2, b.y - 20); ctxTarget.stroke();
    ctxTarget.restore();
}

function drawObjectOnContext(ctxRef, o) { drawObject(o, false, ctxRef); }

function repaintBuffer() { bufferCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height); for (let i = 0; i < objects.length; i++) drawObjectOnContext(bufferCtx, objects[i]); }

function repaintWorkBuffer(excludeIndex = null) {
    workCtx.clearRect(0, 0, workCanvas.width, workCanvas.height);
    // allow excludeIndex to be a single index, or an array of indices
    let excludeSet = new Set();
    if (excludeIndex === null && selectedIndices && selectedIndices.length > 0) {
        selectedIndices.forEach(i => excludeSet.add(i));
    } else if (Array.isArray(excludeIndex)) {
        excludeIndex.forEach(i => excludeSet.add(i));
    } else if (typeof excludeIndex === 'number') {
        excludeSet.add(excludeIndex);
    }
    for (let i = 0; i < objects.length; i++) { if (excludeSet.has(i)) continue; drawObjectOnContext(workCtx, objects[i]); }
}

function render() { ctx.clearRect(0, 0, canvas.width, canvas.height); if (showGrid) drawGrid(); if (selectedIndex !== null) ctx.drawImage(workCanvas, 0, 0); else ctx.drawImage(bufferCanvas, 0, 0); if (tempShape) drawObject(tempShape, false, ctx); if (tool === 'lasso-eraser') drawLassoPath(); if (selectedIndex !== null && objects[selectedIndex]) drawObject(objects[selectedIndex], true, ctx); if (tool === 'eraser' && lastEraserPos) { ctx.save(); ctx.strokeStyle = '#fff'; ctx.setLineDash([4, 2]); ctx.beginPath(); ctx.arc(lastEraserPos.x, lastEraserPos.y, eraserSize / 2, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); } }


// Export for use by other modules
// drawRender defined below with group support
function drawRender() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (showGrid) drawGrid();
    // draw a background: if any objects are selected (single or group), use workCanvas which excludes them
    if (selectedIndex !== null || (selectedIndices && selectedIndices.length > 0)) ctx.drawImage(workCanvas, 0, 0); else ctx.drawImage(bufferCanvas, 0, 0);
    if (tempShape) drawObject(tempShape, false, ctx);
    if (tool === 'lasso-eraser' || tool === 'lasso-select' || (tool === 'select' && lassoSelecting)) drawLassoPath();
    // single selected object
    if (selectedIndex !== null && objects[selectedIndex]) drawObject(objects[selectedIndex], true, ctx);
    // group selection: draw group items and bounding box if multiple selected
    if (selectedIndices && selectedIndices.length > 1) {
        for (const idx of selectedIndices) if (objects[idx]) drawObject(objects[idx], true, ctx);
        drawGroupBoundingBox(selectedIndices, ctx);
    }
    if (tool === 'eraser' && lastEraserPos) {
        ctx.save(); ctx.strokeStyle = '#fff'; ctx.setLineDash([4, 2]); ctx.beginPath(); ctx.arc(lastEraserPos.x, lastEraserPos.y, eraserSize / 2, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
}

// This file is included as a plain script; functions are global (no export needed)