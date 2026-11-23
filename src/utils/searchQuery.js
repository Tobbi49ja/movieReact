const TRAILING_PATTERNS = [
  /\bseason\s*\d+$/,
  /\bseasons?$/,
  /\bs\d+e\d+$/,
  /\bs\d+$/,
  /\bepisode\s*\d+$/,
  /\be\d+$/,
  /\bpart\s*\d+$/,
  /\bcomplete$/,
  /\bmovie$/,
  /\bseries$/,
  /\bdownload$/,
];

export function cleanQuery(text) {
  let s = String(text || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

  let year = "";
  const yearMatch = s.match(/\b(19\d{2}|20\d{2})$/);
  if (yearMatch) {
    year = yearMatch[1];
    s = s.slice(0, yearMatch.index).trim();
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of TRAILING_PATTERNS) {
      const match = s.match(pattern);
      if (match) {
        s = s.slice(0, match.index).trim();
        changed = true;
      }
    }
  }

  return { clean: s.replace(/\s+/g, " ").trim(), year };
}
