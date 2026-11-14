import type { InteractableLink } from "../data/links";

export interface IInteractable {
  readonly title: string;
  readonly dialogs: string[];

  /** Optional clickable links shown under the dialog text. */
  readonly links?: InteractableLink[];
  
  progression?: {
    runs: number;          // full read-throughs before switching to endDialogs
    endDialogs: string[];
  };

  setNearby(nearby: boolean): void;
}