import React from 'react';
import { PALETTE } from '../theme/palette';
import type { EditorAction, EditorState, EditorTool } from './state';
import type { RoomType } from '../domain/geometry/types';
import { validateEditor, type EditorIssue } from './validation';
import { downloadJsonFile, exportLayout } from './exportLayout';

const TOOL_LABELS: Record<EditorTool, string> = {
  select: 'Выбор',
  room: 'Комната',
  panel: 'Электрощиток',
  window: 'Окно',
  door: 'Дверь',
};

const ROOM_TYPES: { value: RoomType; label: string }[] = [
  { value: 'bedroom', label: 'Спальня' },
  { value: 'bathroom', label: 'Ванная' },
  { value: 'kitchen', label: 'Кухня' },
  { value: 'boiler', label: 'Котельная' },
  { value: 'living', label: 'Гостиная' },
  { value: 'corridor', label: 'Коридор' },
  { value: 'wardrobe', label: 'Гардероб' },
];

interface EditorSidebarProps {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

const sectionStyle: React.CSSProperties = {
  marginBottom: 16,
  paddingBottom: 12,
  borderBottom: `1px solid ${PALETTE.editor.grid}`,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: PALETTE.text.secondary,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  border: `1px solid ${PALETTE.editor.grid}`,
  borderRadius: 4,
  fontSize: 13,
  boxSizing: 'border-box',
};

const buttonRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 6,
};

function toolButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 10px',
    border: `1px solid ${active ? PALETTE.editor.selection : PALETTE.editor.grid}`,
    background: active ? PALETTE.editor.selection : PALETTE.walls.paint,
    color: active ? PALETTE.walls.paint : PALETTE.text.primary,
    borderRadius: 4,
    fontSize: 13,
    cursor: 'pointer',
  };
}

const dangerButtonStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: `1px solid ${PALETTE.placement_highlight.invalid}`,
  background: PALETTE.walls.paint,
  color: PALETTE.placement_highlight.invalid,
  borderRadius: 4,
  fontSize: 13,
  cursor: 'pointer',
};

