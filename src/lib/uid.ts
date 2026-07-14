// Unique ID generator. Counter-based for human-readable, short IDs.
let counter = 0;
export const uid = (prefix = 'id'): string =>
  `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;
