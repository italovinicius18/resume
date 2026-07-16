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
