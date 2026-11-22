import type Phaser from "phaser";
import { AudioManager } from "./AudioManager";
import { GameState, type Effect } from "./GameState";

/** Runs data-defined effects (from dialogue JSON, items, triggers...). */
export function runEffects(scene: Phaser.Scene, effects?: readonly Effect[]): void {
  if (!effects?.length) return;

  const state = GameState.get(scene);

  for (const effect of effects) {
    if ("setFlag" in effect) state.setFlag(effect.setFlag, effect.value ?? true);
    else if ("inc" in effect) state.inc(effect.inc, effect.by ?? 1);
    else if ("give" in effect) state.addItem(effect.give, effect.count ?? 1);
    else if ("take" in effect) state.removeItem(effect.take, effect.count ?? 1);
    else if ("sfx" in effect) AudioManager.get(scene).playSfx(effect.sfx);
    else if ("emit" in effect) state.events.emit(effect.emit, effect.data);
  }
}
