const DOMAIN = location.hostname;
const guidanceCache = new Map(); // Cache API responses
const processingFields = new Set(); // Track fields being processed

async function getUserLanguage() {
  try {
    return new Promise(resolve => {
      chrome.storage.sync.get(["user_language"], (data) => {
        if (chrome.runtime.lastError) {
          console.log("FormSaathi: Extension context issue, using default language");
          resolve(navigator.language || "en-US");
          return;
        }
        resolve(data.user_language || navigator.language || "en-US");
      });
    });
  } catch (e) {
    console.log("FormSaathi: Extension context invalidated, using default language");
    return navigator.language || "en-US";
  }
}

async function isExtensionEnabled() {
  return new Promise(resolve => {
    chrome.storage.sync.get(["extension_enabled"], (data) => {
      resolve(data.extension_enabled !== false); // default to true
    });
  });
}

function isTrulyVisible(el) {
  const isCheckbox = el.type === 'checkbox' || el.type === 'radio';
  
  // For checkboxes/radios, check if they have a visible label instead
  // (actual checkbox inputs are often hidden with styled replacements)
  if (isCheckbox) {
    console.log('🔍 Checking checkbox visibility:', {
      id: el.id || '(no id)',
      name: el.name || '(no name)',
      inDocument: document.body.contains(el),
      disabled: el.disabled
    });
    
    // Check if checkbox is in the document
    if (!document.body.contains(el)) {
      console.log('❌ Not in document');
      return false;
    }
    
    // Check if it's disabled
    if (el.disabled) {
      console.log('❌ Disabled');
      return false;
    }
    
    // Look for associated label or nearby text
    let hasVisibleLabel = false;
    
    // Method 1: Check for <label> with matching 'for' attribute
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      console.log('Method 1 (label[for]):', label ? 'found' : 'not found', label?.offsetParent);
      if (label && label.offsetParent !== null) {
        hasVisibleLabel = true;
      }
    }
    
    // Method 2: Check if wrapped in a label
    if (!hasVisibleLabel) {
      const parentLabel = el.closest('label');
      console.log('Method 2 (closest label):', parentLabel ? 'found' : 'not found', parentLabel?.offsetParent);
      if (parentLabel && parentLabel.offsetParent !== null) {
        hasVisibleLabel = true;
      }
    }
    
    // Method 3: Look up the DOM tree for visible parent with text
    // (checkbox and immediate parent might be hidden, but grandparent+ is visible)
    if (!hasVisibleLabel && el.parentElement) {
      let current = el.parentElement;
      let depth = 0;
      const maxDepth = 5; // Check up to 5 levels up
      
      while (current && depth < maxDepth) {
        const hasText = current.textContent.trim().length > 10; // At least 10 chars
        const isVisible = current.offsetParent !== null;
        
        console.log(`Method 3 (depth ${depth}):`, {
          tag: current.tagName,
          offsetParent: current.offsetParent,
          hasText: hasText,
          textLength: current.textContent.trim().length,
          textPreview: current.textContent.trim().substring(0, 60)
        });
        
        if (isVisible && hasText) {
          console.log(`✅ Found visible parent at depth ${depth}`);
          hasVisibleLabel = true;
          break;
        }
        
        current = current.parentElement;
        depth++;
      }
    }
    
    console.log(hasVisibleLabel ? '✅ Checkbox has visible label' : '❌ No visible label found');
    return hasVisibleLabel;
  }
  
  // For non-checkbox elements, use standard visibility checks
  if (!el.offsetParent) return false;
  
  const rect = el.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return false;
  
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  
  if (rect.width === 0 && rect.height === 0) return false;
  
  return true;
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
  // Parse if guidance is a string (shouldn't happen but just in case)
  if (typeof guidance === 'string') {
    try {
      guidance = JSON.parse(guidance);
    } catch (e) {
      console.error("FormSaathi: Failed to parse guidance", e);
      return document.createElement("div");
    }
  }
  
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
  
  console.log("🟢 Attaching icon to:", el.tagName, el.type, el.name, el.id);

  // For checkboxes/radios, find visible parent to attach icon to
  let targetElement = el;
  if (el.type === 'checkbox' || el.type === 'radio') {
    // Find the visible parent element (label or container)
    let current = el.parentElement;
    let depth = 0;
    while (current && depth < 5) {
      if (current.offsetParent !== null && current.textContent.trim().length > 10) {
        targetElement = current;
        console.log(`📍 Using visible parent at depth ${depth} for checkbox icon`);
        break;
      }
      current = current.parentElement;
      depth++;
    }
  }

  // Position icon inline with better spacing
  const icon = document.createElement("img");
  icon.className = "form-guidance-icon";
  icon.src = chrome.runtime.getURL("icons/icon16.png");
  icon.alt = "FormSaathi Help";
  icon.style.marginLeft = "6px";
  icon.style.marginRight = "4px";
  icon.style.verticalAlign = "middle";
  icon.style.cursor = "pointer";
  icon.style.display = "inline-block";
  icon.style.position = "relative";
  icon.style.zIndex = "1000";
  
  // Insert icon as next sibling (or inside for checkboxes)
  if (targetElement === el) {
    // Normal field - insert after element
    if (el.nextSibling) {
      el.parentNode.insertBefore(icon, el.nextSibling);
    } else {
      el.parentNode.appendChild(icon);
    }
  } else {
    // Checkbox/radio - append to visible parent container
    targetElement.appendChild(icon);
  }
  
  console.log("✅ Icon inserted successfully");

  const tip = createTooltip(guidance);
  document.body.appendChild(tip);

  let hideTimeout;
  
  const showTip = () => {
    clearTimeout(hideTimeout);
    
    // Force reflow to ensure icon is properly positioned
    icon.offsetHeight;
    
    // Get fresh position of icon
    const iconRect = icon.getBoundingClientRect();
    
    // Show tooltip temporarily to get its dimensions
    tip.style.display = "block";
    tip.style.visibility = "hidden"; // Hide while positioning
    const tipRect = tip.getBoundingClientRect();
    tip.style.visibility = "visible";
    
    // Try to position above the icon first
    let top = iconRect.top + window.scrollY - tipRect.height - 10;
    let left = iconRect.left + window.scrollX;
    
    // If goes off top of screen, position below instead
    if (top < window.scrollY + 10) {
      top = iconRect.bottom + window.scrollY + 10;
    }
    
    // Adjust horizontal position if goes off screen
    if (left + tipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tipRect.width - 10;
    }
    
    // Make sure it doesn't go off left edge
    if (left < 10) {
      left = 10;
    }
    
    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
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
  
  // Skip password fields and sensitive fields early
  if (el.type === "password" || 
      el.type === "submit" || 
      el.type === "button" ||
      el.name?.toLowerCase().includes("password") ||
      el.id?.toLowerCase().includes("password")) {
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
    // Extension context invalidated or other error - silently skip
    if (error.message?.includes('Extension context invalidated')) {
      console.log("FormSaathi: Extension reloaded, please refresh page");
    }
  } finally {
    processingFields.delete(cacheKey);
  }
}

