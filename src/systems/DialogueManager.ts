import Phaser from "phaser";
import { SFX } from "../data/audio";
import { LINK_SETS, type InteractableLink } from "../data/links";
import { DialogueBox, type BubbleTarget } from "../ui/DialogueBox";
import { jsonKeysByRole } from "./AssetLoader";
import type { BundleName } from "../data/assets";
import { AudioManager } from "./AudioManager";
import { runEffects } from "./Effects";
import { GameState, type Condition, type Effect } from "./GameState";

// ============================================================
// DIALOGUE DATA FORMAT (public/data/dialogues/*.json)
// ------------------------------------------------------------
// A file is { "dialogues": DialogueData[] }. Example:
//
// {
//   "id": "lobby.sajjad",           // what NPCs / triggers reference
//   "speaker": "Sajjad",            // title shown on the box
//   "start": "intro",               // node id, or [{ "when": cond, "node": id }, ...]
//   "nodes": {
//     "intro": {
//       "pages": [["line 1", "line 2"], "another page"],  // E = next page
//       "next": "outro",            // after the last page (omit = end)
//       "repeat": { "runs": 2, "then": "outro" }
//     },
//     "outro": { "pages": ["bye"] }
//   }
// }
//
// Other node fields: speaker, choices, links, effects. See the types below.
// ============================================================

/** A page of text: a string, or an array of lines joined with "\n". */
export type DialogueText = string | string[];

export interface DialogueChoice {
  text: string;
  /** Node to go to. Omit to end the conversation. */
  next?: string;
  /** Hidden unless this passes. */
  when?: Condition;
  effects?: Effect[];
}

export interface DialogueNode {
  pages: DialogueText[];
  /** Overrides the dialogue's speaker for this node. */
  speaker?: string;
  /** Node shown after the last page. Ignored if there are visible choices. */
  next?: string;
  /** Shown as numbered options after the last page. */
  choices?: DialogueChoice[];
  /** Link rows after the last page: a key of LINK_SETS (data/links.ts) or inline links. */
  links?: string | InteractableLink[];
  /** Run each time the node is entered. */
  effects?: Effect[];
  /**
   * Remembers progress in this node: closing early resumes on the same page,
   * and once the pages were read through `runs` times, entering the node
   * jumps to `then` instead.
   */
  repeat?: { runs: number; then: string };
}

export interface ConditionalStart {
  when?: Condition;
  node: string;
}

export interface DialogueData {
  id: string;
  speaker: string;
  start: string | ConditionalStart[];
  nodes: Record<string, DialogueNode>;
}

interface ShownOption {
  label: string;
  run(): void;
}

export interface StartOptions {
  /** Runs when the dialogue closes. */
  onEnd?: () => void;
  /** Who is talking (the bubble floats above them). Default: the player. */
  speaker?: BubbleTarget;
}

interface Session {
  data: DialogueData;
  speaker: BubbleTarget;
  nodeId: string;
  page: number;
  options: ShownOption[];
  hasChoices: boolean;
  onEnd?: () => void;
}

const pageText = (page: DialogueText | undefined): string =>
  Array.isArray(page) ? page.join("\n") : page ?? "";

function openUrl(url: string): void {
  if (url.startsWith("mailto:")) window.location.href = url;
  else window.open(url, "_blank", "noopener,noreferrer");
}

export class DialogueManager {
  // ---------- content database (shared by all scenes) ----------

  private static readonly library = new Map<string, { data: DialogueData; source: string }>();

  static register(list: readonly DialogueData[], source: string): void {
    for (const data of list) {
      const problems = DialogueManager.validate(data);
      problems.forEach((p) => console.error(`[Dialogue] ${source}: "${data.id}" ${p}`));

      const existing = DialogueManager.library.get(data.id);
      if (existing && existing.source !== source) {
        console.warn(`[Dialogue] "${data.id}" is defined in both ${existing.source} and ${source}.`);
      }
      DialogueManager.library.set(data.id, { data, source });
    }
  }

  /** Register every dialogue file (role "dialogue") of the given bundles from Phaser's JSON cache. */
  static registerFromCache(scene: Phaser.Scene, bundles: readonly BundleName[]): void {
    for (const key of jsonKeysByRole(bundles, "dialogue")) {
      const file = scene.cache.json.get(key) as { dialogues?: DialogueData[] } | undefined;

      if (!file?.dialogues) {
        console.warn(`[Dialogue] "${key}" is not loaded or has no "dialogues" array.`);
        continue;
      }
      DialogueManager.register(file.dialogues, key);
    }
  }

  static has(id: string): boolean {
    return DialogueManager.library.has(id);
  }

  /** Catches typos in node ids when the file loads, not when a player hits them. */
  private static validate(data: DialogueData): string[] {
    const problems: string[] = [];
    const ref = (target: string | undefined, where: string): void => {
      if (target !== undefined && !data.nodes[target]) problems.push(`${where} points to missing node "${target}"`);
    };

    if (typeof data.start === "string") ref(data.start, "start");
    else data.start.forEach((s, i) => ref(s.node, `start[${i}]`));

    for (const [id, node] of Object.entries(data.nodes)) {
      if (!node.pages?.length) problems.push(`node "${id}" has no pages`);
      ref(node.next, `node "${id}".next`);
      ref(node.repeat?.then, `node "${id}".repeat.then`);
      node.choices?.forEach((c, i) => ref(c.next, `node "${id}".choices[${i}].next`));
      if (typeof node.links === "string" && !LINK_SETS[node.links]) {
        problems.push(`node "${id}" uses unknown link set "${node.links}"`);
      }
    }
    return problems;
  }

