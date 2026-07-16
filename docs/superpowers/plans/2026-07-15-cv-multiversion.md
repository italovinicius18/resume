# CV Multi-Versão Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o pipeline legado do repo `resume-pt` por um sistema de CV com fonte de dados única (`content/resume.yaml`), gerando dois sites estáticos brutalista-dark (perfis `data` e `software`, cada um EN/PT) deployados em Cloudflare Workers, com 4 PDFs ATS-friendly gerados no build.

**Architecture:** Um codebase Astro; `PROFILE=data|software` (env de build) seleciona filtro de conteúdo, tema (accent) e `outDir`. Dados validados por Zod, filtrados por perfil/idioma em `src/lib/resume.ts`. Worker minimalista serve os assets e redireciona `/` por `Accept-Language`. CI (GitHub Actions) valida → testa → builda ×2 → gera PDFs (Playwright) → smoke-check → `wrangler deploy` ×2.

**Tech Stack:** Astro ^5, TypeScript, Zod ^3.25, yaml, Vitest, tsx, Playwright, Wrangler ^4, pnpm, @fontsource (Archivo Black, Space Grotesk, JetBrains Mono).

**Spec:** `docs/superpowers/specs/2026-07-15-cv-multiversion-design.md` (ler antes de começar).

## Global Constraints

- Fundo dark `#0a0a0e`; superfície `#111117`; borda `#26262e`; texto `#f0f0f0`.
- Acento perfil data: `#ccff00` (verde-limão). Acento perfil software: `#22d3ee` (ciano). Nada de outras cores de acento.
- Domínios: `data.italoguimaraes.dev` (Worker `cv-data`) e `software.italoguimaraes.dev` (Worker `cv-software`).
- Nomes dos PDFs: `cv-italo-guimaraes-{data|software}-{en|pt}.pdf`, servidos em `/pdf/`.
- Rotas: `/pt/`, `/en/`, `/print/pt/`, `/print/en/`; `/` redireciona por Accept-Language (Worker; fallback estático meta-refresh para `/pt/`).
- `content/resume.yaml` JÁ EXISTE no repo com o conteúdo final — NUNCA alterar seu conteúdo; apenas consumi-lo. Convenções: `profiles` ausente = item aparece nos dois perfis; `end: null` = vínculo atual (Nubank e Ministério da Saúde são ambos atuais, isso é intencional); ordem do YAML = ordem de exibição.
- Zero framework JS no cliente — apenas vanilla JS inline (marquee é CSS puro; reveal/toggle são `<script>` no Layout).
- Tudo respeita `prefers-reduced-motion: reduce` (desliga marquee, reveal e smooth-scroll).
- Node 22, pnpm. Package manager é pnpm em todos os comandos.
- Certificações `priority: low` ficam em colapsável no site e FORA do PDF.
- Seções sem itens após filtro de perfil são omitidas (e a numeração da navegação é recalculada).

## File Structure

```
resume-pt/
├── content/resume.yaml              # já existe — fonte da verdade (NÃO EDITAR)
├── package.json                     # T1
├── astro.config.mjs                 # T1 — outDir/site por PROFILE
├── tsconfig.json                    # T1
├── .gitignore                       # T1 (reescrito)
├── public/favicon.svg               # T4
├── src/
│   ├── lib/
│   │   ├── schema.ts                # T2 — Zod schema + tipos
│   │   ├── resume.ts                # T3 — load/filter/t/datas/métricas
│   │   ├── profile.ts               # T4 — PROFILE, SITES, OTHER
│   │   └── ui.ts                    # T4 — strings de UI EN/PT + categorias de skills
│   ├── styles/
│   │   ├── tokens.css               # T4 — identidade compartilhada
│   │   └── themes/{data,software}.css  # T4 — accents por html[data-profile]
│   ├── components/
│   │   ├── Layout.astro             # T4 — head/SEO/scripts globais
│   │   ├── Marquee.astro            # T5
│   │   ├── Nav.astro                # T5
│   │   ├── Hero.astro               # T5
│   │   ├── Experience.astro         # T6
│   │   ├── Research.astro           # T6
│   │   ├── Stack.astro              # T7
│   │   ├── Certifications.astro     # T7
│   │   ├── Projects.astro           # T7
│   │   ├── EducationContact.astro   # T8
│   │   ├── CvPage.astro             # T5 (parcial) → T8 (completo)
│   │   └── PrintPage.astro          # T9
│   └── pages/
│       ├── index.astro              # T1 — meta-refresh /pt/
│       ├── pt.astro / en.astro      # T5
│       └── print/{pt,en}.astro      # T9
├── scripts/
│   ├── check-data.ts                # T2
│   ├── generate-pdf.mjs             # T10
│   ├── smoke-check.mjs              # T11
│   └── generate-og.mjs              # T14
├── tests/
│   ├── schema.test.ts               # T2
│   └── resume.test.ts               # T3
├── worker/index.js                  # T12
├── wrangler.data.jsonc              # T12
├── wrangler.software.jsonc          # T12
├── .github/workflows/deploy.yml     # T13
└── README.md                        # T14 (reescrito)
```

---

### Task 1: Limpeza do legado + scaffold Astro

**Files:**
- Delete: `src/` (Python/Jinja legado), `Pipfile`, `requirements.txt`, `index.html`, `dist/`, `.github/workflows/generate_files.yml`, `resume.yaml` (raiz)
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore`, `src/pages/index.astro`

**Interfaces:**
- Produces: projeto Astro buildável; `process.env.PROFILE` controla `outDir` (`dist/data` | `dist/software`) e `site`.

- [ ] **Step 1: Remover arquivos legados**

```bash
cd /home/italo/resume/resume-pt
git rm -r src Pipfile requirements.txt index.html .github/workflows/generate_files.yml resume.yaml
git rm -r --cached dist 2>/dev/null; rm -rf dist
```

- [ ] **Step 2: Criar `package.json`**

```json
{
  "name": "cv-italoguimaraes",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "tsx scripts/check-data.ts",
    "test": "vitest run",
    "pdf": "node scripts/generate-pdf.mjs",
    "smoke": "node scripts/smoke-check.mjs"
  },
  "dependencies": {
    "astro": "^5.12.0",
    "yaml": "^2.8.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@fontsource/archivo-black": "^5.2.5",
    "@fontsource-variable/jetbrains-mono": "^5.2.5",
    "@fontsource-variable/space-grotesk": "^5.2.5",
    "playwright": "^1.53.0",
    "tsx": "^4.20.0",
    "typescript": "^5.8.0",
    "vitest": "^3.2.0",
    "wrangler": "^4.24.0"
  }
}
```

- [ ] **Step 3: Criar `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';

const profile = process.env.PROFILE === 'software' ? 'software' : 'data';

export default defineConfig({
  site: profile === 'data'
    ? 'https://data.italoguimaraes.dev'
    : 'https://software.italoguimaraes.dev',
  outDir: `./dist/${profile}`,
});
```

- [ ] **Step 4: Criar `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/base",
  "include": ["src/**/*", "tests/**/*", "scripts/**/*"],
  "compilerOptions": { "strict": true }
}
```

- [ ] **Step 5: Criar `.gitignore`**

```
node_modules/
dist/
.astro/
*.log
```

- [ ] **Step 6: Criar `src/pages/index.astro`** (fallback estático; em produção o Worker intercepta `/`)

```astro
---
// Fallback de redirecionamento por meta-refresh; o Worker faz o redirect real por Accept-Language.
---
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0; url=/pt/" />
    <title>Ítalo Guimarães</title>
  </head>
  <body>
    <a href="/pt/">→ /pt/</a>
  </body>
</html>
```

- [ ] **Step 7: Instalar e verificar build**

```bash
pnpm install
PROFILE=data pnpm build
```
Expected: build sucesso; existe `dist/data/index.html`.

```bash
PROFILE=software pnpm build && ls dist/
```
Expected: `data  software`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: remove legacy Jinja pipeline, scaffold Astro project"
```

---

### Task 2: Schema Zod + script `pnpm check`

**Files:**
- Create: `src/lib/schema.ts`, `scripts/check-data.ts`
- Test: `tests/schema.test.ts`

**Interfaces:**
- Produces: `resumeSchema` (Zod), tipos `Resume`, `Profile` (`'data' | 'software'`), `Localized` (`{en: string; pt: string}`), `Experience`, `Skill`, `Certification`. Todos os objetos `.strict()` (campo desconhecido = erro).

- [ ] **Step 1: Escrever teste que falha** — `tests/schema.test.ts`

```ts
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { resumeSchema } from '../src/lib/schema';

const raw = () => parse(readFileSync('content/resume.yaml', 'utf8'));

describe('resumeSchema', () => {
  it('aceita o resume.yaml real', () => {
    const result = resumeSchema.safeParse(raw());
    if (!result.success) console.error(result.error.issues.slice(0, 5));
    expect(result.success).toBe(true);
  });

  it('rejeita tradução faltando', () => {
    const bad = raw();
    delete bad.basics.location.pt;
    expect(resumeSchema.safeParse(bad).success).toBe(false);
  });

  it('rejeita perfil inválido', () => {
    const bad = raw();
    bad.experience[0].profiles = ['data', 'devops'];
    expect(resumeSchema.safeParse(bad).success).toBe(false);
  });

  it('rejeita data malformada', () => {
    const bad = raw();
    bad.experience[0].start = '11/2025';
    expect(resumeSchema.safeParse(bad).success).toBe(false);
  });

  it('rejeita campo desconhecido (typo)', () => {
    const bad = raw();
    bad.experience[0].compnay = 'X';
    expect(resumeSchema.safeParse(bad).success).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm test
```
Expected: FAIL — `Cannot find module '../src/lib/schema'`.

