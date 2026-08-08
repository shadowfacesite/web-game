/**
 * validate.mjs — проверка планировки без браузера.
 *
 *   node tools/validate.mjs            обычный прогон
 *   node tools/validate.mjs --selftest подсунуть ошибку и убедиться, что ловится
 *
 * Читает spec/house-map.json и больше ничего. Если проверка падает, процесс
 * выходит с ненулевым кодом — сборка на GitHub краснеет, и сломанная
 * планировка не доезжает до игры.
 *
 * Что проверяется:
 *   1. геометрия  — сетка, пересечения комнат, двери в стенах, мебель в полу;
 *   2. вертикаль  — люк приземляется на пол, а не в грунт;
 *   3. колодец    — в обвал нельзя шагнуть ни на одном уровне и ни на одной стадии;
 *   4. маршрут    — каждая стадия проходима, и ни одна дверь не открыта раньше срока.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAP = JSON.parse(readFileSync(join(root, "spec/house-map.json"), "utf8"));

const errors = [];
const notes = [];
const fail = (m) => errors.push(m);
const note = (m) => notes.push(m);

// --- сетка ------------------------------------------------------------------

const CELL = MAP.cell;
const NX = Math.round(MAP.w / CELL);
const NZ = Math.round(MAP.d / CELL);
const LEVELS = MAP.levels.map((l) => l.id);

const cx = (i) => (i + 0.5) * CELL;
const key = (lv, i, j) => `${lv}:${i}:${j}`;

function inRoom(x, z, r) {
  if (r.pts) {
    let inside = false;
    for (let i = 0, n = r.pts.length; i < n; i++) {
      const [x1, z1] = r.pts[i];
      const [x2, z2] = r.pts[(i + 1) % n];
      if (z1 > z !== z2 > z && x < ((x2 - x1) * (z - z1)) / (z2 - z1) + x1) inside = !inside;
    }
    return inside;
  }
  return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
}

const inBox = (x, z, b) => x >= b[0] && z >= b[1] && x <= b[2] && z <= b[3];
const roomAt = (lv, x, z) => MAP.rooms.find((r) => r.level === lv && inRoom(x, z, r));

// --- 1. геометрия -----------------------------------------------------------

const onGrid = (v) => Math.abs(v / CELL - Math.round(v / CELL)) < 1e-9;

for (const r of MAP.rooms) {
  const vals = r.pts ? r.pts.flat() : [r.x0, r.z0, r.x1, r.z1];
  const bad = vals.filter((v) => !onGrid(v));
  if (bad.length) fail(`помещение ${r.id}: координаты не по сетке ${CELL} м — ${bad.join(", ")}`);
}

const rect = MAP.rooms.filter((r) => !r.pts);
for (let a = 0; a < rect.length; a++)
  for (let b = a + 1; b < rect.length; b++) {
    const A = rect[a], B = rect[b];
    if (A.level !== B.level) continue;
    const ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
    const oz = Math.min(A.z1, B.z1) - Math.max(A.z0, B.z0);
    if (ox > 0 && oz > 0) fail(`помещения ${A.id} и ${B.id} налезают друг на друга`);
  }

// Дверь должна стоять в перегородке между двумя разными помещениями,
// либо вести в ядро (шахта, люк) или наружу.
for (const d of MAP.doors) {
  const step = 0.4;
  const a = d.o === "v" ? roomAt(d.level, d.x - step, d.z) : roomAt(d.level, d.x, d.z - step);
  const b = d.o === "v" ? roomAt(d.level, d.x + step, d.z) : roomAt(d.level, d.x, d.z + step);
  const core = inBox(d.x, d.z, MAP.core.shaft) || inBox(d.x, d.z, MAP.core.hatch);
  if (roomAt(d.level, d.x, d.z) && !core)
    fail(`дверь ${d.id} стоит внутри помещения, а не в перегородке`);
  if (!core && (!a || !b))
    note(`дверь ${d.id} (${d.label}) упирается только в одно помещение — наружная?`);
}

for (const f of MAP.furniture) {
  if (!roomAt(f.level, f.x, f.z)) fail(`мебель «${f.name}» (${f.level} ${f.x},${f.z}) вне помещений`);
  for (const k of ["shaft", "stairwell"])
    if (inBox(f.x, f.z, MAP.core[k]))
      fail(`мебель «${f.name}» (${f.level} ${f.x},${f.z}) стоит внутри ${k}`);
}

for (const key of ["items", "beats"])
  for (const o of MAP[key])
    if (!roomAt(o.level, o.x, o.z)) fail(`${key}: ${o.id} (${o.level} ${o.x},${o.z}) вне помещений`);

const thirteen = (kind, level, needle) => {
  const n = MAP.furniture.filter((f) => f.level === level && f.name.includes(needle)).length;
  if (n !== 13) fail(`${kind}: ${n} вместо тринадцати — число несущее для сюжета`);
};
thirteen("кроватки в детской", "f3", "Кроватка");
thirteen("стулья в подвале", "cellar", "полукругом");

// --- 2. вертикаль -----------------------------------------------------------

for (const l of MAP.links) {
  if (!l.to) continue;
  for (const [lv, side] of [[l.from, "верх"], [l.to, "низ"]]) {
    const inCore = inBox(l.x, l.z, MAP.core.shaft) || inBox(l.x, l.z, MAP.core.hatch);
    if (!roomAt(lv, l.x, l.z) && !inCore)
      fail(`связь ${l.id}: ${side} (${lv} ${l.x},${l.z}) приземляется вне помещений`);
  }
}
{
  const [x0, z0, x1, z1] = MAP.core.hatch;
  const under = roomAt("cellar", (x0 + x1) / 2, (z0 + z1) / 2);
  if (!under) fail("люк в подвал приземляется в грунт: под ним нет помещения");
  else note(`люк приземляется в «${under.name}»`);
}

// --- проходимость -----------------------------------------------------------

const doorOpen = (d, st) => d.stage !== null && st >= d.stage && (d.close === null || st < d.close);

function walkable(stage) {
  const set = new Set();
  for (const lv of LEVELS)
    for (let i = 0; i < NX; i++)
      for (let j = 0; j < NZ; j++) {
        const x = cx(i), z = cx(j);
        if (inBox(x, z, MAP.core.stairwell)) continue; // колодец закрыт всегда
        if (inBox(x, z, MAP.core.shaft)) continue; // шахта — только через двери, ниже
        if (roomAt(lv, x, z)) set.add(key(lv, i, j));
      }
  for (const d of MAP.doors)
    if (doorOpen(d, stage)) set.add(key(d.level, Math.floor(d.x / CELL), Math.floor(d.z / CELL)));
  for (const o of MAP.openings)
    set.add(key(o.level, Math.floor(o.x / CELL), Math.floor(o.z / CELL)));
  // Клетки шахты открываются вместе с её дверьми на этом уровне.
  for (const d of MAP.doors)
    if (d.id.startsWith("shaft") && doorOpen(d, stage)) {
      const [x0, z0, x1, z1] = MAP.core.shaft;
      for (let i = Math.floor(x0 / CELL); i < Math.round(x1 / CELL); i++)
        for (let j = Math.floor(z0 / CELL); j < Math.round(z1 / CELL); j++) set.add(key(d.level, i, j));
    }
  // Клетки люка — вместе с дверью-люком.
  for (const d of MAP.doors)
    if (d.id === "hatch" && doorOpen(d, stage)) {
      const [x0, z0, x1, z1] = MAP.core.hatch;
      for (let i = Math.floor(x0 / CELL); i < Math.round(x1 / CELL); i++)
        for (let j = Math.floor(z0 / CELL); j < Math.round(z1 / CELL); j++) set.add(key(d.level, i, j));
    }
  return set;
}

function reach(stage, from) {
  const ok = walkable(stage);
  const st = [[from.level, Math.floor(from.x / CELL), Math.floor(from.z / CELL)]];
  const seen = new Set();
  const links = MAP.links.filter((l) => l.to && doorOpen(l, stage));
  while (st.length) {
    const [lv, i, j] = st.pop();
    const k = key(lv, i, j);
    if (seen.has(k) || !ok.has(k)) continue;
    seen.add(k);
    st.push([lv, i + 1, j], [lv, i - 1, j], [lv, i, j + 1], [lv, i, j - 1]);
    for (const l of links)
      if (l.from === lv && Math.floor(l.x / CELL) === i && Math.floor(l.z / CELL) === j)
        st.push([l.to, Math.floor(l.x / CELL), Math.floor(l.z / CELL)]);
  }
  return seen;
}

const at = (o) => key(o.level, Math.floor(o.x / CELL), Math.floor(o.z / CELL));

// --- 3. колодец закрыт всегда ------------------------------------------------

for (const s of MAP.stages) {
  const ok = walkable(s.n);
  for (const lv of LEVELS)
    for (let i = 0; i < NX; i++)
      for (let j = 0; j < NZ; j++)
        if (inBox(cx(i), cx(j), MAP.core.stairwell) && ok.has(key(lv, i, j)))
          fail(`стадия ${s.n}: в колодец обвала можно шагнуть (${lv} ${cx(i)},${cx(j)})`);
}

// --- 4. маршрут по стадиям ---------------------------------------------------

function firstStages(check) {
  const first = new Map();
  for (const s of MAP.stages) {
    const seen = reach(s.n, s.at);
    if (check) {
      if (!seen.size) fail(`стадия ${s.n} «${s.name}»: игрок начинает в непроходимой клетке`);
      for (const b of MAP.beats.filter((b) => b.stage === s.n))
        if (!seen.has(at(b))) fail(`стадия ${s.n}: до события «${b.text}» не дойти`);
      for (const it of MAP.items.filter((i) => i.need === s.n))
        if (!seen.has(at(it))) fail(`стадия ${s.n}: предмет «${it.name}» нужен, но недостижим`);
    }
    for (const r of MAP.rooms) {
      if (first.has(r.id)) continue;
      const hit = [...seen].some((k) => {
        const [lv, i, j] = k.split(":");
        return lv === r.level && inRoom(cx(+i), cx(+j), r);
      });
      if (hit) first.set(r.id, s.n);
    }
  }
  return first;
}

const firstSeen = firstStages(true);

const expect = { nursery: 4, balcony: 3, boiler: 6, corridor: 6, stairtop: 3, bedroom: 2 };
for (const [id, st] of Object.entries(expect)) {
  const got = firstSeen.get(id);
  if (got === undefined) fail(`помещение ${id} недостижимо ни на одной стадии`);
  else if (got !== st) fail(`помещение ${id} открывается на стадии ${got}, а должно на ${st}`);
}

for (const d of MAP.doors)
  if (d.stage === null)
    for (const s of MAP.stages)
      if (doorOpen(d, s.n)) fail(`«${d.label}» должна быть заперта всегда, а открыта на ${s.n}`);

// --- отчёт -------------------------------------------------------------------

const selftest = process.argv.includes("--selftest");
const mapFlag = process.argv.indexOf("--map");
if (mapFlag !== -1) {
  const stage = Number(process.argv[mapFlag + 1] ?? 7);
  const ok = walkable(stage);
  const doorCell = new Map();
  for (const d of MAP.doors)
    doorCell.set(key(d.level, Math.floor(d.x / CELL), Math.floor(d.z / CELL)), doorOpen(d, stage) ? "D" : "d");
  for (const o of MAP.openings) doorCell.set(at(o), "o");
  for (const l of MAP.links) if (l.to) doorCell.set(at({ level: l.from, x: l.x, z: l.z }), "L");

  console.log(`Проходимость на стадии ${stage}. `
    + "· пол  D открытая дверь  d закрытая  o проём  L связь вверх/вниз  S шахта  X обвал  H люк\n");
  for (const lv of LEVELS) {
    const L = MAP.levels.find((l) => l.id === lv);
    console.log(`${L.name}`);
    for (let j = 0; j < NZ; j++) {
      let row = "";
      for (let i = 0; i < NX; i++) {
        const x = cx(i), z = cx(j), k = key(lv, i, j);
        if (doorCell.has(k)) row += doorCell.get(k);
        else if (inBox(x, z, MAP.core.stairwell)) row += "X";
        else if (inBox(x, z, MAP.core.shaft)) row += ok.has(k) ? "S" : "s";
        else if (inBox(x, z, MAP.core.hatch) && (lv === "f1" || lv === "cellar")) row += "H";
        else row += ok.has(k) ? "·" : " ";
      }
      console.log("  " + row);
    }
    console.log("");
  }
  process.exit(errors.length ? 1 : 0);
}

if (selftest) {
  if (errors.length) {
    console.log("Самопроверка: карта уже сломана, сначала почини её.");
    process.exit(1);
  }
  const d = MAP.doors.find((x) => x.id === "balc_d");
  const before = firstSeen.get("balcony");
  console.log(`Самопроверка: «${d.label}» открывается на стадии ${d.stage}, балкон — на ${before}.`);
  d.stage = 2;
  const after = firstStages(false).get("balcony");
  console.log(`  открыл дверь на стадию раньше → балкон стал доступен на ${after}`);
  const caught = after < before;
  console.log(caught ? "  поймано: валидатор видит преждевременно открытую дверь"
                     : "  ПРОВАЛ: подсунутая ошибка не поймана");
  process.exit(caught ? 0 : 1);
}

console.log(`Планировка: ${MAP.rooms.length} помещений, ${MAP.doors.length} дверей, ` +
            `${MAP.links.length} вертикальных связей, ${MAP.furniture.length} предметов.`);
console.log("Первая стадия, на которой открывается помещение:");
for (const r of MAP.rooms)
  console.log(`  ${String(firstSeen.get(r.id) ?? "—").padStart(2)}  ${r.name}`);
for (const n of notes) console.log(`  · ${n}`);

if (errors.length) {
  console.error(`\nОШИБОК: ${errors.length}`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log("\nВсё сходится.");
