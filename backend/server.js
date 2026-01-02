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

Analyze the field_context provided (label_text, type, name, placeholder, surrounding_text) and generate SPECIFIC, CONTEXTUAL guidance in the requested language.

**CRITICAL RULES:**
1. Read the label_text and surrounding_text carefully to understand what the field is asking for
2. Provide guidance SPECIFIC to that field's question - never give generic advice
3. For name fields → explain how to format names properly
4. For email fields → explain email format and purpose
5. For radio/select fields → explain what the question is asking and how to choose
6. Use the field's actual label to frame your guidance
7. Be concise (2-3 sentences max)
8. Use culturally appropriate examples

Output ONLY valid JSON with these keys:
{
  "explanation": "Short, specific guidance addressing the exact field question",
  "examples": ["Example 1", "Example 2"],
  "format_hint": "Format requirements if any",
  "caution": "Important notes or warnings"
}

NEVER give generic responses like "Please provide your answer" - always reference the specific field's purpose.
`;

// Home page - show backend status
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>FormSaathi API</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 16px;
          padding: 40px;
          max-width: 600px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          text-align: center;
        }
        h1 { color: #667eea; font-size: 36px; margin-bottom: 16px; }
        .status { 
          display: inline-block;
          background: #d4edda;
          color: #155724;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: 600;
          margin-bottom: 24px;
        }
        .info { color: #666; line-height: 1.6; margin-bottom: 24px; }
        .endpoint {
          background: #f8f9fa;
          padding: 16px;
          border-radius: 8px;
          margin: 16px 0;
          text-align: left;
        }
        .endpoint code {
          background: #e9ecef;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
        }
        .footer { margin-top: 24px; color: #999; font-size: 14px; }
        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin: 24px 0;
        }
        .stat {
          background: #f8f9fa;
          padding: 16px;
          border-radius: 8px;
        }
        .stat-value { font-size: 24px; font-weight: 600; color: #667eea; }
        .stat-label { font-size: 12px; color: #666; margin-top: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🤝 FormSaathi API</h1>
        <div class="status">✅ Backend Running Successfully</div>
        <p class="info">
          AI-powered multilingual form guidance API powered by Azure OpenAI GPT-4o mini
        </p>
        
        <div class="stats">
          <div class="stat">
            <div class="stat-value">19+</div>
            <div class="stat-label">Languages</div>
          </div>
          <div class="stat">
            <div class="stat-value">GPT-4o</div>
            <div class="stat-label">AI Model</div>
          </div>
          <div class="stat">
            <div class="stat-value">Azure</div>
            <div class="stat-label">Powered By</div>
          </div>
        </div>
        
        <div class="endpoint">
          <strong>📡 API Endpoint:</strong><br>
          <code>POST /guidance</code><br><br>
          <strong>Request Body:</strong><br>
          <pre style="text-align: left; overflow-x: auto;">
{
  "page_domain": "example.com",
  "user_language": "hi-IN",
  "field_context": {
    "label_text": "Email",
    "type": "email"
  }
}</pre>
        </div>
        
        <div class="footer">
          FormSaathi Backend • Version 1.0.0<br>
          <a href="https://github.com/AnmolSharma1711/FormGuide" style="color: #667eea; text-decoration: none;">GitHub</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

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
    let text = json.choices?.[0]?.message?.content ?? "{}";
    
    // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

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