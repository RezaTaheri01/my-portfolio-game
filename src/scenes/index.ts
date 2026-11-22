import type Phaser from "phaser";
import { LobbyScene } from "./Lobby/LobbyScene";

// The scene list handed to Phaser. The first entry starts automatically.
// New scene: create it under scenes/<Name>/ and add it here (see docs/EXTENDING.md).
export const SCENES: Phaser.Types.Scenes.SceneType[] = [LobbyScene];
