/**
 * Lugar do timer ativo na topbar. O cronômetro entra aqui na etapa dos
 * Timesheets; até lá o espaço fica reservado e nada é desenhado.
 */
export function TimerSlot() {
  return <div data-slot="timer" className="contents" aria-hidden="true" />;
}