- [ ] **Step 3: Implementar `src/lib/schema.ts`**

```ts
import { z } from 'zod';

export const PROFILES = ['data', 'software'] as const;
export type Profile = (typeof PROFILES)[number];

const profileList = z.array(z.enum(PROFILES)).nonempty().optional();
const localized = z.object({ en: z.string().min(1), pt: z.string().min(1) }).strict();
const dateStr = z.string().regex(/^\d{4}(-\d{2})?$/, 'expected YYYY or YYYY-MM');

const highlight = z.object({ profiles: profileList, text: localized }).strict();

const client = z
  .object({
    name: z.string().min(1),
    duration: localized,
    highlights: z.array(highlight).nonempty(),
  })
  .strict();

const experience = z
  .object({
    company: z.string().min(1),
    location: localized,
    profiles: profileList,
    role: z
      .object({ data: localized.optional(), software: localized.optional() })
      .strict()
      .refine((r) => r.data || r.software, 'role precisa de ao menos um perfil'),
    start: dateStr,
    end: dateStr.nullable(),
    clients: z.array(client).optional(),
    highlights: z.array(highlight).nonempty(),
  })
  .strict();

const research = z
  .object({
    institution: localized,
    title: localized,
    start: dateStr,
    end: dateStr.nullable(),
    profiles: profileList,
    highlights: z.array(highlight).nonempty(),
  })
  .strict();

const education = z
  .object({
    institution: localized,
    degree: localized,
    field: localized.optional(),
    start: dateStr,
    end: dateStr.nullable(),
    profiles: profileList,
  })
  .strict();

const certification = z
  .object({
    name: localized,
    issuer: z.string().min(1),
    issued: dateStr,
    expires: dateStr.nullable().optional(),
    credential_id: z.string().optional(),
    profiles: profileList,
    priority: z.enum(['high', 'medium', 'low']),
  })
  .strict();

export const SKILL_CATEGORIES = [
  'language', 'processing', 'orchestration', 'cloud', 'infra', 'cicd',
  'database', 'quality', 'governance', 'observability', 'ai', 'backend', 'frontend',
] as const;

const skill = z
  .object({
    name: z.string().min(1),
    profiles: profileList,
    category: z.enum(SKILL_CATEGORIES),
    level: z.enum(['basic', 'intermediate', 'advanced', 'expert']),
  })
  .strict();

const project = z
  .object({
    title: localized,
    description: localized,
    tech: z.array(z.string()).nonempty(),
    profiles: profileList,
    github: z.string().url(),
  })
  .strict();

const language = z
  .object({ language: localized, level: localized, profiles: profileList })
  .strict();

export const resumeSchema = z
  .object({
    basics: z
      .object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(1),
        location: localized,
        headline: z.object({ data: localized, software: localized }).strict(),
        links: z.object({ github: z.string().url(), linkedin: z.string().url() }).strict(),
      })
      .strict(),
    experience: z.array(experience).nonempty(),
    research: z.array(research),
    education: z.array(education).nonempty(),
    certifications: z.array(certification),
    skills: z.array(skill).nonempty(),
    projects: z.array(project),
    languages: z.array(language).nonempty(),
  })
  .strict();

export type Resume = z.infer<typeof resumeSchema>;
export type Localized = z.infer<typeof localized>;
export type Experience = z.infer<typeof experience>;
export type Skill = z.infer<typeof skill>;
export type Certification = z.infer<typeof certification>;
```

- [ ] **Step 4: Rodar testes até passar**

```bash
pnpm test
```
Expected: 5 passed. Se o YAML real falhar no primeiro teste, o console mostra os 5 primeiros issues — ajustar o **schema** (nunca o YAML) até acomodar o dado real.

- [ ] **Step 5: Criar `scripts/check-data.ts`**

```ts
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { resumeSchema } from '../src/lib/schema';

const result = resumeSchema.safeParse(parse(readFileSync('content/resume.yaml', 'utf8')));

if (!result.success) {
  console.error('✘ content/resume.yaml inválido:\n');
  for (const issue of result.error.issues) {
    console.error(`  ${issue.path.join('.')} — ${issue.message}`);
  }
  process.exit(1);
}

const r = result.data;
console.log(
  `✔ resume.yaml válido — ${r.experience.length} experiências, ` +
    `${r.certifications.length} certificações, ${r.skills.length} skills, ` +
    `${r.projects.length} projetos`,
);
```

- [ ] **Step 6: Verificar `pnpm check`**

```bash
pnpm check
```
Expected: `✔ resume.yaml válido — 9 experiências, 16 certificações, 45 skills, 8 projetos` (números conforme YAML real).

- [ ] **Step 7: Commit**

```bash
git add src/lib/schema.ts scripts/check-data.ts tests/schema.test.ts
git commit -m "feat: add Zod schema and data check script for resume.yaml"
```

---

### Task 3: Lib de dados — load, filtro, i18n, datas, métricas

**Files:**
- Create: `src/lib/resume.ts`
- Test: `tests/resume.test.ts`

**Interfaces:**
- Consumes: `resumeSchema`, tipos de `src/lib/schema.ts`.
- Produces (usado por TODOS os componentes):
  - `type Lang = 'en' | 'pt'`
  - `loadResume(): Resume`
  - `t(field: Localized | string, lang: Lang): string`
  - `filterResume(r: Resume, p: Profile): Resume`
  - `formatRange(start: string, end: string | null, lang: Lang): string` — ex.: `"Oct 2024 — May 2025"`, `"nov 2025 — atual"`, `"2018 — 2023"`
  - `roleFor(e: Experience, p: Profile): Localized`
  - `metrics(filtered: Resume): { years: number; certs: number; papers: number; current: string[] }`

- [ ] **Step 1: Escrever testes que falham** — `tests/resume.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { loadResume, filterResume, t, formatRange, metrics, roleFor } from '../src/lib/resume';

const resume = loadResume();
const data = filterResume(resume, 'data');
const software = filterResume(resume, 'software');

describe('loadResume', () => {
  it('carrega e valida o YAML real', () => {
    expect(resume.basics.name).toBe('Ítalo Vinícius Guimarães');
  });
});

describe('filterResume', () => {
  it('data exclui empresas só-software', () => {
    expect(data.experience.map((e) => e.company)).not.toContain('Polícia Civil do Estado de Goiás');
  });

  it('software exclui empresas só-data', () => {
    const companies = software.experience.map((e) => e.company);
    expect(companies).not.toContain('A3Data');
    expect(companies).not.toContain('Compass UOL / Dasa Medicina Diagnóstica');
  });

  it('item sem profiles aparece nos dois perfis', () => {
    const clone = structuredClone(resume);
    delete (clone.projects[0] as { profiles?: unknown }).profiles;
    expect(filterResume(clone, 'data').projects.map((p) => p.title.en)).toContain(clone.projects[0].title.en);
    expect(filterResume(clone, 'software').projects.map((p) => p.title.en)).toContain(clone.projects[0].title.en);
  });

  it('filtra highlights por perfil', () => {
    const nubank = software.experience.find((e) => e.company === 'Nubank')!;
    expect(nubank.highlights.length).toBeGreaterThan(0);
    expect(nubank.highlights.every((h) => !h.profiles || h.profiles.includes('software'))).toBe(true);
  });

  it('research vazio no perfil software', () => {
    expect(software.research).toHaveLength(0);
    expect(data.research).toHaveLength(1);
  });

  it('clients da A3Data preservados no perfil data', () => {
    const a3 = data.experience.find((e) => e.company === 'A3Data')!;
    expect(a3.clients?.map((c) => c.name)).toEqual(['Hypofarma', 'Farmax', 'Banco BMG']);
  });
});

describe('t', () => {
  it('escolhe idioma em campo bilíngue', () => expect(t({ en: 'a', pt: 'b' }, 'pt')).toBe('b'));
  it('retorna string invariante como está', () => expect(t('Nubank', 'en')).toBe('Nubank'));
});

describe('formatRange', () => {
  it('intervalo fechado EN', () => expect(formatRange('2024-10', '2025-05', 'en')).toBe('Oct 2024 — May 2025'));
  it('vínculo atual PT', () => expect(formatRange('2025-11', null, 'pt')).toBe('nov 2025 — atual'));
  it('vínculo atual EN', () => expect(formatRange('2025-11', null, 'en')).toBe('Nov 2025 — present'));
  it('somente ano', () => expect(formatRange('2018', '2023', 'en')).toBe('2018 — 2023'));
});

describe('roleFor', () => {
  it('escolhe role do perfil', () => {
    const nubank = resume.experience.find((e) => e.company === 'Nubank')!;
    expect(roleFor(nubank, 'software').en).toBe('Senior Software Engineer');
    expect(roleFor(nubank, 'data').en).toBe('Senior Data / AI Engineer');
  });
});

describe('metrics', () => {
  it('papers: 2 no data (CLOSER + SEMISH), 0 no software', () => {
    expect(metrics(data).papers).toBe(2);
    expect(metrics(software).papers).toBe(0);
  });
  it('dois vínculos atuais no data', () => {
    expect(metrics(data).current).toEqual(['Nubank', 'Ministério da Saúde']);
  });
  it('anos de experiência ≥ 5 (desde 2020-08)', () => {
    expect(metrics(data).years).toBeGreaterThanOrEqual(5);
  });
  it('certs conta itens filtrados', () => {
    expect(metrics(software).certs).toBeLessThan(metrics(data).certs);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pnpm test
```
Expected: FAIL — `Cannot find module '../src/lib/resume'`.

