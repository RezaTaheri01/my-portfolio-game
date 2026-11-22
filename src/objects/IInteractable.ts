export interface IInteractable {
  /**
   * Dialogue opened when the player interacts (E / tap). The content lives in
   * public/data/dialogues/*.json, never in the object itself.
   */
  readonly dialogueId?: string;

  /**
   * Custom behaviour on interact: pick something up, flip a lever, open a door.
   * Runs before the dialogue (if any), so an object can do both.
   */
  onInteract?(): void;

  setNearby(nearby: boolean): void;
}
