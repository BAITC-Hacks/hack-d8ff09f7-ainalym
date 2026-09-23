import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base, testMatch: 'uxfix_c.spec.ts', timeout: 60_000, projects: [{ name: 'desktop', use: { viewport: { width: 1440, height: 900 } } }] });
