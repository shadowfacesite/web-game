/**
 * geometry.ts — карта превращается в объём. Ни одной ссылки на three.js.
 *
 * Можно: считать из карты клетки, плиты, стены, проёмы, коллизии.
 * Нельзя: импортировать three, трогать DOM, знать про рендер.
 *
 * Почему без three.js. Я не вижу экран. Всё, что можно посчитать без
 * браузера, должно считаться без браузера — тогда я проверю это сам, а не
 * буду спрашивать «как выглядит». Этот файл читают двое:
 *   src/render/blockout.ts — делает из него меши,
 *   tools/blockout.mjs     — гоняет проверки в консоли, без видеокарты.
 * Второй реализации геометрии в проекте нет и быть не должно: грабли 14.
 *
 * Здесь же коллизии. Игрок упирается ровно в те коробки, которые
 * нарисованы, — не в отдельную «сетку проходимости». Расхождение «вижу
 * стену, прохожу насквозь» становится невозможным по построению.
 */

/* ------------------------------------------------------------------ */
/* Типы карты                                                          */
/* ------------------------------------------------------------------ */

export type LevelId = "cellar" | "f1" | "f2" | "f3";
export type Axis = "v" | "h";

export interface Room {
  level: LevelId;
  id: string;
  name: string;
  mat: string;
  /** Открытая площадка: балкон, верхняя площадка. Вместо стен — ограждение. */
  outdoor?: boolean;
  x0?: number; z0?: number; x1?: number; z1?: number;
  pts?: [number, number][];
}

export interface Gate {
  /** Стадия, с которой проход открыт. null — заперто навсегда. */
  stage: number | null;
  /** Стадия, с которой снова закрыто. null — остаётся открытым. */
  close: number | null;
}

export interface Door extends Gate {
  level: LevelId;
  id: string;
  x: number;
  z: number;
  o: Axis;
  label: string;
}

export interface Opening {
  level: LevelId;
  id: string;
  x: number;
  z: number;
  o: Axis;
  label: string;
}

export interface Link extends Gate {
  id: string;
  kind: "lift" | "stair" | "ladder";
  from: LevelId;
  to: LevelId | null;
  x: number;
  z: number;
  label: string;
}

export interface StageSpec {
  n: number;
  name: string;
  goal: string;
  level: LevelId;
  at: { level: LevelId; x: number; z: number };
}

export interface HouseMap {
  cell: number;
  w: number;
  d: number;
  floorH: number;
  levels: { id: LevelId; n: number; name: string; y: number }[];
  core: {
    shaft: [number, number, number, number];
    stairwell: [number, number, number, number];
    hatch: [number, number, number, number];
    collapse: Record<LevelId, "solid" | "rubble" | "void">;
  };
  rooms: Room[];
  doors: Door[];
  openings: Opening[];
  links: Link[];
  stages: StageSpec[];
  start: { level: LevelId; x: number; z: number };
}

/* ------------------------------------------------------------------ */
/* Размеры                                                             */
/* ------------------------------------------------------------------ */

/**
 * Все размеры дома в метрах, в одном месте.
 *
 * Клетка планировки — 0.5 м. Наружная стена занимает клетку целиком,
 * перегородка — тонкая плита по центру клетки: стена во всю клетку
 * превращает каждый дверной проём в полуметровый тоннель (грабли 5).
 */
export const DIM = {
  /** Толщина плиты перекрытия. Она же — высота торца у выреза (грабли 3). */
  slab: 0.2,
  /** Чистая высота помещения: от верха пола до низа плиты сверху. */
  roomH: 2.8,
  /** Перегородка — тонкая плита по центру клетки. */
  wallInt: 0.12,
  doorW: 0.9,
  doorH: 2.05,
  /** Толщина дверного полотна. */
  leafT: 0.1,
  openW: 1.2,
  openH: 2.2,
  /** Порожек: по нему на скриншоте читается, где проём. */
  sillH: 0.03,
  /** Бортик у провала. Без него провал читается как ошибка рендера. */
  kerbH: 0.25,
  kerbT: 0.14,
  /** Остатки ограждения. Именно они не дают шагнуть в колодец. */
  railH: 1.05,
  railT: 0.08,
  /** Завал на 1-м этаже. */
  rubbleH: 1.15,
  /** Радиус игрока. Проём 0.9 — это 0.34 м чистого хода для центра. */
  playerR: 0.28,
  eye: 1.65,
  /** Лежащее топится в опору на сантиметр — иначе z-борьба (грабли 1). */
  sink: 0.01,
};

