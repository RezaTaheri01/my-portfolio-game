import type Phaser from "phaser";
import { GameState, type Effect } from "./GameState";
import { Registry } from "./Registry";

// ============================================================
// Items: data (ItemDef, in data/items.ts) + behaviour per item TYPE.
//
// A new item usually needs data only:   ITEMS.ruby = { type: "coin", ... }
// A new TYPE needs one registration:    itemTypes.register("heal", {...})
// ============================================================

export interface ItemLook {
  /** Procedurally drawn shape (matches the game's no-sprite art style). */
  shape?: "orb" | "key" | "scroll";
  color?: number;
  /** Or an image key from the asset manifest; wins over `shape`. */
  texture?: string;
}

export interface ItemDef {
  /** Selects the behaviour in `itemTypes`. */
  type: string;
  name: string;
  /** Meaning depends on the type (the coin type adds it to the "coins" counter). */
  value?: number;
  look?: ItemLook;
  /** Sound on pickup. Default: SFX.collect. */
  sfx?: string;
  /** Dialogue opened right after pickup (lore fragments, notes...). */
  dialogueId?: string;
  /** Extra data-driven effects on pickup. */
  effects?: Effect[];
}

export interface ItemBehavior {
  /** "touch": collected by walking over it. "interact": press E / tap. */
  pickup: "touch" | "interact";
  /** Type-specific logic. Effects, sound and dialogue from ItemDef run afterwards. */
  onCollect?(scene: Phaser.Scene, itemId: string, def: ItemDef): void;
}

export const itemTypes = new Registry<ItemBehavior>("item type");

// ---------- built-in types ----------

itemTypes.register("coin", {
  pickup: "touch",
  onCollect: (scene, _id, def) => void GameState.get(scene).inc("coins", def.value ?? 1),
});

itemTypes.register("key", {
  pickup: "interact",
  onCollect: (scene, id) => GameState.get(scene).addItem(id),
});

itemTypes.register("lore", {
  pickup: "interact",
  onCollect: (scene, id) => GameState.get(scene).addItem(id),
});
