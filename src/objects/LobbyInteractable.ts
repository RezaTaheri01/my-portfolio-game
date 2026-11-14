
import Phaser from "phaser";
import { GAME_FONT } from "../game/theme";
import type { IInteractable } from "./IInteractable";

export interface LobbyInteractableConfig {
    x: number;
    y: number;
    groundY: number;
    boardWidth: number;
    boardHeight: number;
    signTitle: string;
    title: string;
    message: string;
}

export class LobbyInteractable
    extends Phaser.GameObjects.Container
    implements IInteractable {

    public readonly title: string;
    public readonly message: string;

    private glow: Phaser.GameObjects.Arc;
    private firefly: Phaser.GameObjects.Container;
    private particles: Phaser.GameObjects.Arc[] = [];
    private isNearby = false;

    constructor(scene: Phaser.Scene, config: LobbyInteractableConfig) {
        super(scene, config.x, config.y);

        this.title = config.title;
        this.message = config.message;

        const boardY = -75;
        const boardWidth = config.boardWidth;
        const boardHeight = config.boardHeight;

        const boardBottom = boardY + boardHeight / 2;
        const poleBottom = config.groundY - config.y;
        const poleHeight = Math.max(10, poleBottom - boardBottom);

        const poleCenterY = boardBottom + poleHeight / 2;

        // Warm ambient glow
        this.glow = scene.add.arc(
            0,
            boardY,
            boardWidth * 0.75,
            0,
            360,
            false,
            0xffb65c,
            0.08
        );

        this.glow.setScale(1.3, 0.8);

        // Wooden support post
        const post = scene.add.rectangle(
            0,
            poleCenterY,
            13,
            poleHeight,
            0x654329
        );

        post.setStrokeStyle(2, 0x3d291d);

        // Wood highlight
        const postHighlight = scene.add.rectangle(
            -3,
            poleCenterY,
            2,
            Math.max(2, poleHeight - 8),
            0x9a7047,
            0.65
        );

        // Post base
        const postBase = scene.add.rectangle(
            0,
            poleBottom - 3,
            25,
            7,
            0x48301f
        );

        // Wooden sign board
        const board = scene.add.rectangle(
            0,
            boardY,
            boardWidth,
            boardHeight,
            0x765032
        );

        board.setStrokeStyle(4, 0x3e291c);

        const innerBoard = scene.add.rectangle(
            0,
            boardY,
            boardWidth - 9,
            boardHeight - 9,
            0x87603c
        );

        innerBoard.setStrokeStyle(1, 0xb58a59, 0.65);

        // Wood grain
        const woodGrain = scene.add.graphics();

        woodGrain.lineStyle(1, 0x4c3222, 0.45);

        woodGrain.lineBetween(
            -boardWidth * 0.4,
            boardY - boardHeight * 0.2,
            boardWidth * 0.35,
            boardY - boardHeight * 0.2
        );

        woodGrain.lineBetween(
            -boardWidth * 0.3,
            boardY + boardHeight * 0.25,
            boardWidth * 0.4,
            boardY + boardHeight * 0.25
        );

        woodGrain.lineStyle(1, 0xb58a59, 0.35);

        woodGrain.lineBetween(
            -boardWidth * 0.42,
            boardY - boardHeight * 0.35,
            boardWidth * 0.15,
            boardY - boardHeight * 0.35
        );

        // Wooden nails
        const nailLeft = scene.add.circle(
            -boardWidth / 2 + 9,
            boardY,
            2,
            0x352719
        );

        const nailRight = scene.add.circle(
            boardWidth / 2 - 9,
            boardY,
            2,
            0x352719
        );

        // Sign title
        const label = scene.add.text(
            0,
            boardY,
            config.signTitle,
            {
                fontFamily: GAME_FONT,
                fontSize: "13px",
                color: "#fff0d2",
                fontStyle: "bold",
                letterSpacing: 1,
                align: "center",
                shadow: {
                    offsetX: 1,
                    offsetY: 2,
                    color: "#382516",
                    blur: 2,
                    fill: true,
                },
            }
        ).setOrigin(0.5);

        // Leaves and vines
        const leaves = scene.add.graphics();

        leaves.fillStyle(0x3f7543, 1);

        leaves.fillEllipse(
            -boardWidth / 2 + 5,
            boardY - 18,
            12,
            6
        );

        leaves.fillEllipse(
            -boardWidth / 2 + 12,
            boardY - 10,
            10,
            5
        );

        leaves.fillStyle(0x547e42, 1);

        leaves.fillEllipse(
            boardWidth / 2 - 7,
            boardY + 18,
            12,
            6
        );

        leaves.fillEllipse(
            boardWidth / 2 - 13,
            boardY + 10,
            10,
            5
        );

        // Firefly indicator
        this.firefly = scene.add.container(
            boardWidth / 2 + 15,
            boardY - boardHeight / 2 - 13
        );

        const fireflyGlow = scene.add.circle(
            0,
            0,
            12,
            0xffc66d,
            0.18
        );

        const fireflyBody = scene.add.circle(
            0,
            0,
            4,
            0xffe6a0,
            1
        );

        this.firefly.add([
            fireflyGlow,
            fireflyBody,
        ]);

        // Floating firefly particles
        for (let i = 0; i < 5; i++) {
            const particle = scene.add.circle(
                Phaser.Math.Between(-boardWidth / 2, boardWidth / 2),
                Phaser.Math.Between(boardY - 35, boardY + 35),
                Phaser.Math.Between(1, 3),
                0xffd77a,
                0.75
            );

            this.particles.push(particle);
        }

        // Add all elements to the container
        this.add([
            this.glow,
            post,
            postHighlight,
            postBase,
            board,
            innerBoard,
            woodGrain,
            nailLeft,
            nailRight,
            leaves,
            label,
            ...this.particles,
            this.firefly,
        ]);

        scene.add.existing(this);

        this.setDepth(5);

        this.startAnimations(scene);

        // Stop animations when the object is destroyed.
        this.once(
            Phaser.GameObjects.Events.DESTROY,
            this.destroyAnimations,
            this
        );
    }

    private startAnimations(scene: Phaser.Scene): void {
        // Gentle firefly movement
        scene.tweens.add({
            targets: this.firefly,
            y: this.firefly.y - 7,
            duration: 1500,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
        });

        // Firefly glow
        scene.tweens.add({
            targets: this.firefly,
            alpha: 0.55,
            duration: 900,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
        });

        // Ambient sign glow
        scene.tweens.add({
            targets: this.glow,
            alpha: 0.16,
            scaleX: 1.5,
            scaleY: 1,
            duration: 1800,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
        });

        // Floating fireflies
        this.particles.forEach((particle, index) => {
            const originalY = particle.y;
            const originalX = particle.x;

            scene.tweens.add({
                targets: particle,
                y: originalY - Phaser.Math.Between(12, 25),
                alpha: 0.1,
                duration: 1300 + index * 250,
                delay: index * 180,
                ease: "Sine.easeInOut",
                yoyo: true,
                repeat: -1,
            });

            scene.tweens.add({
                targets: particle,
                x: originalX + Phaser.Math.Between(-8, 8),
                duration: 1800 + index * 150,
                ease: "Sine.easeInOut",
                yoyo: true,
                repeat: -1,
            });
        });
    }

    private destroyAnimations(): void {
        this.scene.tweens.killTweensOf(this.glow);
        this.scene.tweens.killTweensOf(this.firefly);

        for (const particle of this.particles) {
            this.scene.tweens.killTweensOf(particle);
        }
    }

    public setNearby(nearby: boolean): void {
        if (this.isNearby === nearby) return;

        this.isNearby = nearby;

        this.scene.tweens.add({
            targets: this.glow,
            alpha: nearby ? 0.3 : 0.08,
            duration: 300,
            ease: "Sine.easeOut",
        });

        this.scene.tweens.add({
            targets: this.firefly,
            scale: nearby ? 1.35 : 1,
            duration: 300,
            ease: "Back.easeOut",
        });
    }
}
