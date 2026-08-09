/**
 * blockout.mjs — проверка объёма дома без браузера.
 *
 *   node tools/blockout.mjs          проверки и сводка
 *   node tools/blockout.mjs --map 4  карта проходимости на стадии 4
 *
 * validate.mjs проверяет планировку: клетки, стадии, маршрут по сетке.
 * Этот скрипт проверяет то, что из планировки выросло: настоящие коробки и
 * настоящие коллизии. Игрок здесь — кружок радиуса 0.28, который ходит по
 * тем же коробкам, в которые упрётся в браузере.
 *
 * Зачем отдельно. Прошлый заход умер на том, что чертёж и дом разошлись
 * молча. Сетка проходимости и построенный объём — ровно такая же пара,
 * которая может разойтись. Поэтому маршрут проверяется дважды: по клеткам
 * в validate.mjs и по коробкам здесь. Если ответы разные — сборка красная.
 *
 * Геометрия берётся из src/world/geometry.ts — того же файла, из которого
 * её берёт игра. Второй реализации нет: грабли 14.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  buildBlockout,
  solidsAt,
  slideCircle,
  fits,
  nearestFit,
  gateOpen,
  stagedPresent,
  inRoom,
  DIM,
} from "../src/world/geometry.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAP = JSON.parse(readFileSync(join(root, "spec/house-map.json"), "utf8"));
const B = buildBlockout(MAP);

const errors = [];
const notes = [];
const fail = (m) => errors.push(m);
const note = (m) => notes.push(m);

const CELL = MAP.cell;
const R = DIM.playerR;
const LEVELS = MAP.levels.map((l) => l.id);
const levelOf = (id) => B.levels.find((l) => l.id === id);

/* ------------------------------------------------------------------ */
/* Обход дома настоящими коллизиями                                    */
/* ------------------------------------------------------------------ */

/**
 * Заливка по мелкой сетке (четверть клетки). Клетка считается достижимой,
 * если игрок в неё помещается И может туда доехать из соседней, не пройдя
 * сквозь коробку. Второе проверяется тем же slideCircle, что и в игре:
 * если шаг упёрся и никуда не сдвинулся — прохода нет.
 */
const STEP = CELL / 2;
const GX = Math.round(MAP.w / STEP);
const GZ = Math.round(MAP.d / STEP);
const gx = (i) => (i + 0.5) * STEP;

function reachable(stage, from) {
  const solids = new Map();
  for (const lv of LEVELS) solids.set(lv, solidsAt(B, lv, stage));

  const links = MAP.links.filter((l) => l.to && gateOpen(l, stage));
  const seen = new Set();
  const key = (lv, i, j) => lv + ":" + i + ":" + j;

  const start = nearestFit(B, from.level, from.x, from.z, stage);
  const stack = [[from.level, Math.floor(start.x / STEP), Math.floor(start.z / STEP)]];

  while (stack.length) {
    const [lv, i, j] = stack.pop();
    if (i < 0 || j < 0 || i >= GX || j >= GZ) continue;
    const k = key(lv, i, j);
    if (seen.has(k)) continue;
    const S = solids.get(lv);
    if (!fits(gx(i), gx(j), S, R)) continue;
    seen.add(k);

    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= GX || jj >= GZ) continue;
      if (seen.has(key(lv, ii, jj))) continue;
      // Настоящий шаг: если коробка не пустила, сосед не наш.
      const m = slideCircle(gx(i), gx(j), di * STEP, dj * STEP, S, R);
      if (Math.abs(m.x - gx(ii)) > 1e-6 || Math.abs(m.z - gx(jj)) > 1e-6) continue;
      stack.push([lv, ii, jj]);
    }

    for (const l of links)
      if (l.from === lv && Math.floor(l.x / STEP) === i && Math.floor(l.z / STEP) === j)
        stack.push([l.to, Math.floor(l.x / STEP), Math.floor(l.z / STEP)]);
  }

  return seen;
}

const cellHas = (seen, lv, x, z) => seen.has(lv + ":" + Math.floor(x / STEP) + ":" + Math.floor(z / STEP));

/** Достижимо ли помещение целиком-хоть-где-нибудь. */
function roomReached(seen, room) {
  for (const k of seen) {
    const p = k.split(":");
    if (p[0] !== room.level) continue;
    if (inRoom(gx(+p[1]), gx(+p[2]), room)) return true;
  }
  return false;
}

/** Обход на каждую стадию. Игрок начинает там, где его оставил сценарий. */
const REACH = new Map();
for (const s of MAP.stages) REACH.set(s.n, reachable(s.n, s.at));

/* ------------------------------------------------------------------ */
/* 1. Дом собрался                                                      */
/* ------------------------------------------------------------------ */