/* ------------------------------------------------------------------ */
/* Клетки                                                              */
/* ------------------------------------------------------------------ */

export type CellKind =
  | "outside" /** снаружи дома: ни пола, ни стен */
  | "room" /** пол помещения */
  | "wall" /** стена или перегородка */
  | "rail" /** край открытой площадки: ограждение вместо стены */
  | "shaftWall" /** обечайка шахты лифта */
  | "shaftIn" /** нутро шахты; на Э2 — заглушка вместо кабины */
  | "masonry" /** нетронутая кладка колодца в подвале */
  | "rubble" /** завал на 1-м этаже: пол есть, ходить нельзя */
  | "void" /** провал: пола нет */
  | "hatch"; /** люк в подвал: крышка снимается на 6-й стадии */

/** Клетка, в которой есть чем ходить или во что смотреть. */
export const isSpace = (k: CellKind): boolean =>
  k === "room" || k === "rubble" || k === "void" || k === "hatch" || k === "shaftIn";

/** Клетка, под которой лежит плита перекрытия. */
const hasSlab = (k: CellKind): boolean => k !== "outside" && k !== "void" && k !== "hatch";

/* ------------------------------------------------------------------ */
/* Коробки                                                            */
/* ------------------------------------------------------------------ */

export type BoxKind =
  | "slab" | "roof" | "wall" | "part" | "core"
  | "lintel" | "sill" | "leaf" | "lid" | "kerb" | "rail" | "rubble";

/** Коробка, выровненная по осям. Всё в мировых метрах. */
export interface Box {
  kind: BoxKind;
  x0: number; y0: number; z0: number;
  x1: number; y1: number; z1: number;
}

/**
 * Створка или крышка. Стоит на месте, пока ни один из пропусков не открыт:
 * у дверей шахты на 1-м этаже их два — «стадия 1, закрывается на 2» и
 * «с 5-й и дальше». Одна створка, два повода уйти.
 */
export interface StagedBox {
  box: Box;
  id: string;
  label: string;
  gates: Gate[];
}

export interface LevelBlockout {
  id: LevelId;
  name: string;
  y: number;
  kind: CellKind[];
  /** Постоянная геометрия: плиты, стены, ядро, ограждения. */
  boxes: Box[];
  /** Створки и крышки: появляются и исчезают по стадии. */
  staged: StagedBox[];
}

export interface Blockout {
  cell: number;
  nx: number;
  nz: number;
  w: number;
  d: number;
  levels: LevelBlockout[];
  map: HouseMap;
}

/* ------------------------------------------------------------------ */
/* Мелочи                                                             */
/* ------------------------------------------------------------------ */

const inRect = (x: number, z: number, b: readonly number[]): boolean =>
  x >= b[0] && z >= b[1] && x <= b[2] && z <= b[3];

const inRectStrict = (x: number, z: number, b: readonly number[]): boolean =>
  x > b[0] && z > b[1] && x < b[2] && z < b[3];

function inPoly(x: number, z: number, pts: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % n];
    if (z1 > z !== z2 > z && x < ((x2 - x1) * (z - z1)) / (z2 - z1) + x1) inside = !inside;
  }
  return inside;
}

export function inRoom(x: number, z: number, r: Room): boolean {
  if (r.pts) return inPoly(x, z, r.pts);
  return x >= (r.x0 as number) && x <= (r.x1 as number)
      && z >= (r.z0 as number) && z <= (r.z1 as number);
}

/** Та же формула, что в валидаторе и на чертеже. Держать одну на всех. */
export const gateOpen = (g: Gate, stage: number): boolean =>
  g.stage !== null && stage >= g.stage && (g.close === null || stage < g.close);

