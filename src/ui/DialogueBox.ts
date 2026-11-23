import Phaser from "phaser";
import { GAME_FONT, UI_COLORS as COLORS } from "../game/theme";

// ============================================================
// DialogueBox: the visual component only (the panel at the bottom
// of the screen). It knows nothing about NPCs or dialogue data;
// DialogueManager tells it what to show and gets callbacks back.
// Layout/visuals are unchanged from when this lived in InteractionManager.
// ============================================================

export interface DialogueView {
  title: string;
  text: string;
  /** Clickable rows below the text: dialogue choices or links. */
  options: string[];
  /** Label of the continue/close button, or null to hide it (waiting on a choice). */
  action: string | null;
}

export interface DialogueBoxHandlers {
  onAdvance(): void;
  onExit(): void;
  onOption(index: number): void;
}

const UI_DEPTH = 1000;
const DIALOG_MAX_WIDTH = 560;
const DIALOG_MIN_HEIGHT = 150;
const DIALOG_PADDING = 30;
const OPTION_ROW_HEIGHT = 32;

export class DialogueBox {
  private readonly isTouch: boolean;

  private readonly root: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly inner: Phaser.GameObjects.Rectangle;
  private readonly accent: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly message: Phaser.GameObjects.Text;
  private readonly action: Phaser.GameObjects.Text;
  private readonly exit: Phaser.GameObjects.Text;

  private optionRows: Phaser.GameObjects.Text[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly handlers: DialogueBoxHandlers
  ) {
    this.isTouch = scene.sys.game.device.input.touch;

    const text = (size: number, color: string, extra: object = {}) =>
      scene.add.text(0, 0, "", { fontFamily: GAME_FONT, fontSize: `${size}px`, color, ...extra });

    this.background = scene.add
      .rectangle(0, 0, 1, 1, COLORS.forest, 0.97)
      .setStrokeStyle(3, COLORS.wood);

    this.inner = scene.add
      .rectangle(0, 0, 1, 1, COLORS.forestLight, 0.96)
      .setStrokeStyle(1, COLORS.forestBorder);

    this.accent = scene.add.rectangle(0, 0, 4, 28, COLORS.fire);

    this.title = text(22, COLORS.fireLight, { fontStyle: "bold" });
    this.message = text(16, COLORS.cream, { lineSpacing: 9 });

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

    this.action = button("", () => handlers.onAdvance());
    this.exit = button(this.isTouch ? "Exit" : "ESC  Exit", () => handlers.onExit());

    this.root = scene.add
      .container(0, 0, [
        this.background, this.inner, this.accent,
        this.title, this.message, this.action, this.exit,
      ])
      .setScrollFactor(0)
      .setDepth(UI_DEPTH + 1)
      .setVisible(false);

    scene.scale.on("resize", this.layout, this);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(view: DialogueView): void {
    this.title.setText(view.title);
    this.buildOptions(view.options);
    this.message.setText(view.text);

    this.action.setVisible(view.action !== null);
    if (view.action !== null) {
      this.action.setText(this.isTouch ? view.action : `E  ${view.action}`);
    }

    this.root.setVisible(true);
    this.layout();
  }

  hide(): void {
    this.clearOptions();
    this.root.setVisible(false);
    this.action.setColor(COLORS.muted);
    this.exit.setColor(COLORS.muted);
  }

  destroy(): void {
    this.scene.scale.off("resize", this.layout, this);
    this.root.destroy();
  }

  // ========================================
  // OPTIONS (choices / links)
  // ========================================

  private buildOptions(labels: string[]): void {
    this.clearOptions();

    labels.forEach((label, index) => {
      const row = this.scene.add
        .text(0, 0, `${index + 1}    ${label}`, {
          fontFamily: GAME_FONT,
          fontSize: "17px",
          color: COLORS.cream,
          padding: { x: 8, y: 4 },
        })
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });

      // POINTER_UP so browsers treat the click as a user gesture for popups.
      row.on(Phaser.Input.Events.POINTER_UP, () => this.handlers.onOption(index));

      if (!this.isTouch) {
        row.on(Phaser.Input.Events.POINTER_OVER, () => row.setColor(COLORS.fireLight));
        row.on(Phaser.Input.Events.POINTER_OUT, () => row.setColor(COLORS.cream));
      }

      this.root.add(row);
      this.optionRows.push(row);
    });
  }

  private clearOptions(): void {
    this.optionRows.forEach((row) => row.destroy());
    this.optionRows = [];
  }

  // ========================================
  // LAYOUT
  // ========================================

  // The container sits at the dialog's center; children use local coordinates.
  private layout(): void {
    if (!this.root.visible) return;

    const { width: screenW, height: screenH } = this.scene.scale;
    const width = Math.min(DIALOG_MAX_WIDTH, screenW - 32);

    // Wrap width must be set before measuring the message height.
    this.message.setWordWrapWidth(width - DIALOG_PADDING * 2);

    const titleH = this.title.height;
    const optionsH = this.optionRows.length ? this.optionRows.length * OPTION_ROW_HEIGHT + 12 : 0;
    const height = Math.max(DIALOG_MIN_HEIGHT, titleH + this.message.height + optionsH + 85);

    this.root.setPosition(screenW / 2, screenH - height / 2 - 28);

    this.background.setSize(width, height);
    this.inner.setSize(width - 10, height - 10);

    const left = -width / 2 + DIALOG_PADDING;
    const top = -height / 2 + 20;

    this.title.setPosition(left + 10, top);
    this.accent.setSize(4, Math.max(24, titleH)).setPosition(left + 2, top + titleH / 2);

    this.message.setPosition(left, top + titleH + 15);

    const rowsTop = top + titleH + 15 + this.message.height + 12;
    this.optionRows.forEach((row, i) => row.setPosition(left, rowsTop + i * OPTION_ROW_HEIGHT));

    // Buttons have 8/6px text padding, so offset to keep the text aligned.
    const hintRight = width / 2 - DIALOG_PADDING + 8;
    const hintY = height / 2 - 31;

    this.exit.setPosition(hintRight, hintY);
    this.action.setPosition(hintRight - this.exit.width - 12, hintY);
  }
}
