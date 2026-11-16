import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { defineConfig } from 'astro/config';

if (existsSync('.env')) loadEnvFile('.env');

export default defineConfig({
  site: process.env.SITE_URL || undefined,
  i18n: { defaultLocale: 'es', locales: ['es', 'en'] },
  trailingSlash: 'always',
});
