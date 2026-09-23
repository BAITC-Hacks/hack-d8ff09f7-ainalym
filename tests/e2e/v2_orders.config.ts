import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base, testMatch: 'v2_orders.spec.ts', projects: [{ name: 'desktop', use: { viewport: { width: 1440, height: 900 } } }] });
