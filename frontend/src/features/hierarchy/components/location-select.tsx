import { useQuery } from '@tanstack/react-query';
import type { TaskLocation, WorkspaceTree } from '@/api/types';
import { SelectNative } from '@/components/ui/select-native';
import { treeQuery } from '@/features/shell/api';

export interface LocationValue {
  location: TaskLocation;
  locationId?: string;
}

export interface LocationSelectProps {
  wsId: string;
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  id?: string;
  /** Tipos de local oferecidos; "everything" cobre o workspace inteiro. */
  allow?: TaskLocation[];
  disabled?: boolean;
}

interface Option {
  key: string;
  label: string;
  group: string;
}

/** "space:abc" identifica o local sem precisar de dois selects. */
export function locationKey(value: LocationValue): string {
  return value.locationId ? `${value.location}:${value.locationId}` : value.location;
}

export function parseLocationKey(key: string): LocationValue {
  const [location, locationId] = key.split(':');

  return {
    location: (location ?? 'everything') as TaskLocation,
    ...(locationId ? { locationId } : {}),
  };
}

/** Achata a árvore em opções agrupadas por Space. */
export function locationOptions(tree: WorkspaceTree, allow: TaskLocation[]): Option[] {
  const options: Option[] = [];

  for (const space of tree.spaces) {
    if (allow.includes('space')) {
      options.push({ key: `space:${space.id}`, label: space.name, group: space.name });
    }

    const walkFolders = (
      folders: WorkspaceTree['spaces'][number]['folders'],
      prefix: string,
    ): void => {
      for (const folder of folders) {
        const label = `${prefix}${folder.name}`;

        if (allow.includes('folder')) {
          options.push({ key: `folder:${folder.id}`, label, group: space.name });
        }

        if (allow.includes('list')) {
          for (const list of folder.lists) {
            options.push({
              key: `list:${list.id}`,
              label: `${label} / ${list.name}`,
              group: space.name,
            });
          }
        }

        walkFolders(folder.folders, `${label} / `);
      }
    };

    walkFolders(space.folders, '');

    if (allow.includes('list')) {
      for (const list of space.lists) {
        options.push({ key: `list:${list.id}`, label: list.name, group: space.name });
      }
    }
  }

  return options;
}

/** Escolha de local da hierarquia em um select nativo, agrupado por Space. */
export function LocationSelect({
  wsId,
  value,
  onChange,
  id,
  allow = ['everything', 'space', 'folder', 'list'],
  disabled,
}: LocationSelectProps) {
  const tree = useQuery(treeQuery(wsId));
  const options = tree.data ? locationOptions(tree.data, allow) : [];
  const groups = [...new Set(options.map((option) => option.group))];

  return (
    <SelectNative
      id={id}
      disabled={disabled ?? tree.isPending}
      value={locationKey(value)}
      onChange={(event) => {
        onChange(parseLocationKey(event.target.value));
      }}
    >
      {allow.includes('everything') ? <option value="everything">Todo o workspace</option> : null}
      {groups.map((group) => (
        <optgroup key={group} label={group}>
          {options
            .filter((option) => option.group === group)
            .map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
        </optgroup>
      ))}
    </SelectNative>
  );
}
