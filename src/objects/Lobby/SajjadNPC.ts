import Phaser from "phaser";

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------

const TEXTURE_PREFIX = "sajjad-sit";
const FRAME_COUNT = 2;
const FRAME_INTERVAL_MS = 600;
const TEXTURE_SIZE = { width: 28, height: 36 };

const NEARBY_DISTANCE_TWEEN_MS = 250;
const GLOW_ALPHA_IDLE = 0.08;
const GLOW_ALPHA_NEARBY = 0.28;

const PALETTE = {
    outline: 0x211b2b,

    hair: 0x2d1d1b,
    hairLight: 0x56322b,

    skin: 0xd99a6c,
    skinLight: 0xf0bd8d,
    skinShadow: 0xaf684f,

    // Different clothing from Reza/player,
    // same pixel-art visual language.
    shirt: 0x7b4f38,
    shirtLight: 0xa8754e,
    shirtDark: 0x4e3028,

    pants: 0x34394f,
    pantsLight: 0x4c5570,

    boot: 0x302431,
    bootLight: 0x715044,

    glow: 0xffb65c,
    indicatorGlow: 0xffc66d,
    indicatorDot: 0xffe7a0,
} as const;

// ------------------------------------------------------------
// NPC
// ------------------------------------------------------------

export class SajjadNPC extends Phaser.GameObjects.Container {
    /** Dialogue opened on interact. Content: public/data/dialogues/*.json */
    public readonly dialogueId: string;
    public readonly interactLabel = "Talk";
    public readonly bubbleOffsetY = 82; // seated sprite is 72px tall

    // Textures are identical for every Sajjad, so they're generated once
    // and shared. A ref count removes them when the last instance dies.
    private static instanceCount = 0;

    private readonly sprite: Phaser.GameObjects.Sprite;
    private readonly glow: Phaser.GameObjects.Arc;
    private readonly indicator: Phaser.GameObjects.Container;

    private frameIndex = 0;
    private lastFrameTime = 0;
    private isNearby = false;

