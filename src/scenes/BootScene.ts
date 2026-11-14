
import Phaser from "phaser";

import { Player } from "../entities/Player";
import { Interactable } from "../interactables/Interactable";
import { InteractionManager } from "../interactables/InteractionManager";
import { GAME_FONT } from "../game/theme";

// ========================================
// WORLD CONFIGURATION
// ========================================

const WORLD_WIDTH = 2600;
const WORLD_HEIGHT = 720;
const GROUND_Y = 640;

const COLORS = {
  skyTop: 0x080b1b,
  skyBottom: 0x1b2947,

  farMountains: 0x343d65,
  midMountains: 0x252f50,
  nearMountains: 0x17213a,

  ground: 0x111a31,
  groundEdge: 0x52618a,

  moon: 0xe5eaf5,
  moonGlow: 0x8299e8,

  lantern: 0xffb65c,
  playerLight: 0x9bcfff,
};

export class BootScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;

  private interactionManager!: InteractionManager;

  private titleText!: Phaser.GameObjects.Text;
  private controlsText!: Phaser.GameObjects.Text;

  private playerLight!: Phaser.GameObjects.Light;

  private fireflies!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;

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
    this.createBackground();
    this.createPlatformTextures();
    this.createPlatforms();
    this.createLanterns();
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
    this.lights.setAmbientColor(0x777799);
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
      230,
      COLORS.playerLight,
      1.15
    );
  }

  // ========================================
  // WELCOME SIGN
  // ========================================

  private createWelcomeSign(): void {
    const welcomeSign = new Interactable(this, {
      x: 600,
      y: 625,
      groundY: GROUND_Y,
      boardWidth: 120,
      boardHeight: 66,
      signTitle: "INFORMATION",
      title: "Welcome to REZA.EXE",
      message: `Welcome, traveler!

You've entered my developer world.

I'm a Computer Engineer and Software Developer interested in Game Development, Python, and Machine Learning.

Explore this world to discover my projects, experiments, skills, and the things I've built along the way.

Every portal leads to a different part of my journey.

Take your time. There's a lot to discover!

— Reza`,
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

    const graphics = this.make.graphics({ x: 0, y: 0 });

    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(4, 4, 3);

    graphics.generateTexture("firefly", 8, 8);
    graphics.destroy();
  }

  private createGlowTexture(): void {
    if (this.textures.exists("soft-glow")) return;

    const graphics = this.make.graphics({ x: 0, y: 0 });

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
  // BACKGROUND
  // ========================================

  private createBackground(): void {
    this.createSky();
    this.createMoon();
    this.createStars();
    this.createMountains();
  }

  // ========================================
  // SKY
  // ========================================

  private createSky(): void {
    const sky = this.add.graphics();

    sky.fillGradientStyle(
      COLORS.skyTop,
      COLORS.skyTop,
      COLORS.skyBottom,
      COLORS.skyBottom,
      1
    );

    sky.fillRect(
      0,
      0,
      WORLD_WIDTH,
      WORLD_HEIGHT
    );

    sky.setDepth(-20);
  }

  // ========================================
  // MOON
  // ========================================


  private createMoon(): void {
    const moonX = 1250;
    const moonY = 175;

    // Generate a high-resolution moon texture
    const moonTexture = this.make.graphics({ x: 0, y: 0 });

    // Soft outer glow
    moonTexture.fillStyle(0x8299e8, 0.025);
    moonTexture.fillCircle(128, 128, 115);

    moonTexture.fillStyle(0x8299e8, 0.04);
    moonTexture.fillCircle(128, 128, 100);

    moonTexture.fillStyle(0x8299e8, 0.07);
    moonTexture.fillCircle(128, 128, 85);

    // Moon body
    moonTexture.fillStyle(0xe8edfa, 1);
    moonTexture.fillCircle(128, 128, 65);

    // Subtle surface shading
    moonTexture.fillStyle(0xcbd5ed, 0.25);
    moonTexture.fillCircle(145, 115, 28);

    // Craters
    moonTexture.fillStyle(0xaebbd8, 0.22);
    moonTexture.fillCircle(105, 105, 10);
    moonTexture.fillCircle(145, 145, 13);
    moonTexture.fillCircle(115, 155, 6);
    moonTexture.fillCircle(157, 95, 7);

    // Smaller crater details
    moonTexture.fillStyle(0xffffff, 0.2);
    moonTexture.fillCircle(102, 102, 4);
    moonTexture.fillCircle(141, 141, 5);

    moonTexture.generateTexture("moon-texture", 256, 256);
    moonTexture.destroy();

    // Glow behind the moon
    const glow = this.add.image(moonX, moonY, "soft-glow");

    glow
      .setScale(3.5)
      .setTint(0x8299e8)
      .setAlpha(0.2)
      .setScrollFactor(0.15)
      .setDepth(-19);

    // Moon itself
    this.add.image(moonX, moonY, "moon-texture")
      .setScale(1)
      .setScrollFactor(0.15)
      .setDepth(-18);
  }

  // ========================================
  // STARS
  // ========================================

  private createStars(): void {
    const stars = this.add.graphics();

    // Small random stars
    for (let i = 0; i < 260; i++) {
      const x = Phaser.Math.Between(0, WORLD_WIDTH);
      const y = Phaser.Math.Between(20, 430);
      const radius = Phaser.Math.FloatBetween(0.5, 1.6);
      const alpha = Phaser.Math.FloatBetween(0.3, 0.9);

      stars.fillStyle(0xdce6ff, alpha);
      stars.fillCircle(x, y, radius);
    }

    // Brighter stars
    const brightStars = [
      { x: 350, y: 110 },
      { x: 760, y: 220 },
      { x: 1330, y: 100 },
      { x: 1760, y: 280 },
      { x: 2320, y: 120 },
    ];

    for (const star of brightStars) {
      stars.fillStyle(0xffffff, 0.9);
      stars.fillCircle(star.x, star.y, 2);

      stars.fillStyle(0xb8ccff, 0.25);
      stars.fillCircle(star.x, star.y, 5);
    }

    stars.setScrollFactor(0.25);
    stars.setDepth(-17);
  }

  // ========================================
  // MOUNTAINS
  // ========================================

  private createMountains(): void {
    this.createMountainLayer({
      color: COLORS.farMountains,
      baseY: 590,
      step: 420,
      minPeakY: 260,
      maxPeakY: 340,
      scrollFactor: 0.4,
      depth: -16,
    });

    this.createMountainLayer({
      color: COLORS.midMountains,
      baseY: 620,
      step: 360,
      minPeakY: 350,
      maxPeakY: 440,
      scrollFactor: 0.58,
      depth: -15,
    });

    this.createMountainLayer({
      color: COLORS.nearMountains,
      baseY: GROUND_Y,
      step: 320,
      minPeakY: 440,
      maxPeakY: 510,
      scrollFactor: 0.75,
      depth: -14,
    });
  }

  private createMountainLayer(config: {
    color: number;
    baseY: number;
    step: number;
    minPeakY: number;
    maxPeakY: number;
    scrollFactor: number;
    depth: number;
  }): void {
    const mountains = this.add.graphics();

    mountains.fillStyle(config.color, 1);

    for (
      let x = 0;
      x < WORLD_WIDTH;
      x += config.step
    ) {
      const peakY = Phaser.Math.Between(
        config.minPeakY,
        config.maxPeakY
      );

      const middleX = x + config.step / 2;

      mountains.fillTriangle(
        x,
        config.baseY,
        middleX,
        peakY,
        x + config.step,
        config.baseY
      );

      // Subtle highlight on distant peaks
      if (config.depth === -16) {
        mountains.lineStyle(2, 0x7582ad, 0.2);
      }
    }

    mountains.setScrollFactor(config.scrollFactor);
    mountains.setDepth(config.depth);
  }

  // ========================================
  // PLATFORM TEXTURES
  // ========================================

  private createPlatformTextures(): void {
    this.createPlatformTexture();
    this.createGroundTexture();
  }

  private createPlatformTexture(): void {
    if (this.textures.exists("platform")) return;

    const graphics = this.make.graphics({ x: 0, y: 0 });

    graphics.fillStyle(0x242d4c, 1);
    graphics.fillRoundedRect(0, 0, 320, 24, 5);

    graphics.fillStyle(0x56648b, 1);
    graphics.fillRoundedRect(0, 0, 320, 5, 2);

    graphics.fillStyle(0x8997bb, 0.35);
    graphics.fillRect(8, 5, 304, 2);

    graphics.generateTexture("platform", 320, 24);
    graphics.destroy();
  }

  private createGroundTexture(): void {
    if (this.textures.exists("ground")) return;

    const graphics = this.make.graphics({ x: 0, y: 0 });

    graphics.fillStyle(COLORS.ground, 1);
    graphics.fillRect(0, 0, WORLD_WIDTH, 120);

    // Ground top edge
    graphics.fillStyle(COLORS.groundEdge, 1);
    graphics.fillRect(0, 0, WORLD_WIDTH, 7);

    graphics.fillStyle(0x8797bd, 0.3);
    graphics.fillRect(0, 7, WORLD_WIDTH, 2);

    // Subtle ground details
    for (let i = 0; i < 180; i++) {
      const x = Phaser.Math.Between(0, WORLD_WIDTH);
      const y = Phaser.Math.Between(18, 115);

      graphics.fillStyle(
        0x536184,
        Phaser.Math.FloatBetween(0.08, 0.22)
      );

      graphics.fillRect(
        x,
        y,
        Phaser.Math.Between(2, 9),
        1
      );
    }

    graphics.generateTexture("ground", WORLD_WIDTH, 120);
    graphics.destroy();
  }

  // ========================================
  // PLATFORMS
  // ========================================

  private createPlatforms(): void {
    this.platforms = this.physics.add.staticGroup();

    // Main ground
    this.platforms.create(
      WORLD_WIDTH / 2,
      700,
      "ground"
    );

    // Floating platforms
    const platformPositions = [
      { x: 1220, y: 550 },
      { x: 1980, y: 540 },
    ];

    for (const position of platformPositions) {
      this.platforms.create(
        position.x,
        position.y,
        "platform"
      );
    }
  }

  // ========================================
  // LANTERNS
  // ========================================

  private createLanterns(): void {
    const positions = [430, 850, 1500, 2220];

    for (const x of positions) {
      this.createLantern(x, GROUND_Y);
    }
  }

  private createLantern(x: number, y: number): void {
    const pole = this.add.graphics();

    // Pole
    pole.fillStyle(0x171a29, 1);
    pole.fillRect(x - 3, y - 48, 6, 48);

    pole.fillStyle(0x6d533d, 1);
    pole.fillRect(x - 5, y - 49, 10, 4);

    // Lantern frame
    pole.fillStyle(0x332b31, 1);
    pole.fillRect(x - 9, y - 65, 18, 18);

    pole.fillStyle(0x9b7040, 1);
    pole.fillRect(x - 7, y - 63, 14, 2);

    // Light source
    pole.fillStyle(0xeebc68, 1);
    pole.fillRect(x - 4, y - 59, 8, 9);

    // Frame details
    pole.fillStyle(0x332b31, 1);
    pole.fillRect(x - 10, y - 67, 20, 3);
    pole.fillRect(x - 7, y - 46, 14, 3);

    pole.setDepth(2);

    // Warm glow sprite
    this.add.image(x, y - 57, "soft-glow")
      .setScale(1.4)
      .setTint(COLORS.lantern)
      .setAlpha(0.65)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(1);

    // Dynamic light
    this.lights.addLight(
      x,
      y - 57,
      170,
      0xffa94d,
      1.5
    );
  }

  // ========================================
  // PARTICLES
  // ========================================

  private createAtmosphere(): void {
    this.createFireflies();
    this.createDust();
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
          min: 300,
          max: GROUND_Y - 20,
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
          end: 0.85,
        },

        frequency: 180,
        quantity: 1,

        tint: [
          0xffe7a1,
          0xb4e8d0,
          0xc2d7ff,
        ],

        blendMode: Phaser.BlendModes.ADD,
      }
    );

    this.fireflies.setDepth(3);
  }

  private createDust(): void {
    this.dust = this.add.particles(
      0,
      0,
      "firefly",
      {
        x: {
          min: 0,
          max: WORLD_WIDTH,
        },

        y: {
          min: GROUND_Y - 35,
          max: GROUND_Y - 5,
        },

        lifespan: {
          min: 4500,
          max: 7500,
        },

        speedX: {
          min: -8,
          max: 8,
        },

        speedY: {
          min: -15,
          max: -4,
        },

        scale: {
          start: 0.45,
          end: 0.1,
        },

        alpha: {
          start: 0.25,
          end: 0,
        },

        frequency: 100,
        quantity: 1,
        tint: 0x9daed0,
      }
    );

    this.dust.setDepth(4);
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
        color: "#c0c9e3",
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