function init() {
  isExtensionEnabled().then(enabled => {
    if (!enabled) return;
    
    // Process existing fields (native + Angular Material)
    const selectors = "input, select, textarea, mat-select, [role='combobox'], [role='listbox']";
    document.querySelectorAll(selectors).forEach(el => {
      // Debug logging for checkboxes
      if (el.type === 'checkbox') {
        console.log("🔍 Found checkbox:", el.name, el.id, "already attached?", el.dataset.guidanceAttached, "visible?", isTrulyVisible(el));
      }
      
      if (!el.dataset.guidanceAttached && isTrulyVisible(el)) {
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
          // Debug logging for checkboxes
          if (el.type === 'checkbox') {
            console.log("🔍 [MutationObserver] Found checkbox:", el.name, el.id, "already attached?", el.dataset.guidanceAttached, "visible?", isTrulyVisible(el));
          }
          
          if (!el.dataset.guidanceAttached && isTrulyVisible(el)) {
            explainField(el);
          }
        });
      }, 300); // Shorter delay for faster response to tab/page changes
    });
    
    mo.observe(document.body, { childList: true, subtree: true, attributes: false });
    
    // Rescan on meaningful events (buttons, tabs, links) - not all clicks
    document.addEventListener('click', (e) => {
      const target = e.target;
      // Only rescan if clicking buttons, tabs, or navigation elements
      if (target.matches('button, a, [role="tab"], [role="button"], mat-tab')) {
        setTimeout(() => {
          const selectors = "input, select, textarea, mat-select, [role='combobox'], [role='listbox']";
          const allFields = document.querySelectorAll(selectors);
          
          allFields.forEach(el => {
            if (!el.dataset.guidanceAttached && isTrulyVisible(el)) {
              explainField(el);
            }
          });
        }, 600);
      }
    }, true);
  });
}

init();
