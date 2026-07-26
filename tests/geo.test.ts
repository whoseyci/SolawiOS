import { describe, it, expect } from 'vitest';
import {
  Frame, polygon, outerRing, fitRect, rectToPoints, bounds, centroid, area,
  translate, scaleAbout, rotateAbout, pointInRing, snapBounds, snapToGrid,
  resizeRectByCorner, moveVertex, splitEdge, removeVertex, rotationTowards,
} from '../packages/web/src/lib/geo.js';

/**
 * The editor works in local metres and writes back lat/lon. If that conversion
 * drifts, beds silently move — which is far worse than a visible crash, because
 * nobody notices until the map no longer matches the field.
 */
const FRANKFURT = { lat: 50.1109, lon: 8.6821 };

describe('local metric frame', () => {
  it('round-trips a point without measurable drift', () => {
    const f = new Frame(FRANKFURT);
    const p = { lat: 50.1121, lon: 8.6840 };
    const back = f.toLatLon(f.toLocal(p));
    // Sub-millimetre at farm scale.
    expect(back.lat).toBeCloseTo(p.lat, 9);
    expect(back.lon).toBeCloseTo(p.lon, 9);
  });

  it('measures known distances in metres', () => {
    const f = new Frame(FRANKFURT);
    // 0.001° of latitude is ~111.2 m anywhere.
    const north = f.toLocal({ lat: FRANKFURT.lat + 0.001, lon: FRANKFURT.lon });
    expect(north.y).toBeGreaterThan(110);
    expect(north.y).toBeLessThan(112);
    expect(Math.abs(north.x)).toBeLessThan(0.001);

    // Longitude is compressed by cos(lat) — ~71 m at this latitude.
    const east = f.toLocal({ lat: FRANKFURT.lat, lon: FRANKFURT.lon + 0.001 });
    expect(east.x).toBeGreaterThan(69);
    expect(east.x).toBeLessThan(73);
  });

  it('round-trips a whole ring', () => {
    const f = new Frame(FRANKFURT);
    const ring: Array<[number, number]> = [
      [8.6800, 50.1100], [8.6814, 50.1100], [8.6814, 50.1109], [8.6800, 50.1109],
    ];
    const back = f.ringToLonLat(f.ringToLocal(ring));
    ring.forEach(([lon, lat], i) => {
      expect(back[i]![0]).toBeCloseTo(lon, 9);
      expect(back[i]![1]).toBeCloseTo(lat, 9);
    });
  });
});

describe('rectangles', () => {
  it('builds a rectangle with the requested dimensions', () => {
    const pts = rectToPoints({ cx: 0, cy: 0, width: 30, height: 0.75, rotation: 0 });
    expect(pts).toHaveLength(4);
    // At rotation 0, width spans east-west and height north-south.
    const b = bounds(pts);
    expect(b.width).toBeCloseTo(30, 6);
    expect(b.height).toBeCloseTo(0.75, 6);
    expect(area(pts)).toBeCloseTo(22.5, 4);
  });

  it('recovers dimensions from its own output', () => {
    const original = { cx: 12, cy: -5, width: 30, height: 0.75, rotation: 35 };
    const fit = fitRect(rectToPoints(original));
    expect(fit.cx).toBeCloseTo(original.cx, 3);
    expect(fit.cy).toBeCloseTo(original.cy, 3);
    // The fitter cannot tell width from height, so accept either assignment.
    const dims = [fit.width, fit.height].sort((a, b) => a - b);
    expect(dims[0]).toBeCloseTo(0.75, 1);
    expect(dims[1]).toBeCloseTo(30, 1);
  });

  it('finds the tight rectangle for a rotated shape, not the axis-aligned box', () => {
    // A long thin bed at 45° has a large bounding box but a small true area.
    const pts = rectToPoints({ cx: 0, cy: 0, width: 20, height: 2, rotation: 45 });
    const b = bounds(pts);
    const fit = fitRect(pts);
    expect(fit.width * fit.height).toBeLessThan(b.width * b.height * 0.8);
    expect(fit.width * fit.height).toBeCloseTo(40, 0);
  });
});

