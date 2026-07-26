/**
 * Local metric geometry for the map editor.
 *
 * Editing shapes in lat/lon is miserable: "move this bed 50 cm east" is not a
 * constant number of degrees, and degrees of longitude shrink as you go north.
 * So the editor converts to a LOCAL METRIC FRAME anchored at the farm — plain
 * metres, x east, y north — does all the work there, and converts back.
 *
 * The projection is equirectangular around the origin. Over a farm (a few
 * hundred metres) its error is well under a centimetre, which is far below the
 * precision anyone can draw at.
 */

const R = 6_378_137; // WGS-84 equatorial radius
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export interface LatLon { lat: number; lon: number }
/** Metres from the origin: x east, y north. */
export interface Point { x: number; y: number }

/** A local frame anchored at one point, so metres are comparable across shapes. */
export class Frame {
  private readonly cosLat: number;

  constructor(readonly origin: LatLon) {
    this.cosLat = Math.cos(origin.lat * D2R);
  }

  toLocal(p: LatLon): Point {
    return {
      x: (p.lon - this.origin.lon) * D2R * R * this.cosLat,
      y: (p.lat - this.origin.lat) * D2R * R,
    };
  }

  toLatLon(p: Point): LatLon {
    return {
      lat: this.origin.lat + (p.y / R) * R2D,
      lon: this.origin.lon + (p.x / (R * this.cosLat)) * R2D,
    };
  }

  ringToLocal(ring: Array<[number, number]>): Point[] {
    return ring.map(([lon, lat]) => this.toLocal({ lat, lon }));
  }

  ringToLonLat(pts: Point[]): Array<[number, number]> {
    return pts.map((p) => {
      const ll = this.toLatLon(p);
      return [ll.lon, ll.lat] as [number, number];
    });
  }
}

export interface Polygon { type: 'Polygon'; coordinates: Array<Array<[number, number]>> }

export function polygon(ring: Array<[number, number]>): Polygon {
  const closed = ring.length > 0 && (ring[0]![0] !== ring[ring.length - 1]![0]
    || ring[0]![1] !== ring[ring.length - 1]![1]);
  return { type: 'Polygon', coordinates: [closed ? [...ring, ring[0]!] : ring] };
}

/** Outer ring without the repeated closing vertex. */
export function outerRing(geo: unknown): Array<[number, number]> | null {
  const g = geo as Polygon | null;
  if (!g || g.type !== 'Polygon') return null;
  const ring = g.coordinates?.[0];
  if (!ring || ring.length < 4) return null;
  const last = ring.length - 1;
  const closed = ring[0]![0] === ring[last]![0] && ring[0]![1] === ring[last]![1];
  return closed ? ring.slice(0, last) : ring;
}

// ------------------------------------------------------------- rectangles

/**
 * An oriented rectangle. Beds are almost always long thin rectangles lying at
 * whatever bearing the field runs, so this — not a free polygon — is the shape
 * people actually want to place and align.
 */
export interface Rect {
  /** Centre, in local metres. */
  cx: number;
  cy: number;
  /** Extent along the rectangle's own axes, in metres. */
  width: number;
  height: number;
  /** Bearing of the width axis, degrees clockwise from north. */
  rotation: number;
}

export function rectToPoints(r: Rect): Point[] {
  /*
   * At rotation 0, `width` spans east-west and `height` north-south — the
   * intuitive reading of "a 0.75 m wide, 30 m long bed". Rotation turns the
   * pair clockwise, as a compass bearing does.
   */
  const a = r.rotation * D2R;
  const ux = { x: Math.cos(a), y: -Math.sin(a) };   // width axis
  const uy = { x: Math.sin(a), y: Math.cos(a) };    // height axis
  const hw = r.width / 2;
  const hh = r.height / 2;

  return [
    [-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh],
  ].map(([w, h]) => ({
    x: r.cx + ux.x * w! + uy.x * h!,
    y: r.cy + ux.y * w! + uy.y * h!,
  }));
}

/**
 * Best-fit oriented rectangle for an arbitrary ring.
 *
 * Used when someone drags a hand-drawn shape into the editor: we need width,
 * height and rotation to show in the numeric fields. Rotating callipers would
 * be exact; a coarse angle sweep is simpler and accurate to a quarter degree,
 * which is finer than anyone draws by tapping.
 */
