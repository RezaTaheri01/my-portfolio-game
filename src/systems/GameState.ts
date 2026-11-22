import Phaser from "phaser";

// ============================================================
// Shared, serialisable game progress: flags, inventory,
// collected entities and per-dialogue memory.
// One instance per Phaser.Game, so it survives scene changes.
// ============================================================

export type FlagValue = boolean | number | string;

/** A data-friendly condition (usable from JSON). Evaluated by GameState.check(). */
export type Condition =
  | { flag: string; equals?: FlagValue; gte?: number; lt?: number } // no operator => "is truthy"
  | { has: string; count?: number } // inventory item
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

/** A data-friendly side effect (usable from JSON). Executed by runEffects(). */
export type Effect =
  | { setFlag: string; value?: FlagValue } // default value: true
  | { inc: string; by?: number }
  | { give: string; count?: number }
  | { take: string; count?: number }
  | { sfx: string }
  | { emit: string; data?: unknown }; // hook for quests, cutscenes, achievements...

/** How far the player got through a dialogue node (see DialogueNode.repeat). */
export interface NodeMemory {
  page: number;
  runs: number;
}

export class GameState {
  private static readonly instances = new WeakMap<Phaser.Game, GameState>();

  static get(scene: Phaser.Scene): GameState {
    const game = scene.sys.game;
    let state = GameState.instances.get(game);
    if (!state) {
      state = new GameState();
      GameState.instances.set(game, state);
    }
    return state;
  }

  /** Emits "flag" (name, value), "item" (id, count) and any `emit` effect by name. */
  readonly events = new Phaser.Events.EventEmitter();

  private readonly flags = new Map<string, FlagValue>();
  private readonly inventory = new Map<string, number>();
  private readonly collected = new Set<string>();
  private readonly nodeMemory = new Map<string, NodeMemory>();

  // ---------- flags ----------

  getFlag(name: string): FlagValue | undefined {
    return this.flags.get(name);
  }

  setFlag(name: string, value: FlagValue = true): void {
    this.flags.set(name, value);
    this.events.emit("flag", name, value);
  }

  inc(name: string, by = 1): number {
    const current = this.flags.get(name);
    const next = (typeof current === "number" ? current : 0) + by;
    this.setFlag(name, next);
    return next;
  }

  // ---------- inventory ----------

  addItem(id: string, count = 1): void {
    const next = this.itemCount(id) + count;
    this.inventory.set(id, next);
    this.events.emit("item", id, next);
  }

  removeItem(id: string, count = 1): void {
    const next = Math.max(0, this.itemCount(id) - count);
    this.inventory.set(id, next);
    this.events.emit("item", id, next);
  }

  itemCount(id: string): number {
    return this.inventory.get(id) ?? 0;
  }

  // ---------- collected world entities ----------

  markCollected(entityId: string): void {
    this.collected.add(entityId);
  }

  isCollected(entityId: string): boolean {
    return this.collected.has(entityId);
  }

  // ---------- dialogue memory ----------

  memory(key: string): NodeMemory {
    let m = this.nodeMemory.get(key);
    if (!m) {
      m = { page: 0, runs: 0 };
      this.nodeMemory.set(key, m);
    }
    return m;
  }

  // ---------- conditions ----------

  check(condition: Condition): boolean {
    if ("all" in condition) return condition.all.every((c) => this.check(c));
    if ("any" in condition) return condition.any.some((c) => this.check(c));
    if ("not" in condition) return !this.check(condition.not);
    if ("has" in condition) return this.itemCount(condition.has) >= (condition.count ?? 1);

    const value = this.flags.get(condition.flag);
    if (condition.equals !== undefined) return value === condition.equals;
    if (condition.gte !== undefined) return typeof value === "number" && value >= condition.gte;
    if (condition.lt !== undefined) return (typeof value === "number" ? value : 0) < condition.lt;
    return Boolean(value);
  }
}
