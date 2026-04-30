import { useReducer } from 'react';
import { PALETTE } from '../theme/palette';
import { editorReducer, initialEditorState } from './state';
import { EditorCanvas } from './EditorCanvas';
import { EditorSidebar } from './EditorSidebar';

const EDITOR_BG = PALETTE.walls.paint;

/**
 * Редактор планировок (F11.x).
 *
 * v1.6.0 саб-спринт 1.6.b: появились инструменты рисования (Room / Panel / Window / Door).
 * Валидация в реальном времени + JSON-экспорт → 1.6.c.
 *
 * F11.2.6: всё состояние живёт в `useReducer` этого компонента. Никакой
 * персистентности, никаких мутаций projectStore — закрытие вкладки сбрасывает всё.
 */
export function LayoutEditor() {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState());

  return (
    <div
      data-testid="layout-editor"
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: EDITOR_BG,
        color: PALETTE.text.primary,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <EditorSidebar state={state} dispatch={dispatch} />
      <main
        style={{
          flex: 1,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 12,
          overflow: 'auto',
        }}
      >
        <header>
          <h1 style={{ margin: 0, fontSize: 18 }}>Редактор планировок</h1>
          <p style={{ margin: '4px 0 0', color: PALETTE.text.secondary, fontSize: 13 }}>
            Размер сетки {state.gridWidth}×{state.gridHeight} тайлов. Комнаты — прямоугольником,
            окна и двери — двумя кликами вдоль грани.
          </p>
        </header>
        <EditorCanvas state={state} dispatch={dispatch} />
      </main>
    </div>
  );
}