- [ ] **Step 3: Implementar `src/lib/resume.ts`**

```ts
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
```

- [ ] **Step 4: Rodar testes até passar**

```bash
pnpm test
```
Expected: todos passam (schema.test.ts + resume.test.ts).

- [ ] **Step 5: Commit**

```bash
git add src/lib/resume.ts tests/resume.test.ts
git commit -m "feat: add resume data lib (filter, i18n, dates, metrics)"
```

---

### Task 4: Identidade CSS + Layout + libs de perfil/UI

**Files:**
- Create: `src/lib/profile.ts`, `src/lib/ui.ts`, `src/styles/tokens.css`, `src/styles/themes/data.css`, `src/styles/themes/software.css`, `src/components/Layout.astro`, `public/favicon.svg`

**Interfaces:**
- Consumes: `type Lang` de `resume.ts`.
- Produces:
  - `PROFILE: Profile` (lido de `process.env.PROFILE`, default `'data'`), `SITES: Record<Profile, string>`, `OTHER: Record<Profile, Profile>`
  - `UI` — dicionário de strings `{en, pt}`; `SKILL_CATEGORY_LABELS`, `groupSkills(skills)`
  - `Layout.astro` — props `{ lang: Lang; title: string; description: string }`; injeta fontes, tokens, temas, SEO (canonical/hreflang/og), scripts de reveal + lang-toggle. Classes globais disponíveis: `.frame`, `.section`, `.sec`, `.num`, `.mono`, `.chip`, `.accent-tag`, `.reveal`, `.btn`.

- [ ] **Step 1: Criar `src/lib/profile.ts`**

```ts
import type { Profile } from './schema';

export const PROFILE: Profile = process.env.PROFILE === 'software' ? 'software' : 'data';

export const SITES: Record<Profile, string> = {
  data: 'https://data.italoguimaraes.dev',
  software: 'https://software.italoguimaraes.dev',
};

export const OTHER: Record<Profile, Profile> = { data: 'software', software: 'data' };
```

- [ ] **Step 2: Criar `src/lib/ui.ts`**

```ts
import type { Skill } from './schema';

export const UI = {
  about: { en: 'ABOUT', pt: 'SOBRE' },
  experience: { en: 'Experience', pt: 'Experiência' },
  research: { en: 'Research', pt: 'Pesquisa' },
  stack: { en: 'Stack', pt: 'Stack' },
  certifications: { en: 'Certifications', pt: 'Certificações' },
  projects: { en: 'Projects', pt: 'Projetos' },
  education: { en: 'Education & Contact', pt: 'Formação & Contato' },
  languages: { en: 'Languages', pt: 'Idiomas' },
  downloadCv: { en: 'Download CV (PDF)', pt: 'Baixar CV (PDF)' },
  showAllCerts: { en: 'show all certifications', pt: 'ver todas as certificações' },
  yearsLabel: { en: 'YEARS OF EXPERIENCE', pt: 'ANOS DE EXPERIÊNCIA' },
  certsLabel: { en: 'CERTIFICATIONS', pt: 'CERTIFICAÇÕES' },
  papersLabel: { en: 'PAPERS ACCEPTED', pt: 'PAPERS ACEITOS' },
  currentLabel: { en: 'currently at', pt: 'atualmente em' },
  seeOther: {
    data: { en: 'see software version ↗', pt: 'ver versão software ↗' },
    software: { en: 'see data version ↗', pt: 'ver versão dados ↗' },
  },
} as const;

export const SKILL_CATEGORY_LABELS: Record<Skill['category'], { en: string; pt: string }> = {
  language: { en: 'Languages', pt: 'Linguagens' },
  processing: { en: 'Data Processing', pt: 'Processamento de Dados' },
  orchestration: { en: 'Orchestration', pt: 'Orquestração' },
  cloud: { en: 'Cloud', pt: 'Cloud' },
  infra: { en: 'Infrastructure', pt: 'Infraestrutura' },
  cicd: { en: 'CI/CD', pt: 'CI/CD' },
  database: { en: 'Databases', pt: 'Bancos de Dados' },
  quality: { en: 'Data Quality', pt: 'Qualidade de Dados' },
  governance: { en: 'Governance', pt: 'Governança' },
  observability: { en: 'Observability', pt: 'Observabilidade' },
  ai: { en: 'AI / Agents', pt: 'IA / Agentes' },
  backend: { en: 'Backend', pt: 'Backend' },
  frontend: { en: 'Frontend', pt: 'Frontend' },
};

export function groupSkills(skills: Skill[]): [Skill['category'], Skill[]][] {
  const order = Object.keys(SKILL_CATEGORY_LABELS) as Skill['category'][];
  return order
    .map((cat): [Skill['category'], Skill[]] => [cat, skills.filter((s) => s.category === cat)])
    .filter(([, items]) => items.length > 0);
}

export const LEVEL_DOTS: Record<Skill['level'], number> = {
  basic: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};
```

- [ ] **Step 3: Criar `src/styles/tokens.css`**

```css
:root {
  --bg: #0a0a0e;
  --surface: #111117;
  --surface-2: #17171f;
  --border: #26262e;
  --text: #f0f0f0;
  --muted: #a1a1aa;
  --faint: #71717a;
  --display: 'Archivo Black', system-ui, sans-serif;
  --body: 'Space Grotesk Variable', system-ui, sans-serif;
  --mono: 'JetBrains Mono Variable', ui-monospace, 'Cascadia Mono', monospace;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; background: var(--bg); }
body { color: var(--text); font-family: var(--body); line-height: 1.6; font-size: 1rem; }
a { color: inherit; }
ul { padding-left: 1.2rem; }
li::marker { color: var(--accent); }

.frame {
  max-width: 1080px;
  margin: 28px auto 56px;
  border: 2px solid var(--border);
  background: var(--surface);
  box-shadow: 12px 12px 0 var(--accent);
}

.section { padding: 64px 56px; border-top: 2px solid var(--border); }
.section:first-of-type { border-top: none; }

.sec {
  font-family: var(--display);
  font-size: clamp(1.5rem, 3.2vw, 2.1rem);
  text-transform: uppercase;
  letter-spacing: -0.02em;
  margin-bottom: 36px;
}
.sec .num { font-family: var(--mono); color: var(--accent); font-size: 0.95rem; vertical-align: super; margin-right: 10px; }

.mono { font-family: var(--mono); font-size: 0.75rem; color: var(--faint); letter-spacing: 0.02em; }

.chip {
  display: inline-block;
  border: 1.5px solid var(--border);
  padding: 2px 10px;
  font-family: var(--mono);
  font-size: 0.72rem;
  color: var(--muted);
}

.accent-tag {
  display: inline-block;
  background: var(--accent);
  color: var(--accent-ink);
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.85rem;
  padding: 5px 14px;
  transform: rotate(-1.2deg);
  box-shadow: 4px 4px 0 var(--border);
}

.btn {
  display: inline-block;
  background: var(--accent);
  color: var(--accent-ink);
  font-weight: 700;
  text-transform: uppercase;
  font-family: var(--mono);
  font-size: 0.8rem;
  padding: 12px 24px;
  text-decoration: none;
  box-shadow: 5px 5px 0 var(--border);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.btn:hover { transform: translate(-2px, -2px); box-shadow: 7px 7px 0 var(--border); }

.reveal { opacity: 0; transform: translateY(14px); transition: opacity 0.5s ease, transform 0.5s ease; }
.reveal.in { opacity: 1; transform: none; }

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .reveal { opacity: 1; transform: none; transition: none; }
  .btn { transition: none; }
}

@media (max-width: 720px) {
  .frame { margin: 12px 12px 32px; box-shadow: 7px 7px 0 var(--accent); }
  .section { padding: 44px 22px; }
}
```

- [ ] **Step 4: Criar temas**

`src/styles/themes/data.css`:
```css
html[data-profile='data'] {
  --accent: #ccff00;
  --accent-ink: #0a0a0e;
}
```

`src/styles/themes/software.css`:
```css
html[data-profile='software'] {
  --accent: #22d3ee;
  --accent-ink: #0a0a0e;
}
```

- [ ] **Step 5: Criar `src/components/Layout.astro`**

