import React from 'react';
import { PALETTE } from '../theme/palette';
import { useRulersEnabled } from './useRulersEnabled';

const RULER_PX = 24; // F13.1.1 — outer strip thickness

interface MeasuredCanvasProps {
  /** Canvas pixel dimensions (matches Stage width/height). */
  widthPx: number;
  heightPx: number;
  /** Pixels per tile — converts ruler tick spacing. */
  pxPerTile: number;
  /** Tiles per meter (always 4 for the 0.25 m tile system, but kept as a prop
   *  so unit tests can override). */
  tilesPerMeter?: number;
  /** Konva Stage element rendered to the right of / below the rulers. */
  children: React.ReactNode;
  /** Identifier used in the toggle button's data-testid. */
  testIdPrefix?: string;
}

/**
 * F13.1 (v1.11.0) — wraps a Konva Stage with optional measurement rulers
 * along the top and left edges, plus a small toggle button in the corner.
 * The toggle state is shared via {@link useRulersEnabled} and persisted in
 * localStorage.
 *
 * The rulers live OUTSIDE the Stage, so they never appear in
 * `stage.toDataURL()` snapshots — keeping export output unchanged.
 */
export function MeasuredCanvas({
  widthPx,
  heightPx,
  pxPerTile,
  tilesPerMeter = 4,
  children,
  testIdPrefix = 'measured-canvas',
}: MeasuredCanvasProps) {
  const { enabled, toggle } = useRulersEnabled();
  const pxPerMeter = pxPerTile * tilesPerMeter;

  return (
    <div
      data-testid={`${testIdPrefix}-wrapper`}
      style={{
        display: 'inline-grid',
        gridTemplateColumns: `${RULER_PX}px ${widthPx}px`,
        gridTemplateRows: `${RULER_PX}px ${heightPx}px`,
        position: 'relative',
      }}
    >
      <ToggleButton enabled={enabled} onToggle={toggle} testIdPrefix={testIdPrefix} />
      {enabled && (
        <HorizontalRuler
          width={widthPx}
          pxPerTile={pxPerTile}
          pxPerMeter={pxPerMeter}
          testIdPrefix={testIdPrefix}
        />
      )}
      {enabled && (
        <VerticalRuler
          height={heightPx}
          pxPerTile={pxPerTile}
          pxPerMeter={pxPerMeter}
          testIdPrefix={testIdPrefix}
        />
      )}
      <div style={{ gridColumn: 2, gridRow: 2 }}>{children}</div>
    </div>
  );
}

function ToggleButton({
  enabled,
  onToggle,
  testIdPrefix,
}: {
  enabled: boolean;
  onToggle: () => void;
  testIdPrefix: string;
}) {
  return (
    <button
      type="button"
      data-testid={`${testIdPrefix}-rulers-toggle`}
      aria-pressed={enabled}
      onClick={onToggle}
      title={enabled ? 'Скрыть линейку' : 'Показать линейку'}
      style={{
        gridColumn: 1,
        gridRow: 1,
        width: RULER_PX,
        height: RULER_PX,
        padding: 0,
        border: `1px solid ${enabled ? PALETTE.editor.selection : PALETTE.editor.grid}`,
        background: enabled ? PALETTE.editor.selection : PALETTE.walls.paint,
        color: enabled ? PALETTE.walls.paint : PALETTE.text.primary,
        cursor: 'pointer',
        fontSize: 11,
        lineHeight: 1,
      }}
    >
      📏
    </button>
  );
}

function HorizontalRuler({
  width,
  pxPerTile,
  pxPerMeter,
  testIdPrefix,
}: {
  width: number;
  pxPerTile: number;
  pxPerMeter: number;
  testIdPrefix: string;
}) {
  const meters = Math.ceil(width / pxPerMeter);
  const ticks = [];
  for (let m = 0; m <= meters; m++) {
    const x = m * pxPerMeter;
    ticks.push(
      <line
        key={`maj-${m}`}
        x1={x}
        y1={RULER_PX - 10}
        x2={x}
        y2={RULER_PX}
        stroke={PALETTE.text.primary}
        strokeWidth={1}
      />,
    );
    ticks.push(
      <text
        key={`lab-${m}`}
        x={x + 2}
        y={RULER_PX - 12}
        fontSize={10}
        fill={PALETTE.text.primary}
        style={{ userSelect: 'none' }}
      >
        {m} м
      </text>,
    );
  }
  // Minor ticks every tile (0.25 m), skip those that coincide with major
  const tiles = Math.ceil(width / pxPerTile);
  for (let t = 0; t <= tiles; t++) {
    if ((t * pxPerTile) % pxPerMeter === 0) continue;
    const x = t * pxPerTile;
    ticks.push(
      <line
        key={`min-${t}`}
        x1={x}
        y1={RULER_PX - 4}
        x2={x}
        y2={RULER_PX}
        stroke={PALETTE.text.secondary}
        strokeWidth={1}
      />,
    );
  }
  return (
    <svg
      data-testid={`${testIdPrefix}-ruler-horizontal`}
      width={width}
      height={RULER_PX}
      style={{ gridColumn: 2, gridRow: 1 }}
    >
      {ticks}
    </svg>
  );
}

function VerticalRuler({
  height,
  pxPerTile,
  pxPerMeter,
  testIdPrefix,
}: {
  height: number;
  pxPerTile: number;
  pxPerMeter: number;
  testIdPrefix: string;
}) {
  const meters = Math.ceil(height / pxPerMeter);
  const ticks = [];
  for (let m = 0; m <= meters; m++) {
    const y = m * pxPerMeter;
    ticks.push(
      <line
        key={`maj-${m}`}
        x1={RULER_PX - 10}
        y1={y}
        x2={RULER_PX}
        y2={y}
        stroke={PALETTE.text.primary}
        strokeWidth={1}
      />,
    );
    ticks.push(
      <text
        key={`lab-${m}`}
        x={2}
        y={y + 11}
        fontSize={10}
        fill={PALETTE.text.primary}
        style={{ userSelect: 'none' }}
      >
        {m} м
      </text>,
    );
  }
  const tiles = Math.ceil(height / pxPerTile);
  for (let t = 0; t <= tiles; t++) {
    if ((t * pxPerTile) % pxPerMeter === 0) continue;
    const y = t * pxPerTile;
    ticks.push(
      <line
        key={`min-${t}`}
        x1={RULER_PX - 4}
        y1={y}
        x2={RULER_PX}
        y2={y}
        stroke={PALETTE.text.secondary}
        strokeWidth={1}
      />,
    );
  }
  return (
    <svg
      data-testid={`${testIdPrefix}-ruler-vertical`}
      width={RULER_PX}
      height={height}
      style={{ gridColumn: 1, gridRow: 2 }}
    >
      {ticks}
    </svg>
  );
}
