/**
 * obj.ts — превращает примитивы в треугольники и пишет .obj.
 *
 * Можно: считать сетку и складывать текст. Без движка, как и весь кит.
 * Нельзя: знать про Babylon, DOM и файлы — текст отсюда просто возвращается.
 *
 * Зачем это есть. Ты хочешь делать карту в Blender — значит тебе нужно, с
 * чего начать: не с пустой сцены, а с уже выверенного объёма, где комнаты
 * нужного размера, двери на своих местах и высоты честные. Этот файл отдаёт
 * ровно его. Открываешь дом в Blender, включаешь как подложку и моделируешь
 * поверх, а не выдумываешь размеры заново.
 *
 * OBJ выбран нарочно, а не glTF. Он текстовый: я могу его написать без
 * единой зависимости и проверить в консоли построчно. glTF я бы писал
 * вслепую в двоичный формат, который не могу открыть.
 *
 * Оси: OBJ и Blender при импорте по умолчанию считают Y вверх — то же, что
 * у кита. Ничего переворачивать не надо.
 */

import { rotatePoint, MAT_LABEL } from "./core.ts";
import type { MatKey, MeshSink, Prim, V3 } from "./core.ts";
import { emit } from "./core.ts";

interface Tri { a: V3; b: V3; c: V3 }

/** Накопитель треугольников по слотам материалов. */
export function objSink() {
  const byMat = new Map<MatKey, Tri[]>();
  const put = (mat: MatKey, t: Tri) => {
    const list = byMat.get(mat);
    if (list) list.push(t);
    else byMat.set(mat, [t]);
  };

  /** Перевести локальную точку детали в мировую: поворот, потом сдвиг. */
  const place = (p: V3, at: V3, rot: V3): V3 => {
    const r = rotatePoint(p, rot);
    return { x: r.x + at.x, y: r.y + at.y, z: r.z + at.z };
  };

  const quad = (mat: MatKey, at: V3, rot: V3, p0: V3, p1: V3, p2: V3, p3: V3) => {
    const a = place(p0, at, rot), b = place(p1, at, rot);
    const c = place(p2, at, rot), d = place(p3, at, rot);
    put(mat, { a, b, c });
    put(mat, { a, b: c, c: d });
  };

  const sink: MeshSink = {
    box(size, at, rot, mat) {
      const hx = size.x / 2, hy = size.y / 2, hz = size.z / 2;
      const P = (sx: number, sy: number, sz: number): V3 => ({ x: sx * hx, y: sy * hy, z: sz * hz });
      // Каждая грань — против часовой стрелки, если смотреть снаружи.
      quad(mat, at, rot, P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)); // +Z
      quad(mat, at, rot, P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1)); // −Z
      quad(mat, at, rot, P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1)); // +X
      quad(mat, at, rot, P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1)); // −X
      quad(mat, at, rot, P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1)); // +Y
      quad(mat, at, rot, P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1)); // −Y
    },

    cyl(r, r2, h, seg, at, rot, mat) {
      const n = Math.max(3, seg);
      const hy = h / 2;
      const ring = (radius: number, y: number) =>
        Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2;
          return { x: Math.cos(a) * radius, y, z: Math.sin(a) * radius } as V3;
        });
      const bot = ring(r, -hy);
      const top = ring(r2, hy);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        quad(mat, at, rot, bot[i], bot[j], top[j], top[i]);
      }
      // Донья веером от центра. Вырожденный радиус (конус в точку) пропускаем.
      const cBot: V3 = { x: 0, y: -hy, z: 0 };
      const cTop: V3 = { x: 0, y: hy, z: 0 };
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        if (r > 1e-6) put(mat, { a: place(cBot, at, rot), b: place(bot[j], at, rot), c: place(bot[i], at, rot) });
        if (r2 > 1e-6) put(mat, { a: place(cTop, at, rot), b: place(top[i], at, rot), c: place(top[j], at, rot) });
      }
    },

    ball(r, seg, at, rot, mat) {
      const n = Math.max(4, seg);
      const m = Math.max(3, Math.round(n / 2));
      const pt = (i: number, k: number): V3 => {
        const phi = (k / m) * Math.PI;
        const theta = (i / n) * Math.PI * 2;
        return {
          x: Math.sin(phi) * Math.cos(theta) * r,
          y: Math.cos(phi) * r,
          z: Math.sin(phi) * Math.sin(theta) * r,
        };
      };
      for (let k = 0; k < m; k++)
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          quad(mat, at, rot, pt(i, k + 1), pt(j, k + 1), pt(j, k), pt(i, k));
        }
    },

    wedge(size, at, rot, mat) {
      const hx = size.x / 2, hy = size.y / 2, hz = size.z / 2;
      // Прямоугольный треугольник в XY с подъёмом в +X, вытянут вдоль Z.
      const A = (z: number): V3 => ({ x: -hx, y: -hy, z });
      const B = (z: number): V3 => ({ x: hx, y: -hy, z });
      const C = (z: number): V3 => ({ x: hx, y: hy, z });
      put(mat, { a: place(A(hz), at, rot), b: place(B(hz), at, rot), c: place(C(hz), at, rot) });
      put(mat, { a: place(A(-hz), at, rot), b: place(C(-hz), at, rot), c: place(B(-hz), at, rot) });
      quad(mat, at, rot, A(-hz), B(-hz), B(hz), A(hz));
      quad(mat, at, rot, B(-hz), C(-hz), C(hz), B(hz));
      quad(mat, at, rot, C(-hz), A(-hz), A(hz), C(hz));
    },
  };

  return { sink, byMat };
}