```astro
---
import '@fontsource/archivo-black';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import '../styles/tokens.css';
import '../styles/themes/data.css';
import '../styles/themes/software.css';
import { PROFILE, SITES } from '../lib/profile';
import type { Lang } from '../lib/resume';

interface Props {
  lang: Lang;
  title: string;
  description: string;
}
const { lang, title, description } = Astro.props;
const base = SITES[PROFILE];
---

<!doctype html>
<html lang={lang === 'pt' ? 'pt-BR' : 'en'} data-profile={PROFILE}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="canonical" href={`${base}/${lang}/`} />
    <link rel="alternate" hreflang="pt-BR" href={`${base}/pt/`} />
    <link rel="alternate" hreflang="en" href={`${base}/en/`} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="profile" />
    <meta property="og:image" content={`${base}/og-${PROFILE}.png`} />
  </head>
  <body>
    <slot />
    <script>
      document.querySelectorAll<HTMLAnchorElement>('a[data-lang-toggle]').forEach((a) => {
        a.addEventListener('click', () => {
          a.href = a.href.split('#')[0] + location.hash;
        });
      });

      const els = document.querySelectorAll('.reveal');
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        els.forEach((el) => el.classList.add('in'));
      } else {
        const io = new IntersectionObserver(
          (entries) =>
            entries.forEach((e) => {
              if (e.isIntersecting) {
                e.target.classList.add('in');
                io.unobserve(e.target);
              }
            }),
          { threshold: 0.12 },
        );
        els.forEach((el) => io.observe(el));
      }
    </script>
  </body>
</html>
```

- [ ] **Step 6: Criar `public/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#0a0a0e"/>
  <rect x="2" y="2" width="28" height="28" fill="none" stroke="#ccff00" stroke-width="2"/>
  <text x="16" y="22" font-family="monospace" font-size="14" font-weight="bold" fill="#ccff00" text-anchor="middle">IG</text>
</svg>
```

- [ ] **Step 7: Verificar build**

```bash
PROFILE=data pnpm build
```
Expected: sucesso (Layout ainda não é usado por nenhuma página — só compila).

- [ ] **Step 8: Commit**

```bash
git add src/lib/profile.ts src/lib/ui.ts src/styles src/components/Layout.astro public/favicon.svg
git commit -m "feat: add brutalist design tokens, themes, layout and UI strings"
```

---

### Task 5: Marquee + Nav + Hero + páginas /pt e /en (parciais)

**Files:**
- Create: `src/components/Marquee.astro`, `src/components/Nav.astro`, `src/components/Hero.astro`, `src/components/CvPage.astro`, `src/pages/pt.astro`, `src/pages/en.astro`

**Interfaces:**
- Consumes: `Layout` (T4), `UI`/`PROFILE`/`SITES`/`OTHER` (T4), lib de dados (T3).
- Produces:
  - `Marquee` — props `{ items: string[] }`
  - `Nav` — props `{ lang: Lang; sections: { id: string; num: string; label: string }[] }`
  - `Hero` — props `{ lang: Lang; resume: Resume; m: Metrics }`
  - `CvPage` — props `{ lang: Lang }`; monta a página inteira (nesta task: Marquee+Nav+Hero; T6–T8 adicionam o resto). Calcula `sections` dinamicamente: research só entra se `resume.research.length > 0`; numeração `02..` recalculada via `String(i + 2).padStart(2, '0')`.

- [ ] **Step 1: Criar `src/components/Marquee.astro`**

```astro
---
interface Props {
  items: string[];
}
const { items } = Astro.props;
const line = items.join(' ✦ ') + ' ✦ ';
---

<div class="marquee" aria-hidden="true">
  <div class="track"><span>{line.repeat(3)}</span><span>{line.repeat(3)}</span></div>
</div>

<style>
  .marquee {
    background: var(--accent);
    color: var(--accent-ink);
    overflow: hidden;
    white-space: nowrap;
    font-family: var(--mono);
    font-weight: 700;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 6px 0;
  }
  .track { display: inline-flex; }
  .track span { animation: scroll 45s linear infinite; padding-right: 2rem; }
  @keyframes scroll { to { transform: translateX(-100%); } }
  @media (prefers-reduced-motion: reduce) {
    .track span { animation: none; }
  }
</style>
```

- [ ] **Step 2: Criar `src/components/Nav.astro`**

```astro
---
import { PROFILE, SITES, OTHER } from '../lib/profile';
import { UI } from '../lib/ui';
import type { Lang } from '../lib/resume';

interface Props {
  lang: Lang;
  sections: { id: string; num: string; label: string }[];
}
const { lang, sections } = Astro.props;
const other = lang === 'pt' ? 'en' : 'pt';
---

<nav>
  <div class="links">
    {sections.map((s) => (
      <a href={`#${s.id}`}><span class="n">{s.num}</span> {s.label}</a>
    ))}
  </div>
  <div class="meta">
    <a class="cross" href={SITES[OTHER[PROFILE]]}>{UI.seeOther[PROFILE][lang]}</a>
    <span class="toggle">
      [<a data-lang-toggle href="/en/" aria-current={lang === 'en' ? 'page' : undefined}>EN</a
      >|<a data-lang-toggle href="/pt/" aria-current={lang === 'pt' ? 'page' : undefined}>PT</a>]
    </span>
  </div>
</nav>

<style>
  nav {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 10px 24px;
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    backdrop-filter: blur(6px);
    border-bottom: 2px solid var(--border);
    font-family: var(--mono);
    font-size: 0.72rem;
  }
  .links { display: flex; gap: 16px; flex-wrap: wrap; }
  a { text-decoration: none; color: var(--muted); }
  a:hover { color: var(--accent); }
  .n { color: var(--accent); }
  .toggle a[aria-current='page'] { color: var(--accent); font-weight: 700; }
  .cross { color: var(--faint); }
</style>
```

- [ ] **Step 3: Criar `src/components/Hero.astro`**

```astro
---
import { PROFILE } from '../lib/profile';
import { UI } from '../lib/ui';
import { t, type Lang, type Metrics } from '../lib/resume';
import type { Resume } from '../lib/schema';

interface Props {
  lang: Lang;
  resume: Resume;
  m: Metrics;
}
const { lang, resume, m } = Astro.props;
const { basics } = resume;
const parts = basics.name.split(' ');
const first = parts[0];
const last = parts[parts.length - 1];
---

<header class="hero section" id="top">
  <div class="top mono">
    <span>ITALOGUIMARAES.DEV/{PROFILE.toUpperCase()}</span>
    <span>(01) — {UI.about[lang]}</span>
  </div>
  <h1>{first}<br />{last}<span class="dot">.</span></h1>
  <p class="tagline">
    <span class="accent-tag">{t(basics.headline[PROFILE], lang)}</span>
    <span class="mono">@ {m.current.join(' · ')}</span>
  </p>
  <div class="grid reveal">
    <div class="cell">
      <strong>{m.years}+</strong>
      <span class="mono">{UI.yearsLabel[lang]}</span>
    </div>
    <div class="cell">
      <strong>{m.certs}</strong>
      <span class="mono">{UI.certsLabel[lang]}</span>
    </div>
    {m.papers > 0 && (
      <div class="cell">
        <strong>{m.papers}</strong>
        <span class="mono">{UI.papersLabel[lang]}</span>
      </div>
    )}
    <div class="cell">
      <strong class="loc">{t(basics.location, lang)}</strong>
      <span class="mono">{lang === 'pt' ? 'REMOTO · GLOBAL' : 'REMOTE · GLOBAL'}</span>
    </div>
  </div>
</header>

<style>
  .top { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 40px; }
  h1 {
    font-family: var(--display);
    font-size: clamp(3rem, 9vw, 6.5rem);
    line-height: 0.92;
    text-transform: uppercase;
    letter-spacing: -0.03em;
  }
  .dot { color: var(--accent); }
  .tagline { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin: 28px 0 44px; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    border: 2px solid var(--border);
  }
  .cell { padding: 18px 20px; border: 1px solid var(--border); display: flex; flex-direction: column; gap: 4px; }
  .cell strong { font-family: var(--display); font-size: 1.8rem; color: var(--accent); }
  .cell strong.loc { font-size: 1.05rem; color: var(--text); }
</style>
```

- [ ] **Step 4: Criar `src/components/CvPage.astro`** (versão parcial desta task)

```astro
---
import Layout from './Layout.astro';
import Marquee from './Marquee.astro';
import Nav from './Nav.astro';
import Hero from './Hero.astro';
import { PROFILE } from '../lib/profile';
import { UI } from '../lib/ui';
import { loadResume, filterResume, metrics, t, type Lang } from '../lib/resume';

interface Props {
  lang: Lang;
}
const { lang } = Astro.props;

const resume = filterResume(loadResume(), PROFILE);
const m = metrics(resume);

const marqueeItems = [
  t(resume.basics.headline[PROFILE], lang).toUpperCase(),
  ...resume.skills.slice(0, 8).map((s) => s.name),
];

const sections = [
  { id: 'exp', label: UI.experience[lang] },
  ...(resume.research.length > 0 ? [{ id: 'research', label: UI.research[lang] }] : []),
  { id: 'stack', label: UI.stack[lang] },
  { id: 'certs', label: UI.certifications[lang] },
  { id: 'projects', label: UI.projects[lang] },
  { id: 'contact', label: UI.education[lang] },
].map((s, i) => ({ ...s, num: String(i + 2).padStart(2, '0') }));

const num = (id: string) => sections.find((s) => s.id === id)?.num ?? '00';

const title = `Ítalo Guimarães — ${t(resume.basics.headline[PROFILE], lang)}`;
const description = t(resume.basics.headline[PROFILE], lang) + ' · ' + t(resume.basics.location, lang);
---

<Layout lang={lang} title={title} description={description}>
  <div class="frame">
    <Marquee items={marqueeItems} />
    <Nav lang={lang} sections={sections} />
    <Hero lang={lang} resume={resume} m={m} />
    <!-- T6: <Experience/> <Research/> · T7: <Stack/> <Certifications/> <Projects/> · T8: <EducationContact/> -->
    <Marquee items={marqueeItems} />
  </div>
