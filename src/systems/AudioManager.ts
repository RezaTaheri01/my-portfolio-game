import Phaser from "phaser";

// ============================================================
// AudioManager
// ------------------------------------------------------------
// One per Phaser.Game (AudioManager.get(scene)), so music keeps
// playing across scene changes and volume settings are shared.
//
// - Music:  one track at a time, with fade-in and crossfade.
// - SFX:    fire-and-forget one-shots with optional pitch variation
//           and a cooldown so rapid triggers don't machine-gun.
// - Volume: master / music / sfx channels + mute, persisted.
// - Assets: cached by Phaser; loaded via the manifest (AssetLoader).
//
// Built on Phaser's own sound system on purpose: it already does
// WebAudio, caching and the browser autoplay-unlock. A library like
// Howler would add a dependency without adding anything we need.
// ============================================================

export type AudioChannel = "master" | "music" | "sfx";

type AnySound =
  | Phaser.Sound.NoAudioSound
  | Phaser.Sound.HTML5AudioSound
  | Phaser.Sound.WebAudioSound;

export interface MusicOptions {
  /** Track volume before channel volumes are applied (0-1). Default 1. */
  volume?: number;
  loop?: boolean;
  /** ms. Default 1500. */
  fadeIn?: number;
  /** ms used to fade out the track being replaced. Default 1200. */
  fadeOut?: number;
}

export interface SceneMusic extends MusicOptions {
  key: string;
}

export interface SfxOptions {
  volume?: number;
  rate?: number;
  detune?: number;
  /** Random +/- cents added to detune, for variation. */
  pitchJitter?: number;
  /** Ignore repeats of the same key within this many ms. */
  cooldownMs?: number;
}

interface Track {
  key: string;
  sound: AnySound;
  base: number;
  /** 0-1 fade multiplier, driven by tick(). */
  fade: number;
}

interface Fade {
  track: Track;
  from: number;
  to: number;
  elapsed: number;
  duration: number;
  onDone?: () => void;
}

const STORAGE_KEY = "rezaworld.audio";
const DEFAULT_VOLUMES: Record<AudioChannel, number> = { master: 1, music: 0.2, sfx: 0.7 };

export class AudioManager {
  private static readonly instances = new WeakMap<Phaser.Game, AudioManager>();

  static get(scene: Phaser.Scene): AudioManager {
    const game = scene.sys.game;
    let manager = AudioManager.instances.get(game);
    if (!manager) {
      manager = new AudioManager(game);
      AudioManager.instances.set(game, manager);
    }
    return manager;
  }

  private readonly volumes: Record<AudioChannel, number> = { ...DEFAULT_VOLUMES };
  private muted = false;

  private current: Track | null = null;
  private fades: Fade[] = [];
  private readonly lastPlayed = new Map<string, number>();
  private readonly warned = new Set<string>();

  private constructor(private readonly game: Phaser.Game) {
    this.loadSettings();
    this.game.sound.mute = this.muted;

    // Fades are driven by the game loop (not a scene's tweens), so a crossfade
    // keeps running while one scene shuts down and another starts.
    this.game.events.on(Phaser.Core.Events.POST_STEP, this.tick, this);
    this.game.events.once(Phaser.Core.Events.DESTROY, () =>
      this.game.events.off(Phaser.Core.Events.POST_STEP, this.tick, this)
    );
  }

  // ========================================
  // MUSIC
  // ========================================

  /** Start (or crossfade to) a looping track. No-op if it is already playing. */
  playMusic(key: string, options: MusicOptions = {}): void {
    if (!this.hasAudio(key)) return;
    if (this.current?.key === key) return;

    const { volume = 1, loop = true, fadeIn = 1500, fadeOut = 1200 } = options;

    this.retire(this.current, fadeOut);

    const sound = this.game.sound.add(key, { loop, volume: 0 }) as AnySound;
    const track: Track = { key, sound, base: volume, fade: fadeIn > 0 ? 0 : 1 };
    this.current = track;
    this.apply(track);

    const start = (): void => {
      if (this.current !== track) return; // replaced while waiting to unlock
      sound.play();
      this.fadeTo(track, 1, fadeIn);
    };

    // Browsers block audio until the first click/key press. Phaser unlocks on
    // that gesture; we start the fade only then, so it isn't wasted while silent.
    if (this.isLocked) this.game.sound.once(Phaser.Sound.Events.UNLOCKED, start);
    else start();
  }

  /** Fade out and stop the current track. `onlyKey` guards against stopping a newer track. */
  stopMusic(options: { fadeOut?: number; onlyKey?: string } = {}): void {
    const { fadeOut = 1000, onlyKey } = options;
    if (!this.current || (onlyKey && this.current.key !== onlyKey)) return;

    this.retire(this.current, fadeOut);
    this.current = null;
  }

