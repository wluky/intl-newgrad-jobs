# intl-newgrad-jobs — Design

**Date:** 2026-07-03
**Status:** Draft for review

## Summary

A standalone public GitHub repo whose README is an auto-generated table of
**entry-level, US-based jobs at companies known to sponsor international
students**, refreshed **weekly** by a GitHub Action. A companion
`listings.json` holds the same data machine-readably. No web server, no
hosting, no accounts — the repo *is* the product (SimplifyJobs / pittcsc
"New Grad Jobs" model).

Audience: public — Indonesian and other international students graduating in
the US. This raises the bar on reliability and, especially, on honest framing
of the visa signal (see Guardrails).

## Goals

- Surface entry-level (including internships) US roles that are plausibly open
  to international students needing sponsorship.
- Zero running cost: public ATS JSON APIs + GitHub Actions only.
- Fork-friendly and self-contained — no dependency on any external project.
- Be honest: "international-friendly" is a heuristic, not a guarantee.

## Non-Goals

- Not a web app (no Vercel, no frontend) — explicitly dropped in favor of the
  repo model.
- Not a personal job-search tool (that is what career-ops is; this reuses only
  its ATS-scanning *technique*, not its code or its scoring/CV/tracker layers).
- No accounts, notifications, or search UI beyond GitHub's own star/watch and
  in-page find.
- No guarantee of sponsorship for any specific role.

## Relationship to career-ops

career-ops is a personal, single-user pipeline. Only its **ATS-scanning
technique** — hitting public Greenhouse/Ashby/Lever JSON endpoints, as done in
`scan.mjs` — is reused, reimplemented cleanly inside this repo. This project
does **not** import career-ops code, live inside its repo, or depend on it
being present. career-ops stays untouched.

## Data Pipeline

```
companies.json (curated sponsor registry)
      │
      ▼
  scan each company's ATS API  ──►  raw postings
  (Greenhouse / Ashby / Lever public JSON)
      │
      ▼
  filter:  US location?  ·  entry-level title?  ·  description doesn't exclude sponsorship?
      │
      ▼
  render  ──►  README.md table  +  listings.json  ──►  git commit (weekly, if changed)
```

### The sponsor registry (key design point)

DOL H-1B/LCA disclosure data lists company **names**, but scanning requires a
company's **ATS handle** (e.g. a Greenhouse board token). The bridge is a
curated **`companies.json`** registry. Each entry:

```json
{
  "name": "Example Corp",
  "provider": "greenhouse",        // greenhouse | ashby | lever
  "slug": "examplecorp",           // ATS board token / org handle
  "h1b_sponsor": true,             // qualifies inclusion; sourced from DOL data
  "enabled": true
}
```

Because every registry entry is included *only* if it is a known H-1B sponsor,
the company-level visa condition ("company is a known sponsor") is true by
construction for everything scanned. The per-posting check then reduces to:
does this posting's text *exclude* sponsorship?

The registry is **seeded manually** with ~30–50 well-known sponsors and grown
over time. This curation is the primary ongoing maintenance cost and is
documented as such in the README. (Optional future: a script that
cross-references a candidate company list against a DOL disclosure CSV to
propose registry additions. Out of scope for v1.)

## Filters (pure functions)

- `isUS(location)` — case-insensitive match on US states / "United States" /
  "Remote (US)" etc.; empty location passes (don't penalize missing data),
  explicit non-US (e.g. "London", "Remote, EMEA") rejects.
- `isEntryLevel(title)` — **includes internships**. Accepts: New Grad, Entry
  Level, Junior, Associate, Intern, Co-op, "I"/"II", 0–2 yrs signals. Rejects:
  Senior, Staff, Principal, Lead, Manager, Director, "III+".
- `excludesSponsorship(text)` — rejects postings whose description contains
  exclusion phrases: "no sponsorship", "not able to sponsor", "must be
  authorized to work ... without sponsorship", "US citizen required", "requires
  active security clearance", etc. Absence of such phrases → passes.

Each posting also gets a derived `type` field: `intern` vs `full-time`
(from title keywords) so the two do not blur together in the output.

## Modules

- `sources/greenhouse.mjs`, `sources/ashby.mjs`, `sources/lever.mjs` — each:
  `fetch(slug) -> [{title, company, location, url, description, postedAt, type}]`
  (normalized). Technique borrowed from career-ops `scan.mjs`.
- `filters.mjs` — the three pure functions above + `classifyType(title)`.
- `registry.mjs` — loads and validates `companies.json`.
- `render.mjs` — listings → README table (grouped or sorted, newest first) +
  `listings.json`.
- `pipeline.mjs` — orchestrates: registry → sources → filters → render.
- `.github/workflows/refresh.yml` — weekly cron; runs `pipeline.mjs`; commits
  README.md + listings.json only if content changed.

## Output Format

- **README.md**: markdown table — columns: Company · Role · Type
  (intern/full-time) · Location · Posted · Apply (link). Plus a header section
  with the honesty disclaimer, last-updated timestamp, and contribution notes.
- **listings.json**: array of normalized posting objects (the same fields),
  suitable for forks / a future frontend.

## Guardrails (public-tool honesty)

The README states prominently that **"international-friendly" is a heuristic**:
the company is a historical H-1B sponsor *and* the posting does not exclude
sponsorship — **not a guarantee** that this role sponsors. Users must confirm
with the employer. This framing is a first-class requirement, not a footnote.

## Testing

- Unit tests on `isUS`, `isEntryLevel`, `excludesSponsorship`, `classifyType`
  with fixture inputs → expected pass/fail/type.
- Unit test on `render`: fixture listings → expected markdown + JSON snapshot.
- Source adapters tested against **recorded API fixtures** (no live network in
  CI).

## Open Decisions (resolved)

- Audience: public. ✓
- Visa signal: H-1B sponsor AND posting doesn't exclude sponsorship. ✓
- Job source: self-contained scanner over a sponsor-seeded registry. ✓
- Output: README table + listings.json. ✓
- Cadence: weekly. ✓
- Entry-level: new grad + junior + internships. ✓

## Future (out of scope for v1)

- DOL CSV cross-reference script to auto-propose registry additions.
- More ATS providers (Workday, SmartRecruiters).
- A thin static frontend (Vercel/Pages) rendering `listings.json`.
- Community contribution workflow (PRs adding companies to the registry).
