/** Where releases are published. The update check reads the latest one. */
export const RELEASES_REPO = "ahmedharabi/Hunt-CRM";

/**
 * Compare two `x.y.z` versions (a leading "v" is ignored). Pre-release
 * suffixes are ignored too: the check only looks at published releases.
 * Returns a negative number when a < b, 0 when equal, positive when a > b.
 */
export function compareVersions(a: string, b: string) {
  const parse = (v: string) =>
    v
      .trim()
      .replace(/^v/i, "")
      .split(/[-+]/)[0]
      .split(".")
      .map((n) => Number.parseInt(n, 10) || 0);
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
