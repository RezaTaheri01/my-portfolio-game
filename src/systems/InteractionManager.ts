import Phaser from "phaser";

import type { Player } from "../objects/Player";
import { GAME_FONT, UI_COLORS as COLORS } from "../game/theme";
import type { IInteractable } from "../objects/IInteractable";
import { SFX } from "../data/audio";
import { AudioManager } from "./AudioManager";
import { InputHints, PAD_BUTTONS } from "./InputHints";
import type { DialogueManager } from "./DialogueManager";

// Anything interactable also needs a world position to measure distance from.
type Interactable = IInteractable & Phaser.GameObjects.Components.Transform;

const INTERACTION_DISTANCE = 100;
const UI_DEPTH = 1000;

/**
 * Finds what the player can interact with and routes input (E / X / tap /
 * ESC / number keys) to the DialogueManager while a dialogue is open.
 * Interact has its own buttons (E, pad X, tapping the prompt); SPACE and pad A
 * only ever jump.
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

  // Interact: E on keyboard, X on a gamepad, tap on touch. Jump is separate.
  // Presses are queued by events and consumed once per frame in update().
  private interactQueued = false;
  private closeQueued = false;
  private unsubscribeHints?: () => void;
  private readonly escapeKey: Phaser.Input.Keyboard.Key;
  private readonly numberKeys: Phaser.Input.Keyboard.Key[];

  private readonly prompt: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, player: Player, dialogue: DialogueManager) {
    this.scene = scene;
    this.player = player;
    this.dialogue = dialogue;

    const keyboard = scene.input.keyboard!;
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
      .setText("")
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(UI_DEPTH)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });

    // Clicking / tapping the prompt acts as pressing the interact key.
    this.prompt.on(Phaser.Input.Events.POINTER_DOWN, this.onPromptTap, this);

    // Prompt text follows the active device (keyboard / controller).
    this.refreshPromptText();
    this.unsubscribeHints = InputHints.get(scene).onChange(() => this.refreshPromptText());

    keyboard.on("keydown-E", this.onInteractKey);
    scene.input.gamepad?.on(Phaser.Input.Gamepad.Events.BUTTON_DOWN, this.onPadButton);

    this.layout();

    scene.scale.on("resize", this.layout, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  // ========================================
  // PUBLIC API
  // ========================================

  /**
   * True while an interaction is running (dialogue open). The scene passes
   * this to Player.update() to lock walking and jumping.
   */
  public get isInteracting(): boolean {
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
    const interactPressed = this.interactQueued;
    const closePressed = this.closeQueued;
    this.interactQueued = false;
    this.closeQueued = false;

    // Input is read here, once per frame, whoever opened the dialogue.
    if (this.dialogue.isOpen) {
      if (Phaser.Input.Keyboard.JustDown(this.escapeKey) || closePressed) {
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
    this.unsubscribeHints?.();
    this.scene.input.keyboard?.off("keydown-E", this.onInteractKey);
    this.scene.input.gamepad?.off(Phaser.Input.Gamepad.Events.BUTTON_DOWN, this.onPadButton);
    this.scene.scale.off("resize", this.layout, this);
    this.prompt.destroy();
  }

  // ========================================
  // INTERACTION
  // ========================================

  private onInteractKey = (event: KeyboardEvent): void => {
    if (!event.repeat) this.interactQueued = true;
  };

  private onPadButton = (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button): void => {
    if (button.index === PAD_BUTTONS.interact) this.interactQueued = true; // X / Square
    if (button.index === PAD_BUTTONS.exit) this.closeQueued = true; // B / Circle
  };

  /** "E to Talk", "X/SQ to Read", "Tap to Open": the key follows the active device, the verb the object. */
  private refreshPromptText(): void {
    const key = InputHints.get(this.scene).labels.interact;
    const verb = this.nearbyObject?.interactLabel ?? "Interact";
    this.prompt.setText(`${key} to ${verb}`);
  }

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

    const started = this.dialogue.start(object.dialogueId, {
      speaker: object, // the bubble floats above this object
      onEnd: () => {
        this.activeObject = null;
        this.refreshNearby();
      },
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
    if (closest !== previous) this.refreshPromptText();

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