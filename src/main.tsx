import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { isEditorAuthorized } from './editor/access';
import { LayoutEditor } from './editor/LayoutEditor';

// F11.1.1–F11.1.4: редактор открыт только по `?editor=1&token=<TOKEN>`. Если
// токен отсутствует или неправильный, пользователь видит обычное приложение —
// никаких UI-подсказок о существовании редактора.
const editorOn = isEditorAuthorized(
  window.location.search,
  import.meta.env.VITE_LAYOUT_EDITOR_TOKEN,
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>{editorOn ? <LayoutEditor /> : <App />}</StrictMode>,
);
