const DOMAIN = location.hostname;
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

  const wrapper = document.createElement("span");
  wrapper.style.position = "relative";
  el.parentNode.insertBefore(wrapper, el);
  wrapper.appendChild(el);

  const icon = document.createElement("span");
  icon.className = "form-guidance-icon";
  icon.textContent = "ⓘ";
  wrapper.appendChild(icon);

  const tip = createTooltip(guidance);
  wrapper.appendChild(tip);

  icon.addEventListener("mouseenter", () => tip.style.display = "block");
  icon.addEventListener("mouseleave", () => tip.style.display = "none");
  icon.addEventListener("click", () => {
    tip.style.display = tip.style.display === "block" ? "none" : "block";
  });
}

async function explainField(el) {
  const user_language = await getUserLanguage();
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
  const guidance = await chrome.runtime.sendMessage({ type: "GET_GUIDANCE", payload });
  if (guidance && guidance.explanation) attachHelp(el, guidance);
}

function init() {
  isExtensionEnabled().then(enabled => {
    if (!enabled) return; // Don't run if extension is disabled
    
    document.querySelectorAll("input, select, textarea").forEach(el => explainField(el));
    const mo = new MutationObserver(() => {
      document.querySelectorAll("input, select, textarea").forEach(el => {
        if (!el.dataset.guidanceAttached) explainField(el);
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  });
}

init();