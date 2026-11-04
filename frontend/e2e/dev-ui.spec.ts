import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, setTheme } from './helpers';

const THEMES = ['dark', 'light'] as const;

test.describe('/_dev/ui', () => {
  for (const theme of THEMES) {
    test(`catálogo no tema ${theme} nas 3 larguras`, async ({ page }) => {
      await page.goto('/_dev/ui');
      await setTheme(page, theme);

      await expect(page.getByRole('heading', { name: 'Catálogo de componentes' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expectNoHorizontalScroll(page);
    });
  }

  test('o seletor de tema troca o data-theme do html', async ({ page }) => {
    await page.goto('/_dev/ui');

    await page.getByRole('button', { name: 'Claro' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.getByRole('button', { name: 'Escuro' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('o diálogo abre e fecha', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto('/_dev/ui');

    await page.getByRole('button', { name: 'Abrir diálogo' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.getByRole('button', { name: 'Fechar' }).first().click();
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});
