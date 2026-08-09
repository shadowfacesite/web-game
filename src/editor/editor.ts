/**
 * editor.ts — выделение, гизмо, привязка, буфер обмена, отмена.
 *
 * Можно: держать список расставленных предметов и управлять ими.
 * Нельзя: рисовать панели (это ui.ts) и знать, как устроен шаблон внутри.
 *
 * Гизмо здесь три штуки, и это ровно то, ради чего выбран Babylon:
 * стрелки по X, Y, Z для перемещения, кольца по тем же осям для поворота
 * и кубики для масштаба. Ничего из этого не написано мной — всё встроено
 * в движок, поэтому оно работает одинаково и не ломается на краях.
 */

import { GizmoManager, PointerEventTypes, Scene, StandardMaterial, TransformNode } from "@babylonjs/core";
import type { MatKey } from "../kit/core.ts";
import { place, rebuild, serialize, parse, nextUid } from "../kit/catalog.ts";
import type { Placed } from "../kit/catalog.ts";
import { buildObject, applyTransform, applyMotion, readTransform } from "../engine/render.ts";
import type { ObjectView } from "../engine/render.ts";

export type GizmoMode = "move" | "rotate" | "scale" | "none";

export interface Snap {
  /** Шаг перемещения в метрах. 0 — без привязки. */
  grid: number;
  /** Шаг поворота в градусах. 0 — без привязки. */
  angle: number;
  /** Шаг масштаба. 0 — без привязки. */
  scale: number;
  /** Крутить в осях мира, а не предмета. */
  world: boolean;
}

export interface Editor {
  objects: Placed[];
  readonly selected: Placed | null;
  add(tplId: string): Placed | null;
  select(uid: string | null): void;
  remove(uid?: string): void;
  duplicate(uid?: string): Placed | null;
  /** Пересобрать геометрию выделенного после правки параметров. */
  refresh(uid?: string): void;
  /** Только положение и створки — без пересборки мешей. */
  touch(uid?: string): void;
  setMode(mode: GizmoMode): void;
  readonly mode: GizmoMode;
  setSnap(patch: Partial<Snap>): void;
  readonly snap: Snap;
  clear(): void;
  load(text: string): string[];
  save(): string;
  undo(): void;
  onChange(fn: () => void): void;
  focusOn(uid: string): void;
}

const HISTORY_DEPTH = 40;

