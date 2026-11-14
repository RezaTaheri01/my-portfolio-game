
import Phaser from "phaser";

type Pose = "idle" | "run" | "jump" | "fall";

export class PlayerAppearance extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;
  private textures: string[] = [];
  private readonly prefix: string;

  private pose: Pose = "idle";
  private frame = 0;
  private lastFrameTime = 0;

  private static nextId = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

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

  private drawFrame(key: string, pose: Pose, frame: number): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });

    const px = (
      color: number,
      x: number,
      y: number,
      w = 1,
      h = 1
    ) => {
      g.fillStyle(color, 1);
      g.fillRect(x, y, w, h);
    };

    // Palette
    const outline = 0x211b2b;
    const hair = 0x713b38;
    const hairLight = 0xb96b50;
    const skin = 0xf2c49b;
    const skinShadow = 0xd99578;
    const teal = 0x277d79;
    const tealLight = 0x54b5a0;
    const tealDark = 0x19534f;
    const gold = 0xf2c66d;
    const pants = 0x34394f;
    const boot = 0x302431;

    const running = pose === "run";
    const jumping = pose === "jump";
    const falling = pose === "fall";

    const step = running
      ? (frame % 2 === 0 ? 2 : -2)
      : 0;

    const bob = pose === "idle" && frame === 1 ? 1 : 0;

    const leftLegX = 9 + step;
    const rightLegX = 14 - step;
    const legY = jumping ? 23 : falling ? 24 : 24;

    // Back hair
    px(outline, 8, 3 + bob, 9, 12);
    px(hair, 9, 4 + bob, 7, 10);
    px(hairLight, 10, 5 + bob, 2, 4);

    // Legs
    px(outline, leftLegX, legY, 5, 8);
    px(outline, rightLegX, legY, 5, 8);

    px(pants, leftLegX + 1, legY, 3, 5);
    px(pants, rightLegX + 1, legY, 3, 5);

    // Boots
    px(boot, leftLegX - 1, legY + 5, 6, 3);
    px(boot, rightLegX - 1, legY + 5, 6, 3);
    px(0x715044, leftLegX, legY + 5, 3, 1);
    px(0x715044, rightLegX, legY + 5, 3, 1);

    // Cloak silhouette
    px(outline, 5, 11 + bob, 17, 15);
    px(tealDark, 6, 12 + bob, 15, 12);
    px(teal, 7, 12 + bob, 13, 10);
    px(tealLight, 8, 13 + bob, 2, 6);

    // Arms
    const armY = jumping ? 9 : falling ? 14 : 13;

    px(outline, 4, armY + bob, 5, 8);
    px(outline, 18, armY + bob, 5, 8);

    px(teal, 5, armY + 1 + bob, 3, 5);
    px(teal, 19, armY + 1 + bob, 3, 5);

    px(skin, 5, armY + 6 + bob, 3, 2);
    px(skin, 19, armY + 6 + bob, 3, 2);

    // Tunic
    px(outline, 8, 10 + bob, 11, 15);
    px(tealDark, 9, 11 + bob, 9, 12);
    px(teal, 10, 11 + bob, 7, 10);
    px(tealLight, 10, 12 + bob, 2, 5);

    // Belt
    px(outline, 9, 19 + bob, 10, 3);
    px(0x805137, 10, 20 + bob, 8, 1);
    px(gold, 13, 19 + bob, 2, 3);

    // Gold shoulder strap
    px(0x805137, 16, 11 + bob, 2, 7);
    px(gold, 16, 13 + bob, 1, 3);

    // Neck
    px(outline, 11, 7 + bob, 5, 5);
    px(skin, 12, 8 + bob, 3, 4);

    // Hood
    px(outline, 7, 1 + bob, 13, 12);
    px(tealDark, 8, 2 + bob, 11, 9);
    px(teal, 9, 2 + bob, 9, 8);
    px(tealLight, 9, 3 + bob, 2, 4);

    // Face
    px(outline, 9, 3 + bob, 9, 9);
    px(skin, 10, 4 + bob, 7, 7);
    px(skinShadow, 10, 9 + bob, 7, 2);

    // Hair fringe
    px(hair, 9, 2 + bob, 9, 4);
    px(hairLight, 11, 2 + bob, 4, 1);
    px(hair, 9, 4 + bob, 2, 4);
    px(hair, 16, 4 + bob, 2, 4);

    // Eyes
    px(outline, 11, 7 + bob, 1, 1);
    px(outline, 15, 7 + bob, 1, 1);

    // Small face highlight
    px(0xffe2bd, 12, 5 + bob, 2, 1);

    // Hood details
    px(gold, 8, 10 + bob, 2, 1);
    px(gold, 17, 10 + bob, 2, 1);

    // Small cloak clasp
    px(gold, 17, 13 + bob, 2, 2);

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
      if (this.scene.textures.exists(key)) {
        this.scene.textures.remove(key);
      }
    }

    super.destroy(fromScene);
  }
}
