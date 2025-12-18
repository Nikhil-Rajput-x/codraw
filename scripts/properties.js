function updatePropertiesPanel() {
  const el = document.getElementById('propContent');
  if (!el) return;
  if (selectedIndex === null && (!selectedIndices || selectedIndices.length === 0)) { el.innerHTML = 'No selection'; return; }
  if (selectedIndices && selectedIndices.length > 1) {
    // Group selection UI
    el.innerHTML = '';
    const title = document.createElement('div'); title.textContent = `Group: ${selectedIndices.length} items`; title.style.fontWeight = '600'; el.appendChild(title);
    const btns = document.createElement('div'); btns.style.marginTop = '8px';
    const clearBtn = document.createElement('button'); clearBtn.textContent = '󱟃'; clearBtn.addEventListener('click', () => { selectedIndices = []; selectedIndex = null; repaintWorkBuffer(); scheduleRender(); updatePropertiesPanel(); });
    const deleteBtn = document.createElement('button'); deleteBtn.textContent = '󰧧'; deleteBtn.addEventListener('click', () => {
      pushUndo();
      const toDelete = selectedIndices.slice().sort((a,b)=>b-a);
      for (let idx of toDelete) objects.splice(idx, 1);
      selectedIndices = []; selectedIndex = null; repaintBuffer(); repaintWorkBuffer(); scheduleRender(); updatePropertiesPanel();
    });
      clearBtn.className = 'prop-btn'; 
      deleteBtn.className = 'prop-btn danger'; 
      btns.appendChild(clearBtn); btns.appendChild(deleteBtn); el.appendChild(btns);
    // Color and opacity controls that apply to all selected
    const colorRow = document.createElement('div'); colorRow.style.marginTop = '8px';
    const colorInput = document.createElement('input'); colorInput.type = 'color'; colorInput.value = objects[selectedIndices[0]].color || currentColor;
      colorRow.style.display = 'flex'; 
      colorRow.style.alignItems = 'center'; 
      colorInput.className = 'colorPickerx prop-color'; 
    const colorLabel = document.createElement('div'); colorLabel.className = 'prop-color-swatch'; colorLabel.style.width = '26px'; colorLabel.style.height = '26px'; colorLabel.style.borderRadius = '6px'; colorLabel.style.background = objects[selectedIndices[0]].color || currentColor; colorLabel.style.marginLeft = '8px';
    colorInput.addEventListener('input', (e) => { selectedIndices.forEach(i => objects[i].color = e.target.value); colorLabel.style.background = e.target.value; repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); });
    colorRow.appendChild(colorInput); colorRow.appendChild(colorLabel); el.appendChild(colorRow);
    const opRow = document.createElement('div'); opRow.style.marginTop = '8px'; const opInput = document.createElement('input'); opInput.type = 'range'; opInput.min = 0.1; opInput.max = 1; opInput.step = 0.05; opInput.value = objects[selectedIndices[0]].opacity || 1; opInput.addEventListener('input', (e) => { selectedIndices.forEach(i => objects[i].opacity = parseFloat(e.target.value)); repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); }); opRow.appendChild(opInput); el.appendChild(opRow);
    return;
  }
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
  const colorInput = document.createElement('input');colorInput.id = 'colorPicker'; colorInput.className = "colorPickerx prop-color";colorInput.type = 'color'; colorInput.value = o.color || currentColor; colorInput.addEventListener('input', (e) => { o.color = e.target.value; repaintBuffer(); repaintWorkBuffer(selectedIndex); scheduleRender(); colordiv.style.backgroundColor = e.target.value;});
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
  } else {
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
