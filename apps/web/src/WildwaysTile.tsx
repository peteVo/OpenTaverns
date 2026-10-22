import React from 'react';
import type { Direction, Habitat, Orientation, PlacedTile, Tile } from '@opentaverns/wildways/client';

export function WildwaysIcon({ name }: { name: 'rotateLeft' | 'rotateRight' | 'habitat' | 'route' | 'milestone' | 'claimed' }) {
  return <svg className="wy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name.startsWith('rotate') && <g transform={name === 'rotateRight' ? 'translate(24 0) scale(-1 1)' : undefined}><path d="M4 9h6M4 9V3M4 9a8 8 0 1 1-1 8"/></g>}
    {name === 'habitat' && <><path d="m12 3 9 9-9 9-9-9Z"/><path d="M12 7v10m-4-5h8"/></>}
    {name === 'route' && <path d="M3 7c4-6 8 6 12 0s6 0 6 0M3 16c4-6 8 6 12 0s6 0 6 0"/>}
    {name === 'milestone' && <path d="M5 21V4h14l-4 5 4 5H5"/>}
    {name === 'claimed' && <path d="m5 12 4 4L19 6"/>}
  </svg>;
}

const terrain: Record<Habitat, { title: string; marks: React.ReactNode }> = {
  Forest: { title: 'Forest', marks: <><path d="M18 13 9 31h18zM18 7l-7 14h14zM18 5v31"/><circle cx="31" cy="12" r="2"/><circle cx="7" cy="30" r="1.4"/></> },
  Meadow: { title: 'Meadow', marks: <><path d="M4 30q8-5 16 0t16 0M5 35q8-4 15 0t15 0M13 25v-8m0 0q-5-1-5-6 5 0 5 6Zm0-3q0-6 5-7 0 6-5 7Z"/><path d="M27 26v-6m0 0q-4-1-4-5 4 0 4 5Zm0-2q0-5 4-6 0 5-4 6Z"/></> },
  Highland: { title: 'Highland', marks: <><path d="m3 31 9-15 5 7 7-13 13 21zM17 21l3 4 4-6 5 8"/><path d="M5 35h30"/></> }
};

const landmarks: Record<string, string> = {
  'Ancient Grove': 'M20 5v29M20 10c-8-1-11-5-11-5 0 9 4 13 11 13m0-3c8-1 11-5 11-5 0 9-4 13-11 13',
  'Stone Arch': 'M8 34V20a12 12 0 0 1 24 0v14M4 34h32M13 20a7 7 0 0 1 14 0',
  'Hilltop Observatory': 'M7 16a13 13 0 0 1 26 0zM20 16v17m-9 0h18M15 22h10M16 27h8',
  'Old Bridge': 'M4 20h32M7 20v13m26-13v13M9 20a11 11 0 0 1 22 0M4 34h32',
  'Hidden Spring': 'M20 6c-5 7-10 12-10 18a10 10 0 0 0 20 0c0-6-5-11-10-18ZM14 25q6-5 12 0',
  'Standing Stones': 'M8 34 10 13l5-4 4 5 2 20M23 34l2-25 5 4 3 21M5 35h30'
};

export function TileArt({ tile, orientation = 0, marker = null, selected = false, markerColor, markerSigil, unmatchedPorts }: {
  tile: Tile | PlacedTile; orientation?: Orientation; marker?: { owner: string; mode: 'habitat' | 'route' } | null; selected?: boolean; markerColor?: string; markerSigil?: string; unmatchedPorts?: Direction[];
}) {
  const pattern = `wy-${tile.habitat.toLowerCase()}-${tile.id.replace(/[^a-z0-9]/gi, '')}`;
  const ports = tile.ports;
  const paths = ports.length ? ports.map(direction => {
    const pts = [[40, 3], [77, 40], [40, 77], [3, 40]] as const;
    const [x, y] = pts[direction]!;
    const routePath = `M40 40 Q${x === 40 ? 40 : x},${y === 40 ? 40 : y} ${x},${y}`;
    return <g key={direction} className={`wy-route-line wy-${tile.route?.toLowerCase()}`}>
      <path className="wy-route-bed" d={routePath}/><path className="wy-route-mark" d={routePath}/>
      {unmatchedPorts?.includes(direction as Direction) && (tile.route === 'Stream'
        ? <ellipse className="wy-route-cap wy-stream-cap" cx={x} cy={y} rx="4.2" ry="2.6" transform={`rotate(${direction * 90} ${x} ${y})`}/>
        : <circle className="wy-route-cap wy-trail-cap" cx={x} cy={y} r="2.6"/>)}
    </g>;
  }) : null;
  return <svg className={`wy-tile-art ${selected ? 'is-selected' : ''}`} viewBox="0 0 80 80" aria-hidden="true" focusable="false">
    <defs><pattern id={pattern} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform={`rotate(${tile.habitat === 'Meadow' ? 15 : -15})`}>
      {tile.habitat === 'Forest' ? <path d="M1 0v9M6 0v9"/> : tile.habitat === 'Meadow' ? <path d="M1 9 4 3m1 6 3-6"/> : <path d="M0 8 8 0M-3 3 3-3M5 11l6-6"/>}
    </pattern></defs>
    <rect className={`wy-terrain wy-terrain-${tile.habitat.toLowerCase()}`} x="1" y="1" width="78" height="78" rx="2"/>
    <rect className="wy-terrain-pattern" x="1" y="1" width="78" height="78" rx="2" fill={`url(#${pattern})`}/>
    <g className={`wy-habitat-mark wy-mark-${tile.habitat.toLowerCase()}`}>{terrain[tile.habitat].marks}</g>
    <g transform={`rotate(${orientation * 90} 40 40)`}>{paths}</g>
    {tile.landmark && <g className="wy-landmark-mark" aria-hidden="true"><circle cx="40" cy="40" r="8.5"/><path d={landmarks[tile.landmark] || 'M20 8v24m-8-12h16'}/></g>}
    {marker && <g className={`wy-survey-marker wy-marker-${marker.mode}`} style={{ ['--marker-color' as string]: markerColor || 'var(--w-copper)' }}><circle cx="63" cy="17" r="10.5"/><text className="wy-marker-sigil" x="63" y="20">{markerSigil||'•'}</text><path className="wy-marker-mode" d={marker.mode === 'habitat' ? 'M67 27l3 3-3 3m0-3h-4' : 'M73 28q4-5 8 0t-8 0m0 3q4-5 8 0'}/></g>}
    <rect className="wy-tile-edge" x="1" y="1" width="78" height="78" rx="2"/>
  </svg>;
}

export function WildwaysTile({ tile, orientation = 0, marker = null, selected = false, markerColor, markerSigil, unmatchedPorts }: {
  tile: Tile | PlacedTile; orientation?: Orientation; marker?: { owner: string; mode: 'habitat' | 'route' } | null; selected?: boolean; markerColor?: string; markerSigil?: string; unmatchedPorts?: Direction[];
}) { return <TileArt tile={tile} orientation={orientation} marker={marker} selected={selected} markerColor={markerColor} markerSigil={markerSigil} unmatchedPorts={unmatchedPorts}/>; }
