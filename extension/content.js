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
    // Check if checkbox is in the document
    if (!document.body.contains(el)) return false;
    
    // Check if it's disabled
    if (el.disabled) return false;
    
    // Look for associated label or nearby text
    let hasVisibleLabel = false;
    
    // Method 1: Check for <label> with matching 'for' attribute
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label && label.offsetParent !== null) {
        hasVisibleLabel = true;
      }
    }
    
    // Method 2: Check if wrapped in a label
    if (!hasVisibleLabel) {
      const parentLabel = el.closest('label');
      if (parentLabel && parentLabel.offsetParent !== null) {
        hasVisibleLabel = true;
      }
    }
    
    // Method 3: Look up the DOM tree for visible parent with text
    if (!hasVisibleLabel && el.parentElement) {
      let current = el.parentElement;
      let depth = 0;
      const maxDepth = 5;
      
      while (current && depth < maxDepth) {
        const hasText = current.textContent.trim().length > 10;
        const isVisible = current.offsetParent !== null;
        
        if (isVisible && hasText) {
          hasVisibleLabel = true;
          break;
        }
        
        current = current.parentElement;
        depth++;
      }
    }
    
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
  // Parse if guidance is a string
  if (typeof guidance === 'string') {
    try {
      guidance = JSON.parse(guidance);
    } catch (e) {
      // If can't parse JSON, display as plain text
      const tip = document.createElement("div");
      tip.className = "form-guidance-tooltip";
      tip.innerHTML = `<div class="fg-expl">${guidance}</div>`;
      return tip;
    }
  }
  
  // Handle case where guidance is still a string after parsing (double-encoded JSON)
  if (typeof guidance === 'string') {
    try {
      guidance = JSON.parse(guidance);
    } catch (e) {
      // Still can't parse, use as-is
    }
  }
  
  const tip = document.createElement("div");
  tip.className = "form-guidance-tooltip";
  
  // If guidance is still not an object, display as plain text
  if (typeof guidance !== 'object' || !guidance) {
    tip.innerHTML = `<div class="fg-expl">${String(guidance)}</div>`;
    return tip;
  }
  
  tip.innerHTML = `
    <div class="fg-expl">${guidance.explanation || "Helpful info for this field."}</div>
    ${guidance.format_hint ? `<div class="fg-hint"><b>Format:</b> ${guidance.format_hint}</div>` : ""}
    ${guidance.examples?.length ? `<div class="fg-examples"><b>Examples:</b> ${guidance.examples.join(", ")}</div>` : ""}
    ${guidance.caution ? `<div class="fg-caution"><b>Note:</b> ${guidance.caution}</div>` : ""}
  `;
  return tip;
}

function attachHelp(el, guidance) {
  // For radio buttons, skip the guidanceAttached check since we handle groups specially
  if (el.type !== 'radio' && el.dataset.guidanceAttached === 'icon') return;
  
  console.log("🟢 Attaching icon to:", el.tagName, el.type, el.name, el.id);

  // For checkboxes/radios, find visible parent to attach icon to
  let targetElement = el;
  if (el.type === 'checkbox' || el.type === 'radio') {
    // For radio buttons, find the question container
    if (el.type === 'radio') {
      // Strategy 1: Look for fieldset with legend
      const fieldset = el.closest('fieldset');
      if (fieldset) {
        const legend = fieldset.querySelector('legend');
        if (legend && legend.offsetParent !== null) {
          targetElement = legend;
          console.log(`📍 Using <legend> for radio group question`);
        } else if (fieldset.offsetParent !== null) {
          targetElement = fieldset;
          console.log(`📍 Using <fieldset> for radio group question`);
        }
      }
      
      // Strategy 2: Find the question text element (Google Forms pattern)
      if (targetElement === el) {
        let current = el.parentElement;
        
        // Look for parent container that has all radios in this group
        while (current && current !== document.body) {
          const radiosInContainer = current.querySelectorAll(`input[type="radio"][name="${el.name}"]`);
          const allRadios = document.querySelectorAll(`input[type="radio"][name="${el.name}"]`);
          
          // This container has all the radios for this group
          if (radiosInContainer.length === allRadios.length && radiosInContainer.length > 1) {
            // Look for elements that appear BEFORE the radio buttons (question text)
            const allElements = Array.from(current.querySelectorAll('*'));
            const firstRadio = current.querySelector('input[type="radio"]');
            
            for (const child of allElements) {
              // Check if this element is before the first radio button in DOM
              if (firstRadio && child.compareDocumentPosition(firstRadio) & Node.DOCUMENT_POSITION_FOLLOWING) {
                const text = child.textContent.trim();
                const hasRadio = child.querySelector('input[type="radio"]');
                
                // Element with substantial text, no radio inside, and is visible
                if (!hasRadio && text.length > 15 && child.offsetParent !== null) {
                  // Check if it looks like a question (contains ?, or is a span/div with text)
                  const tagName = child.tagName.toLowerCase();
                  if (tagName === 'span' || tagName === 'div' || text.includes('?') || text.includes('*')) {
                    targetElement = child;
                    console.log(`📍 Found question text for radio group:`, text.substring(0, 50));
                    break;
                  }
                }
              }
            }
            
            break;
          }
          
          current = current.parentElement;
        }
      }
    } else {
      // For checkboxes, find the visible parent element (label or container)
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
  }

  // Position icon inline with better spacing
  const icon = document.createElement("img");
  icon.className = "form-guidance-icon";
  icon.src = chrome.runtime.getURL("icons/icon16.png");
  icon.alt = "FormSaathi Help";
  icon.style.width = "16px";
  icon.style.height = "16px";
  icon.style.minWidth = "16px";
  icon.style.minHeight = "16px";
  icon.style.maxWidth = "16px";
  icon.style.maxHeight = "16px";
  icon.style.marginLeft = "6px";
  icon.style.marginRight = "4px";
  icon.style.verticalAlign = "middle";
  icon.style.cursor = "pointer";
  icon.style.display = "inline-block";
  icon.style.position = "relative";
  icon.style.zIndex = "1000";
  icon.style.objectFit = "contain";
  
  // Insert icon 
  if (targetElement === el) {
    // Normal field - insert after element
    if (el.nextSibling) {
      el.parentNode.insertBefore(icon, el.nextSibling);
    } else {
      el.parentNode.appendChild(icon);
    }
  } else {
    // Checkbox/radio - insert icon AFTER the question text element
    if (targetElement.nextSibling) {
      targetElement.parentNode.insertBefore(icon, targetElement.nextSibling);
    } else {
      targetElement.parentNode.appendChild(icon);
    }
  }
  
  // Mark that icon was added
  el.dataset.guidanceAttached = 'icon';
  
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
    tip.style.opacity = "0";
    tip.style.visibility = "visible";
    const tipRect = tip.getBoundingClientRect();
    tip.style.opacity = "1";
    
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
  
  // Ensure icon is interactive
  icon.style.pointerEvents = "auto";
  
  icon.addEventListener("mouseenter", showTip);
  icon.addEventListener("mouseleave", hideTip);
  tip.addEventListener("mouseenter", () => {
    clearTimeout(hideTimeout);
    tip.style.display = "block";
  });
  tip.addEventListener("mouseleave", hideTip);
  
  icon.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (tip.style.display === "block") {
      tip.style.display = "none";
    } else {
      showTip();
    }
  });
}

