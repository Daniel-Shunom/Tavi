// Being told off ("Tavi, stand down", "bad Tavi"): she gets sad and a bit tired, sulks over to
// her seat by the webcam and sits there for a while. Rules, never AI.

const patterns = [
  /\bstand\s+down\b/,
  /\bbad\s+(?:girl|tavi|bot|NAME)\b/,
  /\b(?:naughty|rude|mean)\s+(?:girl|tavi|NAME)\b/,
  /\b(?:no|stop(?:\s+it)?|enough|knock\s+it\s+off|cut\s+it\s+out|behave)\s*,?\s+(?:tavi|NAME)\b/,
  /\b(?:tavi|NAME)\s*,?\s+(?:no|stop(?:\s+it)?|enough|behave|knock\s+it\s+off|cut\s+it\s+out|go\s+sit(?:\s+down)?|sit\s+down|shush|hush|be\s+quiet)\b/,
  /\b(?:shame\s+on\s+you|you(?:'re|\s+are)\s+(?:bad|annoying|being\s+bad))\b/,
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
