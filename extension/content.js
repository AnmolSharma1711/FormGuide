const DOMAIN = location.hostname;
const guidanceCache = new Map(); // Cache API responses
const processingFields = new Set(); // Track fields being processed

async function getUserLanguage() {
  return new Promise(resolve => {
    chrome.storage.sync.get(["user_language"], (data) => {
      resolve(data.user_language || navigator.language || "en-US");
    });
  });
}

async function isExtensionEnabled() {
  return new Promise(resolve => {
    chrome.storage.sync.get(["extension_enabled"], (data) => {
      resolve(data.extension_enabled !== false); // default to true
    });
  });
}

function getFieldCacheKey(el) {
  // Create unique key for caching based on field properties
  const tag = el.tagName.toLowerCase();
  const type = el.type || el.getAttribute('role') || tag;
  return `${type}_${el.name || ''}_${el.id || ''}_${getLabelText(el)}`;
}

function getLabelText(el) {
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) return label.innerText.trim();
  }
  const aria = el.getAttribute("aria-label");
  if (aria) return aria.trim();
  const parentLabel = el.closest("label");
  if (parentLabel) return parentLabel.innerText.trim();
  return el.placeholder?.trim() || el.name || el.id || "";
}

function getSurroundingText(el) {
  const container = el.closest("div, fieldset, section, form") || el.parentElement;
  if (!container) return "";
  const text = container.innerText || "";
  return text.slice(0, 500);
}

function createTooltip(guidance) {
  const tip = document.createElement("div");
  tip.className = "form-guidance-tooltip";
  tip.innerHTML = `
    <div class="fg-expl">${guidance.explanation || "Helpful info for this field."}</div>
    ${guidance.format_hint ? `<div class="fg-hint"><b>Format:</b> ${guidance.format_hint}</div>` : ""}
    ${guidance.examples?.length ? `<div class="fg-examples"><b>Examples:</b> ${guidance.examples.join(", ")}</div>` : ""}
    ${guidance.caution ? `<div class="fg-caution"><b>Note:</b> ${guidance.caution}</div>` : ""}
  `;
  return tip;
}

function attachHelp(el, guidance) {
  if (el.dataset.guidanceAttached) return;
  el.dataset.guidanceAttached = "1";
  
  console.log("🟢 Attaching icon to:", el.tagName, el.name, el.id);

  // Position icon inline to the right of the field
  const icon = document.createElement("img");
  icon.className = "form-guidance-icon";
  icon.src = chrome.runtime.getURL("icons/icon16.png");
  icon.alt = "FormSaathi Help";
  icon.style.marginLeft = "8px";
  icon.style.verticalAlign = "middle";
  icon.style.cursor = "pointer";
  
  // Insert icon right after the input field
  if (el.nextSibling) {
    el.parentNode.insertBefore(icon, el.nextSibling);
  } else {
    el.parentNode.appendChild(icon);
  }
  
  console.log("✅ Icon inserted successfully");

  const tip = createTooltip(guidance);
  document.body.appendChild(tip);

  let hideTimeout;
  
  const showTip = () => {
    clearTimeout(hideTimeout);
    // Position tooltip relative to icon (prefer above to avoid conflicts)
    const iconRect = icon.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    
    // Try to position above first
    let top = iconRect.top + window.scrollY - tipRect.height - 10;
    let left = iconRect.left + window.scrollX;
    
    // If goes off top, position below instead
    if (top < window.scrollY) {
      top = iconRect.bottom + window.scrollY + 10;
    }
    
    // Check if tooltip goes off screen right edge
    if (left + tipRect.width > window.innerWidth) {
      left = window.innerWidth - tipRect.width - 10;
    }
    
    // Make sure it doesn't go off left edge
    if (left < 10) {
      left = 10;
    }
    
    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
    tip.style.display = "block";
  };
  
  const hideTip = () => {
    hideTimeout = setTimeout(() => {
      tip.style.display = "none";
    }, 200);
  };
  
  icon.addEventListener("mouseenter", showTip);
  icon.addEventListener("mouseleave", hideTip);
  tip.addEventListener("mouseenter", showTip);
  tip.addEventListener("mouseleave", hideTip);
  
  icon.addEventListener("click", (e) => {
    e.stopPropagation();
    if (tip.style.display === "block") {
      tip.style.display = "none";
    } else {
      tip.style.display = "block";
    }
  });
}

