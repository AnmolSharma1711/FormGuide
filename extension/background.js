// Production backend URL
const BACKEND_URL = "https://form-guide.vercel.app/guidance";
// For local testing, use: "http://localhost:3000/guidance"

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_GUIDANCE") {
    fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload)
    })
      .then(res => res.json())
      .then(data => sendResponse(data))
      .catch(err => {
        console.error("FormSaathi: API Error:", err);
        sendResponse({
          explanation: "Provide the requested information in this field.",
          examples: [],
          format_hint: "",
          caution: ""
        });
      });
    return true; // keep channel open for async
  }
});