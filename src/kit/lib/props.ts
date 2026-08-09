/**
 * props.ts — реквизит, свет и электрика.
 *
 * Можно: описывать мелочь, которой обживается комната.
 * Нельзя: знать про редактор и движок.
 *
 * Мелочь важнее, чем кажется. Пустая комната с четырьмя стенами и кроватью
 * читается как недоделанный уровень независимо от того, насколько хороша
 * кровать. Ведро, труба вдоль стены, выключатель у двери и щиток в коридоре
 * делают для правдоподобия больше, чем ещё один шкаф.
 */

import { span, cyl, ball, box, v, P, PN } from "../core.ts";
import type { Prim, TemplateDef } from "../core.ts";

export const PROPS: TemplateDef[] = [
  /* --- тара и хлам --------------------------------------------------- */
  {
    id: "crate",
    name: "Ящик деревянный",
    group: "props",
    mount: "floor",
    note: "Дощатый, с рёбрами. Ставится штабелем — грани ровные.",
    params: [
      P("w", "Ширина", 0.6, 0.2, 1.6, 0.05),
      P("d", "Глубина", 0.45, 0.2, 1.2, 0.05),
      P("h", "Высота", 0.4, 0.15, 1.2, 0.05),
      PN("open", "Открытый сверху", 0, 0, 1),
    ],
    build: (p) => {
      const t = 0.018;
      const out: Prim[] = [
        span(-p.w / 2, p.w / 2, 0, t, -p.d / 2, p.d / 2, "wood", "дно"),
        span(-p.w / 2, p.w / 2, 0, p.h, -p.d / 2, -p.d / 2 + t, "wood", "стенка"),
        span(-p.w / 2, p.w / 2, 0, p.h, p.d / 2 - t, p.d / 2, "wood", "стенка"),
        span(-p.w / 2, -p.w / 2 + t, 0, p.h, -p.d / 2, p.d / 2, "wood", "стенка"),
        span(p.w / 2 - t, p.w / 2, 0, p.h, -p.d / 2, p.d / 2, "wood", "стенка"),
      ];
      if (!p.open) out.push(span(-p.w / 2, p.w / 2, p.h - t, p.h, -p.d / 2, p.d / 2, "wood", "крышка"));
      // Рёбра по углам: без них ящик читается как сплошной куб.
      for (const sx of [-1, 1])
        out.push(span(sx * (p.w / 2 - 0.05), sx * (p.w / 2 + 0.004), 0, p.h,
          -p.d / 2 - 0.004, p.d / 2 + 0.004, "woodDark", "ребро"));
      return { prims: out };
    },
  },

  {
    id: "box_cardboard",
    name: "Коробка картонная",
    group: "props",
    mount: "floor",
    note: "С отогнутыми клапанами. Мнётся по-разному в зависимости от размера.",
    params: [
      P("w", "Ширина", 0.4, 0.2, 0.8, 0.05),
      P("d", "Глубина", 0.3, 0.2, 0.8, 0.05),
      P("h", "Высота", 0.3, 0.15, 0.7, 0.05),
      PN("flaps", "Клапаны отогнуты", 1, 0, 1),
    ],
    build: (p) => {
      const out: Prim[] = [
        span(-p.w / 2, p.w / 2, 0, p.h, -p.d / 2, p.d / 2, "paper", "коробка"),
      ];
      if (p.flaps) {
        out.push(box(v(p.w, 0.006, p.d * 0.45), v(0, p.h + 0.05, -p.d * 0.32), "paper", v(-35, 0, 0), "клапан"));
        out.push(box(v(p.w, 0.006, p.d * 0.45), v(0, p.h + 0.05, p.d * 0.32), "paper", v(35, 0, 0), "клапан"));
      }
      out.push(span(-p.w * 0.3, p.w * 0.3, p.h * 0.55, p.h * 0.62, p.d / 2, p.d / 2 + 0.002, "dirt", "наклейка"));
      return { prims: out };
    },
  },

  {
    id: "barrel",
    name: "Бочка",
    group: "props",
    mount: "floor",
    note: "Стальная, с обручами. Годится в котельную и во двор.",
    params: [
      P("r", "Радиус", 0.29, 0.15, 0.5, 0.01),
      P("h", "Высота", 0.88, 0.4, 1.2, 0.02),
      PN("open", "Без крышки", 0, 0, 1),
    ],
    build: (p) => {
      const out: Prim[] = [
        cyl(p.r, p.h, v(0, p.h / 2, 0), "rust", { seg: 20, tag: "корпус" }),
        cyl(p.r + 0.015, 0.04, v(0, p.h * 0.25, 0), "metalDark", { seg: 20, tag: "обруч" }),
        cyl(p.r + 0.015, 0.04, v(0, p.h * 0.75, 0), "metalDark", { seg: 20, tag: "обруч" }),
      ];
      if (p.open) out.push(cyl(p.r - 0.02, 0.02, v(0, p.h - 0.05, 0), "dirt", { seg: 20, tag: "нутро" }));
      else out.push(cyl(p.r + 0.01, 0.03, v(0, p.h + 0.01, 0), "metalDark", { seg: 20, tag: "крышка" }));
      return { prims: out };
    },
  },

  {
    id: "bucket",
    name: "Ведро",
    group: "props",
    mount: "floor",
    note: "Конус с дужкой. Мелкий предмет-масштаб: по нему видно, не великанская ли комната.",
    params: [
      P("r", "Радиус верха", 0.14, 0.08, 0.25, 0.01),
      P("h", "Высота", 0.3, 0.15, 0.45, 0.01),
    ],
    build: (p) => ({
      prims: [
        cyl(p.r, p.h, v(0, p.h / 2, 0), "metal", { r2: p.r * 0.75, seg: 16, tag: "корпус" }),
        cyl(p.r * 0.9, 0.015, v(0, p.h - 0.02, 0), "dirt", { seg: 16, tag: "нутро" }),
        cyl(0.006, p.r * 2, v(0, p.h + p.r * 0.6, 0), "metal", { seg: 6, rot: v(0, 0, 90), tag: "дужка" }),
      ],
    }),
  },

  {
    id: "toolbox",
    name: "Ящик с инструментом",
    group: "props",
    mount: "floor",
    note: "Металлический, с ручкой и защёлками.",
    params: [
      P("w", "Ширина", 0.45, 0.25, 0.7, 0.05),
      P("d", "Глубина", 0.22, 0.15, 0.4, 0.01),
      P("h", "Высота", 0.2, 0.12, 0.35, 0.01),
    ],
    build: (p) => ({
      prims: [
        span(-p.w / 2, p.w / 2, 0, p.h, -p.d / 2, p.d / 2, "metalDark", "корпус"),
        span(-p.w / 2 - 0.006, p.w / 2 + 0.006, p.h * 0.55, p.h * 0.62, -p.d / 2 - 0.006, p.d / 2 + 0.006, "metal", "поясок"),
        cyl(0.008, p.w * 0.45, v(0, p.h + 0.06, 0), "metal", { seg: 8, rot: v(0, 0, 90), tag: "ручка" }),
        span(-0.03, 0.03, p.h * 0.5, p.h * 0.68, p.d / 2, p.d / 2 + 0.008, "metal", "защёлка"),
      ],
    }),
  },

  /* --- трубы и техника ----------------------------------------------- */
  {
    id: "pipe",
    name: "Труба",
    group: "props",
    mount: "free",
    note: "Прямой участок с фланцами. Идёт вдоль X — поворачивается куда угодно.",
    params: [
      P("len", "Длина", 2, 0.2, 12, 0.1),
      P("r", "Радиус", 0.05, 0.01, 0.25, 0.005),
      PN("flange", "Фланцы по концам", 1, 0, 1),
    ],
    build: (p) => {
      const out: Prim[] = [
        cyl(p.r, p.len, v(0, 0, 0), "rust", { seg: 14, rot: v(0, 0, 90), tag: "труба" }),
      ];
      if (p.flange)
        for (const s of [-1, 1])
          out.push(cyl(p.r * 1.5, 0.03, v(s * (p.len / 2 - 0.02), 0, 0), "metalDark", { seg: 14, rot: v(0, 0, 90), tag: "фланец" }));
      return { prims: out };
    },
  },

  {
    id: "pipe_elbow",
    name: "Отвод трубы",
    group: "props",
    mount: "free",
    note: "Поворот на 90°: из +X в +Y. Собирается с прямыми участками в трассу.",
    params: [
      P("r", "Радиус трубы", 0.05, 0.01, 0.25, 0.005),
      P("arm", "Длина плеча", 0.3, 0.1, 1, 0.05),
    ],
    build: (p) => ({
      prims: [
        cyl(p.r, p.arm, v(p.arm / 2, 0, 0), "rust", { seg: 14, rot: v(0, 0, 90), tag: "плечо" }),
        cyl(p.r, p.arm, v(0, p.arm / 2, 0), "rust", { seg: 14, tag: "плечо" }),
        ball(p.r * 1.05, v(0, 0, 0), "rust", { seg: 12, tag: "колено" }),
      ],
    }),
  },

  {
    id: "valve",
    name: "Вентиль",
    group: "props",
    mount: "free",
    note: "Корпус, шток и маховик. Маховик крутится вокруг своей оси.",
    params: [
      P("r", "Радиус маховика", 0.11, 0.05, 0.3, 0.01),
      P("body", "Радиус корпуса", 0.05, 0.02, 0.15, 0.005),
    ],
    build: (p) => ({
      prims: [
        cyl(p.body, p.body * 2.4, v(0, 0, 0), "metalDark", { seg: 12, rot: v(0, 0, 90), tag: "корпус" }),
        cyl(p.body * 0.3, p.r * 0.9, v(0, p.r * 0.45, 0), "metal", { seg: 8, tag: "шток" }),
      ],
      parts: [{
        id: "wheel", label: "Маховик", pivot: v(0, p.r * 0.9, 0),
        prims: [
          cyl(p.r, 0.018, v(0, 0, 0), "rust", { seg: 18, tag: "обод" }),
          cyl(p.r * 0.8, 0.03, v(0, 0, 0), "rust", { seg: 4, rot: v(0, 45, 0), tag: "спица" }),
        ],
        motion: { kind: "swing", axis: "y", min: -720, max: 720, def: 0, label: "Повернуть маховик" },
      }],
    }),
  },

  {
    id: "panel_electric",
    name: "Электрощит",
    group: "props",
    mount: "wall",
    note: "Шкаф с дверцей и автоматами. Дверца открывается.",
    params: [
      P("w", "Ширина", 0.4, 0.25, 0.9, 0.05),
      P("h", "Высота", 0.55, 0.3, 1.2, 0.05),
      P("d", "Глубина", 0.14, 0.08, 0.3, 0.01),
      PN("breakers", "Автоматов", 6, 2, 16),
    ],
    build: (p) => {
      const prims: Prim[] = [
        span(-p.w / 2, p.w / 2, 0, p.h, -p.d, 0, "metalDark", "корпус"),
        span(-p.w / 2 + 0.03, p.w / 2 - 0.03, p.h * 0.42, p.h * 0.58, -p.d + 0.02, -p.d + 0.05, "plaster", "рейка"),
      ];
      const n = Math.max(2, Math.round(p.breakers));
      const cell = (p.w - 0.1) / n;
      for (let i = 0; i < n; i++) {
        const x = -p.w / 2 + 0.05 + cell * (i + 0.5);
        prims.push(span(x - cell * 0.35, x + cell * 0.35, p.h * 0.44, p.h * 0.56, -p.d + 0.05, -p.d + 0.09, "plaster", "автомат"));
        prims.push(span(x - cell * 0.15, x + cell * 0.15, p.h * 0.5, p.h * 0.55, -p.d + 0.09, -p.d + 0.1, "metalDark", "рычажок"));
      }
      return {
        prims,
        parts: [{
          id: "door", label: "Дверца щита", pivot: v(-p.w / 2, 0, 0),
          prims: [
            span(0.004, p.w, 0, p.h, -0.012, 0, "metalDark", "дверца"),
            cyl(0.012, 0.03, v(p.w - 0.05, p.h / 2, 0.004), "metal", { seg: 8, rot: v(90, 0, 0), tag: "замок" }),
          ],
          motion: { kind: "swing", axis: "y", min: -130, max: 0, def: 0, label: "Открыть щит" },
        }],
      };
    },
  },

  /* --- свет и электрика ---------------------------------------------- */
  {
    id: "lamp_ceiling",
    name: "Светильник потолочный",
    group: "light",
    mount: "ceiling",
    note: "Патрон на шнуре и плафон. Начало координат — точка крепления к потолку.",
    params: [
      P("cord", "Длина шнура", 0.5, 0.02, 2, 0.05),
      P("r", "Радиус плафона", 0.16, 0.05, 0.5, 0.01),
      PN("shade", "Плафон: конус (0) или шар (1)", 0, 0, 1),
    ],
    build: (p) => {
      const y = -p.cord;
      return {
        prims: [
          cyl(0.05, 0.03, v(0, -0.015, 0), "plaster", { seg: 12, tag: "розетка потолка" }),
          cyl(0.005, p.cord, v(0, -p.cord / 2, 0), "metalDark", { seg: 6, tag: "шнур" }),
          cyl(0.022, 0.07, v(0, y - 0.035, 0), "ceramic", { seg: 10, tag: "патрон" }),
          p.shade
            ? ball(p.r, v(0, y - 0.035 - p.r * 0.6, 0), "lightOn", { seg: 14, tag: "плафон" })
            : cyl(p.r, p.r * 0.9, v(0, y - 0.07 - p.r * 0.45, 0), "lightOn", { r2: p.r * 0.35, seg: 18, tag: "плафон" }),
        ],
      };
    },
  },

  {
    id: "lamp_wall",
    name: "Бра",
    group: "light",
    mount: "wall",
    note: "Настенный светильник с кронштейном.",
    params: [
      P("arm", "Вынос", 0.18, 0.05, 0.5, 0.01),
      P("r", "Радиус плафона", 0.1, 0.05, 0.25, 0.01),
    ],
    build: (p) => {
      // Кронштейн не может быть короче плафона: иначе плафон окажется
      // внутри стены, а на скриншоте это выглядит как пропавшая деталь.
      const arm = Math.max(p.arm, p.r + 0.05);
      return {
        prims: [
          span(-0.05, 0.05, -0.07, 0.07, -0.03, 0, "metalDark", "основание"),
          cyl(0.012, arm, v(0, 0, -arm / 2), "metalDark", { seg: 8, rot: v(90, 0, 0), tag: "кронштейн" }),
          cyl(p.r, p.r * 0.8, v(0, p.r * 0.35, -arm), "lightOn", { r2: p.r * 0.5, seg: 14, rot: v(180, 0, 0), tag: "плафон" }),
        ],
      };
    },
  },

  {
    id: "lamp_work",
    name: "Лампа переносная",
    group: "light",
    mount: "free",
    note: "Лампа в проволочной клетке на крюке. Подвал, чердак, стройка.",
    params: [
      P("r", "Радиус клетки", 0.07, 0.04, 0.15, 0.005),
      PN("bars", "Прутьев клетки", 6, 4, 12),
    ],
    build: (p) => {
      const out: Prim[] = [
        cyl(0.02, 0.06, v(0, 0.03, 0), "rubber", { seg: 10, tag: "патрон" }),
        ball(p.r * 0.62, v(0, -p.r * 0.55, 0), "lightOn", { seg: 12, tag: "лампа" }),
        cyl(p.r, 0.012, v(0, 0, 0), "metalDark", { seg: 14, tag: "обод" }),
      ];
      const n = Math.max(4, Math.round(p.bars));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        out.push(box(v(0.006, p.r * 1.5, 0.006),
          v(Math.cos(a) * p.r * 0.7, -p.r * 0.6, Math.sin(a) * p.r * 0.7),
          "metalDark", v(0, 0, 0), "пруток"));
      }
      out.push(cyl(0.005, 0.08, v(0, 0.1, 0), "metalDark", { seg: 6, tag: "крюк" }));
      return { prims: out };
    },
  },

  {
    id: "switch",
    name: "Выключатель",
    group: "light",
    mount: "wall",
    note: "Клавиша в рамке. Высота установки — обычно 0.9 от пола.",
    params: [
      P("w", "Ширина", 0.08, 0.05, 0.16, 0.005),
      PN("keys", "Клавиш", 1, 1, 3),
    ],
    build: (p) => {
      const out: Prim[] = [
        span(-p.w / 2, p.w / 2, -p.w / 2, p.w / 2, -0.012, 0, "plaster", "рамка"),
      ];
      const n = Math.max(1, Math.round(p.keys));
      const cell = (p.w - 0.016) / n;
      for (let i = 0; i < n; i++) {
        const x = -p.w / 2 + 0.008 + cell * (i + 0.5);
        out.push(span(x - cell / 2 + 0.002, x + cell / 2 - 0.002, -p.w / 2 + 0.008, p.w / 2 - 0.008,
          -0.019, -0.012, "plaster", "клавиша"));
      }
      return { prims: out };
    },
  },

  {
    id: "socket",
    name: "Розетка",
    group: "light",
    mount: "wall",
    note: "Одиночная. Ставится низко — обычно 0.3 от пола.",
    params: [P("w", "Ширина", 0.08, 0.05, 0.14, 0.005)],
    build: (p) => ({
      prims: [
        span(-p.w / 2, p.w / 2, -p.w / 2, p.w / 2, -0.012, 0, "plaster", "рамка"),
        cyl(p.w * 0.32, 0.008, v(0, 0, -0.016), "plaster", { seg: 14, rot: v(90, 0, 0), tag: "гнездо" }),
        cyl(0.005, 0.01, v(-p.w * 0.13, 0, -0.02), "metalDark", { seg: 6, rot: v(90, 0, 0), tag: "контакт" }),
        cyl(0.005, 0.01, v(p.w * 0.13, 0, -0.02), "metalDark", { seg: 6, rot: v(90, 0, 0), tag: "контакт" }),
      ],
    }),
  },

  /* --- на стену ------------------------------------------------------ */
  {
    id: "picture",
    name: "Картина",
    group: "props",
    mount: "wall",
    note: "Полотно в раме. Годится и под фотографию, и под плакат.",
    params: [
      P("w", "Ширина", 0.5, 0.15, 1.6, 0.05),
      P("h", "Высота", 0.7, 0.15, 1.6, 0.05),
      P("t", "Ширина рамы", 0.035, 0.005, 0.1, 0.005),
    ],
    build: (p) => ({
      prims: [
        span(-p.w / 2, p.w / 2, 0, p.t, -0.03, 0, "woodDark", "рама"),
        span(-p.w / 2, p.w / 2, p.h - p.t, p.h, -0.03, 0, "woodDark", "рама"),
        span(-p.w / 2, -p.w / 2 + p.t, p.t, p.h - p.t, -0.03, 0, "woodDark", "рама"),
        span(p.w / 2 - p.t, p.w / 2, p.t, p.h - p.t, -0.03, 0, "woodDark", "рама"),
        span(-p.w / 2 + p.t, p.w / 2 - p.t, p.t, p.h - p.t, -0.016, -0.01, "paper", "полотно"),
      ],
    }),
  },

  {
    id: "clock",
    name: "Часы настенные",
    group: "props",
    mount: "wall",
    note: "Круглые, со стрелками. Стрелки — подвижные части: время можно поставить любое.",
    params: [P("r", "Радиус", 0.14, 0.06, 0.4, 0.01)],
    build: (p) => ({
      prims: [
        cyl(p.r, 0.045, v(0, 0, -0.022), "woodDark", { seg: 20, rot: v(90, 0, 0), tag: "корпус" }),
        cyl(p.r * 0.9, 0.006, v(0, 0, -0.044), "paper", { seg: 20, rot: v(90, 0, 0), tag: "циферблат" }),
      ],
      parts: [
        {
          id: "hourHand", label: "Часовая стрелка", pivot: v(0, 0, -0.047),
          prims: [span(-0.008, 0.008, -0.02, p.r * 0.55, 0, 0.004, "metalDark", "стрелка")],
          motion: { kind: "swing", axis: "z", min: -360, max: 360, def: -60, label: "Часы" },
        },
        {
          id: "minHand", label: "Минутная стрелка", pivot: v(0, 0, -0.052),
          prims: [span(-0.005, 0.005, -0.02, p.r * 0.8, 0, 0.004, "metalDark", "стрелка")],
          motion: { kind: "swing", axis: "z", min: -360, max: 360, def: 140, label: "Минуты" },
        },
      ],
    }),
  },

  {
    id: "poster",
    name: "Плакат",
    group: "props",
    mount: "wall",
    note: "Лист без рамы, с загнутым углом. Дешёвый способ занять пустую стену.",
    params: [
      P("w", "Ширина", 0.42, 0.1, 1.2, 0.02),
      P("h", "Высота", 0.6, 0.1, 1.6, 0.02),
      PN("curl", "Загнутый угол", 1, 0, 1),
    ],
    build: (p) => {
      const out: Prim[] = [
        span(-p.w / 2, p.w / 2, 0, p.h, -0.006, 0, "paper", "лист"),
      ];
      if (p.curl)
        out.push(box(v(p.w * 0.22, p.w * 0.22, 0.003), v(p.w / 2 - p.w * 0.11, p.h * 0.04, -0.012), "paper", v(0, 0, 40), "загиб"));
      return { prims: out };
    },
  },

  /* --- масштаб -------------------------------------------------------- */
  {
    id: "ref_human",
    name: "Ростовой эталон",
    group: "props",
    mount: "floor",
    note: "Фигура 1.75 м. Не мебель, а линейка: по ней сразу видно, кукольная комната или великанская.",
    params: [P("h", "Рост", 1.75, 1.2, 2.1, 0.01)],
    build: (p) => {
      const k = p.h / 1.75;
      const s = (a: number) => a * k;
      return {
        prims: [
          cyl(s(0.055), s(0.82), v(-s(0.09), s(0.41), 0), "fabricDark", { seg: 10, tag: "нога" }),
          cyl(s(0.055), s(0.82), v(s(0.09), s(0.41), 0), "fabricDark", { seg: 10, tag: "нога" }),
          span(-s(0.19), s(0.19), s(0.82), s(1.4), -s(0.11), s(0.11), "fabric", "корпус"),
          cyl(s(0.045), s(0.62), v(-s(0.24), s(1.1), 0), "fabric", { seg: 8, tag: "рука" }),
          cyl(s(0.045), s(0.62), v(s(0.24), s(1.1), 0), "fabric", { seg: 8, tag: "рука" }),
          cyl(s(0.05), s(0.1), v(0, s(1.45), 0), "leather", { seg: 8, tag: "шея" }),
          ball(s(0.105), v(0, s(1.62), 0), "leather", { seg: 14, tag: "голова" }),
          // Отметка на уровне глаз: 1.65 при росте 1.75. Камера смотрит отсюда.
          span(-s(0.2), s(0.2), s(1.645), s(1.655), s(0.11), s(0.125), "lightOn", "уровень глаз"),
        ],
      };
    },
  },

  {
    id: "ref_cube",
    name: "Метровый куб",
    group: "props",
    mount: "floor",
    note: "Ребро ровно в метр с рисками через 10 см. Линейка для всего остального.",
    params: [P("a", "Ребро", 1, 0.25, 3, 0.25)],
    build: (p) => {
      const out: Prim[] = [
        span(-p.a / 2, p.a / 2, 0, p.a, -p.a / 2, p.a / 2, "concrete", "куб"),
      ];
      const n = Math.round(p.a / 0.1);
      for (let i = 1; i < n; i++) {
        const y = (p.a * i) / n;
        out.push(span(-p.a / 2 - 0.002, -p.a / 2 + 0.06, y - 0.004, y + 0.004, -p.a / 2 - 0.002, p.a / 2 + 0.002,
          i % 5 === 0 ? "lightOn" : "metalDark", "риска"));
      }
      return { prims: out };
    },
  },
];
