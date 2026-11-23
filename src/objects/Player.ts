import Phaser from "phaser";
import { PlayerAppearance } from "./PlayerAppearance";

// ========================================
// CONSTANTS
// ========================================

const SPEED = 280;
const ACCELERATION = 2200;
const DRAG_X = 1800;
const MAX_FALL_SPEED = 900;

const JUMP_FORCE = 700;
const GRAVITY = 1400;
const FALL_GRAVITY_MULTIPLIER = 1.35;
const JUMP_CUT_MULTIPLIER = 0.45;
const COYOTE_TIME = 100;
const JUMP_BUFFER_TIME = 120;

// Analog stick values below this are ignored (drift).
const PAD_DEADZONE = 0.3;

// Distance from the physics body's bottom to the character's feet.
const VISUAL_FEET_OFFSET = 28;

const TOUCH_COLORS = {
  normal: 0x172c23,
  pressed: 0xb56a35,
  border: 0xb58a59,
  borderPressed: 0xffc078,
  glyph: 0xfff0d2,
};

type Triangle = readonly [number, number, number, number, number, number];

// Arrow triangles, relative to the button center. Drawn as shapes (not font
// glyphs) so they stay pixel-stable and perfectly centered.
const TOUCH_GLYPHS = {
  left: [-9, 0, 7, -11, 7, 11],
  right: [9, 0, -7, -11, -7, 11],
  jump: [0, -9, -11, 7, 11, 7],
} as const satisfies Record<string, Triangle>;

type TouchAction = keyof typeof TOUCH_GLYPHS;

interface TouchButton {
  circle: Phaser.GameObjects.Arc;
  glyph: Phaser.GameObjects.Graphics;
  pointers: Set<number>;
}

// ========================================
// PLAYER
// ========================================

export class Player extends Phaser.Physics.Arcade.Sprite {
  private readonly appearance: PlayerAppearance;

  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly keys: Record<"A" | "D" | "W" | "SPACE", Phaser.Input.Keyboard.Key>;

  private touchButtons?: Record<TouchAction, TouchButton>;
  private touchJumpJustPressed = false;
  private padJumpWasDown = false;

  private lastGroundedTime = -Infinity;
  private jumpPressedTime = -Infinity;
  private jumpCutApplied = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    Player.ensureTexture(scene);
    super(scene, x, y, "player");

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // The sprite is only a hidden physics body; PlayerAppearance draws the character.
    this.setVisible(false).setGravityY(GRAVITY);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(28, 60).setOffset(6, 6);
    body.setMaxVelocity(SPEED, MAX_FALL_SPEED);
    body.setDragX(DRAG_X);
    body.setCollideWorldBounds(true);

    this.appearance = new PlayerAppearance(scene);
    this.appearance.setDepth(10);
    this.syncAppearance(0);

    const keyboard = scene.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys({
      A: Phaser.Input.Keyboard.KeyCodes.A,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      W: Phaser.Input.Keyboard.KeyCodes.W,
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
    }) as typeof this.keys;

