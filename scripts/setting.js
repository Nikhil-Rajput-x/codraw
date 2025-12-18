//This file is part of project Codraw
//Author :  Nikhil kumar
//(c) 2025 uzumaki_arts

const defaultSettings = {
  geminiApiKeys: [],
  telegramBotTokenReceive: "", 
  telegramBotTokenSend: "", 
  telegramClasses: [],
  subjects: ['physics','chemistry','biology','Maths','Science','English','GK','GS'],
  backgroundColor: "#ffffff",
  cursorEnabled: true,
  watermark: 'Codraw'
};

function saveSettings(settings) {
  localStorage.setItem("Codraw_Settings", JSON.stringify(settings));
}

function loadSettings() {
  const s = localStorage.getItem("Codraw_Settings");
  const parsed = s ? JSON.parse(s) : {};
  // merge with defaults so new keys are always present
  const merged = Object.assign({}, {
    telegramImageBotToken: "",
    telegrambotToken: "",
    geminiApiKeys: [],
    classes: [],
    subjects: ['physics','chemistry','biology','Maths','Science','English','GK','GS'],
    backgroundColor: "#111827",
    watermark: "Codraw",
    cursorEnabled: true,
     select: { selectMode: 'click', shiftToggleMultiSelect: true, groupAnchor: 'center' },
     geminiModel: 'gemini-2.5-flash'
  }, parsed);
  return merged;
}

// add a new class
function addClass(name, chatId) {
  const settings = loadSettings();
  settings.classes.push({ name, chatId });
  saveSettings(settings);
}

// remove class by index
function removeClass(index) {
  const settings = loadSettings();
  settings.classes.splice(index, 1);
  saveSettings(settings);
}


function toggleSettings() {
  const panel = document.getElementById("settingsPanel");
  panel.style.display = (panel.style.display === "none") ? "block" : "none";
  if (panel.style.display === "block") {
    loadSettingsUI(); setupSettingsTabs();
  }
}

function loadSettingsUI() {
  const s = loadSettings();
  applyCursorSetting();

  document.getElementById("telegramImageBotToken").value = s.telegramImageBotToken;
  document.getElementById("telegrambotToken").value = s.telegrambotToken;
  document.getElementById("geminiKeys").value = (s.geminiApiKeys || []).join(",");
    document.getElementById("geminiModel").value = s.geminiModel || 'gemini-2.5-flash';
  document.getElementById("bgColor").value = s.backgroundColor;
  document.getElementById("cursorToggle").checked = !!s.cursorEnabled;
  document.getElementById("watermarkinput").value = s.watermark;
  // select options
  if (document.getElementById('selectMode')) document.getElementById('selectMode').value = (s.select && s.select.selectMode) ? s.select.selectMode : 'click';
  if (document.getElementById('shiftToggleMultiSelect')) document.getElementById('shiftToggleMultiSelect').checked = (s.select && typeof s.select.shiftToggleMultiSelect !== 'undefined') ? s.select.shiftToggleMultiSelect : true;
  if (document.getElementById('groupAnchor')) document.getElementById('groupAnchor').value = (s.select && s.select.groupAnchor) ? s.select.groupAnchor : 'center';
  // apply select default if requested
  if (s.select && s.select.selectMode === 'lasso') setTool('lasso-select');
  else setTool('select');
  document.getElementById("watermark").innerText = s.watermark;
  const listDiv = document.getElementById("classList");
  listDiv.innerHTML = "";

  s.classes.forEach((c, i) => {
    let maskedChatId = c.chatId;
    if (maskedChatId.length > 6) {
      const start = maskedChatId.slice(0, Math.floor((maskedChatId.length - 6) / 2));
      const end = maskedChatId.slice(-Math.ceil((maskedChatId.length - 6) / 2));
      maskedChatId = start + "******" + end;
    }

    const div = document.createElement("div");
    div.innerHTML = `
      <span title="${c.chatId}">${c.name} (${maskedChatId})</span>
      <button onclick="removeClassUI(${i})" class="closebtnsetting"></button>
    `;
    listDiv.appendChild(div);
  });
  // subjects list
  const subjDiv = document.getElementById('subjectList'); if (subjDiv) {
    subjDiv.innerHTML = '';
    (s.subjects || []).forEach((sub, idx) => {
      const d = document.createElement('div');
      d.style.display = 'flex'; d.style.justifyContent = 'space-between'; d.style.alignItems = 'center'; d.style.gap = '8px';
      d.innerHTML = `<span>${sub}</span><button class="closebtnsetting" onclick="removeSubjectUI(${idx})"></button>`;
      subjDiv.appendChild(d);
    });
  }
  // pre-load license content in case user switches to licence panel
  loadLicenseContent();
}
// Setup left sidebar tabs behavior
function setupSettingsTabs() {
  const tabs = document.querySelectorAll('#settingsPanel .settings-tab');
  const panels = document.querySelectorAll('#settingsPanel .settings-panel-content');
  tabs.forEach(t => {
    t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      const panelName = t.dataset.panel;
      panels.forEach(p => p.style.display = (p.dataset.panel === panelName) ? 'block' : 'none');
      if (panelName === 'licence') loadLicenseContent();
    });
  });
  // Show the currently active tab initially
  const initial = document.querySelector('#settingsPanel .settings-tab.active');
  if (initial) {
    const panelName = initial.dataset.panel;
    panels.forEach(p => p.style.display = (p.dataset.panel === panelName) ? 'block' : 'none');
  }
}

