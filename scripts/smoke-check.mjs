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
