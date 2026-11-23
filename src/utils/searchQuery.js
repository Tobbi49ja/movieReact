const REMOVE_PATTERNS = [
  /\bseason\s*\d+\b/g,
  /\bseasons?\b/g,
  /\bs\d+e\d+\b/g,
  /\bs\d+\b/g,
  /\bepisode\s*\d+\b/g,
  /\be\d+\b/g,
  /\bpart\s*\d+\b/g,
  /\b(?:complete|movie|series|download)\b/g,
];

export function cleanQuery(text) {
  let s = String(text || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

  for (const pattern of REMOVE_PATTERNS) {
    s = s.replace(pattern, " ");
  }
  s = s.replace(/\s+/g, " ").trim();

  let year = "";
  const yearMatch = s.match(/\b(19\d{2}|20\d{2})$/);
  if (yearMatch) {
    year = yearMatch[1];
    s = s.slice(0, yearMatch.index).trim();
  }

  return { clean: s.replace(/\s+/g, " ").trim(), year };
}
