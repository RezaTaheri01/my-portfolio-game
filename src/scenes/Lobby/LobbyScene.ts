import Phaser from "phaser";

import { Player } from "../../objects/Player";
import { InteractionManager } from "../../systems/InteractionManager";
import { DialogueManager } from "../../systems/DialogueManager";
import { AudioManager } from "../../systems/AudioManager";
import { queueBundles } from "../../systems/AssetLoader";
import { UpdateList, spawnEntities } from "../../systems/SceneContent";
import { LOBBY } from "../../data/scenes/lobby";
import { GAME_FONT } from "../../game/theme";
import { attachDebugOverlay } from "../../ui/DebugOverlay";
import { InputHints } from "../../systems/InputHints";

// ========================================
// CONFIG
// ========================================

const VIEW_HEIGHT = 720; // what the player sees (matches canvas height)
const GROUND_Y = 640;
const GROUND_THICKNESS = 80 * 3; // 240px of ground (filler extends below the view)
const WORLD_WIDTH = 2000;
// +20 because the ground sprite's top sits 20px below GROUND_Y
const WORLD_HEIGHT = GROUND_Y + 20 + GROUND_THICKNESS; // 900

const COLORS = {
  skyTop: 0x0b1718,
  skyBottom: 0x1b3025,
  ground: 0x263e2d,
  fire: 0xffa34d,
  playerLight: 0xffc078,
};

interface ForestLayer {
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
  count: 35, step: 82, startX: -20, baseY: 590,
  height: [170, 120, 47], width: [75, 55, 19],
  trunkColor: 0x172d25, leafColors: [0x193529, 0x1c3a2d],
  trunk: [0.42, 0.16, 0.65],
  canopyY: 0.75, canopyH: 0.65,
  sideX: 0.2, sideY: 0.65, sideW: 0.75, sideH: 0.55,
};

