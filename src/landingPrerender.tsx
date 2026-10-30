import { renderToString } from 'react-dom/server';
import { LandingPage } from './LandingPage';

// The landing page, rendered at build time (tools/prerender-landing.mjs) into index.html, so the
// TV, the table and every section paint with the HTML, before any script has run. The browser
// then hydrates it (src/main.tsx) and Tavi arrives as soon as her runtime has loaded.
export const render = () => renderToString(<LandingPage />);
