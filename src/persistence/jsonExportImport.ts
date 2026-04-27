import DOMPurify from 'dompurify';
import { z } from 'zod/v4';
import { useProjectStore } from '../store/projectStore';
import type { ProjectState } from '../store/projectStore';
import type { FloorType, CeilingType, FloorCovering, WallCovering } from '../domain/geometry/types';
import { LayoutSchema } from '../domain/geometry/types';
import { buildExportFilename } from '../export/sanitizeFilename';
import layout1Data from '../data/layouts/layout1.json';
import layout2Data from '../data/layouts/layout2.json';
import layout3Data from '../data/layouts/layout3.json';

const layoutsById = new Map([
  [1, LayoutSchema.parse(layout1Data)],
  [2, LayoutSchema.parse(layout2Data)],
  [3, LayoutSchema.parse(layout3Data)],
]);

// Strict Zod schema for imported project JSON — rejects unknown fields (SEC-6)
const ProjectJSONSchema = z.object({
  version: z.literal('1.0'),
  layoutId: z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]),
  currentStage: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  flooring: z.record(z.string(), z.string()),
  ceiling: z.record(z.string(), z.string()),
  electricalPoints: z.array(
    z.object({
      id: z.string(),
      wallId: z.string(),
      position: z.number(),
      type: z.enum(['socket', 'switch']),
    }),
  ),
  floorCovering: z.record(z.string(), z.string()),
  wallCovering: z.record(z.string(), z.string()),
  furniture: z.array(
    z.object({
      id: z.string(),
      catalogId: z.string(),
      position: z.object({ x: z.number(), y: z.number() }),
      rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
      mirrored: z.boolean(),
    }),
  ),
});

/** Sanitize all string values in an object tree to prevent XSS (SEC-1) */
function sanitizeStrings<T>(obj: T): T {
  if (typeof obj === 'string') {
    return DOMPurify.sanitize(obj) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeStrings) as T;
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeStrings(value);
    }
    return result as T;
  }
  return obj;
}

export function exportProjectJSON(state: ProjectState) {
  const data = {
    version: '1.0' as const,
    layoutId: state.layoutId,
    currentStage: state.currentStage,
    flooring: { ...state.flooring },
    ceiling: { ...state.ceiling },
    electricalPoints: [...state.electricalPoints],
    floorCovering: { ...state.floorCovering },
    wallCovering: { ...state.wallCovering },
    furniture: [...state.furniture],
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const projectId = state.layoutId !== null ? `layout${state.layoutId}` : null;
  a.download = buildExportFilename('interior_design', projectId, 'json');
  a.click();
  URL.revokeObjectURL(url);
}

export function importProjectJSON(jsonText: string) {
  try {
    const raw = JSON.parse(jsonText);

    // Validate schema — rejects unknown fields (SEC-6)
    const parsed = ProjectJSONSchema.parse(raw);

    // Sanitize all strings (SEC-1)
    const data = sanitizeStrings(parsed);

    const store = useProjectStore.getState();

    if (data.layoutId) {
      const layout = layoutsById.get(data.layoutId);
      if (layout) {
        store.selectLayout(layout);
      }
    }

    useProjectStore.setState({
      currentStage: data.currentStage,
      flooring: (data.flooring ?? {}) as Record<string, FloorType>,
      ceiling: (data.ceiling ?? {}) as Record<string, CeilingType>,
      electricalPoints: data.electricalPoints ?? [],
      floorCovering: (data.floorCovering ?? {}) as Record<string, FloorCovering>,
      wallCovering: (data.wallCovering ?? {}) as Record<string, WallCovering>,
      furniture: data.furniture ?? [],
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      alert(
        'Файл проекта не прошёл валидацию. Возможно, он повреждён или содержит неизвестные поля.',
      );
    } else {
      alert('Ошибка при загрузке проекта. Файл повреждён или имеет неверный формат.');
    }
  }
}
