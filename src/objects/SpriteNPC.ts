import Phaser from "phaser";
import type { IInteractable } from "./IInteractable";
import { ProximityFeedback } from "./ProximityFeedback";
import type { EntityConfig, Updatable } from "../systems/SceneContent";

/**
 * Options for `kind: "sprite-npc"`. A complete NPC is just a config entry
 * plus an image/spritesheet in the asset manifest:
 *
 *   { id: "mia", kind: "sprite-npc", x: 700, y: 640,
 *     dialogueId: "lobby.mia", texture: "npc_mia", frameCount: 2 }
 */
export interface SpriteNpcConfig extends EntityConfig {
  dialogueId: string;
  /** Texture key from the asset manifest (image or spritesheet). */
  texture: string;
  /** For spritesheets: how many frames to cycle through (idle animation). Default 1. */
  frameCount?: number;
  /** ms per frame. Default 600. */
  frameMs?: number;
  scale?: number;
  flipX?: boolean;
}

const DEPTH = 8; // same as the hand-drawn NPCs

export class SpriteNPC extends Phaser.GameObjects.Container implements IInteractable, Updatable {
  public readonly dialogueId: string;
  public readonly interactLabel = "Talk";
  public readonly bubbleOffsetY: number;

  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly feedback: ProximityFeedback;
  private readonly frameCount: number;
  private readonly frameMs: number;

  private frameIndex = 0;
  private lastFrameTime = 0;

  constructor(scene: Phaser.Scene, config: SpriteNpcConfig) {
    super(scene, config.x, config.y);

    this.dialogueId = config.dialogueId;
    this.frameCount = config.frameCount ?? 1;
    this.frameMs = config.frameMs ?? 600;

    // Origin at the feet, like the other NPCs: `y` is the ground line.
    this.sprite = new Phaser.GameObjects.Sprite(scene, 0, 0, config.texture, 0)
      .setOrigin(0.5, 1)
      .setScale(config.scale ?? 2)
      .setFlipX(config.flipX ?? false);
    this.add(this.sprite);

    const height = this.sprite.displayHeight;
    this.bubbleOffsetY = height + 10;
    this.feedback = new ProximityFeedback(scene, this, {
      glowY: -height * 0.4,
      indicatorY: -(height + 14),
    });

    scene.add.existing(this);
    this.setDepth(DEPTH);
  }

  public update(time: number): void {
    if (this.frameCount <= 1 || time - this.lastFrameTime < this.frameMs) return;

    this.frameIndex = (this.frameIndex + 1) % this.frameCount;
    this.sprite.setFrame(this.frameIndex);
    this.lastFrameTime = time;
  }

  public setNearby(nearby: boolean): void {
    this.feedback.setNearby(nearby);
  }

  public destroy(fromScene?: boolean): void {
    this.feedback?.destroy();
    super.destroy(fromScene);
  }
}
