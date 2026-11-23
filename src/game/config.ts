import Phaser from "phaser";
import { SCENES } from "../scenes";

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",

  pixelArt: false,
  antialias: true,
  roundPixels: false,

  width: 1280,
  height: 720,

  backgroundColor: "#10152f",

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
};
