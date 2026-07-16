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
