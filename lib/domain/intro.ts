export const INTRO_STORAGE_KEY = "instamusic-code.intro";
export const INTRO_SEEN = "seen";

export function hasSeenIntro(value: string | null | undefined): boolean {
  return value === INTRO_SEEN;
}

export function readIntro(): string | null {
  try {
    return localStorage.getItem(INTRO_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeIntroSeen(): void {
  try {
    localStorage.setItem(INTRO_STORAGE_KEY, INTRO_SEEN);
  } catch {
    // Private mode or a full quota must still let the person use search.
  }
}
