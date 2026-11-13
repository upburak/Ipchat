export function applyState(state, next) {
  let changed = false;
  for (const key of Object.keys(next)) {
    const a = state[key];
    const b = next[key];
    const differs = Array.isArray(a) && Array.isArray(b) ? a.length !== b.length || a.some((v, i) => v !== b[i]) : a !== b;
    if (differs) {
      state[key] = b;
      changed = true;
    }
  }
  return changed;
}
