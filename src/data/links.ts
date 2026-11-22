export interface InteractableLink {
  /** Text shown in the dialog. */
  label: string;
  /** https:// link, or mailto: for email. */
  url: string;
}

// Shown on the signpost in the lobby. Edit this list to add, remove or
// reorder links: the first nine also get number-key shortcuts (1-9).
export const PROFILE_LINKS: InteractableLink[] = [
  { label: "GitHub", url: "https://github.com/RezaTaheri01" },
  { label: "LinkedIn", url: "https://www.linkedin.com/in/RezaTaheri01/" },
  { label: "Email", url: "mailto:reza.taheri.pgmr@gmail.com" },
  { label: "Telegram", url: "https://t.me/RezaTaheri001" },
];

// Named link sets that dialogue nodes can reference: `"links": "profile"`.
// Keeping them here means URLs live in one place, not scattered in dialogue JSON.
export const LINK_SETS: Record<string, InteractableLink[]> = {
  profile: PROFILE_LINKS,
};
