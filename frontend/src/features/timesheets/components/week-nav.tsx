import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { currentWeekStart, shiftWeek, weekRangeLabel } from '../week';

export interface WeekNavProps {
  weekStart: string;
  onChange: (weekStart: string) => void;
}

/** ‹ Hoje › da semana, com o intervalo escrito em pt-BR. */
export function WeekNav({ weekStart, onChange }: WeekNavProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="nav"
        size="icon"
        aria-label="Semana anterior"
        onClick={() => {
          onChange(shiftWeek(weekStart, -1));
        }}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onChange(currentWeekStart());
        }}
      >
        Hoje
      </Button>
      <Button
        variant="nav"
        size="icon"
        aria-label="Próxima semana"
        onClick={() => {
          onChange(shiftWeek(weekStart, 1));
        }}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
      <span className="ml-1 min-w-0 text-[13px] font-semibold text-ink">
        {weekRangeLabel(weekStart)}
      </span>
    </div>
  );
}
