//This file is part of project Codraw
//Author :  Nikhil kumar
//(c) 2025 uzumaki_arts

const defaultSettings = {
  geminiApiKeys: [],
  telegramBotTokenReceive: "", 
  telegramBotTokenSend: "", 
  telegramClasses: [],
  backgroundColor: "#ffffff",
  cursorEnabled: true,
  watermark: 'Codraw'
};

function saveSettings(settings) {
  localStorage.setItem("Codraw_Settings", JSON.stringify(settings));
}

function loadSettings() {
  const s = localStorage.getItem("Codraw_Settings");
  return s ? JSON.parse(s) : {
    telegramImageBotToken: "",
    telegrambotToken: "",
    geminiApiKeys: [],
    classes: [],
    backgroundColor: "#111827",
    watermark: "Codraw",
  };
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
  if (panel.style.display === "block") loadSettingsUI();
}

function loadSettingsUI() {
  const s = loadSettings();
  applyCursorSetting();

  document.getElementById("telegramImageBotToken").value = s.telegramImageBotToken;
  document.getElementById("telegrambotToken").value = s.telegrambotToken;
  document.getElementById("geminiKeys").value = s.geminiApiKeys.join(",");
  document.getElementById("bgColor").value = s.backgroundColor;
  document.getElementById("cursorToggle").checked = s.cursorEnabled;
  document.getElementById("watermarkinput").value = s.watermark;
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
}
function saveSettingsUI() {
  const s = loadSettings();
  s.telegramImageBotToken = document.getElementById("telegramImageBotToken").value;
  s.telegrambotToken = document.getElementById("telegrambotToken").value;
  s.geminiApiKeys = document.getElementById("geminiKeys").value.split(",").map(k => k.trim()).filter(k => k);
  s.backgroundColor = document.getElementById("bgColor").value;
  s.cursorEnabled = document.getElementById("cursorToggle").checked;
  s.watermark = document.getElementById("watermarkinput").value;
  saveSettings(s);
  document.body.style.backgroundColor = s.backgroundColor;
  console.log("Settings Saved ✅");
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
document.body.style.backgroundColor = settings.backgroundColor;
document.getElementById("watermark").innerText = settings.watermark;