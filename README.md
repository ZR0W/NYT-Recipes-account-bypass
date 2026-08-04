# Recipe Summarizer

A [Manifest V3](https://developer.chrome.com/docs/extensions/mv3/) browser extension for **desktop Firefox and Chromium** (Chrome, Edge, …), with Firefox for Android as a best-effort target. On any `cooking.nytimes.com` recipe page, it summarizes the recipe already embedded in that page's own HTML into a small floating card — title, rating, time, yield, ingredients, and numbered steps — no sign-in required, because it never needed sign-in in the first place: it just reads the structured recipe data the page ships to every visitor.

**Maintainers & AI assistants:** see [AGENTS.md](AGENTS.md) for architecture, storage schema, debugging, constraints, and the roadmap. That file also explains why this project deliberately doesn't share a name with this git repository — read it before assuming anything about scope or distribution.

## What this is (and isn't)

- Reads the `schema.org/Recipe` JSON-LD block that's already present in the raw HTML the page sends your browser — the same block that lets the recipe show up with stars/time/photo in Google search results. It's there whether or not the visible page is showing you a paywall.
- Makes **zero network requests of its own**. No server, no account, no login, nothing sent anywhere. Everything happens inside your browser, on a page you already loaded.
- **Personal use only.** This is an unpacked, local, developer-mode extension — it isn't published to any extension store and isn't meant to be.
- Not affiliated with, endorsed by, or reviewed by The New York Times.

## Install (development — Firefox)

1. Open **about:debugging#/runtime/this-firefox**.
2. Click **Load Temporary Add-on…** and select **`manifest.json`** in this repo.
3. Visit a recipe page on `cooking.nytimes.com` — the card appears near the top of the page.

Firefox loads this as a **temporary** add-on — it disappears when Firefox closes and needs reloading after any code change.

## Install (development — Chromium)

1. Open `chrome://extensions`, turn on **Developer mode**.
2. Click **Load unpacked** and select this repository folder (the directory containing `manifest.json`).
3. After code changes, click **Reload** on the extensions page.

## Install (Firefox for Android — best effort)

Connect the device over USB, use desktop Firefox's `about:debugging` to reach the Android runtime, and **Load Temporary Add-on** the same way as desktop. This generally needs Firefox Nightly (or another debug-enabled build) on the phone. Mozilla's exact process here shifts between versions — check their current docs if this doesn't work as described.

## Using it

- The card appears automatically on recipe pages; click the header to collapse/expand it (your preference is remembered).
- The 🔒/🔓 badge next to the title isn't a guess — it's NYT's own `isAccessibleForFree` flag, published as part of the same structured recipe data as the ingredients and steps. The extension just displays whatever value NYT put there; it doesn't infer or check paywall state itself.
- **Copy as Markdown** puts a clean ingredients + numbered-steps writeup on your clipboard.
- **Print** opens your browser's print dialog with just the card visible — use "Save as PDF" there if you want a file.

## Privacy

- No analytics, no remote code, no data collection of any kind. The extension's only "content" is what your browser already downloaded to render the page you're looking at.
- `storage` permission holds exactly one boolean: whether you last left the card open or collapsed.

## Icons

PNG icons live under `icons/`. Regenerate with:

```bash
python3 scripts/generate-icons.py
```

## License

Add a `LICENSE` file when you decide how you want to distribute the project.