</Layout>
```

- [ ] **Step 5: Criar as páginas**

`src/pages/pt.astro`:
```astro
---
import CvPage from '../components/CvPage.astro';
---

<CvPage lang="pt" />
```

`src/pages/en.astro`:
```astro
---
import CvPage from '../components/CvPage.astro';
---

<CvPage lang="en" />
```

- [ ] **Step 6: Verificar nos dois perfis**

```bash
PROFILE=data pnpm build && grep -c 'ÍTALO\|Ítalo' dist/data/pt/index.html
PROFILE=software pnpm build && grep -o 'data-profile="software"' dist/software/en/index.html
```
Expected: contagem ≥ 1; `data-profile="software"`.

Conferência visual (opcional mas recomendado): `PROFILE=data pnpm dev` → abrir `http://localhost:4321/pt/` — moldura com sombra limão, marquee animado, hero com nome gigante e grid de métricas.

- [ ] **Step 7: Commit**

```bash
git add src/components src/pages/pt.astro src/pages/en.astro
git commit -m "feat: add marquee, nav, hero and partial CV page"
```

---

### Task 6: Experience (com clients) + Research

**Files:**
- Create: `src/components/Experience.astro`, `src/components/Research.astro`
- Modify: `src/components/CvPage.astro` (inserir as duas seções após `<Hero/>`)

**Interfaces:**
- Consumes: `t`, `formatRange`, `roleFor`, `PROFILE`, `UI`.
- Produces: `Experience` — props `{ lang: Lang; items: Resume['experience']; num: string }`; `Research` — props `{ lang: Lang; items: Resume['research']; num: string }`.

- [ ] **Step 1: Criar `src/components/Experience.astro`**

```astro
---
import { PROFILE } from '../lib/profile';
import { UI } from '../lib/ui';
import { t, formatRange, roleFor, type Lang } from '../lib/resume';
import type { Resume } from '../lib/schema';

interface Props {
  lang: Lang;
  items: Resume['experience'];
  num: string;
}
const { lang, items, num } = Astro.props;
---

<section id="exp" class="section">
  <h2 class="sec"><span class="num">{num}</span>{UI.experience[lang]}</h2>
  {items.map((e) => (
    <article class="xp reveal">
      <header>
        <h3>{e.company}</h3>
        <span class="mono">{formatRange(e.start, e.end, lang)}</span>
      </header>
      <p class="role">
        {t(roleFor(e, PROFILE), lang)}
        <span class="mono"> — {t(e.location, lang)}</span>
      </p>
      {e.highlights.length > 0 && <ul>{e.highlights.map((h) => <li>{t(h.text, lang)}</li>)}</ul>}
      {e.clients && (
        <div class="clients">
          {e.clients.map((c) => (
            <div class="client">
              <h4 class="mono">
                {c.name} · {t(c.duration, lang)}
              </h4>
              <ul>{c.highlights.map((h) => <li>{t(h.text, lang)}</li>)}</ul>
            </div>
          ))}
        </div>
      )}
    </article>
  ))}
</section>

<style>
  .xp { border: 2px solid var(--border); background: var(--surface-2); padding: 26px 28px; margin-bottom: 22px; }
  header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  h3 { font-family: var(--display); font-size: 1.15rem; text-transform: uppercase; letter-spacing: 0.01em; }
  .role { font-weight: 600; color: var(--accent); margin: 6px 0 14px; }
  li { color: var(--muted); font-size: 0.92rem; margin-bottom: 6px; }
  .clients { margin-top: 18px; display: grid; gap: 14px; }
  .client { border-left: 3px solid var(--accent); padding: 10px 0 10px 18px; background: var(--surface); }
  .client h4 { color: var(--text); font-size: 0.78rem; margin-bottom: 8px; }
</style>
```

- [ ] **Step 2: Criar `src/components/Research.astro`**

```astro
---
import { UI } from '../lib/ui';
import { t, formatRange, type Lang } from '../lib/resume';
import type { Resume } from '../lib/schema';

interface Props {
  lang: Lang;
  items: Resume['research'];
  num: string;
}
const { lang, items, num } = Astro.props;
---

<section id="research" class="section">
  <h2 class="sec"><span class="num">{num}</span>{UI.research[lang]}</h2>
  {items.map((r) => (
    <article class="paper reveal">
      <header>
        <h3>{t(r.title, lang)}</h3>
        <span class="mono">{formatRange(r.start, r.end, lang)}</span>
      </header>
      <p class="mono inst">{t(r.institution, lang)}</p>
      <ul>{r.highlights.map((h) => <li>{t(h.text, lang)}</li>)}</ul>
    </article>
  ))}
</section>

<style>
  .paper { border: 2px solid var(--accent); background: var(--surface-2); padding: 26px 28px; margin-bottom: 22px; }
  header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  h3 { font-size: 1.05rem; font-weight: 700; }
  .inst { margin: 6px 0 14px; }
  li { color: var(--muted); font-size: 0.92rem; margin-bottom: 6px; }
</style>
```

- [ ] **Step 3: Inserir no `CvPage.astro`** — substituir o comentário `<!-- T6: ... -->` por:

```astro
    <Experience lang={lang} items={resume.experience} num={num('exp')} />
    {resume.research.length > 0 && (
      <Research lang={lang} items={resume.research} num={num('research')} />
    )}
```

E adicionar os imports no frontmatter:

```ts
import Experience from './Experience.astro';
import Research from './Research.astro';
```

(Manter um comentário `<!-- T7/T8 -->` no lugar das seções que ainda faltam.)

- [ ] **Step 4: Verificar**

```bash
PROFILE=data pnpm build && grep -c 'Nubank' dist/data/pt/index.html && grep -c 'id="research"' dist/data/en/index.html
PROFILE=software pnpm build && grep -c 'id="research"' dist/software/en/index.html || true
```
Expected: Nubank ≥ 1; research = 1 no data; **0 no software** (seção omitida). No perfil software também não deve aparecer "A3Data" (`grep -c A3Data dist/software/pt/index.html` → 0).

- [ ] **Step 5: Commit**

```bash
git add src/components/Experience.astro src/components/Research.astro src/components/CvPage.astro
git commit -m "feat: add experience (with client sub-cards) and research sections"
```

---

### Task 7: Stack + Certifications + Projects

**Files:**
- Create: `src/components/Stack.astro`, `src/components/Certifications.astro`, `src/components/Projects.astro`
- Modify: `src/components/CvPage.astro`

**Interfaces:**
- Consumes: `groupSkills`, `SKILL_CATEGORY_LABELS`, `LEVEL_DOTS`, `UI`, `t`, `formatDate`.
- Produces: `Stack` props `{ lang; items: Resume['skills']; num }`; `Certifications` props `{ lang; items: Resume['certifications']; num }` (high+medium visíveis, low em `<details>`); `Projects` props `{ lang; items: Resume['projects']; num }`.

- [ ] **Step 1: Criar `src/components/Stack.astro`**

```astro
---
import { UI, SKILL_CATEGORY_LABELS, groupSkills, LEVEL_DOTS } from '../lib/ui';
import type { Lang } from '../lib/resume';
import type { Resume } from '../lib/schema';

interface Props {
  lang: Lang;
  items: Resume['skills'];
  num: string;
}
const { lang, items, num } = Astro.props;
const groups = groupSkills(items);
---

<section id="stack" class="section">
  <h2 class="sec"><span class="num">{num}</span>{UI.stack[lang]}</h2>
  <div class="cats">
    {groups.map(([cat, skills]) => (
      <div class="cat reveal">
        <h3 class="mono">{SKILL_CATEGORY_LABELS[cat][lang]}</h3>
        <div class="chips">
          {skills.map((s) => (
            <span class="chip" title={s.level}>
              {s.name}
              <span class="lvl" aria-hidden="true">
                {'●'.repeat(LEVEL_DOTS[s.level])}{'○'.repeat(4 - LEVEL_DOTS[s.level])}
              </span>
            </span>
          ))}
        </div>
      </div>
    ))}
  </div>
</section>

<style>
  .cats { display: grid; gap: 24px; }
  .cat h3 { color: var(--accent); text-transform: uppercase; margin-bottom: 10px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip .lvl { color: var(--accent); margin-left: 8px; font-size: 0.6rem; letter-spacing: 2px; }
</style>
```

- [ ] **Step 2: Criar `src/components/Certifications.astro`**

```astro
---
import { UI } from '../lib/ui';
import { t, formatDate, type Lang } from '../lib/resume';
import type { Resume } from '../lib/schema';

interface Props {
  lang: Lang;
  items: Resume['certifications'];
  num: string;
}
const { lang, items, num } = Astro.props;
const featured = items.filter((c) => c.priority !== 'low');
const rest = items.filter((c) => c.priority === 'low');
---

<section id="certs" class="section">
  <h2 class="sec"><span class="num">{num}</span>{UI.certifications[lang]}</h2>
  <div class="grid">
    {featured.map((c) => (
      <div class="cert reveal">
        <strong>{t(c.name, lang)}</strong>
        <span class="mono">
          {c.issuer} · {formatDate(c.issued, lang)}
          {c.expires ? ` → ${formatDate(c.expires, lang)}` : ''}
        </span>
      </div>
    ))}
  </div>
  {rest.length > 0 && (
    <details>
      <summary class="mono">+ {rest.length} — {UI.showAllCerts[lang]}</summary>
      <ul>
        {rest.map((c) => (
          <li>
            {t(c.name, lang)} <span class="mono">— {c.issuer} · {formatDate(c.issued, lang)}</span>
          </li>
        ))}
      </ul>
    </details>
  )}
</section>

<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
  .cert { border: 2px solid var(--border); background: var(--surface-2); padding: 16px 18px; display: flex; flex-direction: column; gap: 6px; }
  .cert strong { font-size: 0.92rem; }
  details { margin-top: 22px; }
  summary { cursor: pointer; color: var(--accent); }
  details ul { margin-top: 12px; }
  details li { color: var(--muted); font-size: 0.88rem; margin-bottom: 4px; }
</style>
```