// Track processed radio groups separately
const processedRadioGroups = new Set();

async function explainField(el) {
  // Skip radio buttons - they're handled separately by processRadioGroups()
  if (el.type === "radio") {
    return;
  }
  
  // Skip if already processed
  if (el.dataset.guidanceAttached) {
    return;
  }
  
  // Skip password fields and sensitive fields early
  if (el.type === "password" || 
      el.type === "submit" || 
      el.type === "button" ||
      el.name?.toLowerCase().includes("password") ||
      el.id?.toLowerCase().includes("password")) {
    el.dataset.guidanceAttached = "1";
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
    
    console.log("📦 Raw backend response:", guidance);
    
    if (guidance) {
      // Guidance is already the parsed object from backend
      // Validate it has expected structure
      if (typeof guidance === 'object' && guidance.explanation) {
        console.log("✅ Valid guidance received:", guidance.explanation.substring(0, 50) + "...");
        // Cache the response
        guidanceCache.set(cacheKey, guidance);
        attachHelp(el, guidance);
      } else {
        console.log("⚠️ Invalid guidance format:", typeof guidance, guidance);
        // Try to salvage it
        const fallbackGuidance = {
          explanation: guidance.explanation || String(guidance) || "Provide the requested information.",
          examples: guidance.examples || [],
          format_hint: guidance.format_hint || "",
          caution: guidance.caution || ""
        };
        guidanceCache.set(cacheKey, fallbackGuidance);
        attachHelp(el, fallbackGuidance);
      }
    } else {
      console.log("❌ No response from backend");
    }
  } catch (error) {
    // Extension context invalidated or other error - silently skip
    if (error.message?.includes('Extension context invalidated')) {
      console.log("FormSaathi: Extension reloaded, please refresh page");
    } else {
      console.error("FormSaathi error:", error);
    }
  } finally {
    processingFields.delete(cacheKey);
  }
}

