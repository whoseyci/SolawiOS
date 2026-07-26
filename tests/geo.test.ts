import { describe, it, expect } from 'vitest';
import {
  Frame, polygon, outerRing, fitRect, rectToPoints, bounds, centroid, area,
  translate, scaleAbout, rotateAbout, pointInRing, snapBounds, snapToGrid,
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
