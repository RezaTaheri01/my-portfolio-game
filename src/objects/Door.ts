import Phaser from "phaser";
import { GAME_FONT, UI_COLORS } from "../game/theme";
import { DESTINATIONS } from "../data/destinations";
import { GameState, type Condition } from "../systems/GameState";
import { SceneTransition, type SpawnPoint } from "../systems/SceneTransition";
import type { EntityConfig, SpawnContext } from "../systems/SceneContent";
import type { IInteractable } from "./IInteractable";
import { ProximityFeedback } from "./ProximityFeedback";

/**
 * Options for `kind: "door"`: a gothic stone doorway full of white light.
 * x/y is the middle of the doorstep (feet line).
 *
 * Works in any scene: list it in that scene's entities (data/scenes/*.ts).
 *
 *   { id: "to-unity", kind: "door", x: 740, y: 640, to: "unityDistrict" }
 *
 * `to` is an entry in data/destinations.ts (scene, spawn, popup text). Or skip
 * the shared list and give everything inline:
 *
 *   { id: "to-unity", kind: "door", x: 740, y: 640,
 *     targetScene: "UnityScene", spawn: { x: 120 },
 *     title: "Unity District", description: "Where the games are made." }
 *
 * Locked until the player owns a key (or any other Condition holds):
 *
 *   { ..., requires: { flag: "has_lobby_key" }, lockedDialogueId: "lobby.door_locked" }
 */
export interface DoorConfig extends EntityConfig {
  /** Name of an entry in data/destinations.ts. Inline fields below override it. */
  to?: string;
  /** Scene key to travel to (see scenes/index.ts). Needed if `to` is not used. */
  targetScene?: string;
  /** Where the player appears there. Default: that scene's own start position. */
  spawn?: SpawnPoint;
  /** Popup above the door while the player is near: where it leads. */
  title?: string;
  description?: string;
  /** Opening width / total height of the doorway in px. Default 50 x 175. */
  width?: number;
  height?: number;
  /** Door stays dim and shut (it shakes) until this holds. */
  requires?: Condition;
  /** Dialogue shown when the door is locked (optional). */
  lockedDialogueId?: string;
  /** Verb in the prompt: "E to Enter". */
  label?: string;
}

// Palette: the game's stones and leaves, plus a cool white for the light.
const C = {
  stone: 0x46523f,
  stoneMid: 0x5a6955,
  stoneLight: 0x7d8c76,
  stoneDark: 0x232c25,
  void: 0x0b110e,
  leafA: 0x3f7543,
  leafB: 0x547e42,
  lightEdge: 0xc9d8ff,
  lightMid: 0xe9f0ff,
  lightCore: 0xffffff,
  mist: 0xe9eef7,
};

// Sits between the painted background and the ground platform, so the ground edge
// overlaps the doorway's base and the player (10) walks in front of it.
// Assumes the usual layering (background below -1, ground at 0): change here if a
// scene layers differently.
const DEPTH = -1;
const GLOW_TEXTURE = "door-glow"; // made by the door itself, so no scene has to provide it
const POPUP_DEPTH = 50; // above the player so it's never hidden
const FRAME = 14; // total stone thickness on each side (two layers of 7)
const WHITE = [255, 255, 255] as const;

type Pt = Phaser.Math.Vector2;
const pt = (x: number, y: number): Pt => new Phaser.Math.Vector2(x, y);

const SEGMENTS = 10;

/**
 * Pointed (gothic) arch: straight jambs plus two arcs meeting at an apex.
 * Origin = bottom centre, y grows downward, so the arch is at negative y.
 * Every width yields the same number of points, so two arches can be joined index by index.
 */
function archPoints(width: number, straight: number): Pt[] {
  const r = width;
  const half = width / 2;
  const pts: Pt[] = [pt(-half, 0), pt(-half, -straight)];
  // Left arc: centred on the right springing point, from 180deg to 240deg.
  for (let i = 1; i <= SEGMENTS; i++) {
    const a = Math.PI + (i / SEGMENTS) * (Math.PI / 3);
    pts.push(pt(half + Math.cos(a) * r, -straight + Math.sin(a) * r));
  }
  // Right arc: centred on the left springing point, from 300deg to 360deg.
  for (let i = 1; i < SEGMENTS; i++) {
    const a = (5 * Math.PI) / 3 + (i / SEGMENTS) * (Math.PI / 3);
    pts.push(pt(-half + Math.cos(a) * r, -straight + Math.sin(a) * r));
  }
  pts.push(pt(half, -straight), pt(half, 0));
  return pts;
}

