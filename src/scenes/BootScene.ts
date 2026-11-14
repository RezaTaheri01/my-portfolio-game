
import Phaser from "phaser";

import { Player } from "../objects/Player";
import { LobbyInteractable } from "../objects/LobbyInteractable";
import { InteractionManager } from "../systems/InteractionManager";
import { GAME_FONT } from "../game/theme";

// ========================================
// WORLD CONFIGURATION
// ========================================

const WORLD_WIDTH = 2600;
const WORLD_HEIGHT = 720;
const GROUND_Y = 640;

const COLORS = {
  sky: 0x101c20,
  horizon: 0x233b32,

  distantTrees: 0x1c382c,
  nearTrees: 0x203d2b,

  ground: 0x263e2d,
  groundDark: 0x172c23,

  dirt: 0x594633,

  moon: 0xd5d9ad,
  fire: 0xffa34d,
  playerLight: 0xffc078,
};

export class BootScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;

  private interactionManager!: InteractionManager;

  private titleText!: Phaser.GameObjects.Text;
  private controlsText!: Phaser.GameObjects.Text;

  private playerLight!: Phaser.GameObjects.Light;

  private fireflies!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super("BootScene");
  }

  // ========================================
  // CREATE
  // ========================================

  create(): void {
    this.physics.world.setBounds(
      0,
      0,
      WORLD_WIDTH,
      WORLD_HEIGHT
    );

    this.setupLighting();

    this.createEffectTextures();

    this.createOutdoorLobby();

    this.createGroundTexture();
    this.createPlatforms();

    this.createCampfire();
    this.createAtmosphere();

    this.createPlayer();
    this.createWelcomeSign();

    this.setupCamera();
    this.createUI();

    this.scale.on("resize", this.handleResize, this);

    this.events.once("shutdown", this.cleanup, this);
    this.events.once("destroy", this.cleanup, this);

    this.handleResize(this.scale.gameSize);
  }

  // ========================================
  // UPDATE
  // ========================================

  update(): void {
    this.player.update();

    this.interactionManager.update();

    this.playerLight.setPosition(
      this.player.x,
      this.player.y - 10
    );
  }

  // ========================================
  // LIGHTING
  // ========================================

  private setupLighting(): void {
    this.lights.enable();
    this.lights.setAmbientColor(0x999b80);
  }

  // ========================================
  // PLAYER
  // ========================================

  private createPlayer(): void {
    this.player = new Player(this, 180, 600);

    this.physics.add.collider(
      this.player,
      this.platforms
    );

    this.playerLight = this.lights.addLight(
      this.player.x,
      this.player.y,
      150,
      COLORS.playerLight,
      0.35
    );
  }

  // ========================================
  // WELCOME SIGN
  // ========================================

  private createWelcomeSign(): void {
    const welcomeSign = new LobbyInteractable(this, {
      x: 600,
      y: 625,

      groundY: GROUND_Y,

      boardWidth: 140,
      boardHeight: 66,

      signTitle: "WELCOME",

      title: "Welcome to REZA.EXE",

      message: `Welcome, traveler!

You've entered Reza's developer world.

Reza is a Computer Engineer and Software Developer interested in Game Development, Python, and Machine Learning.

Explore this world to discover his projects, experiments, skills, and the things he's built along the way.

Every path leads to a different part of his journey.

Take your time. There's a lot to discover!`,
    });

    this.interactionManager = new InteractionManager(
      this,
      this.player
    );

    this.interactionManager.add(welcomeSign);
  }

  // ========================================
  // CAMERA
  // ========================================

  private setupCamera(): void {
    const camera = this.cameras.main;

    camera.setBounds(
      0,
      0,
      WORLD_WIDTH,
      WORLD_HEIGHT
    );

    camera.startFollow(
      this.player,
      true,
      0.1,
      0.1
    );
  }

  // ========================================
  // EFFECT TEXTURES
  // ========================================

  private createEffectTextures(): void {
    this.createFireflyTexture();
    this.createGlowTexture();
  }

  private createFireflyTexture(): void {
    if (this.textures.exists("firefly")) return;

    const graphics = this.make.graphics({
      x: 0,
      y: 0,
    });

    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(4, 4, 3);

    graphics.generateTexture("firefly", 8, 8);
    graphics.destroy();
  }

  private createGlowTexture(): void {
    if (this.textures.exists("soft-glow")) return;

    const graphics = this.make.graphics({
      x: 0,
      y: 0,
    });

    graphics.fillStyle(0xffffff, 0.025);
    graphics.fillCircle(64, 64, 62);

    graphics.fillStyle(0xffffff, 0.04);
    graphics.fillCircle(64, 64, 46);

    graphics.fillStyle(0xffffff, 0.07);
    graphics.fillCircle(64, 64, 28);

    graphics.fillStyle(0xffffff, 0.12);
    graphics.fillCircle(64, 64, 12);

    graphics.generateTexture("soft-glow", 128, 128);
    graphics.destroy();
  }

  // ========================================
  // OUTDOOR JUNGLE ENVIRONMENT
  // ========================================


  private createOutdoorLobby(): void {
    // Base night sky
    const sky = this.add.graphics();
    sky.setDepth(-40);
    sky.fillGradientStyle(
      0x0b1718,
      0x0b1718,
      0x1b3025,
      0x1b3025,
      1
    );
    sky.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Moon
    this.add.circle(1430, 125, 48, 0xd5d9ad, 0.9).setDepth(-39);
    this.add.circle(1450, 112, 45, 0x0b1718, 0.65).setDepth(-38);

    // Stars
    const stars = this.add.graphics();
    stars.setDepth(-37);

    for (let i = 0; i < 110; i++) {
      const x = (i * 173) % WORLD_WIDTH;
      const y = 25 + ((i * 97) % 260);
      const radius = i % 5 === 0 ? 2 : 1;

      stars.fillStyle(0xdce8bd, 0.35 + (i % 4) * 0.12);
      stars.fillCircle(x, y, radius);
    }

    // Distant jungle silhouettes
    const farForest = this.add.graphics();
    farForest.setDepth(-32);

    for (let i = 0; i < 35; i++) {
      const x = i * 82 - 20;
      const h = 170 + ((i * 47) % 120);
      const w = 75 + ((i * 19) % 55);
      const baseY = 590;

      farForest.fillStyle(0x172d25, 1);
      farForest.fillRect(x + w * 0.42, baseY - h * 0.65, w * 0.16, h * 0.65);

      farForest.fillStyle(i % 2 === 0 ? 0x193529 : 0x1c3a2d, 1);
      farForest.fillEllipse(x + w / 2, baseY - h * 0.75, w, h * 0.65);
      farForest.fillEllipse(x + w * 0.2, baseY - h * 0.65, w * 0.75, h * 0.55);
      farForest.fillEllipse(x + w * 0.8, baseY - h * 0.65, w * 0.75, h * 0.55);
    }

    // Midground trees
    const midForest = this.add.graphics();
    midForest.setDepth(-29);

    for (let i = 0; i < 24; i++) {
      const x = i * 118 - 45;
      const h = 220 + ((i * 61) % 130);
      const w = 100 + ((i * 23) % 65);
      const baseY = 640;

      midForest.fillStyle(0x182e22, 1);
      midForest.fillRect(x + w * 0.4, baseY - h * 0.7, w * 0.2, h * 0.7);

      midForest.fillStyle(i % 2 === 0 ? 0x203e2b : 0x25442f, 1);
      midForest.fillEllipse(x + w / 2, baseY - h * 0.78, w, h * 0.52);
      midForest.fillEllipse(x + w * 0.18, baseY - h * 0.66, w * 0.72, h * 0.48);
      midForest.fillEllipse(x + w * 0.82, baseY - h * 0.66, w * 0.72, h * 0.48);
    }

    // Ground base — same color as the physics ground texture
    const floor = this.add.graphics();
    floor.setDepth(-20);
    floor.fillStyle(COLORS.ground, 1);
    floor.fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);

    // Dense midground bushes
    const bushes = this.add.graphics();
    bushes.setDepth(-18);

    for (let i = 0; i < 75; i++) {
      const x = (i * 137) % WORLD_WIDTH;
      const y = 520 + ((i * 31) % 105);
      const size = 30 + ((i * 17) % 35);

      bushes.fillStyle(i % 3 === 0 ? 0x1d402b : 0x285137, 1);
      bushes.fillEllipse(x, y, size * 1.8, size);
      bushes.fillEllipse(x - size * 0.45, y + 5, size, size * 0.85);
      bushes.fillEllipse(x + size * 0.45, y + 3, size, size * 0.9);
    }

    // Foreground foliage around the edges
    const foreground = this.add.graphics();
    foreground.setDepth(-5);

    for (let side = 0; side < 2; side++) {
      const startX = side === 0 ? 0 : WORLD_WIDTH - 180;

      for (let i = 0; i < 18; i++) {
        const x = startX + (i % 6) * 32;
        const y = 450 + Math.floor(i / 6) * 55;
        const size = 35 + (i % 4) * 8;

        foreground.fillStyle(i % 2 === 0 ? 0x254b31 : 0x315b39, 1);
        foreground.fillEllipse(x, y, size * 1.8, size);
        foreground.fillEllipse(x - 10, y + 8, size, size * 0.8);
        foreground.fillEllipse(x + 12, y + 7, size, size * 0.85);
      }
    }

    // Dirt path
    const path = this.add.graphics();
    path.setDepth(-16);

    path.fillStyle(0x594633, 0.9);
    path.fillEllipse(1150, 645, 1700, 55);

    path.fillStyle(0x76583a, 0.45);
    path.fillEllipse(1150, 641, 1500, 18);

    // Rocks, roots and ground details
    const details = this.add.graphics();
    details.setDepth(-4);

    for (let i = 0; i < 45; i++) {
      const x = (i * 211) % WORLD_WIDTH;
      const y = 620 + ((i * 13) % 18);
      const size = 5 + (i % 9);

      details.fillStyle(i % 2 === 0 ? 0x39483a : 0x4c5940, 1);
      details.fillEllipse(x, y, size * 2, size);
    }

    this.createMushrooms();
  }



  private createMushrooms(): void {
    const mushrooms = this.add.graphics();
    mushrooms.setDepth(1);

    const clusters = [
      { x: 310, count: 3 },
      { x: 470, count: 2 },
      { x: 820, count: 4 },
      { x: 1120, count: 2 },
      { x: 1510, count: 3 },
      { x: 1840, count: 4 },
      { x: 2200, count: 3 },
      { x: 2440, count: 3 },
    ];

    const capColors = [
      0xc85b4b,
      0xd58a45,
      0xb66b9c,
      0xd6bd70,
    ];

    for (const cluster of clusters) {
      for (let i = 0; i < cluster.count; i++) {
        const x = cluster.x + i * 17 - cluster.count * 8;
        const scale = 0.65 + ((i * 13 + cluster.x) % 5) * 0.12;

        const height = 17 * scale;
        const stemWidth = 5 * scale;
        const capWidth = 17 * scale;
        const capHeight = 11 * scale;

        // Every mushroom sits on the same ground surface.
        const baseY = GROUND_Y;

        // Stem
        mushrooms.fillStyle(0xd9c9a0, 1);
        mushrooms.fillRoundedRect(
          x - stemWidth / 2,
          baseY - height,
          stemWidth,
          height,
          2
        );

        // Cap
        mushrooms.fillStyle(capColors[i % capColors.length], 1);
        mushrooms.fillEllipse(
          x,
          baseY - height + 2,
          capWidth,
          capHeight
        );

        // Small highlight
        mushrooms.fillStyle(0xffffff, 0.3);
        mushrooms.fillEllipse(
          x - capWidth * 0.18,
          baseY - height,
          capWidth * 0.3,
          capHeight * 0.22
        );

        // Tiny spots
        if (i % 2 === 0) {
          mushrooms.fillStyle(0xf5e6c4, 0.8);
          mushrooms.fillCircle(
            x + capWidth * 0.15,
            baseY - height + 1,
            1.5 * scale
          );
        }
      }
    }
  }


  // ========================================
  // GROUND TEXTURE
  // ========================================

  private createGroundTexture(): void {
    if (this.textures.exists("ground")) return;

    const graphics = this.make.graphics({
      x: 0,
      y: 0,
    });

    // Main ground
    graphics.fillStyle(COLORS.ground, 1);

    graphics.fillRect(
      0,
      0,
      WORLD_WIDTH,
      120
    );

    // Grass top edge
    graphics.fillStyle(0x527442, 1);

    graphics.fillRect(
      0,
      0,
      WORLD_WIDTH,
      7
    );

    // Darker grass details
    graphics.fillStyle(0x35543a, 1);

    for (let i = 0; i < 180; i++) {
      const x = Phaser.Math.Between(0, WORLD_WIDTH);
      const y = Phaser.Math.Between(12, 115);

      graphics.fillRect(
        x,
        y,
        Phaser.Math.Between(2, 9),
        2
      );
    }

    graphics.generateTexture(
      "ground",
      WORLD_WIDTH,
      120
    );

    graphics.destroy();
  }

  // ========================================
  // PLATFORMS / COLLISION GROUND
  // ========================================

  private createPlatforms(): void {
    this.platforms = this.physics.add.staticGroup();

    // Main ground only.
    // No floating artificial platforms in the jungle lobby.

    this.platforms.create(
      WORLD_WIDTH / 2,
      GROUND_Y + 60,
      "ground"
    );
  }

  // ========================================
  // CAMPFIRE
  // ========================================

  private createCampfire(): void {
    const x = 1050;
    const y = 625;

    // --------------------------------
    // FIRE GLOW
    // --------------------------------

    const glow = this.add.image(
      x,
      y - 35,
      "soft-glow"
    );

    glow
      .setScale(3.5)
      .setTint(COLORS.fire)
      .setAlpha(0.85)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(1);

    // --------------------------------
    // DYNAMIC FIRE LIGHT
    // --------------------------------

    const fireLight = this.lights.addLight(
      x,
      y - 30,
      300,
      COLORS.fire,
      2
    );

    this.tweens.add({
      targets: fireLight,

      intensity: {
        from: 1.5,
        to: 2.3,
      },

      duration: 450,

      yoyo: true,
      repeat: -1,

      ease: "Sine.easeInOut",
    });

    // Glow animation
    this.tweens.add({
      targets: glow,

      alpha: {
        from: 0.65,
        to: 0.95,
      },

      scale: {
        from: 3.2,
        to: 3.8,
      },

      duration: 550,

      yoyo: true,
      repeat: -1,

      ease: "Sine.easeInOut",
    });

    // --------------------------------
    // CAMPFIRE STONES
    // --------------------------------

    const stones = this.add.graphics();

    const stonePositions = [
      [-40, 0],
      [-28, 10],
      [0, 15],
      [30, 10],
      [42, 0],
      [20, -5],
      [-20, -5],
    ];

    for (const [sx, sy] of stonePositions) {
      stones.fillStyle(0x434b3c, 1);

      stones.fillEllipse(
        x + sx,
        y + sy,
        22,
        15
      );

      stones.fillStyle(0x77806a, 0.7);

      stones.fillEllipse(
        x + sx - 3,
        y + sy - 4,
        8,
        4
      );
    }

    stones.setDepth(2);

    // --------------------------------
    // FIREWOOD
    // --------------------------------

    const wood = this.add.graphics();

    wood.fillStyle(0x493126, 1);

    wood.fillRoundedRect(
      x - 36,
      y - 12,
      72,
      12,
      5
    );

    wood.fillStyle(0x775039, 1);

    wood.fillRoundedRect(
      x - 28,
      y - 24,
      58,
      11,
      5
    );

    wood.fillStyle(0x33251f, 1);

    wood.fillCircle(x - 28, y - 18, 4);
    wood.fillCircle(x + 25, y - 18, 4);

    wood.setDepth(3);

    // --------------------------------
    // FLAMES
    // --------------------------------

    const fire = this.add.container(
      x,
      y - 25
    );

    fire.setDepth(4);

    const outerFlame = this.add.ellipse(
      0,
      -17,
      48,
      65,
      0xe85c28
    );

    const middleFlame = this.add.ellipse(
      0,
      -16,
      32,
      48,
      0xff9b35
    );

    const innerFlame = this.add.ellipse(
      0,
      -13,
      17,
      32,
      0xffdf79
    );

    fire.add([
      outerFlame,
      middleFlame,
      innerFlame,
    ]);

    // Fire animation
    this.tweens.add({
      targets: fire,

      scaleX: {
        from: 0.9,
        to: 1.12,
      },

      scaleY: {
        from: 0.95,
        to: 1.08,
      },

      duration: 220,

      yoyo: true,
      repeat: -1,

      ease: "Sine.easeInOut",
    });

    // --------------------------------
    // FIRE EMBERS
    // --------------------------------

    const embers = this.add.particles(
      x,
      y - 50,
      "firefly",
      {
        lifespan: {
          min: 600,
          max: 1600,
        },

        speedX: {
          min: -25,
          max: 25,
        },

        speedY: {
          min: -70,
          max: -25,
        },

        scale: {
          start: 0.8,
          end: 0,
        },

        alpha: {
          start: 1,
          end: 0,
        },

        frequency: 100,
        quantity: 1,

        tint: [
          0xffd16a,
          0xff873d,
          0xffed9c,
        ],

        blendMode: Phaser.BlendModes.ADD,
      }
    );

    embers.setDepth(5);
  }

  // ========================================
  // FIRELIES AND ATMOSPHERE
  // ========================================

  private createAtmosphere(): void {
    this.createFireflies();
  }

  private createFireflies(): void {
    this.fireflies = this.add.particles(
      0,
      0,
      "firefly",
      {
        x: {
          min: 0,
          max: WORLD_WIDTH,
        },

        y: {
          min: 280,
          max: GROUND_Y - 15,
        },

        lifespan: {
          min: 3500,
          max: 6500,
        },

        speedX: {
          min: -12,
          max: 12,
        },

        speedY: {
          min: -10,
          max: 10,
        },

        scale: {
          start: 0.8,
          end: 0.1,
        },

        alpha: {
          start: 0,
          end: 0.9,
        },

        frequency: 100,
        quantity: 1,

        tint: [
          0xd9ff91,
          0xa6e88b,
          0xf6e7a1,
        ],

        blendMode: Phaser.BlendModes.ADD,
      }
    );

    this.fireflies.setDepth(3);
  }

  // ========================================
  // UI
  // ========================================

  private createUI(): void {
    this.titleText = this.add.text(
      24,
      20,
      "REZA.EXE  |  DEV WORLD",
      {
        fontFamily: GAME_FONT,
        fontSize: "20px",
        color: "#f1e9d5",
        fontStyle: "bold",
        stroke: "#101426",
        strokeThickness: 4,
      }
    );

    this.titleText
      .setScrollFactor(0)
      .setDepth(100);

    this.controlsText = this.add.text(
      24,
      52,
      "A / D or ARROWS: Move     SPACE: Jump     E: Interact",
      {
        fontFamily: GAME_FONT,
        fontSize: "13px",
        color: "#d5dfc0",
        stroke: "#101426",
        strokeThickness: 3,
      }
    );

    this.controlsText
      .setScrollFactor(0)
      .setDepth(100);
  }

  // ========================================
  // RESIZE
  // ========================================

  private handleResize(
    _gameSize: Phaser.Structs.Size
  ): void {
    this.titleText.setPosition(24, 20);
    this.controlsText.setPosition(24, 52);
  }

  // ========================================
  // CLEANUP
  // ========================================

  private cleanup(): void {
    this.scale.off(
      "resize",
      this.handleResize,
      this
    );
  }
}
