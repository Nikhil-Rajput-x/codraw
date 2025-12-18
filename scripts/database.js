//This file is part of project Codraw
//Author :  Nikhil kumar
//(c) 2025 uzumaki_arts

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
// db is declared in variables.js; ensure defined in this scope
db = db || null;

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
    // clear cached thumbnails; pages were reloaded
    if (typeof invalidatePageThumbnails === 'function') invalidatePageThumbnails();
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
// NOTE: `autosaveDebounceTimer` and `autosaveInterval` declared in `variables.js` as shared globals; do not redeclare here.
function autoSaveDebounced(delay = 800) {
  if (autosaveDebounceTimer) clearTimeout(autosaveDebounceTimer);
  autosaveDebounceTimer = setTimeout(async () => {
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
    autosaveDebounceTimer = null;
  }, delay);
}

// --- wrapper to instrument functions that modify state (so they auto-save)
// safeWrap will preserve original function
function safeWrap(name) {
  try {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    // avoid wrapping multiple times
    if (orig.__isWrapped) return;
    window[name] = function(...args) {
      const res = orig.apply(this, args);
      try { autoSaveDebounced(); } catch (e) {}
      return res;
    };
    try { window[name].__isWrapped = true; window[name].__orig = orig; } catch (e) {}
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
          if (typeof invalidatePageThumbnails === 'function') invalidatePageThumbnails();
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
  if (typeof invalidatePageThumbnails === 'function') invalidatePageThumbnails();
  currentPage = 0;
  objects = [];
  console.log('All saved data cleared');
}

// --- auto-save ---

 async function handleLoad() {
    document.getElementById('modalOverlay').style.display = 'none';
    if (typeof initAutoSave === 'function') {
      await initAutoSave(); // load session
    }
    // Ensure single autosave interval
    if (typeof stopAutoSaveLoop === 'function') stopAutoSaveLoop();
    startAutoSaveLoop();
  }

  async function handleDelete() {
    document.getElementById('modalOverlay').style.display = 'none';
    if (typeof clearLocalStorageData === 'function') clearLocalStorageData();
    if (typeof clearIndexedDB === 'function') await clearIndexedDB();
    pages = [[]];
    if (typeof invalidatePageThumbnails === 'function') invalidatePageThumbnails();
    currentPage = 0;
    objects = [];
    if (typeof initAutoSave === 'function') await initAutoSave(); // start fresh
    // Stop any existing loop and start fresh
    if (typeof stopAutoSaveLoop === 'function') stopAutoSaveLoop();
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
    // Guard: don't start it twice
    if (autoSaveLoopStarted) return;
    autoSaveLoopStarted = true;

    setTimeout(() => {
      const s = $('startup'); if (!s) return; s.classList.add('fade-out'); setTimeout(() => { try { s.remove(); } catch (e) {} }, 1000);
    }, 2500);
    repaintBuffer(); repaintWorkBuffer(); scheduleRender(); updatePageCounter(); updateCursor();  updateDateTime();
    // Store interval id so we can clear it later if needed
    autosaveInterval = setInterval(() => {
      try {
        saveCurrentPage();
        autoSaveDebounced(0);
        updateDateTime();
      } catch (e) {
        console.warn("Periodic autosave failed:", e);
      }
    }, 5000);
  }

  function stopAutoSaveLoop() {
    if (autosaveInterval) {
      clearInterval(autosaveInterval);
      autosaveInterval = null;
    }
    autoSaveLoopStarted = false;
  }