  /**
   * Scene helper: play this scene's music now and fade it out when the scene
   * shuts down (unless another scene has already replaced it).
   */
  attachMusic(scene: Phaser.Scene, music: SceneMusic): void {
    this.playMusic(music.key, music);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.stopMusic({ fadeOut: music.fadeOut ?? 800, onlyKey: music.key })
    );
  }

  // ========================================
  // SFX
  // ========================================

  /** Play a one-shot. Pass an array of keys to pick a random variation. */
  playSfx(key: string | readonly string[], options: SfxOptions = {}): void {
    const chosen = typeof key === "string" ? key : Phaser.Utils.Array.GetRandom([...key]);
    if (!this.hasAudio(chosen)) return;

    if (options.cooldownMs) {
      const now = performance.now();
      if (now - (this.lastPlayed.get(chosen) ?? -Infinity) < options.cooldownMs) return;
      this.lastPlayed.set(chosen, now);
    }

    const jitter = options.pitchJitter
      ? Phaser.Math.Between(-options.pitchJitter, options.pitchJitter)
      : 0;

    this.game.sound.play(chosen, {
      volume: (options.volume ?? 1) * this.volumes.sfx * this.volumes.master,
      rate: options.rate,
      detune: (options.detune ?? 0) + jitter,
    });
  }

  // ========================================
  // VOLUME / MUTE
  // ========================================

  getVolume(channel: AudioChannel): number {
    return this.volumes[channel];
  }

  /** 0-1. Music updates live; SFX/master apply to sounds played afterwards. */
  setVolume(channel: AudioChannel, value: number): void {
    this.volumes[channel] = Phaser.Math.Clamp(value, 0, 1);
    if (this.current) this.apply(this.current);
    this.saveSettings();
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.game.sound.mute = muted;
    this.saveSettings();
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Scene helper: press a key (default M) to toggle mute. Cleans itself up. */
  bindMuteKey(scene: Phaser.Scene, key = "M"): void {
    const keyboard = scene.input.keyboard;
    if (!keyboard) return;

    const event = `keydown-${key}`;
    const handler = (): void => void this.toggleMute();

    keyboard.on(event, handler);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.off(event, handler));
  }

  // ========================================
  // INTERNALS
  // ========================================

  private get isLocked(): boolean {
    return (this.game.sound as unknown as { locked?: boolean }).locked === true;
  }

  /** Missing audio is reported once and then ignored, so a typo can't crash the scene. */
  private hasAudio(key: string): boolean {
    if (this.game.cache.audio.exists(key)) return true;

    if (!this.warned.has(key)) {
      this.warned.add(key);
      console.warn(`[AudioManager] "${key}" is not loaded. Is it in data/assets.ts and in this scene's bundles?`);
    }
    return false;
  }

  private apply(track: Track): void {
    track.sound.volume = track.base * track.fade * this.volumes.music * this.volumes.master;
  }

  private fadeTo(track: Track, to: number, duration: number, onDone?: () => void): void {
    this.fades = this.fades.filter((f) => f.track !== track);

    if (duration <= 0) {
      track.fade = to;
      this.apply(track);
      onDone?.();
      return;
    }
    this.fades.push({ track, from: track.fade, to, elapsed: 0, duration, onDone });
  }

  private retire(track: Track | null, fadeOut: number): void {
    if (!track) return;

    this.fadeTo(track, 0, fadeOut, () => {
      track.sound.stop();
      track.sound.destroy();
    });
  }

  private tick(_time: number, delta: number): void {
    if (this.fades.length === 0) return;

    const finished: Fade[] = [];

    for (const fade of this.fades) {
      fade.elapsed += delta;
      const t = Math.min(1, fade.elapsed / fade.duration);
      fade.track.fade = fade.from + (fade.to - fade.from) * t;
      this.apply(fade.track);
      if (t >= 1) finished.push(fade);
    }

    if (finished.length) {
      this.fades = this.fades.filter((f) => !finished.includes(f));
      finished.forEach((f) => f.onDone?.());
    }
  }

  private loadSettings(): void {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const saved = JSON.parse(raw) as Partial<Record<AudioChannel, number>> & { muted?: boolean };
      for (const channel of ["master", "music", "sfx"] as const) {
        const v = saved[channel];
        if (typeof v === "number") this.volumes[channel] = Phaser.Math.Clamp(v, 0, 1);
      }
      this.muted = saved.muted === true;
    } catch {
      /* storage unavailable or corrupt: keep defaults */
    }
  }

  private saveSettings(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...this.volumes, muted: this.muted }));
    } catch {
      /* private mode etc.: settings just won't persist */
    }
  }
}
