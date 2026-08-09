/**
 * openings.ts — двери, окна и всё, что открывается.
 *
 * Можно: описывать полотна, створки, коробки, стёкла.
 * Нельзя: знать про редактор и движок.
 *
 * Главное правило файла: дверь — это предмет со створкой, а не дырка.
 * Полотно живёт отдельной частью со своей петлёй, поэтому «открыть» —
 * это поворот вокруг косяка, а не исчезновение геометрии. В прошлом заходе
 * двери были дырками, и «закрытая дверь» означала просто стену: игрок не
 * понимал, заперто тут или так и было задумано.
 */

import { span, cyl, v, P, PN } from "../core.ts";
import type { Prim, TemplateDef, Part } from "../core.ts";
import { doorCase, frameXY, fillXY, leverHandle, hinges, pullHandle } from "../parts.ts";

/** Створка окна: рама с заполнением, собранная от петли. */
function sash(w: number, h: number, mat: "wood" | "metal"): Prim[] {
  const t = 0.045;
  return [...frameXY(w, h, t, 0.05, mat, -0.025), ...fillXY(w, h, t, 0.05, "glass", -0.025)];
}

export const OPENINGS: TemplateDef[] = [
  /* ---------------------------------------------------------------- */
  {
    id: "door_single",
    name: "Дверь одностворчатая",
    group: "openings",
    mount: "floor",
    note: "Коробка, полотно на петле, ручка. Петля слева; сторону меняет параметр.",
    params: [
      P("w", "Ширина проёма", 0.9, 0.6, 1.2, 0.05),
      P("h", "Высота проёма", 2.05, 1.7, 2.6, 0.05),
      P("t", "Толщина полотна", 0.045, 0.03, 0.08, 0.005),
      P("case", "Ширина наличника", 0.06, 0.03, 0.15, 0.01),
      P("depth", "Глубина коробки", 0.25, 0.1, 0.6, 0.01),
      PN("right", "Петля справа (1) или слева (0)", 0, 0, 1),
      PN("panels", "Филёнок", 2, 0, 4),
    ],
    build: (p) => {
      const s = p.right ? 1 : -1;
      const hingeX = s * (p.w / 2 - 0.01);
      // Полотно чуть уже проёма: иначе оно тёрлось бы о косяк.
      const leafW = p.w - 0.02;

      // Полотно строится ОТ петли внутрь проёма, то есть в +X. Если строить
      // его в −X, оно повиснет снаружи проёма: дверь будет открываться,
      // но стоять рядом с собственной коробкой.
      const leaf: Prim[] = [
        span(0.005, leafW, 0, p.h - 0.01, -p.t / 2, p.t / 2, "wood", "полотно"),
      ];
      const n = Math.max(0, Math.round(p.panels));
      for (let i = 0; i < n; i++) {
        // Филёнка — неглубокая выборка. Рисуем накладкой чуть тоньше полотна.
        const y0 = 0.12 + ((p.h - 0.3) * i) / n;
        const y1 = 0.12 + ((p.h - 0.3) * (i + 1)) / n - 0.09;
        if (y1 - y0 < 0.02 || leafW < 0.24) continue;
        leaf.push(span(0.09, leafW - 0.09, y0, y1, p.t / 2 - 0.008, p.t / 2 - 0.002, "woodDark", "филёнка"));
        leaf.push(span(0.09, leafW - 0.09, y0, y1, -p.t / 2 + 0.002, -p.t / 2 + 0.008, "woodDark", "филёнка"));
      }
      leaf.push(...leverHandle(v(leafW - 0.07, p.h * 0.5, p.t / 2), "metal", true));
      leaf.push(...leverHandle(v(leafW - 0.07, p.h * 0.5, -p.t / 2 - 0.014), "metal", false));

      const part: Part = {
        id: "leaf",
        label: "Полотно",
        pivot: v(hingeX, 0, 0),
        // Для правой петли полотно уходит в другую сторону — зеркалим по X.
        prims: p.right ? leaf.map((q) => ({ ...q, at: v(-q.at.x, q.at.y, q.at.z) })) : leaf,
        motion: { kind: "swing", axis: "y", min: -100, max: 100, def: 0, label: "Открыть дверь" },
      };

      return {
        prims: [
          ...doorCase(p.w, p.h, p.case, p.depth, "wood"),
          ...hinges(p.h, v(hingeX, 0, -p.t / 2 - 0.01), "metalDark", 3),
          span(-p.w / 2, p.w / 2, -0.005, 0.02, -p.depth / 2, p.depth / 2, "woodDark", "порог"),
        ],
        parts: [part],
      };
    },
  },

  {
    id: "door_double",
    name: "Дверь двустворчатая",
    group: "openings",
    mount: "floor",
    note: "Две створки, каждая на своей петле и открывается отдельно.",
    params: [
      P("w", "Ширина проёма", 1.6, 1, 2.6, 0.05),
      P("h", "Высота проёма", 2.2, 1.8, 3, 0.05),
      P("t", "Толщина полотна", 0.045, 0.03, 0.08, 0.005),
      P("case", "Ширина наличника", 0.07, 0.03, 0.15, 0.01),
      P("depth", "Глубина коробки", 0.3, 0.1, 0.6, 0.01),
    ],
    build: (p) => {
      const leafW = p.w / 2 - 0.015;
      const makeLeaf = (dir: 1 | -1): Prim[] => [
        span(dir < 0 ? -leafW : 0, dir < 0 ? 0 : leafW, 0, p.h - 0.01, -p.t / 2, p.t / 2, "wood", "полотно"),
        ...pullHandle(0.16, v(dir * (leafW - 0.09), p.h * 0.48, p.t / 2), "metal"),
      ];
      return {
        prims: [
          ...doorCase(p.w, p.h, p.case, p.depth, "wood"),
          ...hinges(p.h, v(-p.w / 2 + 0.01, 0, -p.t / 2 - 0.01), "metalDark", 3),
          ...hinges(p.h, v(p.w / 2 - 0.01, 0, -p.t / 2 - 0.01), "metalDark", 3),
          span(-p.w / 2, p.w / 2, -0.005, 0.02, -p.depth / 2, p.depth / 2, "woodDark", "порог"),
        ],
        parts: [
          {
            id: "leafL", label: "Створка левая",
            pivot: v(-p.w / 2 + 0.01, 0, 0),
            prims: makeLeaf(1),
            motion: { kind: "swing", axis: "y", min: -100, max: 100, def: 0, label: "Левая створка" },
          },
          {
            id: "leafR", label: "Створка правая",
            pivot: v(p.w / 2 - 0.01, 0, 0),
            prims: makeLeaf(-1),
            motion: { kind: "swing", axis: "y", min: -100, max: 100, def: 0, label: "Правая створка" },
          },
        ],
      };
    },
  },

  {
    id: "door_metal",
    name: "Дверь техническая",
    group: "openings",
    mount: "floor",
    note: "Стальная, с рёбрами и засовом. Для котельной, щитовой, чёрного хода.",
    params: [
      P("w", "Ширина проёма", 0.9, 0.6, 1.4, 0.05),
      P("h", "Высота проёма", 2.05, 1.7, 2.6, 0.05),
      P("t", "Толщина полотна", 0.06, 0.04, 0.12, 0.005),
      PN("ribs", "Рёбер жёсткости", 3, 0, 6),
    ],
    build: (p) => {
      const leafW = p.w - 0.02;
      const leaf: Prim[] = [span(-leafW, 0, 0, p.h - 0.01, -p.t / 2, p.t / 2, "steel", "полотно")];
      const n = Math.max(0, Math.round(p.ribs));
      for (let i = 1; i <= n; i++) {
        const y = (p.h * i) / (n + 1);
        leaf.push(span(-leafW + 0.05, -0.05, y - 0.02, y + 0.02, p.t / 2, p.t / 2 + 0.012, "steel", "ребро"));
      }
      leaf.push(...pullHandle(0.2, v(-leafW + 0.11, p.h * 0.48, p.t / 2 + 0.012), "metalDark", 0.05));
      leaf.push(span(-leafW + 0.04, -leafW + 0.28, p.h * 0.44, p.h * 0.52, p.t / 2, p.t / 2 + 0.03, "metalDark", "засов"));

      return {
        prims: [
          ...doorCase(p.w, p.h, 0.05, 0.25, "steel"),
          ...hinges(p.h, v(-p.w / 2 + 0.01, 0, -p.t / 2 - 0.015), "metalDark", 3),
          span(-p.w / 2, p.w / 2, -0.005, 0.03, -0.12, 0.12, "steel", "порог"),
        ],
        parts: [{
          id: "leaf", label: "Полотно",
          pivot: v(-p.w / 2 + 0.01, 0, 0),
          prims: leaf.map((q) => ({ ...q, at: v(-q.at.x, q.at.y, q.at.z) })),
          motion: { kind: "swing", axis: "y", min: -110, max: 0, def: 0, label: "Открыть дверь" },
        }],
      };
    },
  },

  {
    id: "door_sliding",
    name: "Дверь раздвижная",
    group: "openings",
    mount: "floor",
    note: "Полотно едет вдоль стены по верхней направляющей. Движение — сдвиг, не поворот.",
    params: [
      P("w", "Ширина проёма", 1, 0.6, 2.2, 0.05),
      P("h", "Высота проёма", 2.05, 1.7, 2.8, 0.05),
      P("t", "Толщина полотна", 0.045, 0.03, 0.08, 0.005),
    ],
    build: (p) => ({
      prims: [
        span(-p.w * 1.05, p.w * 1.05, p.h + 0.02, p.h + 0.08, -0.05, 0.02, "metal", "направляющая"),
        span(-p.w / 2, p.w / 2, -0.005, 0.01, -0.05, 0.05, "metalDark", "нижний упор"),
      ],
      parts: [{
        id: "leaf", label: "Полотно",
        pivot: v(0, 0, 0.06),
        prims: [
          span(-p.w / 2, p.w / 2, 0.02, p.h, -p.t / 2, p.t / 2, "wood", "полотно"),
          cyl(0.02, 0.03, v(-p.w / 2 + 0.12, p.h + 0.02, 0), "metal", { seg: 8, tag: "ролик" }),
          cyl(0.02, 0.03, v(p.w / 2 - 0.12, p.h + 0.02, 0), "metal", { seg: 8, tag: "ролик" }),
          ...pullHandle(0.14, v(p.w / 2 - 0.12, p.h * 0.48, p.t / 2), "metal"),
        ],
        motion: { kind: "slide", axis: "x", min: 0, max: 2.2, def: 0, label: "Отодвинуть" },
      }],
    }),
  },

  {
    id: "window",
    name: "Окно",
    group: "openings",
    mount: "opening",
    note: "Коробка, отлив, подоконник и открывающиеся створки. Число створок — параметр.",
    params: [
      P("w", "Ширина проёма", 1.2, 0.5, 3, 0.05),
      P("h", "Высота проёма", 1.4, 0.5, 2.4, 0.05),
      P("depth", "Глубина коробки", 0.25, 0.1, 0.6, 0.01),
      PN("sashes", "Створок", 2, 1, 3),
      PN("openable", "Открывающихся", 1, 0, 3),
    ],
    build: (p) => {
      const n = Math.max(1, Math.round(p.sashes));
      const open = Math.min(n, Math.max(0, Math.round(p.openable)));
      const cell = p.w / n;
      const prims: Prim[] = [
        ...frameXY(p.w, p.h, 0.06, p.depth * 0.5, "wood", -p.depth * 0.25),
        // Подоконник внутрь и отлив наружу — по ним видно, где улица.
        span(-p.w / 2 - 0.05, p.w / 2 + 0.05, -0.04, 0, p.depth * 0.25, p.depth * 0.25 + 0.14, "wood", "подоконник"),
        span(-p.w / 2 - 0.03, p.w / 2 + 0.03, -0.03, 0, -p.depth * 0.25 - 0.06, -p.depth * 0.25, "metal", "отлив"),
      ];
      const parts: Part[] = [];

      for (let i = 0; i < n; i++) {
        const cx = -p.w / 2 + cell * (i + 0.5);
        if (i < open) {
          const dir = i % 2 === 0 ? -1 : 1;
          const hinge = cx + (dir * cell) / 2;
          parts.push({
            id: `sash${i}`,
            label: `Створка ${i + 1}`,
            pivot: v(hinge, 0, 0),
            prims: sash(cell - 0.02, p.h - 0.02, "wood")
              .map((q) => ({ ...q, at: v(q.at.x - dir * (cell / 2 - 0.01), q.at.y + 0.01, q.at.z) })),
            motion: { kind: "swing", axis: "y", min: -95, max: 95, def: 0, label: `Открыть створку ${i + 1}` },
          });
        } else {
          prims.push(...sash(cell - 0.02, p.h - 0.02, "wood")
            .map((q) => ({ ...q, at: v(q.at.x + cx, q.at.y + 0.01, q.at.z) })));
        }
        if (i > 0)
          prims.push(span(-p.w / 2 + cell * i - 0.03, -p.w / 2 + cell * i + 0.03, 0, p.h,
            -p.depth * 0.25, p.depth * 0.25, "wood", "импост"));
      }

      return { prims, parts };
    },
  },

  {
    id: "window_round",
    name: "Окно круглое",
    group: "openings",
    mount: "opening",
    note: "Глухое круглое окно. Обод набран сегментами, стекло — диском.",
    params: [
      P("r", "Радиус", 0.35, 0.15, 1, 0.05),
      P("t", "Толщина обода", 0.07, 0.03, 0.2, 0.01),
      PN("seg", "Сегментов обода", 16, 8, 32),
    ],
    build: (p) => {
      const prims: Prim[] = [
        cyl(p.r - p.t * 0.6, 0.012, v(0, 0, 0), "glass", { seg: 24, rot: v(90, 0, 0), tag: "стекло" }),
      ];
      const n = Math.max(8, Math.round(p.seg));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 360;
        const rad = (a * Math.PI) / 180;
        const mid = p.r - p.t / 2;
        prims.push(span(-Math.PI * p.r / n, Math.PI * p.r / n, -p.t / 2, p.t / 2, -0.03, 0.03, "wood", "обод"));
        const last = prims[prims.length - 1];
        last.at = v(Math.cos(rad) * mid, Math.sin(rad) * mid, 0);
        last.rot = v(0, 0, a);
      }
      return { prims };
    },
  },

  {
    id: "shutters",
    name: "Ставни",
    group: "openings",
    mount: "opening",
    note: "Две глухие створки поверх окна. Закрытые — сюжетная деталь, открытые — вид.",
    params: [
      P("w", "Ширина проёма", 1.2, 0.5, 2.5, 0.05),
      P("h", "Высота проёма", 1.4, 0.5, 2.4, 0.05),
      PN("slats", "Ламелей", 7, 0, 14),
    ],
    build: (p) => {
      const leafW = p.w / 2 - 0.01;
      const make = (dir: 1 | -1): Prim[] => {
        const out: Prim[] = [
          span(dir < 0 ? -leafW : 0, dir < 0 ? 0 : leafW, 0, p.h, -0.02, 0.02, "woodDark", "створка"),
        ];
        const n = Math.max(0, Math.round(p.slats));
        for (let i = 0; i < n; i++) {
          const y = 0.06 + ((p.h - 0.12) * (i + 0.5)) / n;
          out.push(span(dir < 0 ? -leafW + 0.05 : 0.05, dir < 0 ? -0.05 : leafW - 0.05,
            y - 0.018, y + 0.018, 0.02, 0.034, "wood", "ламель"));
        }
        return out;
      };
      return {
        prims: [],
        parts: [
          {
            id: "left", label: "Ставня левая", pivot: v(-p.w / 2, 0, 0), prims: make(1),
            motion: { kind: "swing", axis: "y", min: -160, max: 0, def: 0, label: "Левая ставня" },
          },
          {
            id: "right", label: "Ставня правая", pivot: v(p.w / 2, 0, 0), prims: make(-1),
            motion: { kind: "swing", axis: "y", min: 0, max: 160, def: 0, label: "Правая ставня" },
          },
        ],
      };
    },
  },

  {
    id: "grate",
    name: "Решётка",
    group: "openings",
    mount: "opening",
    note: "Стальная решётка на окно или приямок. Шаг прутьев — параметр.",
    params: [
      P("w", "Ширина", 1.2, 0.3, 3, 0.05),
      P("h", "Высота", 1.4, 0.3, 2.4, 0.05),
      P("gap", "Шаг прутьев", 0.14, 0.06, 0.4, 0.01),
      P("r", "Толщина прутка", 0.012, 0.005, 0.03, 0.001),
    ],
    build: (p) => {
      const out: Prim[] = [
        span(-p.w / 2, p.w / 2, 0, 0.03, -0.02, 0.02, "steel", "обвязка"),
        span(-p.w / 2, p.w / 2, p.h - 0.03, p.h, -0.02, 0.02, "steel", "обвязка"),
      ];
      const n = Math.max(1, Math.floor(p.w / p.gap));
      for (let i = 1; i < n; i++) {
        const x = -p.w / 2 + (p.w * i) / n;
        out.push(cyl(p.r, p.h, v(x, p.h / 2, 0), "steel", { seg: 6, tag: "пруток" }));
      }
      const m = Math.max(1, Math.floor(p.h / (p.gap * 2.5)));
      for (let i = 1; i < m; i++) {
        const y = (p.h * i) / m;
        out.push(cyl(p.r, p.w, v(0, y, 0), "steel", { seg: 6, rot: v(0, 0, 90), tag: "пруток" }));
      }
      return { prims: out };
    },
  },

  {
    id: "curtain",
    name: "Штора",
    group: "openings",
    mount: "wall",
    note: "Карниз и две полы. Складки набраны призмами — на просвет читаются как ткань.",
    params: [
      P("w", "Ширина карниза", 1.6, 0.6, 4, 0.1),
      P("h", "Высота", 2, 0.5, 3, 0.05),
      PN("folds", "Складок на полу", 6, 3, 14),
      P("open", "Раздвинуто", 0.25, 0, 0.9, 0.05),
    ],
    build: (p) => {
      const out: Prim[] = [
        cyl(0.016, p.w + 0.2, v(0, p.h, 0), "metalDark", { seg: 10, rot: v(0, 0, 90), tag: "карниз" }),
      ];
      const n = Math.max(3, Math.round(p.folds));
      const panelW = (p.w / 2) * (1 - p.open);
      for (const side of [-1, 1]) {
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          const x = side * (p.w / 2 - panelW * t);
          out.push(span(x - panelW / n / 2, x + panelW / n / 2, 0.02, p.h - 0.02,
            -0.03 - (i % 2) * 0.02, 0.03 + (i % 2) * 0.02, "fabric", "пола"));
        }
      }
      return { prims: out };
    },
  },
];