    private nearbyTweens: Phaser.Tweens.Tween[] = [];

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        dialogueId = "lobby.sajjad"
    ) {
        super(scene, x, y);

        this.dialogueId = dialogueId;

        SajjadNPC.instanceCount++;
        SajjadNPC.ensureTextures(scene);

        // Sprite — faces right, toward the campfire.
        this.sprite = new Phaser.GameObjects.Sprite(
            scene,
            0,
            0,
            SajjadNPC.textureKey(0)
        );
        this.sprite.setOrigin(0.5, 1).setScale(2);

        // Interaction glow
        this.glow = new Phaser.GameObjects.Arc(
            scene,
            0,
            -32,
            38,
            undefined,
            undefined,
            false,
            PALETTE.glow,
            GLOW_ALPHA_IDLE
        );

        // Small firefly interaction indicator
        this.indicator = this.createIndicator(scene);

        this.add([this.glow, this.sprite, this.indicator]);

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
            const key = SajjadNPC.textureKey(frame);

            if (scene.textures.exists(key)) continue;

            SajjadNPC.drawFrame(scene, key, frame);
        }
    }

    private static releaseTextures(
        textures: Phaser.Textures.TextureManager
    ): void {
        SajjadNPC.instanceCount = Math.max(0, SajjadNPC.instanceCount - 1);

        if (SajjadNPC.instanceCount > 0) return;

        for (let frame = 0; frame < FRAME_COUNT; frame++) {
            const key = SajjadNPC.textureKey(frame);

            if (textures.exists(key)) {
                textures.remove(key);
            }
        }
    }

    private static drawFrame(
        scene: Phaser.Scene,
        key: string,
        frame: number
    ): void {
        const g = scene.make.graphics({ x: 0, y: 0 }, false);

        const px = (
            color: number,
            x: number,
            y: number,
            w = 1,
            h = 1
        ): void => {
            g.fillStyle(color, 1);
            g.fillRect(x, y, w, h);
        };

        const c = PALETTE;

        // Tiny breathing movement (upper body only)
        const bob = frame === 1 ? 1 : 0;

        // ---------- Head (side profile, looking RIGHT) ----------

        // Back hair
        px(c.outline, 8, 3 + bob, 8, 9);
        px(c.hair, 9, 4 + bob, 6, 7);
        px(c.hairLight, 10, 4 + bob, 2, 3);

        // Head outline + face
        px(c.outline, 12, 3 + bob, 7, 9);
        px(c.skin, 13, 4 + bob, 5, 7);
        px(c.skinLight, 18, 7 + bob, 2, 2); // nose
        px(c.skinShadow, 13, 9 + bob, 5, 2); // face shadow

        // Top hair
        px(c.hair, 10, 2 + bob, 7, 4);
        px(c.hairLight, 12, 2 + bob, 3, 1);

        // Ear and eye
        px(c.skinShadow, 12, 7 + bob, 1, 2);
        px(c.outline, 17, 6 + bob, 1, 1);

        // ---------- Neck ----------

        px(c.outline, 12, 11 + bob, 5, 4);
        px(c.skin, 13, 11 + bob, 3, 3);

        // ---------- Torso (leaning slightly forward) ----------

        px(c.outline, 8, 13 + bob, 10, 11);
        px(c.shirtDark, 9, 14 + bob, 8, 9);
        px(c.shirt, 10, 14 + bob, 7, 8);
        px(c.shirtLight, 10, 15 + bob, 2, 5);

        // ---------- Back arm (hand resting beside him) ----------

        px(c.outline, 7, 15 + bob, 4, 8);
        px(c.shirtDark, 8, 16 + bob, 2, 5);
        px(c.skin, 8, 21 + bob, 3, 2);

        // ---------- Front arm (resting on knee) ----------

        px(c.outline, 16, 15 + bob, 4, 8);
        px(c.shirt, 16, 16 + bob, 2, 5);
        px(c.skin, 17, 20 + bob, 3, 2); // forearm
        px(c.skinLight, 18, 21 + bob, 3, 2); // hand

        // ---------- Seated legs (thighs forward, shins down) ----------

        // Rear thigh
        px(c.outline, 8, 22, 9, 5);
        px(c.pants, 9, 23, 7, 3);

        // Front thigh
        px(c.outline, 14, 22, 10, 5);
        px(c.pants, 15, 23, 8, 3);
        px(c.pantsLight, 16, 23, 4, 1);

        // Front shin + boot
        px(c.outline, 20, 25, 5, 7);
        px(c.pants, 21, 26, 3, 5);
        px(c.outline, 20, 30, 7, 3);
        px(c.boot, 21, 30, 5, 2);
        px(c.bootLight, 22, 30, 3, 1);

        // Rear shin + boot
        px(c.outline, 10, 25, 5, 7);
        px(c.pants, 11, 26, 3, 5);
        px(c.outline, 9, 30, 7, 3);
        px(c.boot, 10, 30, 5, 2);
        px(c.bootLight, 11, 30, 3, 1);

        g.generateTexture(key, TEXTURE_SIZE.width, TEXTURE_SIZE.height);
        g.destroy();

        // Crisp pixel art
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    // ========================================
    // INDICATOR
    // ========================================

    private createIndicator(scene: Phaser.Scene): Phaser.GameObjects.Container {
        const indicator = new Phaser.GameObjects.Container(scene, 0, -78);

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
            y: -86,
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
    }

    public update(time: number): void {
        if (time - this.lastFrameTime < FRAME_INTERVAL_MS) return;

        this.frameIndex = (this.frameIndex + 1) % FRAME_COUNT;
        this.sprite.setTexture(SajjadNPC.textureKey(this.frameIndex));

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

        scene?.tweens?.killTweensOf([this.glow, this.indicator]);
        this.nearbyTweens = [];

        super.destroy(fromScene);

        if (textures) {
            SajjadNPC.releaseTextures(textures);
        }
    }
}