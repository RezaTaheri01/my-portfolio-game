
import Phaser from "phaser";
import { Player } from "../objects/Player";
import type { IInteractable } from "../objects/IInteractable";
import { GAME_FONT } from "../game/theme";

export class InteractionManager {
    private scene: Phaser.Scene;
    private player: Player;

    private interactables: IInteractable[] = [];
    private nearbyObject: IInteractable | null = null;

    private interactionKey: Phaser.Input.Keyboard.Key;
    private escapeKey: Phaser.Input.Keyboard.Key;

    private readonly interactionDistance = 100;

    private promptText: Phaser.GameObjects.Text;
    private dialogBackground: Phaser.GameObjects.Rectangle;
    private dialogTitle: Phaser.GameObjects.Text;
    private dialogMessage: Phaser.GameObjects.Text;
    private dialogHint: Phaser.GameObjects.Text;

    private dialogOpen = false;

    constructor(scene: Phaser.Scene, player: Player) {
        this.scene = scene;
        this.player = player;

        const keyboard = scene.input.keyboard!;

        this.interactionKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.E
        );

        this.escapeKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.ESC
        );

        // Interaction prompt
        this.promptText = scene.add.text(
            0,
            0,
            "E  —  Interact",
            {
                fontFamily: GAME_FONT,
                fontSize: "18px",
                color: "#fff0d2",
                backgroundColor: "#493523",
                padding: { x: 14, y: 9 },
            }
        )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(1000)
            .setVisible(false);

        // Dialog background
        this.dialogBackground = scene.add.rectangle(
            0, 0, 500, 170, 0x19251c, 0.97
        )
            .setStrokeStyle(2, 0x987044)
            .setScrollFactor(0)
            .setDepth(1001)
            .setVisible(false);

        // Dialog title
        this.dialogTitle = scene.add.text(
            0,
            0,
            "",
            {
                fontFamily: GAME_FONT,
                fontSize: "23px",
                color: "#e8bd78",
                fontStyle: "bold",
            }
        )
            .setScrollFactor(0)
            .setDepth(1002)
            .setVisible(false);

        // Dialog message
        this.dialogMessage = scene.add.text(
            0,
            0,
            "",
            {
                fontFamily: GAME_FONT,
                fontSize: "17px",
                color: "#f4ead8",
                wordWrap: { width: 440 },
                lineSpacing: 8,
            }
        )
            .setScrollFactor(0)
            .setDepth(1002)
            .setVisible(false);

        // Dialog hint
        this.dialogHint = scene.add.text(
            0,
            0,
            "E or ESC — Close",
            {
                fontFamily: GAME_FONT,
                fontSize: "13px",
                color: "#b5a58b",
            }
        )
            .setScrollFactor(0)
            .setDepth(1002)
            .setVisible(false);

        this.layoutUI();

        scene.scale.on("resize", this.layoutUI, this);
        scene.events.once("shutdown", this.destroy, this);
    }

    // Register any object implementing IInteractable
    public add(interactable: IInteractable): void {
        if (this.interactables.includes(interactable)) return;

        this.interactables.push(interactable);
    }

    // Unregister an interactable
    public remove(interactable: IInteractable): void {
        interactable.setNearby(false);

        this.interactables = this.interactables.filter(
            object => object !== interactable
        );

        if (this.nearbyObject === interactable) {
            this.nearbyObject = null;
            this.promptText.setVisible(false);
        }
    }

    public update(): void {
        if (this.dialogOpen) {
            this.promptText.setVisible(false);

            const closeWithE =
                Phaser.Input.Keyboard.JustDown(this.interactionKey);

            const closeWithEscape =
                Phaser.Input.Keyboard.JustDown(this.escapeKey);

            if (closeWithE || closeWithEscape) {
                this.closeDialog();
            }

            return;
        }

        this.findNearbyObject();

        this.promptText.setVisible(
            this.nearbyObject !== null
        );

        if (
            this.nearbyObject &&
            Phaser.Input.Keyboard.JustDown(this.interactionKey)
        ) {
            this.openDialog(this.nearbyObject);
        }
    }

    private findNearbyObject(): void {
        let closest: IInteractable | null = null;
        let closestDistance = this.interactionDistance;

        for (const object of this.interactables) {
            const distance = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                object.x,
                object.y
            );

            if (distance < closestDistance) {
                closest = object;
                closestDistance = distance;
            }
        }

        // Update visual feedback
        for (const object of this.interactables) {
            object.setNearby(object === closest);
        }

        this.nearbyObject = closest;
    }

    private openDialog(object: IInteractable): void {
        this.dialogOpen = true;

        this.dialogTitle.setText(object.title);
        this.dialogMessage.setText(object.message);

        const padding = 30;

        const titleHeight = this.dialogTitle.height;
        const messageHeight = this.dialogMessage.height;

        const contentWidth = Math.max(
            this.dialogTitle.width,
            this.dialogMessage.width
        );

        const dialogWidth = Math.max(
            320,
            Math.min(560, contentWidth + padding * 2)
        );

        const dialogHeight = titleHeight + messageHeight + 85;

        this.dialogBackground.setSize(
            dialogWidth,
            dialogHeight
        );

        this.dialogBackground.setPosition(
            this.scene.scale.width / 2,
            this.scene.scale.height - dialogHeight / 2 - 30
        );

        this.dialogTitle.setPosition(
            this.dialogBackground.x - dialogWidth / 2 + padding,
            this.dialogBackground.y - dialogHeight / 2 + 20
        );

        this.dialogMessage.setPosition(
            this.dialogTitle.x,
            this.dialogTitle.y + titleHeight + 15
        );

        this.dialogHint.setPosition(
            this.dialogBackground.x + dialogWidth / 2 - padding,
            this.dialogBackground.y + dialogHeight / 2 - 30
        ).setOrigin(1, 0);

        this.setDialogVisible(true);
    }

    private closeDialog(): void {
        this.dialogOpen = false;
        this.nearbyObject = null;

        this.setDialogVisible(false);
    }

    private setDialogVisible(visible: boolean): void {
        this.dialogBackground.setVisible(visible);
        this.dialogTitle.setVisible(visible);
        this.dialogMessage.setVisible(visible);
        this.dialogHint.setVisible(visible);
    }

    private layoutUI = (): void => {
        const width = this.scene.scale.width;
        const height = this.scene.scale.height;

        this.promptText.setPosition(
            width / 2,
            height - 65
        );

        if (!this.dialogOpen) return;

        // Keep the open dialog centered after resizing.
        const dialogWidth = this.dialogBackground.width;
        const dialogHeight = this.dialogBackground.height;

        this.dialogBackground.setPosition(
            width / 2,
            height - dialogHeight / 2 - 30
        );

        this.dialogTitle.setPosition(
            width / 2 - dialogWidth / 2 + 30,
            height - dialogHeight - 10
        );

        this.dialogMessage.setPosition(
            this.dialogTitle.x,
            this.dialogTitle.y + this.dialogTitle.height + 15
        );

        this.dialogHint.setPosition(
            width / 2 + dialogWidth / 2 - 30,
            height - 30
        );
    };

    public destroy(): void {
        this.scene.scale.off("resize", this.layoutUI, this);

        for (const object of this.interactables) {
            object.setNearby(false);
        }

        this.interactables = [];
        this.nearbyObject = null;
    }
}
