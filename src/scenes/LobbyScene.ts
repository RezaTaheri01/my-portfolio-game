import Phaser from "phaser";

import { Player } from "../objects/Player";
import { LobbyInteractable } from "../objects/LobbyInteractable";
import { SajjadNPC } from "../objects/SajjadNPC";
import { InteractionManager } from "../systems/InteractionManager";
import { GAME_FONT } from "../game/theme";

// ========================================
// CONFIG
// ========================================

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 720;
const GROUND_Y = 640;

const COLORS = {
  skyTop: 0x0b1718,
  skyBottom: 0x1b3025,
  ground: 0x263e2d,
  fire: 0xffa34d,
  playerLight: 0xffc078,
};

const WELCOME_MESSAGE = `Welcome, traveler!

You've just stepped into Reza's world.

Reza is a Computer Engineer and Unity Developer — a sharp-eyed ISTJ who reads patterns like a detective and logs bugs like a bounty hunter.

He builds games in C#, crafts backends with Python & Django, ships Telegram bots, and is currently leveling up in Machine Learning.

Explore the world to uncover his projects, experiments, and skills.

Every path leads somewhere different in his journey.

Take your time. There's a lot to discover!`;

interface ForestLayer {
  depth: number;
  count: number;
  step: number;
  startX: number;
  baseY: number;
  height: [base: number, mod: number, prime: number];
  width: [base: number, mod: number, prime: number];
  trunkColor: number;
  leafColors: [number, number];
  trunk: [x: number, w: number, h: number];
  canopyY: number;
  canopyH: number;
  sideX: number;
  sideY: number;
  sideW: number;
  sideH: number;
}

const FAR_FOREST: ForestLayer = {
  depth: -32, count: 35, step: 82, startX: -20, baseY: 590,
  height: [170, 120, 47], width: [75, 55, 19],
  trunkColor: 0x172d25, leafColors: [0x193529, 0x1c3a2d],
  trunk: [0.42, 0.16, 0.65],
  canopyY: 0.75, canopyH: 0.65,
  sideX: 0.2, sideY: 0.65, sideW: 0.75, sideH: 0.55,
};

const MID_FOREST: ForestLayer = {
  depth: -29, count: 24, step: 118, startX: -45, baseY: 640,
  height: [220, 130, 61], width: [100, 65, 23],
  trunkColor: 0x182e22, leafColors: [0x203e2b, 0x25442f],
  trunk: [0.4, 0.2, 0.7],
  canopyY: 0.78, canopyH: 0.52,
  sideX: 0.18, sideY: 0.66, sideW: 0.72, sideH: 0.48,
};

type Graphics = Phaser.GameObjects.Graphics;

/** Fill an ellipse in one call. */
const ellipse = (
  g: Graphics, color: number, x: number, y: number,
  w: number, h: number, alpha = 1
) => g.fillStyle(color, alpha).fillEllipse(x, y, w, h);

