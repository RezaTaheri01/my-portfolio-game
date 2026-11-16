import Phaser from "phaser";

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------

const TEXTURE_PREFIX = "brown-bear";
const FLAG_TEXTURE_KEY = "brown-bear-flag";
const FRAME_COUNT = 2;
const FRAME_INTERVAL_MS = 700;
const TEXTURE_SIZE = { width: 52, height: 56 };
const POLE_X = 46; // pole center inside the bear texture

const FLAG_TEXTURE_SIZE = { width: 84, height: 54 };

// 52x56 art drawn at 2x = 104x112 on screen (same pixel size as the
// Player and Sajjad, but still clearly the biggest character).
const SPRITE_SCALE = 2;
const FLAG_SCALE = 0.52;

const NEARBY_DISTANCE_TWEEN_MS = 250;
const GLOW_ALPHA_IDLE = 0.08;
const GLOW_ALPHA_NEARBY = 0.28;

const PALETTE = {
    // Same outline as the Player and Sajjad
    outline: 0x211b2b,

    // Same warm ramp as Sajjad's shirt
    fur: 0x7b4f38,
    furLight: 0xa8754e,
    furDark: 0x4e3028,

    belly: 0x946142,
    snout: 0xd99a6c,
    snoutLight: 0xf0bd8d,
    innerEar: 0xaf684f,

    nose: 0x211b2b,
    noseShine: 0x715044,
    mouth: 0x211b2b,
    tongue: 0xc2605a,
    eyeShine: 0xffffff,

    claw: 0xf0e2c0,

    // Same wood / gold as the player's belt
    pole: 0x805137,
    poleLight: 0xb27a4c,
    poleDark: 0x57362a,
    poleTip: 0xf2c66d,

    glow: 0xffb65c,
    indicatorGlow: 0xffc66d,
    indicatorDot: 0xffe7a0,
} as const;

// Lion & Sun flag colors
const FLAG = {
    green: 0x2e9a50,
    white: 0xf5efe3,
    red: 0xd2433b,

    sun: 0xffd84d,
    sunRay: 0xf2b705,
    lion: 0xd99a1a,
    lionOutline: 0x7a5200,
    sword: 0xe3e6ea,
    swordHilt: 0x7a5200,
    border: 0x211b2b,
} as const;

type EllipsePart = [cx: number, cy: number, rx: number, ry: number];

// ------------------------------------------------------------
// NPC
// ------------------------------------------------------------

export class BrownBearNPC extends Phaser.GameObjects.Container {
    public readonly title = "Khers the Bear";

    public readonly dialogs: string[] = [
        `"Grrr... oh! Sorry. Hello there.\n\nDon't mind the flag. It's the Lion and Sun, an old emblem of Persia.\n\nI carry it with pride. And it only gets heavy after the first hour."`,

        `"Yes, I'm a bear. Yes, I can talk.\n\nNo, I don't eat portfolios.\n\nBut I did eat the last of Sajjad's snacks."`,

        `"Reza showed me his projects. Games, bots, backends, machine learning...\n\nI told him: that's a lot of work for one human.\n\nHe said it's only a lot if you sleep."`,

        `"Fun fact: the lion on my flag holds a sword and the sun rises behind it.\n\nMeanwhile, I just hold a stick and hope the wind is kind."`,

        `"I like it here by the campfire.\n\nGood fire, good company, and fireflies that don't try to run away from me.\n\n...Most animals do, strangely."`,
    ];

    // After the dialogs above have been shown `runs` times,
    // talking to the bear shows these instead.
    public readonly progression = {
        runs: 2,
        endDialogs: [
            `"You've heard all my stories. Twice.\n\nI'm a bear of few words. Okay, many words. But now they're finished."`,
            `"Go on, explore.\n\nI'll keep the flag up high. And the fire warm."`,
        ],
    };

    // Textures are identical for every bear, so they're generated once
    // and shared. A ref count removes them when the last instance dies.
    private static instanceCount = 0;

    private readonly sprite: Phaser.GameObjects.Sprite;
    private readonly flag: Phaser.GameObjects.Image;
    private readonly glow: Phaser.GameObjects.Arc;
    private readonly indicator: Phaser.GameObjects.Container;

