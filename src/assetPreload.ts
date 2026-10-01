// Wiener Farm animation preloader.
// These are the existing animated WebP assets used across the app.
// Preloading them once at startup prevents the first-render loading delay
// when switching between Home, Earn, Stars and other screens.

export const WIENER_ANIMATIONS = [
  'https://pixlinkhost.vercel.app/i/DTBrE-73Ag',
  'https://pixlinkhost.vercel.app/i/YZEVHOSCqA',
  'https://pixlinkhost.vercel.app/i/dfzvtrmcvA',
  'https://pixlinkhost.vercel.app/i/ztSi1qACtw',
  'https://pixlinkhost.vercel.app/i/H6gKj6gN2A',
  'https://pixlinkhost.vercel.app/i/95rEFUqyrQ',
  'https://pixlinkhost.vercel.app/i/XKKUtWdxLQ',
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
