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