const archRise = (width: number): number => width * Math.sin(Math.PI / 3);

/** Soft radial glow, built from concentric circles. Created once, shared by all doors. */
function ensureGlowTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(GLOW_TEXTURE)) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  [[62, 0.025], [46, 0.04], [28, 0.07], [12, 0.12]].forEach(([radius, alpha]) =>
    g.fillStyle(0xffffff, alpha).fillCircle(64, 64, radius)
  );
  g.generateTexture(GLOW_TEXTURE, 128, 128);
  g.destroy();
}

interface Route {
  scene: string;
  spawn?: SpawnPoint;
  title?: string;
  description?: string;
}

/** Merge the shared destination (if `to` is set) with the door's own overrides. */
function resolveRoute(config: DoorConfig): Route {
  const dest = config.to ? DESTINATIONS[config.to] : undefined;
  if (config.to && !dest) {
    throw new Error(`Unknown destination "${config.to}". Add it to data/destinations.ts.`);
  }
  const scene = config.targetScene ?? dest?.scene;
  if (!scene) throw new Error(`Door "${config.id}" needs \`to\` or \`targetScene\`.`);

  return {
    scene,
    spawn: config.spawn ?? dest?.spawn,
    title: config.title ?? dest?.title,
    description: config.description ?? dest?.description,
  };
}

export class Door extends Phaser.GameObjects.Container implements IInteractable {
  public readonly interactLabel: string;
  public readonly bubbleOffsetY: number;

  private readonly feedback: ProximityFeedback;
  private readonly light: Phaser.GameObjects.Container;
  private readonly shaft: Phaser.GameObjects.Rectangle;
  private readonly bloom: Phaser.GameObjects.Image;
  private readonly motes: Phaser.GameObjects.Arc[] = [];
  private readonly wisps: Phaser.GameObjects.Ellipse[] = [];
  private lightTween?: Phaser.Tweens.Tween;

  private readonly popup?: Phaser.GameObjects.Container;
  private readonly popupBaseY: number;
  private popupTween?: Phaser.Tweens.Tween;
  private readonly lockedLine?: Phaser.GameObjects.Text;

  private readonly route: Route;
  private opening = false;
  private isNearby = false;

