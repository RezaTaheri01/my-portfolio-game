import Phaser from "phaser";

// Shared "you can interact with me" visuals: a soft ground glow plus a small
// floating firefly indicator. Same look and tween setup as SajjadNPC/BrownBearNPC,
// packaged so new entity kinds don't copy it a third time.

const GLOW_ALPHA_IDLE = 0.08;
const GLOW_ALPHA_NEARBY = 0.28;
const NEARBY_TWEEN_MS = 250;

export interface ProximityFeedbackOptions {
  /** Glow centre, relative to the owner container's origin (feet). */
  glowY: number;
  glowRadius?: number;
  /** Indicator rest height, relative to the owner's origin (feet). */
  indicatorY: number;
  glowColor?: number;
  indicatorGlow?: number;
  indicatorDot?: number;
}

export class ProximityFeedback {
  private readonly glow: Phaser.GameObjects.Arc;
  private readonly indicator: Phaser.GameObjects.Container;
  private nearbyTweens: Phaser.Tweens.Tween[] = [];
  private isNearby = false;

  /** Adds its visuals to `owner`, so they move and die with it. */
  constructor(
    private readonly scene: Phaser.Scene,
    owner: Phaser.GameObjects.Container,
    options: ProximityFeedbackOptions
  ) {
    const { glowY, glowRadius = 38, indicatorY } = options;

    this.glow = scene.add.arc(
      0, glowY, glowRadius, 0, 360, false, options.glowColor ?? 0xffb65c, GLOW_ALPHA_IDLE
    );

    this.indicator = scene.add.container(0, indicatorY, [
      scene.add.arc(0, 0, 13, 0, 360, false, options.indicatorGlow ?? 0xffc66d, 0.18),
      scene.add.arc(0, 0, 4, 0, 360, false, options.indicatorDot ?? 0xffe7a0, 1),
    ]);

    owner.add([this.glow, this.indicator]);

    // Idle tweens each own a property no other tween touches
    // (setNearby animates glow alpha and indicator scale).
    const loop = (targets: object, props: object, duration: number) =>
      scene.tweens.add({ targets, ...props, duration, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });

    loop(this.indicator, { y: indicatorY - 8 }, 1300);
    loop(this.indicator, { alpha: 0.55 }, 850);
    loop(this.glow, { scaleX: 1.3, scaleY: 0.85 }, 1700);
  }

  setNearby(nearby: boolean): void {
    if (this.isNearby === nearby) return;
    this.isNearby = nearby;

    // Stop in-flight tweens so rapid toggling can't stack them.
    this.nearbyTweens.forEach((t) => t.stop());

    this.nearbyTweens = [
      this.scene.tweens.add({
        targets: this.glow,
        alpha: nearby ? GLOW_ALPHA_NEARBY : GLOW_ALPHA_IDLE,
        duration: NEARBY_TWEEN_MS,
        ease: "Sine.easeOut",
      }),
      this.scene.tweens.add({
        targets: this.indicator,
        scale: nearby ? 1.3 : 1,
        duration: NEARBY_TWEEN_MS,
        ease: "Back.easeOut",
      }),
    ];
  }

  /** Call before the owner's super.destroy(), while `scene.tweens` is still reachable. */
  destroy(): void {
    this.scene.tweens?.killTweensOf([this.glow, this.indicator]);
    this.nearbyTweens = [];
  }
}