    // Show touch controls on touch devices, or as soon as a real touch happens
    // (covers hybrid devices and browser device emulation toggled at runtime).
    if (scene.sys.game.device.input.touch || navigator.maxTouchPoints > 0) {
      this.enableTouchControls();
    } else {
      scene.input.on("pointerdown", this.onFirstTouch);
    }
  }

  private static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists("player")) return;

    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff).fillRect(0, 0, 40, 70);
    g.generateTexture("player", 40, 70);
    g.destroy();
  }

  // ========================================
  // TOUCH CONTROLS
  // ========================================

  private onFirstTouch = (pointer: Phaser.Input.Pointer): void => {
    if (!pointer.wasTouch) return;

    this.scene.input.off("pointerdown", this.onFirstTouch);
    this.enableTouchControls();
  };

  private enableTouchControls(): void {
    if (this.touchButtons) return;

    const { input, scale } = this.scene;

    // Default is 1 touch pointer; we need more to move and jump together.
    input.addPointer(2);

    const create = (action: TouchAction): TouchButton => {
      const button = this.createTouchButton(TOUCH_GLYPHS[action]);

      button.circle.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (action === "jump" && button.pointers.size === 0) {
          this.touchJumpJustPressed = true;
        }
        button.pointers.add(pointer.id);
        this.refreshTouchButton(button);
      });

      // Sliding a finger off a button releases it.
      button.circle.on("pointerout", this.onPointerUp);

      return button;
    };

    this.touchButtons = {
      left: create("left"),
      right: create("right"),
      jump: create("jump"),
    };

    input.on("pointerup", this.onPointerUp);
    input.on("gameout", this.onGameOut);
    scale.on("resize", this.layoutTouchControls, this);

    this.layoutTouchControls();
  }

  private createTouchButton(triangle: Triangle): TouchButton {
    const circle = this.scene.add
      .circle(0, 0, 32, TOUCH_COLORS.normal, 0.82)
      .setStrokeStyle(2, TOUCH_COLORS.border, 0.95)
      .setScrollFactor(0)
      .setDepth(900)
      .setInteractive();

    const glyph = this.scene.add
      .graphics()
      .fillStyle(TOUCH_COLORS.glyph)
      .fillTriangle(...triangle)
      .setScrollFactor(0)
      .setDepth(901);

    return { circle, glyph, pointers: new Set() };
  }

  private refreshTouchButton({ circle, pointers }: TouchButton): void {
    const pressed = pointers.size > 0;

    circle
      .setFillStyle(
        pressed ? TOUCH_COLORS.pressed : TOUCH_COLORS.normal,
        pressed ? 0.95 : 0.82
      )
      .setStrokeStyle(
        2,
        pressed ? TOUCH_COLORS.borderPressed : TOUCH_COLORS.border,
        1
      );
  }

  /** Releases one pointer from every button, or all pointers if no id is given. */
  private releaseTouch(pointerId?: number): void {
    for (const button of Object.values(this.touchButtons ?? {})) {
      if (pointerId === undefined) button.pointers.clear();
      else button.pointers.delete(pointerId);

      this.refreshTouchButton(button);
    }
  }

  private onPointerUp = (pointer: Phaser.Input.Pointer): void =>
    this.releaseTouch(pointer.id);

  private onGameOut = (): void => {
    this.touchJumpJustPressed = false;
    this.releaseTouch();
  };

  private layoutTouchControls = (): void => {
    if (!this.touchButtons) return;

    const { width, height } = this.scene.scale;
    const y = Math.round(height - 78);
    const x = { left: 55, right: 130, jump: Math.round(width - 65) };

    for (const action of Object.keys(this.touchButtons) as TouchAction[]) {
      const { circle, glyph } = this.touchButtons[action];
      circle.setPosition(x[action], y);
      glyph.setPosition(x[action], y);
    }
  };

  private isTouchDown(action: TouchAction): boolean {
    return (this.touchButtons?.[action].pointers.size ?? 0) > 0;
  }

  // ========================================
  // VISUAL SYNC
  // ========================================

  private syncAppearance(direction: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    this.appearance.setPosition(this.x, body.bottom - VISUAL_FEET_OFFSET);

    if (direction !== 0) {
      this.appearance.setFacing(direction > 0);
    }
  }

  // ========================================
  // GAMEPAD
  // ========================================

  /** Reads the first connected pad (needs `input: { gamepad: true }` in the game config). */
  private readPad(): { left: boolean; right: boolean; jumpDown: boolean; jumpPressed: boolean } {
    const pad = this.scene.input.gamepad?.getAll()[0];
    if (!pad) {
      this.padJumpWasDown = false;
      return { left: false, right: false, jumpDown: false, jumpPressed: false };
    }

    const stickX = pad.leftStick.x;
    const jumpDown = pad.A; // bottom face button (Xbox A / PlayStation Cross)
    const jumpPressed = jumpDown && !this.padJumpWasDown;
    this.padJumpWasDown = jumpDown;

    return {
      left: pad.left || stickX < -PAD_DEADZONE,
      right: pad.right || stickX > PAD_DEADZONE,
      jumpDown,
      jumpPressed,
    };
  }

  // ========================================
  // UPDATE
  // ========================================

  /** `suppressJump`: the jump button is being used for something else this frame (interacting). */
  public update(suppressJump = false): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const now = this.scene.time.now;

    // ---------- Input ----------

    const pad = this.readPad();

    const left =
      this.cursors.left.isDown || this.keys.A.isDown || this.isTouchDown("left") || pad.left;
    const right =
      this.cursors.right.isDown || this.keys.D.isDown || this.isTouchDown("right") || pad.right;

    const jumpKeys = [this.cursors.up, this.keys.W, this.keys.SPACE];

    // map() so every key's JustDown is consumed, not just the first one pressed.
    const jumpPressedRaw =
      jumpKeys.map((key) => Phaser.Input.Keyboard.JustDown(key)).some(Boolean) ||
      this.touchJumpJustPressed ||
      pad.jumpPressed;
    this.touchJumpJustPressed = false;
    const jumpPressed = jumpPressedRaw && !suppressJump;

    const jumpDown =
      jumpKeys.some((key) => key.isDown) || this.isTouchDown("jump") || pad.jumpDown;

    if (jumpPressed) this.jumpPressedTime = now;

    // ---------- Ground + horizontal movement ----------

    const grounded = body.blocked.down || body.touching.down;
    if (grounded) this.lastGroundedTime = now;

    const direction = Number(right) - Number(left);
    body.setAccelerationX(direction * ACCELERATION);

    // ---------- Jump (buffering + coyote time) ----------

    const canJump = now - this.lastGroundedTime <= COYOTE_TIME;
    const hasBufferedJump = now - this.jumpPressedTime <= JUMP_BUFFER_TIME;

    if (canJump && hasBufferedJump) {
      body.setVelocityY(-JUMP_FORCE);

      this.jumpPressedTime = -Infinity;
      this.lastGroundedTime = -Infinity;
      this.jumpCutApplied = false;
    }

    // Variable jump height: releasing early cuts the upward speed once.
    if (!jumpDown && body.velocity.y < 0 && !this.jumpCutApplied) {
      body.setVelocityY(body.velocity.y * JUMP_CUT_MULTIPLIER);
      this.jumpCutApplied = true;
    }

    // Heavier gravity while falling.
    body.setAccelerationY(
      body.velocity.y > 0 ? GRAVITY * (FALL_GRAVITY_MULTIPLIER - 1) : 0
    );

    // ---------- Visuals ----------

    this.appearance.updateAnimation(direction, grounded, body.velocity.y, now);
    this.syncAppearance(direction);
  }

  // ========================================
  // DESTROY
  // ========================================

  public destroy(fromScene?: boolean): void {
    const scene = this.scene;

    if (scene) {
      scene.input.off("pointerdown", this.onFirstTouch);
      scene.input.off("pointerup", this.onPointerUp);
      scene.input.off("gameout", this.onGameOut);
      scene.scale.off("resize", this.layoutTouchControls, this);
    }

    for (const { circle, glyph } of Object.values(this.touchButtons ?? {})) {
      circle.destroy();
      glyph.destroy();
    }

    this.appearance?.destroy();

    super.destroy(fromScene);
  }
}