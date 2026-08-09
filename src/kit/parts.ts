/**
 * parts.ts — узлы, из которых собраны почти все шаблоны.
 *
 * Можно: возвращать готовые наборы деталей в локальных координатах.
 * Нельзя: знать про параметры конкретного шаблона и про движок.
 *
 * Смысл файла простой: четыре ножки под столешницу нужны столу, письменному
 * столу, тумбочке, скамье и верстаку. Если каждый напишет их сам, то через
 * месяц у пяти предметов будут пять разных ножек, и ни одна не встанет
 * ровно. Общий узел — это способ, чтобы «стабильно» означало «одинаково».
 */

import { span, cyl, box, mirrorX, shift, v } from "./core.ts";
import type { MatKey, Prim, V3 } from "./core.ts";

/* ------------------------------------------------------------------ */
/* Опоры                                                               */
/* ------------------------------------------------------------------ */

/**
 * Четыре прямоугольные ножки под столешницей. inset — отступ ножки от края:
 * ножка вровень с краем выглядит как ошибка, поэтому по умолчанию её топят.
 */
export function legs4(
  w: number, d: number, h: number, t: number, mat: MatKey, inset = 0.05,
): Prim[] {
  const x = w / 2 - inset - t / 2;
  const z = d / 2 - inset - t / 2;
  const one = (sx: number, sz: number) =>
    span(sx - t / 2, sx + t / 2, 0, h, sz - t / 2, sz + t / 2, mat, "ножка");
  return [one(x, z), one(-x, z), one(x, -z), one(-x, -z)];
}

/** Круглые ножки — для стульев, табуретов, всего лёгкого. */
export function legs4Round(
  w: number, d: number, h: number, r: number, mat: MatKey, inset = 0.04,
): Prim[] {
  const x = w / 2 - inset - r;
  const z = d / 2 - inset - r;
  const one = (sx: number, sz: number) => cyl(r, h, v(sx, h / 2, sz), mat, { seg: 10, tag: "ножка" });
  return [one(x, z), one(-x, z), one(x, -z), one(-x, -z)];
}

/** Две боковые щеки вместо ножек: тумбы, стеллажи, кухонные модули. */
export function sides(
  w: number, d: number, h: number, t: number, mat: MatKey,
): Prim[] {
  return [
    span(-w / 2, -w / 2 + t, 0, h, -d / 2, d / 2, mat, "щека"),
    span(w / 2 - t, w / 2, 0, h, -d / 2, d / 2, mat, "щека"),
  ];
}

/** Цоколь под тумбой: корпус приподнят, снизу тень. */
export function plinth(w: number, d: number, h: number, mat: MatKey, inset = 0.04): Prim[] {
  return [span(-w / 2 + inset, w / 2 - inset, 0, h, -d / 2 + inset, d / 2 - inset, mat, "цоколь")];
}

/* ------------------------------------------------------------------ */
/* Корпуса                                                             */
/* ------------------------------------------------------------------ */

/**
 * Открытый короб: дно, крышка, две щеки, задняя стенка. Передняя сторона
 * свободна — туда встанут полки, ящики или дверцы.
 */
export function carcass(
  w: number, d: number, h: number, t: number, mat: MatKey, y0 = 0, back = true,
): Prim[] {
  const out: Prim[] = [
    span(-w / 2, w / 2, y0, y0 + t, -d / 2, d / 2, mat, "дно"),
    span(-w / 2, w / 2, y0 + h - t, y0 + h, -d / 2, d / 2, mat, "крышка"),
    span(-w / 2, -w / 2 + t, y0, y0 + h, -d / 2, d / 2, mat, "щека"),
    span(w / 2 - t, w / 2, y0, y0 + h, -d / 2, d / 2, mat, "щека"),
  ];
  if (back) out.push(span(-w / 2, w / 2, y0, y0 + h, -d / 2, -d / 2 + t / 2, mat, "задняя стенка"));
  return out;
}

