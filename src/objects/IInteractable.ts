
export interface IInteractable {
    readonly x: number;
    readonly y: number;

    readonly title: string;
    readonly message: string;

    setNearby(nearby: boolean): void;
}