- [ ] **Step 3: Criar `src/components/Projects.astro`**

```astro
---
import { UI } from '../lib/ui';
import { t, type Lang } from '../lib/resume';
import type { Resume } from '../lib/schema';

interface Props {
  lang: Lang;
  items: Resume['projects'];
  num: string;
}
const { lang, items, num } = Astro.props;
---

<section id="projects" class="section">
  <h2 class="sec"><span class="num">{num}</span>{UI.projects[lang]}</h2>
  <div class="grid">
    {items.map((p) => (
      <article class="proj reveal">
        <h3>{t(p.title, lang)}</h3>
        <p>{t(p.description, lang)}</p>
        <div class="tags">{p.tech.map((tech) => <span class="chip">{tech}</span>)}</div>
        <a class="mono gh" href={p.github} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
      </article>
    ))}
  </div>
</section>

<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
  .proj { border: 2px solid var(--border); background: var(--surface-2); padding: 20px 22px; display: flex; flex-direction: column; gap: 10px; }
  h3 { font-size: 1rem; font-weight: 700; }
  p { color: var(--muted); font-size: 0.9rem; flex: 1; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .gh { color: var(--accent); text-decoration: none; }
  .gh:hover { text-decoration: underline; }
</style>
```

- [ ] **Step 4: Inserir no `CvPage.astro`** (substituir o comentário `<!-- T7/T8 -->`; manter `<!-- T8 -->`):

```astro
    <Stack lang={lang} items={resume.skills} num={num('stack')} />
    <Certifications lang={lang} items={resume.certifications} num={num('certs')} />
    <Projects lang={lang} items={resume.projects} num={num('projects')} />
```

Imports:

```ts
import Stack from './Stack.astro';
import Certifications from './Certifications.astro';
import Projects from './Projects.astro';
```

- [ ] **Step 5: Verificar**

```bash
PROFILE=data pnpm build
grep -c 'Apache Airflow' dist/data/pt/index.html          # ≥ 1
grep -c '<details' dist/data/pt/index.html                # 1 (colapsável de certs low)
PROFILE=software pnpm build
grep -c 'NestJS' dist/software/pt/index.html              # ≥ 1
grep -c 'Delta Lake' dist/software/pt/index.html || true  # 0 (skill só-data)
```

- [ ] **Step 6: Commit**

```bash
git add src/components/Stack.astro src/components/Certifications.astro src/components/Projects.astro src/components/CvPage.astro
git commit -m "feat: add stack, certifications and projects sections"
```

---

### Task 8: EducationContact + página completa

**Files:**
- Create: `src/components/EducationContact.astro`
- Modify: `src/components/CvPage.astro` (última seção; remover comentários placeholder)

**Interfaces:**
- Consumes: `UI`, `t`, `formatRange`, `PROFILE`.
- Produces: `EducationContact` — props `{ lang: Lang; resume: Resume; num: string }`. Botão de PDF: `href={'/pdf/cv-italo-guimaraes-' + PROFILE + '-' + lang + '.pdf'}` (o arquivo só existe após T10 — link pode 404 em dev, é esperado).

- [ ] **Step 1: Criar `src/components/EducationContact.astro`**

```astro
---
import { PROFILE } from '../lib/profile';
import { UI } from '../lib/ui';
import { t, formatRange, type Lang } from '../lib/resume';
import type { Resume } from '../lib/schema';

interface Props {
  lang: Lang;
  resume: Resume;
  num: string;
}
const { lang, resume, num } = Astro.props;
const pdfHref = `/pdf/cv-italo-guimaraes-${PROFILE}-${lang}.pdf`;
---

<section id="contact" class="section">
  <h2 class="sec"><span class="num">{num}</span>{UI.education[lang]}</h2>

  <div class="edu-grid">
    {resume.education.map((e, i) => (
      <div class={`edu reveal ${i === 0 ? 'featured' : ''}`}>
        <strong>{t(e.degree, lang)}</strong>
        {e.field && <p class="field">{t(e.field, lang)}</p>}
        <span class="mono">{t(e.institution, lang)} · {formatRange(e.start, e.end, lang)}</span>
      </div>
    ))}
    <div class="edu reveal">
      <strong>{UI.languages[lang]}</strong>
      <ul class="langs">
        {resume.languages.map((l) => (
          <li>
            {t(l.language, lang)} <span class="mono">— {t(l.level, lang)}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>

  <div class="contact reveal">
    <a class="big" href={`mailto:${resume.basics.email}`}>{resume.basics.email}</a>
    <div class="links mono">
      <a href={resume.basics.links.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>
      <a href={resume.basics.links.github} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
      <span>{resume.basics.phone}</span>
      <span>{t(resume.basics.location, lang)}</span>
    </div>
    <a class="btn" href={pdfHref} download>{UI.downloadCv[lang]} ↓</a>
  </div>
</section>

<style>
  .edu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; margin-bottom: 40px; }
  .edu { border: 2px solid var(--border); background: var(--surface-2); padding: 18px 20px; display: flex; flex-direction: column; gap: 6px; }
  .edu.featured { border-color: var(--accent); }
  .edu strong { font-size: 0.95rem; }
  .field { color: var(--muted); font-size: 0.85rem; }
  .langs { list-style: none; padding: 0; }
  .langs li { font-size: 0.9rem; margin-bottom: 4px; }
  .contact { display: flex; flex-direction: column; gap: 18px; align-items: flex-start; border: 2px solid var(--border); padding: 28px; background: var(--surface-2); }
  .big { font-family: var(--display); font-size: clamp(1.1rem, 3vw, 1.8rem); color: var(--accent); text-decoration: none; word-break: break-all; }
  .big:hover { text-decoration: underline; }
  .links { display: flex; gap: 20px; flex-wrap: wrap; }
  .links a { color: var(--muted); }
  .links a:hover { color: var(--accent); }
</style>
```

- [ ] **Step 2: Completar `CvPage.astro`** — substituir `<!-- T8 -->` por:

```astro
    <EducationContact lang={lang} resume={resume} num={num('contact')} />
```

Import: `import EducationContact from './EducationContact.astro';`

O corpo final do `<Layout>` fica:

```astro
<Layout lang={lang} title={title} description={description}>
  <div class="frame">
    <Marquee items={marqueeItems} />
    <Nav lang={lang} sections={sections} />
    <Hero lang={lang} resume={resume} m={m} />
    <Experience lang={lang} items={resume.experience} num={num('exp')} />
    {resume.research.length > 0 && (
      <Research lang={lang} items={resume.research} num={num('research')} />
    )}
    <Stack lang={lang} items={resume.skills} num={num('stack')} />
    <Certifications lang={lang} items={resume.certifications} num={num('certs')} />
    <Projects lang={lang} items={resume.projects} num={num('projects')} />
    <EducationContact lang={lang} resume={resume} num={num('contact')} />
    <Marquee items={marqueeItems} />
  </div>
</Layout>
```

- [ ] **Step 3: Verificar página completa nos 4 alvos**

```bash
PROFILE=data pnpm build && PROFILE=software pnpm build
for f in dist/data/pt dist/data/en dist/software/pt dist/software/en; do
  grep -l 'id="contact"' $f/index.html && grep -l 'cv-italo-guimaraes' $f/index.html
done
```
Expected: os 4 arquivos listados duas vezes (têm seção contact e link de PDF).

Conferência visual: `PROFILE=data pnpm dev` e `PROFILE=software pnpm dev` — página completa, numeração correta (no software, stack = 03 pois research não existe).

- [ ] **Step 4: Commit**

```bash
git add src/components/EducationContact.astro src/components/CvPage.astro
git commit -m "feat: complete CV page with education, languages and contact"
```

---

### Task 9: Layout de impressão (/print/pt e /print/en)

**Files:**
- Create: `src/components/PrintPage.astro`, `src/pages/print/pt.astro`, `src/pages/print/en.astro`

**Interfaces:**
- Consumes: lib de dados completa, `UI`, `SKILL_CATEGORY_LABELS`, `groupSkills`, `PROFILE`.
- Produces: rotas `/print/pt/` e `/print/en/` — layout claro, A4, ATS-friendly (texto real, sem decoração), certificações `low` EXCLUÍDAS. Consumido por T10 (Playwright).

- [ ] **Step 1: Criar `src/components/PrintPage.astro`**

