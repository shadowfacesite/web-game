/**
 * kit.mjs — проверка шаблонов без браузера.
 *
 *   node tools/kit.mjs           все проверки
 *   node tools/kit.mjs --list    таблица шаблонов с габаритами
 *   node tools/kit.mjs --id стол подробности по одному шаблону
 *
 * Что здесь считается «стабильным шаблоном»:
 *
 *   1. Он собирается при любом допустимом значении любого параметра —
 *      не только при значениях по умолчанию. Ползунок в редакторе двигают
 *      до упора, и на упоре предмет не должен разваливаться.
 *   2. Ни одна деталь не имеет нулевого или отрицательного размера.
 *      Такая деталь в движке даёт вывернутую наизнанку грань, которая
 *      видна только с одной стороны, — и ищут её потом неделю.
 *   3. Напольный предмет стоит на полу: низ на нуле, а не в воздухе и не
 *      утоплен. Настенный прижат к стене. Потолочный висит вниз.
 *   4. Начало координат в центре пятна: повернул вокруг Y — крутится
 *      на месте, а не улетает по дуге.
 *   5. Габарит честный: объявленные размеры совпадают с тем, что реально
 *      занимают детали. По габариту работает привязка и раскладка витрины.
 *   6. Подвижная часть на любом положении остаётся в разумных пределах
 *      и не проваливается под пол.
 *
 * Картинку я проверить не могу. Числа — могу, и это ровно те числа, из-за
 * которых предмет оказывается «кривым».
 */

import {
  CATALOG, byId, place, rebuild, serialize, parse, byGroup,
} from "../src/kit/catalog.ts";
import {
  defaults, clampParams, builtBounds, boundsOf, sizeOf, triangleCost, GROUP_LABEL,
} from "../src/kit/core.ts";

const errors = [];
const warns = [];
const fail = (m) => errors.push(m);
const warn = (m) => warns.push(m);

const EPS = 1e-6;
const fmt = (x) => (Math.abs(x) < 1e-9 ? "0" : x.toFixed(3).replace(/\.?0+$/, ""));
const dims = (b) => {
  const s = sizeOf(b);
  return `${fmt(s.x)} × ${fmt(s.y)} × ${fmt(s.z)}`;
};

/* ------------------------------------------------------------------ */
/* Наборы значений, на которых гоняем каждый шаблон                     */
/* ------------------------------------------------------------------ */

/**
 * Не только умолчания. Каждый параметр по очереди уводится в минимум и в
 * максимум: именно на краях диапазона шаблоны и ломаются — то стеллаж
 * с одной полкой, то стена короче собственного проёма.
 */
function probes(t) {
  const base = defaults(t);
  const out = [{ label: "по умолчанию", p: base }];
  for (const par of t.params) {
    out.push({ label: `${par.id}=мин`, p: { ...base, [par.id]: par.min } });
    out.push({ label: `${par.id}=макс`, p: { ...base, [par.id]: par.max } });
  }
  // Все сразу в минимум и все сразу в максимум — самые злые случаи.
  const lo = {}; const hi = {};
  for (const par of t.params) { lo[par.id] = par.min; hi[par.id] = par.max; }
  out.push({ label: "все в мин", p: lo });
  out.push({ label: "все в макс", p: hi });
  return out;
}

/* ------------------------------------------------------------------ */
/* 1. Каталог сам по себе                                              */
/* ------------------------------------------------------------------ */

const seen = new Set();
for (const t of CATALOG) {
  if (seen.has(t.id)) fail(`повторяется идентификатор шаблона: ${t.id}`);
  seen.add(t.id);
  if (!t.name || !/[а-яА-Я]/.test(t.name)) fail(`${t.id}: нет русского названия`);
  if (!t.note || t.note.length < 10) fail(`${t.id}: нет пояснения, зачем шаблон`);
  if (!t.params.length) warn(`${t.id}: ни одного параметра — нечего настраивать`);

  const ids = new Set();
  for (const par of t.params) {
    if (ids.has(par.id)) fail(`${t.id}: повторяется параметр ${par.id}`);
    ids.add(par.id);
    if (!par.label || !/[а-яА-Я]/.test(par.label)) fail(`${t.id}.${par.id}: нет русской подписи`);
    if (!(par.min < par.max)) fail(`${t.id}.${par.id}: минимум не меньше максимума`);
    if (par.def < par.min - EPS || par.def > par.max + EPS)
      fail(`${t.id}.${par.id}: значение по умолчанию ${par.def} вне диапазона ${par.min}..${par.max}`);
    if (par.step <= 0) fail(`${t.id}.${par.id}: шаг должен быть больше нуля`);
  }
}

/* ------------------------------------------------------------------ */
/* 2. Каждый шаблон на каждом наборе значений                          */
/* ------------------------------------------------------------------ */

const table = [];

