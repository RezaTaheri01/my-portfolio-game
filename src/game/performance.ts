// ============================================================
// Performance profile: the lighter "low" settings switch on by
// themselves on phones and tablets. Desktops keep full quality.
//
// Test on desktop with  ?quality=low  or  ?quality=high  in the URL.
// ============================================================

export interface QualityProfile {
  name: "low" | "high";
  /** True on phones / tablets (or when forced with ?quality=low). */
  mobile: boolean;
  /** Dynamic Light2D lights (campfire + player). Costly on weak GPUs. */
  dynamicLights: boolean;
  /** Size of the additive campfire glow sprite (it covers much of a phone screen). */
  campfireGlowScale: number;
  /** ms between firefly particles (alive count is roughly lifespan / this). */
  fireflyEveryMs: number;
  /** ms between campfire ember particles. */
  emberEveryMs: number;
}

/** Phones and tablets only: touch-screen laptops stay on "high". */
function detectMobile(): boolean {
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile|Silk/i.test(ua)) return true;
  // iPadOS reports itself as a Mac, but has touch points.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

const forced = new URLSearchParams(window.location.search).get("quality");
const mobile = forced === "low" ? true : forced === "high" ? false : detectMobile();

const HIGH: QualityProfile = {
  name: "high", mobile,
  dynamicLights: true,
  campfireGlowScale: 3.5,
  fireflyEveryMs: 100,
  emberEveryMs: 100,
};

const LOW: QualityProfile = {
  name: "low", mobile,
  dynamicLights: false,
  campfireGlowScale: 2.2,
  fireflyEveryMs: 320,
  emberEveryMs: 220,
};

export const QUALITY: QualityProfile = mobile ? LOW : HIGH;
