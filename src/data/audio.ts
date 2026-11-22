// Audio keys used by code. The files behind them are declared in data/assets.ts.
// Referencing keys through these constants (not string literals) gives you
// autocomplete and makes "who plays this sound?" a one-click search.

export const MUSIC = {
  lobby: "bgm_lobby",
} as const;

export const SFX = {
  /** Player walks into range of something interactable. */
  near: "sfx_near",
  dialogOpen: "sfx_dialog_open",
  dialogAdvance: "sfx_dialog_advance",
  dialogClose: "sfx_dialog_close",
  collect: "sfx_collect",
} as const;
