import { getJson, stripHtml } from './_http.mjs';
import { classifyType } from '../filters.mjs';

export function parseLever(raw, company) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((j) => ({
    title: j.text ?? '',
    company,
    location: j.categories?.location ?? '',
    url: j.hostedUrl ?? '',
    description: j.descriptionPlain ?? stripHtml(j.description ?? ''),
    postedAt: j.createdAt ? new Date(j.createdAt).toISOString().slice(0, 10) : '',
    type: classifyType(j.text ?? ''),
  }));
}

export async function fetchLever(slug, company, opts = {}) {
  const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
  return parseLever(await getJson(url, opts), company);
}
