/**
 * core.ts — язык, на котором описаны шаблоны. Ни одной ссылки на движок.
 *
 * Можно: описывать примитивы, параметры, шаблоны, считать габариты.
 * Нельзя: импортировать Babylon, трогать DOM, знать про редактор.
 *
 * Почему без движка. Шаблон — это данные: «стол шириной 1.2 состоит вот из
 * таких коробок». Данные я умею проверять без браузера: что ни одна деталь
 * не вылезла за объявленный габарит, что опора стоит на полу, что при любом
 * значении параметра ничего не выворачивается наизнанку. Именно эти проверки
 * и делают шаблон «стабильным» — не то, что он один раз красиво выглядел.
 *
 * Побочная выгода: движок можно поменять ещё раз, и переписывать придётся
 * один файл вывода, а не шестьдесят шаблонов.
 *
 * СОГЛАШЕНИЯ, ОДИНАКОВЫЕ ДЛЯ ВСЕХ ШАБЛОНОВ
 *
 *   Единицы     метры и градусы. Никаких «условных единиц».
 *   Оси         Y вверх. Длина предмета — вдоль X, глубина — вдоль Z.
 *   Опора       у напольного предмета низ лежит на y = 0, начало координат —
 *               в центре пятна на полу. Поставил на пол — стоит; повернул
 *               вокруг Y — крутится на месте, а не улетает по дуге.
 *   Настенное   плоскость стены — XY, предмет растёт в −Z. Начало координат
 *               на поверхности стены: прижал к стене — прижался.
 *   Потолочное  начало координат в точке крепления, предмет висит вниз.
 *   Створки     живут отдельными частями со своей точкой вращения. Дверь —
 *               это коробка плюс полотно на петле, а не дырка в стене.
 */

/* ------------------------------------------------------------------ */
/* Векторы                                                             */
/* ------------------------------------------------------------------ */

export interface V3 {
  x: number;
  y: number;
  z: number;
}

export const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
export const V0: V3 = { x: 0, y: 0, z: 0 };

/* ------------------------------------------------------------------ */
/* Материалы                                                           */
/* ------------------------------------------------------------------ */

/**
 * Слот материала, а не цвет. Шаблон говорит «это дерево», а каким именно
 * деревом оно окажется, решает один файл материалов. Иначе перекраска дуба
 * в сосну — это правка шестидесяти шаблонов.
 */
export type MatKey =
  | "concrete" | "plaster" | "brick" | "tile"
  | "wood" | "woodDark" | "woodPale"
  | "metal" | "metalDark" | "steel" | "rust"
  | "fabric" | "fabricDark" | "leather"
  | "glass" | "mirror"
  | "ceramic" | "rubber" | "paper" | "dirt"
  | "lightOn";

export const MAT_LABEL: Record<MatKey, string> = {
  concrete: "бетон", plaster: "штукатурка", brick: "кирпич", tile: "плитка",
  wood: "дерево", woodDark: "дерево тёмное", woodPale: "дерево светлое",
  metal: "металл", metalDark: "металл тёмный", steel: "сталь", rust: "ржавчина",
  fabric: "ткань", fabricDark: "ткань тёмная", leather: "кожа",
  glass: "стекло", mirror: "зеркало",
  ceramic: "керамика", rubber: "резина", paper: "бумага", dirt: "грязь",
  lightOn: "светящееся",
};

/* ------------------------------------------------------------------ */
/* Примитивы                                                           */
/* ------------------------------------------------------------------ */

interface PrimBase {
  mat: MatKey;
  /** Центр примитива в координатах шаблона. */
  at: V3;
  /** Поворот в градусах, порядок YXZ. Отсутствие — без поворота. */
  rot?: V3;
  /** Подпись для отладки. Не обязательна. */
  tag?: string;
}

export interface PrimBox extends PrimBase { k: "box"; size: V3 }
/** Цилиндр вдоль Y. Разные радиусы сверху и снизу дают конус и юбку. */
export interface PrimCyl extends PrimBase { k: "cyl"; r: number; r2?: number; h: number; seg?: number }
export interface PrimBall extends PrimBase { k: "ball"; r: number; seg?: number }
/** Клин: прямоугольный треугольник в плоскости XY, вытянутый вдоль Z. */
export interface PrimWedge extends PrimBase { k: "wedge"; size: V3 }

