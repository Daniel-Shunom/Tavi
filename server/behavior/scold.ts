// Being told off ("Tavi, stand down", "bad Tavi"): she gets sad and a bit tired, sulks over to
// her seat by the webcam and sits there for a while. Rules, never AI.

// Every pattern names her, so ordinary speech ("I'll stand down", "you're bad at this game")
// never counts. A bare "no" counts only as the whole line ("no, Tavi!"); "Tavi, no way" does not.
const patterns = [
  /\b(?:tavi|NAME)\s*,?\s+stand\s+down\b/,
  /\bstand\s+down\s*,?\s+(?:tavi|NAME)\b/,
  /\b(?:bad|naughty|rude|mean)\s+(?:tavi|NAME)\b/,
  /\b(?:stop(?:\s+it)?|enough|knock\s+it\s+off|cut\s+it\s+out|behave)\s*,?\s+(?:tavi|NAME)\b/,
  /\b(?:tavi|NAME)\s*,?\s+(?:stop(?:\s+it)?|enough|behave|knock\s+it\s+off|cut\s+it\s+out|shush|hush|be\s+quiet)\b/,
  /^\W*no+\s*,?\s+(?:tavi|NAME)\W*$/,
  /^\W*(?:tavi|NAME)\s*,?\s+no+\W*$/,
  /\bshame\s+on\s+you\s*,?\s+(?:tavi|NAME)\b/,
  /\b(?:tavi|NAME)\s*,?\s+you(?:'re|\s+are)\s+(?:bad|annoying|being\s+bad)\b/,
];

/** Whether a line scolds Tavi (her configured name also counts). */
export function isScolding(text: string, name: string): boolean {
  const lower = text.toLowerCase();
  const escaped = name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return patterns.some((pattern) =>
    new RegExp(pattern.source.replaceAll('NAME', escaped), 'i').test(lower),
  );
}

const forgiving = [
  /\b(?:sorry|my\s+bad|forgive\s+me)\b/,
  /\b(?:it'?s|its)\s+(?:ok(?:ay)?|fine|alright|all\s+right)\b/,
  /\bgood\s+(?:girl|tavi|NAME|job)\b/,
  /\b(?:come\s+(?:back|here|on\s+out)|cheer\s+up|don'?t\s+be\s+sad|love\s+you|you'?re\s+(?:fine|good|forgiven))\b/,
];

/** Whether a line makes up with Tavi after a scolding ("sorry Tavi", "it's okay", "good girl"). */
export function isForgiving(text: string, name: string): boolean {
  const lower = text.toLowerCase();
  const escaped = name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return forgiving.some((pattern) =>
    new RegExp(pattern.source.replaceAll('NAME', escaped), 'i').test(lower),
  );
}
