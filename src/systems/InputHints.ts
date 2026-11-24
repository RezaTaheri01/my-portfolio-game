import Phaser from "phaser";

// ============================================================
// InputHints
// ------------------------------------------------------------
// Tracks whether the player last used the keyboard or a gamepad,
// and gives UI code the matching button labels. One per game.
//
//   const hints = InputHints.get(scene);
//   hints.labels.interact             // "E", "X/SQ" or "Tap"
//   const off = hints.onChange(redraw); // call off() on scene shutdown
// ============================================================

export type InputMode = "keyboard" | "pad" | "touch";

/** Standard-mapping gamepad buttons used by the game (0 A, 1 B, 2 X, 3 Y). */
export const PAD_BUTTONS = { jump: 0, exit: 1, interact: 2 } as const;

export interface InputLabels {
  move: string;
  jump: string;
  interact: string;
  exit: string;
  mute: string;
  /** Full controls hint line for the HUD. */
  hint: string;
}

const LABELS: Record<InputMode, InputLabels> = {
  keyboard: {
    move: "ARROWS", jump: "SPACE", interact: "E", exit: "ESC", mute: "M",
    hint: "ARROWS: Move     SPACE: Jump     E: Interact     M: Mute",
  },
  pad: {
    move: "D-PAD", jump: "A/X", interact: "X/SQ", exit: "B/O", mute: "START",
    hint: "D-PAD: Move     A/X: Jump     X/SQ: Interact     START: Mute",
  },
  touch: {
    move: "Arrows", jump: "Jump", interact: "Tap", exit: "Exit", mute: "",
    hint: "",
  },
};

const STICK_THRESHOLD = 0.5;

export class InputHints {
  private static readonly instances = new WeakMap<Phaser.Game, InputHints>();

  static get(scene: Phaser.Scene): InputHints {
    const game = scene.sys.game;
    let hints = InputHints.instances.get(game);
    if (!hints) {
      hints = new InputHints(game);
      InputHints.instances.set(game, hints);
    }
    return hints;
  }

  private current: InputMode = "keyboard";
  private readonly listeners = new Set<(mode: InputMode) => void>();
  private readonly pressListeners = new Set<(buttonIndex: number) => void>();
  /** Previous pressed state per pad, for edge detection. */
  private readonly padState = new Map<number, boolean[]>();

  private constructor(private readonly game: Phaser.Game) {
    // Phones and tablets start in touch mode; desktops (even touch-screen
    // ones) start on keyboard and switch the moment a finger is used.
    const { input, os } = game.device;
    if ((input.touch || navigator.maxTouchPoints > 0) && !os.desktop) this.current = "touch";

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("pointerdown", this.onPointerDown, true);
    this.game.events.on(Phaser.Core.Events.POST_STEP, this.pollPads, this);

    this.game.events.once(Phaser.Core.Events.DESTROY, () => {
      window.removeEventListener("keydown", this.onKeyDown);
      window.removeEventListener("pointerdown", this.onPointerDown, true);
      this.game.events.off(Phaser.Core.Events.POST_STEP, this.pollPads, this);
      this.listeners.clear();
      this.pressListeners.clear();
    });
  }

  get mode(): InputMode {
    return this.current;
  }

  get labels(): InputLabels {
    return LABELS[this.current];
  }

  /** Called whenever the active device changes. Returns an unsubscribe function. */
  onChange(listener: (mode: InputMode) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Called once each time a pad button goes down (index = standard mapping:
   * 0 A, 1 B, 2 X, 3 Y, 8 Back, 9 Start). Read straight from the browser's
   * Gamepad API, so it doesn't depend on Phaser's gamepad plugin.
   * Returns an unsubscribe function.
   */
  onPadPress(listener: (buttonIndex: number) => void): () => void {
    this.pressListeners.add(listener);
    return () => this.pressListeners.delete(listener);
  }

  private set(mode: InputMode): void {
    if (this.current === mode) return;
    this.current = mode;
    this.listeners.forEach((listener) => listener(mode));
  }

  private onKeyDown = (): void => this.set("keyboard");

  private onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === "touch") this.set("touch");
    else if (this.current === "touch") this.set("keyboard"); // a mouse click after touch
  };

  /** Runs every frame: detects button presses and switches hints to controller on any pad use. */
  private pollPads(): void {
    if (typeof navigator.getGamepads !== "function") return;

    let used = false;

    for (const pad of navigator.getGamepads()) {
      if (!pad) continue;

      const previous = this.padState.get(pad.index) ?? [];
      const now = pad.buttons.map((b) => b.pressed);

      now.forEach((down, index) => {
        if (!down) return;
        used = true;
        if (!previous[index]) this.pressListeners.forEach((listener) => listener(index));
      });

      if (pad.axes.some((a) => Math.abs(a) > STICK_THRESHOLD)) used = true;

      this.padState.set(pad.index, now);
    }

    if (used) this.set("pad");
  }
}