import L from 'leaflet';
import { el, mount, sheet, toast, spinner } from '../lib/ui.js';
import { icon, iconMarkup } from '../lib/icon.js';
import { t, fmt } from '../lib/i18n.js';
import { get, post, del, auth } from '../lib/api.js';
import { can } from '../lib/session.js';
import { openBedDetail } from './bed-detail.js';
import { MapEditor, type EditableShape } from './map-editor.js';
import { createSearcher, type Place } from '../lib/geosearch.js';
import {
  captureSnapshot, chooseZoom, saveSnapshot, loadSnapshot, downloadSnapshot,
  type SnapshotBounds,
} from '../lib/snapshot.js';
import { suggestFields } from '../lib/suggest-fields.js';

/**
 * THE MAP — the main working view (docs/61 F2).
 *
 * A real base map with the farm's own shapes drawn on top: fields, beds, sheds,
 * water points, paths. What is growing and what needs doing are overlaid, so a
 * gardener opens the app and sees the actual state of the ground.
 */

interface MapData {
  settings: { centreLat: number | null; centreLon: number | null; zoom: number; baseLayer: BaseLayer };
  fields: Array<{ id: string; name: string; geometry: string | null; area_sqm: number | null }>;
  beds: Array<{ id: string; name: string; field_id: string; geometry: string | null; area_sqm: number | null }>;
  features: Array<{ id: string; name: string; kind: string; geometry: string | null; note: string | null }>;
  plantings: Array<{
    bed_id: string; crop_name: string; phase: string;
    variety: string | null; harvest_from: string | null;
  }>;
  tasks: Array<{ id: string; title: string; bed_id: string | null; urgency: string; activity: string | null }>;
  date: string;
}

type BaseLayer = 'osm' | 'satellite';
type DrawMode = null | { target: 'field' | 'bed' | 'feature'; kind?: string; shape?: 'poly' | 'rect' };

/**
 * `maxNativeZoom` is the deepest zoom the tile server actually has; `maxZoom`
 * is how far Leaflet will let you go, upscaling the last real tile beyond it.
 * Without this the map stopped at z19, which is far too coarse to place a
 * 0.75 m bed — you need to see individual plants.
 */
const MAX_ZOOM = 24;

const LAYERS: Record<BaseLayer, { url: string; attribution: string; maxNativeZoom: number }> = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
    maxNativeZoom: 19,
  },
  // Esri World Imagery: usable without an API key, unlike Mapbox or Google.
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    maxNativeZoom: 19,
  },
};

const PHASE_COLOUR: Record<string, string> = {
  harvestable: '#b45309',
  growing: '#2a8348',
  finished: '#94a3b8',
};
const FREE_COLOUR = '#94a3b8';

const FEATURE_STYLE: Record<string, { colour: string; icon: string }> = {
  shed: { colour: '#6b4f3a', icon: 'barn' },
  storage: { colour: '#6b4f3a', icon: 'package' },
  greenhouse: { colour: '#0891b2', icon: 'house' },
  water: { colour: '#0284c7', icon: 'drop' },
  compost: { colour: '#65a30d', icon: 'stack' },
  path: { colour: '#a8a29e', icon: 'path' },
  hedge: { colour: '#15803d', icon: 'tree' },
  parking: { colour: '#64748b', icon: 'crosshair' },
  depot: { colour: '#7c3aed', icon: 'package' },
  other: { colour: '#64748b', icon: 'polygon' },
};

