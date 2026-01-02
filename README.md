# 📝 FormGuide - AI-Powered Multilingual Form Assistant

An intelligent browser extension that provides real-time, AI-generated guidance for form fields in 19+ languages using Azure OpenAI.

## 🌟 Features

- 🤖 **AI-Powered Guidance** - Uses Azure OpenAI (GPT-4o mini) for contextual help
- 🌍 **19+ Languages** - Support for Hindi, Marathi, Bengali, Tamil, and many more
- ⚡ **Real-time Assistance** - Instant tooltips on any form field
- 🎨 **Modern UI** - Beautiful, intuitive settings interface
- 🔒 **Privacy-Focused** - No data storage, secure processing

## 🏗️ Project Structure

```
FormGuide/
├── backend/              # Node.js Express server
│   ├── server.js        # Main API server
│   ├── package.json     # Dependencies
│   └── vercel.json      # Vercel deployment config
├── extension/           # Browser extension
│   ├── manifest.json    # Extension configuration
│   ├── background.js    # Service worker
│   ├── content.js       # Content script
│   ├── options.html     # Settings UI
│   ├── options.js       # Settings logic
│   └── style.css        # Extension styles
└── test-form.html       # Test page
```

## 🚀 Quick Start

### Backend Setup

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment variables:**
   Create `.env` file:
   ```env
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
   AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
   AZURE_OPENAI_API_KEY=your-api-key
   PORT=3000
   ```

3. **Run locally:**
   ```bash
   npm start
   ```

### Extension Setup

1. Open Chrome/Edge browser
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `extension` folder

## 🌐 Deployment

### Backend Deployment (Choose one)

**Vercel (Recommended):**
```bash
cd backend
npm install -g vercel
vercel
```
Add environment variables in Vercel dashboard.

**Render:**
1. Push to GitHub (done!)
2. Go to render.com
3. New Web Service → Connect repo
4. Build: `npm install`, Start: `npm start`
5. Add environment variables

### Extension Publishing

**Microsoft Edge Add-ons (FREE):**
- https://partner.microsoft.com/dashboard/microsoftedge
- No registration fee

**Firefox Add-ons (FREE):**
- https://addons.mozilla.org/developers/

**Chrome Web Store ($5 one-time):**
- https://chrome.google.com/webstore/devconsole

## 📋 Supported Languages

- 🇬🇧 English
- 🇮🇳 Hindi (हिंदी)
- 🇮🇳 Marathi (मराठी)
- 🇮🇳 Bengali (বাংলা)
- 🇮🇳 Tamil (தமிழ்)
- 🇮🇳 Telugu (తెలుగు)
- 🇮🇳 Gujarati (ગુજરાતી)
- 🇮🇳 Kannada (ಕನ್ನಡ)
- 🇮🇳 Malayalam (മലയാളം)
- 🇮🇳 Punjabi (ਪੰਜਾਬੀ)
- 🇪🇸 Spanish
- 🇫🇷 French
- 🇩🇪 German
- 🇨🇳 Chinese
- 🇯🇵 Japanese
- 🇰🇷 Korean
- 🇸🇦 Arabic
- 🇧🇷 Portuguese
- 🇷🇺 Russian

## 🔧 Configuration

Update `backend/server.js` BACKEND_URL after deployment:
```javascript
const BACKEND_URL = "https://your-app.vercel.app/guidance";
```

## 📝 API Endpoint

**POST** `/guidance`

Request:
```json
{
  "page_domain": "example.com",
  "user_language": "hi-IN",
  "field_context": {
    "label_text": "Email Address",
    "type": "email",
    "placeholder": "your@email.com"
  }
}
```

Response:
```json
{
  "explanation": "कृपया अपना ईमेल पता दर्ज करें...",
  "examples": ["example@gmail.com"],
  "format_hint": "username@domain.com",
  "caution": "सुनिश्चित करें कि ईमेल सही है..."
}
```

## 🛠️ Tech Stack

- **Backend:** Node.js, Express, Azure OpenAI
- **Extension:** Manifest V3, Chrome Extensions API
- **Deployment:** Vercel/Render
- **AI:** Azure OpenAI (GPT-4o mini)

## 📄 License

MIT License - feel free to use and modify!

## 👤 Author

Anmol Sharma
- GitHub: [@AnmolSharma1711](https://github.com/AnmolSharma1711)

## 🤝 Contributing

Contributions welcome! Feel free to open issues or submit PRs.

---

Made with ❤️ using Azure AI