export function EditorSidebar({ state, dispatch }: EditorSidebarProps) {
  return (
    <aside
      data-testid="layout-editor-sidebar"
      style={{
        width: 280,
        padding: 16,
        background: PALETTE.walls.paint,
        borderRight: `1px solid ${PALETTE.editor.grid}`,
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      <section style={sectionStyle}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Метаданные</h3>
        <label style={labelStyle}>ID</label>
        <input
          type="number"
          value={state.layoutId}
          onChange={(e) =>
            dispatch({ type: 'set_meta', id: Number.parseInt(e.target.value, 10) || 0 })
          }
          style={inputStyle}
        />
        <label style={{ ...labelStyle, marginTop: 8 }}>Название</label>
        <input
          type="text"
          value={state.layoutName}
          onChange={(e) => dispatch({ type: 'set_meta', name: e.target.value })}
          style={inputStyle}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
          <div>
            <label style={labelStyle}>Ширина</label>
            <input
              type="number"
              value={state.gridWidth}
              onChange={(e) =>
                dispatch({
                  type: 'set_grid_size',
                  width: Number.parseInt(e.target.value, 10) || 8,
                  height: state.gridHeight,
                })
              }
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Высота</label>
            <input
              type="number"
              value={state.gridHeight}
              onChange={(e) =>
                dispatch({
                  type: 'set_grid_size',
                  width: state.gridWidth,
                  height: Number.parseInt(e.target.value, 10) || 8,
                })
              }
              style={inputStyle}
            />
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Инструмент</h3>
        <div style={buttonRowStyle}>
          {(Object.keys(TOOL_LABELS) as EditorTool[]).map((tool) => (
            <button
              key={tool}
              type="button"
              data-testid={`tool-${tool}`}
              onClick={() => dispatch({ type: 'set_tool', tool })}
              style={toolButtonStyle(state.tool === tool)}
            >
              {TOOL_LABELS[tool]}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: PALETTE.text.secondary, margin: '8px 0 0' }}>
          Shift+клик удаляет объект под курсором.
        </p>
      </section>

      <section style={sectionStyle} data-testid="properties-panel">
        <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Свойства</h3>
        <SelectionEditor state={state} dispatch={dispatch} />
      </section>

      <ValidationAndExport state={state} dispatch={dispatch} />

      <section>
        <button type="button" onClick={() => dispatch({ type: 'reset' })} style={dangerButtonStyle}>
          Сбросить редактор
        </button>
      </section>
    </aside>
  );
}

function ValidationAndExport({ state, dispatch }: EditorSidebarProps) {
  const issues = validateEditor(state);
  const valid = issues.length === 0;

  function handleExport() {
    const result = exportLayout(state);
    if (result.ok) {
      downloadJsonFile(result.json, result.filename);
    }
  }

  return (
    <section style={sectionStyle} data-testid="validation-panel">
      <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>
        Валидация
        {valid ? (
          <span
            data-testid="validation-status"
            style={{ marginLeft: 6, color: PALETTE.placement_highlight.valid, fontSize: 12 }}
          >
            ✓ всё ок
          </span>
        ) : (
          <span
            data-testid="validation-status"
            style={{ marginLeft: 6, color: PALETTE.placement_highlight.invalid, fontSize: 12 }}
          >
            {issues.length} {issues.length === 1 ? 'ошибка' : 'ошибок'}
          </span>
        )}
      </h3>
      {!valid && (
        <ul
          data-testid="validation-issues"
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            fontSize: 12,
            color: PALETTE.text.primary,
            maxHeight: 140,
            overflowY: 'auto',
          }}
        >
          {issues.map((issue) => (
            <IssueRow key={issue.id} issue={issue} dispatch={dispatch} />
          ))}
        </ul>
      )}
      <button
        type="button"
        data-testid="export-json"
        disabled={!valid}
        onClick={handleExport}
        style={{
          marginTop: 12,
          width: '100%',
          padding: '8px 10px',
          border: `1px solid ${valid ? PALETTE.editor.selection : PALETTE.editor.grid}`,
          background: valid ? PALETTE.editor.selection : PALETTE.editor.grid,
          color: PALETTE.walls.paint,
          borderRadius: 4,
          fontSize: 13,
          cursor: valid ? 'pointer' : 'not-allowed',
        }}
      >
        Экспорт JSON
      </button>
    </section>
  );
}

function IssueRow({
  issue,
  dispatch,
}: {
  issue: EditorIssue;
  dispatch: React.Dispatch<EditorAction>;
}) {
  const firstRef = issue.refs[0];
  const clickable = firstRef !== undefined;
  return (
    <li
      style={{
        padding: '4px 6px',
        marginBottom: 4,
        borderLeft: `3px solid ${PALETTE.placement_highlight.invalid}`,
        background: PALETTE.walls.paint,
        cursor: clickable ? 'pointer' : 'default',
      }}
      onClick={() => {
        if (!firstRef) return;
        if (firstRef.kind === 'panel') {
          dispatch({ type: 'select', selection: { kind: 'panel' } });
        } else {
          dispatch({
            type: 'select',
            selection: { kind: firstRef.kind, id: firstRef.id },
          });
        }
      }}
    >
      {issue.message}
    </li>
  );
}

function SelectionEditor({ state, dispatch }: EditorSidebarProps) {
  const sel = state.selection;
  if (sel === null) {
    return (
      <p style={{ fontSize: 12, color: PALETTE.text.secondary, margin: 0 }}>Объект не выбран.</p>
    );
  }

  if (sel.kind === 'room') {
    const room = state.rooms.find((r) => r.id === sel.id);
    if (!room) return null;
    return (
      <div>
        <p
          data-testid="selected-id"
          style={{ margin: '0 0 8px', fontFamily: 'monospace', fontSize: 13 }}
        >
          {room.id}
        </p>
        <label style={{ ...labelStyle, marginTop: 8 }}>Тип</label>
        <select
          data-testid="room-type-select"
          value={room.type}
          onChange={(e) =>
            dispatch({
              type: 'update_room',
              id: room.id,
              patch: { type: e.target.value as RoomType },
            })
          }
          style={inputStyle}
        >
          {ROOM_TYPES.map((rt) => (
            <option key={rt.value} value={rt.value}>
              {rt.label}
            </option>
          ))}
        </select>
        <label style={{ ...labelStyle, marginTop: 8 }}>Название</label>
        <input
          value={room.name}
          onChange={(e) =>
            dispatch({ type: 'update_room', id: room.id, patch: { name: e.target.value } })
          }
          style={inputStyle}
        />
        <DeleteButton dispatch={dispatch} />
      </div>
    );
  }

  if (sel.kind === 'panel') {
    return (
      <div>
        <p style={{ fontSize: 12, color: PALETTE.text.secondary, margin: '0 0 8px' }}>
          Электрощиток на тайле ({state.electricalPanel?.x}, {state.electricalPanel?.y}).
        </p>
        <DeleteButton dispatch={dispatch} />
      </div>
    );
  }

  if (sel.kind === 'window') {
    const win = state.windows.find((w) => w.id === sel.id);
    if (!win) return null;
    return (
      <div>
        <p
          data-testid="selected-id"
          style={{ margin: '0 0 8px', fontFamily: 'monospace', fontSize: 13 }}
        >
          {win.id}
        </p>
        <label style={{ ...labelStyle, marginTop: 8 }}>Высота подоконника, м</label>
        <input
          type="number"
          step={0.1}
          value={win.sill_height_m}
          onChange={(e) =>
            dispatch({
              type: 'update_window',
              id: win.id,
              patch: { sill_height_m: Number.parseFloat(e.target.value) || 0 },
            })
          }
          style={inputStyle}
        />
        <label style={{ ...labelStyle, marginTop: 8 }}>Высота окна, м</label>
        <input
          type="number"
          step={0.1}
          value={win.height_m}
          onChange={(e) =>
            dispatch({
              type: 'update_window',
              id: win.id,
              patch: { height_m: Number.parseFloat(e.target.value) || 0 },
            })
          }
          style={inputStyle}
        />
        <DeleteButton dispatch={dispatch} />
      </div>
    );
  }

  // дверь
  const door = state.doors.find((d) => d.id === sel.id);
  if (!door) return null;
  return (
    <div>
      <p
        data-testid="selected-id"
        style={{ margin: '0 0 8px', fontFamily: 'monospace', fontSize: 13 }}
      >
        {door.id}
      </p>
      <label style={{ ...labelStyle, marginTop: 8 }}>Петли</label>
      <select
        data-testid="door-hinge-select"
        value={door.hinge}
        onChange={(e) =>
          dispatch({
            type: 'update_door',
            id: door.id,
            patch: { hinge: e.target.value as 'start' | 'end' },
          })
        }
        style={inputStyle}
      >
        <option value="start">Со стороны start</option>
        <option value="end">Со стороны end</option>
      </select>
      <label style={{ ...labelStyle, marginTop: 8 }}>Свинг</label>
      <select
        data-testid="door-swing-select"
        value={door.swing_side}
        onChange={(e) =>
          dispatch({
            type: 'update_door',
            id: door.id,
            patch: { swing_side: e.target.value as 'left' | 'right' },
          })
        }
        style={inputStyle}
      >
        <option value="left">Влево</option>
        <option value="right">Вправо</option>
      </select>
      <label style={{ ...labelStyle, marginTop: 8 }}>Высота двери, м</label>
      <input
        type="number"
        step={0.1}
        value={door.height_m}
        onChange={(e) =>
          dispatch({
            type: 'update_door',
            id: door.id,
            patch: { height_m: Number.parseFloat(e.target.value) || 0 },
          })
        }
        style={inputStyle}
      />
      <DeleteButton dispatch={dispatch} />
    </div>
  );
}

function DeleteButton({ dispatch }: { dispatch: React.Dispatch<EditorAction> }) {
  return (
    <button
      type="button"
      data-testid="delete-selected"
      onClick={() => dispatch({ type: 'delete_selected' })}
      style={{ ...dangerButtonStyle, marginTop: 12, width: '100%' }}
    >
      🗑 Удалить
    </button>
  );
}
