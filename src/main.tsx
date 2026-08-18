import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
// Side-effect import: kicks off the bundled-fallback i18n init synchronously
// AND triggers the DB-language fetch in the background (i18nFullyReady is a
// Promise that the rest of the app can subscribe to but we no longer block
// the initial mount on it). Mobile ad traffic now sees the page paint as
// soon as the React/Vendor JS arrives, not after a Supabase round-trip.
// Self-hosted fonts: önceki Google Fonts <link rel="stylesheet"> iki adet
// render-blocking cross-origin request idi (~150-300ms FCP cezası). Aynı
// glif setini bundle'a sokup font-display:swap ile servis ediyoruz; long-cache
// header'ı _worker.ts withAssetCache tarafından zaten 1 yıl/immutable.
import '@fontsource-variable/inter/wght.css';
import '@fontsource/dm-serif-display/400.css';
import '@fontsource/dm-serif-display/400-italic.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