  constructor(scene: Phaser.Scene, private readonly config: DoorConfig, private readonly ctx: SpawnContext) {
    super(scene, config.x, config.y);

    this.route = resolveRoute(config); // throws early (and is logged) on a bad config

    const w = config.width ?? 50;
    const h = config.height ?? 175;
    const outerW = w + FRAME * 2;
    const straight = Math.max(30, h - archRise(outerW));

    this.interactLabel = config.label ?? "Enter";
    this.bubbleOffsetY = h + 6;

    // ---------- soft bloom behind the doorway (additive, like the campfire glow) ----------
    ensureGlowTexture(scene);
    this.bloom = scene.add
      .image(0, -h * 0.45, GLOW_TEXTURE)
      .setScale(outerW / 38, h / 52)
      .setTint(C.lightEdge)
      .setAlpha(0.3)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.add(this.bloom);

    // ---------- stone frame ----------
    const frame = scene.add.graphics();
    this.drawFrame(frame, w, straight);
    this.add(frame);

    // ---------- the white light filling the opening ----------
    // Slightly narrower than the opening so a dark reveal edge frames it.
    this.light = scene.add.container(0, 0);
    const lightArt = scene.add.graphics();
    lightArt.fillStyle(C.lightEdge, 1).fillPoints(archPoints(w - 8, straight), true);
    lightArt.fillStyle(C.lightMid, 1).fillPoints(archPoints(w - 18, straight), true);
    lightArt.fillStyle(C.lightCore, 1).fillPoints(archPoints(w * 0.28, straight + 4), true);
    this.light.add(lightArt);

    // A faint vertical beam inside the light that slowly sweeps sideways
    this.shaft = scene.add
      .rectangle(0, -straight / 2, 5, straight - 6, 0xffffff, 0.5)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.light.add(this.shaft);
    this.add(this.light);

    // ---------- dust floating up through the light ----------
    for (let i = 0; i < 6; i++) {
      const mote = scene.add.circle(
        Phaser.Math.Between(-w * 0.3, w * 0.3),
        -Phaser.Math.Between(14, straight - 10),
        Phaser.Math.FloatBetween(0.8, 1.8),
        0x9fb2d8,
        0
      );
      this.motes.push(mote);
      this.add(mote);
    }

    // ---------- leaves creeping over the frame ----------
    const front = scene.add.graphics();
    this.drawLeaves(front, outerW, straight);
    this.add(front);

    // ---------- low mist across the doorstep (the fog in the reference) ----------
    for (let i = 0; i < 3; i++) {
      const wisp = scene.add.ellipse((i - 1) * 34, -5 - i * 2, 60 - i * 10, 11 - i * 2, C.mist, 0.13);
      this.wisps.push(wisp);
      this.add(wisp);
    }

    // ---------- "you can use me" glow + firefly ----------
    this.feedback = new ProximityFeedback(scene, this, {
      glowY: -h * 0.45,
      glowRadius: Math.max(46, outerW * 0.9),
      indicatorY: -(h + 18),
      glowColor: C.lightEdge,
      indicatorGlow: 0xdfe8ff,
      indicatorDot: 0xffffff,
    });

    scene.add.existing(this);
    this.setDepth(DEPTH);

    // ---------- popup: where this door leads ----------
    this.popupBaseY = config.y - h - 46;
    if (this.route.title || this.route.description) {
      const { popup, lockedLine } = this.buildPopup(scene, this.route, config);
      this.popup = popup;
      this.lockedLine = lockedLine;
    }

    this.startIdleAnimations(w, straight);
    this.refreshLockedLook();
  }

  // ========================================
  // ART
  // ========================================

  private drawFrame(g: Phaser.GameObjects.Graphics, w: number, straight: number): void {
    const layer = FRAME / 2;
    const midW = w + layer * 2;
    const outerW = w + FRAME * 2;

    const outer = archPoints(outerW, straight);
    const mid = archPoints(midW, straight);
    const inner = archPoints(w, straight);

    // Outer layer
    g.fillStyle(C.stone, 1).fillPoints(outer, true);
    g.lineStyle(4, C.stoneDark, 1).strokePoints(outer, true);

    // Recessed inner layer: lighter, so the doorway reads as stepped inward
    g.fillStyle(C.stoneMid, 1).fillPoints(mid, true);
    g.lineStyle(2, C.stoneDark, 0.9).strokePoints(mid, true);

    // Dark reveal: the light sits in front of this
    g.fillStyle(C.void, 1).fillPoints(inner, true);

    // Arch stones: joints running from the opening out to the rim
    g.lineStyle(2, C.stoneDark, 0.7);
    for (let i = 3; i < inner.length - 3; i += 2) {
      g.lineBetween(inner[i].x, inner[i].y, outer[i].x, outer[i].y);
    }

    // Jamb stones: staggered courses, one offset per layer
    for (let y = -16, row = 0; y > -straight; y -= 22, row++) {
      g.lineStyle(2, C.stoneDark, 0.65);
      for (const side of [-1, 1]) {
        g.lineBetween(side * (w / 2), y, side * (midW / 2), y); // inner layer
        g.lineBetween(side * (midW / 2), y - 11, side * (outerW / 2), y - 11); // outer layer, offset
        // Short vertical joints so each course reads as separate blocks
        const jx = side * (row % 2 === 0 ? w / 2 + layer * 0.5 : midW / 2 + layer * 0.5);
        g.lineBetween(jx, row % 2 === 0 ? y : y - 11, jx, (row % 2 === 0 ? y : y - 11) + 11);
      }
    }

    // Highlight on the outer left jamb, shadow on the right: gives the stone form
    g.lineStyle(2, C.stoneLight, 0.5).lineBetween(-outerW / 2 + 3, -8, -outerW / 2 + 3, -straight);
    g.lineStyle(2, C.stoneDark, 0.5).lineBetween(outerW / 2 - 3, -8, outerW / 2 - 3, -straight);

    // Carved boss where the two arcs meet
    const apex = outer[SEGMENTS + 1];
    g.fillStyle(C.stoneLight, 1).fillCircle(apex.x, apex.y + 7, 4);
    g.lineStyle(2, C.stoneDark, 1).strokeCircle(apex.x, apex.y + 7, 4);
  }