export function renderMap(root: HTMLElement): void {
  const mapEl = el('div', { class: 'mapview', id: 'solawi-map' });
  const editorPanel = el('div', { class: 'editor-dock' });
  const edgeMarkers = el('div', { class: 'edge-markers' });
  const overlay = el('div', { class: 'map-overlay' });
  const legend = el('div', { class: 'map-legend' });
  mount(root, el('div', { class: 'map-wrap' }, mapEl, overlay, legend, editorPanel, edgeMarkers));

  let map: L.Map | null = null;
  let baseTile: L.TileLayer | null = null;
  let shapes: L.LayerGroup | null = null;
  let drawMode: DrawMode = null;
  let drawPoints: L.LatLng[] = [];
  let drawLine: L.Polyline | null = null;
  let data: MapData | null = null;
  let dateOffset = 0;
  let editor: MapEditor | null = null;
  let editing = false;
  /** Rectangle drawing: two opposite corners instead of tracing an outline. */
  let rectStart: L.LatLng | null = null;
  let rectPreview: L.Rectangle | null = null;


  void boot();

  async function boot(): Promise<void> {
    mount(overlay, spinner());
    try {
      data = (await get<MapData>('/api/land/map')).data;
    } catch {
      mount(overlay, el('div', { class: 'banner banner-error' }, t('common.error')));
      return;
    }

    const s = data.settings;
    // No saved centre yet: fall back to the device, then to a wide view of
    // German-speaking Europe rather than the Atlantic.
    const centre: [number, number] = s.centreLat && s.centreLon
      ? [s.centreLat, s.centreLon] : [50.9, 9.5];
    const zoom = s.centreLat ? s.zoom : 6;

    map = L.map(mapEl, {
      zoomControl: false, attributionControl: true,
      maxZoom: MAX_ZOOM,
      zoomSnap: 0.5,      // finer steps when placing small shapes
      wheelPxPerZoomLevel: 90,
    }).setView(centre, zoom);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    setBase(s.baseLayer ?? 'osm');
    shapes = L.layerGroup().addTo(map);

    map.on('moveend zoomend', renderEdgeMarkers);
    map.on('click', onMapClick);
    map.on('dblclick', finishShape);
    map.on('mousemove', onMouseMove);
    map.doubleClickZoom.disable();

    editor = new MapEditor({
      map,
      shapes: editableShapes,
      onSaved: async () => { await refresh(); },
      panel: editorPanel,
    });

    draw();
    renderControls();

    if (!s.centreLat && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => map?.setView([p.coords.latitude, p.coords.longitude], 17),
        () => {}, { timeout: 8000 },
      );
    }
  }

  /** Fields, beds and features together — the editor treats them alike. */
  function editableShapes(): EditableShape[] {
    if (!data) return [];
    return [
      ...data.fields.map((f) => ({ id: f.id, table: 'field' as const, name: f.name, geometry: f.geometry })),
      ...data.beds.map((b) => ({ id: b.id, table: 'bed' as const, name: b.name, geometry: b.geometry })),
      ...data.features.map((f) => ({ id: f.id, table: 'feature' as const, name: f.name, geometry: f.geometry })),
    ];
  }

  function setBase(kind: BaseLayer): void {
    if (!map) return;
    if (baseTile) map.removeLayer(baseTile);
    const cfg = LAYERS[kind] ?? LAYERS.osm;
    baseTile = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxNativeZoom: cfg.maxNativeZoom,
      maxZoom: MAX_ZOOM,
    }).addTo(map);
    baseTile.bringToBack();
  }

  // -------------------------------------------------------------- rendering

  function draw(): void {
    if (!map || !shapes || !data) return;
    shapes.clearLayers();

    const plantingByBed = new Map(data.plantings.map((p) => [p.bed_id, p]));
    const taskCount = new Map<string, number>();
    for (const task of data.tasks) {
      if (task.bed_id) taskCount.set(task.bed_id, (taskCount.get(task.bed_id) ?? 0) + 1);
    }

    // Fields sit underneath as context outlines.
    for (const f of data.fields) {
      const geo = parse(f.geometry);
      if (!geo) continue;
      const fieldLayer = L.geoJSON(geo as never, {
        style: { color: '#1f6b3a', weight: 2, fillOpacity: 0.04, dashArray: '6 4' },
      }).bindTooltip(f.name, { sticky: true }).addTo(shapes);
      fieldLayer.on('click', (e) => {
        if (!editing || !editor) return;
        L.DomEvent.stop(e);
        editor.select({ id: f.id, table: 'field', name: f.name, geometry: f.geometry });
      });
    }

    for (const bed of data.beds) {
      const geo = parse(bed.geometry);
      if (!geo) continue;
      const planting = plantingByBed.get(bed.id);
      const colour = planting ? (PHASE_COLOUR[planting.phase] ?? PHASE_COLOUR.growing!) : FREE_COLOUR;
      const tasks = taskCount.get(bed.id) ?? 0;

      const layer = L.geoJSON(geo as never, {
        style: {
          color: colour, weight: tasks > 0 ? 3 : 1.5,
          fillColor: colour, fillOpacity: planting ? 0.45 : 0.12,
        },
      }).addTo(shapes);

      const label = planting ? planting.crop_name : t('field.free');
      layer.bindTooltip(
        `<strong>${escapeHtml(bed.name)}</strong><br>${escapeHtml(label)}` +
        (tasks > 0 ? `<br>${tasks} ${t('map.openTasks')}` : ''),
        { sticky: true },
      );
      layer.on('click', (e) => {
        L.DomEvent.stop(e);
        if (drawMode) return;
        if (editing && editor) {
          editor.select({ id: bed.id, table: 'bed', name: bed.name, geometry: bed.geometry });
          return;
        }
        openBedDetail(bed, planting ?? null, () => void refresh());
      });

      // A small badge marks beds with work outstanding, so the map answers
      // "what needs doing today" at a glance.
      if (tasks > 0) {
        const c = centroid(geo);
        if (c) {
          L.marker(c, {
            icon: L.divIcon({
              className: 'task-badge-wrap',
              html: `<span class="task-badge">${tasks}</span>`,
              iconSize: [22, 22],
            }),
          }).addTo(shapes).on('click', () => openBedDetail(bed, planting ?? null, () => void refresh()));
        }
      }
    }

    for (const f of data.features) {
      const geo = parse(f.geometry);
      if (!geo) continue;
      const style = FEATURE_STYLE[f.kind] ?? FEATURE_STYLE.other!;

      if (geo.type === 'Point') {
        const [lon, lat] = geo.coordinates as [number, number];
        L.marker([lat, lon], {
          icon: L.divIcon({
            className: 'feature-pin-wrap',
            html: `<span class="feature-pin" style="background:${style.colour}">${icon(style.icon, 14)}</span>`,
            iconSize: [28, 28], iconAnchor: [14, 14],
          }),
        }).bindTooltip(f.name).addTo(shapes).on('click', () => {
          if (editing && editor) {
            editor.select({ id: f.id, table: 'feature', name: f.name, geometry: f.geometry });
          } else featureSheet(f);
        });
      } else {
        L.geoJSON(geo as never, {
          style: { color: style.colour, weight: 3, fillOpacity: 0.25, fillColor: style.colour },
        }).bindTooltip(f.name).addTo(shapes).on('click', () => {
          if (editing && editor) {
            editor.select({ id: f.id, table: 'feature', name: f.name, geometry: f.geometry });
          } else featureSheet(f);
        });
      }
    }

    renderLegend();
    renderEdgeMarkers();
  }

  /**
   * #4: shapes needing attention that are OFF SCREEN.
   *
   * A farm with plots in three villages cannot see them all at once, so a task
   * on a distant field would otherwise be invisible. We clamp a marker to the
   * edge of the viewport in the direction of the work, with the distance.
   */
  function renderEdgeMarkers(): void {
    if (!map || !data) { mount(edgeMarkers); return; }
    const view = map.getBounds();
    const centre = map.getCenter();

    const needing = new Map<string, { lat: number; lon: number; name: string; count: number }>();
    for (const task of data.tasks) {
      if (!task.bed_id) continue;
      const bed = data.beds.find((b) => b.id === task.bed_id);
      const geo = bed ? parse(bed.geometry) : null;
      const c = geo ? centroid(geo) : null;
      if (!bed || !c) continue;
      const hit = needing.get(bed.id);
      if (hit) hit.count++;
      else needing.set(bed.id, { lat: c[0], lon: c[1], name: bed.name, count: 1 });
    }

    const offscreen = [...needing.values()].filter((n) => !view.contains([n.lat, n.lon]));
    if (offscreen.length === 0) { mount(edgeMarkers); return; }

    const rect = mapEl.getBoundingClientRect();
    mount(edgeMarkers, ...offscreen.slice(0, 6).map((n) => {
      // Direction from the centre, clamped to the viewport edge.
      const p = map!.latLngToContainerPoint([n.lat, n.lon]);
      const cx = rect.width / 2, cy = rect.height / 2;
      const dx = p.x - cx, dy = p.y - cy;
      const pad = 34;
      const scale = Math.min(
        (cx - pad) / Math.max(1, Math.abs(dx)),
        (cy - pad) / Math.max(1, Math.abs(dy)),
      );
      const x = cx + dx * scale, y = cy + dy * scale;
      const km = centre.distanceTo(L.latLng(n.lat, n.lon)) / 1000;

      return el('button', {
        class: 'edge-marker',
        style: `left:${x}px;top:${y}px`,
        title: `${n.name} — ${n.count}`,
        onclick: () => map!.setView([n.lat, n.lon], Math.max(map!.getZoom(), 17)),
      },
        el('span', { class: 'edge-count' }, String(n.count)),
        el('span', { class: 'edge-dist' }, km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`),
      );
    }));
  }

  function renderLegend(): void {
    if (!data) return;
    const kinds = [...new Set(data.features.map((f) => f.kind))];
    mount(legend,
      el('div', { class: 'legend-row' },
        swatch(PHASE_COLOUR.growing!), el('span', {}, t('field.phase.growing')),
        swatch(PHASE_COLOUR.harvestable!), el('span', {}, t('field.phase.harvestable')),
        swatch(FREE_COLOUR), el('span', {}, t('field.free')),
      ),
      kinds.length > 0 && el('div', { class: 'legend-row' },
        ...kinds.flatMap((k) => [
          swatch((FEATURE_STYLE[k] ?? FEATURE_STYLE.other!).colour),
          el('span', {}, t(`feature.${k}`)),
        ]),
      ),
    );
  }

  const swatch = (c: string) => el('span', { class: 'legend-dot', style: `background:${c}` });

  // --------------------------------------------------------------- controls

  function renderControls(): void {
    if (!data) return;
    const d = new Date(); d.setDate(d.getDate() + dateOffset);

    mount(overlay,
      el('div', { class: 'map-bar' },
        el('div', { class: 'seg' },
          ...(['osm', 'satellite'] as BaseLayer[]).map((k) =>
            el('button', {
              class: `seg-btn ${data!.settings.baseLayer === k ? 'on' : ''}`,
              title: t(`map.layer.${k}`),
              onclick: () => {
                data!.settings.baseLayer = k;
                setBase(k);
                renderControls();
                if (can('grower')) void post('/api/land/map/settings', { baseLayer: k }).catch(() => {});
              },
            }, icon(k === 'satellite' ? 'globe' : 'map', 16),
               el('span', { class: 'seg-label' }, t(`map.layer.${k}`))),
          ),
        ),

        searchBox(),

        el('div', { class: 'map-date' },
          el('button', {
            class: 'icon-btn', title: t('map.prevDay'),
            onclick: () => { dateOffset--; void refresh(); },
          }, icon('caret-left', 16)),
          el('span', { class: 'map-date-label' },
            dateOffset === 0 ? t('field.today') : fmt.dayShort(d)),
          el('button', {
            class: 'icon-btn', title: t('map.nextDay'),
            onclick: () => { dateOffset++; void refresh(); },
          }, icon('caret-right', 16)),
          dateOffset !== 0 && el('button', {
            class: 'icon-btn', title: t('field.today'),
            onclick: () => { dateOffset = 0; void refresh(); },
          }, icon('arrow-counter', 16)),
        ),
      ),

      can('grower') && el('div', { class: 'map-tools' },
        drawMode
          ? el('div', { class: 'draw-hint' },
              el('span', {}, drawMode.shape === 'rect'
                ? (rectStart ? t('map.rectSecondCorner') : t('map.rectFirstCorner'))
                : t('map.drawHint')),
              drawMode.shape !== 'rect' && el('button', { class: 'btn btn-sm', onclick: finishShape },
                icon('check', 14), t('map.finish')),
              el('button', { class: 'btn btn-sm', onclick: cancelDraw }, icon('x', 14), t('common.cancel')),
            )
          : el('div', { class: 'tool-row' },
              // Editor mode is a deliberate switch: outside it, nothing moves.
              el('button', {
                class: `tool-btn ${editing ? 'on' : ''}`,
                title: t('editor.mode'),
                onclick: toggleEditor,
              }, icon(editing ? 'check' : 'pencil', 18), el('span', {}, t('editor.mode'))),

              editing && toolBtn('polygon', t('map.drawFieldRect'),
                () => startDraw({ target: 'field', shape: 'rect' })),
              editing && toolBtn('stack-plus', t('map.drawBedRect'),
                () => startDraw({ target: 'bed', shape: 'rect' })),
              editing && toolBtn('path', t('map.drawFree'),
                () => startDraw({ target: 'bed', shape: 'poly' })),
              editing && toolBtn('barn', t('map.drawFeature'), featureKindSheet),
              editing && toolBtn('crosshair', t('map.setCentre'), saveCentre),
              toolBtn('floppy', t('map.capture'), () => void captureArea()),
            ),
      ),
    );
  }

  function toggleEditor(): void {
    editing = !editing;
    if (!editing) { editor?.clear(); cancelDraw(); }
    else toast(t('editor.entered'), 'warn');
    renderControls();
    draw();
  }

  /** #6: find the farm instead of panning from a world view. */
  function searchBox(): HTMLElement {
    const input = el('input', {
      type: 'search', class: 'map-search-input',
      placeholder: t('map.searchPlaceholder'), 'aria-label': t('map.searchPlaceholder'),
    }) as HTMLInputElement;
    const results = el('div', { class: 'map-search-results' });

    const search = createSearcher((places, error) => {
      if (error) { mount(results, el('div', { class: 'search-empty' }, t('map.searchFailed'))); return; }
      if (places.length === 0) { mount(results); return; }
      mount(results, ...places.map((pl: Place) => el('button', {
        class: 'search-hit',
        onclick: () => {
          if (!map) return;
          if (pl.bounds) {
            map.fitBounds([[pl.bounds.south, pl.bounds.west], [pl.bounds.north, pl.bounds.east]]);
          } else {
            map.setView([pl.lat, pl.lon], 17);
          }
          input.value = ''; mount(results);
          toast(t('map.searchThenCapture'), 'warn');
        },
      }, pl.label)));
    });

    input.addEventListener('input', () => search(input.value));
    input.addEventListener('blur', () => setTimeout(() => mount(results), 200));
    return el('div', { class: 'map-search' }, input, results);
  }

  /**
   * #3 + #6: store the current view as one geo-referenced image.
   *
   * The bounds are saved with the pixels, so the snapshot can be re-projected
   * at any zoom without the shapes drifting off it.
   */
  async function captureArea(): Promise<void> {
    if (!map || !data) return;
    const b = map.getBounds();
    const bounds = {
      north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest(),
    };
    const zoom = chooseZoom(bounds);
    const cfg = LAYERS[data.settings.baseLayer] ?? LAYERS.osm;

    const status = el('div', { class: 'banner banner-offline' }, t('map.capturing', { done: 0, total: '…' }));
    const body = el('div', {}, status,
      el('p', { class: 'hint' }, t('map.captureHint', { zoom })));
    const close = sheet(t('map.capture'), body);

    try {
      const snap = await captureSnapshot(bounds, cfg.url, {
        zoom,
        onProgress: (pr) => {
          status.textContent = t('map.capturing', { done: pr.done, total: pr.total });
        },
      });
      await saveSnapshot(auth.org ?? 'default', snap);
      await post('/api/land/map/settings', {
        snapshotBounds: JSON.stringify(bounds),
        centreLat: (bounds.north + bounds.south) / 2,
        centreLon: (bounds.east + bounds.west) / 2,
        zoom: map.getZoom(),
        baseLayer: data.settings.baseLayer,
      }).catch(() => {});

      mount(body,
        el('div', { class: 'banner banner-ok' },
          t('map.captured', { mb: (snap.bytes / 1048576).toFixed(2), zoom: snap.zoom })),
        el('button', {
          class: 'btn btn-block', onclick: () => downloadSnapshot(snap, data!.settings.baseLayer),
        }, icon('floppy', 16), t('map.download')),
        can('grower') && el('button', {
          class: 'btn btn-primary btn-block', style: 'margin-top:.4rem',
          onclick: () => { close(); void proposeFields(snap.blob, snap.bounds); },
        }, icon('magnifying', 16), t('map.suggestFields')),
      );
    } catch {
      mount(body, el('div', { class: 'banner banner-error' }, t('map.captureFailed')));
    }
  }

  /** #7: propose outlines from the imagery, accepted one at a time. */
  async function proposeFields(blob: Blob, bounds: SnapshotBounds): Promise<void> {
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await new Promise((r) => { img.onload = r; });

    const found = await suggestFields(img, bounds);
    URL.revokeObjectURL(img.src);
    if (found.length === 0) { toast(t('map.noSuggestions'), 'warn'); return; }

    let index = 0;
    let preview: L.Polygon | null = null;
    const body = el('div', {});
    const close = sheet(t('map.suggestFields'), body);

    const show = (): void => {
      preview?.remove();
      if (index >= found.length) {
        mount(body, el('p', { class: 'muted' }, t('map.suggestionsDone')));
        setTimeout(close, 900);
        void refresh();
        return;
      }
      const sug = found[index]!;
      preview = L.polygon(sug.ring.map((c: [number, number]) => [c[1], c[0]] as [number, number]), {
        color: '#7c3aed', weight: 3, dashArray: '6 4', fillOpacity: 0.2,
      }).addTo(map!);
      map!.fitBounds(preview.getBounds(), { padding: [40, 40] });

      mount(body,
        el('p', {}, t('map.suggestionOf', { n: index + 1, total: found.length })),
        el('p', { class: 'muted' },
          `${fmt.num(sug.areaSqm / 10000, 2)} ha · ${Math.round(sug.confidence * 100)}%`),
        el('p', { class: 'hint' }, t('map.suggestHint')),
        el('div', { class: 'row', style: 'gap:.5rem;margin-top:.6rem' },
          el('button', {
            class: 'btn btn-primary', style: 'flex:1',
            onclick: async () => {
              const name = prompt(t('map.fieldName'));
              if (name) {
                await post('/api/land/fields', {
                  name, geometry: { type: 'Polygon', coordinates: [[...sug.ring, sug.ring[0]!]] },
                });
              }
              index++; show();
            },
          }, icon('check', 16), t('common.confirm')),
          el('button', {
            class: 'btn', style: 'flex:1', onclick: () => { index++; show(); },
          }, icon('x', 16), t('map.reject')),
        ),
      );
    };
    show();
  }

  const toolBtn = (ic: string, label: string, onclick: () => void) =>
    el('button', { class: 'tool-btn', onclick, title: label }, icon(ic, 18), el('span', {}, label));

  // ---------------------------------------------------------------- drawing

  function startDraw(mode: DrawMode): void {
    drawMode = mode;
    drawPoints = [];
    if (drawLine) { drawLine.remove(); drawLine = null; }
    renderControls();
    toast(t('map.drawHint'), 'warn');
  }

  function cancelDraw(): void {
    drawMode = null;
    drawPoints = [];
    rectStart = null;
    if (drawLine) { drawLine.remove(); drawLine = null; }
    rectPreview?.remove(); rectPreview = null;
    renderControls();
  }

  function onMapClick(e: L.LeafletMouseEvent): void {
    // Rectangle mode: first tap sets a corner, second completes it.
    if (drawMode?.shape === 'rect') {
      if (!rectStart) {
        rectStart = e.latlng;
        toast(t('map.rectSecondCorner'), 'warn');
        return;
      }
      void finishRect(rectStart, e.latlng);
      return;
    }

    if (drawMode) {
      if (!map) return;
      drawPoints.push(e.latlng);
      if (drawLine) drawLine.remove();
      drawLine = L.polyline([...drawPoints, drawPoints[0]!], {
        color: '#1f6b3a', weight: 3, dashArray: '5 5',
      }).addTo(map);
      return;
    }

    // Editor mode: tapping bare map selects whatever is underneath, or clears.
    if (editing && editor) {
      const hit = editor.hitTest(e.latlng);
      if (hit) editor.select(hit); else editor.clear();
    }
  }

  /** Live preview while the second rectangle corner is being chosen. */
  function onMouseMove(e: L.LeafletMouseEvent): void {
    if (drawMode?.shape !== 'rect' || !rectStart || !map) return;
    rectPreview?.remove();
    rectPreview = L.rectangle(L.latLngBounds(rectStart, e.latlng), {
      color: '#1f6b3a', weight: 2, dashArray: '4 4', fillOpacity: 0.1,
    }).addTo(map);
  }

  async function finishRect(a: L.LatLng, b: L.LatLng): Promise<void> {
    rectPreview?.remove(); rectPreview = null;
    rectStart = null;
    const mode = drawMode;
    cancelDraw();
    if (!mode) return;

    // Axis-aligned from two opposite corners; rotate later in the editor.
    const ring: Array<[number, number]> = [
      [a.lng, a.lat], [b.lng, a.lat], [b.lng, b.lat], [a.lng, b.lat], [a.lng, a.lat],
    ];
    const geometry = { type: 'Polygon', coordinates: [ring] };
    await createShape(mode, geometry);
  }

  async function createShape(mode: NonNullable<DrawMode>, geometry: unknown): Promise<void> {
    if (mode.target === 'field') {
      const name = prompt(t('map.fieldName'));
      if (!name) return;
      await post('/api/land/fields', { name, geometry });
    } else if (mode.target === 'bed') {
      if (!data?.fields.length) { toast(t('map.fieldFirst'), 'error'); return; }
      const name = prompt(t('map.bedName'));
      if (!name) return;
      await post('/api/land/beds', { fieldId: data.fields[0]!.id, name, geometry });
    } else {
      const name = prompt(t('map.featureName'));
      if (!name) return;
      await post('/api/land/features', { kind: mode.kind ?? 'other', name, geometry });
    }
    toast(t('obs.saved'));
    await refresh();
  }

  async function finishShape(): Promise<void> {
    if (!drawMode || drawPoints.length < 3) {
      if (drawMode) toast(t('map.needThreePoints'), 'warn');
      return;
    }
    const ring = drawPoints.map((p) => [p.lng, p.lat] as [number, number]);
    ring.push(ring[0]!);
    const mode = drawMode;
    cancelDraw();
    await createShape(mode, { type: 'Polygon', coordinates: [ring] });
  }

  function featureKindSheet(): void {
    const kinds = Object.keys(FEATURE_STYLE);
    const body = el('div', { class: 'kind-grid' },
      ...kinds.map((k) => el('button', {
        class: 'kind-btn',
        onclick: () => { close(); startDraw({ target: 'feature', kind: k }); },
      },
        el('span', { class: 'kind-dot', style: `background:${FEATURE_STYLE[k]!.colour}`, html: iconMarkup(FEATURE_STYLE[k]!.icon, 18) }),
        el('span', {}, t(`feature.${k}`)),
      )),
    );
    const close = sheet(t('map.drawFeature'), body);
  }

  function featureSheet(f: { id: string; name: string; kind: string; note: string | null }): void {
    const body = el('div', {},
      el('p', { class: 'muted' }, t(`feature.${f.kind}`)),
      f.note && el('p', {}, f.note),
      can('grower') && el('button', {
        class: 'btn btn-danger btn-block',
        onclick: async () => {
          await del(`/api/land/features/${f.id}`);
          close(); toast(t('obs.saved')); await refresh();
        },
      }, icon('trash', 16), t('common.delete')),
    );
    const close = sheet(f.name, body);
  }

  async function saveCentre(): Promise<void> {
    if (!map) return;
    const c = map.getCenter();
    await post('/api/land/map/settings', {
      centreLat: c.lat, centreLon: c.lng, zoom: map.getZoom(),
      baseLayer: data?.settings.baseLayer ?? 'osm',
    });
    toast(t('map.centreSaved'));
  }

  async function refresh(): Promise<void> {
    const d = new Date(); d.setDate(d.getDate() + dateOffset);
    const iso = d.toISOString().slice(0, 10);
    try {
      data = (await get<MapData>(`/api/land/map?date=${iso}`)).data;
      draw();
      renderControls();
    } catch { /* keep the last good view */ }
  }
}

type Geo = { type: 'Polygon' | 'LineString' | 'Point'; coordinates: unknown };

function parse(geometry: string | null): Geo | null {
  if (!geometry) return null;
  try {
    const g = JSON.parse(geometry) as Geo;
    return g && typeof g.type === 'string' ? g : null;
  } catch { return null; }
}

function centroid(geo: Geo): [number, number] | null {
  if (geo.type !== 'Polygon') return null;
  const ring = (geo.coordinates as Array<Array<[number, number]>>)[0];
  if (!ring?.length) return null;
  let lat = 0, lon = 0;
  for (const [x, y] of ring) { lon += x; lat += y; }
  return [lat / ring.length, lon / ring.length];
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}
