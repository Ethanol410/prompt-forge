import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Root } from './Root.js';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Élément racine #root introuvable.');

createRoot(rootElement).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
