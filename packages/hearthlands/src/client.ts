import type { Game } from './index.js';

export const materials = ['Timber', 'Stone', 'Provisions', 'Textiles', 'Metal'] as const;
export type Material = typeof materials[number];
export type Inventory = Record<Material, number>;
export const costs = {
  Trail: { Timber: 1, Stone: 1, Provisions: 0, Textiles: 0, Metal: 0 },
  Lodge: { Timber: 1, Stone: 1, Provisions: 1, Textiles: 1, Metal: 0 },
  Hall: { Timber: 0, Stone: 0, Provisions: 2, Textiles: 0, Metal: 2 },
  Chronicle: { Timber: 0, Stone: 0, Provisions: 1, Textiles: 1, Metal: 1 },
} satisfies Record<string, Inventory>;
export const emptyInventory = (): Inventory => ({ Timber: 0, Stone: 0, Provisions: 0, Textiles: 0, Metal: 0 });
export function exchangeRatio(game: Pick<Game, 'exchanges' | 'sites'>, id: string, give: Material): number {
  const owned = game.exchanges.filter(e => game.sites[e.site]!.owner === id);
  return owned.some(e => e.material === give) ? 2 : owned.some(e => !e.material) ? 3 : 4;
}
export type { Action, View } from './index.js';
