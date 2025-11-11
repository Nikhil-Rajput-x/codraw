//This file is part of project Codraw
//Author :  Nikhil kumar
//(c) 2025 uzumaki_arts

async function sharePDF() {
  saveCurrentPage();
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'l' : 'p',
    unit: 'px',
    format: [canvas.width, canvas.height]
  });

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) {
      pdf.addPage([canvas.width, canvas.height], canvas.width > canvas.height ? 'l' : 'p');
    }
// Redraw page
ctx.clearRect(0, 0, canvas.width, canvas.height);

// ✅ Use background color from settings
const settings = JSON.parse(localStorage.getItem("Codraw_Settings") || "{}");
ctx.fillStyle = settings.backgroundColor || "#161821";
ctx.fillRect(0, 0, canvas.width, canvas.height);

const pageObjects = pages[i];
for (const o of pageObjects) {
  if (o.type === 'image' && o.imgSrc && !o.img) {
    await new Promise(resolve => {
      const img = new Image();
      img.onload = () => { 
        o.img = img; 
        drawObject(o, false); 
        resolve(); 
      };
      img.src = o.imgSrc;
    });
  } else {
    drawObject(o, false);
  }
}

    const imgData = canvas.toDataURL('image/jpeg');
    pdf.addImage(imgData, 'jpeg', 0, 0, canvas.width, canvas.height);

    // ✅ Watermark
    pdf.setTextColor(28, 227, 117);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.text(settings.watermark, 10, canvas.height - 10);
    // ✅ Date
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('times', 'normal');
    pdf.setFontSize(15);
    const now = new Date();
    const dateStr = now.toLocaleDateString().replaceAll('/', '-');
    const dateWidth = pdf.getTextWidth(dateStr);
    pdf.text(dateStr, canvas.width - 10 - dateWidth, canvas.height - 10);
  }

  // Get Blob
  const pdfBlob = pdf.output("blob");

  // Upload with progress
  await sendPDFtoTelegram(pdfBlob);

  scheduleRender();
}
async function sendPDFtoTelegram(pdfBlob) {
  // ✅ Load settings instead of hardcoding
  const settings = loadSettings();
  const BOT_TOKEN = settings.telegrambotToken; 
  const chat_ids = {};
  settings.classes.forEach(c => { chat_ids[c.name] = c.chatId; });

  if (!BOT_TOKEN) {
    alert("⚠️ Telegram Send Token not set in settings");
    return;
  }

  if (!chat_ids[cls]) {
    alert("⚠️ No chat ID found for channel: " + cls);
    return;
  }

  let clas = (cls === "") ? "" : cls;
  const CHAT_ID = chat_ids[cls];
  console.log("Sending to CHAT_ID:", CHAT_ID);

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("chat_id", CHAT_ID);
    formData.append("document", pdfBlob, inputx + ".pdf");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, true);

    // Progress bar
    xhr.upload.onprogress = function (event) {
      if (event.lengthComputable) {
        const percent = (event.loaded / event.total) * 100;
        document.getElementById("pdfUploadProgress").style.width = percent.toFixed(2) + "%";
        document.getElementById("pdfStatus").innerHTML = percent.toFixed(2) + "%";
      }
    };

    xhr.onload = function () {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        console.log("📤 Telegram response:", data);
        if (data.ok) {
          closePopup();
          alert("✅ PDF sent to Telegram!");
          resolve(data);
        } else {
          alert("❌ Failed: " + data.description);
          closePopup();
          reject(data);
        }
      } else {
        reject(new Error("Upload failed with status " + xhr.status));
      }
    };

    xhr.onerror = function () {
      document.getElementById("upload-container").style.display = "none";
      reject(new Error("Network error during upload"));
    };

    xhr.send(formData);
  });
}
function buildClassOptions() {
  const settings = loadSettings();
  if (!settings || !settings.classes) return "";

  return settings.classes
    .map(c => `<option value="${c.name}">${c.name === "" ? "" :  c.name}</option>`)
    .join("");
}

function openPopup() {
  const classOptions = buildClassOptions();

  document.getElementById("popup").innerHTML = `
    <div class="popup-content">
      <h2 class="title">Select Channel & Name</h2>
      <!-- Dropdowns -->
      <div class="form-group">
        <label>Telegram Channel:</label>
        <select id="classSelect" class="dropdown">
          ${classOptions}
        </select>
      </div>
      <!-- Input -->
      <div class="form-group">
        <label>Enter File Name:</label>
        <input type="text" id="selectedInput" class="input-box" readonly />
      </div>
      <!-- Keyboard -->
      <div class="keyboard" id="keyboard"></div>
      <!-- Buttons -->
      <div class="btn-group">
        <button class="btn save-btn" onclick="saveSelection()">Share</button>
        <button class="btn cancel-btn" onclick="closePopup()">Cancel</button>
      </div>
    </div>`;
  document.getElementById("popup").style.display = "flex";
  buildKeyboard();
}