```astro
---
import { PROFILE } from '../lib/profile';
import { UI, SKILL_CATEGORY_LABELS, groupSkills } from '../lib/ui';
import {
  loadResume, filterResume, t, formatRange, formatDate, roleFor, type Lang,
} from '../lib/resume';

interface Props {
  lang: Lang;
}
const { lang } = Astro.props;
const r = filterResume(loadResume(), PROFILE);
const certs = r.certifications.filter((c) => c.priority !== 'low');
const skillGroups = groupSkills(r.skills);
---

<!doctype html>
<html lang={lang === 'pt' ? 'pt-BR' : 'en'}>
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <title>{r.basics.name} — CV</title>
  </head>
  <body>
    <header>
      <h1>{r.basics.name}</h1>
      <p class="headline">{t(r.basics.headline[PROFILE], lang)}</p>
      <p class="contact">
        {r.basics.email} · {r.basics.phone} · {t(r.basics.location, lang)} ·
        {r.basics.links.linkedin.replace('https://', '')} · {r.basics.links.github.replace('https://', '')}
      </p>
    </header>

    <h2>{UI.experience[lang]}</h2>
    {r.experience.map((e) => (
      <section class="entry">
        <div class="line">
          <strong>{t(roleFor(e, PROFILE), lang)} — {e.company}</strong>
          <span>{formatRange(e.start, e.end, lang)}</span>
        </div>
        <p class="loc">{t(e.location, lang)}</p>
        <ul>
          {e.highlights.map((h) => <li>{t(h.text, lang)}</li>)}
          {e.clients?.flatMap((c) =>
            c.highlights.map((h) => <li><em>{c.name}:</em> {t(h.text, lang)}</li>)
          )}
        </ul>
      </section>
    ))}

    {r.research.length > 0 && (
      <>
        <h2>{UI.research[lang]}</h2>
        {r.research.map((x) => (
          <section class="entry">
            <div class="line">
              <strong>{t(x.title, lang)}</strong>
              <span>{formatRange(x.start, x.end, lang)}</span>
            </div>
            <p class="loc">{t(x.institution, lang)}</p>
            <ul>{x.highlights.map((h) => <li>{t(h.text, lang)}</li>)}</ul>
          </section>
        ))}
      </>
    )}

    <h2>{lang === 'pt' ? 'Formação' : 'Education'}</h2>
    {r.education.map((e) => (
      <section class="entry">
        <div class="line">
          <strong>{t(e.degree, lang)}{e.field ? ` — ${t(e.field, lang)}` : ''}</strong>
          <span>{formatRange(e.start, e.end, lang)}</span>
        </div>
        <p class="loc">{t(e.institution, lang)}</p>
      </section>
    ))}

    <h2>{UI.certifications[lang]}</h2>
    <ul class="flat">
      {certs.map((c) => (
        <li>{t(c.name, lang)} — {c.issuer}, {formatDate(c.issued, lang)}</li>
      ))}
    </ul>

    <h2>{UI.stack[lang]}</h2>
    {skillGroups.map(([cat, skills]) => (
      <p class="skills">
        <strong>{SKILL_CATEGORY_LABELS[cat][lang]}:</strong> {skills.map((s) => s.name).join(', ')}
      </p>
    ))}

    <h2>{UI.languages[lang]}</h2>
    <ul class="flat">
      {r.languages.map((l) => (
        <li>{t(l.language, lang)} — {t(l.level, lang)}</li>
      ))}
    </ul>
  </body>
</html>

<style is:global>
  @page { size: A4; margin: 13mm 15mm; }
  * { box-sizing: border-box; margin: 0; }
  body { font: 9.5pt/1.42 'Helvetica Neue', Arial, sans-serif; color: #111; }
  header { margin-bottom: 12pt; }
  h1 { font-size: 17pt; letter-spacing: -0.02em; }
  .headline { font-size: 11pt; font-weight: 600; margin-top: 2pt; }
  .contact { font-size: 8.5pt; color: #444; margin-top: 4pt; }
  h2 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1pt solid #111; margin: 12pt 0 6pt; padding-bottom: 2pt; }
  .entry { margin-bottom: 8pt; break-inside: avoid; }
  .line { display: flex; justify-content: space-between; gap: 8pt; }
  .line span { white-space: nowrap; color: #444; font-size: 8.5pt; }
  .loc { font-size: 8.5pt; color: #666; margin: 1pt 0 3pt; }
  ul { padding-left: 12pt; }
  li { margin-bottom: 2pt; }
  .flat { list-style: none; padding: 0; }
  .flat li { margin-bottom: 1.5pt; }
  .skills { margin-bottom: 3pt; }
  em { font-style: normal; font-weight: 600; }
</style>
```

- [ ] **Step 2: Criar as páginas**

`src/pages/print/pt.astro`:
```astro
---
import PrintPage from '../../components/PrintPage.astro';
---

<PrintPage lang="pt" />
```

`src/pages/print/en.astro`:
```astro
---
import PrintPage from '../../components/PrintPage.astro';
---

<PrintPage lang="en" />
```

- [ ] **Step 3: Verificar**

```bash
PROFILE=data pnpm build
grep -c 'Nubank' dist/data/print/pt/index.html    # ≥ 1
grep -c 'freeCodeCamp' dist/data/print/en/index.html || true  # 0 — certs low fora do print
```

- [ ] **Step 4: Commit**

```bash
git add src/components/PrintPage.astro src/pages/print
git commit -m "feat: add ATS-friendly print layout for PDF generation"
```

---

### Task 10: Geração de PDF (Playwright)

**Files:**
- Create: `scripts/generate-pdf.mjs`

**Interfaces:**
- Consumes: `dist/<profile>/print/{en,pt}/index.html` (T9).
- Produces: `dist/<profile>/pdf/cv-italo-guimaraes-<profile>-<lang>.pdf` (4 arquivos no total, 2 por invocação). Uso: `node scripts/generate-pdf.mjs <data|software>`.

- [ ] **Step 1: Instalar browser do Playwright**

```bash
pnpm exec playwright install chromium
```

- [ ] **Step 2: Criar `scripts/generate-pdf.mjs`**

```js
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const profile = process.argv[2];
if (!['data', 'software'].includes(profile)) {
  console.error('usage: node scripts/generate-pdf.mjs <data|software>');
  process.exit(1);
}

const root = join('dist', profile);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  try {
    const body = await readFile(join(root, pathname));
    res.setHeader('content-type', TYPES[extname(pathname)] ?? 'application/octet-stream');
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
});
await new Promise((resolve) => server.listen(0, resolve));
const { port } = server.address();

await mkdir(join(root, 'pdf'), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();

for (const lang of ['en', 'pt']) {
  await page.goto(`http://localhost:${port}/print/${lang}/`, { waitUntil: 'networkidle' });
  const out = join(root, 'pdf', `cv-italo-guimaraes-${profile}-${lang}.pdf`);
  await page.pdf({ path: out, format: 'A4', printBackground: true });
  console.log(`✔ ${out}`);
}

await browser.close();
server.close();
```

- [ ] **Step 3: Rodar e verificar**

```bash
PROFILE=data pnpm build && node scripts/generate-pdf.mjs data
PROFILE=software pnpm build && node scripts/generate-pdf.mjs software
ls -la dist/data/pdf dist/software/pdf
```
Expected: 4 PDFs (`cv-italo-guimaraes-data-en.pdf`, `-data-pt.pdf`, `-software-en.pdf`, `-software-pt.pdf`), cada um > 20 KB. Abrir um deles e conferir: ~2 páginas A4, texto selecionável, sem certificações low.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-pdf.mjs
git commit -m "feat: add build-time PDF generation via Playwright"
```

---

### Task 11: Smoke-check pós-build

**Files:**
- Create: `scripts/smoke-check.mjs`

**Interfaces:**
- Consumes: `dist/{data,software}/{pt,en}/index.html` + `dist/*/pdf/*.pdf`.
- Produces: exit 0 (tudo ok) ou exit 1 listando falhas. Uso: `node scripts/smoke-check.mjs` (roda no CI após builds+PDFs).

- [ ] **Step 1: Criar `scripts/smoke-check.mjs`**

```js
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

let failed = false;
const check = (ok, msg) => {
  console.log(`${ok ? '✔' : '✘'} ${msg}`);
  if (!ok) failed = true;
};

for (const profile of ['data', 'software']) {
  for (const lang of ['pt', 'en']) {
    const htmlPath = join('dist', profile, lang, 'index.html');
    const html = await readFile(htmlPath, 'utf8').catch(() => null);
    check(html !== null, `${htmlPath} existe`);
    if (!html) continue;

    check(html.includes('Guimarães'), `${htmlPath} contém o nome`);
    check(html.includes('id="exp"'), `${htmlPath} tem seção de experiência`);
    check(html.includes(`data-profile="${profile}"`), `${htmlPath} tem o tema ${profile}`);

    const pdfLink = `/pdf/cv-italo-guimaraes-${profile}-${lang}.pdf`;
    check(html.includes(pdfLink), `${htmlPath} aponta para ${pdfLink}`);

    const pdfFile = join('dist', profile, 'pdf', `cv-italo-guimaraes-${profile}-${lang}.pdf`);
    const pdfOk = await stat(pdfFile).then((s) => s.size > 10_000).catch(() => false);
    check(pdfOk, `${pdfFile} existe e tem tamanho razoável`);
  }
}

process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Rodar (com os builds e PDFs da T10 ainda em disco)**

```bash
node scripts/smoke-check.mjs
```
Expected: 20 linhas `✔`, exit 0. Testar falha: `rm dist/data/pdf/cv-italo-guimaraes-data-en.pdf && node scripts/smoke-check.mjs; echo "exit=$?"` → exit=1. Regenerar: `node scripts/generate-pdf.mjs data`.

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke-check.mjs
git commit -m "feat: add post-build smoke check"
```

