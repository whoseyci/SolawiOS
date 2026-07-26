import L from 'leaflet';
import { el, mount, toast } from '../lib/ui.js';
import { icon } from '../lib/icon.js';
import { t, fmt } from '../lib/i18n.js';
import { post } from '../lib/api.js';
import {
  Frame, polygon, outerRing, fitRect, rectToPoints, bounds, centroid, area,
  translate, scaleAbout, rotateAbout, pointInRing, snapBounds, snapToGrid,
  type Point, type Rect,
} from '../lib/geo.js';

/**
 * EDITOR MODE.
 *
 * Everything that changes geometry lives here rather than in the main map, so
 * a gardener checking today's work cannot drag a bed by accident. You enter it
 * deliberately, and the map says so.
 *
 * Design decisions worth keeping:
 *  - all editing happens in LOCAL METRES (lib/geo.ts). Nudging a bed 25 cm east
 *    is a constant in metres and a varying number of degrees, so degrees are
 *    the wrong unit to think in.
 *  - beds are oriented RECTANGLES by default, because that is what beds are.
 *    Free polygons remain available for odd corners.
 *  - every drag has a numeric equivalent. Fingers are imprecise; "start this
 *    bed 2.00 m from the field edge" is not something you can drag reliably.
 */

export type EditTarget = 'field' | 'bed' | 'feature';

export interface EditableShape {
  id: string;
  table: EditTarget;
  name: string;
  /** GeoJSON string as stored. */
  geometry: string | null;
}

export interface EditorHost {
  map: L.Map;
  /** Everything on the map, so we can snap against neighbours. */
  shapes: () => EditableShape[];
  /** Called after a successful save so the caller can refresh. */
  onSaved: () => void | Promise<void>;
  panel: HTMLElement;
}

interface Selection {
  shape: EditableShape;
  pts: Point[];
  rect: Rect;
  /** True when the ring is a true rectangle, so numeric w/h are meaningful. */
  isRect: boolean;
}

export class MapEditor {
  private frame: Frame | null = null;
  private sel: Selection | null = null;
  private layer: L.LayerGroup;
  private handles: L.LayerGroup;
  private guides: L.LayerGroup;
  private gridM = 0.25;
  private snapOn = true;
  private dirty = false;

  constructor(private readonly host: EditorHost) {
    this.layer = L.layerGroup().addTo(host.map);
    this.handles = L.layerGroup().addTo(host.map);
    this.guides = L.layerGroup().addTo(host.map);
  }

  destroy(): void {
    this.layer.remove(); this.handles.remove(); this.guides.remove();
    mount(this.host.panel);
  }

  /** Anchor the metric frame near the shapes so numbers stay small. */
  private ensureFrame(): Frame {
    if (this.frame) return this.frame;
    const c = this.host.map.getCenter();
    this.frame = new Frame({ lat: c.lat, lon: c.lng });
    return this.frame;
  }

  select(shape: EditableShape): void {
    const ring = outerRing(shape.geometry ? JSON.parse(shape.geometry) : null);
    if (!ring) { toast(t('editor.notEditable'), 'warn'); return; }

    const frame = this.ensureFrame();
    const pts = frame.ringToLocal(ring);
    const rect = fitRect(pts);
    // Within 10 cm of its own best-fit rectangle: treat as a rectangle.
    const isRect = pts.length === 4
      && rectToPoints(rect).every((p, i) => Math.hypot(p.x - pts[i]!.x, p.y - pts[i]!.y) < 0.1);

    this.sel = { shape, pts, rect, isRect };
    this.dirty = false;
    this.redraw();
  }

  clear(): void {
    this.sel = null;
    this.layer.clearLayers(); this.handles.clearLayers(); this.guides.clearLayers();
    mount(this.host.panel);
  }

  // ------------------------------------------------------------- rendering

  private redraw(): void {
    const s = this.sel;
    this.layer.clearLayers(); this.handles.clearLayers();
    if (!s) return;
    const frame = this.ensureFrame();

    const latlngs = s.pts.map((p) => {
      const ll = frame.toLatLon(p);
      return [ll.lat, ll.lon] as [number, number];
    });

    L.polygon(latlngs, {
      color: '#0b6bcb', weight: 2.5, fillColor: '#0b6bcb', fillOpacity: 0.18, dashArray: '4 3',
    }).addTo(this.layer);

    // Corner handles resize; the centre handle moves the whole shape.
    s.pts.forEach((p, i) => this.addHandle(p, 'corner', i));
    this.addHandle(centroid(s.pts), 'move', -1);

    this.renderPanel();
  }

