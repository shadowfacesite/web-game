/**
 * render.ts — единственное место, где кит встречается с движком.
 *
 * Можно: заводить материалы, делать меши из примитивов, собирать предмет.
 * Нельзя: считать геометрию. Всё, что можно посчитать, посчитано в src/kit,
 * и посчитано там нарочно: этот файл я не могу ни собрать, ни запустить,
 * пока ты не откроешь страницу. Чем он тоньше, тем меньше в нём ошибок.
 *
 * Если движок когда-нибудь опять поменяется, переписывать нужно только этот
 * файл и stage.ts. Семьдесят один шаблон переезжает как есть.
 */

import {
  Color3, Mesh, MeshBuilder, Quaternion, Scene, StandardMaterial,
  TransformNode, Vector3, VertexData,
} from "@babylonjs/core";

import { emit } from "../kit/core.ts";
import type { MatKey, Prim, V3 } from "../kit/core.ts";
import { rebuild } from "../kit/catalog.ts";
import type { Placed } from "../kit/catalog.ts";

const RAD = Math.PI / 180;

/* ------------------------------------------------------------------ */
/* Материалы                                                           */
/* ------------------------------------------------------------------ */

/**
 * Цвет на каждый слот. Это не финальные материалы — это блокаут: оттенки
 * подобраны так, чтобы на сером скриншоте дерево отличалось от металла,
 * а ткань от штукатурки. Текстуры приходят позже и меняют только этот файл.
 */
const TONE: Record<MatKey, [string, number, number]> = {
  //           цвет      блик  прозрачность
  concrete:  ["#8d8b86", 0.03, 1],
  plaster:   ["#c9c4ba", 0.02, 1],
  brick:     ["#8d5f4c", 0.02, 1],
  tile:      ["#b9c2c0", 0.25, 1],
  wood:      ["#9a7247", 0.08, 1],
  woodDark:  ["#5f452c", 0.06, 1],
  woodPale:  ["#c2a274", 0.08, 1],
  metal:     ["#a9adb2", 0.45, 1],
  metalDark: ["#4e5257", 0.35, 1],
  steel:     ["#8e949b", 0.5, 1],
  rust:      ["#8a5533", 0.05, 1],
  fabric:    ["#a89b8a", 0.01, 1],
  fabricDark:["#5d5449", 0.01, 1],
  leather:   ["#7d6350", 0.12, 1],
  glass:     ["#9fc4d0", 0.8, 0.28],
  mirror:    ["#c6d3d8", 0.9, 0.85],
  ceramic:   ["#e2e0da", 0.35, 1],
  rubber:    ["#3a3a3c", 0.05, 1],
  paper:     ["#d8d2c2", 0.02, 1],
  dirt:      ["#4a443c", 0.01, 1],
  lightOn:   ["#f3e6c8", 0.1, 1],
};

