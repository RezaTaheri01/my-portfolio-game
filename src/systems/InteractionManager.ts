import Phaser from "phaser";

import type { Player } from "../objects/Player";
import { GAME_FONT, UI_COLORS as COLORS } from "../game/theme";
import type { IInteractable } from "../objects/IInteractable";
import { SFX } from "../data/audio";
import { AudioManager } from "./AudioManager";
import type { DialogueManager } from "./DialogueManager";

// Anything interactable also needs a world position to measure distance from.
type Interactable = IInteractable & Phaser.GameObjects.Components.Transform;

const INTERACTION_DISTANCE = 100;
const UI_DEPTH = 1000;

/**
 * Finds what the player can interact with and routes input (E / tap / ESC /
 * number keys) to the DialogueManager while a dialogue is open.
 * Dialogue content and rendering live in DialogueManager / DialogueBox.
 */
export class InteractionManager {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly dialogue: DialogueManager;

  private readonly interactables: Interactable[] = [];
  private nearbyObject: Interactable | null = null;
  // The object whose dialogue is open (so removing it can close the dialogue).
  private activeObject: Interactable | null = null;

  private readonly isTouch: boolean;

  private readonly interactKey: Phaser.Input.Keyboard.Key;
  private readonly escapeKey: Phaser.Input.Keyboard.Key;
  private readonly numberKeys: Phaser.Input.Keyboard.Key[];

  private readonly prompt: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, player: Player, dialogue: DialogueManager) {
    this.scene = scene;
    this.player = player;
    this.dialogue = dialogue;
    this.isTouch = scene.sys.game.device.input.touch;

    const keyboard = scene.input.keyboard!;
    this.interactKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    // 1-9 pick the matching option (link or choice) while a dialogue is showing.
    const { ONE, TWO, THREE, FOUR, FIVE, SIX, SEVEN, EIGHT, NINE } =
      Phaser.Input.Keyboard.KeyCodes;
    this.numberKeys = [ONE, TWO, THREE, FOUR, FIVE, SIX, SEVEN, EIGHT, NINE].map(
      (code) => keyboard.addKey(code)
    );

    // Prompt shown near an interactable
    this.prompt = scene.add
      .text(0, 0, "", {
        fontFamily: GAME_FONT,
        fontSize: "18px",
        color: COLORS.cream,
        backgroundColor: COLORS.forestCss,
        padding: { x: 14, y: 9 },
      })
      .setText(this.isTouch ? "Tap  —  Interact" : "E  —  Interact")
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(UI_DEPTH)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });

    // Clicking / tapping the prompt acts as pressing E.
    this.prompt.on(Phaser.Input.Events.POINTER_DOWN, this.onPromptTap, this);

    this.layout();

    scene.scale.on("resize", this.layout, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  // ========================================
  // PUBLIC API
  // ========================================

  /** True while a dialogue is showing (handy for locking player movement). */
  public get isDialogOpen(): boolean {
    return this.dialogue.isOpen;
  }

  public add(interactable: Interactable): void {
    this.interactables.push(interactable);
  }

  public remove(interactable: Interactable): void {
    const index = this.interactables.indexOf(interactable);
    if (index === -1) return;

    this.interactables.splice(index, 1);
    interactable.setNearby(false);

    if (this.nearbyObject === interactable) this.nearbyObject = null;
    if (this.activeObject === interactable) this.dialogue.close();
  }

  public update(): void {
    const interactPressed = Phaser.Input.Keyboard.JustDown(this.interactKey);

    // Input is read here, once per frame, whoever opened the dialogue.
    if (this.dialogue.isOpen) {
      if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
        this.dialogue.close();
      } else if (interactPressed) {
        this.dialogue.advance();
      } else {
        this.numberKeys.forEach((key, i) => {
          if (Phaser.Input.Keyboard.JustDown(key)) this.dialogue.choose(i);
        });
      }
      return;
    }

    this.refreshNearby();

    if (this.nearbyObject && interactPressed) {
      this.interact(this.nearbyObject);
    }
  }

  public destroy(): void {
    this.scene.scale.off("resize", this.layout, this);
    this.prompt.destroy();
  }

  // ========================================
  // INTERACTION
  // ========================================

  private onPromptTap(): void {
    if (this.nearbyObject && !this.dialogue.isOpen) {
      this.interact(this.nearbyObject);
    }
  }

  private interact(object: Interactable): void {
    this.prompt.setVisible(false);
    object.onInteract?.();

    this.activeObject = null;
    if (!object.dialogueId) return;

    const started = this.dialogue.start(object.dialogueId, () => {
      this.activeObject = null;
      this.refreshNearby();
    });
    if (started) this.activeObject = object;
  }

  // ========================================
  // NEARBY DETECTION
  // ========================================

  private refreshNearby(): void {
    const previous = this.nearbyObject;
    let closest: Interactable | null = null;
    let closestDistance = INTERACTION_DISTANCE;

    for (const object of this.interactables) {
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        object.x,
        object.y
      );

      if (distance < closestDistance) {
        closest = object;
        closestDistance = distance;
      }
    }

    for (const object of this.interactables) {
      object.setNearby(object === closest);
    }

    this.nearbyObject = closest;
    this.prompt.setVisible(closest !== null);

    // Soft cue when something new comes into range.
    if (closest && closest !== previous) {
      AudioManager.get(this.scene).playSfx(SFX.near, { volume: 0.5, cooldownMs: 120 });
    }
  }

  // ========================================
  // LAYOUT
  // ========================================

  private layout(): void {
    const { width, height } = this.scene.scale;
    this.prompt.setPosition(width / 2, height - 30);
  }
}
