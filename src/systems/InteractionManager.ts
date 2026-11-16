import Phaser from "phaser";

import type { Player } from "../objects/Player";
import { GAME_FONT } from "../game/theme";
import type { IInteractable } from "../objects/IInteractable";
import type { InteractableLink } from "../data/links";

// Anything interactable also needs a world position to measure distance from.
type Interactable = IInteractable & Phaser.GameObjects.Components.Transform;

interface Progress {
  /** Index of the message to resume from. */
  index: number;
  /** How many times the full dialog has been shown. */
  runs: number;
}

const INTERACTION_DISTANCE = 100;
const UI_DEPTH = 1000;

const DIALOG_MAX_WIDTH = 560;
const DIALOG_MIN_HEIGHT = 150;
const DIALOG_PADDING = 30;
const LINK_ROW_HEIGHT = 32;

const COLORS = {
  forest: 0x172c23,
  forestLight: 0x263e2d,
  forestBorder: 0x3d5940,
  wood: 0x765032,
  fire: 0xffa34d,

  forestCss: "#172c23",
  fireLight: "#ffc078",
  cream: "#fff0d2",
  muted: "#c5b99d",
};

export class InteractionManager {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;

  private readonly interactables: Interactable[] = [];
  private nearbyObject: Interactable | null = null;
  private activeObject: Interactable | null = null;
  private dialogIndex = 0;

  // Messages currently being shown (the normal ones, or the end dialog).
  private activeDialogs: string[] = [];

  // Per-object memory for interactables that declare `progression`.
  private readonly progress = new Map<Interactable, Progress>();
  // Progress being tracked by the open dialog (null for untracked / end dialogs).
  private activeProgress: Progress | null = null;

  private readonly isTouch: boolean;

  private readonly interactKey: Phaser.Input.Keyboard.Key;
  private readonly escapeKey: Phaser.Input.Keyboard.Key;
  private readonly numberKeys: Phaser.Input.Keyboard.Key[];

  private readonly prompt: Phaser.GameObjects.Text;

  private readonly dialog: Phaser.GameObjects.Container;
  private readonly dialogBackground: Phaser.GameObjects.Rectangle;
  private readonly dialogInner: Phaser.GameObjects.Rectangle;
  private readonly dialogAccent: Phaser.GameObjects.Rectangle;
  private readonly dialogTitle: Phaser.GameObjects.Text;
  private readonly dialogMessage: Phaser.GameObjects.Text;
  private readonly dialogAction: Phaser.GameObjects.Text;
  private readonly dialogExit: Phaser.GameObjects.Text;

  // Clickable link rows for the open dialog (rebuilt every time one opens).
  private linkTexts: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;
    this.isTouch = scene.sys.game.device.input.touch;

    const keyboard = scene.input.keyboard!;
    this.interactKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    // 1-9 open the matching link while a dialog with links is showing.
    const { ONE, TWO, THREE, FOUR, FIVE, SIX, SEVEN, EIGHT, NINE } =
      Phaser.Input.Keyboard.KeyCodes;
    this.numberKeys = [ONE, TWO, THREE, FOUR, FIVE, SIX, SEVEN, EIGHT, NINE].map(
      (code) => keyboard.addKey(code)
    );

    const text = (size: number, color: string, extra: object = {}) =>
      scene.add.text(0, 0, "", {
        fontFamily: GAME_FONT,
        fontSize: `${size}px`,
        color,
        ...extra,
      });

