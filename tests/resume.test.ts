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