// Load LICENSE file content (try various common paths) and inject into the licence panel
async function loadLicenseContent() {
  const el = document.getElementById('licenseContent');
  if (!el) return;
  // avoid reloading if already filled
  if (el.dataset.loaded === 'true') return;
  const candidates = ['/LICENSE', '/LICENCE', '/LICENSE.txt', '/LICENSE.md', '/LICENSE.MD', '/license','https://raw.githubusercontent.com/Nikhil-Rajput-x/codraw/refs/heads/main/LICENSE'];
  let text = null;
  for (const path of candidates) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      text = await res.text();
      break;
    } catch (e) {
      // ignore and try next
    }
  }
  if (!text) {
    el.textContent = 'License file not found in repository.';
    el.dataset.loaded = 'true';
    return;
  }
  // simple transform: decode/trim and insert license text
  const trimmed = text.trim();
  // If the content seems markdown like, render to HTML. Otherwise show as plain preformatted.
  if (/^#{1,6}\s|\n#{1,6}\s|\*\*|\*\s|\-\s|^```/m.test(trimmed)) {
    el.innerHTML = parseMarkdownToHTML(trimmed);
  } else {
    el.textContent = trimmed;
  }
  el.dataset.loaded = 'true';
}

// Basic Markdown to HTML renderer: headings, lists, paragraphs, code blocks, inline bold/italic
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function parseMarkdownToHTML(md) {
  // Escape first
  let out = '';
  let lines = md.split(/\r?\n/);
  let inPre = false;
  let inUl = false;
  let inOl = false;
  for (let raw of lines) {
    let line = raw;
    // code block fence handling
    if (line.trim().startsWith('```')) {
      if (!inPre) { inPre = true; out += '<pre class="license-code">'; } else { inPre = false; out += '</pre>'; }
      continue;
    }
    if (inPre) { out += escapeHtml(line) + '\n'; continue; }
    // headings
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = Math.min(6, h[1].length);
      const text = escapeHtml(h[2]);
      out += `<h${level}>${text}</h${level}>`;
      // close any open lists
      if (inUl) { out += '</ul>'; inUl = false; }
      if (inOl) { out += '</ol>'; inOl = false; }
      continue;
    }
    // horizontal rule
    if (/^\s*([-*_]){3,}\s*$/.test(line)) { out += '<hr/>'; continue; }
    // unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      if (!inUl) { inUl = true; out += '<ul>'; }
      const item = line.replace(/^\s*[-*+]\s+/, '');
      out += `<li>${inlineMd(escapeHtml(item))}</li>`;
      continue;
    }
    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      if (!inOl) { inOl = true; out += '<ol>'; }
      const item = line.replace(/^\s*\d+\.\s+/, '');
      out += `<li>${inlineMd(escapeHtml(item))}</li>`;
      continue;
    }
    // empty line -> paragraph break
    if (line.trim() === '') {
      if (inUl) { out += '</ul>'; inUl = false; }
      if (inOl) { out += '</ol>'; inOl = false; }
      out += '<p></p>';
      continue;
    }
    // paragraph
    out += `<p>${inlineMd(escapeHtml(line))}</p>`;
  }
  if (inUl) { out += '</ul>'; }
  if (inOl) { out += '</ol>'; }
  return out;
}

