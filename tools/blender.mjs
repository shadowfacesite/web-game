/**
 * blender.mjs — выгрузка в OBJ для работы в Blender.
 *
 *   node tools/blender.mjs           дом и кит в export/
 *   node tools/blender.mjs --stage 4 дом на четвёртой стадии
 *
 * Кладёт три файла:
 *   export/house.obj   дом целиком: четыре уровня, стены, плиты, ядро
 *   export/kit.obj     все 71 шаблон, разложенные рядами по группам
 *   export/zaton.mtl   служебные цвета к обоим
 *
 * Как этим пользоваться в Blender:
 *   File → Import → Wavefront (.obj), выбрать house.obj.
 *   Настройки импорта менять не нужно: единицы метры, Y вверх — совпадает.
 *   Дальше моделируешь поверх, а блокаут держишь на отдельной коллекции и
 *   выключаешь, когда мешает.
 *
 * И главное. Пока планировка живёт в spec/house-map.json, а .obj — это её
 * отпечаток, всё в порядке: поменял карту, перевыгрузил, подложка обновилась.
 * Как только начнёшь двигать стены в Blender и не переносить это в карту —
 * планировок станет две, и через месяц никто не вспомнит, какая настоящая.
 * Это ровно то, от чего умер прошлый заход.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildBlockout } from "../src/world/geometry.ts";
import { CATALOG } from "../src/kit/catalog.ts";
import { defaults, builtBounds, sizeOf, GROUP_LABEL } from "../src/kit/core.ts";
import { writeObj } from "../src/kit/obj.ts";
import map from "../spec/house-map.json" with { type: "json" };

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "export");

const args = process.argv.slice(2);
const stageArg = args.indexOf("--stage");
const stage = stageArg === -1 ? 0 : Number(args[stageArg + 1]) || 0;

/* --- слоты материалов для коробок дома ------------------------------ */

const HOUSE_MAT = {
  slab: "concrete", roof: "concrete", wall: "plaster", part: "plaster",
  core: "brick", lintel: "concrete", sill: "wood", leaf: "wood",
  lid: "steel", kerb: "concrete", rail: "metalDark", rubble: "rust",
};

const toPrim = (b) => ({
  k: "box",
  mat: HOUSE_MAT[b.kind],
  at: { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 },
  size: { x: b.x1 - b.x0, y: b.y1 - b.y0, z: b.z1 - b.z0 },
  tag: b.kind,
});

/* --- дом ------------------------------------------------------------- */

const blockout = buildBlockout(map);
const houseGroups = [];

for (const L of blockout.levels) {
  // Один объект на уровень, чтобы в Blender можно было спрятать этажи
  // по одному — иначе внутрь дома не заглянуть.
  const prims = L.boxes.map(toPrim);
  for (const s of L.staged) {
    const open = s.gates.some(
      (g) => g.stage !== null && stage >= g.stage && (g.close === null || stage < g.close),
    );
    if (!open) prims.push(toPrim(s.box));
  }
  houseGroups.push({ name: `уровень_${L.id}`, prims });
}

/* --- кит ------------------------------------------------------------- */

const kitGroups = [];
{
  const GAP = 0.9;
  const LIMIT = 26;
  let z = 0;

  for (const g of ["structure", "openings", "furniture", "props", "light"]) {
    const items = CATALOG.filter((t) => t.group === g);
    if (!items.length) continue;
    z += 3.2;
    let x = -LIMIT / 2;
    let rowDepth = 0;

    for (const t of items) {
      const built = t.build(defaults(t));
      const size = sizeOf(builtBounds(built));
      const w = Math.max(0.6, size.x);
      if (x + w > LIMIT / 2) { x = -LIMIT / 2; z += rowDepth + GAP * 1.6; rowDepth = 0; }

      // Створки выгружаем в положении «закрыто», как они и стоят на витрине.
      const prims = built.prims.slice();
      for (const part of built.parts ?? [])
        for (const q of part.prims)
          prims.push({ ...q, at: { x: q.at.x + part.pivot.x, y: q.at.y + part.pivot.y, z: q.at.z + part.pivot.z } });

      const shifted = prims.map((q) => ({ ...q, at: { x: q.at.x + x + w / 2, y: q.at.y, z: q.at.z + z } }));
      kitGroups.push({ name: `${g}_${t.id}`, prims: shifted });

      x += w + GAP;
      rowDepth = Math.max(rowDepth, size.z);
    }
    z += rowDepth + 1.4;
  }
}

/* --- запись ---------------------------------------------------------- */

mkdirSync(outDir, { recursive: true });

const house = writeObj(houseGroups);
const kit = writeObj(kitGroups);

writeFileSync(join(outDir, "house.obj"), house.obj, "utf8");
writeFileSync(join(outDir, "kit.obj"), kit.obj, "utf8");
writeFileSync(join(outDir, "zaton.mtl"), house.mtl.length > kit.mtl.length ? house.mtl : kit.mtl, "utf8");

/* --- проверка того, что выгрузили ------------------------------------ */

const problems = [];
for (const [name, res, groups] of [["house.obj", house, houseGroups], ["kit.obj", kit, kitGroups]]) {
  if (!res.tris) problems.push(`${name}: ни одного треугольника`);
  const verts = (res.obj.match(/^v /gm) || []).length;
  const faces = (res.obj.match(/^f /gm) || []).length;
  if (verts !== res.tris * 3) problems.push(`${name}: вершин ${verts}, а треугольников ${res.tris}`);
  if (faces !== res.tris) problems.push(`${name}: граней ${faces}, а треугольников ${res.tris}`);
  // Ни один индекс не должен вылезти за число вершин: это самая частая
  // ошибка в написанном руками OBJ, и Blender на ней молча теряет объект.
  for (const line of res.obj.split("\n")) {
    if (!line.startsWith("f ")) continue;
    for (const idx of line.slice(2).split(/\s+/)) {
      const n = Number(idx);
      if (!Number.isInteger(n) || n < 1 || n > verts) { problems.push(`${name}: битый индекс ${idx}`); break; }
    }
  }
  console.log(`${name.padEnd(10)} объектов ${String(groups.length).padStart(3)}   треугольников ${String(res.tris).padStart(6)}   ${(res.obj.length / 1024).toFixed(0)} КБ`);
}

console.log(`zaton.mtl  материалов ${(house.mtl.match(/^newmtl /gm) || []).length}`);
console.log(`\nДом выгружен на стадии ${stage}. Файлы в export/`);

if (problems.length) {
  console.error("\nОШИБКИ ВЫГРУЗКИ:");
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log("Индексы и счётчики сходятся — Blender это откроет.");
