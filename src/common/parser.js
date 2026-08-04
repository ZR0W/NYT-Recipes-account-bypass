// Finds and normalizes the schema.org Recipe JSON-LD block NYT Cooking already
// ships in the page's own <head> for every visitor (SEO / Google rich results),
// regardless of paywall state. No network requests, no auth of any kind.
//
// Exposed as a global (RS_PARSER); loaded before render.js/content.js per manifest.json.
(() => {
  "use strict";

  function isRecipeNode(node) {
    if (!node || typeof node !== "object") return false;
    const type = node["@type"];
    if (Array.isArray(type)) return type.includes("Recipe");
    return type === "Recipe";
  }

  function findRecipeInParsed(parsed) {
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        const found = findRecipeInParsed(entry);
        if (found) return found;
      }
      return null;
    }
    if (parsed && typeof parsed === "object") {
      if (isRecipeNode(parsed)) return parsed;
      if (Array.isArray(parsed["@graph"])) return findRecipeInParsed(parsed["@graph"]);
    }
    return null;
  }

  // Reads every application/ld+json block in the document and returns the
  // first node typed as schema.org Recipe. Every capture method tested so far
  // (View Source save, manual head-copy) produced byte-identical JSON here, on
  // both free and paywalled recipes.
  function getRecipeJsonLd(doc) {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      let parsed;
      try {
        parsed = JSON.parse(script.textContent);
      } catch {
        continue; // malformed block on the page — skip, don't throw
      }
      const recipe = findRecipeInParsed(parsed);
      if (recipe) return recipe;
    }
    return null;
  }

  function asArray(value) {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
  }

  function joinField(value) {
    if (value == null) return null;
    const parts = asArray(value).filter((v) => typeof v === "string" && v.trim());
    return parts.length ? parts.join(", ") : null;
  }

  // recipeIngredient is a flat array of strings in every sample observed.
  // Schema.org also allows structured entries (e.g. HowToItem/PropertyValue) —
  // handle non-string entries defensively without inventing structure that
  // hasn't actually been seen on NYT Cooking pages.
  function normalizeIngredients(raw) {
    return asArray(raw)
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          return (item.name || item.value || item.text || "").toString().trim();
        }
        return "";
      })
      .filter(Boolean);
  }

  // recipeInstructions is a flat array of HowToStep {text} in every sample
  // observed. Schema.org's documented pattern for multi-part/sub-recipes is an
  // array of HowToSection {name, itemListElement: [HowToStep, ...]} — handled
  // below but UNVERIFIED against a real NYT Cooking recipe. Spot-check this
  // branch against a real sub-recipe (e.g. one with a stock/base component) if
  // one turns up.
  function stepTextOf(step) {
    if (typeof step === "string") return step.trim();
    if (step && typeof step === "object") return (step.text || step.name || "").toString().trim();
    return "";
  }

  function normalizeSteps(raw) {
    const list = asArray(raw);
    if (!list.length) return [];

    const isSectioned = list.some(
      (item) => item && typeof item === "object" && item["@type"] === "HowToSection"
    );

    if (!isSectioned) {
      const items = list.map(stepTextOf).filter(Boolean);
      return items.length ? [{ section: null, items }] : [];
    }

    return list
      .map((section) => {
        if (!section || typeof section !== "object") return null;
        const items = asArray(section.itemListElement).map(stepTextOf).filter(Boolean);
        if (!items.length) return null;
        return { section: (section.name || "").toString().trim() || null, items };
      })
      .filter(Boolean);
  }

  function normalizeTime(raw) {
    const { parseIso8601Duration, formatMinutes } = globalThis.RS_DURATION;
    const total = parseIso8601Duration(raw.totalTime);
    if (total) return formatMinutes(total);

    const prep = parseIso8601Duration(raw.prepTime) || 0;
    const cook = parseIso8601Duration(raw.cookTime) || 0;
    const sum = prep + cook;
    return sum ? formatMinutes(sum) : null;
  }

  function normalizeRecipe(raw) {
    const author = Array.isArray(raw.author) ? raw.author[0] : raw.author;
    const rating = raw.aggregateRating || null;

    return {
      title: (raw.name || "").toString().trim() || "Recipe",
      description: (raw.description || "").toString().trim() || null,
      ratingValue: rating && typeof rating.ratingValue === "number" ? rating.ratingValue : null,
      ratingCount: rating && typeof rating.ratingCount === "number" ? rating.ratingCount : null,
      authorName: author && author.name ? author.name.toString().trim() : null,
      yieldText: joinField(raw.recipeYield),
      timeText: normalizeTime(raw),
      category: joinField(raw.recipeCategory),
      cuisine: joinField(raw.recipeCuisine),
      keywords: joinField(raw.keywords),
      isFree: typeof raw.isAccessibleForFree === "boolean" ? raw.isAccessibleForFree : null,
      ingredients: normalizeIngredients(raw.recipeIngredient),
      steps: normalizeSteps(raw.recipeInstructions),
    };
  }

  globalThis.RS_PARSER = { getRecipeJsonLd, normalizeRecipe };
})();
