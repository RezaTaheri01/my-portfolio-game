import Phaser from "phaser";
import { ITEMS } from "../data/items";
import { SFX } from "../data/audio";
import { AudioManager } from "../systems/AudioManager";
import { runEffects } from "../systems/Effects";
import { GameState } from "../systems/GameState";
import { itemTypes, type ItemBehavior, type ItemDef, type ItemLook } from "../systems/Items";
import type { EntityConfig, SpawnContext, Updatable } from "../systems/SceneContent";
import type { IInteractable } from "./IInteractable";

/**
 * Options for `kind: "collectable"`:
 *   { id: "coin-1", kind: "collectable", item: "coin", x: 700, y: 600 }
 * `id` must be unique in the scene: collected ids are remembered in GameState,
 * so a collected item doesn't respawn when the scene is re-entered.
 */
export interface CollectableConfig extends EntityConfig {
  item: string;
}

const TOUCH_RADIUS = 34;
const DEPTH = 6;

function drawLook(g: Phaser.GameObjects.Graphics, look: ItemLook): void {
  const color = look.color ?? 0xffd36b;

  switch (look.shape ?? "orb") {
    case "key":
      g.lineStyle(3, color, 1).strokeCircle(-7, 0, 5);
      g.fillStyle(color, 1).fillRect(-2, -1.5, 15, 3).fillRect(8, 1.5, 3, 5).fillRect(12.5, 1.5, 3, 4);
      break;
    case "scroll":
      g.fillStyle(color, 1).fillRoundedRect(-8, -10, 16, 20, 3);
      g.lineStyle(1, 0x5a4630, 0.8);
      for (const y of [-5, 0, 5]) g.lineBetween(-4, y, 4, y);
      break;
    default: // orb
      g.fillStyle(color, 1).fillCircle(0, 0, 8);
      g.lineStyle(2, 0xffffff, 0.35).strokeCircle(0, 0, 8);
      g.fillStyle(0xffffff, 0.6).fillCircle(-2.5, -2.5, 2.5);
  }
}

export class Collectable extends Phaser.GameObjects.Container implements IInteractable, Updatable {
  private readonly glow: Phaser.GameObjects.Arc;
  public readonly interactLabel: string;
  private collected = false;
  private nearbyTween?: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    private readonly config: CollectableConfig,
    private readonly def: ItemDef,
    private readonly behavior: ItemBehavior,
    private readonly ctx: SpawnContext
  ) {
    super(scene, config.x, config.y);
    this.interactLabel = `Pick up ${def.name}`;

    this.glow = scene.add.arc(0, 0, 22, 0, 360, false, def.look?.color ?? 0xffd36b, 0.14);
    this.add(this.glow);

    if (def.look?.texture) {
      this.add(scene.add.image(0, 0, def.look.texture));
    } else {
      const g = scene.add.graphics();
      drawLook(g, def.look ?? {});
      this.add(g);
    }

    scene.add.existing(this);
    this.setDepth(DEPTH);

    // Gentle bob + glow pulse; setNearby only animates the glow's alpha.
    scene.tweens.add({ targets: this, y: config.y - 6, duration: 1100, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
    scene.tweens.add({ targets: this.glow, scale: 1.25, duration: 900, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
  }

  // ---------- IInteractable (pickup: "interact") ----------

  public onInteract(): void {
    this.collect();
  }

  public setNearby(nearby: boolean): void {
    this.nearbyTween?.stop();
    this.nearbyTween = this.scene.tweens.add({
      targets: this.glow,
      alpha: nearby ? 0.4 : 0.14,
      duration: 250,
    });
  }

  // ---------- Updatable (pickup: "touch") ----------

  public update(): void {
    if (this.collected || this.behavior.pickup !== "touch") return;

    const { player } = this.ctx;
    if (Phaser.Math.Distance.Between(player.x, player.y, this.config.x, this.config.y) < TOUCH_RADIUS) {
      this.collect();
    }
  }

  // ---------- pickup ----------

  private collect(): void {
    if (this.collected) return;
    this.collected = true;

    const { scene, def } = this;
    GameState.get(scene).markCollected(this.config.id);

    this.behavior.onCollect?.(scene, this.config.item, def);
    runEffects(scene, def.effects);
    AudioManager.get(scene).playSfx(def.sfx ?? SFX.collect, { pitchJitter: 40 });

    this.ctx.interaction.remove(this);
    if (def.dialogueId) this.ctx.dialogue.start(def.dialogueId);

    // Pop, then clean up.
    scene.tweens.killTweensOf([this, this.glow]);
    scene.tweens.add({
      targets: this,
      scale: 1.8,
      alpha: 0,
      y: this.y - 18,
      duration: 220,
      onComplete: () => this.destroy(),
    });
  }
}

/** Factory registered for `kind: "collectable"` (see objects/register.ts). */
export function spawnCollectable(config: CollectableConfig, ctx: SpawnContext): void {
  if (GameState.get(ctx.scene).isCollected(config.id)) return;

  const def = ITEMS[config.item];
  if (!def) throw new Error(`Unknown item "${config.item}". Add it to data/items.ts.`);

  const behavior = itemTypes.require(def.type);
  const collectable = new Collectable(ctx.scene, config, def, behavior, ctx);

  if (behavior.pickup === "interact") ctx.interaction.add(collectable);
  else ctx.updates.add(collectable);
}
