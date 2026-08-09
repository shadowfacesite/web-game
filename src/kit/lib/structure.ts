/**
 * structure.ts — конструктив: то, из чего складывается сам дом.
 *
 * Можно: описывать стены, плиты, лестницы, ограждения.
 * Нельзя: знать про редактор и движок.
 *
 * Все толщины и высоты — параметры со значениями по умолчанию из настоящего
 * дома: стена 2.8 в свету, плита 0.2, проём 0.9 × 2.05. Ставишь шаблон с
 * умолчаниями — получаешь ту же геометрию, что строит src/world/geometry.ts
 * из планировки. Это не совпадение, а условие: кит и дом должны стыковаться
 * без подгонки, иначе мебель окажется не по размеру комнат.
 */

import { span, cyl, wedge, v, P, PN } from "../core.ts";
import type { Prim, TemplateDef } from "../core.ts";
import { doorCase } from "../parts.ts";

/* --- общие параметры ------------------------------------------------ */

const pLen = P("len", "Длина", 3, 0.5, 12, 0.25);
const pHeight = P("h", "Высота", 2.8, 1, 4, 0.05);
const pThick = P("t", "Толщина", 0.25, 0.06, 0.6, 0.02);

/**
 * Проём, зажатый внутрь стены.
 *
 * Ползунок «смещение» ходит до четырёх метров, а стена может быть длиной
 * полметра. Если не зажать, проём уезжает за край, простенок становится
 * нулевым, и в движке появляется вывернутая наизнанку грань. Поэтому
 * смещение всегда считается от того, что реально влезает.
 */
function opening(len: number, width: number, off: number): { a: number; b: number } {
  // Простенок по краям обязателен. Стена, у которой проём доходит до самого
  // угла, — это уже не стена с проёмом, а два обрубка, и повернуть её как
  // единый предмет становится нельзя: середина уезжает вбок.
  const minPier = 0.06;
  const w = Math.min(width, Math.max(0.2, len - minPier * 2));
  const room = Math.max(0, (len - w) / 2 - minPier);
  const c = Math.max(-room, Math.min(room, off));
  return { a: c - w / 2, b: c + w / 2 };
}


