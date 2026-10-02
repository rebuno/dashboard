import type { ForkPoints, ResourceSelection } from "./api";

// Mirrors the kernel's selection: the newest covering checkpoint, otherwise the
// newest earlier checkpoint, otherwise the initial state.
export function selectRestoration(
  points: ForkPoints,
  seq: number,
): Record<string, ResourceSelection> {
  const restoration: Record<string, ResourceSelection> = {};
  for (const [key, registeredSeq] of Object.entries(points.resources)) {
    if (registeredSeq > seq) continue;
    let selected: ResourceSelection = { covered: false };
    for (const c of points.checkpoints) {
      if (c.key !== key || c.covered_seq > seq) continue;
      const covered = !c.invalidated_seq || seq < c.invalidated_seq;
      if (selected.covered && !covered) continue;
      selected = {
        checkpoint_ref: c.checkpoint_ref,
        checkpoint_seq: c.covered_seq,
        covered,
      };
    }
    restoration[key] = selected;
  }
  return restoration;
}
