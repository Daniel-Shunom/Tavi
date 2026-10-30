import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { LandingPage } from './LandingPage';
import { Avatar } from './renderer/Avatar';
import { useConnection } from './useConnection';
import { motionRigs } from './renderer/characters/motionRigs';
import { installMotionLayer } from './renderer/motion/hook';
import './style.css';
import riveWasm from '@rive-app/webgl2/rive.wasm?url';
import taviArtwork from './renderer/characters/tavi-refined/tavi-refined.riv?url';

installMotionLayer(motionRigs);
const overlay = location.pathname === '/overlay';
const studio = location.pathname === '/studio';
const avatarLab = location.pathname === '/avatar-lab';
const AvatarLab = React.lazy(() =>
  import('./AvatarLab').then((module) => ({ default: module.AvatarLab })),
);
// Landing visitors never download the studio.
const Studio = React.lazy(() => import('./studio').then((module) => ({ default: module.Studio })));
if (avatarLab) document.documentElement.classList.add('avatar-lab-mode');
if (overlay) document.documentElement.classList.add('overlay');
if (!overlay && !studio && !avatarLab) {
  document.documentElement.classList.add('landing-mode');
  // Start Tavi's runtime, renderer and artwork now, alongside the page, not after it mounts.
  for (const href of [riveWasm, taviArtwork]) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'fetch';
    link.crossOrigin = 'anonymous';
    link.href = href;
    document.head.append(link);
  }
  void import('./renderer/rive/riveRenderer');
}
function App() {
  if (avatarLab)
    return (
      <React.Suspense fallback={<p>Loading avatar experiment…</p>}>
        <AvatarLab />
      </React.Suspense>
    );
  if (overlay) return <OverlayApp />;
  if (studio) return <StudioApp />;
  return <LandingPage />;
}
function OverlayApp() {
  const connection = useConnection();
  return (
    <main className="overlay-surface">
      <Avatar state={connection.state} serverNow={connection.serverNow} />
    </main>
  );
}
function StudioApp() {
  const connection = useConnection();
  return (
    <React.Suspense fallback={null}>
      <Studio {...connection} />
    </React.Suspense>
  );
}
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Tavi root element is missing');
createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
