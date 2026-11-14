
import Phaser from "phaser";
import { PlayerAppearance } from "./PlayerAppearance";

export class Player extends Phaser.Physics.Arcade.Sprite {
  private appearance!: PlayerAppearance;

  // Movement
  private readonly speed = 280;
  private readonly jumpForce = 700;
  private readonly gravity = 1400;
  private readonly fallGravityMultiplier = 1.35;
  private readonly jumpCutMultiplier = 0.45;
  private readonly coyoteTime = 100;
  private readonly jumpBufferTime = 120;

  // Visual alignment
  // Character texture: 36px high, scaled by 2.
  // Feet end at approximately y = 32.
  private readonly visualFeetOffset = 28;

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private keys!: {
    A: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    W: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
  };

  // Jump state
  private lastGroundedTime = -Infinity;
  private jumpPressedTime = -Infinity;
  private jumpCutApplied = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Create hidden physics texture
    if (!scene.textures.exists("player")) {
      const graphics = scene.make.graphics({ x: 0, y: 0 });

      graphics.fillStyle(0xffffff);
      graphics.fillRect(0, 0, 40, 70);

      graphics.generateTexture("player", 40, 70);
      graphics.destroy();
    }

    super(scene, x, y, "player");

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Hide physics sprite
    this.setVisible(false);

    // Physics
    this.setCollideWorldBounds(true);
    this.setGravityY(this.gravity);

    const body = this.body as Phaser.Physics.Arcade.Body;

    body.setSize(28, 60);
    body.setOffset(6, 6);
    body.setMaxVelocity(this.speed, 900);
    body.setDragX(1800);
    body.setCollideWorldBounds(true);

    // Visible character
    this.appearance = new PlayerAppearance(scene);
    this.appearance.setDepth(10);

    // Initial visual alignment
    this.syncAppearance(0);

    // Keyboard
    this.cursors = scene.input.keyboard!.createCursorKeys();

    this.keys = scene.input.keyboard!.addKeys({
      A: Phaser.Input.Keyboard.KeyCodes.A,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      W: Phaser.Input.Keyboard.KeyCodes.W,
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
    }) as typeof this.keys;
  }

  // --------------------------------
  // VISUAL SYNC
  // --------------------------------

  private syncAppearance(direction: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    // Align the character's feet with the physics body's bottom.
    this.appearance.setPosition(
      this.x,
      body.bottom - this.visualFeetOffset
    );

    // PlayerAppearance.setFacing() expects a boolean.
    // The original character faces right.
    if (direction !== 0) {
      this.appearance.setFacing(direction > 0);
    }
  }

  // --------------------------------
  // UPDATE
  // --------------------------------

  public update(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const now = this.scene.time.now;

    // Input
    const left =
      this.cursors.left.isDown || this.keys.A.isDown;

    const right =
      this.cursors.right.isDown || this.keys.D.isDown;

    const jumpDown =
      this.cursors.up.isDown ||
      this.keys.W.isDown ||
      this.keys.SPACE.isDown;

    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.keys.W) ||
      Phaser.Input.Keyboard.JustDown(this.keys.SPACE);

    if (jumpPressed) {
      this.jumpPressedTime = now;
    }

    // Ground detection
    const grounded = body.blocked.down || body.touching.down;

    if (grounded) {
      this.lastGroundedTime = now;
    }

    // Horizontal movement
    const direction = Number(right) - Number(left);

    if (direction !== 0) {
      body.setAccelerationX(direction * 2200);
    } else {
      body.setAccelerationX(0);
    }

    // Jump buffering and coyote time
    const canCoyoteJump =
      now - this.lastGroundedTime <= this.coyoteTime;

    const hasBufferedJump =
      now - this.jumpPressedTime <= this.jumpBufferTime;

    if (canCoyoteJump && hasBufferedJump) {
      body.setVelocityY(-this.jumpForce);

      this.jumpPressedTime = -Infinity;
      this.lastGroundedTime = -Infinity;
      this.jumpCutApplied = false;
    }

    // Variable jump height
    if (
      !jumpDown &&
      body.velocity.y < 0 &&
      !this.jumpCutApplied
    ) {
      body.setVelocityY(
        body.velocity.y * this.jumpCutMultiplier
      );

      this.jumpCutApplied = true;
    }

    // Stronger falling gravity
    if (body.velocity.y > 0) {
      body.setAccelerationY(
        this.gravity * (this.fallGravityMultiplier - 1)
      );
    } else {
      body.setAccelerationY(0);
    }

    // Animation
    this.appearance.updateAnimation(
      direction,
      grounded,
      body.velocity.y,
      now
    );

    // Update visible character
    this.syncAppearance(direction);
  }

  // --------------------------------
  // DESTROY
  // --------------------------------

  public destroy(fromScene?: boolean): void {
    this.appearance?.destroy();
    super.destroy(fromScene);
  }
}
