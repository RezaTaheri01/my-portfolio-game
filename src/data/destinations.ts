import type { SpawnPoint } from "../systems/SceneTransition";

// ============================================================
// DESTINATIONS: where doors (or any SceneTransition.go call) lead.
// Declared once here, so every scene's doors share the same target,
// spawn point, title and popup text:
//
//   { id: "door-a", kind: "door", x: 740, y: 640, to: "lobbyFarSide" }
//
// A door can still override any field inline (title, description, spawn...).
// `scene` is the key from the scene's constructor: super("LobbyScene").
// ============================================================

export interface Destination {
  /** Scene key (must be listed in scenes/index.ts). */
  scene: string;
  /** Where the player appears there. Default: that scene's own start position. */
  spawn?: SpawnPoint;
  /** Popup text shown above any door that leads here. */
  title?: string;
  description?: string;
}

export const DESTINATIONS: Record<string, Destination> = {
  // Placeholder: points back at the lobby so the door can be tried before more scenes exist.
  TestLobby: {
    scene: "LobbyScene",
    spawn: { x: 1925, y: 600 },
    title: "Lobby",
    description: "Recursion!!!",
  },
};
