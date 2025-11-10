//This file is part of project Codraw
//Author :  Nikhil kumar
//(c) 2025 uzumaki_arts

async function convertPdfToImages(pdfFile) {
  if (!pdfFile) return;
  try {
    const fileReader = new FileReader();
    const dataPromise = new Promise((resolve, reject) => {
      fileReader.onload = ev => resolve(new Uint8Array(ev.target.result));
      fileReader.onerror = reject;
    });
    fileReader.readAsArrayBuffer(pdfFile);
    const pdfData = await dataPromise;
    const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      try {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 }); // scale up a bit for quality
        // render page to offscreen canvas
        const offCanvas = document.createElement("canvas");
        offCanvas.width = viewport.width;
        offCanvas.height = viewport.height;
        const offCtx = offCanvas.getContext("2d");
        await page.render({ canvasContext: offCtx, viewport }).promise;
        // convert canvas -> base64 image
        const img = new Image();
        img.src = offCanvas.toDataURL("image/png");
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
        });
        // scale width to max 1200px, preserve aspect ratio
        if(img.height <= img.width){
        targetW = Math.min(1200, img.width);
        targetH = Math.round((img.height / img.width) * targetW);}
        else{
          targetH = ((Math.min(900, img.height))-50);
          targetW = ((Math.round((img.width / img.height) * targetH))-50);
        }
        // push into your objects array
        const obj = {
          type: "image",
          img,
          imgSrc: img.src,
          x: 200,
          y: 50,
          w: targetW,
          h: targetH,
          color: "#00000000"
        };
        objects.push(obj);
        selectedIndex = objects.length - 1;
        // re-render canvas
        repaintBuffer();
        repaintWorkBuffer(selectedIndex);
        scheduleRender();
        updatePropertiesPanel();
        if (i < pdfDoc.numPages) {
          await new Promise(res => setTimeout(res, 200));
          nextPage();
        }
      } catch (perr) {
        console.warn("Failed to render PDF page", i, perr);
      }
    }
      for (let i = 1; i < pdfDoc.numPages; i++) {
      prevPage();
    }
    setTool("select");
  } catch (err) {
    console.error("convertPdfToImages failed", err);
    alert("Failed to import PDF. See console for more details.");
  }
}

async function addPDF() {
  try {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.onchange = (e) => {
      const pdfFile = e.target.files[0];
      if (pdfFile) convertPdfToImages(pdfFile);
    };
    input.click();
  } catch (e) {
    console.error("addPDF error", e);
  }
}