/** Створка стоит, пока ни один пропуск не открыт. */
export const stagedPresent = (s: StagedBox, stage: number): boolean =>
  !s.gates.some((g) => gateOpen(g, stage));

/* ------------------------------------------------------------------ */
/* Разбор карты в клетки                                              */
/* ------------------------------------------------------------------ */

function classify(map: HouseMap, level: LevelId, nx: number, nz: number): CellKind[] {
  const cell = map.cell;
  const cx = (i: number) => (i + 0.5) * cell;
  const rooms = map.rooms.filter((r) => r.level === level);
  const kinds: CellKind[] = new Array(nx * nz).fill("outside");

  const shaft = map.core.shaft;
  const stairwell = map.core.stairwell;
  const hatch = map.core.hatch;
  const collapse = map.core.collapse[level];
  const inner: number[] = [shaft[0] + cell, shaft[1] + cell, shaft[2] - cell, shaft[3] - cell];

  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const x = cx(i), z = cx(j);
      let k: CellKind = "outside";

      if (inRect(x, z, shaft)) {
        k = inRectStrict(x, z, inner) ? "shaftIn" : "shaftWall";
      } else if (inRect(x, z, stairwell)) {
        k = collapse === "solid" ? "masonry" : collapse === "rubble" ? "rubble" : "void";
      } else if (level === "f1" && inRect(x, z, hatch)) {
        k = "hatch";
      } else if (rooms.some((r) => inRoom(x, z, r))) {
        k = "room";
      }

      kinds[j * nx + i] = k;
    }

  // Стены: клетка снаружи, но рядом помещение. Восемь соседей, а не четыре:
  // с четырьмя на выпуклом углу остаётся диагональная щель, через которую
  // игрок выходит из дома боком.
  const outdoorAt = (i: number, j: number): boolean => {
    const r = rooms.find((rr) => inRoom(cx(i), cx(j), rr));
    return !!r && r.outdoor === true;
  };

  const base = kinds.slice();
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      if (base[j * nx + i] !== "outside") continue;
      let indoor = false;
      let outdoor = false;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
          if (!isSpace(base[jj * nx + ii])) continue;
          if (outdoorAt(ii, jj)) outdoor = true;
          else indoor = true;
        }
      if (indoor) kinds[j * nx + i] = "wall";
      else if (outdoor) kinds[j * nx + i] = "rail";
    }

  return kinds;
}

/* ------------------------------------------------------------------ */
/* Слияние клеток в прямоугольники                                    */
/* ------------------------------------------------------------------ */

/**
 * Жадная сборка прямоугольников из маски. Нужна ради числа треугольников:
 * коробка на каждую клетку пола — это под три тысячи коробок на этаж.
 */
export function mergeMask(
  mask: boolean[], nx: number, nz: number,
): [number, number, number, number][] {
  const used: boolean[] = new Array(nx * nz).fill(false);
  const out: [number, number, number, number][] = [];

  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      if (!mask[j * nx + i] || used[j * nx + i]) continue;

      let i1 = i;
      while (i1 + 1 < nx && mask[j * nx + i1 + 1] && !used[j * nx + i1 + 1]) i1++;

      let j1 = j;
      grow: while (j1 + 1 < nz) {
        for (let ii = i; ii <= i1; ii++)
          if (!mask[(j1 + 1) * nx + ii] || used[(j1 + 1) * nx + ii]) break grow;
        j1++;
      }

      for (let jj = j; jj <= j1; jj++) for (let ii = i; ii <= i1; ii++) used[jj * nx + ii] = true;
      out.push([i, j, i1 + 1, j1 + 1]);
    }

  return out;
}

/* ------------------------------------------------------------------ */
/* Проёмы                                                             */
/* ------------------------------------------------------------------ */

interface Cut {
  /** Координата вдоль стены — центр проёма. */
  at: number;
  /** Координата поперёк стены — в какой плоскости он стоит. */
  cross: number;
  o: Axis;
  width: number;
  height: number;
  /** Пропуска створки. Пусто — сквозной проём без двери. */
  gates: Gate[];
  id: string;
  label: string;
}

