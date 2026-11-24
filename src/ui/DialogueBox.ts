import Phaser from "phaser";
import { GAME_FONT, UI_COLORS as COLORS } from "../game/theme";
import { InputHints } from "../systems/InputHints";

// ============================================================
// DialogueBox: a speech bubble that floats in the game world,
// just above whoever is talking. It never covers the speaker or
// the player: it sits above the higher of the two heads, so both
// characters stay visible while the conversation plays out.
//
// It knows nothing about NPCs or dialogue data; DialogueManager
// tells it what to show and gets callbacks back.
// ============================================================

/** Anything the bubble can point at (NPCs, signs, the player). */
export interface BubbleTarget {
  x: number;
  y: number;
  /** Distance (px) from `y` up to the top of the head / board. */
  bubbleOffsetY?: number;
}

export interface DialogueView {
  title: string;
  text: string;
  /** Clickable rows below the text: dialogue choices or links. */
  options: string[];
  /** Verb of the continue button ("Continue" / "Close"), or null while waiting on a choice. */
  action: string | null;
  /** Who is talking: the bubble's tail points at them. */
  speaker: BubbleTarget;
  /** Someone else who must stay uncovered (the player). */
  avoid?: BubbleTarget;
}

export interface DialogueBoxHandlers {
  onAdvance(): void;
  onExit(): void;
  onOption(index: number): void;
}

const UI_DEPTH = 1001;
const MAX_WIDTH = 400;
const SCREEN_MARGIN = 12;
const PADDING = 16;
const TAIL_HEIGHT = 12;
const TAIL_HALF_WIDTH = 9;
const GAP_ABOVE_HEAD = 8;
const DEFAULT_HEAD = 90;
const OPTION_ROW_HEIGHT = 30;
const RADIUS = 12;

export class DialogueBox {
  private readonly root: Phaser.GameObjects.Container;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly hit: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly message: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly close: Phaser.GameObjects.Text;

  private optionRows: Phaser.GameObjects.Text[] = [];
  private optionLabels: string[] = [];
  private view: DialogueView | null = null;

