import { getJson, stripHtml } from './_http.mjs';
import { classifyType } from '../filters.mjs';

export function parseGreenhouse(raw, company) {
  const jobs = raw?.jobs ?? [];
  return jobs.map((j) => ({
    title: j.title ?? '',
    company,
    location: j.location?.name ?? '',
    url: j.absolute_url ?? '',
    description: stripHtml(j.content ?? ''), // decodes entities + strips tags in one pass
    postedAt: (j.updated_at ?? '').slice(0, 10),
    type: classifyType(j.title ?? ''),
  }));
}

export async function fetchGreenhouse(slug, company, opts = {}) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  return parseGreenhouse(await getJson(url, opts), company);
}
