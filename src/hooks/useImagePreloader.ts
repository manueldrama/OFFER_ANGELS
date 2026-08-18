import { useState, useEffect, useRef } from 'react';

const TIMEOUT_MS = 3000;

/**
 * Preloads a list of image URLs and returns ready status.
 * Resolves when all images are loaded or after timeout (whichever comes first).
 */
export function useImagePreloader(urls: string[]): boolean {
  const [ready, setReady] = useState(urls.length === 0);
  const prevUrlsRef = useRef<string>('');

  useEffect(() => {
    const key = urls.join(',');
    if (key === prevUrlsRef.current) return;
    prevUrlsRef.current = key;

    if (urls.length === 0) {
      setReady(true);
      return;
    }

    setReady(false);
    let settled = false;

    const settle = () => {
      if (!settled) {
        settled = true;
        setReady(true);
      }
    };

    // Timeout fallback — never block longer than TIMEOUT_MS
    const timer = setTimeout(settle, TIMEOUT_MS);

    let loaded = 0;
    const total = urls.length;

    urls.forEach((url) => {
      const img = new Image();
      const done = () => {
        loaded++;
        if (loaded >= total) settle();
      };
      img.onload = done;
      img.onerror = done; // Don't block on broken images
      img.src = url;
    });

    return () => {
      settled = true;
      clearTimeout(timer);
    };
  }, [urls]);

  return ready;
}
