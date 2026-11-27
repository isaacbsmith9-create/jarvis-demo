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
  import('./game/world').then(({ world }) => {
    (window as unknown as { __world: unknown }).__world = world;
  });
}
