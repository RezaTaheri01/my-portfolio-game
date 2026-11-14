export interface IInteractable {
  readonly title: string;
  readonly dialogs: string[];
  
  progression?: {
    runs: number;          // full read-throughs before switching to endDialogs
    endDialogs: string[];
  };

  setNearby(nearby: boolean): void;
}