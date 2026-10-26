import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Studio } from './studio';
import { LandingPage } from './LandingPage';
import { Avatar } from './renderer/Avatar';
import { useConnection } from './useConnection';
import { motionRigs } from './renderer/characters/motionRigs';
import { installMotionLayer } from './renderer/motion/hook';
import './style.css';

installMotionLayer(motionRigs);
const overlay = location.pathname === '/overlay';
const studio = location.pathname === '/studio';
if (overlay) document.documentElement.classList.add('overlay');
if (!overlay && !studio) document.documentElement.classList.add('landing-mode');
function App() {
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
  return <Studio {...connection} />;
}
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Tavi root element is missing');
createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