export const STRUCTURE: TemplateDef[] = [
  /* ---------------------------------------------------------------- */
  {
    id: "wall",
    name: "Стена",
    group: "structure",
    mount: "floor",
    note: "Глухой участок. Длина вдоль X, толщина вдоль Z, низ на полу.",
    params: [pLen, pHeight, pThick],
    build: (p) => ({
      prims: [span(-p.len / 2, p.len / 2, 0, p.h, -p.t / 2, p.t / 2, "plaster", "стена")],
    }),
  },

  {
    id: "wall_door",
    name: "Стена с дверным проёмом",
    group: "structure",
    mount: "floor",
    note: "Проём прорезан насквозь, сверху перемычка. Коробки нет — она отдельным шаблоном.",
    params: [
      pLen, pHeight, pThick,
      P("dw", "Ширина проёма", 0.9, 0.6, 2.4, 0.05),
      P("dh", "Высота проёма", 2.05, 1.6, 3, 0.05),
      P("off", "Смещение проёма", 0, -4, 4, 0.05),
    ],
    build: (p) => {
      const { a, b } = opening(p.len, p.dw, p.off);
      const out: Prim[] = [];
      // Простенки слева и справа плюс перемычка. Проём режется в стене,
      // а не рисуется поверх неё: иначе у него не будет торца.
      if (a > -p.len / 2) out.push(span(-p.len / 2, a, 0, p.h, -p.t / 2, p.t / 2, "plaster", "простенок"));
      if (b < p.len / 2) out.push(span(b, p.len / 2, 0, p.h, -p.t / 2, p.t / 2, "plaster", "простенок"));
      if (p.dh < p.h) out.push(span(a, b, p.dh, p.h, -p.t / 2, p.t / 2, "plaster", "перемычка"));
      return { prims: out };
    },
  },

  {
    id: "wall_window",
    name: "Стена с оконным проёмом",
    group: "structure",
    mount: "floor",
    note: "Проём с подоконной частью. Высота подоконника — параметр.",
    params: [
      pLen, pHeight, pThick,
      P("ww", "Ширина проёма", 1.2, 0.4, 3, 0.05),
      P("wh", "Высота проёма", 1.4, 0.4, 2.4, 0.05),
      P("sill", "Низ проёма", 0.85, 0.1, 1.8, 0.05),
      P("off", "Смещение проёма", 0, -4, 4, 0.05),
    ],
    build: (p) => {
      const { a, b } = opening(p.len, p.ww, p.off);
      const topY = Math.min(p.h, p.sill + p.wh);
      const out: Prim[] = [];
      if (a > -p.len / 2) out.push(span(-p.len / 2, a, 0, p.h, -p.t / 2, p.t / 2, "plaster", "простенок"));
      if (b < p.len / 2) out.push(span(b, p.len / 2, 0, p.h, -p.t / 2, p.t / 2, "plaster", "простенок"));
      out.push(span(a, b, 0, p.sill, -p.t / 2, p.t / 2, "plaster", "подоконная часть"));
      if (topY < p.h) out.push(span(a, b, topY, p.h, -p.t / 2, p.t / 2, "plaster", "перемычка"));
      // Отлив снаружи: по нему на скриншоте видно, где у стены улица.
      out.push(span(a - 0.03, b + 0.03, p.sill - 0.03, p.sill, -p.t / 2 - 0.04, -p.t / 2 + 0.02, "metal", "отлив"));
      return { prims: out };
    },
  },

  {
    id: "wall_arch",
    name: "Стена с аркой",
    group: "structure",
    mount: "floor",
    note: "Проём со скруглением, набранным ступенями. Ступени мельче — дуга глаже.",
    params: [
      pLen, pHeight, pThick,
      P("aw", "Ширина арки", 1.4, 0.6, 3, 0.05),
      P("ah", "Высота арки", 2.2, 1.6, 3.2, 0.05),
      PN("steps", "Ступеней дуги", 7, 3, 14),
    ],
    build: (p) => {
      const { a, b } = opening(p.len, p.aw, 0);
      const r = (b - a) / 2;
      const springY = p.ah - r; // отметка, с которой начинается дуга
      const out: Prim[] = [];
      if (a > -p.len / 2 + 1e-4) out.push(span(-p.len / 2, a, 0, p.h, -p.t / 2, p.t / 2, "plaster", "простенок"));
      if (b < p.len / 2 - 1e-4) out.push(span(b, p.len / 2, 0, p.h, -p.t / 2, p.t / 2, "plaster", "простенок"));
      const n = Math.max(3, Math.round(p.steps));
      for (let i = 0; i < n; i++) {
        const y0 = springY + (r * i) / n;
        const y1 = springY + (r * (i + 1)) / n;
        // Ширина ступени по окружности: чем выше, тем уже проём.
        const half = Math.sqrt(Math.max(0, r * r - Math.pow(y1 - springY, 2)));
        if (-half - a > 1e-4) out.push(span(a, -half, y0, y1, -p.t / 2, p.t / 2, "plaster", "дуга"));
        if (b - half > 1e-4) out.push(span(half, b, y0, y1, -p.t / 2, p.t / 2, "plaster", "дуга"));
      }
      if (p.ah < p.h) out.push(span(a, b, p.ah, p.h, -p.t / 2, p.t / 2, "plaster", "над аркой"));
      return { prims: out };
    },
  },

  {
    id: "partition",
    name: "Перегородка",
    group: "structure",
    mount: "floor",
    note: "Тонкая внутренняя стенка. Отдельным шаблоном, чтобы её не путали с наружной.",
    params: [pLen, pHeight, P("t", "Толщина", 0.12, 0.05, 0.25, 0.01)],
    build: (p) => ({
      prims: [span(-p.len / 2, p.len / 2, 0, p.h, -p.t / 2, p.t / 2, "plaster", "перегородка")],
    }),
  },

  {
    id: "slab",
    name: "Плита перекрытия",
    group: "structure",
    mount: "free",
    note: "Пол или потолок. Коробка, а не плоскость: у выреза должен быть торец.",
    params: [
      P("w", "Ширина", 4, 0.5, 16, 0.25),
      P("d", "Глубина", 4, 0.5, 16, 0.25),
      P("t", "Толщина", 0.2, 0.05, 0.5, 0.01),
    ],
    build: (p) => ({
      prims: [span(-p.w / 2, p.w / 2, -p.t, 0, -p.d / 2, p.d / 2, "concrete", "плита")],
    }),
  },

  {
    id: "slab_hole",
    name: "Плита с проёмом",
    group: "structure",
    mount: "free",
    note: "Перекрытие с вырезом под лестницу или люк. Собрано из четырёх кусков, а не пробито поверх.",
    params: [
      P("w", "Ширина", 5, 1, 16, 0.25),
      P("d", "Глубина", 5, 1, 16, 0.25),
      P("t", "Толщина", 0.2, 0.05, 0.5, 0.01),
      P("hw", "Ширина проёма", 2, 0.4, 8, 0.1),
      P("hd", "Глубина проёма", 2, 0.4, 8, 0.1),
      P("hx", "Проём по X", 0, -6, 6, 0.25),
      P("hz", "Проём по Z", 0, -6, 6, 0.25),
    ],
    build: (p) => {
      const x0 = -p.w / 2, x1 = p.w / 2, z0 = -p.d / 2, z1 = p.d / 2;
      const a = Math.max(x0, p.hx - p.hw / 2), b = Math.min(x1, p.hx + p.hw / 2);
      const c = Math.max(z0, p.hz - p.hd / 2), e = Math.min(z1, p.hz + p.hd / 2);
      const out: Prim[] = [];
      const put = (X0: number, X1: number, Z0: number, Z1: number) => {
        if (X1 - X0 > 1e-4 && Z1 - Z0 > 1e-4)
          out.push(span(X0, X1, -p.t, 0, Z0, Z1, "concrete", "плита"));
      };
      put(x0, x1, z0, c);
      put(x0, x1, e, z1);
      put(x0, a, c, e);
      put(b, x1, c, e);
      return { prims: out };
    },
  },

  {
    id: "column",
    name: "Колонна",
    group: "structure",
    mount: "floor",
    note: "Круглая или квадратная опора с базой и капителью.",
    params: [
      P("h", "Высота", 2.8, 1, 5, 0.05),
      P("r", "Радиус", 0.16, 0.05, 0.6, 0.01),
      PN("round", "Круглая (1) или квадратная (0)", 1, 0, 1),
    ],
    build: (p) => {
      const cap = 0.06;
      const body: Prim = p.round
        ? cyl(p.r, p.h - cap * 2, v(0, p.h / 2, 0), "concrete", { seg: 20, tag: "ствол" })
        : span(-p.r, p.r, cap, p.h - cap, -p.r, p.r, "concrete", "ствол");
      return {
        prims: [
          span(-p.r * 1.25, p.r * 1.25, 0, cap, -p.r * 1.25, p.r * 1.25, "concrete", "база"),
          body,
          span(-p.r * 1.25, p.r * 1.25, p.h - cap, p.h, -p.r * 1.25, p.r * 1.25, "concrete", "капитель"),
        ],
      };
    },
  },

  {
    id: "beam",
    name: "Балка",
    group: "structure",
    mount: "free",
    note: "Горизонтальный прогон. Начало координат — по низу, чтобы вешать под потолок.",
    params: [
      P("len", "Длина", 4, 0.5, 12, 0.25),
      P("w", "Ширина", 0.2, 0.05, 0.6, 0.01),
      P("h", "Высота", 0.3, 0.05, 0.8, 0.01),
    ],
    build: (p) => ({
      prims: [span(-p.len / 2, p.len / 2, 0, p.h, -p.w / 2, p.w / 2, "woodDark", "балка")],
    }),
  },

  {
    id: "stairs",
    name: "Марш лестницы",
    group: "structure",
    mount: "floor",
    note: "Подъём вдоль +X. Число ступеней считается от высоты, подступенок держится около 17 см.",
    params: [
      P("rise", "Подъём", 3, 0.3, 4.5, 0.05),
      P("w", "Ширина марша", 1.1, 0.6, 2.5, 0.05),
      P("tread", "Проступь", 0.28, 0.2, 0.4, 0.01),
      P("riser", "Подступенок", 0.17, 0.12, 0.22, 0.005),
      PN("closed", "С подступенками (1) или открытая (0)", 1, 0, 1),
    ],
    build: (p) => {
      const n = Math.max(1, Math.round(p.rise / p.riser));
      const step = p.rise / n;
      const runLen = n * p.tread;
      // Начало координат — в середине марша, как у всех остальных шаблонов.
      // Иначе лестница при повороте уезжает на всю свою длину.
      const x00 = -runLen / 2;
      const out: Prim[] = [];
      for (let i = 0; i < n; i++) {
        const x0 = x00 + i * p.tread;
        // Проступь чуть нависает над подступенком — так ступень читается.
        out.push(span(x0 - 0.02, x0 + p.tread, step * (i + 1) - 0.045, step * (i + 1),
          -p.w / 2, p.w / 2, "wood", "проступь"));
        if (p.closed)
          out.push(span(x0, x0 + 0.04, step * i, step * (i + 1) - 0.045, -p.w / 2, p.w / 2, "wood", "подступенок"));
      }
      // Косоуры по бокам: без них марш висит в воздухе.
      out.push(wedge(v(runLen, p.rise, 0.06), v(0, p.rise / 2, -p.w / 2 + 0.03), "woodDark", undefined, "косоур"));
      out.push(wedge(v(runLen, p.rise, 0.06), v(0, p.rise / 2, p.w / 2 - 0.03), "woodDark", undefined, "косоур"));
      return { prims: out };
    },
  },

  {
    id: "stairs_landing",
    name: "Площадка лестницы",
    group: "structure",
    mount: "free",
    note: "Промежуточная площадка между маршами.",
    params: [
      P("w", "Ширина", 1.4, 0.6, 4, 0.05),
      P("d", "Глубина", 1.4, 0.6, 4, 0.05),
      P("t", "Толщина", 0.18, 0.05, 0.4, 0.01),
    ],
    build: (p) => ({
      prims: [span(-p.w / 2, p.w / 2, -p.t, 0, -p.d / 2, p.d / 2, "concrete", "площадка")],
    }),
  },

  {
    id: "railing",
    name: "Ограждение",
    group: "structure",
    mount: "floor",
    note: "Стойки, поручень и продольный ригель. Высота по умолчанию — та, что не даёт шагнуть в провал.",
    params: [
      P("len", "Длина", 3, 0.5, 12, 0.25),
      P("h", "Высота", 1.05, 0.6, 1.4, 0.05),
      P("gap", "Шаг стоек", 0.75, 0.3, 1.5, 0.05),
      PN("bars", "Промежуточных ригелей", 1, 0, 4),
    ],
    build: (p) => {
      const out: Prim[] = [];
      const n = Math.max(2, Math.round(p.len / p.gap) + 1);
      for (let i = 0; i < n; i++) {
        const x = -p.len / 2 + (p.len * i) / (n - 1);
        out.push(span(x - 0.02, x + 0.02, 0, p.h - 0.04, -0.02, 0.02, "metalDark", "стойка"));
      }
      out.push(span(-p.len / 2 - 0.02, p.len / 2 + 0.02, p.h - 0.04, p.h, -0.03, 0.03, "metal", "поручень"));
      const bars = Math.max(0, Math.round(p.bars));
      for (let i = 1; i <= bars; i++) {
        const y = (p.h * i) / (bars + 1);
        out.push(span(-p.len / 2, p.len / 2, y - 0.012, y + 0.012, -0.012, 0.012, "metalDark", "ригель"));
      }
      return { prims: out };
    },
  },

  {
    id: "ladder",
    name: "Лестница вертикальная",
    group: "structure",
    mount: "floor",
    note: "Стальная лестница в люк или в шахту. Прижимается к стене.",
    params: [
      P("h", "Высота", 3, 1, 6, 0.1),
      P("w", "Ширина", 0.45, 0.3, 0.7, 0.05),
      P("gap", "Шаг ступеней", 0.3, 0.2, 0.4, 0.01),
    ],
    build: (p) => {
      const out: Prim[] = [
        span(-p.w / 2, -p.w / 2 + 0.04, 0, p.h, -0.03, 0.03, "steel", "тетива"),
        span(p.w / 2 - 0.04, p.w / 2, 0, p.h, -0.03, 0.03, "steel", "тетива"),
      ];
      const n = Math.max(1, Math.floor(p.h / p.gap));
      for (let i = 1; i <= n; i++)
        out.push(cyl(0.014, p.w, v(0, i * p.gap, 0), "steel", { seg: 8, rot: v(0, 0, 90), tag: "ступень" }));
      return { prims: out };
    },
  },

  {
    id: "doorcase",
    name: "Дверная коробка",
    group: "structure",
    mount: "floor",
    note: "Косяки и притолока вокруг проёма. Ставится отдельно от полотна.",
    params: [
      P("w", "Ширина проёма", 0.9, 0.5, 2.4, 0.05),
      P("h", "Высота проёма", 2.05, 1.6, 3, 0.05),
      P("t", "Ширина наличника", 0.06, 0.03, 0.15, 0.01),
      P("depth", "Глубина", 0.25, 0.08, 0.6, 0.01),
    ],
    build: (p) => ({ prims: doorCase(p.w, p.h, p.t, p.depth, "wood") }),
  },

  {
    id: "plinth",
    name: "Плинтус",
    group: "structure",
    mount: "wall",
    note: "Стык стены и пола. Мелочь, без которой комната выглядит недоделанной.",
    params: [
      P("len", "Длина", 3, 0.3, 12, 0.25),
      P("h", "Высота", 0.09, 0.04, 0.2, 0.01),
      P("t", "Вынос", 0.02, 0.01, 0.05, 0.005),
    ],
    build: (p) => ({
      prims: [span(-p.len / 2, p.len / 2, 0, p.h, -p.t, 0, "wood", "плинтус")],
    }),
  },

  {
    id: "cornice",
    name: "Карниз потолочный",
    group: "structure",
    mount: "wall",
    note: "Стык стены и потолка. Начало координат — на потолке.",
    params: [
      P("len", "Длина", 3, 0.3, 12, 0.25),
      P("h", "Высота", 0.08, 0.03, 0.25, 0.01),
    ],
    build: (p) => ({
      prims: [
        wedge(v(p.h, p.h, p.len), v(0, -p.h / 2, -p.h / 2), "plaster", v(0, 90, 0), "карниз"),
      ],
    }),
  },

  {
    id: "ramp",
    name: "Пандус",
    group: "structure",
    mount: "floor",
    note: "Наклонный въезд. Подъём вдоль +X.",
    params: [
      P("len", "Длина", 2, 0.5, 8, 0.1),
      P("w", "Ширина", 1.2, 0.5, 4, 0.1),
      P("rise", "Подъём", 0.4, 0.05, 1.5, 0.05),
    ],
    build: (p) => ({
      prims: [wedge(v(p.len, p.rise, p.w), v(0, p.rise / 2, 0), "concrete", undefined, "пандус")],
    }),
  },

  {
    id: "hatch_floor",
    name: "Люк в полу",
    group: "structure",
    mount: "free",
    note: "Обрамление и откидная крышка на петле. Крышка — подвижная часть.",
    params: [
      P("w", "Ширина", 1, 0.5, 2, 0.05),
      P("d", "Глубина", 1, 0.5, 2, 0.05),
      P("t", "Толщина крышки", 0.06, 0.02, 0.15, 0.01),
    ],
    build: (p) => {
      const lip = 0.05;
      return {
        prims: [
          span(-p.w / 2 - lip, p.w / 2 + lip, -0.02, 0.01, -p.d / 2 - lip, -p.d / 2, "steel", "обрамление"),
          span(-p.w / 2 - lip, p.w / 2 + lip, -0.02, 0.01, p.d / 2, p.d / 2 + lip, "steel", "обрамление"),
          span(-p.w / 2 - lip, -p.w / 2, -0.02, 0.01, -p.d / 2, p.d / 2, "steel", "обрамление"),
          span(p.w / 2, p.w / 2 + lip, -0.02, 0.01, -p.d / 2, p.d / 2, "steel", "обрамление"),
        ],
        parts: [{
          id: "lid",
          label: "Крышка",
          pivot: v(0, 0, -p.d / 2),
          prims: [
            span(-p.w / 2, p.w / 2, 0, p.t, 0, p.d, "steel", "крышка"),
            cyl(0.02, 0.12, v(0, p.t + 0.02, p.d - 0.15), "metalDark", { seg: 8, rot: v(0, 0, 90), tag: "ручка" }),
          ],
          motion: { kind: "swing", axis: "x", min: -110, max: 0, def: 0, label: "Открыть крышку" },
        }],
      };
    },
  },
];
