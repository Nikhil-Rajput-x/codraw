//This file is part of project Codraw
//Author :  Nikhil kumar
//(c) 2025 uzumaki_arts
function parseGeminiMathResponse(text) {
  if (!text) return null;
  const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!match) return null;
  const matched = match[0].replace(/^\{|\}$/g, ''); 
  return matched.trim();
}
function latexToJS(latex) {
  let expr = String(latex).trim();
  expr = expr.replaceAll('\\\\','\\');
  expr = expr.replace(/\s+/g, '');
  // fractions & roots
  expr = expr.replace(/\\frac{([^}]*)}{([^}]*)}/g, '($1)/($2)');
  expr = expr.replace(/\\sqrt{([^}]*)}/g, 'Math.sqrt($1)');
  expr = expr.replace(/\\times/g, '*');
  expr = expr.replaceAll(' ', '');
  // trig & log
  expr = expr.replace(/\\sin/g, 'Math.sin');
  expr = expr.replace(/\\cos/g, 'Math.cos');
  expr = expr.replace(/\\tan/g, 'Math.tan');
  expr = expr.replace(/\\cot/g, '(1/Math.tan)');
  expr = expr.replace(/\\sec/g, '(1/Math.cos)');
  expr = expr.replace(/\\csc|\\cosec/g, '(1/Math.sin)');
  expr = expr.replace(/\\log/g, 'Math.log10');
  expr = expr.replace(/\\ln/g, 'Math.log');
  // constants
  expr = expr.replace(/\\pi/g, 'Math.PI');
  expr = expr.replace(/pi/g, 'Math.PI');
  expr = expr.replace(/\\mathrm{e}/g, 'Math.E');
  expr = expr.replace(/\e/g, 'Math.E');
  expr = expr.replace(/\\e/g, 'Math.E');
   // exponents
  expr = expr.replace(/([0-9a-zA-Z\)\]])\^([0-9a-zA-Z\(\\]+)/g, '$1**($2)');
  // exponents (support {...} and fractions)
  expr = expr.replace(/([0-9a-zA-Z\)\]])\^\{?([^}]*)\}?/g,'$1**($2)');
  // auto * insertion
  expr = expr
    .replace(/(\d|\))(?=[a-zA-Z\(])/g, '$1*')
    .replace(/([a-zA-Z\)])(?=\d)/g, '$1*')
    .replace(/\)\(/g, ')*(');
