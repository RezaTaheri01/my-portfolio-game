export interface IInteractable {
  /**
   * Dialogue opened when the player interacts (E / X / tap). The content lives in
   * public/data/dialogues/*.json, never in the object itself.
   */
  readonly dialogueId?: string;

  /**
   * Verb shown in the interaction prompt: "E to Talk", "Tap to Read".
   * Default: "Interact".
   */
  readonly interactLabel?: string;

  /**
   * How far above the object's origin (px) the top of its head / board is.
   * The dialogue bubble floats above this point. Default: 90.
   */
  readonly bubbleOffsetY?: number;

  /**
   * Custom behaviour on interact: pick something up, flip a lever, open a door.
   * Runs before the dialogue (if any), so an object can do both.
   */
  onInteract?(): void;

  setNearby(nearby: boolean): void;
}