/**
 * Проёмы уровня. Двери, стоящие в одной точке, сливаются в один проём с
 * несколькими пропусками: в карте так записаны двери шахты. Люк не сюда —
 * он режется не в стене, а в перекрытии.
 */
function cutsOf(map: HouseMap, level: LevelId): Cut[] {
  const byKey = new Map<string, Cut>();
  const key = (o: Axis, cross: number, at: number) => o + ":" + cross.toFixed(3) + ":" + at.toFixed(3);

  for (const d of map.doors) {
    if (d.level !== level) continue;
    if (level === "f1" && inRect(d.x, d.z, map.core.hatch)) continue; // это крышка люка
    const at = d.o === "v" ? d.z : d.x;
    const cross = d.o === "v" ? d.x : d.z;
    const k = key(d.o, cross, at);
    const had = byKey.get(k);
    if (had) {
      had.gates.push({ stage: d.stage, close: d.close });
      had.id = had.id + "+" + d.id;
    } else {
      byKey.set(k, {
        at, cross, o: d.o, width: DIM.doorW, height: DIM.doorH,
        gates: [{ stage: d.stage, close: d.close }], id: d.id, label: d.label,
      });
    }
  }

  for (const o of map.openings) {
    if (o.level !== level) continue;
    const at = o.o === "v" ? o.z : o.x;
    const cross = o.o === "v" ? o.x : o.z;
    byKey.set(key(o.o, cross, at), {
      at, cross, o: o.o, width: DIM.openW, height: DIM.openH,
      gates: [], id: o.id, label: o.label,
    });
  }

  const out: Cut[] = [];
  byKey.forEach((c) => out.push(c));
  return out;
}

/* ------------------------------------------------------------------ */
/* Сборка уровня                                                       */
/* ------------------------------------------------------------------ */

