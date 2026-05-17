// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://rjaychen.github.io',
  output: 'static',
  compressHTML: true,
  trailingSlash: 'always',
});