describe('transforms', () => {
  const square = [
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
  ];

  it('translates without changing size', () => {
    const moved = translate(square, 5, -3);
    expect(area(moved)).toBeCloseTo(area(square), 6);
    expect(centroid(moved).x).toBeCloseTo(centroid(square).x + 5, 6);
  });

  it('scales about an anchor, leaving the anchor fixed', () => {
    const scaled = scaleAbout(square, { x: 0, y: 0 }, 2, 0.5);
    expect(scaled[0]).toEqual({ x: 0, y: 0 });
    const b = bounds(scaled);
    expect(b.width).toBeCloseTo(20, 6);
    expect(b.height).toBeCloseTo(5, 6);
  });

  it('rotates without changing area', () => {
    const rotated = rotateAbout(square, centroid(square), 30);
    expect(area(rotated)).toBeCloseTo(area(square), 6);
  });

  it('tests point containment', () => {
    expect(pointInRing({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInRing({ x: 15, y: 5 }, square)).toBe(false);
  });
});

describe('snapping', () => {
  it('aligns an edge to a nearby guide', () => {
    const b = { minX: 10.2, maxX: 20.2, minY: 0, maxY: 5, width: 10, height: 5 };
    // A neighbour's edge sits at x = 10, 20 cm away.
    const snap = snapBounds(b, { xs: [10], ys: [] }, 0.35);
    expect(snap.dx).toBeCloseTo(-0.2, 6);
    expect(snap.hitX).toBe(10);
  });

  it('leaves a shape alone when nothing is within tolerance', () => {
    const b = { minX: 10, maxX: 20, minY: 0, maxY: 5, width: 10, height: 5 };
    const snap = snapBounds(b, { xs: [4] }, 0.35);
    expect(snap.dx).toBe(0);
    expect(snap.hitX).toBeNull();
  });

  it('rounds to the grid', () => {
    expect(snapToGrid(0.77, 0.25)).toBeCloseTo(0.75, 6);
    expect(snapToGrid(30.4, 0.25)).toBeCloseTo(30.5, 6);
    // A grid of zero disables snapping rather than dividing by zero.
    expect(snapToGrid(1.234, 0)).toBe(1.234);
  });
});

describe('GeoJSON helpers', () => {
  it('closes an open ring', () => {
    const p = polygon([[0, 0], [1, 0], [1, 1], [0, 1]]);
    const ring = p.coordinates[0]!;
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
  });

  it('strips the closing vertex when reading back', () => {
    const ring = outerRing(polygon([[0, 0], [1, 0], [1, 1], [0, 1]]));
    expect(ring).toHaveLength(4);
  });

  it('rejects anything that is not a usable polygon', () => {
    expect(outerRing(null)).toBeNull();
    expect(outerRing({ type: 'Point', coordinates: [0, 0] })).toBeNull();
    expect(outerRing({ type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] })).toBeNull();
  });
});

describe('a realistic bed survives an edit cycle', () => {
  it('keeps its dimensions through local edit and write-back', () => {
    const frame = new Frame(FRANKFURT);
    // 30 m x 0.75 m market-garden bed.
    const original = rectToPoints({ cx: 0, cy: 0, width: 0.75, height: 30, rotation: 0 });
    const stored = polygon(frame.ringToLonLat(original));

    // Reload, nudge 25 cm east, save again.
    const reloaded = frame.ringToLocal(outerRing(stored)!);
    const nudged = translate(reloaded, 0.25, 0);
    const saved = polygon(frame.ringToLonLat(nudged));
    const final = frame.ringToLocal(outerRing(saved)!);

    const b = bounds(final);
    expect(b.width).toBeCloseTo(0.75, 3);
    expect(b.height).toBeCloseTo(30, 3);
    expect(centroid(final).x).toBeCloseTo(0.25, 3);
  });
});

describe('corner drags respect the shape kind', () => {
  /** Right angles at every vertex, within tolerance. */
  function isRectangle(pts: ReturnType<typeof rectToPoints>, tol = 1e-6): boolean {
    if (pts.length !== 4) return false;
    for (let i = 0; i < 4; i++) {
      const a = pts[i]!, b = pts[(i + 1) % 4]!, c = pts[(i + 2) % 4]!;
      const v1 = { x: a.x - b.x, y: a.y - b.y };
      const v2 = { x: c.x - b.x, y: c.y - b.y };
      const dot = v1.x * v2.x + v1.y * v2.y;
      const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
      if (mag > 0 && Math.abs(dot / mag) > tol) return false;
    }
    return true;
  }

  it('keeps an AXIS-ALIGNED rectangle rectangular', () => {
    const rect = { cx: 0, cy: 0, width: 10, height: 4, rotation: 0 };
    const next = resizeRectByCorner(rect, 0, { x: -8, y: -3 });
    expect(isRectangle(rectToPoints(next))).toBe(true);
  });

  it('keeps a ROTATED rectangle rectangular — the shear bug', () => {
    // Dragging a corner used to scale in world x/y, which turns a rotated
    // rectangle into a parallelogram.
    const rect = { cx: 5, cy: 5, width: 30, height: 0.75, rotation: 37 };
    for (const corner of [0, 1, 2, 3]) {
      const next = resizeRectByCorner(rect, corner, { x: 12, y: -4 });
      expect(isRectangle(rectToPoints(next)), `corner ${corner} sheared`).toBe(true);
      // Rotation must survive the drag.
      expect(next.rotation).toBeCloseTo(37, 6);
    }
  });

  it('pins the opposite corner while dragging', () => {
    const rect = { cx: 0, cy: 0, width: 10, height: 6, rotation: 20 };
    const pinned = rectToPoints(rect)[2]!;
    const next = resizeRectByCorner(rect, 0, { x: 3, y: 9 });
    // A drag may reorder the vertices, so assert the pinned POINT survives
    // somewhere in the result rather than at a fixed index.
    const stillThere = rectToPoints(next).some(
      (p) => Math.hypot(p.x - pinned.x, p.y - pinned.y) < 1e-6);
    expect(stillThere).toBe(true);
  });

  it('refuses to collapse a rectangle to zero', () => {
    const rect = { cx: 0, cy: 0, width: 10, height: 4, rotation: 0 };
    const next = resizeRectByCorner(rect, 0, rectToPoints(rect)[2]!, 0.25);
    expect(next.width).toBeGreaterThan(0);
    expect(next.height).toBeGreaterThan(0);
  });

  it('moves only ONE vertex of a free polygon', () => {
    const pts = [
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: -3, y: 5 },
    ];
    const next = moveVertex(pts, 2, { x: 14, y: 13 });
    expect(next[2]).toEqual({ x: 14, y: 13 });
    // Every other vertex is untouched.
    [0, 1, 3, 4].forEach((i) => expect(next[i]).toEqual(pts[i]));
  });

  it('adds and removes vertices, never below a triangle', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const split = splitEdge(pts, 0);
    expect(split).toHaveLength(4);
    expect(split[1]).toEqual({ x: 5, y: 0 });

    expect(removeVertex(split, 1)).toHaveLength(3);
    expect(removeVertex(pts, 0)).toHaveLength(3); // already minimal
  });
});