  private width = MAX_WIDTH;
  private height = 100;
  // Last drawn frame, so the outline is only rebuilt when something changed.
  private drawn = { width: 0, height: 0, tailX: NaN };
  private unsubscribeHints?: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly handlers: DialogueBoxHandlers
  ) {
    const text = (size: number, color: string, extra: object = {}) =>
      scene.add.text(0, 0, "", { fontFamily: GAME_FONT, fontSize: `${size}px`, color, ...extra });

    this.frame = scene.add.graphics();

    // Tapping / clicking the bubble continues the dialogue (only while there's a Continue button).
    this.hit = scene.add
      .rectangle(0, 0, 1, 1, 0xffffff, 0)
      .setOrigin(0)
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, 1, 1), Phaser.Geom.Rectangle.Contains);
    this.hit.input!.cursor = "pointer";
    this.hit.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (this.view?.action) handlers.onAdvance();
    });

    this.title = text(17, COLORS.fireLight, { fontStyle: "bold" });
    this.message = text(15, COLORS.cream, { lineSpacing: 6 });
    this.hint = text(11, COLORS.muted);

    this.close = text(22, COLORS.muted, { padding: { x: 8, y: 0 } })
      .setText("×")
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    this.close.on(Phaser.Input.Events.POINTER_DOWN, () => handlers.onExit());
    this.close.on(Phaser.Input.Events.POINTER_OVER, () => this.close.setColor(COLORS.fireLight));
    this.close.on(Phaser.Input.Events.POINTER_OUT, () => this.close.setColor(COLORS.muted));

    this.root = scene.add
      .container(0, 0, [this.frame, this.hit, this.title, this.message, this.hint, this.close])
      .setDepth(UI_DEPTH)
      .setVisible(false);

    scene.scale.on("resize", this.layout, this);
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.follow, this);
    this.unsubscribeHints = InputHints.get(scene).onChange(() => this.refreshLabels());
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(view: DialogueView): void {
    const wasHidden = !this.root.visible;
    this.view = view;

    this.title.setText(view.title);
    this.message.setText(view.text);
    this.buildOptions(view.options);

    this.root.setVisible(true);
    this.refreshLabels();

    if (wasHidden) {
      this.scene.tweens.killTweensOf(this.root);
      this.root.setAlpha(0);
      this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 140, ease: "Sine.easeOut" });
    }
  }

  hide(): void {
    this.view = null;
    this.clearOptions();
    this.scene.tweens.killTweensOf(this.root);
    this.root.setVisible(false);
    this.close.setColor(COLORS.muted);
  }

  destroy(): void {
    this.unsubscribeHints?.();
    this.scene.scale.off("resize", this.layout, this);
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.follow, this);
    this.scene.tweens?.killTweensOf(this.root);
    this.root.destroy();
  }

  // ========================================
  // LABELS (follow the active device)
  // ========================================

  private refreshLabels(): void {
    const view = this.view;
    if (!view) return;

    const hints = InputHints.get(this.scene);
    const touch = hints.mode === "touch";
    const { interact, exit } = hints.labels;

    // Footer hint, e.g. "E to continue  ·  ESC to exit" or "Tap to continue".
    let footer: string;
    if (view.action) {
      const verb = view.action.toLowerCase();
      footer = touch ? `Tap to ${verb}` : `${interact} to ${verb}   ·   ${exit} to exit`;
    } else {
      const n = view.options.length;
      footer = touch ? "Tap an option" : `${n > 1 ? `1-${n}` : "1"} to choose   ·   ${exit} to exit`;
    }
    this.hint.setText(footer);

    this.optionRows.forEach((row, i) => row.setText(this.optionText(i, touch)));
    this.layout();
  }

  private optionText(index: number, touch: boolean): string {
    return `${touch ? "•" : index + 1}    ${this.optionLabels[index]}`;
  }

  // ========================================
  // OPTIONS (choices / links)
  // ========================================

  private buildOptions(labels: string[]): void {
    this.clearOptions();
    this.optionLabels = labels;

    labels.forEach((_, index) => {
      const row = this.scene.add
        .text(0, 0, "", {
          fontFamily: GAME_FONT,
          fontSize: "16px",
          color: COLORS.cream,
          padding: { x: 8, y: 4 },
        })
        .setInteractive({ useHandCursor: true });

      // POINTER_UP so browsers treat the click as a user gesture for popups.
      row.on(Phaser.Input.Events.POINTER_UP, () => this.handlers.onOption(index));

      if (InputHints.get(this.scene).mode !== "touch") {
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
    this.optionLabels = [];
  }

  // ========================================
  // LAYOUT (size) and FOLLOW (position)
  // ========================================

  // Children use local coordinates; the container's origin is the bubble's top-left.
  private layout(): void {
    if (!this.root.visible) return;

    const { width: screenW } = this.scene.scale;
    const width = Math.min(MAX_WIDTH, screenW - SCREEN_MARGIN * 2);
    const inner = width - PADDING * 2;

    this.title.setWordWrapWidth(inner - 28);
    this.message.setWordWrapWidth(inner);
    this.hint.setWordWrapWidth(inner);

    this.title.setPosition(PADDING + 8, PADDING - 2);
    const messageTop = this.title.y + this.title.height + 8;
    this.message.setPosition(PADDING, messageTop);

    const rowsTop = messageTop + this.message.height + (this.optionRows.length ? 8 : 0);
    this.optionRows.forEach((row, i) => row.setPosition(PADDING - 8, rowsTop + i * OPTION_ROW_HEIGHT));

    const hintTop = rowsTop + this.optionRows.length * OPTION_ROW_HEIGHT + 8;
    this.hint.setPosition(PADDING, hintTop);

    this.width = width;
    this.height = hintTop + this.hint.height + PADDING - 2;

    this.hit.setSize(width, this.height);
    // Shapes don't resize their input area on their own.
    (this.hit.input!.hitArea as Phaser.Geom.Rectangle).setSize(width, this.height);
    this.close.setPosition(width - 6, 6);

    this.follow();
  }

  private headTop(target: BubbleTarget): number {
    return target.y - (target.bubbleOffsetY ?? DEFAULT_HEAD);
  }

  /** Runs every frame: keeps the bubble above the speaker, inside the screen. */
  private follow(): void {
    const view = this.view;
    if (!view || !this.root.visible) return;

    const { worldView } = this.scene.cameras.main;
    const { width, height } = this;

    // Above the higher head, so neither character is covered.
    const lowestAllowed = Math.min(
      this.headTop(view.speaker),
      view.avoid ? this.headTop(view.avoid) : Infinity
    );
    const bottom = lowestAllowed - GAP_ABOVE_HEAD - TAIL_HEIGHT;

    const minX = worldView.x + SCREEN_MARGIN;
    const maxX = worldView.right - SCREEN_MARGIN - width;
    const left = Phaser.Math.Clamp(view.speaker.x - width / 2, minX, Math.max(minX, maxX));
    const top = Math.max(worldView.y + SCREEN_MARGIN, bottom - height);

    this.root.setPosition(Math.round(left), Math.round(top));

    const tailX = Phaser.Math.Clamp(
      Math.round(view.speaker.x - left),
      RADIUS + TAIL_HALF_WIDTH,
      width - RADIUS - TAIL_HALF_WIDTH
    );
    this.redraw(width, height, tailX);
  }

  private redraw(width: number, height: number, tailX: number): void {
    const d = this.drawn;
    if (d.width === width && d.height === height && d.tailX === tailX) return;
    this.drawn = { width, height, tailX };

    const g = this.frame;
    g.clear();

    // Body
    g.fillStyle(COLORS.forest, 0.96).fillRoundedRect(0, 0, width, height, RADIUS);
    g.fillStyle(COLORS.forestLight, 0.9).fillRoundedRect(4, 4, width - 8, height - 8, RADIUS - 3);

    // Tail (filled, then outlined on its two slanted edges only)
    const tipY = height + TAIL_HEIGHT;
    g.fillStyle(COLORS.forest, 0.96).fillTriangle(
      tailX - TAIL_HALF_WIDTH, height - 1,
      tailX + TAIL_HALF_WIDTH, height - 1,
      tailX, tipY
    );

    // Outline
    g.lineStyle(3, COLORS.wood, 1);
    g.beginPath();
    g.moveTo(tailX - TAIL_HALF_WIDTH, height);
    g.lineTo(tailX, tipY);
    g.lineTo(tailX + TAIL_HALF_WIDTH, height);
    g.strokePath();

    g.strokeRoundedRect(0, 0, width, height, RADIUS);

    // Cover the outline where the tail joins the body.
    g.lineStyle(4, COLORS.forest, 1);
    g.lineBetween(tailX - TAIL_HALF_WIDTH + 2, height, tailX + TAIL_HALF_WIDTH - 2, height);

    // Title accent
    g.fillStyle(COLORS.fire, 1).fillRect(PADDING, PADDING, 3, Math.max(18, this.title.height - 4));
  }
}