async function explainField(el) {
  // Skip if already processed or being processed
  if (el.dataset.guidanceAttached) {
    return;
  }
  
  console.log("🟢 Processing:", el.tagName, el.type, el.name, el.id, "visible:", el.offsetParent !== null);
  
  // Skip password fields and sensitive fields early
  if (el.type === "password" || 
      el.type === "submit" || 
      el.type === "button" ||
      el.name?.toLowerCase().includes("password") ||
      el.name?.toLowerCase().includes("remember") ||
      el.id?.toLowerCase().includes("password") ||
      el.id?.toLowerCase().includes("remember")) {
    el.dataset.guidanceAttached = "1"; // Mark but don't process
    return;
  }
  
  const user_language = await getUserLanguage();
  const cacheKey = `${user_language}_${getFieldCacheKey(el)}`;
  
  // Prevent duplicate processing
  if (processingFields.has(cacheKey)) {
    return;
  }
  processingFields.add(cacheKey);
  
  // Check cache first
  if (guidanceCache.has(cacheKey)) {
    console.log("🟢 FormSaathi: Using cached guidance");
    attachHelp(el, guidanceCache.get(cacheKey));
    processingFields.delete(cacheKey);
    return;
  }
  
  console.log("🟢 FormSaathi: Making API request");
  
  const payload = {
    page_domain: DOMAIN,
    user_language,
    field_context: {
      label_text: getLabelText(el),
      placeholder: el.placeholder || "",
      name: el.name || "",
      id: el.id || "",
      type: el.type || el.tagName.toLowerCase(),
      surrounding_text: getSurroundingText(el)
    }
  };
  
  try {
    const guidance = await chrome.runtime.sendMessage({ type: "GET_GUIDANCE", payload });
    
    if (guidance && guidance.explanation) {
      // Cache the response
      guidanceCache.set(cacheKey, guidance);
      attachHelp(el, guidance);
    }
  } catch (error) {
    console.error("FormSaathi: Error", error);
  } finally {
    processingFields.delete(cacheKey);
  }
}

function init() {
  console.log("🟢 FormSaathi: Starting...");
  
  isExtensionEnabled().then(enabled => {
    if (!enabled) return; // Don't run if extension is disabled
    
    console.log("🟢 FormSaathi: Scanning for fields...");
    
    // Process existing fields (native + Angular Material)
    const selectors = "input, select, textarea, mat-select, [role='combobox'], [role='listbox']";
    document.querySelectorAll(selectors).forEach(el => {
      if (!el.dataset.guidanceAttached) {
        explainField(el);
      }
    });
    
    // Watch for new fields (debounced for better dynamic content detection)
    let timeout;
    const mo = new MutationObserver(() => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const selectors = "input, select, textarea, mat-select, [role='combobox'], [role='listbox']";
        document.querySelectorAll(selectors).forEach(el => {
          if (!el.dataset.guidanceAttached) {
            explainField(el);
          }
        });
      }, 300); // Shorter delay for faster response to tab/page changes
    });
    
    mo.observe(document.body, { childList: true, subtree: true, attributes: false });
    
    // Also check on visibility changes (for tabs/modals)
    document.addEventListener('click', () => {
      setTimeout(() => {
        consolselectors = "input, select, textarea, mat-select, [role='combobox'], [role='listbox']";
        const allFields = document.querySelectorAll(selectors);
        console.log(`🔍 Total fields found: ${allFields.length}`);
        
        allFields.forEach(el => {
          if (!el.dataset.guidanceAttached) {
            const isVisible = el.offsetParent !== null;
            console.log("🆕 Found unprocessed field:", el.tagName, el.type || el.rol
            console.log("🆕 Found unprocessed field:", el.tagName, el.type || '', el.name, el.id, "visible:", isVisible);
            if (isVisible) {
              explainField(el);
            }
          }
        });
      }, 800); // Longer delay for slow-loading content
    }, true);
  });
}

init();