function buildLevel(
  map: HouseMap,
  L: { id: LevelId; name: string; y: number },
  nx: number,
  nz: number,
  kinds: CellKind[],
  above: CellKind[],
): LevelBlockout {
  const cell = map.cell;
  const y = L.y;
  const top = y + DIM.roomH;
  const boxes: Box[] = [];
  const staged: StagedBox[] = [];
  const rooms = map.rooms.filter((r) => r.level === L.id);

  const at = (i: number, j: number): CellKind =>
    i < 0 || j < 0 || i >= nx || j >= nz ? "outside" : kinds[j * nx + i];

  const push = (
    kind: BoxKind, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
  ) => {
    if (x1 - x0 < 1e-6 || z1 - z0 < 1e-6 || y1 - y0 < 1e-6) return;
    boxes.push({ kind, x0, y0, z0, x1, y1, z1 });
  };

  /* --- перекрытие ---------------------------------------------------- */

  // Дыра режется в плите, а не рисуется поверх (грабли 2). Плита — коробка
  // толщиной 0.2, поэтому у выреза сам собой появляется торец (грабли 3):
  // сверху пол, сбоку — двадцать сантиметров бетона.
  for (const r of mergeMask(kinds.map(hasSlab), nx, nz))
    push("slab", r[0] * cell, y - DIM.slab, r[1] * cell, r[2] * cell, y, r[3] * cell);

  /* --- кровля и заплаты потолка -------------------------------------- */

  // Где уровнем выше клеток нет, снизу видно небо. Провал — другое дело: в
  // него смотреть и надо, поэтому «void» сверху не затыкается. Открытые
  // площадки остаются без потолка, на то они и открытые.
  const roofMask = kinds.map((k, n) => {
    if (!hasSlab(k) && k !== "hatch") return false;
    if (k === "rail") return false;
    if (above[n] !== "outside") return false;
    const i = n % nx, j = Math.floor(n / nx);
    const r = rooms.find((rr) => inRoom((i + 0.5) * cell, (j + 0.5) * cell, rr));
    return !(r && r.outdoor === true);
  });
  for (const r of mergeMask(roofMask, nx, nz))
    push("roof", r[0] * cell, top, r[1] * cell, r[2] * cell, top + DIM.slab, r[3] * cell);

  /* --- стены и проёмы ------------------------------------------------ */

  const cuts = cutsOf(map, L.id);

  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = at(i, j);
      if (k !== "wall" && k !== "shaftWall") continue;

      const x0 = i * cell, x1 = x0 + cell;
      const z0 = j * cell, z1 = z0 + cell;
      const cxm = x0 + cell / 2, czm = z0 + cell / 2;

      // Перегородка — та, у которой помещения ровно с двух противоположных
      // сторон. Всё остальное (наружная стена, угол, примыкание) — клетка
      // целиком (грабли 5).
      const spN = isSpace(at(i, j - 1)), spS = isSpace(at(i, j + 1));
      const spW = isSpace(at(i - 1, j)), spE = isSpace(at(i + 1, j));
      const thinH = k === "wall" && spN && spS && !spW && !spE;
      const thinV = k === "wall" && spW && spE && !spN && !spS;

      let ax0 = x0, ax1 = x1, az0 = z0, az1 = z1;
      if (thinH) { az0 = czm - DIM.wallInt / 2; az1 = czm + DIM.wallInt / 2; }
      if (thinV) { ax0 = cxm - DIM.wallInt / 2; ax1 = cxm + DIM.wallInt / 2; }

      const kindOf: BoxKind = k === "shaftWall" ? "core" : thinH || thinV ? "part" : "wall";

      // Проёмы, режущие именно эту клетку: плоскость проёма проходит через
      // её поперечник, а створ перекрывается с её длиной.
      const mine = cuts.filter((c) => {
        const c0 = c.o === "v" ? x0 : z0;
        const c1 = c.o === "v" ? x1 : z1;
        if (c.cross < c0 - 1e-9 || c.cross > c1 + 1e-9) return false;
        const a0 = c.o === "v" ? z0 : x0;
        const a1 = c.o === "v" ? z1 : x1;
        return c.at + c.width / 2 > a0 + 1e-9 && c.at - c.width / 2 < a1 - 1e-9;
      });

      if (mine.length === 0) {
        push(kindOf, ax0, y, az0, ax1, top, az1);
        continue;
      }

      // Режем вдоль оси проёма. Она может не совпадать с осью клетки: проём
      // шириной 0.9 накрывает почти две клетки по 0.5.
      const axis = mine[0].o;
      const here = mine.filter((c) => c.o === axis);
      const alongZ = axis === "v";
      const lo = alongZ ? az0 : ax0;
      const hi = alongZ ? az1 : ax1;
      const fixLo = alongZ ? ax0 : az0;
      const fixHi = alongZ ? ax1 : az1;

      const put = (kind: BoxKind, a: number, b: number, ya: number, yb: number) => {
        if (alongZ) push(kind, fixLo, ya, a, fixHi, yb, b);
        else push(kind, a, ya, fixLo, b, yb, fixHi);
      };

      const spans = here
        .map((c) => ({ c, a: Math.max(lo, c.at - c.width / 2), b: Math.min(hi, c.at + c.width / 2) }))
        .filter((s) => s.b > s.a)
        .sort((p, q) => p.a - q.a);

      let cursor = lo;
      for (const s of spans) {
        if (s.a > cursor) put(kindOf, cursor, s.a, y, top);
        // Перемычка: без неё стена висит над пустотой.
        put("lintel", s.a, s.b, y + s.c.height, top);
        // Порожек. Топим на сантиметр, иначе две плоскости спорят (грабли 1).
        put("sill", s.a, s.b, y - DIM.sink, y + DIM.sillH);
        cursor = Math.max(cursor, s.b);
      }
      if (cursor < hi) put(kindOf, cursor, hi, y, top);
    }

  /* --- створки ------------------------------------------------------- */

  // Полотно стоит в проёме и убирается, когда дверь открыта. Клетка двери
  // проходима ровно тогда, когда створки нет, — то же условие, что в
  // валидаторе, и та же коробка, в которую упирается игрок (грабли 17).
  for (const c of cuts) {
    if (c.gates.length === 0) continue;
    const a0 = c.at - c.width / 2, a1 = c.at + c.width / 2;
    const t0 = c.cross - DIM.leafT / 2, t1 = c.cross + DIM.leafT / 2;
    const box: Box =
      c.o === "v"
        ? { kind: "leaf", x0: t0, y0: y, z0: a0, x1: t1, y1: y + c.height, z1: a1 }
        : { kind: "leaf", x0: a0, y0: y, z0: t0, x1: a1, y1: y + c.height, z1: t1 };
    staged.push({ box, id: c.id, label: c.label, gates: c.gates });
  }

  /* --- крышка люка --------------------------------------------------- */

  if (L.id === "f1") {
    const h = map.core.hatch;
    const lid = map.doors.find((d) => d.level === "f1" && inRect(d.x, d.z, h));
    staged.push({
      box: { kind: "lid", x0: h[0], y0: y - DIM.slab, z0: h[1], x1: h[2], y1: y, z1: h[3] },
      id: "hatch_lid",
      label: lid ? lid.label : "Крышка люка",
      gates: [lid ? { stage: lid.stage, close: lid.close } : { stage: null, close: null }],
    });
  }

  /* --- колодец обвала ------------------------------------------------- */

  const sw = map.core.stairwell;
  const sx0 = sw[0], sz0 = sw[1], sx1 = sw[2], sz1 = sw[3];
  const collapse = map.core.collapse[L.id];

  if (collapse === "solid") {
    // Лестница до подвала не доходила: нетронутая кладка от пола до потолка.
    push("core", sx0, y, sz0, sx1, top, sz1);
  } else if (collapse === "rubble") {
    // Завал. Три уступа, чтобы читалось как груда, а не тумба. Топим в пол.
    push("rubble", sx0 + 0.1, y - DIM.sink, sz0 + 0.1, sx1 - 0.1, y + DIM.rubbleH, sz1 - 0.1);
    push("rubble", sx0 + 0.6, y - DIM.sink, sz0 + 0.5, sx1 - 0.9, y + DIM.rubbleH + 0.35, sz1 - 0.7);
    push("rubble", sx0 + 1.4, y - DIM.sink, sz0 + 1.2, sx1 - 0.3, y + DIM.rubbleH - 0.4, sz1 - 0.2);
  } else {
    // Провал. Стен вокруг нет — в него надо смотреть (грабли 4). Не пускает
    // не стена, а бортик с остатками ограждения: видно, обо что упёрся.
    const t = DIM.kerbT;
    push("kerb", sx0 - t, y - DIM.sink, sz0 - t, sx1 + t, y + DIM.kerbH, sz0);
    push("kerb", sx0 - t, y - DIM.sink, sz1, sx1 + t, y + DIM.kerbH, sz1 + t);
    push("kerb", sx0 - t, y - DIM.sink, sz0, sx0, y + DIM.kerbH, sz1);
    push("kerb", sx1, y - DIM.sink, sz0, sx1 + t, y + DIM.kerbH, sz1);

    const posts: [number, number][] = [];
    for (let x = sx0; x <= sx1 + 1e-9; x += 0.75) { posts.push([x, sz0]); posts.push([x, sz1]); }
    for (let z = sz0 + 0.75; z < sz1 - 1e-9; z += 0.75) { posts.push([sx0, z]); posts.push([sx1, z]); }
    for (const p of posts)
      push("rail", p[0] - 0.04, y + DIM.kerbH, p[1] - 0.04, p[0] + 0.04, y + DIM.railH, p[1] + 0.04);

    const g = DIM.railT / 2;
    const railTop = y + DIM.railH;
    push("rail", sx0 - g, railTop - 0.07, sz0 - g, sx1 + g, railTop, sz0 + g);
    push("rail", sx0 - g, railTop - 0.07, sz1 - g, sx1 + g, railTop, sz1 + g);
    push("rail", sx0 - g, railTop - 0.07, sz0 - g, sx0 + g, railTop, sz1 + g);
    push("rail", sx1 - g, railTop - 0.07, sz0 - g, sx1 + g, railTop, sz1 + g);
  }

  /* --- ограждение открытых площадок ----------------------------------- */

  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      if (at(i, j) !== "rail") continue;
      const x0 = i * cell, z0 = j * cell;
      push("kerb", x0, y - DIM.sink, z0, x0 + cell, y + DIM.kerbH, z0 + cell);
      push("rail", x0 + 0.21, y + DIM.kerbH, z0 + 0.21, x0 + 0.29, y + DIM.railH, z0 + 0.29);
      push("rail", x0, y + DIM.railH - 0.07, z0, x0 + cell, y + DIM.railH, z0 + cell);
    }

  return { id: L.id, name: L.name, y, kind: kinds, boxes, staged };
}

