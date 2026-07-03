// Pure title/location/text classification. No I/O.

const INTERN_RE = /\b(intern|internship|co-?op)\b/i;

// Unambiguously senior signals — always disqualify.
const SENIOR_RE = /\b(senior|sr\.?|staff|principal|\blead\b|director|head\s+of|vp|vice\s+president|architect|iii|iv|\bv\b)\b/i;

// Manager-family titles are senior UNLESS paired with an explicit entry word:
// "Associate Product Manager" is entry-level; "Engineering Manager II" is not.
const MANAGER_RE = /\b(manager|mgr)\b/i;

// Explicit early-career words.
const ENTRY_WORD_RE = /\b(new\s*grad|new\s*graduate|entry[-\s]?level|junior|jr\.?|associate|graduate|early\s*career|apprentice|trainee|campus|university\s*grad)\b/i;

// Level-1/2 grade markers (roman numerals).
const GRADE_RE = /\b(i|ii)\b/i;

export function classifyType(title = '') {
  return INTERN_RE.test(title) ? 'intern' : 'full-time';
}

export function isEntryLevel(title = '') {
  if (INTERN_RE.test(title)) return true;                                // internships always qualify
  if (SENIOR_RE.test(title)) return false;                              // explicit seniority disqualifies
  if (MANAGER_RE.test(title) && !ENTRY_WORD_RE.test(title)) return false; // "Manager II" ≠ entry, but "Associate ... Manager" is
  return ENTRY_WORD_RE.test(title) || GRADE_RE.test(title);            // require an entry word or a I/II grade
}

// Known non-US countries, regions, and major hubs. Matched with word
// boundaries (so "uk" catches "Remote - UK" but not "Milwaukee"). Note: 2-letter
// state-vs-country ambiguities (e.g. "CA") are intentionally NOT listed — "CA"
// is far more often California than Canada on US job boards.
const NON_US = [
  'united kingdom', 'england', 'scotland', 'wales', 'uk', 'ireland',
  'canada', 'germany', 'france', 'spain', 'portugal', 'italy', 'netherlands',
  'belgium', 'luxembourg', 'switzerland', 'austria', 'poland', 'czech',
  'czechia', 'hungary', 'romania', 'bulgaria', 'greece', 'cyprus', 'malta',
  'sweden', 'norway', 'denmark', 'finland', 'iceland', 'estonia', 'lithuania',
  'latvia', 'ukraine', 'turkey', 'israel', 'united arab emirates', 'saudi arabia',
  'qatar', 'egypt', 'nigeria', 'kenya', 'south africa', 'morocco',
  'india', 'pakistan', 'bangladesh', 'sri lanka', 'china', 'hong kong', 'taiwan',
  'japan', 'south korea', 'singapore', 'malaysia', 'indonesia', 'thailand',
  'vietnam', 'philippines', 'australia', 'new zealand',
  'brazil', 'mexico', 'argentina', 'chile', 'colombia', 'peru', 'uruguay',
  'costa rica', 'panama',
  'emea', 'apac', 'latam',
  'london', 'manchester', 'dublin', 'toronto', 'vancouver', 'montreal',
  'ottawa', 'berlin', 'munich', 'paris', 'madrid', 'barcelona', 'lisbon',
  'amsterdam', 'brussels', 'zurich', 'geneva', 'vienna', 'warsaw', 'krakow',
  'prague', 'stockholm', 'copenhagen', 'oslo', 'helsinki', 'tel aviv', 'dubai',
  'bangalore', 'bengaluru', 'hyderabad', 'pune', 'gurgaon', 'chennai', 'mumbai',
  'delhi', 'beijing', 'shanghai', 'tokyo', 'seoul', 'sydney', 'melbourne',
  'sao paulo', 'bogota',
];

const NON_US_RE = new RegExp(
  '\\b(' + NON_US.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
  'i',
);

export function isUS(location = '') {
  const l = location.toLowerCase();
  if (l.trim() === '') return true;   // don't penalize missing data
  return !NON_US_RE.test(l);          // reject known non-US, pass the rest
}

const EXCLUSION_PHRASES = [
  'no sponsorship', 'no visa sponsorship', 'without sponsorship',
  'unable to sponsor', 'not able to sponsor', 'will not sponsor',
  'do not sponsor', 'does not sponsor', 'cannot sponsor', 'can not sponsor',
  'not provide sponsorship', 'not offer sponsorship',
  'sponsorship is not available', 'sponsorship will not be',
  'must be a u.s. citizen', 'must be a us citizen',
  'u.s. citizenship is required', 'us citizenship is required',
  'citizenship is required', 'requires u.s. citizenship', 'requires us citizenship',
  'active security clearance', 'security clearance is required',
  'ability to obtain a security clearance',
];

export function excludesSponsorship(text = '') {
  const t = text.toLowerCase();
  return EXCLUSION_PHRASES.some((p) => t.includes(p));
}