export function makeMaterials(scene: Scene): Map<MatKey, StandardMaterial> {
  const out = new Map<MatKey, StandardMaterial>();
  for (const key of Object.keys(TONE) as MatKey[]) {
    const [hex, spec, alpha] = TONE[key];
    const m = new StandardMaterial(`мат:${key}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(spec, spec, spec);
    m.specularPower = 24;
    if (alpha < 1) { m.alpha = alpha; m.backFaceCulling = false; }
    // Светящееся не зависит от освещения: иначе плафон выключенной лампы
    // неотличим от куска пластика.
    if (key === "lightOn") m.emissiveColor = Color3.FromHexString(hex).scale(0.55);
    m.freeze();
    out.set(key, m);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Клин                                                                */
/* ------------------------------------------------------------------ */

/**
 * Клин собирается вручную: у MeshBuilder такого нет.
 *
 * Каждый треугольник пишется дважды, с обеими намотками. Расточительно на
 * восемь треугольников, зато исключает единственную ошибку, которую я здесь
 * не смог бы найти без запуска: грань, видимую только с одной стороны.
 */
function makeWedge(name: string, size: V3, scene: Scene): Mesh {
  const hx = size.x / 2, hy = size.y / 2, hz = size.z / 2;
  // Прямоугольный треугольник в плоскости XY, прямой угол внизу слева,
  // подъём в сторону +X. Вытянут вдоль Z.
  const A = [-hx, -hy], B = [hx, -hy], C = [hx, hy];
  const tri = (
    a: number[], b: number[], c: number[],
  ): number[][] => [a, b, c];

  const faces: number[][][] = [
    tri([...A, hz], [...B, hz], [...C, hz]),
    tri([...A, -hz], [...C, -hz], [...B, -hz]),
    // низ
    tri([...A, -hz], [...B, -hz], [...B, hz]),
    tri([...A, -hz], [...B, hz], [...A, hz]),
    // вертикальная стенка
    tri([...B, -hz], [...C, -hz], [...C, hz]),
    tri([...B, -hz], [...C, hz], [...B, hz]),
    // наклонная
    tri([...C, -hz], [...A, -hz], [...A, hz]),
    tri([...C, -hz], [...A, hz], [...C, hz]),
  ];

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const push = (t: number[][], flip: boolean) => {
    const [p0, p1, p2] = flip ? [t[0], t[2], t[1]] : t;
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (const p of [p0, p1, p2]) {
      indices.push(positions.length / 3);
      positions.push(p[0], p[1], p[2]);
      normals.push(nx, ny, nz);
      uvs.push(p[0] + p[2], p[1] + p[2]);
    }
  };

  for (const f of faces) { push(f, false); push(f, true); }

  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = positions;
  data.normals = normals;
  data.uvs = uvs;
  data.indices = indices;
  data.applyToMesh(mesh);
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Примитивы в меши                                                    */
/* ------------------------------------------------------------------ */

const setPose = (m: Mesh, at: V3, rot: V3) => {
  m.position.set(at.x, at.y, at.z);
  m.rotationQuaternion = Quaternion.RotationYawPitchRoll(rot.y * RAD, rot.x * RAD, rot.z * RAD);
};

/** Собирает меши по слотам материалов, чтобы потом слить каждую пачку в один. */
function collector(scene: Scene) {
  const byMat = new Map<MatKey, Mesh[]>();
  const add = (mat: MatKey, m: Mesh) => {
    const list = byMat.get(mat);
    if (list) list.push(m);
    else byMat.set(mat, [m]);
  };

  return {
    byMat,
    sink: {
      box(size: V3, at: V3, rot: V3, mat: MatKey, tag: string) {
        const m = MeshBuilder.CreateBox(tag, { width: size.x, height: size.y, depth: size.z }, scene);
        setPose(m, at, rot);
        add(mat, m);
      },
      cyl(r: number, r2: number, h: number, seg: number, at: V3, rot: V3, mat: MatKey, tag: string) {
        const m = MeshBuilder.CreateCylinder(
          tag, { height: h, diameterTop: r2 * 2, diameterBottom: r * 2, tessellation: seg }, scene,
        );
        setPose(m, at, rot);
        add(mat, m);
      },
      ball(r: number, seg: number, at: V3, rot: V3, mat: MatKey, tag: string) {
        const m = MeshBuilder.CreateSphere(tag, { diameter: r * 2, segments: Math.max(4, seg) }, scene);
        setPose(m, at, rot);
        add(mat, m);
      },
      wedge(size: V3, at: V3, rot: V3, mat: MatKey, tag: string) {
        const m = makeWedge(tag, size, scene);
        setPose(m, at, rot);
        add(mat, m);
      },
    },
  };
}

/**
 * Сливает пачки в один меш на слот материала.
 *
 * Без слияния предмет вроде детской кроватки — это полсотни мешей, а сцена
 * из сотни предметов — пять тысяч вызовов отрисовки. Со слиянием их
 * остаётся два-три на предмет.
 */
function mergeInto(
  parent: TransformNode,
  byMat: Map<MatKey, Mesh[]>,
  mats: Map<MatKey, StandardMaterial>,
  label: string,
): Mesh[] {
  const out: Mesh[] = [];
  byMat.forEach((list, key) => {
    for (const m of list) m.computeWorldMatrix(true);
    const merged = list.length === 1 ? list[0] : Mesh.MergeMeshes(list, true, true, undefined, false, false);
    if (!merged) return;
    merged.name = `${label}:${key}`;
    merged.material = mats.get(key) ?? null;
    merged.parent = parent;
    merged.position.set(0, 0, 0);
    merged.rotationQuaternion = null;
    merged.rotation.set(0, 0, 0);
    merged.scaling.set(1, 1, 1);
    merged.isPickable = true;
    out.push(merged);
  });
  return out;
}

/**
 * Собрать произвольный набор деталей под указанным узлом.
 *
 * Этим строится дом из планировки: коробки из geometry.ts превращаются в
 * примитивы кита и проходят ровно тот же путь, что мебель. Один код рисует
 * и то, и другое — значит, если стена окажется кривой, кривой окажется и
 * шкаф, и я это замечу.
 */
export function buildPrims(
  scene: Scene, mats: Map<MatKey, StandardMaterial>,
  prims: Prim[], parent: TransformNode, name: string,
): Mesh[] {
  const c = collector(scene);
  emit(prims, c.sink);
  return mergeInto(parent, c.byMat, mats, name);
}

/* ------------------------------------------------------------------ */
/* Предмет целиком                                                     */
/* ------------------------------------------------------------------ */

export interface ObjectView {
  uid: string;
  root: TransformNode;
  /** Узлы подвижных частей: по ним двигаются створки. */
  parts: Map<string, { node: TransformNode; pivot: V3; kind: "swing" | "slide"; axis: "x" | "y" | "z" }>;
  meshes: Mesh[];
  dispose(): void;
}

export function buildObject(
  scene: Scene, mats: Map<MatKey, StandardMaterial>, o: Placed,
): ObjectView | null {
  const r = rebuild(o);
  if (!r) return null;

  const root = new TransformNode(`предмет:${o.uid}`, scene);
  const meshes: Mesh[] = [];
  const parts = new Map<string, { node: TransformNode; pivot: V3; kind: "swing" | "slide"; axis: "x" | "y" | "z" }>();

  // Неподвижное тело.
  const body = collector(scene);
  emit(r.built.prims, body.sink);
  meshes.push(...mergeInto(root, body.byMat, mats, `${o.uid}:тело`));

  // Каждая подвижная часть — свой узел, стоящий в точке вращения.
  for (const part of r.built.parts ?? []) {
    const node = new TransformNode(`часть:${o.uid}:${part.id}`, scene);
    node.parent = root;
    node.position.set(part.pivot.x, part.pivot.y, part.pivot.z);

    const c = collector(scene);
    emit(part.prims, c.sink);
    meshes.push(...mergeInto(node, c.byMat, mats, `${o.uid}:${part.id}`));

    if (part.motion)
      parts.set(part.id, { node, pivot: part.pivot, kind: part.motion.kind, axis: part.motion.axis });
  }

  for (const m of meshes) m.metadata = { uid: o.uid };
  root.metadata = { uid: o.uid };

  applyTransform(root, o);
  applyMotion({ uid: o.uid, root, parts, meshes, dispose: () => {} }, o);

  return {
    uid: o.uid,
    root,
    parts,
    meshes,
    dispose() {
      for (const m of meshes) { m.material = null; m.dispose(); }
      parts.forEach((p) => p.node.dispose());
      root.dispose();
    },
  };
}

/** Положение, поворот и масштаб предмета целиком. */
export function applyTransform(root: TransformNode, o: Placed) {
  root.position.set(o.pos.x, o.pos.y, o.pos.z);
  // Кватернион обнуляем нарочно: пока он задан, Babylon игнорирует rotation,
  // и предмет молча перестаёт слушаться чисел из панели.
  root.rotationQuaternion = null;
  root.rotation.set(o.rot.x * RAD, o.rot.y * RAD, o.rot.z * RAD);
  root.scaling.set(o.scale.x, o.scale.y, o.scale.z);
}

/** Положение створок по записанным значениям. */
export function applyMotion(view: ObjectView, o: Placed) {
  view.parts.forEach((p, id) => {
    const value = o.motion[id] ?? 0;
    p.node.rotationQuaternion = null;
    p.node.rotation.set(0, 0, 0);
    p.node.position.set(p.pivot.x, p.pivot.y, p.pivot.z);
    if (p.kind === "swing") p.node.rotation[p.axis] = value * RAD;
    else p.node.position[p.axis] = p.pivot[p.axis] + value;
  });
}

/** Прочитать положение узла обратно в данные — после работы гизмо. */
export function readTransform(root: TransformNode, o: Placed) {
  o.pos = { x: root.position.x, y: root.position.y, z: root.position.z };
  const e = root.rotationQuaternion ? root.rotationQuaternion.toEulerAngles() : root.rotation;
  o.rot = { x: e.x / RAD, y: e.y / RAD, z: e.z / RAD };
  o.scale = { x: root.scaling.x, y: root.scaling.y, z: root.scaling.z };
}

export const toVector = (p: V3): Vector3 => new Vector3(p.x, p.y, p.z);