  // ---------- one manager (and one box) per scene ----------

  private readonly box: DialogueBox;
  private session: Session | null = null;

  /** `player` is who the bubble avoids covering, and who speaks when nobody else is given. */
  constructor(private readonly scene: Phaser.Scene, private readonly player: BubbleTarget) {
    this.box = new DialogueBox(scene, {
      onAdvance: () => this.advance(),
      onExit: () => this.close(),
      onOption: (i) => this.choose(i),
    });

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  get isOpen(): boolean {
    return this.session !== null;
  }

  /** Open a dialogue by id. Returns false (and logs) if the id is unknown. */
  start(id: string, { onEnd, speaker }: StartOptions = {}): boolean {
    const entry = DialogueManager.library.get(id);
    if (!entry) {
      console.warn(`[Dialogue] Unknown dialogue "${id}".`);
      return false;
    }

    if (this.session) this.end(false);

    const { data } = entry;
    const startNode = this.resolveStart(data);
    this.session = {
      data, speaker: speaker ?? this.player, nodeId: startNode, page: 0, options: [], hasChoices: false, onEnd,
    };

    this.sfx(SFX.dialogOpen);
    this.enterNode(startNode);
    return this.session !== null;
  }

  /** Next page / next node / close. Bound to the interact key and tapping the bubble. */
  advance(): void {
    const s = this.session;
    if (!s) return;

    const node = this.node(s);
    if (s.page < node.pages.length - 1) {
      s.page++;
      this.sfx(SFX.dialogAdvance);
      this.render();
    } else if (s.hasChoices) {
      return; // the player must pick an option
    } else if (node.next) {
      this.sfx(SFX.dialogAdvance);
      this.enterNode(node.next);
    } else {
      this.close();
    }
  }

  /** Pick option `index` (choice or link). Bound to number keys and clicks. */
  choose(index: number): void {
    this.session?.options[index]?.run();
  }

  close(): void {
    this.end(true);
  }

  destroy(): void {
    this.session = null;
    this.box.destroy();
  }

  // ========================================
  // INTERNALS
  // ========================================

  private end(playSound: boolean): void {
    const s = this.session;
    if (!s) return;

    this.session = null;
    this.box.hide();
    if (playSound) this.sfx(SFX.dialogClose);
    s.onEnd?.();
  }

  private sfx(key: string): void {
    AudioManager.get(this.scene).playSfx(key);
  }

  private node(s: Session): DialogueNode {
    return s.data.nodes[s.nodeId];
  }

  private resolveStart(data: DialogueData): string {
    if (typeof data.start === "string") return data.start;

    const state = GameState.get(this.scene);
    const match = data.start.find((s) => !s.when || state.check(s.when));
    return (match ?? data.start[data.start.length - 1]).node;
  }

  private enterNode(nodeId: string): void {
    const s = this.session;
    if (!s) return;

    const state = GameState.get(this.scene);
    let id = nodeId;
    let node = s.data.nodes[id];

    // A node that has been read `runs` times hands over to its `then` node.
    for (let hops = 0; node?.repeat && hops < 8; hops++) {
      if (state.memory(`${s.data.id}/${id}`).runs < node.repeat.runs) break;
      id = node.repeat.then;
      node = s.data.nodes[id];
    }

    if (!node) {
      console.error(`[Dialogue] "${s.data.id}" has no node "${id}".`);
      this.end(false);
      return;
    }

    s.nodeId = id;
    runEffects(this.scene, node.effects);

    s.page = node.repeat
      ? Math.min(state.memory(`${s.data.id}/${id}`).page, node.pages.length - 1) // resume
      : 0;

    this.render();
  }

  private render(): void {
    const s = this.session;
    if (!s) return;

    const node = this.node(s);
    const state = GameState.get(this.scene);
    const isLast = s.page >= node.pages.length - 1;

    // Remember where the player is; reaching the last page completes a run.
    if (node.repeat) {
      const memory = state.memory(`${s.data.id}/${s.nodeId}`);
      if (isLast) {
        memory.runs++;
        memory.page = 0;
      } else {
        memory.page = s.page;
      }
    }

    const options: ShownOption[] = [];

    if (isLast) {
      for (const choice of node.choices ?? []) {
        if (choice.when && !state.check(choice.when)) continue;
        options.push({ label: choice.text, run: () => this.pick(choice) });
      }
    }
    const hasChoices = options.length > 0;

    if (isLast) {
      const links = typeof node.links === "string" ? LINK_SETS[node.links] ?? [] : node.links ?? [];
      for (const link of links) options.push({ label: link.label, run: () => openUrl(link.url) });
    }

    s.options = options;
    s.hasChoices = hasChoices;

    this.box.show({
      title: node.speaker ?? s.data.speaker,
      text: pageText(node.pages[s.page]),
      options: options.map((o) => o.label),
      action: hasChoices ? null : isLast && !node.next ? "Close" : "Continue",
      speaker: s.speaker,
      avoid: this.player,
    });
  }

  private pick(choice: DialogueChoice): void {
    runEffects(this.scene, choice.effects);
    this.sfx(SFX.dialogAdvance);

    if (choice.next) this.enterNode(choice.next);
    else this.close();
  }
}
