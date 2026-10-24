// Wiener Farm animation preloader.
// These are the existing animated WebP assets used across the app.
// Preloading them once at startup prevents the first-render loading delay
// when switching between Home, Earn, Stars and other screens.

export const WIENER_ANIMATIONS = [
  '/api/host/DTBrE-73Ag',
  '/api/host/YZEVHOSCqA',
  '/api/host/dfzvtrmcvA',
  '/api/host/ztSi1qACtw',
  '/api/host/H6gKj6gN2A',
  '/api/host/95rEFUqyrQ',
  '/api/host/XKKUtWdxLQ',
] as const;

let started = false;

export function preloadWienerAnimations() {
  if (started || typeof window === 'undefined') return;
  started = true;

  for (const src of WIENER_ANIMATIONS) {
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = src;
  }
}
