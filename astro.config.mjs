import { defineConfig } from 'astro/config';

const profile = process.env.PROFILE === 'software' ? 'software' : 'data';

export default defineConfig({
  site: profile === 'data'
    ? 'https://data.italoguimaraes.com'
    : 'https://software.italoguimaraes.com',
  outDir: `./dist/${profile}`,
});