  private drawLeaves(g: Phaser.GameObjects.Graphics, outerW: number, straight: number): void {
    // Same shapes and colours as the signposts' leaves
    const leaves: [number, number, number, number, number][] = [
      [C.leafA, -outerW / 2 + 3, -straight + 22, 13, 6],
      [C.leafA, -outerW / 2 + 10, -straight + 31, 10, 5],
      [C.leafB, outerW / 2 - 3, -straight + 46, 13, 6],
      [C.leafB, outerW / 2 - 10, -straight + 38, 10, 5],
    ];
    for (const [color, x, y, lw, lh] of leaves) g.fillStyle(color, 1).fillEllipse(x, y, lw, lh);
  }

  // ========================================
  // POPUP
  // ========================================

  private buildPopup(
    scene: Phaser.Scene,
    route: Route,
    config: DoorConfig
  ): { popup: Phaser.GameObjects.Container; lockedLine?: Phaser.GameObjects.Text } {
    const pad = 12;
    const maxTextW = 200;

    const items: Phaser.GameObjects.Text[] = [];
    let y = pad;

    const add = (text: string, size: string, color: string, bold = false): Phaser.GameObjects.Text => {
      const t = scene.add
        .text(0, y, text, {
          fontFamily: GAME_FONT,
          fontSize: size,
          color,
          fontStyle: bold ? "bold" : "normal",
          wordWrap: { width: maxTextW },
          align: "center",
        })
        .setOrigin(0.5, 0);
      y += t.height + 4;
      items.push(t);
      return t;
    };

    if (route.title) add(route.title, "16px", UI_COLORS.cream, true);
    if (route.description) add(route.description, "13px", UI_COLORS.muted);
    const lockedLine = config.requires ? add("Locked", "12px", UI_COLORS.fireLight, true) : undefined;
    lockedLine?.setVisible(false);

    const textW = Math.max(...items.map((t) => t.width));
    const boxW = textW + pad * 2;
    const boxH = y + pad - 4;

    const bg = scene.add.graphics();
    bg.fillStyle(UI_COLORS.forest, 0.94).fillRoundedRect(-boxW / 2, 0, boxW, boxH, 8);
    bg.lineStyle(2, UI_COLORS.forestBorder, 1).strokeRoundedRect(-boxW / 2, 0, boxW, boxH, 8);
    // Little pointer toward the door
    bg.fillStyle(UI_COLORS.forest, 0.94).fillTriangle(-7, boxH - 1, 7, boxH - 1, 0, boxH + 8);
    bg.lineStyle(2, UI_COLORS.forestBorder, 1).lineBetween(-7, boxH, 0, boxH + 8).lineBetween(7, boxH, 0, boxH + 8);

    // Origin = the pointer tip, so the box sits above the door.
    bg.y = -boxH - 8;
    items.forEach((t) => (t.y -= boxH + 8));

    return {
      popup: scene.add
        .container(config.x, this.popupBaseY, [bg, ...items])
        .setDepth(POPUP_DEPTH)
        .setAlpha(0)
        .setVisible(false),
      lockedLine,
    };
  }

  private isLocked(): boolean {
    const { requires } = this.config;
    return !!requires && !GameState.get(this.scene).check(requires);
  }

  // ========================================
  // ANIMATION
  // ========================================

  private startIdleAnimations(w: number, straight: number): void {
    const loop = (targets: object, props: object, duration: number, delay = 0) =>
      this.scene.tweens.add({ targets, ...props, duration, delay, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });

    this.lightTween = loop(this.light, { alpha: 0.88 }, 1700);
    loop(this.bloom, { alpha: 0.42, scaleX: this.bloom.scaleX * 1.1 }, 2100);
    loop(this.shaft, { x: w * 0.18, alpha: 0.15 }, 3600);

    this.wisps.forEach((wisp, i) => {
      loop(wisp, { x: wisp.x + 12, alpha: 0.04 }, 3200 + i * 700, i * 400);
    });

    // Dust rises through the light and fades out; each mote restarts from its own spot.
    this.motes.forEach((mote, i) => {
      this.scene.tweens.add({
        targets: mote,
        y: mote.y - Phaser.Math.Between(30, Math.min(70, straight * 0.5)),
        alpha: { from: 0.7, to: 0 },
        duration: 2600 + i * 450,
        delay: i * 350,
        ease: "Sine.easeOut",
        repeat: -1,
      });
    });
  }

