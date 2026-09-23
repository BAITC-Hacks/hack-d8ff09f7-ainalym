import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base, testMatch: 'v2_review.spec.ts', timeout: 40_000, projects: [{ name: 'desktop', use: { viewport: { width: 1440, height: 900 } } }] });