let boxTotal = 0;
for (const L of B.levels) {
  boxTotal += L.boxes.length + L.staged.length;
  if (!L.boxes.some((b) => b.kind === "slab")) fail(`${L.name}: нет ни одной плиты перекрытия`);
  if (!L.boxes.some((b) => b.kind === "wall")) fail(`${L.name}: нет ни одной наружной стены`);
}
if (boxTotal < 200) fail(`подозрительно мало коробок на весь дом: ${boxTotal}`);

/* ------------------------------------------------------------------ */
/* 2. Каждый проём прорезан                                             */
/* ------------------------------------------------------------------ */

// Проём считается прорезанным, если по центру, на высоте пояса, нет ни
// одной постоянной коробки. Створка может стоять — она уйдёт по стадии.
for (const d of MAP.doors) {
  if (MAP.core.hatch[0] <= d.x && d.x <= MAP.core.hatch[2]
    && MAP.core.hatch[1] <= d.z && d.z <= MAP.core.hatch[3] && d.level === "f1") continue;
  const L = levelOf(d.level);
  const yb = L.y + 1.0;
  const blocked = L.boxes.filter(
    (b) => b.kind !== "sill" && b.kind !== "slab" && b.kind !== "roof"
      && b.x0 - 1e-6 < d.x && d.x < b.x1 + 1e-6
      && b.z0 - 1e-6 < d.z && d.z < b.z1 + 1e-6
      && b.y0 < yb && yb < b.y1,
  );
  if (blocked.length) fail(`дверь ${d.id} (${d.label}): проём не прорезан, мешает ${blocked[0].kind}`);
}

for (const o of MAP.openings) {
  const L = levelOf(o.level);
  const yb = L.y + 1.0;
  const blocked = L.boxes.filter(
    (b) => b.kind !== "sill" && b.kind !== "slab" && b.kind !== "roof"
      && b.x0 - 1e-6 < o.x && o.x < b.x1 + 1e-6
      && b.z0 - 1e-6 < o.z && o.z < b.z1 + 1e-6
      && b.y0 < yb && yb < b.y1,
  );
  if (blocked.length) fail(`проём ${o.id} (${o.label}): не прорезан, мешает ${blocked[0].kind}`);
}

// И наоборот: запертая навсегда дверь обязана быть закрыта створкой всегда.
for (const d of MAP.doors) {
  if (d.stage !== null) continue;
  for (const s of MAP.stages) {
    const L = levelOf(d.level);
    const leaf = L.staged.find((x) => x.id.split("+").includes(d.id));
    if (!leaf) { fail(`«${d.label}»: нет створки, а дверь заперта навсегда`); break; }
    if (!stagedPresent(leaf, s.n)) fail(`«${d.label}»: створка исчезла на стадии ${s.n}, а дверь заперта навсегда`);
  }
}

/* ------------------------------------------------------------------ */
/* 3. Из дома нельзя выйти насквозь                                     */
/* ------------------------------------------------------------------ */

// Габарит дома по клеткам, где вообще что-то построено, плюс запас.
const bounds = {};
for (const L of B.levels) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let j = 0; j < B.nz; j++)
    for (let i = 0; i < B.nx; i++) {
      if (L.kind[j * B.nx + i] === "outside") continue;
      x0 = Math.min(x0, i * CELL); x1 = Math.max(x1, (i + 1) * CELL);
      z0 = Math.min(z0, j * CELL); z1 = Math.max(z1, (j + 1) * CELL);
    }
  bounds[L.id] = { x0, z0, x1, z1 };
}

for (const s of MAP.stages) {
  const seen = REACH.get(s.n);
  for (const k of seen) {
    const p = k.split(":");
    const b = bounds[p[0]];
    const x = gx(+p[1]), z = gx(+p[2]);
    if (x < b.x0 - 1e-6 || x > b.x1 + 1e-6 || z < b.z0 - 1e-6 || z > b.z1 + 1e-6) {
      fail(`стадия ${s.n}: игрок вышел за пределы дома — ${p[0]} ${x.toFixed(2)},${z.toFixed(2)}`);
      break;
    }
  }
}

/* ------------------------------------------------------------------ */
/* 4. В колодец обвала не шагнуть ни на одной стадии                    */
/* ------------------------------------------------------------------ */

const sw = MAP.core.stairwell;
for (const s of MAP.stages) {
  const seen = REACH.get(s.n);
  for (const k of seen) {
    const p = k.split(":");
    const x = gx(+p[1]), z = gx(+p[2]);
    if (x > sw[0] && x < sw[2] && z > sw[1] && z < sw[3]) {
      fail(`стадия ${s.n}: в колодец обвала можно шагнуть — ${p[0]} ${x.toFixed(2)},${z.toFixed(2)}`);
      break;
    }
  }
}

