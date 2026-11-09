import { navGroups, navItems, navShortcuts } from '../navigation';
export interface NavigationPreferences { favorites: string[]; collapsed: string[]; }
export const emptyPreferences: NavigationPreferences = { favorites: [], collapsed: [] };
export const preferenceKey = (userId: string) => `kohl.navigation.v1:${encodeURIComponent(userId)}`;
export function parsePreferences(value: string | null): NavigationPreferences {
  try {
    const data = JSON.parse(value || '{}');
    const ids = new Set([...navItems, ...navShortcuts].map(item => item.id));
    const groups = new Set<string>(navGroups.map(group => group.id));
    return {
      favorites: Array.isArray(data?.favorites) ? Array.from(new Set<string>(data.favorites.filter((id: unknown) => typeof id === 'string' && ids.has(id)))) : [],
      collapsed: Array.isArray(data?.collapsed) ? Array.from(new Set<string>(data.collapsed.filter((id: unknown) => typeof id === 'string' && groups.has(id)))) : [],
    };
  } catch { return { favorites: [], collapsed: [] }; }
}
