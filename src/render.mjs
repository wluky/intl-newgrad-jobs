const HEADER = `# 🌍 International-Friendly US Entry-Level Jobs

Entry-level and internship roles in the United States at companies with a
history of sponsoring work visas — curated for international students
graduating in the US.

> ⚠️ **"International-friendly" is a heuristic, not a guarantee.** A role is
> listed when (1) the employer has historically sponsored H-1B visas and
> (2) the job posting does not explicitly rule out sponsorship. This does
> **not** promise that any specific role will sponsor you. **Always confirm
> visa sponsorship directly with the employer before applying or accepting.**

To add or fix a company, edit [\`companies.json\`](companies.json) — not this
file (the table below is auto-generated weekly).`;

function esc(s = '') {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function renderMarkdown(listings, { generatedAt }) {
  const rows = [...listings]
    .sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''))
    .map((j) =>
      `| ${esc(j.company)} | ${esc(j.title)} | ${j.type === 'intern' ? 'Intern' : 'Full-time'} | ${esc(j.location) || '—'} | ${j.postedAt || '—'} | [Apply](${j.url}) |`
    );
  return [
    HEADER,
    '',
    `_Last updated: ${generatedAt} · ${listings.length} open roles_`,
    '',
    '| Company | Role | Type | Location | Posted | Link |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

export function renderJson(listings, { generatedAt }) {
  return JSON.stringify({ generatedAt, count: listings.length, listings }, null, 2) + '\n';
}
