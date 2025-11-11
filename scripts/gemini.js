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
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const canvas = document.getElementById("stage");
  const dataUrl = canvas.toDataURL("image/png");

  document.getElementById("answer").innerHTML =
    '<button id="close" onclick="document.getElementById(\'answer\').style.right = \'none\'">x</button> Thinking...';

  try {
    const result = await model.generateContent([
      { text: "Read this image. "+
          "If it is a math word problem or question, also solve it and give the equation(s) and then Answer:. "+
          "If nothing is math or a question, explain briefly what is visible." },
      {
        inlineData: {
          data: dataUrl.split(",")[1],
          mimeType: "image/png"
        }
      }
    ]);

    const text = result.response.text();
    console.log(text);

    document.getElementById("answer").innerHTML =
      '<button id="close" onclick="document.getElementById(\'answer\').style.right = \'none\'">x</button> ' + text;

    const mathx = parseGeminiMathResponse(text.trim());
    if (mathx) {
      const fn = makeEvaluatorFromLatex(mathx);
      if(fn){
      drawGraph(fn);
    document.getElementById("answer").innerHTML = '<button id="close" onclick="document.getElementById(\'answer\').style.display = \'none\'">x</button> ' + text + "";}else{
      document.getElementById("answer").innerHTML ='<button id="close" onclick="document.getElementById(\'answer\').style.display = \'none\'">x</button> ' + text + "<br><p style='font-size: 12px; color: #eeaabb'>[! if you are using it for complex graph can't be always perfect. !] <br> [ this is only designed for simple equations not complex one ]<br>[ It is using gemini-1.5-flash for detacting hand writting so even messy handwritting can also cause errors ]<p>";}
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