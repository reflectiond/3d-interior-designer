import { PALETTE } from '../theme/palette';

const EDITOR_BG = PALETTE.walls.paint;

/**
 * Layout editor (F11.x).
 *
 * Skeleton shell for v1.6.0 sub-sprint 1.6.a — gating only. Drawing tools,
 * real-time validation, and JSON export land in 1.6.b / 1.6.c.
 *
 * F11.2.6: this component MUST NOT read or write the main app's localStorage
 * keys. It uses its own isolated state.
 */
export function LayoutEditor() {
  return (
    <div
      data-testid="layout-editor"
      style={{
        minHeight: '100vh',
        padding: 24,
        background: EDITOR_BG,
        color: PALETTE.text.primary,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Редактор планировок</h1>
        <p style={{ margin: '4px 0 0', color: PALETTE.text.secondary, fontSize: 14 }}>
          Инструменты появятся в следующих под-спринтах v1.6.0.
        </p>
      </header>
      <main
        data-testid="layout-editor-canvas-placeholder"
        style={{
          minHeight: 400,
          border: `1px dashed ${PALETTE.text.secondary}`,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: PALETTE.text.secondary,
        }}
      >
        canvas placeholder
      </main>
    </div>
  );
}
