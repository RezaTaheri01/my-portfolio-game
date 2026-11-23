import Phaser from "phaser";

// Toggle: F3 on keyboard, or triple-tap the top-left corner on touch.
// Starts visible if the URL has ?debug (e.g. http://192.168.1.20:5173/?debug).
export function attachDebugOverlay(scene: Phaser.Scene, toggleKey = "F3"): void {
  const startVisible = new URLSearchParams(window.location.search).has("debug");

  const text = scene.add
    .text(8, 8, "", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#9dff9d",
      backgroundColor: "#000000aa",
      padding: { x: 6, y: 4 },
    })
    .setScrollFactor(0)
    .setDepth(2000)
    .setVisible(startVisible);

  const toggle = (): void => void text.setVisible(!text.visible);

  // ---- refresh 4x/second ----
  let sinceRefresh = 0;
  const refresh = (_time: number, delta: number): void => {
    sinceRefresh += delta;
    if (!text.visible || sinceRefresh < 250) return;
    sinceRefresh = 0;

    const { actualFps, delta: frameMs } = scene.game.loop;
    text.setText(
      `FPS     ${actualFps.toFixed(0)}\n` +
      `frame   ${frameMs.toFixed(1)} ms\n` +
      `objects ${scene.children.length}\n` +
      `tweens  ${scene.tweens.getTweens().length}`
    );
  };

  // ---- triple-tap the top-left corner (works on touch and mouse) ----
  const CORNER = 70;      // px square, in screen coordinates
  const TAP_WINDOW = 700; // ms for all three taps
  let taps: number[] = [];

  const onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.x > CORNER || pointer.y > CORNER) return;

    const now = performance.now();
    taps = [...taps.filter((t) => now - t < TAP_WINDOW), now];

    if (taps.length >= 3) {
      taps = [];
      toggle();
    }
  };

  const keyboard = scene.input.keyboard;
  scene.events.on(Phaser.Scenes.Events.UPDATE, refresh);
  keyboard?.on(`keydown-${toggleKey}`, toggle);
  scene.input.on(Phaser.Input.Events.POINTER_DOWN, onPointerDown);

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, refresh);
    keyboard?.off(`keydown-${toggleKey}`, toggle);
    scene.input.off(Phaser.Input.Events.POINTER_DOWN, onPointerDown);
  });
}