import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { isEditorAuthorized } from './editor/access';
import { LayoutEditor } from './editor/LayoutEditor';

// F11.1.1–F11.1.4: gate the editor behind `?editor=1&token=<TOKEN>`. When the
// token is missing or wrong, the user sees the regular app — no UI hint that
// the editor exists.
const editorOn = isEditorAuthorized(
  window.location.search,
  import.meta.env.VITE_LAYOUT_EDITOR_TOKEN,
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>{editorOn ? <LayoutEditor /> : <App />}</StrictMode>,
);
