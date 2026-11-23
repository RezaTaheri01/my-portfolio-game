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
    blush: 0xb86a50,

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

// ------------------------------------------------------------
// NPC
// ------------------------------------------------------------

export class BrownBearNPC extends Phaser.GameObjects.Container {
    /** Dialogue opened on interact. Content: public/data/dialogues/*.json */
    public readonly dialogueId: string;

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

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        dialogueId = "lobby.khers"
    ) {
        super(scene, x, y);

        this.dialogueId = dialogueId;

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

    // ---------- Bear (pixel art, sitting, front view) ----------
    //
    // Same art language as the Player and Sajjad: hard-edged rectangles,
    // 1px outline, dark base + lit body + highlight strip on the left.
    // He sits on the ground with his feet toward us, holding the flag.

    private static drawFrame(
        scene: Phaser.Scene,
        key: string,
        frame: number
    ): void {
        const g = scene.make.graphics({ x: 0, y: 0 }, false);
        const c = PALETTE;

        // Breathing: the head sinks a pixel on frame 1
        const b = frame === 1 ? 1 : 0;

        // Seated, so the head sits lower than a standing bear's
        const hy = 8 + b;

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

        // Soft shadow on the ground
        const groundShadow = (): void => {
            g.fillStyle(0x000000, 0.2);
            for (let y = 54; y <= 56; y++) {
                const dy = (y + 0.5 - 55) / 1.5;
                if (Math.abs(dy) > 1) continue;

                const half = 21 * Math.sqrt(1 - dy * dy);
                g.fillRect(Math.round(25 - half), y, Math.round(half * 2), 1);
            }
        };

        // Rectangle with stepped corners (r = 1 small, r = 2 large)
        const chunk = (
            color: number,
            x: number,
            y: number,
            w: number,
            h: number,
            r = 1
        ): void => {
            px(color, x + r, y, w - r * 2, h);
            px(color, x, y + r, w, h - r * 2);

            if (r === 2) px(color, x + 1, y + 1, w - 2, h - 2);
        };

        type Part = [x: number, y: number, w: number, h: number, r?: number];

        // One shared outline around a group of overlapping parts
        const outline = (parts: Part[]): void => {
            for (const [x, y, w, h, r = 1] of parts) {
                chunk(c.outline, x - 1, y - 1, w + 2, h + 2, r);
            }
        };

        // Dark base, lit body (dark rim left + bottom), hard highlight strip
        const fur = (part: Part, strip = 2): void => {
            const [x, y, w, h, r = 1] = part;

            chunk(c.furDark, x, y, w, h, r);
            chunk(c.fur, x + 1, y, w - 1, h - 1, r);

            const sh = Math.max(2, Math.round(h * 0.45));
            px(c.furLight, x + 2, y + 2, strip, sh);
            px(c.furLight, x + 2 + strip, y + 1, 2, 1);
        };

        // ---------- Ground shadow ----------

        groundShadow();

        // ---------- Flag pole ----------

        px(c.outline, POLE_X - 2, 0, 4, 55);
        px(c.poleDark, POLE_X - 1, 1, 2, 53);
        px(c.pole, POLE_X - 1, 1, 1, 53);
        px(c.poleLight, POLE_X - 1, 4, 1, 18);
        px(c.poleTip, POLE_X - 2, 0, 4, 3);

        // ---------- Body: round, seated ----------

        const body: Part = [8, 29, 32, 21, 2];

        outline([body]);
        fur(body, 3);

        // Lighter belly + a few fur strokes
        chunk(c.belly, 16, 34, 16, 13, 2);
        px(c.furDark, 19, 36, 1, 2);
        px(c.furDark, 29, 38, 1, 2);
        px(c.furDark, 24, 41, 1, 2);
        px(c.furDark, 12, 33, 1, 2);
        px(c.furDark, 36, 33, 1, 2);

        // ---------- Ears (behind the head) ----------

        for (const ex of [13, 35]) {
            outline([[ex - 4, 2 + hy, 8, 7]]);
            chunk(c.fur, ex - 4, 2 + hy, 8, 7);
            chunk(c.innerEar, ex - 2, 4 + hy, 4, 4);
            px(c.furLight, ex - 4, 3 + hy, 1, 2);
        }

        // ---------- Head ----------

        outline([[11, 4 + hy, 26, 19, 2]]);
        fur([11, 4 + hy, 26, 19, 2], 3);

        // Little tuft on top, like the Player's hair swoop
        px(c.outline, 22, 2 + hy, 6, 3);
        px(c.fur, 23, 3 + hy, 4, 2);
        px(c.furLight, 23, 3 + hy, 2, 1);
        px(c.fur, 24, 2 + hy, 2, 1);

        // Muzzle
        chunk(c.snout, 18, 15 + hy, 12, 9);
        px(c.snoutLight, 19, 16 + hy, 5, 2);
        px(c.innerEar, 19, 22 + hy, 10, 1);

        // Nose (rounded corners) + shine
        px(c.nose, 22, 15 + hy, 5, 3);
        px(c.nose, 21, 16 + hy, 1, 1);
        px(c.nose, 27, 16 + hy, 1, 1);
        px(c.noseShine, 23, 15 + hy, 2, 1);

        // Nose-to-mouth line, open mouth with a little tongue
        px(c.furDark, 24, 18 + hy, 1, 3);
        px(c.mouth, 22, 21 + hy, 5, 2);
        px(c.tongue, 23, 22 + hy, 3, 1);

        // Eyes with a shine, like the Player's
        for (const ex of [16, 31]) {
            px(c.furDark, ex - 1, 9 + hy, 5, 1);
            px(c.nose, ex, 11 + hy, 3, 3);
            px(c.eyeShine, ex, 11 + hy, 1, 1);
        }

        // Blush under the eyes
        px(c.blush, 14, 16 + hy, 3, 1);
        px(c.blush, 32, 16 + hy, 3, 1);

        // ---------- Legs: stretched toward us, soles showing ----------

        for (const lx of [9, 26]) {
            const leg: Part = [lx, 42, 15, 12, 2];

            outline([leg]);
            fur(leg, 2);

            // Sole pad + toe pads
            chunk(c.snout, lx + 3, 47, 9, 5);
            px(c.snoutLight, lx + 4, 48, 4, 1);

            px(c.snout, lx + 3, 44, 2, 2);
            px(c.snout, lx + 6, 43, 2, 2);
            px(c.snout, lx + 9, 44, 2, 2);
        }

        // ---------- Right arm (screen right) holding the pole ----------
        //
        // The fist is only about twice the pole's width and closes around
        // it: thumb over the top, three fingers wrapped across the front,
        // pole showing above and below.

        const rUpper: Part = [33, 30 + b, 9, 9];
        const rFore: Part = [37, 33, 7, 6];
        const rFist: Part = [42, 34, 8, 7];

        outline([rUpper, rFore, rFist]);
        fur(rUpper);
        fur(rFore, 2);
        fur(rFist, 1);

        // Three fingers: dark gaps, with the fingertips curling past the pole
        px(c.furDark, 45, 36, 5, 1);
        px(c.furDark, 45, 38, 5, 1);
        px(c.furLight, 45, 35, 2, 1);
        px(c.furLight, 45, 37, 2, 1);
        px(c.furLight, 45, 39, 2, 1);

        // Thumb pressed over the top of the fist
        px(c.outline, 43, 32, 4, 3);
        px(c.fur, 44, 33, 2, 2);
        px(c.furLight, 44, 33, 1, 1);
        px(c.furDark, 43, 34, 4, 1);

        // Wrist crease
        px(c.furDark, 42, 35, 1, 5);

        // Contact shadow on the pole under the fist
        px(c.poleDark, POLE_X - 1, 42, 2, 2);

        // ---------- Left arm (screen left), resting on his knee ----------

        const lUpper: Part = [3, 31 + b, 9, 11];
        const lPaw: Part = [4, 40, 9, 8];

        outline([lUpper, lPaw]);
        fur(lUpper);
        fur(lPaw, 1);

        // Knuckles + claws
        px(c.furDark, 7, 43, 1, 3);
        px(c.furDark, 9, 43, 1, 3);
        px(c.claw, 5, 48);
        px(c.claw, 7, 48);
        px(c.claw, 9, 48);

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