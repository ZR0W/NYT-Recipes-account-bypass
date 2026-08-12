// Entry point. Runs on every page matched by manifest.json's content_scripts
// (an explicit per-site allowlist — currently NYT Cooking and babi.sh —
// nothing runs anywhere else, no host_permissions needed for that
// declarative injection). The parsing/rendering logic itself is
// schema.org-generic, not tied to any one site; adding a new site is a
// manifest.json matches entry, not a code change.
//
// Reads only the schema.org Recipe JSON-LD already present in this page's
// own HTML response. No network requests, no authentication, nothing sent
// anywhere — the extension is inert if no Recipe JSON-LD is found.
(() => {
  "use strict";

  if (window.__rsLoaded) return;
  window.__rsLoaded = true;

  function log(...args) {
    globalThis.RS_LOG?.log(...args);
  }

  function run() {
    const raw = globalThis.RS_PARSER.getRecipeJsonLd(document);
    if (!raw) {
      log("no Recipe JSON-LD found on this page — staying inert");
      return;
    }
    const recipe = globalThis.RS_PARSER.normalizeRecipe(raw);
    globalThis.RS_RENDER.mount(recipe);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();