/* ------------------------------------------------------------------ */
/* 5. Маршрут по стадиям проходим по настоящим коробкам                 */
/* ------------------------------------------------------------------ */

const firstSeen = new Map();
for (const s of MAP.stages) {
  const seen = REACH.get(s.n);
  if (!seen.size) fail(`стадия ${s.n} «${s.name}»: игроку негде стоять`);

  if (!cellHas(seen, s.at.level, s.at.x, s.at.z))
    fail(`стадия ${s.n} «${s.name}»: до её точки (${s.at.level} ${s.at.x},${s.at.z}) не дойти`);

  for (const b of MAP.beats.filter((x) => x.stage === s.n))
    if (!cellHas(seen, b.level, b.x, b.z)) fail(`стадия ${s.n}: до события «${b.text}» не дойти`);

  for (const it of MAP.items.filter((x) => x.need === s.n))
    if (!cellHas(seen, it.level, it.x, it.z)) fail(`стадия ${s.n}: предмет «${it.name}» недостижим`);

  for (const r of MAP.rooms)
    if (!firstSeen.has(r.id) && roomReached(seen, r)) firstSeen.set(r.id, s.n);
}

/* ------------------------------------------------------------------ */
/* 6. Тот же ответ, что у валидатора планировки                         */
/* ------------------------------------------------------------------ */

const expect = { nursery: 4, balcony: 3, boiler: 6, corridor: 6, stairtop: 3, bedroom: 2 };
for (const id of Object.keys(expect)) {
  const got = firstSeen.get(id);
  if (got === undefined) fail(`помещение ${id} недостижимо ни на одной стадии по коробкам`);
  else if (got !== expect[id])
    fail(`помещение ${id}: по коробкам открывается на стадии ${got}, по планировке — на ${expect[id]}`);
}

/* ------------------------------------------------------------------ */
/* 7. Проём шире игрока                                                 */
/* ------------------------------------------------------------------ */

if (DIM.doorW <= 2 * R) fail(`дверной проём ${DIM.doorW} м уже игрока (${(2 * R).toFixed(2)} м)`);
else note(`чистый ход в двери: ${(DIM.doorW - 2 * R).toFixed(2)} м на сторону центра`);

/* ------------------------------------------------------------------ */
/* Карта проходимости                                                   */
/* ------------------------------------------------------------------ */

const mapFlag = process.argv.indexOf("--map");
if (mapFlag !== -1) {
  const stage = Number(process.argv[mapFlag + 1] ?? 0);
  const st = MAP.stages.find((x) => x.n === stage) ?? MAP.stages[0];
  const seen = reachable(stage, st.at);
  console.log(`Объём дома на стадии ${stage}. Клетка 0.5 м, знак — четверть клетки.`);
  console.log("  · дошёл  ‧ пусто  # стена  ▓ ядро/кладка  ▒ завал  ␣ провал  = ограждение\n");
  for (const L of B.levels) {
    console.log(`${L.name}  (отметка ${L.y.toFixed(1)} м, коробок ${L.boxes.length})`);
    for (let j = 0; j < B.nz; j++) {
      let row = "";
      for (let i = 0; i < B.nx; i++) {
        const k = L.kind[j * B.nx + i];
        const hit = seen.has(L.id + ":" + i * 2 + ":" + j * 2)
          || seen.has(L.id + ":" + (i * 2 + 1) + ":" + (j * 2 + 1));
        if (hit) row += "·";
        else if (k === "wall" || k === "shaftWall") row += "#";
        else if (k === "masonry") row += "▓";
        else if (k === "rubble") row += "▒";
        else if (k === "void") row += " ";
        else if (k === "rail") row += "=";
        else if (k === "outside") row += " ";
        else row += "‧";
      }
      console.log("  " + row);
    }
    console.log("");
  }
}

/* ------------------------------------------------------------------ */
/* Отчёт                                                                */
/* ------------------------------------------------------------------ */

console.log("Объём дома собран из планировки.");
for (const L of B.levels) {
  const c = {};
  for (const b of L.boxes) c[b.kind] = (c[b.kind] ?? 0) + 1;
  const parts = Object.keys(c).sort().map((k) => `${k} ${c[k]}`).join(", ");
  console.log(`  ${L.name.padEnd(10)} коробок ${String(L.boxes.length).padStart(4)}  створок ${L.staged.length}   ${parts}`);
}
console.log("Первая стадия, на которой в помещение можно войти ногами:");
for (const r of MAP.rooms)
  console.log(`  ${String(firstSeen.get(r.id) ?? "—").padStart(2)}  ${r.name}`);
for (const n of notes) console.log(`  · ${n}`);

if (errors.length) {
  console.error(`\nОШИБОК: ${errors.length}`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log("\nОбъём сходится с планировкой.");
