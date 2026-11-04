import { createFileRoute, notFound } from '@tanstack/react-router';
import { Inbox, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PriorityFlag } from '@/components/ui/priority-flag';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { StatusPill } from '@/components/ui/status-pill';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <h2 className="heading text-sm uppercase tracking-[0.08em] text-muted">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

function Catalog() {
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(false);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="heading text-xl">Catálogo de componentes</h1>
          <p className="text-[13px] text-muted">Base visual da Azuos Env nos dois temas.</p>
        </div>
        <ThemeToggle />
      </header>

      <Section title="Button">
        <Button variant="signal">Nova tarefa</Button>
        <Button variant="ghost">Cancelar</Button>
        <Button variant="outline">Filtrar</Button>
        <Button variant="danger">Excluir</Button>
        <Button variant="nav" size="icon" aria-label="Mais ações">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button disabled>Salvando</Button>
      </Section>

      <Section title="Formulário">
        <div className="flex w-full flex-col gap-2 sm:w-64">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" placeholder="Corrigir fechamento de caixa" />
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-64">
          <Label htmlFor="desc">Descrição</Label>
          <Textarea id="desc" placeholder="Contexto da tarefa" />
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-52">
          <Label htmlFor="prio">Prioridade</Label>
          <Select defaultValue="high">
            <SelectTrigger id="prio" aria-label="Prioridade">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="urgent">Urgente</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-[13px] text-body">
          <Checkbox checked={checked} onCheckedChange={(value) => setChecked(value === true)} />
          Faturável
        </label>
        <label className="flex min-h-11 items-center gap-2 text-[13px] text-body">
          <Switch checked={on} onCheckedChange={setOn} />
          Notificações
        </label>
      </Section>

      <Section title="Sobreposições">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost">Abrir diálogo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova tarefa</DialogTitle>
              <DialogDescription>Abaixo de 768 px isto vira bottom sheet.</DialogDescription>
            </DialogHeader>
            <Input placeholder="Nome da tarefa" />
            <DialogFooter>
              <Button variant="ghost">Cancelar</Button>
              <Button>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost">Abrir drawer</Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetTitle className="heading text-base">Navegação</SheetTitle>
            <p className="text-[13px] text-muted">A sidebar vira drawer abaixo de 1024 px.</p>
          </SheetContent>
        </Sheet>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost">Popover</Button>
          </PopoverTrigger>
          <PopoverContent>
            <p className="text-[13px]">Conteúdo flutuante preso ao gatilho.</p>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost">Menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Tarefa</DropdownMenuLabel>
            <DropdownMenuItem>Duplicar</DropdownMenuItem>
            <DropdownMenuItem>Arquivar</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-danger">Excluir</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost">Tooltip</Button>
          </TooltipTrigger>
          <TooltipContent>Dica curta</TooltipContent>
        </Tooltip>

        <Button
          variant="outline"
          onClick={() => {
            toast.success('Tarefa criada.', { description: 'AZD-150 em Backlog.' });
          }}
        >
          Mostrar toast
        </Button>
      </Section>

      <Section title="Dados">
        <Avatar name="Felipe de Souza" />
        <StatusPill tone="accent">Em andamento</StatusPill>
        <StatusPill tone="info">Code review</StatusPill>
        <StatusPill tone="success">Concluído</StatusPill>
        <StatusPill tone="warning">Homologação</StatusPill>
        <StatusPill tone="danger">Bloqueado</StatusPill>
        <StatusPill>Backlog</StatusPill>
        <PriorityFlag priority="urgent" withLabel />
        <PriorityFlag priority="high" withLabel />
        <PriorityFlag priority="normal" withLabel />
        <PriorityFlag priority="low" withLabel />
        <PriorityFlag priority={null} withLabel />
      </Section>

      <Section title="Abas">
        <Tabs defaultValue="lista" className="w-full">
          <TabsList>
            <TabsTrigger value="lista">Lista</TabsTrigger>
            <TabsTrigger value="quadro">Quadro</TabsTrigger>
            <TabsTrigger value="gantt">Gantt</TabsTrigger>
          </TabsList>
          <TabsContent value="lista" className="text-[13px] text-body">
            Visão em lista.
          </TabsContent>
          <TabsContent value="quadro" className="text-[13px] text-body">
            Visão em quadro.
          </TabsContent>
          <TabsContent value="gantt" className="text-[13px] text-body">
            Visão em Gantt.
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Carregamento e vazio">
        <Spinner />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-24" />
        <div className="w-full">
          <EmptyState
            title="Nenhuma tarefa por aqui"
            description="Crie a primeira tarefa desta lista para começar."
            icon={<Inbox className="h-6 w-6" aria-hidden="true" />}
            action={<Button>Nova tarefa</Button>}
          />
        </div>
      </Section>
    </main>
  );
}

export const Route = createFileRoute('/_dev/ui')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw notFound();
    }
  },
  component: Catalog,
});