/* ------------------------------------------------------------------ */
/* Точка входа                                                         */
/* ------------------------------------------------------------------ */

export function buildBlockout(map: HouseMap): Blockout {
  const cell = map.cell;
  const nx = Math.round(map.w / cell);
  const nz = Math.round(map.d / cell);

  const kinds = new Map<LevelId, CellKind[]>();
  for (const L of map.levels) kinds.set(L.id, classify(map, L.id, nx, nz));

  const order = map.levels.slice().sort((a, b) => a.y - b.y);
  const sky: CellKind[] = new Array(nx * nz).fill("outside");
  const levels: LevelBlockout[] = [];

  for (let n = 0; n < order.length; n++) {
    const L = order[n];
    const up = order[n + 1];
    const aboveKinds = up ? (kinds.get(up.id) as CellKind[]) : sky;
    levels.push(buildLevel(map, L, nx, nz, kinds.get(L.id) as CellKind[], aboveKinds));
  }

  return { cell, nx, nz, w: map.w, d: map.d, levels, map };
}

/* ------------------------------------------------------------------ */
/* Коллизии                                                            */
/* ------------------------------------------------------------------ */

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/**
 * Коробки уровня, разложенные по корзинам 2 × 2 м.
 *
 * Без корзин каждый шаг игрока — перебор шестисот прямоугольников. В игре
 * это ещё терпимо, а проверка обхода дома из tools/blockout.mjs делает
 * миллионы таких проверок и считается минутами. Корзины нужны там, но
 * лежат здесь: игра и проверка обязаны упираться в один и тот же код.
 */