export class BootScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private interactionManager!: InteractionManager;
  private playerLight!: Phaser.GameObjects.Light;
  private sajjad!: SajjadNPC;

  constructor() {
    super("BootScene");
  }

  // ========================================
  // LIFECYCLE
  // ========================================

  create(): void {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.lights.enable().setAmbientColor(0x999b80);

    this.createTextures();
    this.createOutdoorLobby();
    this.createPlatforms();
    this.createPlayer();

    this.interactionManager = new InteractionManager(this, this.player);

    this.createWelcomeSign();
    this.createCampfireArea();
    this.createFireflies();
    this.setupCamera();
    this.createUI();
  }

  update(time: number): void {
    this.player.update();
    this.sajjad?.update(time);
    this.interactionManager.update();
    this.playerLight.setPosition(this.player.x, this.player.y - 10);
  }

  // ========================================
  // SETUP
  // ========================================

  private createPlayer(): void {
    this.player = new Player(this, 180, 600);
    this.physics.add.collider(this.player, this.platforms);

    this.playerLight = this.lights.addLight(
      this.player.x, this.player.y, 150, COLORS.playerLight, 0.35
    );
  }

  private createPlatforms(): void {
    this.platforms = this.physics.add.staticGroup();
    this.platforms.create(WORLD_WIDTH / 2, GROUND_Y + 60, "ground");
  }

  private createWelcomeSign(): void {
    this.interactionManager.add(
      new LobbyInteractable(this, {
        x: 600,
        y: 625,
        groundY: GROUND_Y,
        boardWidth: 140,
        boardHeight: 66,
        signTitle: "WELCOME",
        title: "Welcome to REZA.EXE",
        dialogs: [WELCOME_MESSAGE],
      })
    );
  }

  private setupCamera(): void {
    const camera = this.cameras.main;
    camera.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    camera.startFollow(this.player, true, 0.1, 0.1);
  }

  private createUI(): void {
    const style = (size: string, color: string, strokeThickness: number) => ({
      fontFamily: GAME_FONT,
      fontSize: size,
      color,
      stroke: "#101426",
      strokeThickness,
    });

    this.add
      .text(24, 20, "REZA's DEV WORLD", {
        ...style("20px", "#f1e9d5", 4),
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.add
      .text(
        24, 52,
        "A / D or ARROWS: Move     SPACE: Jump     E: Interact",
        style("13px", "#d5dfc0", 3)
      )
      .setScrollFactor(0)
      .setDepth(100);
  }

  // ========================================
  // TEXTURES
  // ========================================

  private createTextures(): void {
    this.makeTexture("firefly", 8, 8, (g) => {
      g.fillStyle(0xffffff, 1).fillCircle(4, 4, 3);
    });

    // Soft radial glow built from concentric circles
    this.makeTexture("soft-glow", 128, 128, (g) => {
      [[62, 0.025], [46, 0.04], [28, 0.07], [12, 0.12]].forEach(
        ([radius, alpha]) => g.fillStyle(0xffffff, alpha).fillCircle(64, 64, radius)
      );
    });

    this.makeTexture("ground", WORLD_WIDTH, 120, (g) => {
      g.fillStyle(COLORS.ground, 1).fillRect(0, 0, WORLD_WIDTH, 120);
      g.fillStyle(0x527442, 1).fillRect(0, 0, WORLD_WIDTH, 7);

      g.fillStyle(0x35543a, 1);
      for (let i = 0; i < 180; i++) {
        g.fillRect(
          Phaser.Math.Between(0, WORLD_WIDTH),
          Phaser.Math.Between(12, 115),
          Phaser.Math.Between(2, 9),
          2
        );
      }
    });
  }

  private makeTexture(
    key: string, width: number, height: number,
    draw: (g: Graphics) => void
  ): void {
    if (this.textures.exists(key)) return;

    const g = this.make.graphics({ x: 0, y: 0 });
    draw(g);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  // ========================================
  // OUTDOOR LOBBY
  // ========================================

  private createOutdoorLobby(): void {
    this.createSky();
    this.createForest(FAR_FOREST);
    this.createForest(MID_FOREST);

    this.add
      .graphics()
      .setDepth(-20)
      .fillStyle(COLORS.ground, 1)
      .fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);

    this.createBushes();
    this.createPath();
    this.createForegroundFoliage();
    this.createGroundDetails();
    this.createMushrooms();
  }

  private createSky(): void {
    const sky = this.add.graphics().setDepth(-40);
    sky.fillGradientStyle(
      COLORS.skyTop, COLORS.skyTop, COLORS.skyBottom, COLORS.skyBottom, 1
    );
    sky.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Moon (second circle carves out a crescent)
    this.add.circle(1430, 125, 48, 0xd5d9ad, 0.9).setDepth(-39);
    this.add.circle(1450, 112, 45, COLORS.skyTop, 0.65).setDepth(-38);

    const stars = this.add.graphics().setDepth(-37);
    for (let i = 0; i < 110; i++) {
      stars.fillStyle(0xdce8bd, 0.35 + (i % 4) * 0.12);
      stars.fillCircle(
        (i * 173) % WORLD_WIDTH,
        25 + ((i * 97) % 260),
        i % 5 === 0 ? 2 : 1
      );
    }
  }

  private createForest(layer: ForestLayer): void {
    const g = this.add.graphics().setDepth(layer.depth);
    const { baseY, trunk } = layer;

    for (let i = 0; i < layer.count; i++) {
      const x = i * layer.step + layer.startX;
      const h = layer.height[0] + ((i * layer.height[2]) % layer.height[1]);
      const w = layer.width[0] + ((i * layer.width[2]) % layer.width[1]);

      // Trunk
      g.fillStyle(layer.trunkColor, 1);
      g.fillRect(
        x + w * trunk[0],
        baseY - h * trunk[2],
        w * trunk[1],
        h * trunk[2]
      );

      // Canopy: one center blob and two side blobs
      const leaf = layer.leafColors[i % 2];
      const sideY = baseY - h * layer.sideY;
      ellipse(g, leaf, x + w / 2, baseY - h * layer.canopyY, w, h * layer.canopyH);
      ellipse(g, leaf, x + w * layer.sideX, sideY, w * layer.sideW, h * layer.sideH);
      ellipse(g, leaf, x + w * (1 - layer.sideX), sideY, w * layer.sideW, h * layer.sideH);
    }
  }

  private createBushes(): void {
    const g = this.add.graphics().setDepth(-18);

    for (let i = 0; i < 75; i++) {
      const x = (i * 137) % WORLD_WIDTH;
      const y = 520 + ((i * 31) % 105);
      const size = 30 + ((i * 17) % 35);
      const color = i % 3 === 0 ? 0x1d402b : 0x285137;

      ellipse(g, color, x, y, size * 1.8, size);
      ellipse(g, color, x - size * 0.45, y + 5, size, size * 0.85);
      ellipse(g, color, x + size * 0.45, y + 3, size, size * 0.9);
    }
  }

  private createPath(): void {
    const g = this.add.graphics().setDepth(-16);
    ellipse(g, 0x594633, 1150, 645, 1700, 55, 0.9);
    ellipse(g, 0x76583a, 1150, 641, 1500, 18, 0.45);
  }

  private createForegroundFoliage(): void {
    const g = this.add.graphics().setDepth(-5);

    for (const startX of [0, WORLD_WIDTH - 180]) {
      for (let i = 0; i < 18; i++) {
        const x = startX + (i % 6) * 32;
        const y = 450 + Math.floor(i / 6) * 55;
        const size = 35 + (i % 4) * 8;
        const color = i % 2 === 0 ? 0x254b31 : 0x315b39;

        ellipse(g, color, x, y, size * 1.8, size);
        ellipse(g, color, x - 10, y + 8, size, size * 0.8);
        ellipse(g, color, x + 12, y + 7, size, size * 0.85);
      }
    }
  }

  private createGroundDetails(): void {
    const g = this.add.graphics().setDepth(-4);

    for (let i = 0; i < 45; i++) {
      const size = 5 + (i % 9);
      ellipse(
        g,
        i % 2 === 0 ? 0x39483a : 0x4c5940,
        (i * 211) % WORLD_WIDTH,
        620 + ((i * 13) % 18),
        size * 2,
        size
      );
    }
  }

  private createMushrooms(): void {
    const g = this.add.graphics().setDepth(1);

    const clusters = [
      { x: 310, count: 3 }, { x: 470, count: 2 },
      { x: 820, count: 4 }, { x: 1120, count: 2 },
      { x: 1510, count: 3 }, { x: 1840, count: 4 },
      { x: 2200, count: 3 }, { x: 2440, count: 3 },
    ];
    const capColors = [0xc85b4b, 0xd58a45, 0xb66b9c, 0xd6bd70];

    for (const { x: clusterX, count } of clusters) {
      for (let i = 0; i < count; i++) {
        const x = clusterX + i * 17 - count * 8;
        const scale = 0.65 + ((i * 13 + clusterX) % 5) * 0.12;
        const height = 17 * scale;
        const stemWidth = 5 * scale;
        const capWidth = 17 * scale;
        const capHeight = 11 * scale;
        const capY = GROUND_Y - height;

        // Stem
        g.fillStyle(0xd9c9a0, 1);
        g.fillRoundedRect(x - stemWidth / 2, capY, stemWidth, height, 2);

        // Cap + highlight
        ellipse(g, capColors[i % capColors.length], x, capY + 2, capWidth, capHeight);
        ellipse(g, 0xffffff, x - capWidth * 0.18, capY, capWidth * 0.3, capHeight * 0.22, 0.3);

        // Spot
        if (i % 2 === 0) {
          g.fillStyle(0xf5e6c4, 0.8);
          g.fillCircle(x + capWidth * 0.15, capY + 1, 1.5 * scale);
        }
      }
    }
  }

  // ========================================
  // CAMPFIRE AREA
  // ========================================

  private createCampfireArea(): void {
    const logX = 975;

    this.createCampfire(1050, 620);
    this.createLog(logX, 635);

    // Sajjad sits sideways on the log
    this.sajjad = new SajjadNPC(this, logX, 635);
    this.interactionManager.add(this.sajjad);
  }

  private createLog(x: number, y: number): void {
    const bark = this.add.graphics();
    bark.lineStyle(2, 0x3d281e, 0.8);
    for (let i = -45; i <= 45; i += 20) {
      bark.lineBetween(i, -18, i + 10, 2);
    }

    const rings = this.add.graphics();
    rings.lineStyle(2, 0x5c3e2a, 0.8);
    rings.strokeEllipse(65, -8, 10, 17);
    rings.strokeEllipse(65, -8, 5, 10);

    const body = this.add.rectangle(0, -8, 130, 28, 0x5b3826);
    body.setStrokeStyle(3, 0x2e211b);

    this.add
      .container(x, y, [
        // this.add.ellipse(0, 8, 145, 25, 0x101812, 0.55), // shadow
        body,
        this.add.rectangle(0, -16, 112, 7, 0x8a5b38), // highlight
        bark,
        this.add.ellipse(-65, -8, 20, 28, 0x3e281e), // left end
        this.add.ellipse(65, -8, 20, 28, 0x8b6240), // right end
        rings,
      ])
      .setDepth(3);
  }

  private createCampfire(x: number, y: number): void {
    // Glow sprite
    const glow = this.add
      .image(x, y - 35, "soft-glow")
      .setScale(3.5)
      .setTint(COLORS.fire)
      .setAlpha(0.85)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(1);

    // Dynamic light
    const fireLight = this.lights.addLight(x, y - 30, 300, COLORS.fire, 2);

    const flicker = (targets: object, props: object, duration: number) =>
      this.tweens.add({
        targets,
        ...props,
        duration,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

    flicker(fireLight, { intensity: { from: 1.5, to: 2.3 } }, 450);
    flicker(
      glow,
      { alpha: { from: 0.65, to: 0.95 }, scale: { from: 3.2, to: 3.8 } },
      550
    );

    // Stones
    const stones = this.add.graphics().setDepth(2);
    const stonePositions = [
      [-40, 0], [-28, 10], [0, 15], [30, 10], [42, 0], [20, -5], [-20, -5],
    ];
    for (const [sx, sy] of stonePositions) {
      ellipse(stones, 0x434b3c, x + sx, y + sy, 22, 15);
      ellipse(stones, 0x77806a, x + sx - 3, y + sy - 4, 8, 4, 0.7);
    }

    // Wood
    const wood = this.add.graphics().setDepth(3);
    wood.fillStyle(0x493126, 1).fillRoundedRect(x - 36, y - 12, 72, 12, 5);
    wood.fillStyle(0x775039, 1).fillRoundedRect(x - 28, y - 24, 58, 11, 5);
    wood.fillStyle(0x33251f, 1);
    wood.fillCircle(x - 28, y - 18, 4);
    wood.fillCircle(x + 25, y - 18, 4);

    // Flames
    const flames = this.add
      .container(x, y - 25, [
        this.add.ellipse(0, -17, 48, 65, 0xe85c28),
        this.add.ellipse(0, -16, 32, 48, 0xff9b35),
        this.add.ellipse(0, -13, 17, 32, 0xffdf79),
      ])
      .setDepth(4);

    flicker(
      flames,
      { scaleX: { from: 0.9, to: 1.12 }, scaleY: { from: 0.95, to: 1.08 } },
      220
    );

    // Embers
    this.add
      .particles(x, y - 50, "firefly", {
        lifespan: { min: 600, max: 1600 },
        speedX: { min: -25, max: 25 },
        speedY: { min: -70, max: -25 },
        scale: { start: 0.8, end: 0 },
        alpha: { start: 1, end: 0 },
        frequency: 100,
        quantity: 1,
        tint: [0xffd16a, 0xff873d, 0xffed9c],
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(5);
  }

  // ========================================
  // ATMOSPHERE
  // ========================================

  private createFireflies(): void {
    this.add
      .particles(0, 0, "firefly", {
        x: { min: 0, max: WORLD_WIDTH },
        y: { min: 280, max: GROUND_Y - 15 },
        lifespan: { min: 3500, max: 6500 },
        speedX: { min: -12, max: 12 },
        speedY: { min: -10, max: 10 },
        scale: { start: 0.8, end: 0.1 },
        alpha: { start: 0, end: 0.9 },
        frequency: 100,
        quantity: 1,
        tint: [0xd9ff91, 0xa6e88b, 0xf6e7a1],
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(3);
  }
}