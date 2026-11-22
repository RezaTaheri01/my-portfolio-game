import { GameState, type Condition, type Effect } from "../systems/GameState";
import { runEffects } from "../systems/Effects";
import type { EntityConfig, SpawnContext, Updatable } from "../systems/SceneContent";

/**
 * Options for `kind: "trigger"`: an invisible area that fires when the
 * player walks in. x/y is the centre.
 *
 *   { id: "cave-hint", kind: "trigger", x: 300, y: 600, width: 120, height: 200,
 *     dialogueId: "lobby.cave_hint", effects: [{ setFlag: "saw_cave" }] }
 */
export interface TriggerConfig extends EntityConfig {
  width: number;
  height: number;
  /** Fire only the first time (remembered across scene visits). Default true. */
  once?: boolean;
  /** Only fires while this holds. */
  when?: Condition;
  dialogueId?: string;
  effects?: Effect[];
}

export class TriggerZone implements Updatable {
  public active = true;
  private inside = false;

  constructor(private readonly config: TriggerConfig, private readonly ctx: SpawnContext) {}

  public update(): void {
    const { config, ctx } = this;
    const { scene, player } = ctx;

    const nowInside =
      Math.abs(player.x - config.x) <= config.width / 2 &&
      Math.abs(player.y - config.y) <= config.height / 2;

    const entered = nowInside && !this.inside;
    this.inside = nowInside;
    if (!entered) return;

    const state = GameState.get(scene);
    const onceKey = `trigger.${config.id}`;
    const once = config.once ?? true;

    if (once && state.getFlag(onceKey)) return;
    if (config.when && !state.check(config.when)) return;
    if (once) state.setFlag(onceKey);

    runEffects(scene, config.effects);
    if (config.dialogueId) ctx.dialogue.start(config.dialogueId);

    if (once) this.active = false; // done: UpdateList drops it
  }
}
