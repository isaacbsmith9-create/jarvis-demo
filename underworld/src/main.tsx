import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Dev-only handle for automated smoke tests.
if (import.meta.env.DEV) {
  Promise.all([import('./game/world'), import('./game/store'), import('./game/city')]).then(([w, s, c]) => {
    Object.assign(window, { __world: w.world, __game: s.useGame, __layout: c.LAYOUT });
  });
}
