import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" })); // tighten later (restrict to extension)

const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT; // e.g., https://<resource>.openai.azure.com
const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT;  // e.g., gpt-4o-mini
const API_KEY = process.env.AZURE_OPENAI_API_KEY;        // secret

const SYSTEM_PROMPT = `
You are a multilingual form-field guidance assistant.
Given a field label and limited context, produce concise guidance in the requested language.
Output JSON with keys: explanation, examples (array), format_hint, caution.
Avoid asking for sensitive data unless clearly required by the label.
Keep guidance short, friendly, and culturally appropriate.
`;

app.post("/guidance", async (req, res) => {
  try {
    const { page_domain, user_language, field_context } = req.body;
    const body = {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify({ page_domain, user_language, field_context }) }
      ],
      temperature: 0.2
    };

    const resp = await fetch(
      `${AZURE_ENDPOINT}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=2025-01-01-preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": API_KEY },
        body: JSON.stringify(body)
      }
    );

    const json = await resp.json();
    const text = json.choices?.[0]?.message?.content ?? "{}";

    let guidance;
    try {
      guidance = JSON.parse(text);
    } catch {
      guidance = { explanation: text, examples: [], format_hint: "", caution: "" };
    }
    res.json(guidance);
  } catch (e) {
    console.error(e);
    res.status(500).json({
      explanation: "Provide the requested information in this field.",
      examples: [],
      format_hint: "",
      caution: ""
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Guidance server running on ${PORT}`));