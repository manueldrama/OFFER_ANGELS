import { useEffect } from 'react';

/**
 * Programmatically injects <link rel="preload"> for hero media the instant
 * the URL becomes known (from localStorage cache or Supabase API).
 *
 * On repeat visits the URL is available synchronously from cache,
 * so the preload starts before React even renders the hero section.
 */
export function useHeroPreloader(
  heroImageUrl: string | null | undefined,
  heroVideoUrl: string | null | undefined,
) {
  // Preload hero image. Local fallback (/landing.webp) is already preloaded
  // statically from index.html so duplicate-skip it; any other URL (CMS custom
  // hero) gets a fresh preload as soon as the URL resolves.
  useEffect(() => {
    if (!heroImageUrl) return;
    if (heroImageUrl === '/landing.webp') return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = heroImageUrl;
    // fetchPriority hint — hero is the LCP element, ask the network stack
    // to prioritize it over below-the-fold images and 3rd-party scripts.
    link.setAttribute('fetchpriority', 'high');
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, [heroImageUrl]);

  // Preload hero video
  useEffect(() => {
    if (!heroVideoUrl) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'video';
    link.href = heroVideoUrl;
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, [heroVideoUrl]);
}