console.log(expr);
  return expr;
}
function makeEvaluator(expr) {
  if (!/^([0-9+\-*/().,x\sA-Za-z_]|(\*\*))*$/.test(expr))
    throw new Error("Invalid characters in expression");
  const fn = new Function('x', `return ${expr};`);
  fn(0); // test compile
  return fn;
}
function makeEvaluatorFromLatex(latex) {
  if (latex.match('x')) {
    const jsExpr = latexToJS(latex);
    return makeEvaluator(jsExpr);
  }else if (latex.match('X')) {
    const jsExpr = latexToJS(latex);
    return makeEvaluator(jsExpr);
  }else{
  return null;
  }
}
// ---- NICE STEP CALCULATOR ----
function niceStep(range) {
  if (range <= 10) {
    return 1; // just integer steps when range is small
  }
  const rough = range / 10;
  const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
  const mult = rough / pow10;
  let nice;
  if (mult < 1.5) nice = 1;
  else if (mult < 3) nice = 2;
  else if (mult < 7) nice = 5;
  else nice = 10;
  return nice * pow10;
}
function drawGraph(fn) {
  const canvas = document.getElementById('chart');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  // === 1. Find Y range from fn ===
  let xMin = -10, xMax = 10;
  let yMin = Infinity, yMax = -Infinity;
  for (let i = 0; i <= 1000; i++) {
    const x = xMin + (i / 1000) * (xMax - xMin);
    const y = fn(x);
    if (!isFinite(y)) continue;
    yMin = Math.min(yMin, y);
    yMax = Math.max(yMax, y);
  }
  if (yMin === Infinity) { yMin = -1; yMax = 1; }
  // Add some padding
  const yRange = yMax - yMin || 1;
  yMin -= yRange * 0.1;
  yMax += yRange * 0.1;
  // --- keep square scale ---
  const xRange = xMax - xMin;
  const scale = Math.min(W / xRange, H / (yMax - yMin));
  const newXRange = W / scale;
  const newYRange = H / scale;
  const xMid = (xMax + xMin) / 2;
  const yMid = (yMax + yMin) / 2;
  xMin = xMid - newXRange / 2;
  xMax = xMid + newXRange / 2;
  yMin = yMid - newYRange / 2;
  yMax = yMid + newYRange / 2;
  function xToPx(x) { return (x - xMin) / (xMax - xMin) * W; }
  function yToPx(y) { return H - (y - yMin) / (yMax - yMin) * H; }
  // === 2. Draw grid with ~10 lines ===
  function niceStep(range) {
    const rough = range / 10;
    const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
    const mult = rough / pow10;
    let nice;
    if (mult < 1.5) nice = 1;
    else if (mult < 3) nice = 2;
    else if (mult < 7) nice = 5;
    else nice = 10;
    return nice * pow10;
  }
  ctx.clearRect(0, 0, W, H);
  const xStep = niceStep(xMax - xMin);
  const yStep = niceStep(yMax - yMin);
  const xStart = Math.ceil(xMin / xStep) * xStep;
  const yStart = Math.ceil(yMin / yStep) * yStep;
  ctx.strokeStyle = "#777";
  ctx.lineWidth = 0.2;
  // vertical
  ctx.beginPath();
  for (let x = xStart; x <= xMax; x += xStep) {
    const px = xToPx(x);
    ctx.moveTo(px, 0);
    ctx.lineTo(px, H);
  }
  ctx.stroke();
  // horizontal
  ctx.beginPath();
  for (let y = yStart; y <= yMax; y += yStep) {
    const py = yToPx(y);
    ctx.moveTo(0, py);
    ctx.lineTo(W, py);
  }
  ctx.stroke();
  // axes
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, yToPx(0));
  ctx.lineTo(W, yToPx(0));
  ctx.moveTo(xToPx(0), 0);
  ctx.lineTo(xToPx(0), H);
  ctx.stroke();
  // labels
  ctx.fillStyle = "#fff";
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let x = xStart; x <= xMax; x += xStep) {
    ctx.fillText(Math.round(x), xToPx(x), yToPx(0) + 3);
  }
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let y = yStart; y <= yMax; y += yStep) {
    if (Math.abs(y) < 1e-6) continue;
    ctx.fillText(Math.round(y), xToPx(0) - 3, yToPx(y));
  }
  // === 3. Plot the function ===
  ctx.strokeStyle = "#ff0000";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  let first = true;
  for (let px = 0; px < W; px++) {
    const x = xMin + (px / W) * (xMax - xMin);
    const y = fn(x);
    if (!isFinite(y)) { first = true; continue; }
    const py = yToPx(y);
    if (first) {
      ctx.moveTo(px, py);
      first = false;
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.stroke();
  // --- export base64 image (optional) ---
  setTimeout(() => {
    const chartCanvas = document.getElementById("chart");
    const chartBase64 = chartCanvas.toDataURL("image/png");
    addBase64Image(chartBase64);
  }, 2000);
}
const input = document.getElementById('fnInput');
const preview = document.getElementById('mathPreview');
const buttons = document.querySelectorAll('.buttons button');
let tokenStack = [];
function parseFractions(expr) {
  let depth = 0;
  let numerator = "";
  let denominator = "";
  let inFraction = false;
  let result = "";
  for (let i = 0; i < expr.length; i++) {
    // escape marker → stop fractioning, but keep the rest
    if (expr.startsWith("&nbsp;", i)) {
      if (inFraction) {
        // close current fraction and append marker
        result += `<span class="frac">
                    <span>${parseFractions(numerator)}</span>
                    <span class="frac bottom">${parseFractions(denominator)}</span>
                  </span>`;
      } else {
        result += numerator; // just add what we had
      }
      result += "&nbsp;" + parseFractions(expr.slice(i + 6)); // continue after marker
      return result;
    }
    let ch = expr[i];
    if (ch === "(" || ch === "{") depth++;
    else if (ch === ")" || ch === "}") depth--;
    if (ch === "/" && depth === 0 && !inFraction) {
      inFraction = true;
    } else {
      if (!inFraction) {
        numerator += ch;
      } else {
        denominator += ch;
      }
    }
  }
  if (inFraction) {
    result += `<span class="frac">
                <span>${parseFractions(numerator)}</span>
                <span class="frac bottom">${parseFractions(denominator)}</span>
              </span>`;
  } else {
    result += numerator;
  }
  return result;
}
function formatMath(expr){
  if(expr == null) return '';
  let s = String(expr);
  // normalize backslashed function names
  s = s.replace(/\\(sin|cos|tan|sinh|cosh|tanh|sec|cot|csc|ln|log|abs)\s*\{/g, '$1{');
  // FRACTIONS
s = parseFractions(s);
  // sqrt
    s = s.replace(/√\{([^}]*)\}/g, (_, inside)=>{
    return `<span class="sqrt"><span class="sqrt-symbol">√</span><span class="sqrt-content">${formatMath(inside)}</span></span>`;
  });  
  s = s.replace(/√\{([^}]*)/g, (_, inside)=>{
    return `<span class="sqrt"><span class="sqrt-symbol">√</span><span class="sqrt-content">${formatMath(inside)}</span></span>`;
  });
  // superscripts
  s = s.replace(/([A-Za-z0-9\)\]\}])\^\{([^}]*)\}/g, (_, base, content)=>{
    return base + "<sup>" + formatMath(content) + "</sup>";
  });
  s = s.replace(/([A-Za-z0-9\)\]\}])\^\{([^}]*)/g, (_, base, simple)=>{
    return base + "<sup>" + simple + "</sup>";
  });
  return s;
}
/* render preview */
function rendermath(){
  preview.innerHTML = '<span class="math">' + formatMath(input.value) + '</span>';
}
buttons.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const v = btn.textContent;
    if(v === '⌫'){
      if(tokenStack.length>0){
        const last = tokenStack.pop();
        input.value = input.value.slice(0, -last.length);
      } else {
        input.value = input.value.slice(0, -1);
      }
    } else if(v === '√'){
      input.value += "√{";
      tokenStack.push("√{");
    } else if (v === '→') {
  const val = input.value;
  // count how many "{" and "}" are present
  const openBraces = (val.match(/\{/g) || []).length;
  const closeBraces = (val.match(/\}/g) || []).length;
  if (openBraces > closeBraces) {
    // there's at least one unclosed "{"
    input.value += "}";
    tokenStack.push("}");
  } else {
    // no unclosed braces, insert non-breaking space
    input.value += "&nbsp;";  // safer than &nbsp; in JS
    tokenStack.push("&nbsp;");
  }
    } else if(v === '^'){
      input.value += "^{";
      tokenStack.push("^{");
    } else if(['sin','cos','tan','sinh','cosh','tanh','cot','csc','sec','log','ln','abs'].includes(v)){
      input.value += ""+v+"(";
      tokenStack.push(""+v+"(");
    }else if(v === '𝒙'){
      input.value += "x";
      tokenStack.push("x");
    } else {
      input.value += v;
      tokenStack.push(v);
    }
    rendermath();
    input.focus();
  });
});
input.addEventListener('input', rendermath);
rendermath();
(function(){
  // --- polyfills / helpers ---
  if (!Math.log10) Math.log10 = function(x){ return Math.log(x)/Math.LN10; };
  if (!Math.sinh) Math.sinh = function(x){ return (Math.exp(x)-Math.exp(-x))/2; };
  if (!Math.cosh) Math.cosh = function(x){ return (Math.exp(x)+Math.exp(-x))/2; };
  if (!Math.tanh) Math.tanh = function(x){ return Math.sinh(x)/Math.cosh(x); };
  // DOM refs
  const modal = document.getElementById('graphModal');
  const canvas = document.getElementById('graphCanvas');
  const ctx = canvas.getContext('2d');
  const fnInput = document.getElementById('fnInput');
  const keypad = document.getElementById('gm-keypad');
  // State
  let graphZoom = 100; // pixels per unit
  let offsetX = 0, offsetY = 0; // screen offset in px
  let isPanning = false, panLast = {x:0,y:0};
  let graphFn = x => (x**x) ;
  let showLabels = true;
  // Keypad buttons (arranged for convenience)
  const KEYS = ['⌫'];
  // ---- Tokenizer ----
  function tokenize(s){
    s = String(s);
    const tokens = [];
    let i = 0;
    while(i < s.length){
      const ch = s[i];
      if (/\s/.test(ch)) { i++; continue; }
      // number (including decimals and scientific notation)
      if (/[0-9.]/.test(ch)){
        let j = i;
        let num = '';
        // collect digits and decimal
        while(j < s.length && /[0-9.]/.test(s[j])) { num += s[j]; j++; }
        // exponent part
        if (j < s.length && (s[j] === 'e' || s[j] === 'E')) {
          let k = j+1;
          let exp = s[j];
          if (s[k] === '+' || s[k] === '-') { exp += s[k]; k++; }
          let hasD=false;
          while(k < s.length && /[0-9]/.test(s[k])) { exp += s[k]; k++; hasD=true; }
          if (hasD) { num += exp; j = k; }
        }
        tokens.push({type:'number', value:num});
        i = j;
        continue;
      }
      // names (functions or variables)
      if (/[A-Za-z]/.test(ch)){
        let j = i;
        let name = '';
        while(j < s.length && /[A-Za-z]/.test(s[j])) { name += s[j]; j++; }
        tokens.push({type:'name', value:name});
        i = j;
        continue;
      }
      // parentheses
      if (ch === '('){ tokens.push({type:'('}); i++; continue; }
      if (ch === ')'){ tokens.push({type:')'}); i++; continue; }
      // operators
      if ('+-*/^,'.includes(ch)){ tokens.push({type:'op', value:ch}); i++; continue; }
      // fallback: push char as op and advance
      tokens.push({type:'op', value:ch}); i++;
    }
    return tokens;
  }
  // find matching paren index in tokens starting from idx of '('
  function findMatchingParenIndex(tokens, openIdx){
    let depth = 0;
    for(let i=openIdx; i<tokens.length; i++){
      if (tokens[i].type === '(') depth++;
      if (tokens[i].type === ')'){ depth--; if (depth === 0) return i; }
    }
    return -1;
  }
  // parse tokens -> JS expression string (handles functions, implicit multiplication)
  function parseTokensToExpr(tokens){
    // recursive parser that builds expression string from tokens[start..end-1]
    function parseRange(start, end){
      let out = '';
      let lastWasFactor = false; // helps insert implicit "*"
      let i = start;
      while(i < end){
        const t = tokens[i];
        if (!t) { i++; continue; }
        // parentheses
        if (t.type === '('){
          const closing = findMatchingParenIndex(tokens, i);
          const inner = parseRange(i+1, closing === -1 ? end : closing);
          const expr = '(' + inner + ')';
          if (lastWasFactor) out += '*';
          out += expr; lastWasFactor = true;
          i = (closing === -1 ? end : closing+1);
          continue;
        }
        // number
        if (t.type === 'number'){
          if (lastWasFactor) out += '*';
          out += t.value; lastWasFactor = true; i++; continue;
        }
        // name: could be constant, variable, or function (with or without parentheses)
        if (t.type === 'name'){
          const nameLower = t.value.toLowerCase();
          // constants
          if (nameLower === 'pi'){
            if (lastWasFactor) out += '*';
            out += 'Math.PI'; lastWasFactor = true; i++; continue;
          }
          if (nameLower === 'e'){
            // be careful: numbers with scientific notation already tokenized as single number
            if (lastWasFactor) out += '*';
            out += 'Math.E'; lastWasFactor = true; i++; continue;
          }
          // function mapping sets
          const DIRECT = new Set(['sin','cos','tan','sinh','cosh','tanh','sqrt','abs']);
          const SPECIAL = new Set(['ln','log']);
          const RECIP = { sec:'cos', csc:'sin', cosec:'sin', cot:'tan', sech:'cosh', csch:'sinh', coth:'tanh' };
          // if next token is '(' -> normal call with parenthesized argument
          const next = tokens[i+1];
          if ((DIRECT.has(nameLower) || SPECIAL.has(nameLower) || RECIP[nameLower]) && next && next.type === '('){
            // find matching paren index
            const close = findMatchingParenIndex(tokens, i+1);
            const innerExpr = parseRange(i+2, close === -1 ? i+1 : close); // inside parentheses
            if (RECIP[nameLower]) {
              const mapped = RECIP[nameLower];
              if (lastWasFactor) out += '*';
              out += '(1/Math.' + mapped + '(' + innerExpr + '))';
            } else if (SPECIAL.has(nameLower)) {
              // ln -> Math.log, log -> Math.log10
              if (lastWasFactor) out += '*';
              if (nameLower === 'ln') out += 'Math.log(' + innerExpr + ')';
              else out += 'Math.log10(' + innerExpr + ')';
            } else {
              if (lastWasFactor) out += '*';
              out += 'Math.' + nameLower + '(' + innerExpr + ')';
            }
            lastWasFactor = true;
            i = (close === -1 ? i+2 : close+1);
            continue;
          }
          // function name with implicit argument (e.g., "sin 2x" or "sin2x")
          if ((DIRECT.has(nameLower) || SPECIAL.has(nameLower) || RECIP[nameLower]) && next && (next.type === 'number' || next.type === 'name' || next.type === '(')){
            // parse a single factor as the argument (if it's a parenthesis group, use that group)
            let argExpr = '', nextIndex = i+1;
            if (next.type === '('){
              const close = findMatchingParenIndex(tokens, i+1);
              argExpr = parseRange(i+2, close === -1 ? i+1 : close);
              nextIndex = (close === -1 ? i+2 : close+1);
            } else {
              // take successive tokens that form a multiplicative factor (e.g., 2 x or 2*x)
              // we'll take tokens until we hit an operator +,-,/,^,',' or end
              let j=i+1;
              const chunk = [];
              while(j < tokens.length && !(tokens[j].type === 'op' && /[+\-\/^,]/.test(tokens[j].value))){
                // stop at a whitespace-equivalent / top-level + or - (as separator)
                if (tokens[j].type === ')') break;
                chunk.push(tokens[j]);
                // if next token is name/number/paren open and there's no explicit '*' between them,
                // keep taking (we will insert '*' when building)
                j++;
                // if next token is an operator like '*' we should consume it and include it in chunk
                if (j < tokens.length && tokens[j].type === 'op' && tokens[j].value === '*'){ chunk.push(tokens[j]); j++; continue; }
                // stop if next is + - * / ^ at top-level
                if (j < tokens.length && tokens[j].type === 'op' && /[+\-\/^,]/.test(tokens[j].value)) break;
              }
              argExpr = parseRangeTokens(chunk);
              nextIndex = j;
            }
            if (RECIP[nameLower]) {
              const mapped = RECIP[nameLower];
              if (lastWasFactor) out += '*';
              out += '(1/Math.' + mapped + '(' + argExpr + '))';
            } else if (SPECIAL.has(nameLower)) {
              if (lastWasFactor) out += '*';
              out += (nameLower === 'ln' ? 'Math.log(' : 'Math.log10(') + argExpr + ')';
            } else {
              if (lastWasFactor) out += '*';
              out += 'Math.' + nameLower + '(' + argExpr + ')';
            }
            lastWasFactor = true;
            i = nextIndex;
            continue;
          }
          // otherwise plain variable (like x)
          if (lastWasFactor) out += '*';
          out += nameLower;
          lastWasFactor = true;
          i++; continue;
        }
        // operators
        if (t.type === 'op'){
          // '^' -> '**'
          const op = (t.value === '^') ? '**' : t.value;
          out += op;
          lastWasFactor = false;
          i++; continue;
        }
        // unknown, advance
        i++;
      }
      return out;
    }
    function parseRangeTokens(tokenArray){
      // helper: parse an array of tokens (not necessarily contiguous in original) by recursively calling parseTokensToExpr
      if (!tokenArray || tokenArray.length === 0) return '';
      return parseTokensToExpr(tokenArray);
    }
    // If parseTokensToExpr gets an array instead of from token list start/end,
    // adapt: allow passing array.
    if (Array.isArray(tokens)){
      // top-level call for an array: parse tokens 0..len
      return parseRange(0, tokens.length);
    } else {
      return '';
    }
  }
  // Main parse entry: string -> JS expression -> function
  function parseExpressionToFunction(inputStr){
    if (!inputStr || !String(inputStr).trim()) throw new Error('Empty input');
    // prepare: lower-case for easier function matching (variables are usually x which is fine)
    let s = String(inputStr).trim();
    // friendly normalizations:
    s = s.replace(/×/g,'*').replace(/÷/g,'/').replace(/\s*\*\s*/g,'*'); // remove noisy spaces around * to simplify
    // tokenization
    const tokens = tokenize(s);
    // convert tokens array to JS expression
    const expr = parseTokensToExpr(tokens);
    if (!expr || expr.trim() === '') throw new Error('Could not parse expression');
    // safety check: forbid quotes/semicolons/backticks
    if (/[;'"`]/.test(expr)) throw new Error('Invalid characters in expression');
    // compile
    let fn;
    try {
      fn = new Function('x', `return (${expr});`);
      // quick sanity check (do not throw if runtime domain errors)
      try { fn(0); } catch(e) {}
    } catch(err){
      throw new Error('Compilation failed: ' + (err && err.message ? err.message : err));
    }
    return fn;
  }
  // --- dynamic tick step calculation ---
  function chooseStep(zoomPxPerUnit, minPxPerStep = 36){
    // want stepUnits such that stepUnits * zoomPxPerUnit >= minPxPerStep
    const desired = minPxPerStep / zoomPxPerUnit;
    // candidates: 1,2,5 times powers of 10
    const bases = [1,2,5];
    const exp = Math.floor(Math.log10(Math.max(desired, 1e-12)));
    let best = Number.MAX_VALUE, bestVal = 1;
    for (let e = exp-2; e <= exp+4; e++){
      const pow = Math.pow(10, e);
      for (const b of bases){
        const v = b * pow;
        if (v >= desired && v < best){
          best = v; bestVal = v;
        }
      }
    }
    if (bestVal === 1 && desired > 1) { // fallback
      bestVal = Math.pow(10, Math.ceil(Math.log10(desired)));
    }
    return bestVal;
  }
  // format label nicely
  function formatLabel(val, step){
    // step influences decimal places
    const absStep = Math.abs(step);
    if (absStep >= 1) return String(Math.round(val));
    // decimal places ~ -floor(log10(step))
    const decimals = Math.max(0, Math.ceil(-Math.log10(absStep)));
    return Number(val).toFixed(decimals);
  }
  // --- draw graph with adaptive grid and labels ---
  function drawGraph(){
  // set canvas size to CSS size
  canvas.width = Math.max(240, canvas.clientWidth);
  canvas.height = Math.max(160, canvas.clientHeight);
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.save();

  // transparent background (modal background shows)
  // draw grid
  const midX = W/2 + offsetX;
  const midY = H/2 + offsetY;

  // choose step (units)
  const stepUnits = chooseStep(graphZoom, 40); // min 40px between grid lines
  // compute visible x range (math coords)
  const xMin = (-midX) / graphZoom;
  const xMax = (W - midX) / graphZoom;
  const yMax = (midY) / graphZoom;
  const yMin = -(H - midY) / graphZoom;

  // find first grid lines
  const xStart = Math.ceil(xMin / stepUnits) * stepUnits;
  const yStart = Math.ceil(yMin / stepUnits) * stepUnits;

  // draw light grid lines
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = 'rgba(180, 180, 180, 0.75)';

  for (let gx = xStart; gx <= xMax; gx += stepUnits){
    const sx = Math.round(midX + gx * graphZoom) + 0.5;
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
  }
  for (let gy = yStart; gy <= yMax; gy += stepUnits){
    const sy = Math.round(midY - gy * graphZoom) + 0.5;
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
  }

  // axes
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#4bdff9ff';
  ctx.beginPath();
  // x-axis
  const xAxisY = Math.round(midY) + 0.5;
  ctx.moveTo(0, xAxisY); ctx.lineTo(W, xAxisY);
  // y-axis
  const yAxisX = Math.round(midX) + 0.5;
  ctx.moveTo(yAxisX, 0); ctx.lineTo(yAxisX, H);
  ctx.stroke();

  // ticks and labels
  if (showLabels){
    ctx.fillStyle = '#ffffffff';
    ctx.font = '15px nerd';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    // x labels
    for (let gx = xStart; gx <= xMax; gx += stepUnits){
      const sx = Math.round(midX + gx * graphZoom);
      // tick
      ctx.beginPath(); ctx.moveTo(sx + 0.5, xAxisY - 6); ctx.lineTo(sx + 0.5, xAxisY + 6); ctx.stroke();
      if (Math.abs(gx) > 1e-12) ctx.fillText(formatLabel(gx, stepUnits), sx, xAxisY + 8);
    }
    // y labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let gy = yStart; gy <= yMax; gy += stepUnits){
      const sy = Math.round(midY - gy * graphZoom);
      ctx.beginPath(); ctx.moveTo(yAxisX - 6, sy + 0.5); ctx.lineTo(yAxisX + 6, sy + 0.5); ctx.stroke();
      if (Math.abs(gy) > 1e-12) ctx.fillText(formatLabel(gy, stepUnits), yAxisX - 8, sy);
    }
    ctx.textAlign = 'right'; ctx.textBaseline='bottom';
    ctx.fillText('X', W - 6, xAxisY - 6);
    ctx.textAlign = 'left'; ctx.textBaseline='top';
    ctx.fillText('Y', yAxisX + 6, 6);
  }

  // plot function (improved)
  ctx.save();
  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ff3b3b';

  let first = true;
  let prevY = null;

  const stepPx = 0.05; // smaller step for smoother curves
  for (let px = 0; px <= W; px += stepPx){
    const x = (px - midX) / graphZoom;
    let y;
    try { y = graphFn(x); }
    catch { first = true; prevY = null; continue; }
    if (!isFinite(y)) { first = true; prevY = null; continue; }

    const py = midY - y * graphZoom;

    // avoid drawing across vertical asymptotes (huge jumps)
    if (prevY !== null && Math.abs(py - prevY) > H) {
      first = true;
    }

    if (first){ ctx.moveTo(px, py); first=false; }
    else ctx.lineTo(px, py);

    prevY = py;
  }
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}
  // --- interaction: pan / wheel zoom / buttons ---
  function onPointerDown(e){
    isPanning = true; panLast = {x:e.clientX, y:e.clientY}; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e){
    if (!isPanning) return;
    offsetX += (e.clientX - panLast.x);
    offsetY += (e.clientY - panLast.y);
    panLast = {x:e.clientX, y:e.clientY};
    drawGraph();
  }
  function onPointerUp(e){ isPanning = false; canvas.releasePointerCapture && canvas.releasePointerCapture(e.pointerId); }
  function onWheel(e){
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const relGraphX = (mouseX - (canvas.width/2 + offsetX)) / graphZoom;
    const relGraphY = (mouseY - (canvas.height/2 + offsetY)) / graphZoom;
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    const newZoom = Math.max(6, Math.min(2000, graphZoom * factor));
    // recalc offsets so zoom is around mouse
    const newScreenX = relGraphX * newZoom + (canvas.width/2 + offsetX);
    const newScreenY = relGraphY * newZoom + (canvas.height/2 + offsetY);
    offsetX += (mouseX - newScreenX);
    offsetY += (mouseY - newScreenY);
    graphZoom = newZoom;
    drawGraph();
  }
  function zoomIn(){ graphZoom = Math.min(2000, graphZoom * 1.2); drawGraph(); }
  function zoomOut(){ graphZoom = Math.max(6, graphZoom / 1.2); drawGraph(); }
  function resetView(){ graphZoom = 40; offsetX = 0; offsetY = 0; drawGraph(); }
  // --- parse & plot ---
  function plotFromInput(){
    let inputext = (((((fnInput.value).replaceAll('π','pi')).replaceAll('{','(')).replaceAll('}',')').replaceAll('√','sqrt')).replace('𝒙','x')) || '';
      let open = 0, close = 0;
      for (let ch of inputext) {
        if (ch === '(') open++;
        else if (ch === ')') close++;
      }
      // If '(' is more, add the missing ')'
      if (open > close) {
        inputext += ')'.repeat(open - close);
      }
    const s = inputext;
    if (!s.trim()) { alert('Enter a function (e.g. sin(x), x^2, e^x)'); return; }
    try {
      const fn = parseExpressionToFunction(s);
      graphFn = fn;
      drawGraph();
    } catch (err){
      alert('Invalid expression: ' + (err && err.message ? err.message : err));
    }
  }
  // import graph as image to main canvas objects
  function importGraph(){
    const dataUrl = canvas.toDataURL('image/png');
    addBase64Image(dataUrl);
      closeModal();
  }
  // open/close
  function openModal(){
    modal.style.display = 'block';
    fnInput.focus();
    drawGraph();
  }
  function closeModal(){ modal.style.display = 'none'; }
  // keypad wiring
  function initKeypad(){
    keypad.innerHTML = '';
    KEYS.forEach(k => {
      const b = document.createElement('button');
      b.textContent = k;
      b.style.padding = '8px';
      b.style.borderRadius = '6px';
      b.style.background = '#1a1a1a';
      b.style.color = '#fff';
      b.onclick = () => {
        if (k === '⌫' || k === 'Backspace') {
          const v = fnInput.value;
          fnInput.value = v.slice(0, -1);
          fnInput.focus();
          return;
        }
        // convenience: if function-like (sin) append '(' automatically
        if (/^(sin|cos|tan|sinh|cosh|tanh|sec|cot|csc|sqrt|ln|log|abs)$/i.test(k)) {
          insertAtCursor(k + '(');
        } else if (k === 'pi') insertAtCursor('pi');
        else if (k === 'e') insertAtCursor('e');
        else insertAtCursor(k);
        fnInput.focus();
      };
      keypad.appendChild(b);
    });
  }
  function insertAtCursor(text){
    const el = fnInput;
    const s = el.value;
    const start = el.selectionStart || s.length;
    const end = el.selectionEnd || start;
    el.value = s.slice(0, start) + text + s.slice(end);
    const pos = start + text.length;
    el.setSelectionRange(pos, pos);
    el.focus();
  }
  // sample buttons & wiring
  function wireUI(){
    document.getElementById('gm-plot').addEventListener('click', plotFromInput);
    document.getElementById('gm-close').addEventListener('click', closeModal);
    document.getElementById('gm-import').addEventListener('click', importGraph);
    document.getElementById('gm-zoom-in').addEventListener('click', zoomIn);
    document.getElementById('gm-zoom-out').addEventListener('click', zoomOut);
    document.getElementById('gm-reset').addEventListener('click', resetView);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive:false });
    fnInput.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') plotFromInput(); });
  }
  // expose open function
  window.openGraphModal = openModal;
  // init
  initKeypad();
  wireUI();
  drawGraph();
})();