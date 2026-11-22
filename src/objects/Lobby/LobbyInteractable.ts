import Phaser from "phaser";
import { GAME_FONT } from "../../game/theme";
import type { IInteractable } from "../IInteractable";

export interface LobbyInteractableConfig {
    x: number;
    y: number;
    groundY: number;
    boardWidth: number;
    boardHeight: number;
    signTitle: string;
    /** Dialogue opened on interact (public/data/dialogues/*.json). */
    dialogueId: string;
}

const BOARD_Y = -75;
const GLOW_ALPHA_IDLE = 0.08;
const GLOW_ALPHA_NEARBY = 0.3;
const PARTICLE_COUNT = 5;

export class LobbyInteractable
    extends Phaser.GameObjects.Container
    implements IInteractable
{
    public readonly dialogueId: string;

    private readonly glow: Phaser.GameObjects.Arc;
    private readonly firefly: Phaser.GameObjects.Container;
    private readonly particles: Phaser.GameObjects.Arc[] = [];

    private isNearby = false;
    private nearbyTweens: Phaser.Tweens.Tween[] = [];

    constructor(scene: Phaser.Scene, config: LobbyInteractableConfig) {
        super(scene, config.x, config.y);

        this.dialogueId = config.dialogueId;

        const { boardWidth: w, boardHeight: h } = config;
        const halfW = w / 2;

        const boardBottom = BOARD_Y + h / 2;
        const poleBottom = config.groundY - config.y;
        const poleHeight = Math.max(10, poleBottom - boardBottom);
        const poleCenterY = boardBottom + poleHeight / 2;

        // Ambient glow
        this.glow = scene.add
            .arc(0, BOARD_Y, w * 0.75, 0, 360, false, 0xffb65c, GLOW_ALPHA_IDLE)
            .setScale(1.3, 0.8);

        // Support post
        const post = scene.add
            .rectangle(0, poleCenterY, 13, poleHeight, 0x654329)
            .setStrokeStyle(2, 0x3d291d);

        const postHighlight = scene.add.rectangle(
            -3, poleCenterY, 2, Math.max(2, poleHeight - 8), 0x9a7047, 0.65
        );

        const postBase = scene.add.rectangle(0, poleBottom - 3, 25, 7, 0x48301f);

        // Board
        const board = scene.add
            .rectangle(0, BOARD_Y, w, h, 0x765032)
            .setStrokeStyle(4, 0x3e291c);

        const innerBoard = scene.add
            .rectangle(0, BOARD_Y, w - 9, h - 9, 0x87603c)
            .setStrokeStyle(1, 0xb58a59, 0.65);

        // Wood grain: [color, alpha, x1, x2, y offset as fraction of height]
        const grain = scene.add.graphics();
        const grainLines: [number, number, number, number, number][] = [
            [0x4c3222, 0.45, -0.4, 0.35, -0.2],
            [0x4c3222, 0.45, -0.3, 0.4, 0.25],
            [0xb58a59, 0.35, -0.42, 0.15, -0.35],
        ];
        for (const [color, alpha, x1, x2, yOff] of grainLines) {
            grain.lineStyle(1, color, alpha);
            grain.lineBetween(w * x1, BOARD_Y + h * yOff, w * x2, BOARD_Y + h * yOff);
        }

        // Nails
        const nails = [-1, 1].map((side) =>
            scene.add.circle(side * (halfW - 9), BOARD_Y, 2, 0x352719)
        );

        // Sign title
        const label = scene.add
            .text(0, BOARD_Y, config.signTitle, {
                fontFamily: GAME_FONT,
                fontSize: "13px",
                color: "#fff0d2",
                fontStyle: "bold",
                letterSpacing: 1,
                align: "center",
                shadow: { offsetX: 1, offsetY: 2, color: "#382516", blur: 2, fill: true },
            })
            .setOrigin(0.5);

        // Leaves: [color, x, y, width, height]
        const leaves = scene.add.graphics();
        const leafShapes: [number, number, number, number, number][] = [
            [0x3f7543, -halfW + 5, BOARD_Y - 18, 12, 6],
            [0x3f7543, -halfW + 12, BOARD_Y - 10, 10, 5],
            [0x547e42, halfW - 7, BOARD_Y + 18, 12, 6],
            [0x547e42, halfW - 13, BOARD_Y + 10, 10, 5],
        ];
        for (const [color, x, y, lw, lh] of leafShapes) {
            leaves.fillStyle(color, 1);
            leaves.fillEllipse(x, y, lw, lh);
        }

        // Firefly interaction indicator
        this.firefly = scene.add.container(halfW + 15, BOARD_Y - h / 2 - 13, [
            scene.add.circle(0, 0, 12, 0xffc66d, 0.18),
            scene.add.circle(0, 0, 4, 0xffe6a0, 1),
        ]);

        // Floating firefly particles
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            this.particles.push(
                scene.add.circle(
                    Phaser.Math.Between(-halfW, halfW),
                    Phaser.Math.Between(BOARD_Y - 35, BOARD_Y + 35),
                    Phaser.Math.Between(1, 3),
                    0xffd77a,
                    0.75
                )
            );
        }

        this.add([
            this.glow, post, postHighlight, postBase,
            board, innerBoard, grain, ...nails, leaves, label,
            ...this.particles, this.firefly,
        ]);

        scene.add.existing(this);
        this.setDepth(5);

        this.startAnimations();
    }

    // ========================================
    // ANIMATION
    // ========================================

    private loop(
        target: object,
        props: Record<string, number>,
        duration: number,
        delay = 0
    ): void {
        this.scene.tweens.add({
            targets: target,
            ...props,
            duration,
            delay,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
        });
    }

    // Idle tweens never touch a property that setNearby animates
    // (glow alpha, firefly scale), so they can't fight each other.
    private startAnimations(): void {
        this.loop(this.firefly, { y: this.firefly.y - 7 }, 1500);
        this.loop(this.firefly, { alpha: 0.55 }, 900);
        this.loop(this.glow, { scaleX: 1.5, scaleY: 1 }, 1800);

        this.particles.forEach((p, i) => {
            this.loop(p, { y: p.y - Phaser.Math.Between(12, 25), alpha: 0.1 }, 1300 + i * 250, i * 180);
            this.loop(p, { x: p.x + Phaser.Math.Between(-8, 8) }, 1800 + i * 150);
        });
    }

    // ========================================
    // INTERACTION STATE
    // ========================================

    public setNearby(nearby: boolean): void {
        if (this.isNearby === nearby) return;
        this.isNearby = nearby;

        // Stop in-flight tweens so rapid toggling can't stack them.
        this.nearbyTweens.forEach((t) => t.stop());

        this.nearbyTweens = [
            this.scene.tweens.add({
                targets: this.glow,
                alpha: nearby ? GLOW_ALPHA_NEARBY : GLOW_ALPHA_IDLE,
                duration: 300,
                ease: "Sine.easeOut",
            }),
            this.scene.tweens.add({
                targets: this.firefly,
                scale: nearby ? 1.35 : 1,
                duration: 300,
                ease: "Back.easeOut",
            }),
        ];
    }

    // ========================================
    // CLEANUP
    // ========================================

    public destroy(fromScene?: boolean): void {
        // `this.scene` is cleared by super.destroy(), so use it first.
        this.scene?.tweens?.killTweensOf([this.glow, this.firefly, ...this.particles]);
        this.nearbyTweens = [];

        super.destroy(fromScene);
    }
}