---

### Task 12: Worker + configs Wrangler

**Files:**
- Create: `worker/index.js`, `wrangler.data.jsonc`, `wrangler.software.jsonc`

**Interfaces:**
- Consumes: `dist/<profile>/` como diretório de assets.
- Produces: Workers `cv-data` e `cv-software`; `/` redireciona por Accept-Language (en antes de pt no header → `/en/`, senão `/pt/`); resto servido como asset estático.

- [ ] **Step 1: Criar `worker/index.js`**

```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      const al = (request.headers.get('accept-language') ?? '').toLowerCase();
      const en = al.indexOf('en');
      const pt = al.indexOf('pt');
      const lang = en !== -1 && (pt === -1 || en < pt) ? 'en' : 'pt';
      return Response.redirect(`${url.origin}/${lang}/`, 302);
    }
    return env.ASSETS.fetch(request);
  },
};
```

- [ ] **Step 2: Criar `wrangler.data.jsonc`**

```jsonc
{
  "name": "cv-data",
  "main": "worker/index.js",
  "compatibility_date": "2026-07-01",
  "assets": {
    "directory": "./dist/data",
    "binding": "ASSETS",
    "run_worker_first": ["/"]
  },
  "routes": [{ "pattern": "data.italoguimaraes.dev", "custom_domain": true }]
}
```

- [ ] **Step 3: Criar `wrangler.software.jsonc`**

```jsonc
{
  "name": "cv-software",
  "main": "worker/index.js",
  "compatibility_date": "2026-07-01",
  "assets": {
    "directory": "./dist/software",
    "binding": "ASSETS",
    "run_worker_first": ["/"]
  },
  "routes": [{ "pattern": "software.italoguimaraes.dev", "custom_domain": true }]
}
```

- [ ] **Step 4: Testar localmente com wrangler dev**

```bash
PROFILE=data pnpm build
pnpm exec wrangler dev --config wrangler.data.jsonc --port 8787 &
sleep 5
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -H 'Accept-Language: en-US,en;q=0.9' http://localhost:8787/
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -H 'Accept-Language: pt-BR,pt;q=0.9,en;q=0.5' http://localhost:8787/
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8787/pt/
kill %1
```
Expected: `302 http://localhost:8787/en/`, `302 http://localhost:8787/pt/`, `200`.

- [ ] **Step 5: Commit**

```bash
git add worker wrangler.data.jsonc wrangler.software.jsonc
git commit -m "feat: add Cloudflare Workers with language redirect and static assets"
```

---

### Task 13: GitHub Actions — deploy

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: todos os scripts anteriores; secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` (configurados na T14).
- Produces: pipeline completo push→deploy na branch `main`.

- [ ] **Step 1: Criar `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Validate resume.yaml
        run: pnpm check

      - name: Unit tests
        run: pnpm test

      - name: Install Playwright browser
        run: pnpm exec playwright install --with-deps chromium

      - name: Build (data)
        run: pnpm build
        env: { PROFILE: data }

      - name: Build (software)
        run: pnpm build
        env: { PROFILE: software }

      - name: Generate PDFs
        run: |
          node scripts/generate-pdf.mjs data
          node scripts/generate-pdf.mjs software

      - name: Smoke check
        run: node scripts/smoke-check.mjs

      - name: Deploy data.italoguimaraes.dev
        run: pnpm exec wrangler deploy --config wrangler.data.jsonc
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Deploy software.italoguimaraes.dev
        run: pnpm exec wrangler deploy --config wrangler.software.jsonc
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 2: Validar sintaxe rodando os passos locais equivalentes**

```bash
pnpm check && pnpm test && PROFILE=data pnpm build && PROFILE=software pnpm build \
  && node scripts/generate-pdf.mjs data && node scripts/generate-pdf.mjs software \
  && node scripts/smoke-check.mjs && echo "PIPELINE OK"
```
Expected: `PIPELINE OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add build, test, PDF and Cloudflare deploy pipeline"
```

---

### Task 14: OG images, README e setup Cloudflare

**Files:**
- Create: `scripts/generate-og.mjs`, `public/og-data.png`, `public/og-software.png`
- Modify: `README.md` (reescrever)

**Interfaces:**
- Consumes: builds de T8; padrão de servidor estático de T10.
- Produces: OG images 1200×630 commitadas; README com instruções de manutenção; checklist de setup manual do Cloudflare para o usuário executar.

- [ ] **Step 1: Criar `scripts/generate-og.mjs`**

```js
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const profile = process.argv[2];
if (!['data', 'software'].includes(profile)) {
  console.error('usage: node scripts/generate-og.mjs <data|software>');
  process.exit(1);
}

const root = join('dist', profile);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  try {
    const body = await readFile(join(root, pathname));
    res.setHeader('content-type', TYPES[extname(pathname)] ?? 'application/octet-stream');
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
});
await new Promise((resolve) => server.listen(0, resolve));
const { port } = server.address();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(`http://localhost:${port}/pt/`, { waitUntil: 'networkidle' });
await page.screenshot({ path: `public/og-${profile}.png` });
console.log(`✔ public/og-${profile}.png`);
await browser.close();
server.close();
```

- [ ] **Step 2: Gerar as duas imagens (uma vez, commitadas)**

```bash
PROFILE=data pnpm build && node scripts/generate-og.mjs data
PROFILE=software pnpm build && node scripts/generate-og.mjs software
ls -la public/og-*.png
```
Expected: dois PNGs 1200×630.

- [ ] **Step 3: Reescrever `README.md`**

```markdown
# CV — italoguimaraes.dev

Fonte única de dados → dois CVs bilíngues:

| Site | Perfil | Acento |
| --- | --- | --- |
| [data.italoguimaraes.dev](https://data.italoguimaraes.dev) | Engenharia de Dados | verde-limão |
| [software.italoguimaraes.dev](https://software.italoguimaraes.dev) | Engenharia de Software | ciano |

## Como atualizar o CV

1. Edite **`content/resume.yaml`** (única fonte da verdade — EN e PT lado a lado,
   `profiles: [data, software]` controla onde cada item aparece).
2. `pnpm check` para validar.
3. `git push` na `main` — o CI valida, builda os dois sites, gera os 4 PDFs e deploya.
4. (Manual) Atualize o LinkedIn usando o YAML como referência.

## Desenvolvimento

    pnpm install
    PROFILE=data pnpm dev        # ou PROFILE=software
    pnpm test                    # unit tests da lib de dados
    pnpm check                   # valida o resume.yaml

## Pipeline

`pnpm check` → `pnpm test` → build ×2 → PDFs (Playwright) → smoke-check → `wrangler deploy` ×2

Specs e planos em `docs/superpowers/`.
```

- [ ] **Step 4: Setup manual do Cloudflare (executar com o usuário — só na primeira vez)**

Instruções para o usuário (não são código do repo):

1. **API Token**: Cloudflare Dashboard → My Profile → API Tokens → Create Token → template "Edit Cloudflare Workers". Copiar o token.
2. **Account ID**: Dashboard → Workers & Pages → Account ID (barra lateral direita).
3. **Secrets no GitHub**: repo → Settings → Secrets and variables → Actions → adicionar `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
4. **Primeiro deploy**: push na `main` (ou `workflow_dispatch`). O `wrangler deploy` cria os Workers `cv-data` e `cv-software` e, via `routes.custom_domain`, registra `data.italoguimaraes.dev` e `software.italoguimaraes.dev` automaticamente (o domínio já está na Cloudflare).
5. Verificar: `curl -I https://data.italoguimaraes.dev/` → 302 para `/pt/` ou `/en/`.

- [ ] **Step 5: Verificação final completa**

```bash
pnpm check && pnpm test \
  && PROFILE=data pnpm build && PROFILE=software pnpm build \
  && node scripts/generate-pdf.mjs data && node scripts/generate-pdf.mjs software \
  && node scripts/smoke-check.mjs && echo "ALL GREEN"
```
Expected: `ALL GREEN`.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-og.mjs public/og-data.png public/og-software.png README.md
git commit -m "docs: add OG images, rewrite README with maintenance workflow"
```

---

## Self-Review (executado na escrita do plano)

- **Cobertura do spec:** limpeza legado (T1), schema+check (T2), lib filtro/i18n/datas/métricas (T3), tokens/temas/layout/SEO/hreflang/og/reduced-motion (T4), marquee/nav/hero/toggle idioma (T5), experiência com clients + research condicional (T6), stack/certs com priority/projetos (T7), formação+idiomas+contato+botão PDF (T8), print ATS sem certs low (T9), 4 PDFs nomeados conforme spec (T10), smoke 4 páginas+PDFs (T11), Workers+redirect Accept-Language+custom domains (T12), CI completo (T13), OG/README/setup manual Cloudflare (T14). Rollback = versões de Worker no painel (não requer código).
- **Placeholders:** nenhum TBD/TODO; todo step de código tem o código.
- **Consistência de tipos:** `t/filterResume/formatRange/formatDate/roleFor/metrics/loadResume` (T3) usados com as mesmas assinaturas em T5–T9; `Metrics.{years,certs,papers,current}`; ids `exp/research/stack/certs/projects/contact` idênticos em Nav/CvPage/smoke-check; nomes de PDF idênticos em EducationContact/generate-pdf/smoke-check.