/** Полки внутри короба, разложенные поровну. */
export function shelves(
  w: number, d: number, h: number, t: number, count: number, mat: MatKey, y0 = 0,
): Prim[] {
  const out: Prim[] = [];
  const n = Math.max(0, Math.round(count));
  for (let i = 1; i <= n; i++) {
    const y = y0 + (h * i) / (n + 1);
    out.push(span(-w / 2 + t, w / 2 - t, y - t / 2, y + t / 2, -d / 2 + t, d / 2, mat, "полка"));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Рамы и филёнки                                                      */
/* ------------------------------------------------------------------ */

/**
 * Плоская рама в плоскости XY: четыре бруска по периметру. Годится на
 * дверное полотно, оконную створку, картину, зеркало.
 */
export function frameXY(
  w: number, h: number, t: number, depth: number, mat: MatKey, z0 = 0,
): Prim[] {
  return [
    span(-w / 2, w / 2, 0, t, z0, z0 + depth, mat, "рама низ"),
    span(-w / 2, w / 2, h - t, h, z0, z0 + depth, mat, "рама верх"),
    span(-w / 2, -w / 2 + t, t, h - t, z0, z0 + depth, mat, "рама край"),
    span(w / 2 - t, w / 2, t, h - t, z0, z0 + depth, mat, "рама край"),
  ];
}

/** Заполнение рамы: стекло, фанера, зеркало. Тоньше рамы и утоплено. */
export function fillXY(
  w: number, h: number, t: number, depth: number, mat: MatKey, z0 = 0,
): Prim[] {
  const c = z0 + depth / 2;
  return [span(-w / 2 + t, w / 2 - t, t, h - t, c - 0.004, c + 0.004, mat, "заполнение")];
}

/**
 * Дверная коробка вокруг проёма: два косяка и притолока.
 * Проём чистый: w × h. Коробка стоит СНАРУЖИ него, не съедая ширину.
 */
export function doorCase(
  w: number, h: number, t: number, depth: number, mat: MatKey,
): Prim[] {
  return [
    span(-w / 2 - t, -w / 2, 0, h + t, -depth / 2, depth / 2, mat, "косяк"),
    span(w / 2, w / 2 + t, 0, h + t, -depth / 2, depth / 2, mat, "косяк"),
    span(-w / 2 - t, w / 2 + t, h, h + t, -depth / 2, depth / 2, mat, "притолока"),
  ];
}

/* ------------------------------------------------------------------ */
/* Мелочь                                                              */
/* ------------------------------------------------------------------ */

/** Скоба-ручка: две стойки и перекладина. Для шкафов и ящиков. */
export function pullHandle(len: number, at: V3, mat: MatKey, out = 0.035): Prim[] {
  const r = 0.008;
  return shift([
    cyl(r, out, v(-len / 2, 0, out / 2), mat, { seg: 8, rot: v(90, 0, 0), tag: "ручка" }),
    cyl(r, out, v(len / 2, 0, out / 2), mat, { seg: 8, rot: v(90, 0, 0), tag: "ручка" }),
    cyl(r, len, v(0, 0, out), mat, { seg: 8, rot: v(0, 0, 90), tag: "ручка" }),
  ], at.x, at.y, at.z);
}

/** Нажимная дверная ручка: розетка и рычаг. Смотрит в +Z. */
export function leverHandle(at: V3, mat: MatKey, toLeft = false): Prim[] {
  const s = toLeft ? -1 : 1;
  return shift([
    cyl(0.028, 0.014, v(0, 0, 0.007), mat, { seg: 12, rot: v(90, 0, 0), tag: "розетка" }),
    cyl(0.012, 0.05, v(0, 0, 0.04), mat, { seg: 8, rot: v(90, 0, 0), tag: "шейка" }),
    box(v(0.1, 0.02, 0.022), v(s * 0.04, 0, 0.062), mat, undefined, "рычаг"),
  ], at.x, at.y, at.z);
}

/** Петли на косяке. Видны на скриншоте и сразу говорят, куда открывается. */
export function hinges(h: number, at: V3, mat: MatKey, count = 2): Prim[] {
  const out: Prim[] = [];
  const n = Math.max(2, Math.round(count));
  for (let i = 0; i < n; i++) {
    const y = h * (0.14 + (0.72 * i) / (n - 1));
    out.push(cyl(0.014, 0.08, v(at.x, y, at.z), mat, { seg: 8, tag: "петля" }));
  }
  return out;
}

/** Ножки-опоры техники: короткие цилиндрики под корпусом. */
export function feet4(w: number, d: number, h: number, mat: MatKey): Prim[] {
  const x = w / 2 - 0.05;
  const z = d / 2 - 0.05;
  const one = (sx: number, sz: number) => cyl(0.022, h, v(sx, h / 2, sz), mat, { seg: 8, tag: "опора" });
  return [one(x, z), one(-x, z), one(x, -z), one(-x, -z)];
}

/** Симметричная пара: собрал одну половину — получил вторую. */
export function pair(prims: Prim[]): Prim[] {
  return prims.concat(mirrorX(prims));
}