export interface Solids {
  rects: Rect[];
  bw: number;
  nx: number;
  nz: number;
  cells: number[][];
}

/** Запас корзины: любой прямоугольник виден за полметра до себя. */
const BUCKET_PAD = 0.5;

export function makeSolids(rects: Rect[], w: number, d: number, bw: number): Solids {
  const nx = Math.max(1, Math.ceil(w / bw) + 2);
  const nz = Math.max(1, Math.ceil(d / bw) + 2);
  const cells: number[][] = new Array(nx * nz);
  for (let n = 0; n < cells.length; n++) cells[n] = [];

  const clampX = (v: number) => Math.max(0, Math.min(nx - 1, Math.floor(v / bw) + 1));
  const clampZ = (v: number) => Math.max(0, Math.min(nz - 1, Math.floor(v / bw) + 1));

  for (let n = 0; n < rects.length; n++) {
    const s = rects[n];
    const i0 = clampX(s.x0 - BUCKET_PAD), i1 = clampX(s.x1 + BUCKET_PAD);
    const j0 = clampZ(s.z0 - BUCKET_PAD), j1 = clampZ(s.z1 + BUCKET_PAD);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cells[j * nx + i].push(n);
  }

  return { rects, bw, nx, nz, cells };
}

function bucketAt(S: Solids, x: number, z: number): number[] {
  const i = Math.max(0, Math.min(S.nx - 1, Math.floor(x / S.bw) + 1));
  const j = Math.max(0, Math.min(S.nz - 1, Math.floor(z / S.bw) + 1));
  return S.cells[j * S.nx + i];
}

