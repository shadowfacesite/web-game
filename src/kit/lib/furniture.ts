/**
 * furniture.ts — мебель и техника.
 *
 * Можно: описывать предметы обстановки.
 * Нельзя: знать про редактор и движок.
 *
 * Размеры по умолчанию взяты человеческие, а не «на глаз»: столешница 0.75,
 * сиденье 0.45, кухонный фронт 0.6 глубиной и 0.9 высотой, кровать 2.0 в
 * длину. По этим числам предмет сразу читается в масштабе; если поставить
 * стол высотой метр, дом мгновенно становится кукольным, а понять причину
 * по скриншоту трудно.
 */

import { span, cyl, v, P, PN } from "../core.ts";
import type { Prim, TemplateDef, Part } from "../core.ts";
import { legs4, legs4Round, carcass, shelves, plinth, pullHandle, feet4 } from "../parts.ts";

export const FURNITURE: TemplateDef[] = [
  /* --- столы и сиденья --------------------------------------------- */
  {
    id: "table",
    name: "Стол",
    group: "furniture",
    mount: "floor",
    note: "Столешница на четырёх ножках с царгой. Годится и обеденным, и рабочим.",
    params: [
      P("w", "Длина", 1.4, 0.6, 3, 0.05),
      P("d", "Глубина", 0.8, 0.4, 1.4, 0.05),
      P("h", "Высота", 0.75, 0.4, 1.1, 0.01),
      P("top", "Толщина столешницы", 0.04, 0.02, 0.1, 0.005),
      P("leg", "Сечение ножки", 0.07, 0.03, 0.15, 0.005),
    ],
    build: (p) => ({
      prims: [
        span(-p.w / 2, p.w / 2, p.h - p.top, p.h, -p.d / 2, p.d / 2, "wood", "столешница"),
        ...legs4(p.w, p.d, p.h - p.top, p.leg, "wood"),
        // Царга связывает ножки. Без неё стол на скриншоте выглядит хлипко.
        span(-p.w / 2 + 0.08, p.w / 2 - 0.08, p.h - p.top - 0.09, p.h - p.top,
          -p.d / 2 + 0.06, -p.d / 2 + 0.09, "wood", "царга"),
        span(-p.w / 2 + 0.08, p.w / 2 - 0.08, p.h - p.top - 0.09, p.h - p.top,
          p.d / 2 - 0.09, p.d / 2 - 0.06, "wood", "царга"),
      ],
    }),
  },

  {
    id: "desk",
    name: "Стол письменный",
    group: "furniture",
    mount: "floor",
    note: "С тумбой и выдвижным ящиком. Ящик — подвижная часть.",
    params: [
      P("w", "Длина", 1.3, 0.9, 2.2, 0.05),
      P("d", "Глубина", 0.65, 0.5, 0.9, 0.05),
      P("h", "Высота", 0.75, 0.65, 0.85, 0.01),
      PN("side", "Тумба справа (1) или слева (0)", 1, 0, 1),
    ],
    build: (p) => {
      const s = p.side ? 1 : -1;
      const pedW = 0.42;
      const pedX = s * (p.w / 2 - pedW / 2 - 0.02);
      const drawerH = 0.16;
      return {
        prims: [
          span(-p.w / 2, p.w / 2, p.h - 0.04, p.h, -p.d / 2, p.d / 2, "wood", "столешница"),
          // Тумба
          ...carcass(pedW, p.d - 0.04, p.h - 0.04, 0.018, "wood", 0.06)
            .map((q) => ({ ...q, at: v(q.at.x + pedX, q.at.y, q.at.z) })),
          span(pedX - pedW / 2 + 0.03, pedX + pedW / 2 - 0.03, 0, 0.06, -p.d / 2 + 0.06, p.d / 2 - 0.03, "woodDark", "цоколь"),
          // Опора с другой стороны
          span(-s * (p.w / 2 - 0.03), -s * (p.w / 2 - 0.06), 0, p.h - 0.04, -p.d / 2 + 0.04, p.d / 2 - 0.04, "wood", "щека"),
        ],
        parts: [{
          id: "drawer",
          label: "Ящик",
          pivot: v(pedX, p.h - 0.04 - drawerH - 0.05, p.d / 2 - 0.02),
          prims: [
            span(-pedW / 2 + 0.03, pedW / 2 - 0.03, 0, drawerH, 0, 0.02, "wood", "фасад"),
            ...pullHandle(0.12, v(0, drawerH / 2, 0.02), "metal", 0.03),
          ],
          motion: { kind: "slide", axis: "z", min: 0, max: 0.45, def: 0, label: "Выдвинуть ящик" },
        }],
      };
    },
  },

  {
    id: "chair",
    name: "Стул",
    group: "furniture",
    mount: "floor",
    note: "Сиденье, спинка, четыре ножки с проножками.",
    params: [
      P("w", "Ширина", 0.45, 0.35, 0.6, 0.01),
      P("d", "Глубина", 0.45, 0.35, 0.6, 0.01),
      P("seat", "Высота сиденья", 0.45, 0.35, 0.6, 0.01),
      P("back", "Высота спинки", 0.45, 0.15, 0.8, 0.01),
    ],
    build: (p) => {
      const legT = 0.035;
      const out: Prim[] = [
        span(-p.w / 2, p.w / 2, p.seat - 0.035, p.seat, -p.d / 2, p.d / 2, "wood", "сиденье"),
        ...legs4(p.w, p.d, p.seat - 0.035, legT, "wood", 0.02),
        // Проножки: две по бокам, одна сзади.
        span(-p.w / 2 + 0.02, p.w / 2 - 0.02, p.seat * 0.35, p.seat * 0.35 + 0.025,
          -p.d / 2 + 0.02, -p.d / 2 + 0.045, "wood", "проножка"),
      ];
      // Спинка: две стойки и две перекладины.
      const bx = p.w / 2 - 0.04;
      for (const sx of [-bx, bx])
        out.push(span(sx - legT / 2, sx + legT / 2, p.seat, p.seat + p.back,
          -p.d / 2 + 0.02, -p.d / 2 + 0.02 + legT, "wood", "стойка спинки"));
      out.push(span(-bx, bx, p.seat + p.back - 0.07, p.seat + p.back,
        -p.d / 2 + 0.02, -p.d / 2 + 0.05, "wood", "перекладина"));
      out.push(span(-bx, bx, p.seat + p.back * 0.45, p.seat + p.back * 0.45 + 0.05,
        -p.d / 2 + 0.02, -p.d / 2 + 0.05, "wood", "перекладина"));
      return { prims: out };
    },
  },

  {
    id: "stool",
    name: "Табурет",
    group: "furniture",
    mount: "floor",
    note: "Круглое или квадратное сиденье без спинки.",
    params: [
      P("w", "Ширина", 0.36, 0.25, 0.5, 0.01),
      P("h", "Высота", 0.45, 0.3, 0.8, 0.01),
      PN("round", "Круглый (1) или квадратный (0)", 0, 0, 1),
    ],
    build: (p) => ({
      prims: [
        p.round
          ? cyl(p.w / 2, 0.035, v(0, p.h - 0.018, 0), "wood", { seg: 18, tag: "сиденье" })
          : span(-p.w / 2, p.w / 2, p.h - 0.035, p.h, -p.w / 2, p.w / 2, "wood", "сиденье"),
        ...(p.round
          ? legs4Round(p.w, p.w, p.h - 0.035, 0.018, "wood", 0.05)
          : legs4(p.w, p.w, p.h - 0.035, 0.032, "wood", 0.02)),
      ],
    }),
  },

  {
    id: "armchair",
    name: "Кресло",
    group: "furniture",
    mount: "floor",
    note: "Мягкое, с подлокотниками и подушкой сиденья.",
    params: [
      P("w", "Ширина", 0.8, 0.6, 1.1, 0.05),
      P("d", "Глубина", 0.85, 0.6, 1.1, 0.05),
      P("h", "Высота спинки", 0.9, 0.6, 1.2, 0.05),
      P("seat", "Высота сиденья", 0.42, 0.3, 0.55, 0.01),
    ],
    build: (p) => {
      const arm = 0.16;
      return {
        prims: [
          span(-p.w / 2, p.w / 2, 0.08, p.seat, -p.d / 2, p.d / 2, "fabric", "основание"),
          span(-p.w / 2 + arm, p.w / 2 - arm, p.seat, p.seat + 0.12, -p.d / 2 + 0.08, p.d / 2 - 0.05, "fabric", "подушка"),
          span(-p.w / 2, p.w / 2, p.seat, p.h, -p.d / 2, -p.d / 2 + 0.16, "fabric", "спинка"),
          span(-p.w / 2, -p.w / 2 + arm, p.seat, p.seat + 0.24, -p.d / 2, p.d / 2 - 0.04, "fabric", "подлокотник"),
          span(p.w / 2 - arm, p.w / 2, p.seat, p.seat + 0.24, -p.d / 2, p.d / 2 - 0.04, "fabric", "подлокотник"),
          ...feet4(p.w, p.d, 0.08, "woodDark"),
        ],
      };
    },
  },

  {
    id: "sofa",
    name: "Диван",
    group: "furniture",
    mount: "floor",
    note: "Две-четыре подушки. Число мест — параметр.",
    params: [
      P("w", "Длина", 1.9, 1.2, 3.2, 0.05),
      P("d", "Глубина", 0.9, 0.7, 1.1, 0.05),
      P("h", "Высота спинки", 0.85, 0.6, 1.1, 0.05),
      PN("seats", "Мест", 3, 2, 4),
    ],
    build: (p) => {
      const arm = 0.18;
      const seatY = 0.42;
      const out: Prim[] = [
        span(-p.w / 2, p.w / 2, 0.09, seatY, -p.d / 2, p.d / 2, "fabricDark", "основание"),
        span(-p.w / 2, p.w / 2, seatY, p.h, -p.d / 2, -p.d / 2 + 0.18, "fabricDark", "спинка"),
        span(-p.w / 2, -p.w / 2 + arm, seatY, seatY + 0.26, -p.d / 2, p.d / 2 - 0.04, "fabricDark", "подлокотник"),
        span(p.w / 2 - arm, p.w / 2, seatY, seatY + 0.26, -p.d / 2, p.d / 2 - 0.04, "fabricDark", "подлокотник"),
        ...feet4(p.w, p.d, 0.09, "woodDark"),
      ];
      const n = Math.max(2, Math.round(p.seats));
      const inner = p.w - arm * 2;
      for (let i = 0; i < n; i++) {
        const x = -inner / 2 + (inner * (i + 0.5)) / n;
        out.push(span(x - inner / n / 2 + 0.015, x + inner / n / 2 - 0.015, seatY, seatY + 0.13,
          -p.d / 2 + 0.18, p.d / 2 - 0.05, "fabric", "подушка"));
      }
      return { prims: out };
    },
  },

  {
    id: "bench",
    name: "Скамья",
    group: "furniture",
    mount: "floor",
    note: "Простая лавка без спинки. Для прихожей, подвала, мастерской.",
    params: [
      P("w", "Длина", 1.4, 0.6, 3, 0.05),
      P("d", "Глубина", 0.35, 0.25, 0.6, 0.01),
      P("h", "Высота", 0.45, 0.3, 0.7, 0.01),
    ],
    build: (p) => ({
      prims: [
        span(-p.w / 2, p.w / 2, p.h - 0.04, p.h, -p.d / 2, p.d / 2, "wood", "сиденье"),
        span(-p.w / 2 + 0.08, -p.w / 2 + 0.13, 0, p.h - 0.04, -p.d / 2 + 0.03, p.d / 2 - 0.03, "wood", "щека"),
        span(p.w / 2 - 0.13, p.w / 2 - 0.08, 0, p.h - 0.04, -p.d / 2 + 0.03, p.d / 2 - 0.03, "wood", "щека"),
        span(-p.w / 2 + 0.1, p.w / 2 - 0.1, p.h * 0.35, p.h * 0.35 + 0.03, -0.02, 0.02, "wood", "проножка"),
      ],
    }),
  },

  /* --- корпусная ---------------------------------------------------- */
  {
    id: "wardrobe",
    name: "Шкаф платяной",
    group: "furniture",
    mount: "floor",
    note: "Корпус со штангой и двумя распашными дверцами. Дверцы открываются отдельно.",
    params: [
      P("w", "Ширина", 1, 0.5, 2.4, 0.05),
      P("d", "Глубина", 0.6, 0.4, 0.8, 0.05),
      P("h", "Высота", 2.1, 1.4, 2.6, 0.05),
      PN("doors", "Дверец", 2, 1, 3),
    ],
    build: (p) => {
      const t = 0.018;
      const base = 0.08;
      const bodyH = p.h - base;
      const prims: Prim[] = [
        ...carcass(p.w, p.d, bodyH, t, "wood", base),
        ...plinth(p.w, p.d, base, "woodDark"),
        cyl(0.014, p.w - t * 4, v(0, base + bodyH - 0.32, 0), "metal", { seg: 8, rot: v(0, 0, 90), tag: "штанга" }),
        span(-p.w / 2 + t, p.w / 2 - t, base + bodyH - 0.24, base + bodyH - 0.22, -p.d / 2 + t, p.d / 2, "wood", "антресоль"),
      ];
      const n = Math.max(1, Math.round(p.doors));
      const parts: Part[] = [];
      const leafW = p.w / n - 0.01;
      for (let i = 0; i < n; i++) {
        const left = -p.w / 2 + (p.w * i) / n;
        const hingeLeft = i % 2 === 0;
        const hx = hingeLeft ? left : left + p.w / n;
        const dir = hingeLeft ? 1 : -1;
        parts.push({
          id: `door${i}`,
          label: `Дверца ${i + 1}`,
          pivot: v(hx, 0, p.d / 2),
          prims: [
            span(dir > 0 ? 0.005 : -leafW, dir > 0 ? leafW : -0.005, base + 0.01, base + bodyH - 0.01,
              0, 0.018, "wood", "дверца"),
            ...pullHandle(0.1, v(dir * (leafW - 0.06), base + bodyH * 0.5, 0.018), "metal", 0.03),
          ],
          motion: { kind: "swing", axis: "y", min: -110, max: 110, def: 0, label: `Дверца ${i + 1}` },
        });
      }
      return { prims, parts };
    },
  },

  {
    id: "bookcase",
    name: "Стеллаж",
    group: "furniture",
    mount: "floor",
    note: "Открытый, с настраиваемым числом полок. Без задней стенки видно стену за ним.",
    params: [
      P("w", "Ширина", 0.9, 0.4, 2.4, 0.05),
      P("d", "Глубина", 0.32, 0.2, 0.6, 0.02),
      P("h", "Высота", 1.9, 0.6, 2.6, 0.05),
      PN("shelves", "Полок", 4, 1, 8),
      PN("back", "Задняя стенка", 1, 0, 1),
    ],
    build: (p) => ({
      prims: [
        ...carcass(p.w, p.d, p.h, 0.02, "wood", 0, !!p.back),
        ...shelves(p.w, p.d, p.h, 0.02, p.shelves, "wood"),
      ],
    }),
  },

  {
    id: "shelf_metal",
    name: "Стеллаж металлический",
    group: "furniture",
    mount: "floor",
    note: "Складской, на уголках. Для котельной, кладовой, гаража.",
    params: [
      P("w", "Ширина", 1, 0.6, 2.4, 0.1),
      P("d", "Глубина", 0.45, 0.3, 0.8, 0.05),
      P("h", "Высота", 2, 1, 2.6, 0.05),
      PN("shelves", "Полок", 4, 2, 7),
    ],
    build: (p) => {
      const out: Prim[] = [];
      const post = 0.04;
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          out.push(span(sx * (p.w / 2 - post), sx * (p.w / 2), 0, p.h,
            sz * (p.d / 2 - post), sz * (p.d / 2), "steel", "стойка"));
      const n = Math.max(2, Math.round(p.shelves));
      for (let i = 0; i < n; i++) {
        const y = 0.12 + ((p.h - 0.2) * i) / (n - 1);
        out.push(span(-p.w / 2, p.w / 2, y, y + 0.022, -p.d / 2, p.d / 2, "steel", "полка"));
      }
      return { prims: out };
    },
  },

  {
    id: "cabinet",
    name: "Тумба",
    group: "furniture",
    mount: "floor",
    note: "Низкий корпус с дверцей или ящиками.",
    params: [
      P("w", "Ширина", 0.6, 0.3, 1.6, 0.05),
      P("d", "Глубина", 0.45, 0.3, 0.7, 0.05),
      P("h", "Высота", 0.8, 0.4, 1.2, 0.05),
      PN("drawers", "Ящиков", 3, 0, 5),
    ],
    build: (p) => {
      const t = 0.018;
      const base = 0.06;
      const bodyH = p.h - base;
      const prims: Prim[] = [...carcass(p.w, p.d, bodyH, t, "wood", base), ...plinth(p.w, p.d, base, "woodDark")];
      const n = Math.max(0, Math.round(p.drawers));
      const parts: Part[] = [];
      if (n === 0) {
        parts.push({
          id: "door", label: "Дверца", pivot: v(-p.w / 2 + 0.01, 0, p.d / 2),
          prims: [
            span(0.005, p.w - 0.02, base + 0.01, base + bodyH - 0.01, 0, 0.018, "wood", "дверца"),
            ...pullHandle(0.09, v(p.w - 0.08, base + bodyH * 0.5, 0.018), "metal", 0.03),
          ],
          motion: { kind: "swing", axis: "y", min: -110, max: 110, def: 0, label: "Дверца" },
        });
      } else {
        const cell = (bodyH - 0.04) / n;
        for (let i = 0; i < n; i++) {
          const y = base + 0.02 + cell * i;
          parts.push({
            id: `drawer${i}`, label: `Ящик ${i + 1}`, pivot: v(0, y, p.d / 2),
            prims: [
              span(-p.w / 2 + 0.03, p.w / 2 - 0.03, 0.006, cell - 0.006, 0, 0.018, "wood", "фасад"),
              ...pullHandle(Math.min(0.18, p.w * 0.4), v(0, cell / 2, 0.018), "metal", 0.03),
            ],
            motion: { kind: "slide", axis: "z", min: 0, max: p.d * 0.7, def: 0, label: `Ящик ${i + 1}` },
          });
        }
      }
      return { prims, parts };
    },
  },

  {
    id: "nightstand",
    name: "Тумбочка",
    group: "furniture",
    mount: "floor",
    note: "Прикроватная, с одним ящиком и открытой нишей.",
    params: [
      P("w", "Ширина", 0.42, 0.3, 0.7, 0.02),
      P("d", "Глубина", 0.38, 0.25, 0.6, 0.02),
      P("h", "Высота", 0.55, 0.4, 0.8, 0.01),
    ],
    build: (p) => ({
      prims: [
        ...carcass(p.w, p.d, p.h - 0.06, 0.016, "wood", 0.06),
        ...legs4(p.w, p.d, 0.06, 0.03, "woodDark", 0.03),
        span(-p.w / 2 + 0.016, p.w / 2 - 0.016, p.h * 0.52, p.h * 0.52 + 0.016, -p.d / 2 + 0.016, p.d / 2, "wood", "полка"),
      ],
      parts: [{
        id: "drawer", label: "Ящик", pivot: v(0, p.h - 0.24, p.d / 2),
        prims: [
          span(-p.w / 2 + 0.025, p.w / 2 - 0.025, 0.006, 0.16, 0, 0.016, "wood", "фасад"),
          ...pullHandle(0.1, v(0, 0.083, 0.016), "metal", 0.028),
        ],
        motion: { kind: "slide", axis: "z", min: 0, max: 0.3, def: 0, label: "Выдвинуть ящик" },
      }],
    }),
  },

  {
    id: "shelf_wall",
    name: "Полка настенная",
    group: "furniture",
    mount: "wall",
    note: "Доска на двух кронштейнах. Прижимается к стене, растёт в −Z.",
    params: [
      P("w", "Длина", 0.9, 0.3, 2, 0.05),
      P("d", "Глубина", 0.25, 0.12, 0.5, 0.01),
      P("t", "Толщина", 0.025, 0.015, 0.06, 0.005),
    ],
    build: (p) => ({
      prims: [
        span(-p.w / 2, p.w / 2, 0, p.t, -p.d, 0, "wood", "полка"),
        span(-p.w / 2 + 0.1, -p.w / 2 + 0.13, -0.12, 0, -p.d + 0.03, -0.01, "metalDark", "кронштейн"),
        span(p.w / 2 - 0.13, p.w / 2 - 0.1, -0.12, 0, -p.d + 0.03, -0.01, "metalDark", "кронштейн"),
      ],
    }),
  },

  /* --- спальня ------------------------------------------------------ */
  {
    id: "bed",
    name: "Кровать",
    group: "furniture",
    mount: "floor",
    note: "Каркас, матрас, подушки, одеяло. Ширина по умолчанию — односпальная.",
    params: [
      P("w", "Ширина", 0.9, 0.7, 2, 0.05),
      P("len", "Длина", 2, 1.6, 2.2, 0.05),
      P("h", "Высота матраса", 0.5, 0.3, 0.7, 0.01),
      P("head", "Высота изголовья", 0.95, 0.5, 1.4, 0.05),
      PN("pillows", "Подушек", 1, 0, 3),
    ],
    build: (p) => {
      const frame = 0.05;
      const mat = 0.2;
      const out: Prim[] = [
        span(-p.w / 2, p.w / 2, p.h - mat - frame, p.h - mat, -p.len / 2, p.len / 2, "woodDark", "основание"),
        span(-p.w / 2, p.w / 2, p.h - mat, p.h, -p.len / 2 + 0.02, p.len / 2 - 0.02, "fabric", "матрас"),
        span(-p.w / 2, p.w / 2, 0, p.head, -p.len / 2 - 0.04, -p.len / 2, "woodDark", "изголовье"),
        span(-p.w / 2, p.w / 2, 0, p.h - mat + 0.08, p.len / 2, p.len / 2 + 0.04, "woodDark", "изножье"),
        ...legs4(p.w, p.len, p.h - mat - frame, 0.06, "woodDark", 0.04),
        // Одеяло: чуть выше матраса и не доходит до изголовья.
        span(-p.w / 2 + 0.02, p.w / 2 - 0.02, p.h, p.h + 0.06, -p.len / 2 + 0.45, p.len / 2 - 0.04, "fabricDark", "одеяло"),
      ];
      const n = Math.max(0, Math.round(p.pillows));
      for (let i = 0; i < n; i++) {
        const cell = p.w / n;
        const x = -p.w / 2 + cell * (i + 0.5);
        out.push(span(x - Math.min(cell, 0.6) / 2 + 0.02, x + Math.min(cell, 0.6) / 2 - 0.02,
          p.h, p.h + 0.1, -p.len / 2 + 0.06, -p.len / 2 + 0.42, "fabric", "подушка"));
      }
      return { prims: out };
    },
  },

  {
    id: "crib",
    name: "Детская кроватка",
    group: "furniture",
    mount: "floor",
    note: "С решётчатыми боковинами. Прутья редеют при увеличении шага.",
    params: [
      P("w", "Ширина", 0.7, 0.5, 0.9, 0.05),
      P("len", "Длина", 1.25, 1, 1.6, 0.05),
      P("h", "Высота", 0.95, 0.7, 1.2, 0.05),
      P("gap", "Шаг прутьев", 0.09, 0.05, 0.16, 0.005),
    ],
    build: (p) => {
      const out: Prim[] = [
        span(-p.w / 2, p.w / 2, 0.35, 0.4, -p.len / 2, p.len / 2, "woodPale", "основание"),
        span(-p.w / 2 + 0.02, p.w / 2 - 0.02, 0.4, 0.5, -p.len / 2 + 0.02, p.len / 2 - 0.02, "fabric", "матрасик"),
      ];
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          out.push(span(sx * (p.w / 2 - 0.04), sx * (p.w / 2), 0, p.h, sz * (p.len / 2 - 0.04), sz * (p.len / 2), "woodPale", "стойка"));
      const rail = (z: number) => {
        out.push(span(-p.w / 2, p.w / 2, p.h - 0.05, p.h, z - 0.02, z + 0.02, "woodPale", "поручень"));
        const n = Math.max(2, Math.floor(p.w / p.gap));
        for (let i = 1; i < n; i++) {
          const x = -p.w / 2 + (p.w * i) / n;
          out.push(cyl(0.012, p.h - 0.4, v(x, 0.4 + (p.h - 0.4) / 2, z), "woodPale", { seg: 6, tag: "пруток" }));
        }
      };
      rail(-p.len / 2 + 0.02);
      rail(p.len / 2 - 0.02);
      const nz = Math.max(2, Math.floor(p.len / p.gap));
      for (const sx of [-1, 1]) {
        out.push(span(sx * (p.w / 2 - 0.04), sx * (p.w / 2), p.h - 0.05, p.h, -p.len / 2, p.len / 2, "woodPale", "поручень"));
        for (let i = 1; i < nz; i++) {
          const z = -p.len / 2 + (p.len * i) / nz;
          out.push(cyl(0.012, p.h - 0.4, v(sx * (p.w / 2 - 0.02), 0.4 + (p.h - 0.4) / 2, z), "woodPale", { seg: 6, tag: "пруток" }));
        }
      }
      return { prims: out };
    },
  },

  /* --- кухня и сантехника ------------------------------------------- */
  {
    id: "kitchen_unit",
    name: "Кухонный модуль",
    group: "furniture",
    mount: "floor",
    note: "Нижний шкаф со столешницей. Высота и глубина — стандартные кухонные.",
    params: [
      P("w", "Ширина", 0.6, 0.3, 1.2, 0.05),
      P("d", "Глубина", 0.6, 0.4, 0.75, 0.05),
      P("h", "Высота", 0.9, 0.8, 1, 0.01),
      PN("doors", "Дверец", 1, 0, 2),
    ],
    build: (p) => {
      const base = 0.1;
      const top = 0.04;
      const bodyH = p.h - base - top;
      const prims: Prim[] = [
        ...carcass(p.w, p.d, bodyH, 0.018, "woodPale", base),
        ...plinth(p.w, p.d, base, "metalDark", 0.05),
        span(-p.w / 2 - 0.01, p.w / 2 + 0.01, p.h - top, p.h, -p.d / 2, p.d / 2 + 0.02, "concrete", "столешница"),
      ];
      const n = Math.max(0, Math.round(p.doors));
      const parts: Part[] = [];
      for (let i = 0; i < n; i++) {
        const leafW = p.w / n - 0.008;
        const left = -p.w / 2 + (p.w * i) / n;
        const hingeLeft = i === 0;
        const hx = hingeLeft ? left : left + p.w / n;
        const dir = hingeLeft ? 1 : -1;
        parts.push({
          id: `door${i}`, label: `Дверца ${i + 1}`, pivot: v(hx, 0, p.d / 2),
          prims: [
            span(dir > 0 ? 0.004 : -leafW, dir > 0 ? leafW : -0.004, base, base + bodyH, 0, 0.018, "woodPale", "фасад"),
            ...pullHandle(0.1, v(dir * (leafW - 0.05), base + bodyH - 0.06, 0.018), "metal", 0.028),
          ],
          motion: { kind: "swing", axis: "y", min: -110, max: 110, def: 0, label: `Дверца ${i + 1}` },
        });
      }
      return { prims, parts };
    },
  },

  {
    id: "sink",
    name: "Раковина",
    group: "furniture",
    mount: "floor",
    note: "Чаша, смеситель и сифон. Ставится на пол или в кухонный ряд.",
    params: [
      P("w", "Ширина", 0.55, 0.35, 1.2, 0.05),
      P("d", "Глубина", 0.45, 0.3, 0.65, 0.05),
      P("h", "Высота", 0.85, 0.7, 1, 0.01),
    ],
    build: (p) => ({
      prims: [
        span(-p.w / 2, p.w / 2, p.h - 0.16, p.h, -p.d / 2, p.d / 2, "ceramic", "чаша"),
        span(-p.w / 2 + 0.05, p.w / 2 - 0.05, p.h - 0.14, p.h - 0.02, -p.d / 2 + 0.05, p.d / 2 - 0.05, "dirt", "нутро"),
        span(-0.09, 0.09, 0, p.h - 0.16, -p.d / 2 + 0.06, p.d / 2 - 0.06, "ceramic", "пьедестал"),
        cyl(0.02, 0.22, v(0, p.h + 0.11, -p.d / 2 + 0.07), "metal", { seg: 10, tag: "смеситель" }),
        cyl(0.014, 0.14, v(0, p.h + 0.2, -p.d / 2 + 0.14), "metal", { seg: 8, rot: v(90, 0, 0), tag: "излив" }),
      ],
    }),
  },

  {
    id: "toilet",
    name: "Унитаз",
    group: "furniture",
    mount: "floor",
    note: "Чаша и бачок. Прижимается спинкой к стене (−Z).",
    params: [
      P("w", "Ширина", 0.37, 0.3, 0.5, 0.01),
      P("d", "Глубина", 0.68, 0.5, 0.85, 0.01),
      P("h", "Высота бачка", 0.78, 0.6, 1, 0.01),
    ],
    build: (p) => ({
      prims: [
        span(-p.w / 2 + 0.06, p.w / 2 - 0.06, 0, 0.36, -p.d / 2 + 0.1, p.d / 2 - 0.06, "ceramic", "нога"),
        span(-p.w / 2, p.w / 2, 0.36, 0.42, -p.d / 2 + 0.06, p.d / 2, "ceramic", "чаша"),
        span(-p.w / 2 + 0.02, p.w / 2 - 0.02, 0.42, 0.45, -p.d / 2 + 0.08, p.d / 2 - 0.02, "plaster", "сиденье"),
        span(-p.w / 2, p.w / 2, 0.36, p.h, -p.d / 2, -p.d / 2 + 0.18, "ceramic", "бачок"),
        span(-0.05, 0.05, p.h, p.h + 0.02, -p.d / 2 + 0.05, -p.d / 2 + 0.12, "metal", "кнопка"),
      ],
    }),
  },

  {
    id: "bathtub",
    name: "Ванна",
    group: "furniture",
    mount: "floor",
    note: "Чугунная, с бортом и смесителем. Нутро отдельным объёмом — видно, что она пустая.",
    params: [
      P("w", "Длина", 1.7, 1.2, 2, 0.05),
      P("d", "Ширина", 0.75, 0.6, 0.9, 0.05),
      P("h", "Высота", 0.6, 0.45, 0.75, 0.01),
    ],
    build: (p) => ({
      prims: [
        span(-p.w / 2, p.w / 2, 0.1, p.h, -p.d / 2, p.d / 2, "ceramic", "корпус"),
        span(-p.w / 2 + 0.07, p.w / 2 - 0.07, p.h - 0.34, p.h - 0.02, -p.d / 2 + 0.07, p.d / 2 - 0.07, "dirt", "нутро"),
        ...feet4(p.w, p.d, 0.1, "metalDark"),
        cyl(0.02, 0.2, v(-p.w / 2 + 0.12, p.h + 0.1, -p.d / 2 + 0.06), "metal", { seg: 10, tag: "смеситель" }),
      ],
    }),
  },

  {
    id: "stove",
    name: "Плита",
    group: "furniture",
    mount: "floor",
    note: "Четыре конфорки, духовка с дверцей и ручка. Дверца открывается вниз.",
    params: [
      P("w", "Ширина", 0.6, 0.5, 0.9, 0.05),
      P("d", "Глубина", 0.6, 0.5, 0.7, 0.05),
      P("h", "Высота", 0.85, 0.8, 0.95, 0.01),
    ],
    build: (p) => {
      const prims: Prim[] = [
        span(-p.w / 2, p.w / 2, 0.05, p.h, -p.d / 2, p.d / 2, "metal", "корпус"),
        span(-p.w / 2, p.w / 2, p.h, p.h + 0.015, -p.d / 2, p.d / 2, "metalDark", "варочная панель"),
        ...feet4(p.w, p.d, 0.05, "metalDark"),
        span(-p.w / 2, p.w / 2, p.h + 0.015, p.h + 0.22, -p.d / 2, -p.d / 2 + 0.05, "metal", "задняя панель"),
      ];
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          prims.push(cyl(0.075, 0.012, v(sx * p.w * 0.22, p.h + 0.02, sz * p.d * 0.2), "metalDark", { seg: 16, tag: "конфорка" }));
      for (let i = 0; i < 4; i++)
        prims.push(cyl(0.018, 0.02, v(-p.w / 2 + p.w * (0.2 + i * 0.2), p.h + 0.12, -p.d / 2 + 0.02), "metalDark", { seg: 10, rot: v(90, 0, 0), tag: "ручка" }));
      return {
        prims,
        parts: [{
          id: "oven", label: "Дверца духовки", pivot: v(0, 0.14, p.d / 2),
          prims: [
            span(-p.w / 2 + 0.02, p.w / 2 - 0.02, 0, p.h - 0.24, 0, 0.03, "metalDark", "дверца"),
            span(-p.w / 2 + 0.08, p.w / 2 - 0.08, 0.08, p.h - 0.34, 0.028, 0.036, "glass", "стекло"),
            cyl(0.016, p.w - 0.16, v(0, p.h - 0.3, 0.07), "metal", { seg: 8, rot: v(0, 0, 90), tag: "ручка" }),
          ],
          motion: { kind: "swing", axis: "x", min: 0, max: 90, def: 0, label: "Открыть духовку" },
        }],
      };
    },
  },

  {
    id: "fridge",
    name: "Холодильник",
    group: "furniture",
    mount: "floor",
    note: "Две камеры, обе дверцы открываются. Петли справа.",
    params: [
      P("w", "Ширина", 0.6, 0.45, 0.9, 0.05),
      P("d", "Глубина", 0.62, 0.5, 0.8, 0.02),
      P("h", "Высота", 1.8, 1.2, 2.1, 0.05),
      P("split", "Доля морозилки", 0.3, 0.15, 0.5, 0.05),
    ],
    build: (p) => {
      const freezeH = p.h * p.split;
      const mk = (y0: number, y1: number, name: string): Part => ({
        id: name, label: name === "top" ? "Морозильная камера" : "Холодильная камера",
        pivot: v(p.w / 2 - 0.01, 0, p.d / 2),
        prims: [
          span(-(p.w - 0.02), -0.005, y0, y1, 0, 0.05, "plaster", "дверца"),
          ...pullHandle(Math.min(0.25, y1 - y0 - 0.1), v(-(p.w - 0.09), (y0 + y1) / 2, 0.05), "metal", 0.04)
            .map((q) => ({ ...q, rot: v(0, 0, 90) })),
        ],
        motion: { kind: "swing", axis: "y", min: -120, max: 0, def: 0, label: name === "top" ? "Морозилка" : "Холодильник" },
      });
      return {
        prims: [
          span(-p.w / 2, p.w / 2, 0.04, p.h, -p.d / 2, p.d / 2 - 0.05, "plaster", "корпус"),
          span(-p.w / 2, p.w / 2, p.h - freezeH - 0.015, p.h - freezeH, -p.d / 2, p.d / 2, "metalDark", "разделитель"),
          ...feet4(p.w, p.d, 0.04, "metalDark"),
        ],
        parts: [mk(p.h - freezeH + 0.005, p.h - 0.01, "top"), mk(0.06, p.h - freezeH - 0.02, "bottom")],
      };
    },
  },

  {
    id: "washer",
    name: "Стиральная машина",
    group: "furniture",
    mount: "floor",
    note: "С круглым люком и панелью. Люк открывается.",
    params: [
      P("w", "Ширина", 0.6, 0.45, 0.7, 0.01),
      P("d", "Глубина", 0.55, 0.4, 0.7, 0.01),
      P("h", "Высота", 0.85, 0.75, 0.95, 0.01),
    ],
    build: (p) => ({
      prims: [
        span(-p.w / 2, p.w / 2, 0.03, p.h, -p.d / 2, p.d / 2, "plaster", "корпус"),
        span(-p.w / 2, p.w / 2, p.h - 0.13, p.h - 0.01, p.d / 2 - 0.005, p.d / 2 + 0.008, "metalDark", "панель"),
        cyl(0.022, 0.02, v(p.w * 0.3, p.h - 0.07, p.d / 2 + 0.012), "metal", { seg: 12, rot: v(90, 0, 0), tag: "селектор" }),
        ...feet4(p.w, p.d, 0.03, "rubber"),
      ],
      parts: [{
        id: "hatch", label: "Люк", pivot: v(-p.w / 2 + 0.04, p.h * 0.45, p.d / 2),
        prims: [
          cyl(Math.min(p.w, p.h) * 0.28, 0.05, v(p.w * 0.42, 0, 0.02), "metalDark", { seg: 20, rot: v(90, 0, 0), tag: "люк" }),
          cyl(Math.min(p.w, p.h) * 0.21, 0.055, v(p.w * 0.42, 0, 0.022), "glass", { seg: 20, rot: v(90, 0, 0), tag: "стекло" }),
        ],
        motion: { kind: "swing", axis: "y", min: -150, max: 0, def: 0, label: "Открыть люк" },
      }],
    }),
  },

  {
    id: "radiator",
    name: "Радиатор",
    group: "furniture",
    mount: "wall",
    note: "Секционный, с подводкой. Число секций — параметр.",
    params: [
      PN("sections", "Секций", 8, 3, 20),
      P("h", "Высота", 0.5, 0.3, 0.9, 0.05),
      P("d", "Глубина", 0.1, 0.06, 0.2, 0.01),
    ],
    build: (p) => {
      const n = Math.max(3, Math.round(p.sections));
      const pitch = 0.08;
      const w = n * pitch;
      const out: Prim[] = [];
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + pitch * (i + 0.5);
        out.push(span(x - 0.028, x + 0.028, 0, p.h, -p.d, 0, "plaster", "секция"));
      }
      out.push(span(-w / 2, w / 2, p.h - 0.05, p.h - 0.02, -p.d * 0.6, -p.d * 0.4, "plaster", "коллектор"));
      out.push(span(-w / 2, w / 2, 0.02, 0.05, -p.d * 0.6, -p.d * 0.4, "plaster", "коллектор"));
      out.push(cyl(0.012, 0.16, v(-w / 2 - 0.02, 0.04, -p.d * 0.5), "metal", { seg: 8, rot: v(0, 0, 90), tag: "подводка" }));
      return { prims: out };
    },
  },

  {
    id: "mirror",
    name: "Зеркало",
    group: "furniture",
    mount: "wall",
    note: "В раме. Отражения на блокауте нет — материал заменится позже.",
    params: [
      P("w", "Ширина", 0.6, 0.2, 1.6, 0.05),
      P("h", "Высота", 0.9, 0.2, 2.2, 0.05),
      P("t", "Ширина рамы", 0.04, 0.01, 0.12, 0.005),
    ],
    build: (p) => ({
      prims: [
        span(-p.w / 2, p.w / 2, 0, p.t, -0.03, 0, "wood", "рама"),
        span(-p.w / 2, p.w / 2, p.h - p.t, p.h, -0.03, 0, "wood", "рама"),
        span(-p.w / 2, -p.w / 2 + p.t, p.t, p.h - p.t, -0.03, 0, "wood", "рама"),
        span(p.w / 2 - p.t, p.w / 2, p.t, p.h - p.t, -0.03, 0, "wood", "рама"),
        span(-p.w / 2 + p.t, p.w / 2 - p.t, p.t, p.h - p.t, -0.018, -0.012, "mirror", "полотно"),
      ],
    }),
  },

  {
    id: "rug",
    name: "Ковёр",
    group: "furniture",
    mount: "floor",
    note: "Плоский, с каймой. Топится в пол на миллиметр, чтобы не спорил с ним.",
    params: [
      P("w", "Ширина", 2, 0.5, 5, 0.1),
      P("d", "Длина", 1.4, 0.5, 5, 0.1),
      P("edge", "Кайма", 0.12, 0, 0.4, 0.02),
    ],
    build: (p) => {
      const out: Prim[] = [
        span(-p.w / 2, p.w / 2, -0.001, 0.008, -p.d / 2, p.d / 2, "fabricDark", "ковёр"),
      ];
      if (p.edge > 0.01)
        out.push(span(-p.w / 2 + p.edge, p.w / 2 - p.edge, 0.008, 0.011,
          -p.d / 2 + p.edge, p.d / 2 - p.edge, "fabric", "поле"));
      return { prims: out };
    },
  },
];