// Handle radio groups separately - one icon per question
async function processRadioGroups() {
  // Google Forms: look for containers with role="radiogroup" or specific class
  const radioGroups = document.querySelectorAll('[role="radiogroup"], .freebirdFormviewerComponentsQuestionRadioRoot');
  
  for (const radioGroup of radioGroups) {
    const radios = radioGroup.querySelectorAll('input[type="radio"]');
    if (radios.length === 0) continue;
    
    const groupName = radios[0].name;
    if (!groupName || processedRadioGroups.has(groupName)) continue;
    
    processedRadioGroups.add(groupName);
    
    // Find question text - look in parent structure
    let questionElement = null;
    let questionText = '';
    
    // Strategy 1: Check container for heading element  
    const container = radioGroup.closest('div[role="listitem"], .freebirdFormviewerComponentsQuestionBaseRoot, [data-params]');
    if (container) {
      const heading = container.querySelector('[role="heading"], .freebirdFormviewerComponentsQuestionBaseTitle, .freebirdFormviewerComponentsQuestionBaseHeader');
      if (heading) {
        questionElement = heading;
        questionText = heading.textContent?.trim() || '';
        console.log("📍 Found radio question (heading):", questionText.substring(0, 50));
      }
    }
    
    // Strategy 2: Look for previous sibling with question text
    if (!questionElement) {
      let sibling = radioGroup.previousElementSibling;
      while (sibling) {
        const text = sibling.textContent?.trim() || '';
        if (text.length > 5 && !sibling.querySelector('input[type="radio"]')) {
          questionElement = sibling;
          questionText = text;
          console.log("📍 Found radio question (sibling):", questionText.substring(0, 50));
          break;
        }
        sibling = sibling.previousElementSibling;
      }
    }
    
    
    if (!questionElement) {
      console.log("⚠️ Could not find question element for radio group:", groupName);
      continue;
    }
    
    console.log("📍 Processing radio guidance for:", questionText.substring(0, 40));
    
    // Get guidance for this radio group
    const user_language = await getUserLanguage();
    const cacheKey = `radio_${user_language}_${groupName}_${questionText.substring(0, 50)}`;
    
    if (guidanceCache.has(cacheKey)) {
      attachRadioHelp(questionElement, guidanceCache.get(cacheKey));
      continue;
    }
    
    const payload = {
      page_domain: DOMAIN,
      user_language,
      field_context: {
        label_text: questionText,
        type: "radio-group",
        name: groupName,
        options: Array.from(radios).map(r => {
          const label = r.closest('label') || r.parentElement;
          return label?.textContent?.trim() || r.value;
        }).filter(Boolean).join(", ")
      }
    };
    
    try {
      const guidance = await chrome.runtime.sendMessage({ type: "GET_GUIDANCE", payload });
      if (guidance && guidance.explanation) {
        guidanceCache.set(cacheKey, guidance);
        attachRadioHelp(questionElement, guidance);
      }
    } catch (e) {
      console.error("Error getting radio guidance:", e);
    }
  }
}

// Attach help icon to radio group question
function attachRadioHelp(questionElement, guidance) {
  if (questionElement.dataset.radioHelpAttached) return;
  questionElement.dataset.radioHelpAttached = "1";
  
  const icon = document.createElement("img");
  icon.className = "form-guidance-icon";
  icon.src = chrome.runtime.getURL("icons/icon16.png");
  icon.alt = "FormSaathi Help";
  icon.style.width = "16px";
  icon.style.height = "16px";
  icon.style.minWidth = "16px";
  icon.style.minHeight = "16px";
  icon.style.maxWidth = "16px";
  icon.style.maxHeight = "16px";
  icon.style.marginLeft = "6px";
  icon.style.verticalAlign = "middle";
  icon.style.cursor = "pointer";
  icon.style.display = "inline";
  icon.style.pointerEvents = "auto";
  
  // Insert after the question text
  questionElement.appendChild(icon);
  
  const tip = createTooltip(guidance);
  document.body.appendChild(tip);
  
  let hideTimeout;
  
  const showTip = () => {
    clearTimeout(hideTimeout);
    const iconRect = icon.getBoundingClientRect();
    tip.style.display = "block";
    tip.style.top = `${iconRect.bottom + window.scrollY + 5}px`;
    tip.style.left = `${iconRect.left + window.scrollX}px`;
  };
  
  const hideTip = () => {
    hideTimeout = setTimeout(() => tip.style.display = "none", 200);
  };
  
  icon.addEventListener("mouseenter", showTip);
  icon.addEventListener("mouseleave", hideTip);
  tip.addEventListener("mouseenter", () => clearTimeout(hideTimeout));
  tip.addEventListener("mouseleave", hideTip);
  icon.addEventListener("click", (e) => {
    e.stopPropagation();
    tip.style.display = tip.style.display === "block" ? "none" : "block";
    if (tip.style.display === "block") showTip();
  });
}

function init() {
  isExtensionEnabled().then(enabled => {
    if (!enabled) return;
    
    // Process existing fields (native + Angular Material) - excludes radio buttons
    const selectors = "input:not([type='radio']), select, textarea, mat-select, [role='combobox'], [role='listbox']";
    document.querySelectorAll(selectors).forEach(el => {
      if (!el.dataset.guidanceAttached && isTrulyVisible(el)) {
        explainField(el);
      }
    });
    
    // Process radio groups separately
    processRadioGroups();
    
    // Watch for new fields (debounced for better dynamic content detection)
    let timeout;
    const mo = new MutationObserver(() => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const selectors = "input:not([type='radio']), select, textarea, mat-select, [role='combobox'], [role='listbox']";
        document.querySelectorAll(selectors).forEach(el => {
          if (!el.dataset.guidanceAttached && isTrulyVisible(el)) {
            explainField(el);
          }
        });
        // Also check for new radio groups
        processRadioGroups();
      }, 300);
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