    // Prompt shown near an interactable
    this.prompt = text(18, COLORS.cream, {
      backgroundColor: COLORS.forestCss,
      padding: { x: 14, y: 9 },
    })
      .setText(this.isTouch ? "Tap  —  Interact" : "E  —  Interact")
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(UI_DEPTH)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });

    // Clicking / tapping the prompt acts as pressing E.
    this.prompt.on(Phaser.Input.Events.POINTER_DOWN, this.onPromptTap, this);

    // Dialog: everything lives in one container (positioned in layoutDialog)
    this.dialogBackground = scene.add
      .rectangle(0, 0, 1, 1, COLORS.forest, 0.97)
      .setStrokeStyle(3, COLORS.wood);

    this.dialogInner = scene.add
      .rectangle(0, 0, 1, 1, COLORS.forestLight, 0.96)
      .setStrokeStyle(1, COLORS.forestBorder);

    this.dialogAccent = scene.add.rectangle(0, 0, 4, 28, COLORS.fire);

    this.dialogTitle = text(22, COLORS.fireLight, { fontStyle: "bold" });
    this.dialogMessage = text(16, COLORS.cream, { lineSpacing: 9 });

    // Clickable hint buttons (bottom-right of the dialog)
    const button = (label: string, onClick: () => void) => {
      const b = text(12, COLORS.muted, { padding: { x: 8, y: 6 } })
        .setText(label)
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });

      b.on(Phaser.Input.Events.POINTER_DOWN, onClick);

      if (!this.isTouch) {
        b.on(Phaser.Input.Events.POINTER_OVER, () => b.setColor(COLORS.fireLight));
        b.on(Phaser.Input.Events.POINTER_OUT, () => b.setColor(COLORS.muted));
      }

      return b;
    };

    this.dialogAction = button("", () => this.nextDialog());
    this.dialogExit = button(this.isTouch ? "Exit" : "ESC  Exit", () =>
      this.closeDialog()
    );

    this.dialog = scene.add
      .container(0, 0, [
        this.dialogBackground,
        this.dialogInner,
        this.dialogAccent,
        this.dialogTitle,
        this.dialogMessage,
        this.dialogAction,
        this.dialogExit,
      ])
      .setScrollFactor(0)
      .setDepth(UI_DEPTH + 1)
      .setVisible(false);

    this.layout();

    scene.scale.on("resize", this.layout, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  // ========================================
  // PUBLIC API
  // ========================================

  /** True while a dialog is showing (handy for locking player movement). */
  public get isDialogOpen(): boolean {
    return this.activeObject !== null;
  }

  public add(interactable: Interactable): void {
    this.interactables.push(interactable);
  }

  public remove(interactable: Interactable): void {
    const index = this.interactables.indexOf(interactable);
    if (index === -1) return;

    this.interactables.splice(index, 1);
    this.progress.delete(interactable);
    interactable.setNearby(false);

    if (this.nearbyObject === interactable) this.nearbyObject = null;
    if (this.activeObject === interactable) this.closeDialog();
  }

  public update(): void {
    const interactPressed = Phaser.Input.Keyboard.JustDown(this.interactKey);

    if (this.activeObject) {
      if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
        this.closeDialog();
      } else if (interactPressed) {
        this.nextDialog();
      } else {
        this.numberKeys.forEach((key, i) => {
          if (Phaser.Input.Keyboard.JustDown(key)) this.openLink(i);
        });
      }
      return;
    }

    this.refreshNearby();

    if (this.nearbyObject && interactPressed) {
      this.openDialog(this.nearbyObject);
    }
  }

  public destroy(): void {
    this.scene.scale.off("resize", this.layout, this);
    this.prompt.destroy();
    this.dialog.destroy();
  }

  // ========================================
  // POINTER INPUT
  // ========================================

  private onPromptTap(): void {
    if (this.nearbyObject && !this.activeObject) {
      this.openDialog(this.nearbyObject);
    }
  }

  // ========================================
  // NEARBY DETECTION
  // ========================================

  private refreshNearby(): void {
    let closest: Interactable | null = null;
    let closestDistance = INTERACTION_DISTANCE;

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

    for (const object of this.interactables) {
      object.setNearby(object === closest);
    }

    this.nearbyObject = closest;
    this.prompt.setVisible(closest !== null);
  }

  // ========================================
  // DIALOG FLOW
  // ========================================

  private openDialog(object: Interactable): void {
    const { progression } = object;

    let dialogs = object.dialogs;
    let index = 0;
    this.activeProgress = null;

    if (progression) {
      const progress = this.progress.get(object) ?? { index: 0, runs: 0 };
      this.progress.set(object, progress);

      if (progress.runs >= progression.runs) {
        dialogs = progression.endDialogs; // seen everything: show the end dialog
      } else {
        this.activeProgress = progress;
        index = Math.min(progress.index, dialogs.length - 1); // resume
      }
    }

    if (dialogs.length === 0) return;

    this.activeObject = object;
    this.activeDialogs = dialogs;
    this.dialogIndex = index;

    this.prompt.setVisible(false);
    this.dialogTitle.setText(object.title);
    this.buildLinks(object.links ?? []);
    this.dialog.setVisible(true);

    this.showCurrentDialog();
  }

  private showCurrentDialog(): void {
    const dialogs = this.activeDialogs;
    const isLast = this.dialogIndex >= dialogs.length - 1;

    // Remember where the player is; reaching the last message completes a run.
    if (this.activeProgress) {
      if (isLast) {
        this.activeProgress.runs++;
        this.activeProgress.index = 0;
      } else {
        this.activeProgress.index = this.dialogIndex;
      }
    }

    this.dialogMessage.setText(dialogs[this.dialogIndex]);
    const action = isLast ? "Close" : "Continue";
    this.dialogAction.setText(this.isTouch ? action : `E  ${action}`);

    this.layoutDialog();
  }

  private nextDialog(): void {
    if (this.dialogIndex >= this.activeDialogs.length - 1) {
      this.closeDialog();
      return;
    }

    this.dialogIndex++;
    this.showCurrentDialog();
  }

  private closeDialog(): void {
    this.clearLinks();
    this.activeObject = null;
    this.activeProgress = null;
    this.activeDialogs = [];
    this.dialogIndex = 0;

    this.dialog.setVisible(false);
    this.dialogAction.setColor(COLORS.muted);
    this.dialogExit.setColor(COLORS.muted);
    this.refreshNearby();
  }

  // ========================================
  // LINKS
  // ========================================

  private buildLinks(links: InteractableLink[]): void {
    this.clearLinks();

    links.forEach((link, index) => {
      const row = this.scene.add
        .text(0, 0, `${index + 1}    ${link.label}`, {
          fontFamily: GAME_FONT,
          fontSize: "17px",
          color: COLORS.cream,
          padding: { x: 8, y: 4 },
        })
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });

      // POINTER_UP so browsers treat the click as a user gesture for popups.
      row.on(Phaser.Input.Events.POINTER_UP, () => this.openLink(index));

      if (!this.isTouch) {
        row.on(Phaser.Input.Events.POINTER_OVER, () => row.setColor(COLORS.fireLight));
        row.on(Phaser.Input.Events.POINTER_OUT, () => row.setColor(COLORS.cream));
      }

      this.dialog.add(row);
      this.linkTexts.push(row);
    });
  }

  private clearLinks(): void {
    this.linkTexts.forEach((row) => row.destroy());
    this.linkTexts = [];
  }

  private openLink(index: number): void {
    const link = this.activeObject?.links?.[index];
    if (!link) return;

    if (link.url.startsWith("mailto:")) {
      window.location.href = link.url;
    } else {
      window.open(link.url, "_blank", "noopener,noreferrer");
    }
  }

  // ========================================
  // LAYOUT
  // ========================================

  private layout(): void {
    const { width, height } = this.scene.scale;

    this.prompt.setPosition(width / 2, height - 30);

    if (this.activeObject) this.layoutDialog();
  }

  // The container sits at the dialog's center; children use local coordinates.
  private layoutDialog(): void {
    const { width: screenW, height: screenH } = this.scene.scale;

    const width = Math.min(DIALOG_MAX_WIDTH, screenW - 32);

    // Wrap width must be set before measuring the message height.
    this.dialogMessage.setWordWrapWidth(width - DIALOG_PADDING * 2);

    const titleH = this.dialogTitle.height;
    const linksH = this.linkTexts.length
      ? this.linkTexts.length * LINK_ROW_HEIGHT + 12
      : 0;
    const height = Math.max(
      DIALOG_MIN_HEIGHT,
      titleH + this.dialogMessage.height + linksH + 85
    );

    this.dialog.setPosition(screenW / 2, screenH - height / 2 - 28);

    this.dialogBackground.setSize(width, height);
    this.dialogInner.setSize(width - 10, height - 10);

    const left = -width / 2 + DIALOG_PADDING;
    const top = -height / 2 + 20;

    this.dialogTitle.setPosition(left + 10, top);
    this.dialogAccent
      .setSize(4, Math.max(24, titleH))
      .setPosition(left + 2, top + titleH / 2);

    this.dialogMessage.setPosition(left, top + titleH + 15);

    const linksTop = top + titleH + 15 + this.dialogMessage.height + 12;
    this.linkTexts.forEach((row, i) =>
      row.setPosition(left, linksTop + i * LINK_ROW_HEIGHT)
    );

    // Buttons have 8/6px text padding, so offset to keep the text aligned.
    const hintRight = width / 2 - DIALOG_PADDING + 8;
    const hintY = height / 2 - 31;

    this.dialogExit.setPosition(hintRight, hintY);
    this.dialogAction.setPosition(
      hintRight - this.dialogExit.width - 12,
      hintY
    );
  }
}