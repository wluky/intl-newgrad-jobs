// Pure title/location/text classification. No I/O.

const INTERN_RE = /\b(intern|internship|co-?op)\b/i;
// Note: "manager"/"mgr" intentionally excluded — it would wrongly reject
// entry roles like "Associate Product Manager". Bare "Product Manager" /
// "Engineering Manager" are still dropped for lacking any entry signal.
const SENIOR_RE = /\b(senior|sr\.?|staff|principal|\blead\b|director|head\s+of|vp|vice\s+president|architect|iii|iv|\bv\b)\b/i;
const ENTRY_RE = /\b(new\s*grad|new\s*graduate|entry[-\s]?level|junior|jr\.?|associate|graduate|early\s*career|apprentice|trainee|campus|university\s*grad|\bi\b|\bii\b)\b/i;

export function classifyType(title = '') {
  return INTERN_RE.test(title) ? 'intern' : 'full-time';
}

export function isEntryLevel(title = '') {
  if (INTERN_RE.test(title)) return true;   // internships always qualify
  if (SENIOR_RE.test(title)) return false;  // explicit seniority disqualifies
  return ENTRY_RE.test(title);              // otherwise require a positive entry signal
}

const NON_US = [
  'united kingdom', 'london', 'manchester', 'ireland', 'dublin',
  'canada', 'toronto', 'vancouver', 'montreal', 'ontario',
  'india', 'bangalore', 'bengaluru', 'hyderabad', 'pune', 'gurgaon', 'chennai',
  'germany', 'berlin', 'munich', 'france', 'paris', 'spain', 'madrid', 'barcelona',
  'netherlands', 'amsterdam', 'poland', 'warsaw', 'krakow', 'ukraine', 'romania',
  'australia', 'sydney', 'melbourne', 'singapore', 'japan', 'tokyo', 'china',
  'brazil', 'mexico', 'argentina', 'colombia', 'philippines', 'israel', 'tel aviv',
  'emea', 'apac', 'latam', 'united arab emirates', 'dubai',
];

export function isUS(location = '') {
  const l = location.toLowerCase().trim();
  if (l === '') return true;                    // don't penalize missing data
  return !NON_US.some((k) => l.includes(k));    // reject known non-US, pass the rest
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
