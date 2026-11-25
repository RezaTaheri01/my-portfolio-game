import Phaser from "phaser";

type Pose = "idle" | "run" | "jump" | "fall";
type Rect = [x: number, y: number, w: number, h: number];

// Celeste-inspired climber. Outline, skin, pants, boots and the
// wood / gold belt are shared with Sajjad and the bear, so the whole
// cast still reads as one set of characters.
const C = {
  outline: 0x211b2b,

  // Red hair (the Celeste signature)
  hairDark: 0x8f2a2f,
  hair: 0xd8433a,
  hairLight: 0xff7a59,

  // Skin (Sajjad's ramp, a little paler)
  skin: 0xf2c49b,
  skinLight: 0xffe2bd,
  skinShadow: 0xd99578,
  blush: 0xe8826f,

  // Climbing jacket
  jacketDark: 0x2a4f8f,
  jacket: 0x3f78c4,
  jacketLight: 0x6fa8e8,
  cuff: 0xf5efe3,

  // Shared with the NPCs
  pants: 0x34394f,
  pantsLight: 0x4c5570,
  boot: 0x302431,
  bootLight: 0x715044,
  wood: 0x805137,
  gold: 0xf2c66d,
} as const;

export class PlayerAppearance extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;
  private textures: string[] = [];
  // Kept separately: on scene shutdown Phaser may destroy this container before
  // Player.destroy() calls destroy() again, and by then `this.scene` is undefined.
  private readonly textureManager: Phaser.Textures.TextureManager;
  private readonly prefix: string;

  private pose: Pose = "idle";
  private frame = 0;
  private lastFrameTime = 0;

  private static nextId = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.textureManager = scene.textures;

    this.prefix = `adventurer-${PlayerAppearance.nextId++}`;

    this.generateTextures();

    this.sprite = scene.add.sprite(0, 0, this.textureKey("idle", 0));
    this.sprite.setOrigin(0.5);
    this.sprite.setScale(2);
    this.sprite.setFlipX(true);
    this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    this.add(this.sprite);
    this.setSize(48, 64);

    scene.add.existing(this);
  }

  private textureKey(pose: Pose, frame: number): string {
    return `${this.prefix}-${pose}-${frame}`;
  }

  private frameCount(pose: Pose): number {
    switch (pose) {
      case "idle": return 2;
      case "run": return 4;
      case "jump": return 1;
      case "fall": return 1;
    }
  }

  private generateTextures(): void {
    const poses: Pose[] = ["idle", "run", "jump", "fall"];

    for (const pose of poses) {
      for (let frame = 0; frame < this.frameCount(pose); frame++) {
        const key = this.textureKey(pose, frame);
        this.drawFrame(key, pose, frame);
        this.textures.push(key);
      }
    }
  }

  // The ponytail trails behind her (art faces left, tail goes right).
  // It reacts to the pose: it streams out when running, drops when
  // jumping and whips upward when falling.
  private hairTail(pose: Pose, frame: number, bob: number): Rect[] {
    switch (pose) {
      case "run": {
        const wave = [0, 1, 0, -1][frame % 4];
        return [
          [17, 5, 3, 3],
          [19, 7 + wave, 3, 3],
          [21, 9 + wave * 2, 2, 3],
        ];
      }
      case "jump":
        return [
          [17, 5, 3, 3],
          [18, 8, 3, 4],
          [18, 12, 3, 3],
        ];
      case "fall":
        return [
          [17, 5, 3, 3],
          [19, 3, 3, 3],
          [20, 1, 2, 3],
        ];
      default:
        return [
          [17, 5 + bob, 3, 3],
          [18, 8 + bob, 3, 3],
          [18 + bob, 11 + bob, 2, 3],
        ];
    }
  }

  private drawFrame(key: string, pose: Pose, frame: number): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });

    const px = (color: number, x: number, y: number, w = 1, h = 1) => {
      g.fillStyle(color, 1);
      g.fillRect(x, y, w, h);
    };

    const running = pose === "run";
    const jumping = pose === "jump";
    const falling = pose === "fall";

    const step = running ? (frame % 2 === 0 ? 2 : -2) : 0;
    const bob = pose === "idle" && frame === 1 ? 1 : 0;

    const leftLegX = 8 + step;
    const rightLegX = 13 - step;
    const legY = 24;

    // ---------- Ponytail (behind everything) ----------

    const tail = this.hairTail(pose, frame, bob);

    for (const [x, y, w, h] of tail) {
      px(C.outline, x - 1, y - 1, w + 2, h + 2);
    }
    for (const [x, y, w, h] of tail) {
      px(C.hairDark, x, y, w, h);
      px(C.hair, x, y, Math.max(1, w - 1), h);
    }
    // Tail highlight
    px(C.hairLight, tail[0][0], tail[0][1], 1, 2);

    // ---------- Legs ----------

    px(C.outline, leftLegX, legY, 5, 8);
    px(C.outline, rightLegX, legY, 5, 8);

    px(C.pants, leftLegX + 1, legY, 3, 5);
    px(C.pants, rightLegX + 1, legY, 3, 5);
    px(C.pantsLight, leftLegX + 1, legY, 1, 4);
    px(C.pantsLight, rightLegX + 1, legY, 1, 4);

    // Boots
    px(C.boot, leftLegX - 1, legY + 5, 6, 3);
    px(C.boot, rightLegX - 1, legY + 5, 6, 3);
    px(C.bootLight, leftLegX, legY + 5, 3, 1);
    px(C.bootLight, rightLegX, legY + 5, 3, 1);

    // ---------- Far arm (behind the jacket) ----------

    const armY = jumping ? 9 : falling ? 12 : 13;
    const swing = running ? (frame % 2 === 0 ? 1 : -1) : 0;

    px(C.outline, 17, armY + bob - swing, 4, 9);
    px(C.jacketDark, 18, armY + 1 + bob - swing, 2, 5);
    px(C.cuff, 18, armY + 5 + bob - swing, 2, 1);
    px(C.skin, 18, armY + 6 + bob - swing, 2, 2);

    // ---------- Jacket ----------

    px(C.outline, 6, 12 + bob, 12, 13);
    px(C.jacketDark, 7, 13 + bob, 10, 11);
    px(C.jacket, 8, 13 + bob, 8, 9);
    px(C.jacketLight, 8, 14 + bob, 2, 6);

    // Zipper (offset toward her facing side)
    px(C.jacketDark, 10, 15 + bob, 1, 7);

    // Belt: same wood and gold as the NPC props
    px(C.outline, 7, 21 + bob, 10, 3);
    px(C.wood, 8, 22 + bob, 8, 1);
    px(C.gold, 9, 21 + bob, 2, 3);

    // ---------- Near arm ----------

    px(C.outline, 4, armY + bob + swing, 4, 9);
    px(C.jacket, 5, armY + 1 + bob + swing, 2, 5);
    px(C.jacketLight, 5, armY + 1 + bob + swing, 1, 3);
    px(C.cuff, 5, armY + 5 + bob + swing, 2, 1);
    px(C.skin, 5, armY + 6 + bob + swing, 2, 2);

    // ---------- Collar ----------

    px(C.outline, 7, 11 + bob, 9, 3);
    px(C.jacketDark, 8, 12 + bob, 7, 2);
    px(C.jacketLight, 8, 12 + bob, 3, 1);

    // ---------- Head ----------

    // Back hair: rounded, shoulder length, tucked behind the face
    px(C.outline, 6, 1 + bob, 12, 3);
    px(C.outline, 5, 3 + bob, 14, 8);
    px(C.outline, 6, 11 + bob, 11, 2);
    px(C.hairDark, 7, 2 + bob, 10, 2);
    px(C.hairDark, 6, 4 + bob, 12, 6);
    px(C.hair, 7, 2 + bob, 9, 2);
    px(C.hair, 6, 4 + bob, 9, 5);
    px(C.hairDark, 7, 10 + bob, 9, 1);

    // Face (wider, with the jaw showing)
    px(C.outline, 6, 5 + bob, 10, 8);
    px(C.skin, 7, 5 + bob, 8, 7);
    px(C.skinShadow, 8, 11 + bob, 6, 1);

    // Bangs swept across the forehead, ending in a point
    px(C.hair, 7, 2 + bob, 9, 3);
    px(C.hair, 7, 5 + bob, 6, 1);
    px(C.hair, 7, 6 + bob, 2, 1);
    px(C.hairLight, 8, 3 + bob, 4, 1);
    px(C.hairLight, 7, 4 + bob, 2, 1);

    // Side lock framing the left cheek
    px(C.hair, 6, 6 + bob, 2, 5);
    px(C.hairDark, 6, 9 + bob, 2, 2);
    px(C.hairLight, 6, 6 + bob, 1, 2);

    // Eyes (looking left) + tiny shine
    px(C.outline, 8, 7 + bob, 2, 2);
    px(C.outline, 12, 7 + bob, 2, 2);
    px(C.skinLight, 8, 7 + bob, 1, 1);
    px(C.skinLight, 12, 7 + bob, 1, 1);

    // Blush + small mouth
    px(C.blush, 8, 9 + bob, 2, 1);
    px(C.blush, 13, 9 + bob, 1, 1);
    px(C.skinShadow, 10, 10 + bob, 2, 1);

    g.generateTexture(key, 24, 36);
    g.destroy();

    // Apply pixel-art filtering to every animation frame.
    this.scene.textures
      .get(key)
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  public setFacing(facingLeft: boolean): void {
    this.sprite.setFlipX(facingLeft);
  }

  public updateAnimation(
    direction: number,
    grounded: boolean,
    velocityY: number,
    time: number
  ): void {
    let nextPose: Pose;

    if (!grounded && velocityY < -20) {
      nextPose = "jump";
    } else if (!grounded) {
      nextPose = "fall";
    } else if (Math.abs(direction) > 0) {
      nextPose = "run";
    } else {
      nextPose = "idle";
    }

    if (nextPose !== this.pose) {
      this.pose = nextPose;
      this.frame = 0;
      this.lastFrameTime = time;
    }

    const duration = nextPose === "run" ? 110 : 260;

    if (time - this.lastFrameTime >= duration) {
      this.frame = (this.frame + 1) % this.frameCount(nextPose);
      this.lastFrameTime = time;
    }

    this.sprite.setTexture(this.textureKey(this.pose, this.frame));
  }

  public destroy(fromScene?: boolean): void {
    for (const key of this.textures) {
      if (this.textureManager.exists(key)) {
        this.textureManager.remove(key);
      }
    }
    this.textures = []; // destroy() can run twice during shutdown

    super.destroy(fromScene);
  }
}