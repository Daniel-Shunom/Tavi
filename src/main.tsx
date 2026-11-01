import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { LandingPage } from './LandingPage';
import { Avatar } from './renderer/Avatar';
import { useConnection } from './useConnection';
import { motionRigs } from './renderer/characters/motionRigs';
import { installMotionLayer } from './renderer/motion/hook';
import './style.css';
import riveWasm from '@rive-app/webgl2/rive.wasm?url';
import taviArtwork from './renderer/characters/tavi-foundation/tavi-foundation.riv?url';

installMotionLayer(motionRigs);
const overlay = location.pathname === '/overlay';
const studio = location.pathname === '/studio';
const rigLab = location.pathname === '/rig-lab';
const RigLab = React.lazy(() => import('./RigLab').then((module) => ({ default: module.RigLab })));
if (rigLab) document.documentElement.classList.add('rig-lab-mode');
const avatarLab = location.pathname === '/avatar-lab';
const dock = location.pathname === '/dock';
const AvatarLab = React.lazy(() =>
  import('./AvatarLab').then((module) => ({ default: module.AvatarLab })),
);
// Landing visitors never download the studio.
const Studio = React.lazy(() => import('./studio').then((module) => ({ default: module.Studio })));
// The OBS dock: Studio's live controls in a narrow panel (src/studio/Dock.tsx).
const Dock = React.lazy(() => import('./studio/Dock').then((module) => ({ default: module.Dock })));
if (avatarLab) document.documentElement.classList.add('avatar-lab-mode');
if (overlay) document.documentElement.classList.add('overlay');
const landing = !overlay && !studio && !avatarLab && !dock && !rigLab;
const prerenderedLanding = location.pathname === '/';
if (landing) {
  document.documentElement.classList.add('landing-mode');
  // Start Tavi's runtime, renderer and artwork now, alongside the page, not after it mounts
  // (the built page already starts them from its HTML).
  for (const href of [riveWasm, taviArtwork]) {
    if (document.head.querySelector(`link[href="${href}"]`)) continue;
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
  if (rigLab)
    return (
      <React.Suspense fallback={<p>Loading rig...</p>}>
        <RigLab />
      </React.Suspense>
    );
  if (avatarLab)
    return (
      <React.Suspense fallback={<p>Loading avatar experiment…</p>}>
        <AvatarLab />
      </React.Suspense>
    );
  if (overlay) return <OverlayApp />;
  if (studio) return <StudioApp />;
  if (dock) return <DockApp />;
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
function DockApp() {
  const connection = useConnection();
  return (
    <React.Suspense fallback={null}>
      <Dock {...connection} />
    </React.Suspense>
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
const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
// The built page carries the landing pre-rendered (tools/prerender-landing.mjs): hydrate it, or
// clear it for the studio, overlay and avatar lab.
if (prerenderedLanding && rootElement.hasChildNodes()) hydrateRoot(rootElement, app);
else {
  rootElement.replaceChildren();
  createRoot(rootElement).render(app);
}