  private addHandle(p: Point, kind: 'corner' | 'move', index: number): void {
    const frame = this.ensureFrame();
    const ll = frame.toLatLon(p);
    const isMove = kind === 'move';

    const marker = L.marker([ll.lat, ll.lon], {
      draggable: true,
      icon: L.divIcon({
        className: 'edit-handle-wrap',
        html: `<span class="edit-handle ${isMove ? 'is-move' : ''}"></span>`,
        iconSize: [isMove ? 26 : 18, isMove ? 26 : 18],
        iconAnchor: [isMove ? 13 : 9, isMove ? 13 : 9],
      }),
    }).addTo(this.handles);

    let startPts: Point[] = [];
    let startPtr: Point = { x: 0, y: 0 };

    marker.on('dragstart', () => {
      startPts = this.sel ? [...this.sel.pts] : [];
      startPtr = p;
    });

    marker.on('drag', (e) => {
      if (!this.sel) return;
      const pos = (e.target as L.Marker).getLatLng();
      const cur = frame.toLocal({ lat: pos.lat, lon: pos.lng });

      if (isMove) {
        this.applyMove(startPts, cur.x - startPtr.x, cur.y - startPtr.y);
      } else {
        this.applyCornerResize(startPts, index, cur);
      }
    });

    marker.on('dragend', () => { this.redraw(); void this.save(); });
  }

  private applyMove(startPts: Point[], dx: number, dy: number): void {
    if (!this.sel) return;
    let moved = translate(startPts, dx, dy);

    if (this.snapOn) {
      const snap = snapBounds(bounds(moved), this.guideLines());
      if (snap.dx || snap.dy) moved = translate(moved, snap.dx, snap.dy);
      this.showGuides(snap.hitX, snap.hitY);
    }
    this.sel.pts = moved;
    this.sel.rect = fitRect(moved);
    this.previewOnly();
  }

  /** Drag a corner: the opposite corner stays put, which is what people expect. */
  private applyCornerResize(startPts: Point[], index: number, cur: Point): void {
    if (!this.sel) return;
    const b = bounds(startPts);
    const anchor: Point = {
      x: startPts[index]!.x > (b.minX + b.maxX) / 2 ? b.minX : b.maxX,
      y: startPts[index]!.y > (b.minY + b.maxY) / 2 ? b.minY : b.maxY,
    };
    const origin = startPts[index]!;
    const denomX = origin.x - anchor.x;
    const denomY = origin.y - anchor.y;
    if (Math.abs(denomX) < 0.01 || Math.abs(denomY) < 0.01) return;

    let sx = (cur.x - anchor.x) / denomX;
    let sy = (cur.y - anchor.y) / denomY;

    if (this.snapOn && this.gridM > 0) {
      const w = snapToGrid(Math.abs(denomX * sx), this.gridM);
      const h = snapToGrid(Math.abs(denomY * sy), this.gridM);
      sx = Math.sign(sx) * (w / Math.abs(denomX));
      sy = Math.sign(sy) * (h / Math.abs(denomY));
    }
    // Never let a shape collapse or turn inside out.
    if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx <= 0.02 || sy <= 0.02) return;

