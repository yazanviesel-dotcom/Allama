var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ limit: "50mb", extended: true }));
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && "status" in err && err.status === 400 && "body" in err) {
    res.status(400).json({ success: false, error: "\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0645\u0631\u0633\u0644 \u0643\u0628\u064A\u0631 \u062C\u062F\u0627\u064B \u0623\u0648 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0643\u0645\u062F\u062E\u0644 JSON." });
    return;
  }
  if (err && err.status === 413) {
    res.status(413).json({ success: false, error: "\u062D\u062C\u0645 \u0627\u0644\u0645\u0644\u0641 \u0643\u0628\u064A\u0631 \u062C\u062F\u0627\u064B! \u064A\u0631\u062C\u0649 \u0625\u0631\u0641\u0627\u0642 \u0645\u0644\u0641 \u0623\u0635\u063A\u0631 (\u0623\u0642\u0644 \u0645\u0646 50 \u0645\u064A\u062C\u0627\u0628\u0627\u064A\u062A)." });
    return;
  }
  next(err);
});
var aiClient = null;
function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables. Please add it in Settings > Secrets.");
    }
    aiClient = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
app.post("/api/gemini/generate-questions", async (req, res) => {
  try {
    const { prompt, text, pdfBase64, count = 5, type = "multiple_choice", language = "ar" } = req.body;
    const ai = getAiClient();
    const systemInstruction = `You are an expert English language teacher and professional question designer. 
Your goal is to generate high-quality, educational English questions for students based on the user prompt and context text/file.
Always return a JSON array containing exactly ${count} questions. Each question must match the requested type: '${type}' (either 'multiple_choice' or 'true_false' or mixed).
If type is 'multiple_choice', provide exactly 4 realistic options. Make sure the 'correctAnswer' is exactly one of those options.
If type is 'true_false', provide exactly 2 options: either ['\u0635\u062D', '\u062E\u0637\u0623'] (if language is 'ar') or ['True', 'False'] (if language is 'en'), and make sure the 'correctAnswer' is exactly one of them.
The language of the question text and explanation must be '${language}' (either 'ar' for Arabic or 'en' for English).
The options and correctAnswer must align with the language of the question.

Each question object in the JSON array must strictly have these fields:
- text: string (the question text)
- type: 'multiple_choice' | 'true_false'
- language: 'ar' | 'en'
- options: string[] (array of options)
- correctAnswer: string (must be exactly one of the options)
`;
    const parts = [];
    if (pdfBase64) {
      const base64Data = pdfBase64.includes("base64,") ? pdfBase64.split("base64,")[1] : pdfBase64;
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: "application/pdf"
        }
      });
    }
    parts.push({
      text: `Please generate ${count} educational questions.
User Prompt/Instructions: ${prompt || "General grammar questions"}
${text ? `Based on this reference text/content:
"""
${text}
"""` : ""}

Generate the JSON array of questions now.`
    });
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: parts,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.ARRAY,
          items: {
            type: import_genai.Type.OBJECT,
            properties: {
              text: { type: import_genai.Type.STRING },
              type: { type: import_genai.Type.STRING },
              language: { type: import_genai.Type.STRING },
              options: {
                type: import_genai.Type.ARRAY,
                items: { type: import_genai.Type.STRING }
              },
              correctAnswer: { type: import_genai.Type.STRING }
            },
            required: ["text", "type", "language", "options", "correctAnswer"]
          }
        }
      }
    });
    const resultText = response.text || "[]";
    const questions = JSON.parse(resultText);
    res.json({ success: true, questions });
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to generate questions using Gemini API" });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
