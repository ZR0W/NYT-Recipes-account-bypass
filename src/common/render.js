// Builds and mounts the recipe card. DOM is built exclusively with
// createElement/textContent — never innerHTML — because the source JSON-LD
// has demonstrated raw embedded HTML in at least one field (review bodies
// contain literal <br/>/<a> tags), so no string pulled from that payload is
// trusted as markup, even in fields this project doesn't currently render.
//
// Exposed as a global (RS_RENDER); loaded after parser.js/duration.js, before
// content.js, per manifest.json.
(() => {
  "use strict";

  const ext = globalThis.browser ?? globalThis.chrome;

  const DEBUG = (() => {
    try {
      return sessionStorage.getItem("rs_debug") === "1";
    } catch {
      return false;
    }
  })();
  const log = (...args) => DEBUG && console.log("[recipe-summarizer]", ...args);
  globalThis.RS_LOG = { log };

  const STORAGE_KEY = "rsCardExpanded";

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function starString(ratingValue) {
    if (typeof ratingValue !== "number") return null;
    const filled = Math.round(ratingValue);
    return "★".repeat(Math.max(0, Math.min(5, filled))) + "☆".repeat(Math.max(0, 5 - filled));
  }

  function buildMeta(recipe) {
    const meta = el("div", "rs-meta");

    if (recipe.ratingValue != null) {
      const rating = el("span", "rs-pill rs-rating");
      rating.append(
        el("span", "rs-stars", starString(recipe.ratingValue)),
        el(
          "span",
          "rs-rating-count",
          recipe.ratingCount != null ? ` (${recipe.ratingCount.toLocaleString()})` : ""
        )
      );
      meta.append(rating);
    }
    if (recipe.timeText) meta.append(el("span", "rs-pill", `⏱ ${recipe.timeText}`));
    if (recipe.yieldText) meta.append(el("span", "rs-pill", `🍽 ${recipe.yieldText}`));
    if (recipe.category) meta.append(el("span", "rs-pill", recipe.category));
    if (recipe.cuisine) meta.append(el("span", "rs-pill", recipe.cuisine));

    return meta;
  }

  // Ingredients render as a checklist (checkbox + label per item) so the
  // card is usable hands-on while actually cooking. Checked state is UI-only
  // (not persisted) — ticking things off while cooking is a one-session
  // activity, unlike the card's own collapsed/expanded state.
  //
  // The visible box is a plain <span> we style entirely ourselves, not the
  // native checkbox appearance — host pages (NYT Cooking included) commonly
  // reset native form-control styling globally, which made the real
  // <input type="checkbox"> render blank/invisible. The real input stays in
  // the DOM (visually hidden, not display:none) purely for accessibility —
  // it's what's actually keyboard-focusable and gets the "change" event.
  function buildIngredients(recipe) {
    const section = el("div", "rs-section");
    section.append(el("h3", null, "Ingredients"));
    const list = el("ul", "rs-ingredients");
    recipe.ingredients.forEach((ingredient, i) => {
      const item = el("li", "rs-ingredient");
      const checkboxId = `rs-ingredient-${i}`;

      const wrap = el("span", "rs-checkbox-wrap");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "rs-ingredient-check";
      checkbox.id = checkboxId;
      checkbox.addEventListener("change", () => {
        item.classList.toggle("rs-checked", checkbox.checked);
      });
      const box = el("span", "rs-checkbox-box");
      wrap.append(checkbox, box);

      const label = document.createElement("label");
      label.className = "rs-ingredient-label";
      label.setAttribute("for", checkboxId);
      label.textContent = ingredient;

      item.append(wrap, label);
      list.append(item);
    });
    section.append(list);
    return section;
  }

  // Step numbers must stay continuous across HowToSection groups (e.g. a
  // sub-recipe's "For the stock" / "For the soup" split) rather than each
  // section's <ol> restarting at 1 — the `start` attribute carries the
  // running count forward instead of relying on per-list default numbering.
  function buildSteps(recipe) {
    const section = el("div", "rs-section");
    section.append(el("h3", null, "Steps"));
    let stepNumber = 1;
    for (const group of recipe.steps) {
      if (group.section) section.append(el("h4", "rs-step-section", group.section));
      const list = el("ol", "rs-steps");
      list.start = stepNumber;
      for (const step of group.items) {
        list.append(el("li", null, step));
        stepNumber += 1;
      }
      section.append(list);
    }
    return section;
  }

  function toMarkdown(recipe) {
    const lines = [`# ${recipe.title}`, ""];
    const metaBits = [];
    if (recipe.ratingValue != null) {
      metaBits.push(
        `${recipe.ratingValue}/5${recipe.ratingCount != null ? ` (${recipe.ratingCount} ratings)` : ""}`
      );
    }
    if (recipe.timeText) metaBits.push(recipe.timeText);
    if (recipe.yieldText) metaBits.push(recipe.yieldText);
    if (metaBits.length) lines.push(metaBits.join(" · "), "");

    lines.push("## Ingredients");
    for (const ingredient of recipe.ingredients) lines.push(`- ${ingredient}`);
    lines.push("");

    lines.push("## Steps");
    let stepNumber = 1;
    for (const group of recipe.steps) {
      if (group.section) lines.push(`### ${group.section}`);
      for (const step of group.items) {
        lines.push(`${stepNumber}. ${step}`);
        stepNumber += 1;
      }
    }

    return lines.join("\n");
  }

  function flashButton(btn, glyph) {
    const original = btn.textContent;
    btn.textContent = glyph;
    setTimeout(() => {
      btn.textContent = original;
    }, 1200);
  }

  async function copyMarkdown(recipe, btn) {
    try {
      await navigator.clipboard.writeText(toMarkdown(recipe));
      flashButton(btn, "✓ Copied");
    } catch (err) {
      log("clipboard write failed", err);
      flashButton(btn, "✗ Failed");
    }
  }

  async function savedExpandedState() {
    try {
      const result = await ext.storage.local.get(STORAGE_KEY);
      return result[STORAGE_KEY] !== false; // default expanded
    } catch (err) {
      log("could not read saved card state", err);
      return true;
    }
  }

  function saveExpandedState(expanded) {
    try {
      ext.storage.local.set({ [STORAGE_KEY]: expanded });
    } catch (err) {
      log("could not persist card state", err);
    }
  }

  function buildCardElement(recipe) {
    const panel = el("div", "rs-panel");

    const header = el("div", "rs-header");
    // isFree comes straight from the page's own JSON-LD (`isAccessibleForFree`,
    // a standard schema.org Recipe property) — see parser.js normalizeRecipe().
    // This is NYT's own self-published metadata, not a determination this
    // extension makes; both recipes captured during research had it set
    // explicitly (`false`) right alongside the full ingredients/steps.
    if (recipe.isFree === false) header.append(el("span", "rs-badge", "🔒 Paywalled page — public recipe data"));
    else if (recipe.isFree === true) header.append(el("span", "rs-badge", "🔓 Free"));
    header.append(el("span", "rs-title", recipe.title));
    const toggleBtn = el("button", "rs-toggle", "▲");
    toggleBtn.title = "Collapse/expand";
    header.append(toggleBtn);
    panel.append(header);

    const body = el("div", "rs-body");
    body.append(buildMeta(recipe));

    const actions = el("div", "rs-actions");
    const copyBtn = el("button", "rs-btn", "Copy as Markdown");
    copyBtn.addEventListener("click", () => copyMarkdown(recipe, copyBtn));
    const printBtn = el("button", "rs-btn", "Print");
    printBtn.addEventListener("click", () => window.print());
    actions.append(copyBtn, printBtn);
    body.append(actions);

    if (recipe.ingredients.length) body.append(buildIngredients(recipe));
    if (recipe.steps.length) body.append(buildSteps(recipe));
    panel.append(body);

    // Whole header is clickable (matches the pointer cursor on .rs-header),
    // not just the small toggle glyph.
    header.addEventListener("click", () => {
      const expanded = !panel.classList.contains("rs-collapsed");
      panel.classList.toggle("rs-collapsed", expanded);
      toggleBtn.textContent = expanded ? "▼" : "▲";
      saveExpandedState(!expanded);
    });

    savedExpandedState().then((expanded) => {
      if (!expanded) {
        panel.classList.add("rs-collapsed");
        toggleBtn.textContent = "▼";
      }
    });

    return panel;
  }

  function mount(recipe) {
    const panel = buildCardElement(recipe);
    // Appended to documentElement (not body.prepend) to match the pattern
    // proven in the sibling address-quick-display project: a fixed-position
    // overlay doesn't depend on DOM order, and appending after <body> avoids
    // sitting in front of <head> in the tree.
    document.documentElement.appendChild(panel);
    log("card mounted for:", recipe.title);
    return panel;
  }

  globalThis.RS_RENDER = { mount, buildCardElement, toMarkdown };
})();
