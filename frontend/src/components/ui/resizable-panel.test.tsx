import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PanelResizer, usePanelSize } from '@/components/ui/resizable-panel';
import type { PanelSide } from '@/lib/panel-store';

function Harness({ side = 'left' }: { side?: PanelSide }) {
  const panel = usePanelSize({
    id: 'teste',
    label: 'a barra de teste',
    side,
    defaultWidth: 280,
    min: 220,
    max: 480,
  });

  return (
    <div>
      {panel.collapsed ? null : (
        <aside aria-label="Barra de teste" style={{ width: panel.width }}>
          conteúdo
        </aside>
      )}
      <PanelResizer panel={panel} />
    </div>
  );
}

function separator(): HTMLElement {
  return screen.getByRole('separator', { name: 'Redimensionar a barra de teste' });
}

describe('PanelResizer', () => {
  it('mede a barra pelo teclado, respeitando os limites', async () => {
    const user = userEvent.setup();

    render(<Harness />);
    expect(separator()).toHaveAttribute('aria-valuenow', '280');

    separator().focus();
    await user.keyboard('{ArrowRight}');
    expect(separator()).toHaveAttribute('aria-valuenow', '296');
    expect(screen.getByLabelText('Barra de teste')).toHaveStyle({ width: '296px' });

    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(separator()).toHaveAttribute('aria-valuenow', '248');

    await user.keyboard('{End}');
    expect(separator()).toHaveAttribute('aria-valuenow', '480');

    await user.keyboard('{Home}');
    expect(separator()).toHaveAttribute('aria-valuenow', '220');
  });

  it('inverte as setas na barra da direita', async () => {
    const user = userEvent.setup();

    render(<Harness side="right" />);
    separator().focus();
    await user.keyboard('{ArrowRight}');

    expect(separator()).toHaveAttribute('aria-valuenow', '264');
  });

  it('oculta e mostra a barra pelo botão, lembrando no localStorage', async () => {
    const user = userEvent.setup();

    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Ocultar a barra de teste' }));

    expect(screen.queryByLabelText('Barra de teste')).not.toBeInTheDocument();
    expect(separator()).toHaveAttribute('aria-valuetext', 'Oculta');
    await waitFor(() => {
      expect(window.localStorage.getItem('azuos-env:panel:teste')).toContain('"collapsed":true');
    });

    await user.click(screen.getByRole('button', { name: 'Mostrar a barra de teste' }));
    expect(screen.getByLabelText('Barra de teste')).toBeInTheDocument();
  });

  it('Enter na alça também oculta a barra', async () => {
    const user = userEvent.setup();

    render(<Harness />);
    separator().focus();
    await user.keyboard('{Enter}');

    expect(screen.queryByLabelText('Barra de teste')).not.toBeInTheDocument();
  });

  it('volta ao padrão no clique duplo', async () => {
    const user = userEvent.setup();

    render(<Harness />);
    separator().focus();
    await user.keyboard('{End}');
    expect(separator()).toHaveAttribute('aria-valuenow', '480');

    await user.dblClick(separator());
    expect(separator()).toHaveAttribute('aria-valuenow', '280');
  });
});
