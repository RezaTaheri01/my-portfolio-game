import { entities } from "../systems/SceneContent";
import type { EntityConfig } from "../systems/SceneContent";
import { spawnCollectable, type CollectableConfig } from "./Collectable";
import { spawnDoor, type DoorConfig } from "./Door";
import { BrownBearNPC } from "./Lobby/BrownBearNPC";
import { LobbyInteractable, type LobbyInteractableConfig } from "./Lobby/LobbyInteractable";
import { SajjadNPC } from "./Lobby/SajjadNPC";
import { SpriteNPC, type SpriteNpcConfig } from "./SpriteNPC";
import { TriggerZone, type TriggerConfig } from "./TriggerZone";

// ============================================================
// ENTITY KINDS: the one place that lists what a scene's data
// can spawn. A new kind = write the class, add one line here.
// Scenes and the spawner never change.
//
// (Imported once from main.ts. Registered explicitly rather than as
//  a side effect of each class file, so "what kinds exist?" is greppable
//  and survives bundler tree-shaking.)
// ============================================================

interface NpcConfig extends EntityConfig {
  dialogueId: string;
}
interface SignConfig extends EntityConfig, LobbyInteractableConfig {}

// ---------- hand-drawn NPCs (art lives in their own classes) ----------

entities.register("sajjad", (cfg, ctx) => {
  const npc = new SajjadNPC(ctx.scene, cfg.x, cfg.y, (cfg as NpcConfig).dialogueId);
  ctx.interaction.add(npc);
  ctx.updates.add(npc);
});

entities.register("brown-bear", (cfg, ctx) => {
  const npc = new BrownBearNPC(ctx.scene, cfg.x, cfg.y, (cfg as NpcConfig).dialogueId);
  ctx.interaction.add(npc);
  ctx.updates.add(npc);
});

// ---------- fully data-driven NPC: sprite from the asset manifest ----------

entities.register("sprite-npc", (cfg, ctx) => {
  const npc = new SpriteNPC(ctx.scene, cfg as SpriteNpcConfig);
  ctx.interaction.add(npc);
  ctx.updates.add(npc);
});

// ---------- signposts ----------

entities.register("sign", (cfg, ctx) => {
  ctx.interaction.add(new LobbyInteractable(ctx.scene, cfg as SignConfig));
});

// ---------- doors: walk through to another scene ----------

entities.register("door", (cfg, ctx) => spawnDoor(cfg as DoorConfig, ctx));

// ---------- items & triggers ----------

entities.register("collectable", (cfg, ctx) => spawnCollectable(cfg as CollectableConfig, ctx));

entities.register("trigger", (cfg, ctx) => ctx.updates.add(new TriggerZone(cfg as TriggerConfig, ctx)));