export function fitRect(pts: Point[]): Rect {
  if (pts.length === 0) return { cx: 0, cy: 0, width: 0, height: 0, rotation: 0 };

  let best: Rect | null = null;
  let bestArea = Infinity;

  for (let deg = 0; deg < 90; deg += 0.25) {
    const a = deg * D2R;
    const cos = Math.cos(a), sin = Math.sin(a);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;

    for (const p of pts) {
      const u = p.x * cos + p.y * sin;
      const v = -p.x * sin + p.y * cos;
      if (u < minU) minU = u; if (u > maxU) maxU = u;
      if (v < minV) minV = v; if (v > maxV) maxV = v;
    }

    const w = maxU - minU, h = maxV - minV;
    const area = w * h;
    if (area < bestArea) {
      bestArea = area;
      const cu = (minU + maxU) / 2, cv = (minV + maxV) / 2;
      best = {
        cx: cu * cos - cv * sin,
        cy: cu * sin + cv * cos,
        width: w,
        height: h,
        // The sweep measures counter-clockwise from east; bearings run
        // clockwise, and rectangles repeat every 90°.
        rotation: ((360 - deg) % 90 + 90) % 90,
      };
    }
  }
  return best!;
}

// --------------------------------------------------------------- measures

/** Axis-aligned bounds in local metres. */
export function bounds(pts: Point[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function centroid(pts: Point[]): Point {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}

/** Shoelace area in m². */
export function area(pts: Point[]): number {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function translate(pts: Point[], dx: number, dy: number): Point[] {
  return pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

/** Scale about a fixed anchor, so dragging one edge keeps the other still. */
export function scaleAbout(pts: Point[], anchor: Point, sx: number, sy: number): Point[] {
  return pts.map((p) => ({
    x: anchor.x + (p.x - anchor.x) * sx,
    y: anchor.y + (p.y - anchor.y) * sy,
  }));
}

export function rotateAbout(pts: Point[], anchor: Point, deg: number): Point[] {
  const a = -deg * D2R; // negative: bearings run clockwise
  const cos = Math.cos(a), sin = Math.sin(a);
  return pts.map((p) => {
    const dx = p.x - anchor.x, dy = p.y - anchor.y;
    return { x: anchor.x + dx * cos - dy * sin, y: anchor.y + dx * sin + dy * cos };
  });
}

export function pointInRing(pt: Point, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    if ((a.y > pt.y) !== (b.y > pt.y)
      && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// --------------------------------------------------------------- snapping

export interface SnapResult { dx: number; dy: number; hitX: number | null; hitY: number | null }

/**
 * Snap the moving shape's bounds to nearby guide lines.
 *
 * `guides` are candidate x and y values in local metres — typically the edges
 * and centres of every other shape, so beds line up with each other and with
 * the field boundary without anyone typing a number.
 */
export function snapBounds(
  b: ReturnType<typeof bounds>,
  guides: { xs?: number[]; ys?: number[] },
  tolerance = 0.35,
): SnapResult {
  const candX = [
    { v: b.minX, k: 'min' }, { v: (b.minX + b.maxX) / 2, k: 'mid' }, { v: b.maxX, k: 'max' },
  ];
  const candY = [
    { v: b.minY, k: 'min' }, { v: (b.minY + b.maxY) / 2, k: 'mid' }, { v: b.maxY, k: 'max' },
  ];

  let dx = 0, hitX: number | null = null, bestX = tolerance;
  for (const c of candX) {
    for (const g of guides.xs ?? []) {
      const d = Math.abs(g - c.v);
      if (d < bestX) { bestX = d; dx = g - c.v; hitX = g; }
    }
  }

  let dy = 0, hitY: number | null = null, bestY = tolerance;
  for (const c of candY) {
    for (const g of guides.ys ?? []) {
      const d = Math.abs(g - c.v);
      if (d < bestY) { bestY = d; dy = g - c.v; hitY = g; }
    }
  }

  return { dx, dy, hitX, hitY };
}

/** Round to a grid, for "every bed on a 25 cm grid". */
export function snapToGrid(value: number, grid: number): number {
  return grid > 0 ? Math.round(value / grid) * grid : value;
}
