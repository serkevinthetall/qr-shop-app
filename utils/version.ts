/** Returns true if `current` is strictly below `minimum` (semver-ish x.y.z). */
export function isVersionBelow(current: string, minimum: string): boolean {
  const left = parseVersion(current);
  const right = parseVersion(minimum);

  for (let index = 0; index < 3; index += 1) {
    if (left[index] < right[index]) {
      return true;
    }

    if (left[index] > right[index]) {
      return false;
    }
  }

  return false;
}

function parseVersion(value: string): [number, number, number] {
  const parts = String(value || '0')
    .trim()
    .split(/[^\d]+/)
    .filter(Boolean)
    .map((part) => Number(part));

  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}
