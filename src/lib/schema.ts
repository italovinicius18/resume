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