function openPopupsave() {
  const classOptions = buildClassOptions();

  document.getElementById("popup").innerHTML = `
    <div class="popup-content">
      <h2 class="title">Select Name</h2>
      <input style="display:none;" type="text" value="Codraw" id="classSelect"> 
      <!-- Input -->
      <div class="form-group">
        <label>Enter File Name:</label>
        <input type="text" id="selectedInput" class="input-box" readonly />
      </div>
      <!-- Keyboard -->
      <div class="keyboard" id="keyboard"></div>
      <!-- Buttons -->
      <div class="btn-group">
        <button class="btn save-btn" onclick="saveSelection('save')">Save</button>
        <button class="btn cancel-btn" onclick="closePopup()">Cancel</button>
      </div>
    </div>`;
  document.getElementById("popup").style.display = "flex";
  buildKeyboard();
}
function closePopup() {
  document.getElementById("popup").style.display = "none";
}

function buildKeyboard() {
  const keys = "qwertyuiopasdfghjkl.zxcvbnm-+:1234567890".split("");
  const keyboard = document.getElementById("keyboard");
  keyboard.innerHTML = "";

  keys.forEach(k => {
    const btn = document.createElement("button");
    btn.innerText = k;
    btn.onclick = () => {
      document.getElementById("selectedInput").value += k;
    };
    keyboard.appendChild(btn);
  });

  // Space + Backspace
  const spaceBtn = document.createElement("button");
  spaceBtn.innerText = "␣ Space";
  spaceBtn.style.gridColumn = "span 5";
  spaceBtn.onclick = () => {
    document.getElementById("selectedInput").value += " ";
  };
  keyboard.appendChild(spaceBtn);

  const backBtn = document.createElement("button");
  backBtn.innerText = "⌫";
  backBtn.style.gridColumn = "span 5";
  backBtn.onclick = () => {
    const input = document.getElementById("selectedInput");
    input.value = input.value.slice(0, -1);
  };
  keyboard.appendChild(backBtn);
}

function saveSelection(x) {
  cls = document.getElementById("classSelect").value;
  inputx = document.getElementById("selectedInput").value;
  if (x){
      savePDF(inputx)
}
  else{
    document.getElementById("popup").innerHTML = '<div class="upload-container"><div class="paper-plane"></div><div class="progress-bar"><div class="progress" id="pdfUploadProgress"></div></div><div class="percentage" id="pdfStatus">0%</div><div class="status glow" id="status">Please wait while uploading file...</div>'
  sharePDF();}}
  



  function saveSessionToJSON() {
  const session = {
    pages: pages,        // your array of pages with objects
    currentPage: currentPage
  };
  return JSON.stringify(session);
}

async function sendSessionToTelegram() {
  const BOT_TOKEN = "8297110355:AAFJjVjnvAME-GWTvqqO_OAMYRIoSQCnxKQ";
  const CHAT_ID = "-1003095519861";

  const jsonString = saveSessionToJSON();
  const blob = new Blob([jsonString], { type: "application/json" });

  const formData = new FormData();
  formData.append("chat_id", CHAT_ID);
  formData.append("document", blob, "whiteboard-session.json");

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
    method: "POST",
    body: formData
  });

  const data = await res.json();
  console.log("Telegram response:", data);
}

// Image receiver
let lastUpdateId = 0;

async function drawImageOnCanvas(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result;

      const img = new Image();
      img.onload = () => {
        addBase64Image(base64data);
        console.log("Image as Base64:", base64data);
      };
      img.src = base64data;
    };
    reader.readAsDataURL(blob);
  } catch (err) {
    console.error("Error loading image:", err);
  }
}

async function extractPhotoUrl(update) {
  const settings = loadSettings();
  const BOT_TOKEN = settings.telegramImageBotToken;
  try {
    // Accept both channel posts and normal messages
    const msg = update.message || update.channel_post;
    if (msg && msg.photo) {
      const photos = msg.photo;
      const largestPhoto = photos[photos.length - 1];
      const fileId = largestPhoto.file_id;

      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
      const data = await res.json();

      if (data.ok) {
        const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
        // Use proxy to avoid mixed-content issues (http vs https)
        return "https://images.weserv.nl/?url=" + encodeURIComponent(fileUrl.replace(/^https?:\/\//, ""));
      }
    }
  } catch (e) {
    console.warn('extractPhotoUrl error', e);
  }
  return null;
}

async function handleUpdate(update) {
  try {
    const msg = update.message || update.channel_post;
    // Handle photos (from any chat type)
    const photoUrl = await extractPhotoUrl(update);
    if (photoUrl) drawImageOnCanvas(photoUrl);

  } catch (e) {
    console.error('handleUpdate error', e);
  }
}

async function fetchUpdates() {
  const settings = loadSettings();
  const BOT_TOKEN = settings.telegramImageBotToken;
  if (!BOT_TOKEN) return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}`);
    const data = await res.json();

    if (data && Array.isArray(data.result)) {
      for (const update of data.result) {
        lastUpdateId = update.update_id;
        await handleUpdate(update);
      }
    }
  } catch (err) {
    console.error("Error fetching updates:", err);
  }
}

setInterval(fetchUpdates, 3000);
