//This file is part of project Codraw
//Author :  Nikhil kumar
//(c) 2025 uzumaki_arts

async function gemini() {
  const settings = loadSettings();
  if (!settings.geminiApiKeys.length) {
    alert("No Gemini API keys found in settings.");
    return;
  }
  const API_KEYS = settings.geminiApiKeys
  const key = API_KEYS[Math.floor(Math.random() * API_KEYS.length)];
  console.log(key);
  const apiKey = key; 
  const genAI = new window.GoogleGenerativeAI(apiKey);
  const selectedModel = (settings.geminiModel && settings.geminiModel.trim()) ? settings.geminiModel.trim() : 'gemini-2.5-flash';
  const model = genAI.getGenerativeModel({ model: selectedModel });

  const canvas = document.getElementById("stage");
  const dataUrl = canvas.toDataURL("image/png");

  document.getElementById("answer").innerHTML =
    '<button id="close" onclick="document.getElementById(\'answer\').style.display = \'none\'">x</button> Model: ' + selectedModel + ' — Thinking...';

  try {
    const result = await model.generateContent([
      { text: "Read this image. "+
          "If it is a math word problem or question, also solve it and give the equation(s) and then Answer:. "+
          "If nothing is math or a question, explain briefly what is visible."+
        "In case of math problems, show all steps clearly. and format the equations using LaTeX." +
        "Use MathML format for math equations so they can be rendered properly." +
        "Respond in a clear and structured HTML format." },
      {
        inlineData: {
          data: dataUrl.split(",")[1],
          mimeType: "image/png"
        }
      }
    ]);

    const text = result.response.text();
    console.log(text);

    // Format Gemini output into a friendly HTML layout and convert LaTeX math to MathML
    // We used to escape all HTML; models may now return structured HTML (and MathML) directly.
    // To render safely, sanitize model HTML (preserve <math> tags), and still extract TeX for MathJax typesetting.

    // Ensure DOMPurify is available (load dynamically if needed)
    function ensureDOMPurify() {
      if (window.DOMPurify) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/dompurify@2.4.0/dist/purify.min.js';
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load DOMPurify'));
        document.head.appendChild(s);
      });
    }

    // Extract math segments and replace them with placeholders so we can safely escape HTML
    function extractMathSegments(raw) {
      const segments = [];
      let s = raw;
      // handle $$...$$ (display)
      s = s.replace(/\$\$([\s\S]+?)\$\$/g, (m, cap) => {
        const id = segments.length; segments.push({ tex: cap, display: true }); return `@@MATH${id}@@`;
      });
      // handle \[ ... \]
      s = s.replace(/\\\[([\s\S]+?)\\\]/g, (m, cap) => { const id = segments.length; segments.push({ tex: cap, display: true }); return `@@MATH${id}@@`; });
      // handle \( ... \)
      s = s.replace(/\\\(([\s\S]+?)\\\)/g, (m, cap) => { const id = segments.length; segments.push({ tex: cap, display: false }); return `@@MATH${id}@@`; });
      // handle single $...$ (inline) - avoid $$ which already handled
      s = s.replace(/\$([^\$\n][^\$]*?)\$/g, (m, cap) => { const id = segments.length; segments.push({ tex: cap, display: false }); return `@@MATH${id}@@`; });
      return { text: s, segments };
    }

    function formatGeminiText(raw) {
      if (!raw || !raw.trim()) return { html: '<p>No response</p>', segments: [] };
      // extract math segments first
      const extracted = extractMathSegments(raw.trim());
      let t = extracted.text;
      // For plain text responses, we still escape HTML so user text doesn't inject markup
      t = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      // Convert '**Heading:**' style to <h3>Heading</h3>
      t = t.replace(/\*\*(.+?):\*\*/g, (m, cap) => '<h3>' + cap.trim() + '</h3>');

      // Convert numbered lists into <ol> while preserving original numbering (use start attr)
      t = t.replace(/(?:\n|\r|^)(\s*\d+\.\s.*(?:\n\s*\d+\.\s.*)*)/g, (m, block) => {
        const items = [];
        const lineRe = /^\s*(\d+)\.\s*(.*)$/gm;
        let lm;
        while ((lm = lineRe.exec(block)) !== null) {
          const num = parseInt(lm[1], 10);
          const txt = (lm[2] || '').trim();
          items.push({ num, txt });
        }
        if (items.length === 0) return m;
        const firstNum = items[0].num || 1;
        const startAttr = (firstNum > 1) ? ` start="${firstNum}"` : '';
        return '\n<ol' + startAttr + '>' + items.map(i => '<li>' + (i.txt || '&nbsp;') + '</li>').join('') + '</ol>\n';
      });

      // Convert blank lines to paragraph breaks
      t = t.split(/\n\s*\n/).map(p => p.replace(/\n/g, '<br>')).join('</p><p>');
      t = '<p>' + t + '</p>';

      // tidy wrappers
      t = t.replace(/<p>\s*(<h3>)/g, '$1');
      t = t.replace(/(<\/h3>)\s*<\/p>/g, '$1');
      t = t.replace(/<p>\s*(<ol>)/g, '$1');
      t = t.replace(/(<\/ol>)\s*<\/p>/g, '$1');

      // Return HTML with placeholders and the extracted math segments
      return { html: '<div class="gem-body">' + t + '</div>', segments: extracted.segments };
    }

    // Render sanitized HTML returned from the model (it may already be structured and contain MathML)
    async function renderSanitizedHtml(raw) {
      const extracted = extractMathSegments(raw);
      await ensureDOMPurify();
      // Allow MathML tags like <math> while sanitizing everything else
      const clean = window.DOMPurify.sanitize(extracted.text, { ADD_TAGS: ['math'], ADD_ATTR: ['xmlns'] });
      // Use existing convertAllMathAndRender which will replace placeholders with TeX wrappers and typeset
      convertAllMathAndRender('<div class="gem-body">' + clean + '</div>', extracted.segments);
    }

    // Helper to convert TeX -> MathML using MathJax (tex2mml)
    function convertAllMathAndRender(formattedHtml, segments) {
      // replace placeholders with TeX delimiters so MathJax can typeset them properly
      let html = formattedHtml;
      segments.forEach((seg, idx) => {
        const tex = seg.tex;
        if (seg.display) {
          html = html.replace(`@@MATH${idx}@@`, `<div class="math-placeholder">\\[${tex}\\]</div>`);
        } else {
          html = html.replace(`@@MATH${idx}@@`, `<span class="math-placeholder">\\(${tex}\\)</span>`);
        }
      });
      document.getElementById("answer").innerHTML = '<button id="close" onclick="document.getElementById(\'answer\').style.display = \'none\'">x</button> <div class="gm-response">' + html + '</div>';

      // Ask MathJax to typeset the newly inserted TeX so operators (integral, sum, etc.) are sized/spaced correctly
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise();
      }
    }

    // If model returned HTML (looks like it contains tags), render sanitized HTML; otherwise format plain text
    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(text);
    if (looksLikeHtml) {
      // The model returned HTML. Sanitize and render it while preserving MathML and enqueued TeX.
      await renderSanitizedHtml(text);
    } else {
      const formattedObj = formatGeminiText(text);

      
      if (formattedObj.segments && formattedObj.segments.length) {
        // if MathJax is available with tex2mml, do sync conversion; else load it then convert
        const ensureMathJax = () => {
          if (window.MathJax && window.MathJax.tex2mml) return Promise.resolve();
          return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
            script.async = true;
            script.onload = () => { resolve(); };
            document.head.appendChild(script);
          });
        };
        ensureMathJax().then(() => { convertAllMathAndRender(formattedObj.html, formattedObj.segments); });
      } else {
        // no math segments, just render escaped/HTML-formatted text
        document.getElementById("answer").innerHTML = '<button id="close" onclick="document.getElementById(\'answer\').style.display = \'none\'">x</button> <div class="gm-response">' + formattedObj.html + '</div>';
      }
    }



  } catch (err) {
    console.error(err);
          document.getElementById("answer").innerHTML ='<button id="close" onclick="document.getElementById(\'answer\').style.display = \'none\'">x</button>' +"<br><p style='font-size: 20px; color: #eeaabb'>[!] Unexcepted error happen check cosole for more detail.<p>";
  }
}


document.getElementById('answer').innerHTML = '';

document.getElementById("ask").addEventListener("click", async () => {
    if (document.getElementById('answer').innerHTML === ''){ 
      document.getElementById("answer").style.display = 'block';
      gemini();
  }else{
      if (document.getElementById("answer").style.display === 'block'){
        document.getElementById("answer").style.display = 'block';
        gemini();
      }
      else{
        document.getElementById("answer").style.display = 'block';
      };
  }});