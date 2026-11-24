import Phaser from "phaser";
import { SCENES } from "../scenes";
import { QUALITY } from "./performance";

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",

  pixelArt: false,
  antialias: true,
  roundPixels: false,

  width: 1280,
  height: 720,

  backgroundColor: "#10152f",

  // Ask for the dedicated GPU and keep frame pacing steady on slow devices.
  render: { powerPreference: "high-performance", batchSize: QUALITY.mobile ? 2048 : 4096 },
  fps: { target: 60, smoothStep: true },

  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },

  scene: SCENES,

  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },

  input: { gamepad: true },
};
