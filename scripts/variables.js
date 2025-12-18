let $;
let globalGradientAngle = 0;
let canvas;
let ctx;
let bufferCanvas;
let bufferCtx;
let workCanvas;
let workCtx;
let tool = 'pencil';
let drawing = false;
let startPos = null;
let tempShape = null;
let objects = [];
let selectedIndex = null;
// multiple selection group
let selectedIndices = []; // array of indices currently selected for group operations
let groupDragging = false;
let groupResizing = false;
let groupRotationMode = false;
let groupActiveHandle = null;
let groupDragOffset = { x: 0, y: 0 };
// group transform helpers (initial state capture for multi-transform math)
let groupStartBounds = null;
let groupOriginalObjects = null; // deep clones of objects used during transform operations
let groupPointerStart = null; // starting pointer used by group drag/resize/rotate
let groupLastPointer = null; // last pointer position during group dragging/resizing
let resizePointerStart = null; // starting pointer for per-object resize
let resizingOrig = null; // snapshot of object being resized
let maybeStartLasso = false; // short-lived flag: shift+down may start lasso on move
let maybeClickedIndex = null; // used to remember which object was under pointer at down
let dragging = false;
let resizing = false;
let rotateMode = false;
let activeHandle = null;
let dragOffset = { x: 0, y: 0 };
let showGrid = false;
let pencilSize = 12;
let currentColor = 'white';
let dotted = false;
let fillMode = false;
let eraserSize = 20;
let erasing = false;
let lassoErasing = false;
let lassoPath = [];
let lassoSelecting = false;
let lastEraserPos = null;
let erasedIndicesDuringDrag = new Set();
let undoStack = [];
let redoStack = [];
const MAX_UNDO = 200;
let pages = [[]];
let currentPage = 0;
// Page viewer cache and state
let pageThumbnails = []; // cached dataURLs for each page
let pageViewerOpen = false;
// Page viewer auto-close behavior (ms)
let pageViewerAutoCloseMs = 6000; // 6 seconds
let pageViewerAutoCloseTimer = null;
let useGlobalGradient = false;
let useGradient = false;
let gradientStops = [
    { offset: 0.0, color: "red" },
    { offset: 0.17, color: "orange" },
    { offset: 0.33, color: "yellow" },
    { offset: 0.50, color: "green" },
    { offset: 0.67, color: "blue" },
    { offset: 0.83, color: "indigo" },
    { offset: 1.0, color: "violet" }
];
let globalGradientStops = [
    { offset: 0, color: "red" },
    { offset: 0.17, color: "orange" },
    { offset: 0.33, color: "yellow" },
    { offset: 0.5, color: "green" },
    { offset: 0.67, color: "cyan" },
    { offset: 0.83, color: "blue" },
    { offset: 1, color: "violet" }
];
let propertiesPanel = document.getElementById('propertiesPanel');
// Note: `ctx` (canvas 2D context) is created in `main.js` after the canvas is found.
// Initialize the properties panel if the element exists.
if (propertiesPanel) {
    propertiesPanel.innerHTML = `<h4 style="margin:0 0 8px 0;">Properties</h4><div id="propContent">No selection</div>`;
}

// render scheduling
let needsRender = false;

// pointer and interaction state shared across modules
let pointerDown = false;
let polygonTempPoints = null;
let textEditing = null; // { index, inputElement }

// db, autosave
let db = null;
// Timer used for debounced auto-save (short-term timeout)
let autosaveDebounceTimer = null;
// Interval used for periodic auto-save
let autosaveInterval = null;
// Prevent the autosave loop from being started multiple times
let autoSaveLoopStarted = false;

canvas = document.getElementById('stage');
canvas.style.backgroundImage = "none";
ctx = canvas.getContext('2d');
ctx.lineJoin = 'round';
ctx.lineCap = 'round';
bufferCanvas = document.createElement('canvas');
bufferCtx = bufferCanvas.getContext('2d');
workCanvas = document.createElement('canvas');
workCtx = workCanvas.getContext('2d');
canvas.style.touchAction = 'none';
$ = id => document.getElementById(id);