// Inline Markdown (bold/italic/code links minimal support)
function inlineMd(s) {
  // inline code
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // bold
  s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // italic
  s = s.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // [text](url) -> link
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return s;
}
function saveSettingsUI() {
  const s = loadSettings();
  s.telegramImageBotToken = document.getElementById("telegramImageBotToken").value;
  s.telegrambotToken = document.getElementById("telegrambotToken").value;
  s.geminiApiKeys = document.getElementById("geminiKeys").value.split(",").map(k => k.trim()).filter(k => k);
  s.backgroundColor = document.getElementById("bgColor").value;
  s.cursorEnabled = document.getElementById("cursorToggle").checked;
  s.watermark = document.getElementById("watermarkinput").value;
  // select settings
  if (!s.select) s.select = {};
  if (document.getElementById('selectMode')) s.select.selectMode = document.getElementById('selectMode').value;
  if (document.getElementById('shiftToggleMultiSelect')) s.select.shiftToggleMultiSelect = !!document.getElementById('shiftToggleMultiSelect').checked;
  if (document.getElementById('groupAnchor')) s.select.groupAnchor = document.getElementById('groupAnchor').value;
    if (document.getElementById('geminiModel')) s.geminiModel = document.getElementById('geminiModel').value.trim();
  saveSettings(s);
  applyCursorSetting();
  document.body.style.backgroundColor = s.backgroundColor;
  console.log("Settings Saved ✅");
  if (s.select && s.select.selectMode === 'lasso') setTool('lasso-select');
  else setTool('select');
}

function addClassUI() {
  const name = document.getElementById("className").value;
  const chatId = document.getElementById("classChatId").value;
  if (!name || !chatId) return alert("Enter class name & chat ID");
  addClass(name, chatId);
  loadSettingsUI();
  document.getElementById("className").value = "";
  document.getElementById("classChatId").value = "";
}

// Subjects management
function addSubject(name) {
  if (!name) return;
  const s = loadSettings(); if (!s.subjects) s.subjects = [];
  const val = name.trim(); if (!val) return;
  if (s.subjects.indexOf(val) === -1) s.subjects.push(val);
  saveSettings(s);
}

function removeSubject(index) {
  const s = loadSettings(); if (!s.subjects) return;
  s.subjects.splice(index, 1); saveSettings(s);
}

function addSubjectUI() {
  const input = document.getElementById('subjectName'); if (!input) return;
  const name = input.value.trim(); if (!name) return alert('Enter a subject name');
  addSubject(name); input.value = '';
  loadSettingsUI();
}

function removeSubjectUI(idx) { removeSubject(idx); loadSettingsUI(); }

function removeClassUI(index) {
  removeClass(index);
  loadSettingsUI();
}
function applyCursorSetting() {
  const settings = loadSettings();
  if (settings.cursorEnabled) {
    document.getElementById('customCursor').style.display = 'block'
  } else {
    document.getElementById('customCursor').style.display  = "none";
  }
}

const settings = loadSettings();
applyCursorSetting();
document.body.style.backgroundColor = settings.backgroundColor;
document.getElementById("watermark").innerText = settings.watermark;