const MID_FOREST: ForestLayer = {
  count: 24, step: 118, startX: -45, baseY: 640,
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

export class LobbyScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private interactionManager!: InteractionManager;
  private dialogue!: DialogueManager;
  private entityUpdates = new UpdateList();
  private playerLight!: Phaser.GameObjects.Light;

  constructor() {
    super("LobbyScene");
  }

  // ========================================
  // LIFECYCLE
  // ========================================

  // Everything the lobby needs from disk is declared in data/assets.ts;
  // Phaser waits for it before create() runs.
  preload(): void {
    queueBundles(this, LOBBY.bundles);
  }

  create(): void {
    this.entityUpdates.clear();
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // this.lights.enable().setAmbientColor(0x999b80);

    this.createTextures();
    this.createOutdoorLobby();
    this.createPlatforms();
    this.createPlayer();

    DialogueManager.registerFromCache(this, LOBBY.bundles);
    this.dialogue = new DialogueManager(this, this.player);
    this.interactionManager = new InteractionManager(this, this.player, this.dialogue);

    // Signs, NPCs, items, triggers: all declared in data/scenes/lobby.ts.
    spawnEntities(LOBBY.entities, {
      scene: this,
      player: this.player,
      interaction: this.interactionManager,
      dialogue: this.dialogue,
      updates: this.entityUpdates,
    });

    this.createCampfireArea();
    this.createFireflies();
    this.setupCamera();
    this.createUI();
    this.createAudio();
    this.createMuteButton();
    attachDebugOverlay(this)
  }

  update(time: number): void {
    this.player.update(this.interactionManager.isInteracting); // no walking / jumping mid-conversation
    this.entityUpdates.update(time);
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

    this.platforms.create(
      WORLD_WIDTH / 2,
      GROUND_Y + GROUND_THICKNESS / 2 + 20,
      "ground"
    );
  }

  private setupCamera(): void {
    const camera = this.cameras.main;
    // Pinned to the visible height: the filler ground below is never scrolled into view
    camera.setBounds(0, 0, WORLD_WIDTH, VIEW_HEIGHT);
    camera.startFollow(this.player, true, 0.1, 0.1);
  }

  private createAudio(): void {
    const audio = AudioManager.get(this);

    if (LOBBY.music) audio.attachMusic(this, LOBBY.music);
    audio.bindMuteKey(this); // M toggles mute
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

    const isTouch = this.sys.game.device.input.touch || navigator.maxTouchPoints > 0;

    if (!isTouch) {
      const hints = InputHints.get(this);
      const hint = this.add
        .text(24, 52, "", style("13px", "#d5dfc0", 3))
        .setScrollFactor(0)
        .setDepth(100);

      const refresh = (): void => {
        hint.setText(hints.labels.hint);
      };

      refresh();
      const off = hints.onChange(refresh);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    }
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

    this.makeTexture("ground", WORLD_WIDTH, GROUND_THICKNESS, (g) => {
      const height = GROUND_THICKNESS;

      g.fillStyle(COLORS.ground, 1);
      g.fillRect(0, 0, WORLD_WIDTH, height);

      // Only the top edge
      g.fillStyle(0x527442, 1);
      g.fillRect(0, 0, WORLD_WIDTH, 7);

      // Texture continues downward (scaled with the thicker ground)
      g.fillStyle(0x35543a, 1);

      for (let i = 0; i < 180 * 3; i++) {
        g.fillRect(
          Phaser.Math.Between(0, WORLD_WIDTH),
          Phaser.Math.Between(12, height),
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
    this.createSky(); // one gradient quad + the moon: cheap, stays live

    // PERFORMANCE: the scenery below is static, but a Phaser Graphics object
    // re-builds and re-draws every shape EVERY FRAME (~700 ellipses/circles here,
    // across the whole 2000px world, even off-screen). Drawing it once into a
    // texture turns that into a single image that the camera can cull.
    // Layer order = draw order below (it matches the old depths -37 ... -4).
    this.makeTexture("lobby-scenery", WORLD_WIDTH, WORLD_HEIGHT, (g) => {
      this.drawStars(g);
      this.drawForest(g, FAR_FOREST);
      this.drawForest(g, MID_FOREST);

      // Backdrop fill, extended down to the bottom of the world
      g.fillStyle(COLORS.ground, 1)
        .fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);

      this.drawBushes(g);
      this.drawPath(g);
      this.drawForegroundFoliage(g);
      this.drawGroundDetails(g);
    });
    this.add.image(0, 0, "lobby-scenery").setOrigin(0, 0).setDepth(-37);

    this.createMushrooms(); // small (about 30 shapes); sits at depth 1 among the campfire effects
  }

  private createSky(): void {
    const sky = this.add.graphics().setDepth(-40);
    sky.fillGradientStyle(
      COLORS.skyTop, COLORS.skyTop, COLORS.skyBottom, COLORS.skyBottom, 1
    );
    // Gradient stays on the visible height so the colors look like the original
    sky.fillRect(0, 0, WORLD_WIDTH, VIEW_HEIGHT);

    // Moon (second circle carves out a crescent)
    this.add.circle(1430, 125, 48, 0xd5d9ad, 0.9).setDepth(-39);
    this.add.circle(1450, 112, 45, COLORS.skyTop, 0.65).setDepth(-38);
  }

  private drawStars(g: Graphics): void {
    for (let i = 0; i < 110; i++) {
      g.fillStyle(0xdce8bd, 0.35 + (i % 4) * 0.12);
      g.fillCircle(
        (i * 173) % WORLD_WIDTH,
        25 + ((i * 97) % 260),
        i % 5 === 0 ? 2 : 1
      );
    }
  }

  private drawForest(g: Graphics, layer: ForestLayer): void {
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

  private drawBushes(g: Graphics): void {
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

  private drawPath(g: Graphics): void {
    ellipse(g, 0x594633, 1150, 645, 1700, 55, 0.9);
    ellipse(g, 0x76583a, 1150, 641, 1500, 18, 0.45);
  }

  private drawForegroundFoliage(g: Graphics): void {
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

  private drawGroundDetails(g: Graphics): void {
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
      { x: 1510, count: 3 }, { x: 1840, count: 4 },
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
    const logX = 965;

    this.createCampfire(1050, 640);
    this.createLog(logX, 640, 70); // Sajjad sits on it: his x is in data/scenes/lobby.ts
  }

  private createLog(
    x: number,
    y: number,
    width: number = 130,
    height: number = 28
  ): void {
    const scaleX = width / 130;
    const scaleY = height / 28;

    const bark = this.add.graphics();
    bark.lineStyle(2 * Math.min(scaleX, scaleY), 0x3d281e, 0.8);

    for (let i = -45; i <= 45; i += 20) {
      bark.lineBetween(
        i * scaleX,
        -18 * scaleY,
        (i + 10) * scaleX,
        2 * scaleY
      );
    }

    const rings = this.add.graphics();
    rings.lineStyle(2 * Math.min(scaleX, scaleY), 0x5c3e2a, 0.8);

    rings.strokeEllipse(
      width / 2 - 65 * scaleX + 65 * scaleX,
      -8 * scaleY,
      10 * scaleX,
      17 * scaleY
    );

    rings.strokeEllipse(
      65 * scaleX,
      -8 * scaleY,
      5 * scaleX,
      10 * scaleY
    );

    const body = this.add.rectangle(
      0,
      -8 * scaleY,
      width,
      height,
      0x5b3826
    );

    body.setStrokeStyle(
      3 * Math.min(scaleX, scaleY),
      0x2e211b
    );

    this.add.container(x, y, [
      body,

      this.add.rectangle(
        0,
        -16 * scaleY,
        width * 0.86,
        7 * scaleY,
        0x8a5b38
      ),

      bark,

      this.add.ellipse(
        -width / 2,
        -8 * scaleY,
        20 * scaleX,
        height,
        0x3e281e
      ),

      this.add.ellipse(
        width / 2,
        -8 * scaleY,
        20 * scaleX,
        height,
        0x8b6240
      ),

      rings,
    ]).setDepth(3);
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

  // ========================================
  // Music Mute Button
  // ========================================
  private createMuteButton(): void {
    const audio = AudioManager.get(this);

    const circle = this.add
      .circle(0, 0, 24, 0x172c23, 0.82)
      .setStrokeStyle(2, 0x3d5940, 0.95)
      .setScrollFactor(0)
      .setDepth(900)
      .setInteractive({ useHandCursor: true });

    const icon = this.add.graphics().setScrollFactor(0).setDepth(901);

    const draw = (): void => {
      icon.clear();
      icon.fillStyle(0xfff0d2, 1);
      icon.fillRect(-10, -4, 5, 8);
      icon.fillTriangle(-5, -4, 2, -9, 2, 9);
      icon.fillTriangle(-5, -4, 2, 9, -5, 4);

      icon.lineStyle(2.5, audio.isMuted ? 0xffa34d : 0xfff0d2, 1);
      if (audio.isMuted) {
        icon.lineBetween(6, -5, 14, 5);
        icon.lineBetween(14, -5, 6, 5);
      } else {
        icon.beginPath();
        icon.arc(3, 0, 7, -0.9, 0.9);
        icon.strokePath();
        icon.beginPath();
        icon.arc(3, 0, 12, -0.9, 0.9);
        icon.strokePath();
      }
    };

    const layout = (): void => {
      const x = this.scale.width - 40;
      circle.setPosition(x, 40);
      icon.setPosition(x, 40);
    };

    const toggle = (): void => {
      audio.toggleMute();
      draw();
    };

    circle.on(Phaser.Input.Events.POINTER_DOWN, toggle);

    // Keep the icon in sync when M is pressed (runs after bindMuteKey's handler).
    this.input.keyboard?.on("keydown-M", draw);

    // Controller: Start button (index 9), read from the browser's Gamepad API.
    const offPad = InputHints.get(this).onPadPress((index) => {
      if (index === 9) toggle();
    });

    this.scale.on("resize", layout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", layout);
      this.input.keyboard?.off("keydown-M", draw);
      offPad();
    });

    draw();
    layout();
  }
}