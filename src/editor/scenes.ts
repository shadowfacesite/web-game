/**
 * scenes.ts — что показывать на карте.
 *
 * Витрина    все шаблоны, разложенные по группам, с подписями.
 * Пусто      только сетка и ростовой эталон — сюда ставят своё.
 * Дом        тот самый дом из spec/house-map.json.
 *
 * Третий режим здесь не для красоты. Он доказывает, что смена движка ничего
 * не стоила: дом собирается тем же src/world/geometry.ts, что и раньше, без
 * единой правки, потому что тот файл никогда не знал, какой движок его
 * читает. Если бы геометрия была написана внутри three.js, переезд означал
 * бы переписать её заново — и планировка с домом опять разошлись бы.
 */

import { Mesh, Scene, StandardMaterial, TransformNode, Vector3, Matrix } from "@babylonjs/core";

import { CATALOG } from "../kit/catalog.ts";
import { GROUP_LABEL, builtBounds, sizeOf, defaults } from "../kit/core.ts";
import type { GroupId, MatKey, Prim, V3 } from "../kit/core.ts";
import type { Editor } from "./editor.ts";
import { buildBlockout } from "../world/geometry.ts";
import type { Box, BoxKind, HouseMap } from "../world/geometry.ts";
import rawMap from "../../spec/house-map.json";

/* ------------------------------------------------------------------ */
/* Витрина                                                             */
/* ------------------------------------------------------------------ */

export interface Label {
  text: string;
  at: V3;
  big?: boolean;
}

/**
 * Раскладка витрины. Ряды идут по группам, предмет занимает свою настоящую
 * ширину плюс просвет: иначе шкаф налезает на тумбочку и непонятно, где
 * кончается один и начинается другой.
 */
export function layoutShowcase(editor: Editor): Label[] {
  editor.clear();
  const labels: Label[] = [];

  const GAP = 0.9;
  const ROW_LIMIT = 26;
  let z = 0;

  const groups: GroupId[] = ["structure", "openings", "furniture", "props", "light"];

  for (const g of groups) {
    const items = CATALOG.filter((t) => t.group === g);
    if (!items.length) continue;

    z += 3.2;
    labels.push({ text: GROUP_LABEL[g].toUpperCase(), at: { x: -ROW_LIMIT / 2, y: 2.6, z }, big: true });

    let x = -ROW_LIMIT / 2;
    let rowDepth = 0;

    for (const t of items) {
      const size = sizeOf(builtBounds(t.build(defaults(t))));
      const w = Math.max(0.6, size.x);

      if (x + w > ROW_LIMIT / 2) {
        x = -ROW_LIMIT / 2;
        z += rowDepth + GAP * 1.6;
        rowDepth = 0;
      }

      const o = editor.add(t.id);
      if (o) {
        o.pos = { x: x + w / 2, y: 0, z };
        editor.touch(o.uid);
        labels.push({ text: t.name, at: { x: x + w / 2, y: Math.max(size.y, 0.3) + 0.28, z } });
      }

      x += w + GAP;
      rowDepth = Math.max(rowDepth, size.z);
    }

    z += rowDepth + 1.4;
  }

  editor.select(null);
  return labels;
}

/* ------------------------------------------------------------------ */
/* Пустая карта                                                        */
/* ------------------------------------------------------------------ */

/**
 * Пустая — но не совсем. Ростовой эталон и метровый куб остаются: без них
 * первое же, что ты поставишь, будет не с чем сравнить, и «слишком большой
 * стол» станет заметен только через десять предметов.
 */
export function layoutEmpty(editor: Editor): Label[] {
  editor.clear();
  const human = editor.add("ref_human");
  if (human) { human.pos = { x: -1.2, y: 0, z: 0 }; editor.touch(human.uid); }
  const cube = editor.add("ref_cube");
  if (cube) { cube.pos = { x: 0.6, y: 0, z: 0 }; editor.touch(cube.uid); }
  editor.select(null);
  return [
    { text: "рост 1.75, глаза 1.65", at: { x: -1.2, y: 2.05, z: 0 } },
    { text: "куб 1 м, риски через 10 см", at: { x: 0.6, y: 1.3, z: 0 } },
  ];
}