  /** Locked doors show a dim, cold light until the condition holds. */
  private refreshLockedLook(): void {
    const locked = this.isLocked();
    this.lockedLine?.setVisible(locked);
    this.bloom?.setVisible(!locked);
    this.shaft.setVisible(!locked);
    this.motes.forEach((m) => m.setVisible(!locked));

    if (locked) {
      this.lightTween?.stop();
      this.lightTween = undefined;
      this.light.setAlpha(0.35);
    } else if (!this.lightTween && !this.opening) {
      this.lightTween = this.scene.tweens.add({
        targets: this.light,
        alpha: { from: this.light.alpha, to: 0.88 },
        duration: 1700,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private playOpen(onDone: () => void): void {
    const { scene } = this;
    this.lightTween?.stop();
    this.lightTween = undefined;
    scene.tweens.killTweensOf([this.light, this.bloom].filter(Boolean) as object[]);

    scene.tweens.add({ targets: this.light, alpha: 1, duration: 250 });
    if (this.bloom) {
      scene.tweens.add({
        targets: this.bloom,
        alpha: 1,
        scaleX: this.bloom.scaleX * 2.2,
        scaleY: this.bloom.scaleY * 1.5,
        duration: 450,
        ease: "Sine.easeOut",
      });
    }
    scene.time.delayedCall(350, onDone);
  }

  private playLockedShake(): void {
    const baseX = this.x;
    this.scene.tweens.add({
      targets: this,
      x: baseX + 2,
      duration: 50,
      yoyo: true,
      repeat: 4,
      onComplete: () => (this.x = baseX),
    });
  }

  // ========================================
  // INTERACTION
  // ========================================

  public onInteract(): void {
    if (this.opening || SceneTransition.isBusy) return;

    const { lockedDialogueId } = this.config;
    const { scene: targetScene, spawn } = this.route;

    if (this.isLocked()) {
      this.playLockedShake();
      if (lockedDialogueId) this.ctx.dialogue.start(lockedDialogueId, { speaker: this });
      return;
    }

    this.opening = true;
    (this.ctx.player.body as Phaser.Physics.Arcade.Body | null)?.setVelocity(0, 0);

    this.playOpen(() => {
      // Fade into white: it's the colour of the light you just walked into.
      const started = SceneTransition.go(this.scene, targetScene, { spawn, fadeColor: WHITE, fadeMs: 550 });
      if (!started) {
        this.opening = false; // unknown scene: stay usable
        this.refreshLockedLook();
      }
    });
  }

  public setNearby(nearby: boolean): void {
    // InteractionManager calls this every frame: only react to real changes,
    // otherwise the popup's fade restarts each frame and never becomes visible.
    if (this.isNearby === nearby) return;
    this.isNearby = nearby;

    this.feedback.setNearby(nearby);

    const popup = this.popup;
    if (!popup) return;

    if (nearby) this.refreshLockedLook(); // key may have been picked up since last time
    this.popupTween?.stop();
    popup.setVisible(true);
    this.popupTween = this.scene.tweens.add({
      targets: popup,
      alpha: nearby ? 1 : 0,
      y: nearby ? this.popupBaseY : this.popupBaseY + 8,
      duration: 220,
      ease: "Sine.easeOut",
      onComplete: () => {
        if (!nearby) popup.setVisible(false);
      },
    });
  }

  public destroy(fromScene?: boolean): void {
    this.feedback?.destroy();
    this.popupTween?.stop();
    this.scene?.tweens?.killTweensOf(
      [this, this.light, this.shaft, this.bloom, ...this.motes, ...this.wisps].filter(Boolean) as object[]
    );
    this.popup?.destroy();
    super.destroy(fromScene);
  }
}

/** Factory registered for `kind: "door"` (see objects/register.ts). */
export function spawnDoor(config: DoorConfig, ctx: SpawnContext): void {
  ctx.interaction.add(new Door(ctx.scene, config, ctx));
}