/**
 * Во что игрок упирается на этом уровне и на этой стадии.
 *
 * Берутся ровно те коробки, что нарисованы, и только те, что пересекают
 * тело по высоте. Поэтому под перемычкой пройти можно, а сквозь стену
 * нельзя — и это не два списка, а один.
 */
export function solidsAt(blockout: Blockout, level: LevelId, stage: number): Solids {
  const L = blockout.levels.find((x) => x.id === level);
  const rects: Rect[] = [];
  if (L) {
    const lo = L.y + 0.1;
    const hi = L.y + 1.8;
    for (const b of L.boxes) {
      if (b.kind === "slab" || b.kind === "roof" || b.kind === "sill") continue;
      if (b.y1 <= lo || b.y0 >= hi) continue;
      rects.push({ x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1 });
    }
    for (const s of L.staged) {
      if (s.box.kind === "lid") continue; // крышка лежит в полу, по ней ходят
      if (!stagedPresent(s, stage)) continue;
      if (s.box.y1 <= lo || s.box.y0 >= hi) continue;
      rects.push({ x0: s.box.x0, z0: s.box.z0, x1: s.box.x1, z1: s.box.z1 });
    }
  }
  // Корзина 2 м: заметно больше самой длинной стены не нужно, заметно
  // меньше — и один прямоугольник ложится в десяток корзин.
  return makeSolids(rects, blockout.w + 4, blockout.d + 4, 2);
}

/** Помещается ли игрок в этой точке. */
export function fits(x: number, z: number, S: Solids, r: number): boolean {
  const near = bucketAt(S, x, z);
  for (let n = 0; n < near.length; n++) {
    const s = S.rects[near[n]];
    if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r) return false;
  }
  return true;
}

/**
 * Сдвинуть кружок радиуса r и не дать ему влезть в коробки.
 *
 * По одной оси за раз: сначала X с выталкиванием, потом Z. Способ старый и
 * скучный, зато не залипает в углах. Шаг заранее режется на куски короче
 * радиуса — иначе на бегу можно проскочить сквозь стену между кадрами.
 */
export function slideCircle(
  px: number, pz: number, dx: number, dz: number, S: Solids, r: number,
): { x: number; z: number; hit: boolean } {
  let x = px, z = pz, hit = false;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (r * 0.8)));
  const sx = dx / steps, sz = dz / steps;

  for (let n = 0; n < steps; n++) {
    x += sx;
    let near = bucketAt(S, x, z);
    for (let m = 0; m < near.length; m++) {
      const s = S.rects[near[m]];
      if (x <= s.x0 - r || x >= s.x1 + r || z <= s.z0 - r || z >= s.z1 + r) continue;
      hit = true;
      x = x < (s.x0 + s.x1) / 2 ? s.x0 - r : s.x1 + r;
    }
    z += sz;
    near = bucketAt(S, x, z);
    for (let m = 0; m < near.length; m++) {
      const s = S.rects[near[m]];
      if (x <= s.x0 - r || x >= s.x1 + r || z <= s.z0 - r || z >= s.z1 + r) continue;
      hit = true;
      z = z < (s.z0 + s.z1) / 2 ? s.z0 - r : s.z1 + r;
    }
  }
  return { x, z, hit };
}

/**
 * Ближайшая точка, где игрок помещается. Ставить в геометрический центр
 * помещения нельзя: центр холла лежит внутри шахты (грабли 18).
 */
export function nearestFit(
  blockout: Blockout, level: LevelId, x: number, z: number, stage: number,
): { x: number; z: number } {
  const solids = solidsAt(blockout, level, stage);
  const r = DIM.playerR;
  if (fits(x, z, solids, r)) return { x, z };
  for (let ring = 1; ring <= 40; ring++) {
    const step = ring * 0.2;
    for (let a = 0; a < 24; a++) {
      const t = (a / 24) * Math.PI * 2;
      const cx2 = x + Math.cos(t) * step;
      const cz2 = z + Math.sin(t) * step;
      if (fits(cx2, cz2, solids, r)) return { x: cx2, z: cz2 };
    }
  }
  return { x, z };
}