    const next = scaleAbout(startPts, anchor, sx, sy);
    this.sel.pts = next;
    this.sel.rect = fitRect(next);
    this.previewOnly();
  }

  /** Redraw the outline during a drag without rebuilding handles under the finger. */
  private previewOnly(): void {
    const s = this.sel;
    if (!s) return;
    const frame = this.ensureFrame();
    this.layer.clearLayers();
    L.polygon(s.pts.map((p) => {
      const ll = frame.toLatLon(p);
      return [ll.lat, ll.lon] as [number, number];
    }), {
      color: '#0b6bcb', weight: 2.5, fillColor: '#0b6bcb', fillOpacity: 0.18, dashArray: '4 3',
    }).addTo(this.layer);
    this.dirty = true;
    this.renderPanel();
  }

  // -------------------------------------------------------------- snapping

  /** Edges and centres of every other shape, as candidate alignment lines. */
  private guideLines(): { xs: number[]; ys: number[] } {
    const frame = this.ensureFrame();
    const xs: number[] = [], ys: number[] = [];
    for (const other of this.host.shapes()) {
      if (this.sel && other.id === this.sel.shape.id) continue;
      const ring = outerRing(other.geometry ? JSON.parse(other.geometry) : null);
      if (!ring) continue;
      const b = bounds(frame.ringToLocal(ring));
      xs.push(b.minX, (b.minX + b.maxX) / 2, b.maxX);
      ys.push(b.minY, (b.minY + b.maxY) / 2, b.maxY);
    }
    return { xs, ys };
  }

  private showGuides(hitX: number | null, hitY: number | null): void {
    this.guides.clearLayers();
    if (!this.snapOn) return;
    const frame = this.ensureFrame();
    const span = 400; // metres of guide line either way

    if (hitX !== null) {
      const a = frame.toLatLon({ x: hitX, y: -span });
      const b = frame.toLatLon({ x: hitX, y: span });
      L.polyline([[a.lat, a.lon], [b.lat, b.lon]],
        { color: '#e11d48', weight: 1, dashArray: '3 4', interactive: false }).addTo(this.guides);
    }
    if (hitY !== null) {
      const a = frame.toLatLon({ x: -span, y: hitY });
      const b = frame.toLatLon({ x: span, y: hitY });
      L.polyline([[a.lat, a.lon], [b.lat, b.lon]],
        { color: '#e11d48', weight: 1, dashArray: '3 4', interactive: false }).addTo(this.guides);
    }
  }

  // ------------------------------------------------------- numeric editing

  private renderPanel(): void {
    const s = this.sel;
    if (!s) { mount(this.host.panel); return; }

    const r = s.rect;
    const a = area(s.pts);
    const num = (v: number, step = '0.05') =>
      el('input', { type: 'number', step, value: v.toFixed(2), inputmode: 'decimal' }) as HTMLInputElement;

    const w = num(r.width);
    const h = num(r.height);
    const rot = num(r.rotation, '0.5');
    const offX = num(0);
    const offY = num(0);

    mount(this.host.panel,
      el('div', { class: 'editor-panel' },
        el('div', { class: 'editor-head' },
          el('strong', {}, s.shape.name),
          el('span', { class: 'chip' }, t(`editor.kind.${s.shape.table}`)),
          el('span', { class: 'muted' }, `${fmt.num(a, 1)} m²`),
          el('button', { class: 'icon-btn', title: t('common.close'), onclick: () => this.clear() },
            icon('x', 16)),
        ),

        // Exact dimensions. A finger cannot draw a 0.75 m bed; a keyboard can.
        el('div', { class: 'editor-grid' },
          field(t('editor.width'), w),
          field(t('editor.height'), h),
          field(t('editor.rotation'), rot),
        ),
        el('button', {
          class: 'btn btn-sm btn-block',
          onclick: () => this.applyRect(Number(w.value), Number(h.value), Number(rot.value)),
        }, icon('check', 14), t('editor.applySize')),

        // Relative nudge, the thing you actually want on a phone.
        el('div', { class: 'editor-sub' }, t('editor.nudge')),
        el('div', { class: 'editor-grid' },
          field(t('editor.east'), offX),
          field(t('editor.north'), offY),
        ),
        el('button', {
          class: 'btn btn-sm btn-block',
          onclick: () => this.nudge(Number(offX.value), Number(offY.value)),
        }, icon('arrow-right', 14), t('editor.applyMove')),

        el('div', { class: 'nudge-pad' },
          padBtn('caret-up', () => this.nudge(0, this.gridM)),
          padBtn('caret-down', () => this.nudge(0, -this.gridM)),
          padBtn('caret-left', () => this.nudge(-this.gridM, 0)),
          padBtn('caret-right', () => this.nudge(this.gridM, 0)),
        ),

        // Align to a neighbour — the "all beds start at the same x" request.
        el('div', { class: 'editor-sub' }, t('editor.align')),
        el('div', { class: 'row', style: 'flex-wrap:wrap;gap:.3rem' },
          alignBtn(t('editor.alignLeft'), () => this.align('minX')),
          alignBtn(t('editor.alignRight'), () => this.align('maxX')),
          alignBtn(t('editor.alignTop'), () => this.align('maxY')),
          alignBtn(t('editor.alignBottom'), () => this.align('minY')),
        ),

        el('label', { class: 'row-between editor-toggle' },
          el('span', {}, t('editor.snap', { grid: this.gridM })),
          (() => {
            const cb = el('input', { type: 'checkbox', checked: this.snapOn }) as HTMLInputElement;
            cb.addEventListener('change', () => { this.snapOn = cb.checked; this.guides.clearLayers(); });
            return cb;
          })(),
        ),

        this.dirty && el('div', { class: 'banner banner-offline' }, t('editor.unsaved')),
        el('div', { class: 'row', style: 'gap:.4rem' },
          el('button', { class: 'btn btn-primary', style: 'flex:1', onclick: () => void this.save() },
            icon('floppy', 14), t('common.save')),
          el('button', { class: 'btn', onclick: () => this.makeRectangle() },
            icon('polygon', 14), t('editor.makeRect')),
        ),
      ),
    );

    function field(label: string, input: HTMLInputElement): HTMLElement {
      return el('div', { class: 'field field-tight' }, el('label', {}, label), input);
    }
    function padBtn(ic: string, onclick: () => void): HTMLElement {
      return el('button', { class: `pad-btn pad-${ic}`, onclick }, icon(ic, 16));
    }
    function alignBtn(label: string, onclick: () => void): HTMLElement {
      return el('button', { class: 'btn btn-sm', onclick }, label);
    }
  }

  private applyRect(width: number, height: number, rotation: number): void {
    if (!this.sel || !(width > 0) || !(height > 0)) return;
    const c = centroid(this.sel.pts);
    const rect: Rect = { cx: c.x, cy: c.y, width, height, rotation };
    this.sel.pts = rectToPoints(rect);
    this.sel.rect = rect;
    this.sel.isRect = true;
    this.redraw();
    void this.save();
  }

  /** Replace a hand-drawn ring with its best-fit rectangle. */
  private makeRectangle(): void {
    if (!this.sel) return;
    const r = this.sel.rect;
    this.sel.pts = rectToPoints({
      ...r,
      width: snapToGrid(r.width, this.gridM),
      height: snapToGrid(r.height, this.gridM),
    });
    this.sel.isRect = true;
    this.redraw();
    void this.save();
    toast(t('editor.madeRect'));
  }

  private nudge(east: number, north: number): void {
    if (!this.sel || (!east && !north)) return;
    this.sel.pts = translate(this.sel.pts, east, north);
    this.sel.rect = fitRect(this.sel.pts);
    this.redraw();
    void this.save();
  }

  /** Align this shape's edge to the nearest matching edge of another shape. */
  private align(edge: 'minX' | 'maxX' | 'minY' | 'maxY'): void {
    if (!this.sel) return;
    const b = bounds(this.sel.pts);
    const g = this.guideLines();
    const candidates = edge.endsWith('X') ? g.xs : g.ys;
    if (candidates.length === 0) { toast(t('editor.noNeighbour'), 'warn'); return; }

    const current = b[edge];
    let best = candidates[0]!;
    for (const c of candidates) if (Math.abs(c - current) < Math.abs(best - current)) best = c;

    const delta = best - current;
    this.sel.pts = edge.endsWith('X')
      ? translate(this.sel.pts, delta, 0)
      : translate(this.sel.pts, 0, delta);
    this.sel.rect = fitRect(this.sel.pts);
    this.redraw();
    void this.save();
  }

  // ------------------------------------------------------------------ save

  private async save(): Promise<void> {
    const s = this.sel;
    if (!s) return;
    const frame = this.ensureFrame();
    const geometry = polygon(frame.ringToLonLat(s.pts));
    try {
      await post('/api/land/geometry', { table: s.shape.table, id: s.shape.id, geometry });
      s.shape.geometry = JSON.stringify(geometry);
      this.dirty = false;
      this.renderPanel();
      await this.host.onSaved();
    } catch {
      toast(t('common.error'), 'error');
    }
  }

  /** Hit-test in local metres so taps land on the shape under the finger. */
  hitTest(latlng: L.LatLng): EditableShape | null {
    const frame = this.ensureFrame();
    const pt = frame.toLocal({ lat: latlng.lat, lon: latlng.lng });
    // Smallest shape wins, so a bed inside a field is selectable.
    let hit: EditableShape | null = null;
    let smallest = Infinity;
    for (const shape of this.host.shapes()) {
      const ring = outerRing(shape.geometry ? JSON.parse(shape.geometry) : null);
      if (!ring) continue;
      const pts = frame.ringToLocal(ring);
      if (!pointInRing(pt, pts)) continue;
      const a = area(pts);
      if (a < smallest) { smallest = a; hit = shape; }
    }
    return hit;
  }

  get selected(): EditableShape | null { return this.sel?.shape ?? null; }
  setGrid(m: number): void { this.gridM = m; this.renderPanel(); }
}
