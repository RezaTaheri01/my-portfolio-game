
import Phaser from "phaser";
import { GAME_FONT } from "../game/theme";

export interface InteractableConfig {
    x: number;
    y: number;
    groundY: number;
    boardWidth: number;
    boardHeight: number;
    signTitle: string;
    title: string;
    message: string;
}

export class Interactable extends Phaser.GameObjects.Container {
    public readonly title: string;
    public readonly message: string;

    private glow!: Phaser.GameObjects.Arc;
    private diamond!: Phaser.GameObjects.Container;
    private particles!: Phaser.GameObjects.Arc[];
    private isNearby = false;

    constructor(scene: Phaser.Scene, config: InteractableConfig) {
        super(scene, config.x, config.y);

        this.title = config.title;
        this.message = config.message;

        const boardY = -75;
        const boardWidth = config.boardWidth;
        const boardHeight = config.boardHeight;

        const poleTop = boardY + boardHeight / 2;
        const poleBottom = config.groundY - config.y;
        const poleHeight = Math.max(10, poleBottom - poleTop);

        // Pole
        const pole = scene.add.rectangle(
            0,
            (poleTop + poleBottom) / 2,
            10,
            poleHeight,
            0x343d70
        );

        // Glowing line on pole
        const poleLight = scene.add.rectangle(
            0,
            (poleTop + poleBottom) / 2,
            3,
            poleHeight,
            0x818cf8,
            0.9
        );

        // Sign glow
        this.glow = scene.add.arc(
            0,
            boardY,
            75,
            0,
            360,
            false,
            0x818cf8,
            0.12
        );

        this.glow.setScale(1.4, 0.9);

        // Sign board
        const board = scene.add.rectangle(
            0,
            boardY,
            boardWidth,
            boardHeight,
            0x1b2345
        );

        board.setStrokeStyle(2, 0x818cf8);

        // Inner board decoration
        const innerBorder = scene.add.rectangle(
            0,
            boardY,
            boardWidth - 10,
            boardHeight - 10
        );

        innerBorder.setStrokeStyle(1, 0x6472c9, 0.45);

        // Sign label
        const label = scene.add.text(
            0,
            boardY,
            config.signTitle,
            {
                fontFamily: GAME_FONT,
                fontSize: "13px",
                color: "#ffffff",
                fontStyle: "bold",
                letterSpacing: 1,
            }
        ).setOrigin(0.5);

        // Floating diamond
        this.diamond = scene.add.container(0, -132);

        const diamondGlow = scene.add.circle(
            0, 0, 18, 0x818cf8, 0.2
        );

        const diamondShape = scene.add.polygon(
            0,
            0,
            [
                0, -12,
                12, 0,
                0, 12,
                -12, 0,
            ],
            0xa5b4fc
        );

        diamondShape.setStrokeStyle(2, 0xffffff);

        this.diamond.add([
            diamondGlow,
            diamondShape,
        ]);

        // Small floating particles
        this.particles = [];

        for (let i = 0; i < 5; i++) {
            const particle = scene.add.circle(
                Phaser.Math.Between(-55, 55),
                Phaser.Math.Between(-115, -35),
                Phaser.Math.Between(2, 4),
                0xa5b4fc,
                0.7
            );

            this.particles.push(particle);
        }

        // Drawing order
        this.add([
            pole,
            poleLight,
            this.glow,
            board,
            innerBorder,
            label,
            ...this.particles,
            this.diamond,
        ]);

        scene.add.existing(this);

        this.setDepth(5);

        this.startAnimations(scene);
    }

    private startAnimations(scene: Phaser.Scene) {
        // Floating diamond
        scene.tweens.add({
            targets: this.diamond,
            y: -142,
            duration: 1100,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
        });

        // Diamond rotation
        scene.tweens.add({
            targets: this.diamond,
            angle: 45,
            duration: 2200,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
        });

        // Pulsing glow
        scene.tweens.add({
            targets: this.glow,
            alpha: 0.3,
            scaleX: 1.7,
            scaleY: 1.1,
            duration: 1300,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
        });

        // Floating particles
        this.particles.forEach((particle, index) => {
            scene.tweens.add({
                targets: particle,
                y: particle.y - Phaser.Math.Between(15, 35),
                alpha: 0.1,
                duration: 1200 + index * 180,
                delay: index * 200,
                ease: "Sine.easeInOut",
                yoyo: true,
                repeat: -1,
            });
        });
    }

    public setNearby(nearby: boolean) {
        if (this.isNearby === nearby) return;

        this.isNearby = nearby;

        this.scene.tweens.add({
            targets: this.glow,
            alpha: nearby ? 0.5 : 0.2,
            duration: 250,
            ease: "Sine.easeOut",
        });

        this.scene.tweens.add({
            targets: this.diamond,
            scale: nearby ? 1.25 : 1,
            duration: 250,
            ease: "Back.easeOut",
        });
    }
}
