import { useQuery } from '@tanstack/react-query';
import type { TreeFolder, TreeSpace, WorkspaceTree } from '@/api/types';
import { SelectNative } from '@/components/ui/select-native';
import { treeQuery } from '@/features/shell/api';

export interface ListOption {
  id: string;
  name: string;
  spaceName: string;
}

function fromFolder(folder: TreeFolder, spaceName: string, trail: string): ListOption[] {
  const here = `${trail} › ${folder.name}`;

  return [
    ...folder.lists.map((list) => ({ id: list.id, name: `${here} › ${list.name}`, spaceName })),
    ...folder.folders.flatMap((child) => fromFolder(child, spaceName, here)),
  ];
}

function fromSpace(space: TreeSpace): ListOption[] {
  return [
    ...space.lists.map((list) => ({ id: list.id, name: list.name, spaceName: space.name })),
    ...space.folders.flatMap((folder) => fromFolder(folder, space.name, folder.name)),
  ];
}

/** Toda List visível da árvore, agrupada por Space. */
export function listOptions(tree: WorkspaceTree | undefined): ListOption[] {
  return (tree?.spaces ?? []).flatMap(fromSpace);
}

export interface ListPickerProps {
  wsId: string;
  value: string;
  onChange: (listId: string) => void;
  id?: string;
  disabled?: boolean;
}

/** Escolha de List pelo select nativo, com as Lists agrupadas por Space. */
export function ListPicker({ wsId, value, onChange, id, disabled }: ListPickerProps) {
  const { data: tree } = useQuery(treeQuery(wsId));
  const options = listOptions(tree);
  const spaces = [...new Set(options.map((option) => option.spaceName))];

  return (
    <SelectNative
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    >
      <option value="">Escolha a List</option>
      {spaces.map((spaceName) => (
        <optgroup key={spaceName} label={spaceName}>
          {options
            .filter((option) => option.spaceName === spaceName)
            .map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
        </optgroup>
      ))}
    </SelectNative>
  );
}
