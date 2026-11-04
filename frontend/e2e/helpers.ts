import { expect, type Page } from '@playwright/test';

/** Larguras obrigatórias de toda tela: celular, tablet e desktop. */
export const WIDTHS = [360, 768, 1280] as const;

/**
 * Falha se a página rolar para os lados em qualquer uma das larguras.
 */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));

    expect(
      overflow.scrollWidth,
      `rolagem horizontal em ${String(width)} px (scrollWidth ${String(overflow.scrollWidth)} > innerWidth ${String(overflow.innerWidth)})`,
    ).toBeLessThanOrEqual(overflow.innerWidth);
  }
}

/** Força um tema no documento, como o ThemeProvider faria. */
export async function setTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.evaluate((value) => {
    document.documentElement.dataset.theme = value;
    window.localStorage.setItem('azuos-env:theme', value);
  }, theme);
}
