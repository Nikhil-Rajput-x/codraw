canvas.addEventListener('pointerdown', (evt) => {
    const pos = getPos(evt);
    pointerDown = true;
    startPos = pos;
    activeHandle = null;
  // reset group transform state by default
  groupStartBounds = null;
  groupOriginalObjects = null;
  groupPointerStart = null;
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
    if (tool === "lasso-eraser") {
        lassoErasing = true;
        lassoPath = [{ x: pos.x, y: pos.y }];
      tempShape = { type: "polygon", points: lassoPath, color: "rgba(255,0,0,0.5)", width: 2 };
        scheduleRender();
        return;
    }
    if (tool === 'lasso-select') {
      lassoSelecting = true;
      lassoPath = [{ x: pos.x, y: pos.y }];
      tempShape = { type: 'polygon', points: lassoPath, color: 'rgba(0,122,255,0.5)', width: 2 };
      scheduleRender();
      return;
    }
  // SELECT mode
    if (tool === 'select') {
      // SHIFT + click may start lasso select on move — we delay starting
      if (evt.shiftKey && (typeof loadSettings === 'function' ? (loadSettings().select && loadSettings().select.shiftToggleMultiSelect) : true)) {
        maybeStartLasso = true;
        maybeClickedIndex = (() => { for (let i = objects.length - 1; i >= 0; i--) if (isPointInObject(pos.x, pos.y, objects[i])) return i; return null; })();
      } else {
        maybeStartLasso = false; maybeClickedIndex = null;
      }
      // If we have a group selection, check for group handle click or start of group drag
      if (selectedIndices && selectedIndices.length > 1) {
        const ghandle = handleGroupAtPoint(pos.x, pos.y, selectedIndices);
        if (ghandle) {
          groupActiveHandle = ghandle;
          if (ghandle === 'rotate') {
            groupRotationMode = true;
            groupPointerStart = pos;
            groupLastPointer = pos;
            // store original objects to compute rotation relative to their original coordinates
            groupOriginalObjects = selectedIndices.map(i => deepClone(objects[i]));
            groupStartBounds = getGroupBounds(selectedIndices);
            pushUndo();
            return;
          }
          // resize handle
          groupResizing = true;
          groupPointerStart = pos;
          groupLastPointer = pos;
          groupOriginalObjects = selectedIndices.map(i => deepClone(objects[i]));
          groupStartBounds = getGroupBounds(selectedIndices);
          pushUndo();
          return;
        }
        // clicked inside group bounds and not on handle: start group drag
        const gb = getGroupBounds(selectedIndices);
        if (gb && pos.x >= gb.x && pos.x <= gb.x + gb.w && pos.y >= gb.y && pos.y <= gb.y + gb.h) {
          groupDragging = true;
          groupPointerStart = pos;
          groupLastPointer = pos;
          groupOriginalObjects = selectedIndices.map(i => deepClone(objects[i]));
          groupStartBounds = gb;
          pushUndo();
          return;
        }
      }
      // if there's a selection and click on handle
        if (selectedIndex !== null) {
            const h = handleAtPoint(pos.x, pos.y, objects[selectedIndex]);
            if (h) {
                if (h === 'rotate') { rotateMode = true; activeHandle = 'rotate'; pushUndo(); return; }
                resizing = true; activeHandle = h; // capture original object and pointer to compute deltas
                resizingOrig = deepClone(objects[selectedIndex]);
                resizePointerStart = pos;
                pushUndo();
                return;
            }
        }
    // find topmost by path and handle SHIFT-ADD/REMOVE for multi-select
    const clickedIndex = (() => {
      for (let i = objects.length - 1; i >= 0; i--) if (isPointInObject(pos.x, pos.y, objects[i])) return i;
      return null;
    })();
      if (clickedIndex !== null) {
      if (evt.shiftKey && (typeof loadSettings === 'function' ? (loadSettings().select && loadSettings().select.shiftToggleMultiSelect) : true)) {
        // toggle inclusion in selectedIndices
        const si = selectedIndices.indexOf(clickedIndex);
        if (si >= 0) selectedIndices.splice(si, 1); else selectedIndices.push(clickedIndex);
        // keep single select index null if group present, else set for single selection
        selectedIndex = (selectedIndices.length === 1 ? selectedIndices[0] : null);
        repaintWorkBuffer(selectedIndex);
        scheduleRender();
        updatePropertiesPanel();
        return;
      }
      // normal single click selects only that object
      selectedIndices = [clickedIndex];
      selectedIndex = clickedIndex;
      const b = getObjectBounds(objects[clickedIndex]);
      dragOffset = { x: pos.x - b.x, y: pos.y - b.y };
      dragging = true;
      pushUndo();
      repaintWorkBuffer(selectedIndex);
      scheduleRender();
      updatePropertiesPanel();
      return;
    }
    // clicked empty: deselect
    selectedIndex = null; selectedIndices = []; repaintWorkBuffer(); scheduleRender(); updatePropertiesPanel(); return;
    }

    // POLYGON tool: if active, click adds points
    if (tool === 'polygon') {
        if (!polygonTempPoints) polygonTempPoints = [];
        polygonTempPoints.push({ x: pos.x, y: pos.y });
        tempShape = { type: 'polygon', points: polygonTempPoints.slice(), color: currentColor, width: pencilSize, dotted, fill: fillMode, opacity: 1 };
        if (currentColor === 'gradient') {
        tempShape.strokeType = 'gradient';
        tempShape.gradientStops = gradientStops.slice();
    }
    if (currentColor === 'globalgradient') {
        tempShape.strokeType = 'globalgradient';
        tempShape.gradientStops = gradientStops.slice();
    }
    scheduleRender();
    return;
    }

  // TEXT: click to place text object (editable)
    if (tool === 'text') {
        pushUndo();
        const newText = { type: 'text', text: '', x: pos.x, y: pos.y, fontSize: 32, fontFamily: 'MANIC, sans-serif', color: currentColor, width: pencilSize, fill: true, opacity: 1 };
        objects.push(newText);
        selectedIndex = objects.length - 1;
        repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); updatePropertiesPanel();
        // create an input overlay for editing
        createTextEditor(selectedIndex);
        return;
    }

    // DRAWING tool: start tempShape
    const highlighterWidth = Math.max(1, Math.round(pencilSize * 1.5));
    tempShape = { type: tool, color: currentColor, width: (tool === 'highlighter' ? highlighterWidth : pencilSize), dotted, fill: fillMode, opacity: (tool === 'highlighter' ? 0.35 : 1) };
    if (currentColor === 'gradient') {
        tempShape.strokeType = 'gradient';
        tempShape.gradientStops = gradientStops.slice();
    }
    if (currentColor === 'globalgradient') {
        tempShape.strokeType = 'globalgradient';
        tempShape.gradientStops = globalGradientStops.slice();
        }
    if (tool === 'pencil' || tool === 'highlighter') tempShape.points = [{ x: pos.x, y: pos.y, w: (tool === 'highlighter' ? highlighterWidth : pencilSize) }];
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
if (lassoErasing) {
    lassoPath.push({ x: pos.x, y: pos.y });
  tempShape = { type: "polygon", points: lassoPath, color: "rgba(255,0,0,0.5)", width: 2 };
    scheduleRender();
    return;
}
// Lasso multi-select flow (shift-drag)
if (!lassoSelecting && maybeStartLasso) {
    // start lasso if dragged beyond threshold
    const dx = pos.x - startPos.x, dy = pos.y - startPos.y;
    if (Math.hypot(dx, dy) > 6) {
      lassoSelecting = true;
      lassoPath = [{ x: startPos.x, y: startPos.y }, { x: pos.x, y: pos.y }];
      // use blue for select-lasso (either via tool or shift-lasso), keep red for eraser
      tempShape = { type: 'polygon', points: lassoPath, color: (tool === 'lasso-eraser') ? 'rgba(255,0,0,0.5)' : 'rgba(0,122,255,0.5)', width: 2 };
      scheduleRender();
      maybeStartLasso = false; // we've transitioned to lassoSelecting
    }
}
if (lassoSelecting) {
  lassoPath.push({ x: pos.x, y: pos.y });
  tempShape = { type: 'polygon', points: lassoPath, color: (tool === 'lasso-eraser') ? 'rgba(255,0,0,0.5)' : 'rgba(0,122,255,0.5)', width: 2 };
  scheduleRender();
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
    if (currentColor === 'gradient') {
      tempShape.strokeType = 'gradient';
      tempShape.gradientStops = gradientStops.slice();
    }
    if (currentColor === 'globalgradient') {
    tempShape.strokeType = 'globalgradient';
    tempShape.gradientStops = globalGradientStops.slice();
  }
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
    const hw = Math.max(1, Math.round(pencilSize * 1.5 * pressure));
    tempShape.points.push({ x: pos.x, y: pos.y, w: hw });
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
  if (tool === 'select' && (selectedIndex !== null || (selectedIndices && selectedIndices.length > 0))) {
    // group drag/resize/rotate
    if (selectedIndices && selectedIndices.length > 1) {
      if (groupDragging) {
        const dx = pos.x - (groupLastPointer ? groupLastPointer.x : groupPointerStart.x);
        const dy = pos.y - (groupLastPointer ? groupLastPointer.y : groupPointerStart.y);
        applyGroupTranslation(selectedIndices, dx, dy);
        groupLastPointer = pos;
        repaintWorkBuffer(selectedIndex);
        scheduleRender();
        updatePropertiesPanel();
        return;
      }
      if (groupResizing && groupStartBounds) {
        const gb = groupStartBounds;
        // compute origin based on handle
        let originX = gb.x, originY = gb.y;
        // allow setting to use center as anchor for group scale
        const settings = (typeof loadSettings === 'function') ? loadSettings() : { select: { groupAnchor: 'center' } };
        const useCenterAnchor = settings && settings.select && settings.select.groupAnchor === 'center';
        switch (groupActiveHandle) {
          case 'br': originX = gb.x; originY = gb.y; break;
          case 'tr': originX = gb.x; originY = gb.y + gb.h; break;
          case 'bl': originX = gb.x + gb.w; originY = gb.y; break;
          case 'tl': originX = gb.x + gb.w; originY = gb.y + gb.h; break;
        }
        if (useCenterAnchor) {
          // keep existing behavior for center anchor: scale based on distance from center (double to get full width/height)
          originX = gb.x + gb.w / 2; originY = gb.y + gb.h / 2;
          const origW = Math.max(1, gb.w); const origH = Math.max(1, gb.h);
          const newW = Math.max(1, Math.abs(pos.x - originX) * 2);
          const newH = Math.max(1, Math.abs(pos.y - originY) * 2);
          var scaleX = newW / origW; var scaleY = newH / origH;
        } else {
          // prefer delta-from-start approach so clicking slightly inside the handle doesn't immediately shrink the group
          const origW = Math.max(1, gb.w); const origH = Math.max(1, gb.h);
          const start = groupPointerStart || { x: originX + origW, y: originY + origH };
          let signX = 1, signY = 1;
          switch (groupActiveHandle) {
            case 'br': signX = 1; signY = 1; break;
            case 'tr': signX = 1; signY = -1; break;
            case 'bl': signX = -1; signY = 1; break;
            case 'tl': signX = -1; signY = -1; break;
          }
          const newW = Math.max(1, origW + signX * (pos.x - start.x));
          const newH = Math.max(1, origH + signY * (pos.y - start.y));
          var scaleX = newW / origW; var scaleY = newH / origH;
        }
        // restore original object snapshots before applying scale to avoid compounding transforms
        selectedIndices.forEach((idx, i) => objects[idx] = deepClone(groupOriginalObjects[i]));
        // apply scaling relative to origin
        applyGroupScale(selectedIndices, originX, originY, scaleX, scaleY);
        repaintWorkBuffer(selectedIndex); scheduleRender(); updatePropertiesPanel();
        return;
      }
      if (groupRotationMode && groupStartBounds && groupPointerStart) {
        // rotate around center of group
        const cx = groupStartBounds.x + groupStartBounds.w / 2;
        const cy = groupStartBounds.y + groupStartBounds.h / 2;
        const startAngle = Math.atan2(groupPointerStart.y - cy, groupPointerStart.x - cx);
        const currentAngle = Math.atan2(pos.y - cy, pos.x - cx);
        const angleDeg = radToDeg(currentAngle - startAngle);
        // restore originals then rotate
        selectedIndices.forEach((idx, i) => objects[idx] = deepClone(groupOriginalObjects[i]));
        applyGroupRotate(selectedIndices, cx, cy, angleDeg);
        repaintWorkBuffer(selectedIndex); scheduleRender(); updatePropertiesPanel();
        return;
      }
    }
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
        const start = resizePointerStart || startPos;
        switch (activeHandle) {
        case 'br':
            if (keepAspect) {
              const b = getObjectBounds(resizingOrig);
              const ratio = b.w / Math.max(1, b.h);
              obj.w = Math.max(1, b.w + (pos.x - start.x));
              obj.h = obj.w / (ratio || 1);
            } else {
              obj.w = Math.max(1, resizingOrig.w + (pos.x - start.x));
              obj.h = Math.max(1, resizingOrig.h + (pos.y - start.y));
            }
          break;
        case 'tr':
            if (keepAspect) {
              const b = getObjectBounds(resizingOrig);
              const ratio = b.w / Math.max(1, b.h);
              obj.w = Math.max(1, b.w + (pos.x - start.x));
              obj.h = obj.w / (ratio || 1);
              obj.y = resizingOrig.y + (resizingOrig.h - obj.h);
            } else {
              obj.w = Math.max(1, resizingOrig.w + (pos.x - start.x));
              const newH = Math.max(1, resizingOrig.h - (pos.y - start.y));
              obj.y = resizingOrig.y + (resizingOrig.h - newH);
              obj.h = newH;
            }
          break;
        case 'bl':
            if (keepAspect) {
              const b = getObjectBounds(resizingOrig); const ratio = b.w / Math.max(1, b.h);
              const newH = Math.max(1, b.h + (pos.y - start.y));
              obj.h = newH;
              obj.w = newH * ratio;
              obj.x = resizingOrig.x + (resizingOrig.w - obj.w);
            } else {
              const newW = Math.max(1, resizingOrig.w - (pos.x - start.x));
              obj.x = resizingOrig.x + (resizingOrig.w - newW);
              obj.w = newW;
              obj.h = Math.max(1, resizingOrig.h + (pos.y - start.y));
            }
          break;
        case 'tl':
            if (keepAspect) {
              const b = getObjectBounds(resizingOrig); const ratio = b.w / Math.max(1, b.h);
              const newH = Math.max(1, b.h - (pos.y - start.y));
              obj.h = newH;
              obj.w = newH * ratio;
              obj.x = resizingOrig.x + (resizingOrig.w - obj.w);
              obj.y = resizingOrig.y + (resizingOrig.h - obj.h);
            } else {
              const newW = Math.max(1, resizingOrig.w - (pos.x - start.x));
              const newH = Math.max(1, resizingOrig.h - (pos.y - start.y));
              obj.x = resizingOrig.x + (resizingOrig.w - newW);
              obj.y = resizingOrig.y + (resizingOrig.h - newH);
              obj.w = newW; obj.h = newH;
            }
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
  if (lassoErasing) {
    lassoErasing = false;

    // Close the polygon automatically
    if (lassoPath.length > 2) {
        const poly = new Path2D();
        poly.moveTo(lassoPath[0].x, lassoPath[0].y);
        for (let i = 1; i < lassoPath.length; i++) {
            poly.lineTo(lassoPath[i].x, lassoPath[i].y);
        }
        poly.closePath();

        // Remove all objects intersecting polygon
        for (let i = objects.length - 1; i >= 0; i--) {
            if (objectIntersectsPolygon(objects[i], poly)) {
                objects.splice(i, 1);
            }
        }
        pushUndo();
        repaintBuffer();
        repaintWorkBuffer();
        scheduleRender();
    }

    tempShape = null;
    lassoPath = [];
    return;
}
  // SHIFT click toggle (no drag) when maybeStartLasso was set
  if (maybeStartLasso && !lassoSelecting) {
    maybeStartLasso = false;
    if (maybeClickedIndex !== null) {
      const si = selectedIndices.indexOf(maybeClickedIndex);
      if (si >= 0) selectedIndices.splice(si, 1); else selectedIndices.push(maybeClickedIndex);
      selectedIndex = (selectedIndices.length === 1 ? selectedIndices[0] : null);
      repaintWorkBuffer(selectedIndex); scheduleRender(); updatePropertiesPanel();
      maybeClickedIndex = null;
      return;
    }
  }
  // finalize lasso select
  if (lassoSelecting) {
    lassoSelecting = false;
    setTool('select');
    showToolOptions('select');
    if (lassoPath.length > 2) {
      const poly = new Path2D(); poly.moveTo(lassoPath[0].x, lassoPath[0].y);
      for (let i = 1; i < lassoPath.length; i++) poly.lineTo(lassoPath[i].x, lassoPath[i].y);
      poly.closePath();
      const sel = [];
      for (let i = 0; i < objects.length; i++) {
        if (objectIntersectsPolygon(objects[i], poly)) sel.push(i);
      }
      selectedIndices = sel;
      selectedIndex = (selectedIndices.length === 1 ? selectedIndices[0] : null);
      tempShape = null; lassoPath = [];
      repaintWorkBuffer(selectedIndex); scheduleRender(); updatePropertiesPanel();
    } else {
      // too small to be a lasso selection - clear
      tempShape = null; lassoPath = [];
    }
    return;
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
        imgSrc: img.src   // only keep URL
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
    const last = polygonTempPoints[polygonTempPoints.length - 1];
    const distToStart = Math.hypot(pos.x - polygonTempPoints[0].x, pos.y - polygonTempPoints[0].y);
    const distToLast = Math.hypot(pos.x - last.x, pos.y - last.y);
    if (distToStart < 12 || distToLast < 6) {
      pushUndo();
      const poly = { type: 'polygon', points: polygonTempPoints.slice(0, polygonTempPoints.length - (distToLast < 6 ? 0 : 1)), color: currentColor, width: pencilSize, dotted, fill: fillMode, opacity: 1 };
      if (currentColor === 'gradient') {
        poly.strokeType = 'gradient';
        poly.gradientStops = gradientStops.slice();
      }
      if (currentColor === 'globalgradient') {
    poly.strokeType = 'globalgradient';
    poly.gradientStops = globalGradientStops.slice();
  }
      objects.push(poly);
      selectedIndex = objects.length - 1;
      polygonTempPoints = null; tempShape = null;
      repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); updatePropertiesPanel();
      return;
    } else {
      return;
    }
  }

  // finish drawing temp shapes
  if (tempShape) {
    normalizeShape(tempShape);
    pushUndo();
    // for pencil/highlighter: keep as drawn
    // ensure gradient data stored if necessary
    if ((tempShape.color === 'gradient') && !tempShape.strokeType) {
      tempShape.strokeType = 'gradient';
      tempShape.gradientStops = gradientStops.slice();
    }
    if (tempShape.color === "globalgradient") {
    tempShape.strokeType = "globalgradient";
    tempShape.gradientStops = globalGradientStops.slice();
    }
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
    dragging = false; resizing = false; rotateMode = false; activeHandle = null; // per-object
    // clear per-object resize snapshots
    resizingOrig = null; resizePointerStart = null;
    repaintBuffer(); repaintWorkBuffer(selectedIndex);
    scheduleRender(); updatePropertiesPanel();
    return;
  }

  // finish group dragging/resizing/rotation
  if (groupDragging || groupResizing || groupRotationMode) {
    groupDragging = false; groupResizing = false; groupRotationMode = false; groupActiveHandle = null; groupPointerStart = null; groupLastPointer = null; groupStartBounds = null; groupOriginalObjects = null;
    repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); updatePropertiesPanel();
    return;
  }

});


document.getElementById("toggleGrid").addEventListener("click", ()=>{
  showGrid = !showGrid;
  render();
});

resizeCanvases();
window.addEventListener('resize', () => { resizeCanvases(); scheduleRepaintAll(); });