for (const t of CATALOG) {
  let worstTris = 0;

  for (const probe of probes(t)) {
    const p = clampParams(t, probe.p);
    let built;
    try {
      built = t.build(p);
    } catch (e) {
      fail(`${t.id} (${probe.label}): шаблон упал — ${e && e.message}`);
      continue;
    }

    const parts = built.parts ?? [];
    const all = built.prims.concat(
      ...parts.map((part) =>
        part.prims.map((q) => ({
          ...q,
          at: { x: q.at.x + part.pivot.x, y: q.at.y + part.pivot.y, z: q.at.z + part.pivot.z },
        }))),
    );

    if (!all.length) { fail(`${t.id} (${probe.label}): не собралось ни одной детали`); continue; }

    // --- ни одной вырожденной детали ---
    for (const q of all) {
      const bad =
        (q.k === "box" || q.k === "wedge") ? (q.size.x <= EPS || q.size.y <= EPS || q.size.z <= EPS)
        : q.k === "cyl" ? (q.h <= EPS || q.r <= EPS)
        : q.r <= EPS;
      if (bad) {
        fail(`${t.id} (${probe.label}): деталь «${q.tag ?? q.k}» с нулевым размером`);
        break;
      }
      if (!Number.isFinite(q.at.x + q.at.y + q.at.z)) {
        fail(`${t.id} (${probe.label}): деталь «${q.tag ?? q.k}» уехала в бесконечность`);
        break;
      }
    }

    const b = builtBounds(built);
    const s = sizeOf(b);
    worstTris = Math.max(worstTris, triangleCost(all));

    // --- опора и начало координат ---
    if (t.mount === "floor") {
      if (b.min.y < -0.05)
        fail(`${t.id} (${probe.label}): напольный предмет уходит под пол на ${fmt(-b.min.y)} м`);
      if (b.min.y > 0.06)
        fail(`${t.id} (${probe.label}): напольный предмет висит над полом на ${fmt(b.min.y)} м`);
      // Пятно должно быть примерно по центру: иначе поворот вокруг Y уводит
      // предмет в сторону, и расставлять его мучение.
      const offX = Math.abs(b.min.x + b.max.x) / 2;
      const offZ = Math.abs(b.min.z + b.max.z) / 2;
      if (offX > Math.max(0.12, s.x * 0.2))
        fail(`${t.id} (${probe.label}): пятно смещено по X на ${fmt(offX)} м — крутится не на месте`);
      if (offZ > Math.max(0.12, s.z * 0.2))
        fail(`${t.id} (${probe.label}): пятно смещено по Z на ${fmt(offZ)} м — крутится не на месте`);
    }

    if (t.mount === "wall") {
      // Настенный растёт от стены в −Z. Чуть вылезти вперёд можно (крепёж),
      // но основной объём обязан быть в комнате, а не в стене.
      if (b.max.z > 0.06)
        fail(`${t.id} (${probe.label}): настенный предмет уходит в стену на ${fmt(b.max.z)} м`);
      if (b.min.z > -0.002)
        fail(`${t.id} (${probe.label}): настенный предмет ничего не выступает от стены`);
    }

    if (t.mount === "opening") {
      // Сидящий в проёме выходит в обе стороны, но в пределах толщины стены
      // плюс подоконник. Полметра в каждую сторону — уже не проём.
      if (b.max.z > 0.5 || b.min.z < -0.5)
        fail(`${t.id} (${probe.label}): предмет проёма вылез из стены на ${fmt(Math.max(b.max.z, -b.min.z))} м`);
    }

    if (t.mount === "ceiling") {
      if (b.max.y > 0.06)
        fail(`${t.id} (${probe.label}): потолочный предмет лезет вверх сквозь плиту на ${fmt(b.max.y)} м`);
      if (b.min.y > -0.05)
        fail(`${t.id} (${probe.label}): потолочный предмет не висит вниз`);
    }

    // --- размеры в человеческих пределах ---
    if (s.x > 20 || s.y > 20 || s.z > 20)
      fail(`${t.id} (${probe.label}): габарит ${dims(b)} — больше двадцати метров, это ошибка параметров`);

    // --- подвижные части ---
    for (const part of parts) {
      if (!part.id || !part.label) fail(`${t.id}: у части нет идентификатора или подписи`);
      if (!part.prims.length) fail(`${t.id}: часть «${part.label}» пустая`);
      if (!part.motion) { warn(`${t.id}: часть «${part.label}» без описания движения`); continue; }
      const m = part.motion;
      if (m.def < m.min - EPS || m.def > m.max + EPS)
        fail(`${t.id}: часть «${part.label}» стоит вне своего хода`);
      if (m.min === m.max) fail(`${t.id}: часть «${part.label}» никуда не двигается`);

      // Крайние положения: часть не должна проваливаться глубоко под пол.
      if (m.kind === "swing" && t.mount === "floor") {
        const local = boundsOf(part.prims);
        const reach = Math.max(
          Math.hypot(local.min.x, local.min.z), Math.hypot(local.max.x, local.max.z),
          Math.hypot(local.min.x, local.max.z), Math.hypot(local.max.x, local.min.z),
        );
        if (reach > 6)
          warn(`${t.id}: часть «${part.label}» на повороте выносит на ${fmt(reach)} м от петли`);
        if (local.min.y + part.pivot.y < -0.05)
          fail(`${t.id}: часть «${part.label}» уходит под пол`);
      }
    }
  }

  const base = t.build(defaults(t));
  table.push({
    t,
    size: dims(builtBounds(base)),
    parts: (base.parts ?? []).length,
    tris: worstTris,
  });

  if (worstTris > 4000)
    warn(`${t.id}: до ${worstTris} треугольников на худших параметрах — тяжёлый шаблон`);
}

