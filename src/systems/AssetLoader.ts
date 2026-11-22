import Phaser from "phaser";
import { ASSET_MANIFEST, type BundleName } from "../data/assets";

// ============================================================
// Manifest-driven loading. The data lives in data/assets.ts;
// this file is the (small) engine that reads it.
//
//   preload() { queueBundles(this, ["common", "lobby"]); }
//
// Phaser's own preload phase waits for everything queued here.
// Assets already in the cache are skipped, so revisiting a scene is free.
// ============================================================

export interface ImageAsset {
  key: string;
  url: string;
}
export interface SpritesheetAsset {
  key: string;
  url: string;
  frameWidth: number;
  frameHeight: number;
  endFrame?: number;
}
export interface AudioAsset {
  key: string;
  /** Several formats of the same sound; the browser picks the first it can play. */
  urls: string | readonly string[];
}
export interface JsonAsset {
  key: string;
  url: string;
  /** "dialogue" files are registered with DialogueManager automatically. */
  role?: "dialogue" | "data";
}

export interface AssetBundle {
  readonly images?: readonly ImageAsset[];
  readonly spritesheets?: readonly SpritesheetAsset[];
  readonly audio?: readonly AudioAsset[];
  readonly json?: readonly JsonAsset[];
}
export type AssetManifest = Readonly<Record<string, AssetBundle>>;

// Respect Vite's `base` so the game also works when hosted under a sub-path
// (e.g. https://user.github.io/portfolio/).
const BASE_URL =
  (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";

// A missing file should be loud in the console but never block the game.
const onFileError = (file: Phaser.Loader.File): void => {
  console.warn(`[AssetLoader] Failed to load "${file.key}" (${file.url})`);
};

/** Queue every not-yet-cached asset of the given bundles on the scene's loader. */
export function queueBundles(scene: Phaser.Scene, names: readonly BundleName[]): void {
  const { load, textures, cache } = scene;

  load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);
  load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);
  load.setPath(BASE_URL);

  for (const name of names) {
    const bundle: AssetBundle = ASSET_MANIFEST[name];

    for (const a of bundle.images ?? []) {
      if (!textures.exists(a.key)) load.image(a.key, a.url);
    }
    for (const a of bundle.spritesheets ?? []) {
      if (textures.exists(a.key)) continue;
      load.spritesheet(a.key, a.url, {
        frameWidth: a.frameWidth,
        frameHeight: a.frameHeight,
        endFrame: a.endFrame,
      });
    }
    for (const a of bundle.audio ?? []) {
      if (!cache.audio.exists(a.key)) load.audio(a.key, [...(typeof a.urls === "string" ? [a.urls] : a.urls)]);
    }
    for (const a of bundle.json ?? []) {
      if (!cache.json.exists(a.key)) load.json(a.key, a.url);
    }
  }

  load.setPath("");
}

/**
 * Load bundles on demand while a scene is already running
 * (e.g. before opening a heavy area). Resolves when finished.
 */
export function loadBundles(scene: Phaser.Scene, names: readonly BundleName[]): Promise<void> {
  return new Promise((resolve) => {
    queueBundles(scene, names);

    if (scene.load.list.size === 0) {
      resolve();
      return;
    }
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    scene.load.start();
  });
}

/** Cache keys of the JSON files with the given role, across bundles. */
export function jsonKeysByRole(
  names: readonly BundleName[],
  role: NonNullable<JsonAsset["role"]>
): string[] {
  return names.flatMap((name) => {
    const bundle: AssetBundle = ASSET_MANIFEST[name];
    return (bundle.json ?? []).filter((j) => j.role === role).map((j) => j.key);
  });
}