describe('snapshot resolution', () => {
  // Re-implements chooseZoom's arithmetic; lib/snapshot.ts needs a DOM.
  const lonToX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;
  const latToY = (lat: number, z: number) => {
    const r = (lat * Math.PI) / 180;
    return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
  };
  function pick(b: { north: number; south: number; east: number; west: number },
                maxPx = 8192, maxArea = 60_000_000): number {
    for (let z = 20; z >= 12; z--) {
      const w = (lonToX(b.east, z) - lonToX(b.west, z)) * 256;
      const h = (latToY(b.south, z) - latToY(b.north, z)) * 256;
      if (w <= maxPx && h <= maxPx && w * h <= maxArea) return z;
    }
    return 12;
  }
  /** Bounds roughly `m` metres square at latitude 50. */
  const square = (m: number) => {
    const dLat = m / 111_320 / 2;
    const dLon = m / (111_320 * Math.cos((50 * Math.PI) / 180)) / 2;
    return { north: 50 + dLat, south: 50 - dLat, east: 8 + dLon, west: 8 - dLon };
  };

  it('captures a typical farm at full native resolution', () => {
    // z19 is Esri's native level (~0.19 m/px) — the snapshot is permanent, so
    // it must not be downsampled for a farm that comfortably fits.
    expect(pick(square(600))).toBeGreaterThanOrEqual(19);
    expect(pick(square(400))).toBeGreaterThanOrEqual(19);
  });

  it('steps down only when a farm is genuinely huge', () => {
    const big = pick(square(3000));
    expect(big).toBeLessThan(19);
    expect(big).toBeGreaterThanOrEqual(16);
  });

  it('never exceeds the mobile canvas budget', () => {
    for (const m of [400, 600, 1000, 2000, 4000]) {
      const z = pick(square(m));
      const b = square(m);
      const w = (lonToX(b.east, z) - lonToX(b.west, z)) * 256;
      const h = (latToY(b.south, z) - latToY(b.north, z)) * 256;
      expect(w * h, `${m} m farm exceeded canvas budget`).toBeLessThanOrEqual(60_000_000);
    }
  });
});

