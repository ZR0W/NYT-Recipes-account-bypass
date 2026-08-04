// ISO-8601 duration helpers for schema.org Recipe timing fields (e.g. "PT1H20M").
// Exposed as a global (RS_DURATION) since this project has no build step / no ES modules,
// matching the loading order declared in manifest.json.
(() => {
  "use strict";

  const ISO_DURATION_RE = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;

  function parseIso8601Duration(value) {
    if (typeof value !== "string") return null;
    const match = ISO_DURATION_RE.exec(value.trim());
    if (!match) return null;
    const [, days, hours, minutes] = match;
    const totalMinutes =
      (Number(days) || 0) * 24 * 60 + (Number(hours) || 0) * 60 + (Number(minutes) || 0);
    return totalMinutes > 0 ? totalMinutes : totalMinutes === 0 ? 0 : null;
  }

  function formatMinutes(totalMinutes) {
    if (typeof totalMinutes !== "number" || Number.isNaN(totalMinutes) || totalMinutes < 0) {
      return null;
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const parts = [];
    if (hours) parts.push(`${hours} hr`);
    if (minutes || !hours) parts.push(`${minutes} min`);
    return parts.join(" ");
  }

  globalThis.RS_DURATION = { parseIso8601Duration, formatMinutes };
})();
