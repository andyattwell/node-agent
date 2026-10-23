import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_BASE =
  process.env.PLAYWRIGHT_OUTPUT_DIR
    ? path.join(process.env.PLAYWRIGHT_OUTPUT_DIR, 'React_Vite_App_Loads')
    : path.join(process.cwd(), 'playwright-output', 'React_Vite_App_Loads');

test.describe('React + Vite app', () => {
  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOT_BASE, { recursive: true });
  });

  test('loads at base URL and shows Vite + React heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('Vite + React');
    await page.screenshot({
      path: path.join(SCREENSHOT_BASE, '01_homepage_loaded.png'),
    });
  });

  test('counter button is visible and increments', async ({ page }) => {
    await page.goto('/');
    const button = page.getByRole('button', { name: /count is \d+/ });
    await expect(button).toBeVisible();
    await expect(button).toHaveText('count is 0');
    await button.click();
    await expect(button).toHaveText('count is 1');
    await page.screenshot({
      path: path.join(SCREENSHOT_BASE, '02_counter_clicked.png'),
    });
  });
});