/* ------------------------------------------------------------------ */
/* Дом из планировки                                                   */
/* ------------------------------------------------------------------ */

const MAP = rawMap as unknown as HouseMap;

/** Слот материала на каждый вид коробки дома. */
const HOUSE_MAT: Record<BoxKind, MatKey> = {
  slab: "concrete", roof: "concrete", wall: "plaster", part: "plaster",
  core: "brick", lintel: "concrete", sill: "wood", leaf: "wood",
  lid: "steel", kerb: "concrete", rail: "metalDark", rubble: "rust",
};

export interface HouseView {
  root: TransformNode;
  dispose(): void;
  labels: Label[];
}

export function buildHouseFromMap(
  scene: Scene,
  mats: Map<MatKey, StandardMaterial>,
  stage: number,
  sink: (prims: Prim[], parent: TransformNode, name: string) => Mesh[],
): HouseView {
  const blockout = buildBlockout(MAP);
  const root = new TransformNode("дом", scene);
  const labels: Label[] = [];
  const meshes: Mesh[] = [];

  const toPrim = (b: Box): Prim => ({
    k: "box",
    mat: HOUSE_MAT[b.kind],
    at: { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 },
    size: { x: b.x1 - b.x0, y: b.y1 - b.y0, z: b.z1 - b.z0 },
    tag: b.kind,
  });

  for (const L of blockout.levels) {
    const node = new TransformNode(L.name, scene);
    node.parent = root;

    const prims = L.boxes.map(toPrim);
    for (const s of L.staged) {
      const open = s.gates.some(
        (g) => g.stage !== null && stage >= g.stage && (g.close === null || stage < g.close),
      );
      if (!open) prims.push(toPrim(s.box));
    }

    meshes.push(...sink(prims, node, L.name));
    labels.push({ text: L.name, at: { x: -1.2, y: L.y + 1.6, z: -1.2 }, big: true });
  }

  return {
    root,
    labels,
    dispose() {
      for (const m of meshes) { m.material = null; m.dispose(); }
      root.dispose();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Подписи поверх сцены                                                */
/* ------------------------------------------------------------------ */

/**
 * Подписи — обычный DOM поверх холста, а не текст внутри сцены.
 *
 * Так они всегда читаются: не мылятся с расстояния, не поворачиваются
 * боком и рисуются тем же моноширинным шрифтом, что и весь интерфейс.
 * За это платим проекцией нескольких десятков точек на кадр — это ничто.
 */
export function createLabels(scene: Scene, host: HTMLElement) {
  let items: Label[] = [];
  let nodes: HTMLElement[] = [];
  let visible = true;

  function set(next: Label[]) {
    items = next;
    for (const n of nodes) n.remove();
    nodes = items.map((l) => {
      const n = document.createElement("div");
      n.className = l.big ? "label label-big" : "label";
      n.textContent = l.text;
      host.append(n);
      return n;
    });
  }

  function update() {
    const camera = scene.activeCamera;
    if (!camera) return;
    const engine = scene.getEngine();
    const w = engine.getRenderWidth();
    const h = engine.getRenderHeight();
    const view = scene.getTransformMatrix();
    const port = camera.viewport.toGlobal(w, h);

    for (let i = 0; i < items.length; i++) {
      const node = nodes[i];
      if (!visible) { node.style.display = "none"; continue; }
      const p = items[i].at;
      const world = new Vector3(p.x, p.y, p.z);
      const screen = Vector3.Project(world, Matrix.Identity(), view, port);
      // z вне 0..1 — точка за спиной камеры; такие подписи надо прятать,
      // иначе они появляются зеркально с другой стороны экрана.
      const behind = screen.z < 0 || screen.z > 1;
      const far = Vector3.Distance(camera.globalPosition, world);
      if (behind || far > 45) { node.style.display = "none"; continue; }
      node.style.display = "block";
      node.style.left = `${(screen.x / w) * 100}%`;
      node.style.top = `${(screen.y / h) * 100}%`;
      node.style.opacity = String(Math.max(0.25, Math.min(1, 1.6 - far / 30)));
    }
  }

  return {
    set,
    update,
    setVisible(on: boolean) { visible = on; },
    clear() { set([]); },
  };
}
