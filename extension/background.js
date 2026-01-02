// Production backend URL
const BACKEND_URL = "https://form-guide.vercel.app/guidance";
// For local testing, use: "http://localhost:3000/guidance"

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_GUIDANCE") {
    console.log("FormSaathi Backend: Sending request to:", BACKEND_URL);
    console.log("FormSaathi Backend: Language:", message.payload.user_language);
    
    fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload)
    })
      .then(res => {
        console.log("FormSaathi Backend: Response status:", res.status);
        return res.json();
      })
      .then(data => {
        console.log("FormSaathi Backend: Response data:", data);
        sendResponse(data);
      })
      .catch(err => {
        console.error("FormSaathi Backend: Error:", err);
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