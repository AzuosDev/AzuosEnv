import { useEffect, useState } from 'react';

/**
 * Verdadeiro quando a janela tem pelo menos essa largura. Vai por matchMedia e
 * não por classe do Tailwind, porque a decisão precisa existir em JS: é ela que
 * escolhe entre dois desenhos diferentes (grade ou agenda, tabela ou cartões).
 */
export function useMinWidth(px: number): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= px,
  );

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${String(px)}px)`);
    const onChange = (): void => {
      setMatches(query.matches);
    };

    onChange();
    query.addEventListener('change', onChange);

    return () => {
      query.removeEventListener('change', onChange);
    };
  }, [px]);

  return matches;
}