describe('offline tile pyramid', () => {
  const lonToTileX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
  const latToTileY = (lat: number, z: number) => {
    const r = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
  };
  function count(b: { north: number; south: number; east: number; west: number },
                 minZ: number, maxZ: number): number {
    let n = 0;
    for (let z = minZ; z <= maxZ; z++) {
      n += (lonToTileX(b.east, z) - lonToTileX(b.west, z) + 1)
         * (latToTileY(b.south, z) - latToTileY(b.north, z) + 1);
    }
    return n;
  }
  const square = (m: number) => {
    const dLat = m / 111_320 / 2;
    const dLon = m / (111_320 * Math.cos((50 * Math.PI) / 180)) / 2;
    return { north: 50 + dLat, south: 50 - dLat, east: 8 + dLon, west: 8 - dLon };
  };

  it('costs little more than the deepest level alone', () => {
    // Each zoom up is a quarter of the tiles, so the whole pyramid converges
    // to ~1.33x the deepest level. This is why storing every zoom is cheap.
    const b = square(600);
    const deepest = count(b, 19, 19);
    const pyramid = count(b, 16, 19);
    expect(pyramid / deepest).toBeLessThan(1.8);
    expect(pyramid).toBeGreaterThan(deepest);
  });

  it('keeps a typical farm well inside a sane download', () => {
    // Both layers at ~22 KB per tile must stay in single-digit MB, or nobody
    // will do it on rural LTE.
    const tiles = count(square(600), 16, 19);
    const megabytes = (tiles * 22_000 * 2) / 1_048_576;
    expect(megabytes).toBeLessThan(15);
  });

  it('grows roughly with area, not with the square of the side', () => {
    const small = count(square(400), 16, 19);
    const large = count(square(800), 16, 19);
    // Four times the area, so within a factor either side of 4x the tiles.
    expect(large / small).toBeGreaterThan(2.5);
    expect(large / small).toBeLessThan(6);
  });

  it('covers the requested bounds at every level', () => {
    const b = square(600);
    for (let z = 16; z <= 19; z++) {
      expect(lonToTileX(b.east, z)).toBeGreaterThanOrEqual(lonToTileX(b.west, z));
      expect(latToTileY(b.south, z)).toBeGreaterThanOrEqual(latToTileY(b.north, z));
    }
  });
});
