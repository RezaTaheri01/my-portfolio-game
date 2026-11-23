import type { AssetManifest } from "../systems/AssetLoader";
import { MUSIC, SFX } from "./audio";

// ============================================================
// ASSET MANIFEST
// ------------------------------------------------------------
// Every file the game loads is declared here, grouped into
// "bundles". A scene preloads the bundles it needs, so adding
// an asset is one entry in one place:
//
//   images        { key, url }
//   spritesheets  { key, url, frameWidth, frameHeight }
//   audio         { key, urls }        (urls: use a() for ogg + mp3)
//   json          { key, url, role? }  (role "dialogue" => auto-registered)
//
// URLs are relative to /public (served from the site root).
// ============================================================

/** Expands "audio/sfx/door" to ogg + mp3, so every browser finds one it can play. */
const a = (path: string): string[] => [`${path}.ogg`, `${path}.mp3`];

export const ASSET_MANIFEST = {
  // Loaded by every gameplay scene.
  common: {
    audio: [
      { key: SFX.near, urls: a("audio/sfx/near") },
      { key: SFX.dialogOpen, urls: a("audio/sfx/dialog_open") },
      { key: SFX.dialogAdvance, urls: a("audio/sfx/dialog_advance") },
      { key: SFX.dialogClose, urls: a("audio/sfx/dialog_close") },
      { key: SFX.collect, urls: a("audio/sfx/collect") },
    ],
  },

  lobby: {
    audio: [{ key: MUSIC.lobby, urls: a("audio/music/lobby_night") }],
    json: [
      { key: "dialogues_lobby", url: "data/dialogues/lobby.json", role: "dialogue" },
    ],
  },
} as const satisfies AssetManifest;

export type BundleName = keyof typeof ASSET_MANIFEST;
