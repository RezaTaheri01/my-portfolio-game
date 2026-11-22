import type { ItemDef } from "../systems/Items";

// Item definitions (what an item IS). Where items sit in a scene is declared
// in data/scenes/*.ts with `kind: "collectable", item: "<id>"`.
// Behaviour comes from the item's `type` (see systems/Items.ts).
export const ITEMS: Record<string, ItemDef> = {
  coin: {
    type: "coin",
    name: "Coin",
    value: 1,
    look: { shape: "orb", color: 0xffd36b },
  },

  lobby_key: {
    type: "key",
    name: "Old Key",
    look: { shape: "key", color: 0xd9c9a0 },
    effects: [{ setFlag: "has_lobby_key" }],
  },
};
