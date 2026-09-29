export const systems = ['POWER', 'WATER', 'TRANSIT', 'COMMS'] as const;
export type System = typeof systems[number];
export const factions = ['OPERATOR', 'DISRUPTOR'] as const;
export type Faction = typeof factions[number];
export const responses = ['STABILIZE', 'DIAGNOSE', 'INTERFERE'] as const;
export type Response = typeof responses[number];
export const professions = ['Grid Engineer', 'Water Planner', 'Transit Controller', 'Network Coordinator', 'Auditor', 'Dispatcher', 'Systems Architect', 'Logistics Lead', 'Forecast Analyst', 'Crisis Liaison'] as const;
export type Profession = typeof professions[number];
export const balance: Record<number, { disruptors: number; teams: [number, number]; progress: [number, number] }> = {
  5: { disruptors: 2, teams: [2, 2], progress: [1, 1] }, 6: { disruptors: 2, teams: [3, 2], progress: [2, 1] },
  7: { disruptors: 3, teams: [3, 3], progress: [2, 1] }, 8: { disruptors: 3, teams: [3, 3], progress: [2, 1] },
  9: { disruptors: 3, teams: [4, 3], progress: [3, 1] }, 10: { disruptors: 4, teams: [4, 4], progress: [2, 2] },
};
export const config = { maxStability: 5, startStability: 3, maxCrisis: 5, rounds: 8, auditCost: 2, outcomes: { success: { stability: 1, crisis: 0 }, failure: { stability: -1, crisis: 1 } } } as const;
export type Incident = { id: string; title: string; brief: string; orders: [{ system: System; strain: number }, { system: System; strain: number }] };
export const incidents: Incident[] = [
  { id: 'rainline', title: 'Rainline', brief: 'Heavy weather scatters the evening shift.', orders: [{ system: 'POWER', strain: 0 }, { system: 'TRANSIT', strain: 0 }] },
  { id: 'crowded-crossing', title: 'Crowded Crossing', brief: 'A citywide gathering changes the usual rhythm.', orders: [{ system: 'TRANSIT', strain: 1 }, { system: 'COMMS', strain: 0 }] },
  { id: 'low-reserve', title: 'Low Reserve', brief: 'Stored capacity is stretched across districts.', orders: [{ system: 'WATER', strain: 0 }, { system: 'POWER', strain: 0 }] },
  { id: 'night-shift', title: 'Night Shift', brief: 'A thin handover leaves gaps in the city log.', orders: [{ system: 'COMMS', strain: 0 }, { system: 'WATER', strain: 1 }] },
  { id: 'long-weekend', title: 'Long Weekend', brief: 'Unusual demand keeps crews moving.', orders: [{ system: 'TRANSIT', strain: 0 }, { system: 'WATER', strain: 0 }] },
  { id: 'signal-drift', title: 'Signal Drift', brief: 'Conflicting reports slow a coordinated response.', orders: [{ system: 'COMMS', strain: 1 }, { system: 'POWER', strain: 0 }] },
  { id: 'morning-surge', title: 'Morning Surge', brief: 'The city wakes before the schedule catches up.', orders: [{ system: 'POWER', strain: 1 }, { system: 'TRANSIT', strain: 0 }] },
  { id: 'crosswind', title: 'Crosswind', brief: 'An uneasy forecast sends teams in two directions.', orders: [{ system: 'WATER', strain: 0 }, { system: 'COMMS', strain: 0 }] },
  { id: 'backlog', title: 'Backlog', brief: 'Routine work has accumulated across the city.', orders: [{ system: 'TRANSIT', strain: 0 }, { system: 'POWER', strain: 1 }] },
  { id: 'relay-hour', title: 'Relay Hour', brief: 'Multiple teams need the same narrow window.', orders: [{ system: 'COMMS', strain: 0 }, { system: 'TRANSIT', strain: 1 }] },
  { id: 'high-tide', title: 'High Tide', brief: 'Changing conditions test the evening plan.', orders: [{ system: 'WATER', strain: 1 }, { system: 'POWER', strain: 0 }] },
  { id: 'quiet-failure', title: 'Quiet Failure', brief: 'Small reports have started to add up.', orders: [{ system: 'POWER', strain: 0 }, { system: 'COMMS', strain: 1 }] },
];
export function nextRandom(seed: number): number { let x = seed >>> 0 || 0x6d2b79f5; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0; }
export function shuffled<T>(items: readonly T[], seed: number): { items: T[]; seed: number } {
  const copy = [...items]; let state = seed;
  for (let i = copy.length - 1; i > 0; i--) { state = nextRandom(state); const j = state % (i + 1); [copy[i], copy[j]] = [copy[j]!, copy[i]!]; }
  return { items: copy, seed: state };
}