export type Prim = PrimBox | PrimCyl | PrimBall | PrimWedge;

/* --- удобные конструкторы ------------------------------------------ */

/**
 * Коробка по двум углам. Для конструктива это единственный удобный способ:
 * «стойка от пола до 2.05, толщиной 6 см, у левого края» читается сразу,
 * а «центр 0.03, 1.025, 0.06 размером 0.06 × 2.05 × 0.12» — нет.
 */
export function span(
  x0: number, x1: number, y0: number, y1: number, z0: number, z1: number,
  mat: MatKey, tag?: string,
): PrimBox {
  return {
    k: "box", mat, tag,
    at: v((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
    size: v(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)),
  };
}

export function box(size: V3, at: V3, mat: MatKey, rot?: V3, tag?: string): PrimBox {
  return { k: "box", size, at, mat, rot, tag };
}

export function cyl(
  r: number, h: number, at: V3, mat: MatKey,
  opts?: { r2?: number; seg?: number; rot?: V3; tag?: string },
): PrimCyl {
  return { k: "cyl", r, h, at, mat, r2: opts?.r2, seg: opts?.seg, rot: opts?.rot, tag: opts?.tag };
}

export function ball(r: number, at: V3, mat: MatKey, opts?: { seg?: number; tag?: string }): PrimBall {
  return { k: "ball", r, at, mat, seg: opts?.seg, tag: opts?.tag };
}

export function wedge(size: V3, at: V3, mat: MatKey, rot?: V3, tag?: string): PrimWedge {
  return { k: "wedge", size, at, mat, rot, tag };
}

/** Сдвинуть готовый набор деталей. Нужно, чтобы собирать узел и класть целиком. */
export function shift(prims: Prim[], dx: number, dy: number, dz: number): Prim[] {
  return prims.map((p) => ({ ...p, at: v(p.at.x + dx, p.at.y + dy, p.at.z + dz) }));
}

/** Отразить набор по X. Вторая тумба, вторая створка, симметричные ножки. */
export function mirrorX(prims: Prim[]): Prim[] {
  return prims.map((p) => ({
    ...p,
    at: v(-p.at.x, p.at.y, p.at.z),
    rot: p.rot ? v(p.rot.x, -p.rot.y, -p.rot.z) : undefined,
  }));
}

/* ------------------------------------------------------------------ */
/* Части со своей точкой вращения                                      */
/* ------------------------------------------------------------------ */

/**
 * Подвижная часть: дверное полотно, створка окна, крышка люка, ящик стола.
 *
 * Детали части заданы ОТНОСИТЕЛЬНО её оси вращения, а не начала шаблона.
 * Так «открыть дверь» — это один поворот узла, и полотно едет по дуге
 * вокруг петли, а не вокруг середины проёма.
 */
export interface Part {
  id: string;
  label: string;
  /** Ось вращения в координатах шаблона. */
  pivot: V3;
  prims: Prim[];
  /** Как часть двигается: поворот вокруг оси или сдвиг вдоль неё. */
  motion?: {
    kind: "swing" | "slide";
    axis: "x" | "y" | "z";
    /** Для swing — градусы, для slide — метры. */
    min: number;
    max: number;
    def: number;
    label: string;
  };
}

export interface Built {
  prims: Prim[];
  parts?: Part[];
}

/* ------------------------------------------------------------------ */
/* Параметры                                                           */
/* ------------------------------------------------------------------ */

export interface ParamDef {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  def: number;
  unit?: string;
}

export const P = (
  id: string, label: string, def: number, min: number, max: number, step = 0.05, unit = "м",
): ParamDef => ({ id, label, def, min, max, step, unit });

/** Целое число штук: сегменты стеллажа, число ступеней. */
export const PN = (id: string, label: string, def: number, min: number, max: number): ParamDef =>
  ({ id, label, def, min, max, step: 1, unit: "шт" });

export type Params = Record<string, number>;

export function defaults(t: TemplateDef): Params {
  const out: Params = {};
  for (const p of t.params) out[p.id] = p.def;
  return out;
}

/** Значение параметра, зажатое в объявленные границы и посаженное на шаг. */
export function clampParams(t: TemplateDef, raw: Params): Params {
  const out: Params = {};
  for (const p of t.params) {
    const given = raw[p.id];
    const value = Number.isFinite(given) ? given : p.def;
    const stepped = Math.round(value / p.step) * p.step;
    out[p.id] = Math.min(p.max, Math.max(p.min, Number(stepped.toFixed(4))));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Шаблон                                                              */
/* ------------------------------------------------------------------ */

export type GroupId = "structure" | "openings" | "furniture" | "props" | "light";

export const GROUP_LABEL: Record<GroupId, string> = {
  structure: "Конструктив",
  openings: "Проёмы",
  furniture: "Мебель",
  props: "Реквизит",
  light: "Свет и электрика",
};

/**
 * Куда предмет ставится. Редактор по этому полю решает, к чему прилипать.
 *
 * «wall» — висит на стене и растёт в комнату (−Z).
 * «opening» — сидит в проёме и выходит в обе стороны: у окна подоконник
 *   внутрь, отлив наружу, и запрещать ему это нельзя.
 */
export type Mount = "floor" | "wall" | "ceiling" | "opening" | "free";

export interface TemplateDef {
  id: string;
  name: string;
  group: GroupId;
  mount: Mount;
  /** Одна строка о том, зачем предмет и чем он отличается от соседнего. */
  note: string;
  params: ParamDef[];
  build(p: Params): Built;
}

/* ------------------------------------------------------------------ */
/* Габариты                                                            */
/* ------------------------------------------------------------------ */

export interface Bounds {
  min: V3;
  max: V3;
}

const growBox = (b: Bounds, at: V3, half: V3) => {
  b.min.x = Math.min(b.min.x, at.x - half.x); b.max.x = Math.max(b.max.x, at.x + half.x);
  b.min.y = Math.min(b.min.y, at.y - half.y); b.max.y = Math.max(b.max.y, at.y + half.y);
  b.min.z = Math.min(b.min.z, at.z - half.z); b.max.z = Math.max(b.max.z, at.z + half.z);
};

/**
 * Матрица поворота из углов Эйлера в градусах, порядок YXZ.
 *
 * Порядок именно такой, потому что так их применяет движок. Совпадение
 * порядка здесь и там — не мелочь: при YXZ против XYZ предмет, повёрнутый
 * по двум осям, встаёт по-разному, и расхождение вылезает только на
 * скриншоте, где его уже не с чем сравнить.
 */
export function rotMatrix(rot: V3): number[][] {
  const d = Math.PI / 180;
  const cx = Math.cos(rot.x * d), sx = Math.sin(rot.x * d);
  const cy = Math.cos(rot.y * d), sy = Math.sin(rot.y * d);
  const cz = Math.cos(rot.z * d), sz = Math.sin(rot.z * d);
  // R = Ry · Rx · Rz
  return [
    [cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx],
    [cx * sz, cx * cz, -sx],
    [-sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx],
  ];
}

/** Повернуть точку теми же углами, какими движок повернёт деталь. */
export function rotatePoint(p: V3, rot: V3): V3 {
  if (!rot.x && !rot.y && !rot.z) return p;
  const m = rotMatrix(rot);
  return v(
    m[0][0] * p.x + m[0][1] * p.y + m[0][2] * p.z,
    m[1][0] * p.x + m[1][1] * p.y + m[1][2] * p.z,
    m[2][0] * p.x + m[2][1] * p.y + m[2][2] * p.z,
  );
}

/** Половина габарита детали в её собственных осях. */
function halfExtent(p: Prim): V3 {
  if (p.k === "box" || p.k === "wedge") return v(p.size.x / 2, p.size.y / 2, p.size.z / 2);
  if (p.k === "cyl") {
    const r = Math.max(p.r, p.r2 ?? p.r);
    return v(r, p.h / 2, r);
  }
  return v(p.r, p.r, p.r);
}

/**
 * Габарит набора деталей.
 *
 * Повёрнутая деталь считается через матрицу, а не через описанную сферу.
 * Разница огромная: труба длиной три метра, положенная горизонтально,
 * по сфере даёт габарит три метра во все стороны — и предмет начинает
 * «торчать сквозь стену» там, где он к ней просто прислонён.
 */
export function boundsOf(prims: Prim[]): Bounds {
  const b: Bounds = { min: v(Infinity, Infinity, Infinity), max: v(-Infinity, -Infinity, -Infinity) };
  for (const p of prims) {
    const h = halfExtent(p);
    let half = h;
    if (p.rot && (p.rot.x || p.rot.y || p.rot.z)) {
      const m = rotMatrix(p.rot);
      half = v(
        Math.abs(m[0][0]) * h.x + Math.abs(m[0][1]) * h.y + Math.abs(m[0][2]) * h.z,
        Math.abs(m[1][0]) * h.x + Math.abs(m[1][1]) * h.y + Math.abs(m[1][2]) * h.z,
        Math.abs(m[2][0]) * h.x + Math.abs(m[2][1]) * h.y + Math.abs(m[2][2]) * h.z,
      );
    }
    growBox(b, p.at, half);
  }
  if (!Number.isFinite(b.min.x)) return { min: v(0, 0, 0), max: v(0, 0, 0) };
  return b;
}

/** Габарит всего шаблона: тело плюс подвижные части в положении по умолчанию. */
export function builtBounds(built: Built): Bounds {
  const all: Prim[] = built.prims.slice();
  for (const part of built.parts ?? [])
    for (const p of part.prims)
      all.push({ ...p, at: v(p.at.x + part.pivot.x, p.at.y + part.pivot.y, p.at.z + part.pivot.z) });
  return boundsOf(all);
}

export const sizeOf = (b: Bounds): V3 => v(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);

/* ------------------------------------------------------------------ */
/* Вывод в движок                                                      */
/* ------------------------------------------------------------------ */

/**
 * Приёмник геометрии. Всё, что движок обязан уметь, — четыре вызова.
 *
 * Такой узкий стык нужен ровно затем, чтобы я мог подсунуть вместо Babylon
 * записывающую заглушку и проверить в консоли, что шаблон отдал правильные
 * размеры и положения. Проверять картинку я не умею — проверять числа умею.
 */
export interface MeshSink {
  box(size: V3, at: V3, rot: V3, mat: MatKey, tag: string): void;
  cyl(r: number, r2: number, h: number, seg: number, at: V3, rot: V3, mat: MatKey, tag: string): void;
  ball(r: number, seg: number, at: V3, rot: V3, mat: MatKey, tag: string): void;
  wedge(size: V3, at: V3, rot: V3, mat: MatKey, tag: string): void;
}

export function emit(prims: Prim[], sink: MeshSink) {
  for (const p of prims) {
    const rot = p.rot ?? V0;
    const tag = p.tag ?? p.k;
    if (p.k === "box") sink.box(p.size, p.at, rot, p.mat, tag);
    else if (p.k === "cyl") sink.cyl(p.r, p.r2 ?? p.r, p.h, p.seg ?? 16, p.at, rot, p.mat, tag);
    else if (p.k === "ball") sink.ball(p.r, p.seg ?? 12, p.at, rot, p.mat, tag);
    else sink.wedge(p.size, p.at, rot, p.mat, tag);
  }
}

/** Грубая оценка треугольников: нужна, чтобы витрина не оказалась неподъёмной. */
export function triangleCost(prims: Prim[]): number {
  let n = 0;
  for (const p of prims) {
    if (p.k === "box" || p.k === "wedge") n += p.k === "box" ? 12 : 8;
    else if (p.k === "cyl") n += (p.seg ?? 16) * 4;
    else n += (p.seg ?? 12) * (p.seg ?? 12) * 2;
  }
  return n;
}
