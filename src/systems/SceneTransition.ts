import Phaser from "phaser";

// ============================================================
// Moving between scenes: fade out -> start the target scene ->
// the target fades itself in and places the player at a spawn point.
//
//   leaving:   SceneTransition.go(this, "CaveScene", { spawn: { x: 120 } });
//   arriving:  const start = SceneTransition.arrive(this, { x: 180, y: 600 });   // in create(), before making the Player
//
// Used by objects/Door.ts, but anything (a trigger, a dialogue effect...)
// can call go().
// ============================================================

export interface SpawnPoint {
  x: number;
  /** Optional: leave out to use the scene's default height. */
  y?: number;
}

export interface TransitionOptions {
  /** Where the player appears in the target scene. */
  spawn?: SpawnPoint;
  /** Fade-out length in ms. Default 450. */
  fadeMs?: number;
  /** Fade colour [r, g, b] (e.g. white for a light door). The next scene fades in from the same colour. */
  fadeColor?: readonly [number, number, number];
}

// Same colour as `backgroundColor` in game/config.ts, so fades blend with the page.
const FADE_RGB = [16, 21, 47] as const;

let pendingSpawn: SpawnPoint | null = null;
let pendingColor: readonly [number, number, number] | null = null;
let busy = false;

export const SceneTransition = {
  /** True while a fade-out is running (ignore further doors / inputs). */
  get isBusy(): boolean {
    return busy;
  },

  /**
   * Fade out and switch to `targetScene` (the key passed to `super("...")`
   * in the scene's constructor). Returns false if it can't be done.
   */
  go(scene: Phaser.Scene, targetScene: string, options: TransitionOptions = {}): boolean {
    if (busy) return false;

    if (!scene.scene.manager.keys[targetScene]) {
      console.warn(
        `[SceneTransition] Unknown scene "${targetScene}". Add it to scenes/index.ts.`
      );
      return false;
    }

    busy = true;
    pendingSpawn = options.spawn ?? null;
    pendingColor = options.fadeColor ?? null;

    // Freeze the player's input for the fade; restored on shutdown.
    const keyboard = scene.input.keyboard;
    if (keyboard) {
      keyboard.resetKeys();
      keyboard.enabled = false;
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (keyboard) keyboard.enabled = true;
    });

    const camera = scene.cameras.main;
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      busy = false;
      scene.scene.start(targetScene);
    });
    camera.fadeOut(options.fadeMs ?? 450, ...(options.fadeColor ?? FADE_RGB));
    return true;
  },

  /** Read (and clear) the spawn point the previous scene asked for. */
  consumeSpawn(): SpawnPoint | null {
    const spawn = pendingSpawn;
    pendingSpawn = null;
    return spawn;
  },

  /**
   * One call for any scene's create(): fades in from the transition colour and
   * returns where the player should start (the door's spawn, or `fallback`).
   *
   *   const start = SceneTransition.arrive(this, { x: 180, y: 600 });
   *   this.player = new Player(this, start.x, start.y ?? 600);
   */
  arrive(scene: Phaser.Scene, fallback: SpawnPoint): SpawnPoint {
    const spawn = SceneTransition.consumeSpawn();
    SceneTransition.fadeIn(scene);
    return { x: spawn?.x ?? fallback.x, y: spawn?.y ?? fallback.y };
  },

  /** Lower-level: fades in from the transition colour (arrive() calls this). */
  fadeIn(scene: Phaser.Scene, ms = 600): void {
    scene.cameras.main.fadeIn(ms, ...(pendingColor ?? FADE_RGB));
    pendingColor = null;
  },
};
