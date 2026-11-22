import type Phaser from "phaser";
import type { BundleName } from "../data/assets";
import type { Player } from "../objects/Player";
import type { InteractionManager } from "./InteractionManager";
import type { DialogueManager } from "./DialogueManager";
import type { SceneMusic } from "./AudioManager";
import { Registry } from "./Registry";

// ============================================================
// Scene content: what a scene contains, as data, plus the
// registry that turns each entry into a live game object.
//
//   data/scenes/lobby.ts   -> LOBBY: SceneContent   (the data)
//   objects/register.ts    -> entities.register(...) (the kinds)
//   scene.create()         -> spawnEntities(LOBBY.entities, ctx)
// ============================================================

/** Anything with a per-frame update. Dead (destroyed) ones are dropped automatically. */
export interface Updatable {
  update(time: number): void;
  /** Phaser game objects set this to false when destroyed. */
  active?: boolean;
}

/** Everything a spawned entity may need from the scene. */
export interface SpawnContext {
  scene: Phaser.Scene;
  player: Player;
  interaction: InteractionManager;
  dialogue: DialogueManager;
  updates: UpdateList;
}

/**
 * One placed thing. `kind` selects the factory in the registry; any other
 * fields are that kind's options (each factory documents its own).
 */
export interface EntityConfig {
  /** Unique per scene; used to remember e.g. "already collected". */
  id: string;
  kind: string;
  x: number;
  y: number;
  [option: string]: unknown;
}

export interface SceneContent {
  /** Asset bundles (data/assets.ts) this scene preloads. */
  bundles: BundleName[];
  music?: SceneMusic;
  entities: EntityConfig[];
}

export type EntityFactory = (config: EntityConfig, ctx: SpawnContext) => void;

export const entities = new Registry<EntityFactory>("entity kind");

/** Spawn every entry. A broken entry is logged and skipped, not fatal. */
export function spawnEntities(list: readonly EntityConfig[], ctx: SpawnContext): void {
  for (const config of list) {
    try {
      entities.require(config.kind)(config, ctx);
    } catch (error) {
      console.error(`[SceneContent] Could not spawn "${config.id}" (${config.kind}):`, error);
    }
  }
}

export class UpdateList {
  private readonly items: Updatable[] = [];

  add(item: Updatable): void {
    this.items.push(item);
  }

  update(time: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (item.active === false) this.items.splice(i, 1);
    }
    for (const item of this.items) item.update(time);
  }

  clear(): void {
    this.items.length = 0;
  }
}
