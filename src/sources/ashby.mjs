import { getJson, stripHtml } from './_http.mjs';
import { classifyType } from '../filters.mjs';

export function parseAshby(raw, company) {
  const jobs = raw?.jobs ?? [];
  return jobs.map((j) => ({
    title: j.title ?? '',
    company,
    location: j.location ?? j.locationName ?? '',
    url: j.jobUrl ?? j.applyUrl ?? '',
    description: j.descriptionPlain ?? stripHtml(j.descriptionHtml ?? ''),
    postedAt: (j.publishedAt ?? j.updatedAt ?? '').slice(0, 10),
    type: /intern/i.test(j.employmentType ?? '') ? 'intern' : classifyType(j.title ?? ''),
  }));
}

export async function fetchAshby(slug, company, opts = {}) {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=false`;
  return parseAshby(await getJson(url, opts), company);
}
