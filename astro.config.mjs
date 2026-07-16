import { defineConfig } from 'astro/config';

const profile = process.env.PROFILE === 'software' ? 'software' : 'data';

export default defineConfig({
  site: profile === 'data'
    ? 'https://data.italoguimaraes.dev'
    : 'https://software.italoguimaraes.dev',
  outDir: `./dist/${profile}`,
});