    private sequenceIndex = 0;
    private lastFrameTime = 0;
    private isNearby = false;

    private nearbyTweens: Phaser.Tweens.Tween[] = [];

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);

        BrownBearNPC.instanceCount++;
        BrownBearNPC.ensureTextures(scene);

        // Bear sprite: faces the player.
        this.sprite = new Phaser.GameObjects.Sprite(
            scene,
            0,
            0,
            BrownBearNPC.textureKey(0)
        );
        this.sprite.setOrigin(0.5, 1).setScale(SPRITE_SCALE);

        // The flag pole is held in his right paw (screen right).
        const poleX = (POLE_X - TEXTURE_SIZE.width / 2) * SPRITE_SCALE;
        const poleTopY = -TEXTURE_SIZE.height * SPRITE_SCALE + 8;

        // Hoist side (origin) is the left edge, so the flag trails to the right.
        this.flag = new Phaser.GameObjects.Image(
            scene,
            poleX,
            poleTopY,
            FLAG_TEXTURE_KEY
        );
        this.flag.setOrigin(0, 0).setScale(FLAG_SCALE);

        // Interaction glow
        this.glow = new Phaser.GameObjects.Arc(
            scene,
            0,
            -52,
            62,
            undefined,
            undefined,
            false,
            PALETTE.glow,
            GLOW_ALPHA_IDLE
        );

        this.indicator = this.createIndicator(scene);

        this.add([this.glow, this.sprite, this.flag, this.indicator]);

        scene.add.existing(this);
        this.setDepth(8);

        this.startIdleAnimations();
    }

    // ========================================
    // TEXTURES
    // ========================================

    private static textureKey(frame: number): string {
        return `${TEXTURE_PREFIX}-${frame}`;
    }

    private static ensureTextures(scene: Phaser.Scene): void {
        for (let frame = 0; frame < FRAME_COUNT; frame++) {
            const key = BrownBearNPC.textureKey(frame);

            if (scene.textures.exists(key)) continue;

            BrownBearNPC.drawFrame(scene, key, frame);
        }

        if (!scene.textures.exists(FLAG_TEXTURE_KEY)) {
            BrownBearNPC.drawFlag(scene, FLAG_TEXTURE_KEY);
        }
    }

    private static releaseTextures(
        textures: Phaser.Textures.TextureManager
    ): void {
        BrownBearNPC.instanceCount = Math.max(0, BrownBearNPC.instanceCount - 1);

        if (BrownBearNPC.instanceCount > 0) return;

        for (let frame = 0; frame < FRAME_COUNT; frame++) {
            const key = BrownBearNPC.textureKey(frame);

            if (textures.exists(key)) {
                textures.remove(key);
            }
        }

        if (textures.exists(FLAG_TEXTURE_KEY)) {
            textures.remove(FLAG_TEXTURE_KEY);
        }
    }

    // ---------- Bear (pixel art, standing, front view) ----------

    private static drawFrame(
        scene: Phaser.Scene,
        key: string,
        frame: number
    ): void {
        const g = scene.make.graphics({ x: 0, y: 0 }, false);
        const c = PALETTE;

        // Breathing: the head sinks a pixel on frame 1
        const b = frame === 1 ? 1 : 0;

        const px = (
            color: number,
            x: number,
            y: number,
            w = 1,
            h = 1,
            alpha = 1
        ): void => {
            g.fillStyle(color, alpha);
            g.fillRect(x, y, w, h);
        };

        // Pixel-snapped ellipse (one rect per row)
        const ellipse = (
            color: number,
            cx: number,
            cy: number,
            rx: number,
            ry: number,
            alpha = 1
        ): void => {
            g.fillStyle(color, alpha);
            for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
                const dy = (y + 0.5 - cy) / ry;
                if (Math.abs(dy) > 1) continue;

                const half = rx * Math.sqrt(1 - dy * dy);
                const x0 = Math.round(cx - half);
                const x1 = Math.round(cx + half);

                if (x1 > x0) g.fillRect(x0, y, x1 - x0, 1);
            }
        };

        // One shared outline around a group of overlapping shapes
        const outline = (parts: EllipsePart[]): void => {
            for (const [cx, cy, rx, ry] of parts) {
                ellipse(c.outline, cx, cy, rx + 1, ry + 1);
            }
        };

        // Dark base, lit body, small highlight (same shading idea as the NPCs)
        const shaded = (cx: number, cy: number, rx: number, ry: number): void => {
            ellipse(c.furDark, cx, cy, rx, ry);
            ellipse(c.fur, cx + 1, cy - 1, rx - 2, ry - 1.5);
            ellipse(c.furLight, cx + 2, cy - ry * 0.45, rx * 0.4, ry * 0.22);

            // Hard 2px highlight strip on the left, like Sajjad's shirt
            const hy = Math.round(cy - ry * 0.4);
            const hh = Math.max(2, Math.round(ry * 0.8));
            px(c.furLight, Math.round(cx - rx * 0.6), hy, 2, hh);
        };

        // ---------- Ground shadow ----------

        ellipse(0x000000, 25, 55, 20, 1.5, 0.2);

        // ---------- Flag pole ----------

        px(c.outline, POLE_X - 2, 0, 4, 55);
        px(c.poleDark, POLE_X - 1, 1, 2, 53);
        px(c.pole, POLE_X - 1, 1, 1, 53);
        px(c.poleLight, POLE_X - 1, 4, 1, 18);
        px(c.poleTip, POLE_X - 2, 0, 4, 3);

        // ---------- Torso: huge shoulders and chest ----------

        outline([[24, 38, 17, 16], [24, 28, 18, 8]]);
        shaded(24, 38, 17, 16);
        shaded(24, 28, 18, 8);

        // Lighter belly + a few fur strokes
        ellipse(c.belly, 24, 44, 8, 8);
        px(c.furDark, 19, 35, 1, 2);
        px(c.furDark, 29, 37, 1, 2);
        px(c.furDark, 24, 41, 1, 2);
        px(c.furDark, 15, 31, 1, 2);
        px(c.furDark, 33, 31, 1, 2);

        // ---------- Feet ----------

        for (const fx of [15, 33]) {
            outline([[fx, 51, 7, 3]]);
            shaded(fx, 51, 7, 3);
            px(c.claw, fx - 4, 55);
            px(c.claw, fx, 55);
            px(c.claw, fx + 4, 55);
        }

        // ---------- Ears (behind the head) ----------

        for (const ex of [13, 35]) {
            outline([[ex, 6 + b, 4, 4]]);
            ellipse(c.fur, ex, 6 + b, 4, 4);
            ellipse(c.innerEar, ex, 7 + b, 2, 2);
        }

        // ---------- Head ----------

        outline([[24, 14 + b, 13, 10]]);
        shaded(24, 14 + b, 13, 10);

        // Muzzle
        ellipse(c.snout, 24, 19 + b, 6, 5);
        ellipse(c.snoutLight, 24, 17 + b, 4, 2);

        // Nose (rounded corners) + shine
        px(c.nose, 22, 15 + b, 5, 3);
        px(c.nose, 21, 16 + b, 1, 1);
        px(c.nose, 27, 16 + b, 1, 1);
        px(c.noseShine, 23, 15 + b, 2, 1);

        // Nose-to-mouth line, open mouth with a little tongue
        px(c.furDark, 24, 18 + b, 1, 3);
        px(c.mouth, 22, 21 + b, 5, 2);
        px(c.tongue, 23, 22 + b, 3, 1);

        // Small eyes + heavy brows
        for (const ex of [18, 30]) {
            px(c.furDark, ex - 1, 9 + b, 4, 1);
            px(c.nose, ex, 11 + b, 2, 2);
            px(c.eyeShine, ex, 11 + b, 1, 1);
        }

        // Cheek fur
        px(c.furLight, 14, 18 + b, 3, 1);
        px(c.furLight, 33, 18 + b, 3, 1);

        // ---------- Right arm (screen right) holding the pole ----------

        outline([[39.5, 33, 5, 9], [42, 41, 4, 4], [46, 41, 3.5, 5]]);
        shaded(39.5, 33, 5, 9);
        shaded(42, 41, 4, 4);
        shaded(46, 41, 3.5, 5);

        // Knuckles + claws
        px(c.furDark, 45, 38, 1, 4);
        px(c.furDark, 47, 38, 1, 4);

        // ---------- Left arm (screen left), resting at his side ----------

        outline([[9.5, 33, 5, 9], [8.5, 41, 4, 5], [8, 46, 3.5, 4]]);
        shaded(9.5, 33, 5, 9);
        shaded(8.5, 41, 4, 5);
        shaded(8, 46, 3.5, 4);

        // Knuckles + claws
        px(c.furDark, 7, 44, 1, 3);
        px(c.furDark, 9, 44, 1, 3);
        px(c.claw, 6, 50);
        px(c.claw, 8, 50);
        px(c.claw, 10, 50);

        g.generateTexture(key, TEXTURE_SIZE.width, TEXTURE_SIZE.height);
        g.destroy();

        // Crisp pixel art
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    // ---------- Lion & Sun flag (smooth vector art) ----------

    private static drawFlag(scene: Phaser.Scene, key: string): void {
        const g = scene.make.graphics({ x: 0, y: 0 }, false);
        const { width: W, height: H } = FLAG_TEXTURE_SIZE;
        const stripe = H / 3;

        // Tricolor: green / white / red
        g.fillStyle(FLAG.green, 1).fillRect(0, 0, W, stripe);
        g.fillStyle(FLAG.white, 1).fillRect(0, stripe, W, stripe);
        g.fillStyle(FLAG.red, 1).fillRect(0, stripe * 2, W, stripe);

        const cx = W / 2;
        const cy = H / 2;

        // ----- Sun rays -----
        const rays = 16;
        g.fillStyle(FLAG.sunRay, 1);
        for (let i = 0; i < rays; i++) {
            const a = (i / rays) * Math.PI * 2;
            const a1 = a - 0.1;
            const a2 = a + 0.1;
            g.fillTriangle(
                cx + Math.cos(a1) * 12, cy + Math.sin(a1) * 12,
                cx + Math.cos(a2) * 12, cy + Math.sin(a2) * 12,
                cx + Math.cos(a) * 19, cy + Math.sin(a) * 19
            );
        }

        // ----- Sun disk -----
        g.fillStyle(FLAG.sun, 1).fillCircle(cx, cy, 12);
        g.lineStyle(1, FLAG.sunRay, 1).strokeCircle(cx, cy, 12);

        // ----- Lion (walking right, with a sword) -----
        const lx = cx - 1;
        const ly = cy + 3;

        // Tail
        g.lineStyle(2, FLAG.lionOutline, 1);
        g.beginPath();
        g.moveTo(lx - 9, ly - 2);
        g.lineTo(lx - 12, ly - 8);
        g.lineTo(lx - 10, ly - 11);
        g.strokePath();

        // Legs
        g.fillStyle(FLAG.lion, 1).lineStyle(1, FLAG.lionOutline, 1);
        for (const dx of [-7, -3, 3, 6]) {
            g.fillRect(lx + dx, ly + 2, 2, 6);
            g.strokeRect(lx + dx, ly + 2, 2, 6);
        }

        // Body
        g.fillStyle(FLAG.lion, 1).fillEllipse(lx, ly, 22, 10);
        g.lineStyle(1, FLAG.lionOutline, 1).strokeEllipse(lx, ly, 22, 10);

        // Mane + head
        g.fillStyle(FLAG.lionOutline, 1).fillCircle(lx + 9, ly - 5, 6);
        g.fillStyle(FLAG.lion, 1).fillCircle(lx + 10, ly - 5, 4);
        g.fillStyle(FLAG.lionOutline, 1).fillCircle(lx + 12, ly - 6, 0.9); // eye

        // Front paw raised with a sword
        g.lineStyle(2, FLAG.lion, 1).lineBetween(lx + 7, ly, lx + 13, ly - 2);

        // Sword blade + hilt
        g.lineStyle(2, FLAG.sword, 1).lineBetween(lx + 13, ly - 2, lx + 16, ly - 15);
        g.lineStyle(1, FLAG.lionOutline, 1).strokeLineShape(
            new Phaser.Geom.Line(lx + 13, ly - 2, lx + 16, ly - 15)
        );
        g.lineStyle(2, FLAG.swordHilt, 1).lineBetween(lx + 10, ly - 3, lx + 16, ly - 1);

        // Thin flag border so it reads against the night sky
        g.lineStyle(1, FLAG.border, 0.6).strokeRect(0.5, 0.5, W - 1, H - 1);

        g.generateTexture(key, W, H);
        g.destroy();

        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }

    // ========================================
    // INDICATOR
    // ========================================

    private createIndicator(scene: Phaser.Scene): Phaser.GameObjects.Container {
        // Above the flag pole so they never overlap
        const indicator = new Phaser.GameObjects.Container(scene, 0, -134);

        const halo = new Phaser.GameObjects.Arc(
            scene,
            0,
            0,
            13,
            undefined,
            undefined,
            false,
            PALETTE.indicatorGlow,
            0.18
        );

        const dot = new Phaser.GameObjects.Arc(
            scene,
            0,
            0,
            4,
            undefined,
            undefined,
            false,
            PALETTE.indicatorDot,
            1
        );

        indicator.add([halo, dot]);

        return indicator;
    }

    // ========================================
    // ANIMATION
    // ========================================

    // Idle tweens each own a property that no other tween touches,
    // so they never fight with the "nearby" tweens below.
    private startIdleAnimations(): void {
        // Indicator float (y)
        this.scene.tweens.add({
            targets: this.indicator,
            y: -142,
            duration: 1300,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
        });

        // Indicator firefly pulse (alpha)
        this.scene.tweens.add({
            targets: this.indicator,
            alpha: 0.55,
            duration: 850,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
        });

        // Glow breathing (scale only — alpha belongs to setNearby)
        this.scene.tweens.add({
            targets: this.glow,
            scaleX: 1.3,
            scaleY: 0.85,
            duration: 1700,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
        });

        // Flag flutter (scaleX squeezes toward the pole)
        this.scene.tweens.add({
            targets: this.flag,
            scaleX: FLAG_SCALE * 0.9,
            duration: 900,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
        });

        // Flag sway (angle)
        this.scene.tweens.add({
            targets: this.flag,
            angle: { from: -2.5, to: 2.5 },
            duration: 1250,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
        });
    }

    public update(time: number): void {
        if (time - this.lastFrameTime < FRAME_INTERVAL_MS) return;

        this.sequenceIndex = (this.sequenceIndex + 1) % FRAME_COUNT;
        this.sprite.setTexture(BrownBearNPC.textureKey(this.sequenceIndex));

        this.lastFrameTime = time;
    }

    // ========================================
    // INTERACTION
    // ========================================

    public setNearby(nearby: boolean): void {
        if (this.isNearby === nearby) return;

        this.isNearby = nearby;

        // Stop any in-flight nearby tweens so rapid toggling can't stack them.
        this.nearbyTweens.forEach((tween) => tween.stop());

        this.nearbyTweens = [
            this.scene.tweens.add({
                targets: this.glow,
                alpha: nearby ? GLOW_ALPHA_NEARBY : GLOW_ALPHA_IDLE,
                duration: NEARBY_DISTANCE_TWEEN_MS,
                ease: "Sine.easeOut",
            }),
            this.scene.tweens.add({
                targets: this.indicator,
                scale: nearby ? 1.3 : 1,
                duration: NEARBY_DISTANCE_TWEEN_MS,
                ease: "Back.easeOut",
            }),
        ];
    }

    // ========================================
    // CLEANUP
    // ========================================

    public destroy(fromScene?: boolean): void {
        // Grab references first: `this.scene` is cleared by super.destroy().
        const scene = this.scene;
        const textures = scene?.textures;

        scene?.tweens?.killTweensOf([this.glow, this.indicator, this.flag]);
        this.nearbyTweens = [];

        super.destroy(fromScene);

        if (textures) {
            BrownBearNPC.releaseTextures(textures);
        }
    }
}