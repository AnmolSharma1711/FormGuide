document.addEventListener("DOMContentLoaded", async () => {
  // Load saved settings
  chrome.storage.sync.get(["user_language", "extension_enabled"], (data) => {
    const lang = data.user_language || navigator.language || "en-US";
    const enabled = data.extension_enabled !== false; // default to true
    document.getElementById("lang").value = lang;
    document.getElementById("enabled").checked = enabled;
  });
});

// Save settings
document.getElementById("save").addEventListener("click", () => {
  const lang = document.getElementById("lang").value;
  const enabled = document.getElementById("enabled").checked;
  
  chrome.storage.sync.set({ 
    user_language: lang,
    extension_enabled: enabled 
  }, () => {
    showStatus("✓ Settings saved successfully!", "success");
  });
});

// Show status message
function showStatus(message, type) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = "block";
  
  setTimeout(() => {
    status.style.display = "none";
  }, 3000);
}

// About link
document.getElementById("about").addEventListener("click", (e) => {
  e.preventDefault();
  const info = `FormSaathi v1.0.0\n\nYour AI companion for form filling - provides intelligent, multilingual guidance for every field.\n\nFeatures:\n• Real-time form field assistance\n• Support for 19+ languages\n• Powered by Azure OpenAI\n• Privacy-focused design`;
  alert(info);
});

// Keyboard shortcut (Enter to save)
document.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    document.getElementById("save").click();
  }
});