/* ------------------------------------------------------------------ */
/* Текст файлов                                                        */
/* ------------------------------------------------------------------ */

export interface ObjGroup {
  /** Имя объекта в Blender. */
  name: string;
  prims: Prim[];
}

/**
 * Пишет .obj и .mtl.
 *
 * Каждая группа становится в Blender отдельным объектом, а каждый слот
 * материала — отдельным материалом. То есть после импорта можно выделить
 * все стены разом и заменить их на свои, не трогая мебель.
 */
export function writeObj(groups: ObjGroup[], mtlName = "zaton.mtl"): { obj: string; mtl: string; tris: number } {
  const lines: string[] = [
    "# Затон — блокаут, выгруженный из кита.",
    "# Единицы: метры. Ось Y вверх — как в Blender при импорте по умолчанию.",
    "# Это подложка для моделирования, а не готовая графика.",
    `mtllib ${mtlName}`,
    "",
  ];

  const used = new Set<MatKey>();
  let vertexBase = 1; // в OBJ нумерация вершин начинается с единицы
  let tris = 0;

  for (const g of groups) {
    const { sink, byMat } = objSink();
    emit(g.prims, sink);
    if (!byMat.size) continue;

    lines.push(`o ${g.name}`);
    byMat.forEach((list, mat) => {
      used.add(mat);
      lines.push(`usemtl ${mat}`);
      const start = vertexBase;
      for (const t of list)
        for (const p of [t.a, t.b, t.c])
          lines.push(`v ${p.x.toFixed(5)} ${p.y.toFixed(5)} ${p.z.toFixed(5)}`);
      for (let i = 0; i < list.length; i++) {
        const n = start + i * 3;
        lines.push(`f ${n} ${n + 1} ${n + 2}`);
      }
      vertexBase += list.length * 3;
      tris += list.length;
    });
    lines.push("");
  }

  const mtl: string[] = [
    "# Материалы блокаута. Цвета служебные: они нужны, чтобы в Blender",
    "# было видно, где стена, где дерево, а где металл. Заменяются целиком.",
    "",
  ];
  const COLOR: Partial<Record<MatKey, [number, number, number]>> = {
    concrete: [0.55, 0.54, 0.52], plaster: [0.79, 0.77, 0.73], brick: [0.55, 0.37, 0.3],
    tile: [0.73, 0.76, 0.75], wood: [0.6, 0.45, 0.28], woodDark: [0.37, 0.27, 0.17],
    woodPale: [0.76, 0.64, 0.45], metal: [0.66, 0.68, 0.7], metalDark: [0.31, 0.32, 0.34],
    steel: [0.56, 0.58, 0.61], rust: [0.54, 0.33, 0.2], fabric: [0.66, 0.61, 0.54],
    fabricDark: [0.36, 0.33, 0.29], leather: [0.49, 0.39, 0.31], glass: [0.62, 0.77, 0.82],
    mirror: [0.78, 0.83, 0.85], ceramic: [0.89, 0.88, 0.85], rubber: [0.23, 0.23, 0.24],
    paper: [0.85, 0.82, 0.76], dirt: [0.29, 0.27, 0.24], lightOn: [0.95, 0.9, 0.78],
  };
  // Пишем ВСЕ материалы, а не только встреченные в этом файле: один .mtl
  // обслуживает и дом, и кит, и Blender не должен ругаться на пропуск.
  void used;
  for (const mat of Object.keys(MAT_LABEL) as MatKey[]) {
    const c = COLOR[mat] ?? [0.7, 0.7, 0.7];
    mtl.push(`# ${MAT_LABEL[mat]}`);
    mtl.push(`newmtl ${mat}`);
    mtl.push(`Kd ${c[0].toFixed(3)} ${c[1].toFixed(3)} ${c[2].toFixed(3)}`);
    mtl.push("Ks 0.05 0.05 0.05", "Ns 20", "d 1.0", "illum 2", "");
  }

  return { obj: lines.join("\n"), mtl: mtl.join("\n"), tris };
}
