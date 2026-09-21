import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const widgetPath = path.resolve(here, '../../frontend/public/widget.js');

function cssRgb(hex: string): string {
  return `rgb(${Number.parseInt(hex.slice(1, 3), 16)}, ${Number.parseInt(hex.slice(3, 5), 16)}, ${Number.parseInt(hex.slice(5, 7), 16)})`;
}

async function mountWidget(
  page: Page,
  config: { accentColor: string; widgetTextColor: string | null },
) {
  await page.route('https://suppuo.test/api/v1/public/widget-config?**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: { hideBranding: false, ...config } }),
    }),
  );
  await page.setContent(
    '<main style="background:white;min-height:100vh"></main>' +
      '<script data-suppuo-account="acc_test" data-suppuo-base="https://suppuo.test"></script>',
  );
  const source = await readFile(widgetPath, 'utf8');
  await page.evaluate((widgetSource) => {
    // The production file is a classic self-contained embed script.
    (0, eval)(widgetSource);
  }, source);
  const tab = page.getByRole('button', { name: 'Open support chat' });
  await expect(tab).toBeVisible();
  await expect(tab).toHaveCSS('background-color', cssRgb(config.accentColor));
  return tab;
}

test('widget automatically uses black foreground on a light accent', async ({ page }) => {
  const tab = await mountWidget(page, { accentColor: '#f5e942', widgetTextColor: null });
  await expect(tab).toHaveCSS('color', 'rgb(0, 0, 0)');
});

test('widget automatically uses white foreground on a dark accent', async ({ page }) => {
  const tab = await mountWidget(page, { accentColor: '#172554', widgetTextColor: null });
  await expect(tab).toHaveCSS('color', 'rgb(255, 255, 255)');
});

test('widget honors the portal foreground override', async ({ page }) => {
  const tab = await mountWidget(page, { accentColor: '#f5e942', widgetTextColor: '#123456' });
  await expect(tab).toHaveCSS('color', 'rgb(18, 52, 86)');
});
