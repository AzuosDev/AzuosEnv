import { useEffect, useState } from 'react';
import { paletteFrom, type ChartPalette } from '../chart-palette';

function readPalette(): ChartPalette {
  if (typeof window === 'undefined') {
    return paletteFrom(() => '');
  }

  const style = window.getComputedStyle(document.documentElement);

  return paletteFrom((token) => style.getPropertyValue(token));
}

/**
 * Cores dos gráficos lidas dos tokens do tema, relidas quando o data-theme do
 * html muda — é assim que o mesmo card fica certo no claro e no escuro.
 */
export function useChartPalette(): ChartPalette {
  const [palette, setPalette] = useState(readPalette);

  useEffect(() => {
    const update = (): void => {
      setPalette(readPalette());
    };

    update();

    const observer = new MutationObserver(update);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });

    const media = window.matchMedia('(prefers-color-scheme: dark)');

    media.addEventListener('change', update);

    return () => {
      observer.disconnect();
      media.removeEventListener('change', update);
    };
  }, []);

  return palette;
}
