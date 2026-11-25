import { MUSIC } from "../audio";
import type { SceneContent } from "../../systems/SceneContent";

// ============================================================
// LOBBY CONTENT: what is placed in the lobby.
// Dialogue text lives in public/data/dialogues/lobby.json,
// referenced here by `dialogueId`.
//
// Adding something = adding an entry. See docs/EXTENDING.md.
// Entity kinds are registered in objects/register.ts.
// ============================================================

export const LOBBY: SceneContent = {
  bundles: ["common", "lobby"],

  music: { key: MUSIC.lobby, volume: 0.6, fadeIn: 2500 },

  entities: [
    // ---------- signposts ----------
    {
      id: "welcome-sign", kind: "sign", x: 500, y: 625,
      groundY: 640, boardWidth: 140, boardHeight: 66,
      signTitle: "WELCOME", dialogueId: "lobby.welcome",
    },
    {
      id: "links-sign", kind: "sign", x: 1650, y: 625,
      groundY: 640, boardWidth: 140, boardHeight: 66,
      signTitle: "FIND REZA", dialogueId: "lobby.links",
    },

    // ---------- doors ----------
    // Walk up and press E. `to` names an entry in data/destinations.ts (scene, spawn
    // point and popup text live there, shared by every scene's doors).
    // Locked variant: add  requires: { flag: "has_lobby_key" }, lockedDialogueId: "lobby.door_locked"
    { id: "lobby-door", kind: "door", x: 1925, y: 660, to: "TestLobby" },

    // ---------- campfire NPCs ----------
    // Sajjad sits on the log drawn in LobbyScene.createCampfireArea():
    // keep his x in sync with that log (logX).
    { id: "sajjad", kind: "sajjad", x: 965, y: 640, dialogueId: "lobby.sajjad" },

    // Brown bear with the Lion & Sun flag, on the other side of the fire.
    { id: "khers", kind: "brown-bear", x: 1155, y: 650, dialogueId: "lobby.khers" },
  ],
};
