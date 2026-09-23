import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base, testMatch: 'v2_cart.spec.ts', timeout: 90_000 });