export function createEditor(
  scene: Scene,
  mats: Map<MatKey, StandardMaterial>,
  focus: (node: TransformNode) => void,
): Editor {
  const objects: Placed[] = [];
  const views = new Map<string, ObjectView>();
  const listeners: (() => void)[] = [];
  const history: string[] = [];

  let selected: string | null = null;
  let mode: GizmoMode = "move";
  const snap: Snap = { grid: 0.25, angle: 15, scale: 0.05, world: true };

  const gizmo = new GizmoManager(scene);
  // Гизмо цепляем сами: иначе он прыгает на любой меш под курсором, включая
  // землю, и предмет теряется из выделения на каждом клике.
  gizmo.usePointerToAttachGizmos = false;
  gizmo.clearGizmoOnEmptyPointerEvent = false;

  const changed = () => { for (const fn of listeners) fn(); };
  const find = (uid: string | null | undefined) => objects.find((o) => o.uid === uid) ?? null;

  /* --- история ------------------------------------------------------- */

  function snapshot() {
    history.push(serialize(objects));
    if (history.length > HISTORY_DEPTH) history.shift();
  }

  /* --- гизмо --------------------------------------------------------- */

  function wireGizmo() {
    const g = gizmo.gizmos;
    if (g.positionGizmo) {
      g.positionGizmo.snapDistance = snap.grid;
      g.positionGizmo.updateGizmoRotationToMatchAttachedMesh = !snap.world;
      g.positionGizmo.onDragStartObservable.clear();
      g.positionGizmo.onDragEndObservable.clear();
      g.positionGizmo.onDragStartObservable.add(snapshot);
      g.positionGizmo.onDragEndObservable.add(commitFromGizmo);
    }
    if (g.rotationGizmo) {
      g.rotationGizmo.snapDistance = (snap.angle * Math.PI) / 180;
      g.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = !snap.world;
      g.rotationGizmo.onDragStartObservable.clear();
      g.rotationGizmo.onDragEndObservable.clear();
      g.rotationGizmo.onDragStartObservable.add(snapshot);
      g.rotationGizmo.onDragEndObservable.add(commitFromGizmo);
    }
    if (g.scaleGizmo) {
      g.scaleGizmo.snapDistance = snap.scale;
      g.scaleGizmo.onDragStartObservable.clear();
      g.scaleGizmo.onDragEndObservable.clear();
      g.scaleGizmo.onDragStartObservable.add(snapshot);
      g.scaleGizmo.onDragEndObservable.add(commitFromGizmo);
    }
  }

  /** После работы гизмо число в панели должно совпасть с тем, что на экране. */
  function commitFromGizmo() {
    const o = find(selected);
    const view = o ? views.get(o.uid) : null;
    if (!o || !view) return;
    readTransform(view.root, o);

    // Привязка гизмо работает от места, где предмет стоял. Досаживаем на
    // сетку от нуля, иначе после десятка перетаскиваний числа становятся
    // вроде 1.2437 и стыковать предметы вплотную уже нельзя.
    if (snap.grid > 0) {
      const q = (x: number) => Math.round(x / snap.grid) * snap.grid;
      o.pos = { x: q(o.pos.x), y: q(o.pos.y), z: q(o.pos.z) };
    }
    if (snap.angle > 0) {
      const q = (x: number) => Math.round(x / snap.angle) * snap.angle;
      o.rot = { x: q(o.rot.x), y: q(o.rot.y), z: q(o.rot.z) };
    }
    applyTransform(view.root, o);
    changed();
  }

  function applyMode() {
    gizmo.positionGizmoEnabled = mode === "move";
    gizmo.rotationGizmoEnabled = mode === "rotate";
    gizmo.scaleGizmoEnabled = mode === "scale";
    wireGizmo();
    const o = find(selected);
    const view = o ? views.get(o.uid) : null;
    if (view && mode !== "none" && !o?.locked) gizmo.attachToNode(view.root);
    else gizmo.attachToNode(null);
  }

  /* --- выбор мышью ---------------------------------------------------- */

  scene.onPointerObservable.add((info) => {
    if (info.type !== PointerEventTypes.POINTERPICK) return;
    const picked = info.pickInfo?.pickedMesh;
    const uid = (picked?.metadata as { uid?: string } | undefined)?.uid ?? null;
    api.select(uid);
  });

  /* --- сборка и разборка ---------------------------------------------- */

  function spawn(o: Placed) {
    const view = buildObject(scene, mats, o);
    if (view) views.set(o.uid, view);
  }

  function despawn(uid: string) {
    const view = views.get(uid);
    if (!view) return;
    view.dispose();
    views.delete(uid);
  }

  const api: Editor = {
    objects,

    get selected() { return find(selected); },
    get mode() { return mode; },
    get snap() { return snap; },

    add(tplId) {
      const o = place(tplId, { x: 0, y: 0, z: 0 });
      if (!o) return null;
      snapshot();
      objects.push(o);
      spawn(o);
      api.select(o.uid);
      changed();
      return o;
    },

    select(uid) {
      selected = uid;
      applyMode();
      changed();
    },

    remove(uid) {
      const o = find(uid ?? selected);
      if (!o) return;
      snapshot();
      despawn(o.uid);
      objects.splice(objects.indexOf(o), 1);
      if (selected === o.uid) selected = null;
      applyMode();
      changed();
    },

    duplicate(uid) {
      const o = find(uid ?? selected);
      if (!o) return null;
      snapshot();
      const copy: Placed = {
        ...o,
        uid: nextUid(),
        pos: { x: o.pos.x + 0.5, y: o.pos.y, z: o.pos.z + 0.5 },
        params: { ...o.params },
        motion: { ...o.motion },
        rot: { ...o.rot },
        scale: { ...o.scale },
      };
      objects.push(copy);
      spawn(copy);
      api.select(copy.uid);
      changed();
      return copy;
    },

    refresh(uid) {
      const o = find(uid ?? selected);
      if (!o) return;
      rebuild(o);
      despawn(o.uid);
      spawn(o);
      applyMode();
      changed();
    },

    touch(uid) {
      const o = find(uid ?? selected);
      const view = o ? views.get(o.uid) : null;
      if (!o || !view) return;
      applyTransform(view.root, o);
      applyMotion(view, o);
      changed();
    },

    setMode(next) {
      mode = next;
      applyMode();
      changed();
    },

    setSnap(patch) {
      Object.assign(snap, patch);
      wireGizmo();
      applyMode();
      changed();
    },

    clear() {
      snapshot();
      for (const o of [...objects]) despawn(o.uid);
      objects.length = 0;
      selected = null;
      applyMode();
      changed();
    },

    load(text) {
      const res = parse(text);
      snapshot();
      for (const o of [...objects]) despawn(o.uid);
      objects.length = 0;
      selected = null;
      for (const o of res.objects) { objects.push(o); spawn(o); }
      applyMode();
      changed();
      return res.problems;
    },

    save() { return serialize(objects); },

    undo() {
      const prev = history.pop();
      if (!prev) return;
      for (const o of [...objects]) despawn(o.uid);
      objects.length = 0;
      selected = null;
      for (const o of parse(prev).objects) { objects.push(o); spawn(o); }
      applyMode();
      changed();
    },

    onChange(fn) { listeners.push(fn); },

    focusOn(uid) {
      const view = views.get(uid);
      if (view) focus(view.root);
    },
  };

  applyMode();
  return api;
}