/* ------------------------------------------------------------------ */
/* 3. Расстановка: создание, правка, сохранение, чтение                */
/* ------------------------------------------------------------------ */

{
  const objects = [];
  for (const t of CATALOG) {
    const o = place(t.id, { x: 0, y: 0, z: 0 });
    if (!o) { fail(`не удалось поставить шаблон ${t.id}`); continue; }
    o.rot = { x: 15, y: 30, z: 45 };
    o.scale = { x: 1.25, y: 0.8, z: 1.1 };
    objects.push(o);
    if (!rebuild(o)) fail(`не удалось пересобрать ${t.id}`);
  }

  const text = serialize(objects);
  const back = parse(text);
  if (back.problems.length) fail(`чтение расстановки дало жалобы: ${back.problems.join("; ")}`);
  if (back.objects.length !== objects.length)
    fail(`после сохранения и чтения предметов стало ${back.objects.length} вместо ${objects.length}`);

  for (let i = 0; i < back.objects.length; i++) {
    const a = objects[i]; const b = back.objects[i];
    if (a.tpl !== b.tpl) fail(`шаблон ${a.tpl} превратился в ${b.tpl}`);
    for (const axis of ["x", "y", "z"]) {
      if (Math.abs(a.rot[axis] - b.rot[axis]) > EPS) fail(`${a.tpl}: поворот по ${axis} не пережил сохранение`);
      if (Math.abs(a.scale[axis] - b.scale[axis]) > EPS) fail(`${a.tpl}: масштаб по ${axis} не пережил сохранение`);
    }
    for (const k of Object.keys(a.params))
      if (Math.abs(a.params[k] - b.params[k]) > 1e-4) fail(`${a.tpl}: параметр ${k} не пережил сохранение`);
  }

  // Битый файл не должен ронять редактор.
  const junk = parse("{ это не json");
  if (junk.objects.length || !junk.problems.length) fail("разбор мусора не пожаловался");
  const alien = parse(JSON.stringify({ kind: "что-то чужое", objects: [{ tpl: "нет такого" }] }));
  if (alien.objects.length) fail("разбор принял несуществующий шаблон");
}

/* ------------------------------------------------------------------ */
/* Вывод                                                               */
/* ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const one = args.indexOf("--id");

if (one !== -1) {
  const t = byId(args[one + 1]) ?? CATALOG.find((x) => x.name.toLowerCase().includes((args[one + 1] ?? "").toLowerCase()));
  if (!t) { console.error("Нет такого шаблона"); process.exit(1); }
  const built = t.build(defaults(t));
  console.log(`${t.name}  [${t.id}]  ${GROUP_LABEL[t.group]}`);
  console.log(`  ${t.note}`);
  console.log(`  ставится: ${t.mount}   габарит: ${dims(builtBounds(built))}   деталей: ${built.prims.length}`);
  console.log("  параметры:");
  for (const p of t.params)
    console.log(`    ${p.label.padEnd(28)} ${String(p.def).padStart(6)} ${p.unit}  (${p.min}…${p.max}, шаг ${p.step})`);
  if (built.parts?.length) {
    console.log("  подвижные части:");
    for (const part of built.parts)
      console.log(`    ${part.label.padEnd(28)} ${part.motion ? `${part.motion.kind} по ${part.motion.axis}, ${part.motion.min}…${part.motion.max}` : "без движения"}`);
  }
  process.exit(0);
}

if (args.includes("--list")) {
  for (const g of byGroup()) {
    console.log(`\n${GROUP_LABEL[g.group].toUpperCase()}`);
    for (const t of g.items) {
      const row = table.find((r) => r.t.id === t.id);
      console.log(
        `  ${t.name.padEnd(28)} ${String(row.size).padEnd(22)} ` +
        `парам. ${String(t.params.length).padStart(2)}  части ${String(row.parts).padStart(2)}  ` +
        `тр. ~${String(row.tris).padStart(5)}`,
      );
    }
  }
  console.log("");
}

console.log(`Шаблонов в ките: ${CATALOG.length}`);
for (const g of byGroup())
  console.log(`  ${GROUP_LABEL[g.group].padEnd(20)} ${String(g.items.length).padStart(3)}`);
const movable = table.filter((r) => r.parts > 0);
console.log(`С подвижными частями: ${movable.length} (${movable.map((r) => r.t.name).join(", ")})`);
console.log(`Проверено наборов значений: ${CATALOG.reduce((n, t) => n + t.params.length * 2 + 3, 0)}`);

for (const w of warns) console.log(`  ! ${w}`);

if (errors.length) {
  console.error(`\nОШИБОК: ${errors.length}`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log("\nВсе шаблоны собираются и держат габарит.");
