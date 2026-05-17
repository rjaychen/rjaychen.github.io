const STORAGE_KEY = 'portfolio-accent-color';
const DEFAULT_ACCENT = '#0071e3';

/** Parse a hex color like #rrggbb into normalized [0..1] RGB. */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}

/** Derive a soft/translucent version of a hex color for borders and glows. */
function hexToSoftRgba(hex: string, alpha = 0.35): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
}

/** Apply a hex accent color to CSS custom properties on :root. */
export function applyAccent(hex: string): void {
  const root = document.documentElement;
  root.style.setProperty('--color-accent', hex);
  root.style.setProperty('--color-accent-soft', hexToSoftRgba(hex, 0.35));
}

export function loadStoredAccent(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function storeAccent(hex: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, hex);
  } catch {
    // ignore
  }
}

export { DEFAULT_ACCENT };
