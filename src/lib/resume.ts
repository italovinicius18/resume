import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import {
  resumeSchema,
  type Experience,
  type Localized,
  type Profile,
  type Resume,
} from './schema';

export type Lang = 'en' | 'pt';

const YAML_PATH = fileURLToPath(new URL('../../content/resume.yaml', import.meta.url));

export function loadResume(): Resume {
  return resumeSchema.parse(parse(readFileSync(YAML_PATH, 'utf8')));
}

export function t(field: Localized | string, lang: Lang): string {
  return typeof field === 'string' ? field : field[lang];
}

function inProfile(item: { profiles?: Profile[] }, p: Profile): boolean {
  return !item.profiles || item.profiles.includes(p);
}

export function filterResume(r: Resume, p: Profile): Resume {
  const filterHighlights = <T extends { highlights: { profiles?: Profile[] }[] }>(x: T): T => ({
    ...x,
    highlights: x.highlights.filter((h) => inProfile(h, p)),
  });

  return {
    ...r,
    experience: r.experience
      .filter((e) => inProfile(e, p))
      .map((e) => ({ ...filterHighlights(e), clients: e.clients?.map(filterHighlights) })),
    research: r.research.filter((x) => inProfile(x, p)).map(filterHighlights),
    education: r.education.filter((x) => inProfile(x, p)),
    certifications: r.certifications.filter((x) => inProfile(x, p)),
    skills: r.skills.filter((x) => inProfile(x, p)),
    projects: r.projects.filter((x) => inProfile(x, p)),
    languages: r.languages.filter((x) => inProfile(x, p)),
  };
}

const MONTHS: Record<Lang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
};

export function formatDate(d: string, lang: Lang): string {
  const [year, month] = d.split('-');
  return month ? `${MONTHS[lang][Number(month) - 1]} ${year}` : year;
}

export function formatRange(start: string, end: string | null, lang: Lang): string {
  const current = lang === 'pt' ? 'atual' : 'present';
  return `${formatDate(start, lang)} — ${end ? formatDate(end, lang) : current}`;
}

export function roleFor(e: Experience, p: Profile): Localized {
  return (e.role[p] ?? e.role.data ?? e.role.software) as Localized;
}

export interface Metrics {
  years: number;
  certs: number;
  papers: number;
  current: string[];
}

export function metrics(filtered: Resume): Metrics {
  const firstStart = filtered.experience.map((e) => e.start).sort()[0];
  const [y, m = '01'] = firstStart.split('-');
  const elapsed = Date.now() - new Date(Number(y), Number(m) - 1, 1).getTime();
  const years = Math.floor(elapsed / (365.25 * 24 * 3600 * 1000));

  const allHighlights = [
    ...filtered.experience.flatMap((e) => [
      ...e.highlights,
      ...(e.clients?.flatMap((c) => c.highlights) ?? []),
    ]),
    ...filtered.research.flatMap((x) => x.highlights),
  ];
  const papers = allHighlights.filter((h) => h.text.en.toLowerCase().includes('paper accepted')).length;

  return {
    years,
    certs: filtered.certifications.length,
    papers,
    current: filtered.experience.filter((e) => e.end === null).map((e) => e.company),
  };
}
