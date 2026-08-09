/**
 * ui.ts — две панели: каталог слева, настройки справа.
 *
 * Можно: строить DOM и дёргать редактор.
 * Нельзя: считать геометрию и трогать Babylon.
 *
 * Панель настроек строится из описания параметров шаблона, а не пишется под
 * каждый предмет руками. Поэтому новый шаблон появляется в редакторе сам,
 * со всеми ползунками и подписями, — а не «шаблон готов, осталось сделать
 * ему интерфейс».
 */

import { byGroup, byId } from "../kit/catalog.ts";
import { GROUP_LABEL, builtBounds, sizeOf, clampParams } from "../kit/core.ts";
import type { Editor, GizmoMode } from "./editor.ts";

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

const fmt = (x: number, digits = 2) =>
  Number(x.toFixed(digits)).toString();

export function installUI(editor: Editor, extras: {
  onShowcase(): void;
  onEmpty(): void;
  onHouse(): void;
  onWalk(on: boolean): void;
  walking(): boolean;
}) {
  const catalog = document.getElementById("catalog") as HTMLElement;
  const inspector = document.getElementById("inspector") as HTMLElement;
  const bar = document.getElementById("toolbar") as HTMLElement;

  /* ---------------------------------------------------------------- */
  /* Каталог                                                           */
  /* ---------------------------------------------------------------- */

  const search = el("input", "search");
  search.type = "search";
  search.placeholder = "Найти шаблон…";
  catalog.append(search);

  const list = el("div", "catalog-list");
  catalog.append(list);

  function drawCatalog() {
    list.replaceChildren();
    const q = search.value.trim().toLowerCase();
    let shown = 0;

    for (const g of byGroup()) {
      const items = g.items.filter(
        (t) => !q || t.name.toLowerCase().includes(q) || t.note.toLowerCase().includes(q) || t.id.includes(q),
      );
      if (!items.length) continue;

      const head = el("div", "group", `${GROUP_LABEL[g.group]} · ${items.length}`);
      list.append(head);

      for (const t of items) {
        const size = sizeOf(builtBounds(t.build(Object.fromEntries(t.params.map((p) => [p.id, p.def])))));
        const row = el("button", "tpl");
        row.append(el("span", "tpl-name", t.name));
        row.append(el("span", "tpl-size", `${fmt(size.x)} × ${fmt(size.y)} × ${fmt(size.z)} м`));
        row.append(el("span", "tpl-note", t.note));
        row.title = t.note;
        row.addEventListener("click", () => editor.add(t.id));
        list.append(row);
        shown++;
      }
    }

    if (!shown) list.append(el("div", "empty", "Ничего не нашлось"));
  }

  search.addEventListener("input", drawCatalog);
  drawCatalog();

  /* ---------------------------------------------------------------- */
  /* Верхняя панель                                                    */
  /* ---------------------------------------------------------------- */

  function button(label: string, title: string, onClick: () => void, name?: string) {
    const b = el("button", "tool", label);
    b.title = title;
    b.addEventListener("click", onClick);
    if (name) b.dataset.name = name;
    bar.append(b);
    return b;
  }

  function sep() { bar.append(el("span", "sep")); }

  const modeButtons: Record<string, HTMLButtonElement> = {};
  for (const [m, label, key] of [
    ["move", "Двигать", "W"], ["rotate", "Вращать", "E"], ["scale", "Размер", "R"],
  ] as [GizmoMode, string, string][]) {
    modeButtons[m] = button(`${label} · ${key}`, `Гизмо: ${label.toLowerCase()} по X, Y, Z`, () => editor.setMode(m));
  }

  sep();

  const snapGrid = el("select", "pick");
  for (const [value, label] of [["0", "без привязки"], ["0.05", "5 см"], ["0.1", "10 см"], ["0.25", "25 см"], ["0.5", "50 см"], ["1", "1 м"]]) {
    const o = el("option", undefined, label);
    o.value = value;
    if (value === "0.25") o.selected = true;
    snapGrid.append(o);
  }
  snapGrid.title = "Шаг привязки перемещения";
  snapGrid.addEventListener("change", () => editor.setSnap({ grid: Number(snapGrid.value) }));
  bar.append(el("span", "tool-label", "шаг"), snapGrid);

  const snapAngle = el("select", "pick");
  for (const [value, label] of [["0", "плавно"], ["5", "5°"], ["15", "15°"], ["45", "45°"], ["90", "90°"]]) {
    const o = el("option", undefined, label);
    o.value = value;
    if (value === "15") o.selected = true;
    snapAngle.append(o);
  }
  snapAngle.title = "Шаг привязки поворота";
  snapAngle.addEventListener("change", () => editor.setSnap({ angle: Number(snapAngle.value) }));
  bar.append(el("span", "tool-label", "угол"), snapAngle);

  const worldBtn = button("Оси мира", "Крутить в осях мира или в осях предмета", () => {
    editor.setSnap({ world: !editor.snap.world });
    worldBtn.textContent = editor.snap.world ? "Оси мира" : "Оси предмета";
  });

  sep();
  button("Копия · D", "Дублировать выделенное", () => editor.duplicate());
  button("Удалить · Del", "Удалить выделенное", () => editor.remove());
  button("Отменить · Z", "Шаг назад", () => editor.undo());

  sep();
  button("Витрина", "Разложить все шаблоны по группам", extras.onShowcase);
  button("Пусто", "Очистить карту", extras.onEmpty);
  button("Дом", "Собрать дом из spec/house-map.json", extras.onHouse);

  sep();
  const walkBtn = button("Ходить · Tab", "Пройтись по карте с высоты глаз", () => {
    extras.onWalk(!extras.walking());
    walkBtn.textContent = extras.walking() ? "Облёт · Tab" : "Ходить · Tab";
  });

  sep();
  button("Сохранить", "Скачать расстановку в JSON", () => {
    const blob = new Blob([editor.save()], { type: "application/json" });
    const a = el("a");
    a.href = URL.createObjectURL(blob);
    a.download = "расстановка.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  const file = el("input");
  file.type = "file";
  file.accept = ".json,application/json";
  file.style.display = "none";
  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    if (!f) return;
    const problems = editor.load(await f.text());
    if (problems.length) toast(problems.join("; "));
    else toast(`Загружено предметов: ${editor.objects.length}`);
    file.value = "";
  });
  bar.append(file);
  button("Открыть", "Загрузить расстановку из JSON", () => file.click());

  /* ---------------------------------------------------------------- */
  /* Панель предмета                                                   */
  /* ---------------------------------------------------------------- */

  function numberRow(
    label: string, value: number, step: number, onSet: (x: number) => void,
    min?: number, max?: number, unit = "м",
  ): HTMLElement {
    const row = el("label", "row");
    row.append(el("span", "row-label", label));
    const input = el("input", "num");
    input.type = "number";
    input.step = String(step);
    input.value = fmt(value, 3);
    if (min !== undefined) input.min = String(min);
    if (max !== undefined) input.max = String(max);
    input.addEventListener("change", () => {
      const x = Number(input.value);
      if (Number.isFinite(x)) onSet(x);
    });
    row.append(input);
    row.append(el("span", "row-unit", unit));
    return row;
  }

  function sliderRow(
    label: string, value: number, min: number, max: number, step: number,
    unit: string, onSet: (x: number) => void,
  ): HTMLElement {
    const row = el("div", "row row-slider");
    const top = el("div", "row-top");
    top.append(el("span", "row-label", label));
    const num = el("input", "num");
    num.type = "number";
    num.value = fmt(value, 3);
    num.step = String(step);
    num.min = String(min);
    num.max = String(max);
    top.append(num, el("span", "row-unit", unit));
    row.append(top);

    const range = el("input", "range");
    range.type = "range";
    range.min = String(min);
    range.max = String(max);
    range.step = String(step);
    range.value = String(value);
    row.append(range);

    const push = (x: number) => {
      const clamped = Math.min(max, Math.max(min, x));
      num.value = fmt(clamped, 3);
      range.value = String(clamped);
      onSet(clamped);
    };
    range.addEventListener("input", () => push(Number(range.value)));
    num.addEventListener("change", () => push(Number(num.value)));
    return row;
  }

  function drawInspector() {
    inspector.replaceChildren();
    const o = editor.selected;

    if (!o) {
      inspector.append(el("div", "hint",
        "Ничего не выделено.\n\nЩёлкни предмет на карте или выбери шаблон в каталоге слева.\n\n" +
        "W — двигать, E — вращать, R — размер.\nTab — пройтись пешком.\nЦифры 1–3 — переключить гизмо."));
      return;
    }

    const tpl = byId(o.tpl);
    if (!tpl) return;

    const head = el("div", "head");
    head.append(el("div", "head-name", o.name));
    head.append(el("div", "head-note", tpl.note));
    const size = sizeOf(builtBounds(tpl.build(o.params)));
    head.append(el("div", "head-size",
      `габарит ${fmt(size.x)} × ${fmt(size.y)} × ${fmt(size.z)} м` +
      (o.scale.x !== 1 || o.scale.y !== 1 || o.scale.z !== 1
        ? `  ·  с масштабом ${fmt(size.x * o.scale.x)} × ${fmt(size.y * o.scale.y)} × ${fmt(size.z * o.scale.z)}`
        : "")));
    inspector.append(head);

    /* --- положение --------------------------------------------------- */
    inspector.append(el("div", "section", "Положение"));
    for (const axis of ["x", "y", "z"] as const)
      inspector.append(numberRow(axis.toUpperCase(), o.pos[axis], editor.snap.grid || 0.05, (val) => {
        o.pos[axis] = val;
        editor.touch(o.uid);
      }));

    /* --- поворот ----------------------------------------------------- */
    inspector.append(el("div", "section", "Поворот"));
    for (const axis of ["x", "y", "z"] as const)
      inspector.append(numberRow(axis.toUpperCase(), o.rot[axis], editor.snap.angle || 5, (val) => {
        o.rot[axis] = val;
        editor.touch(o.uid);
      }, -360, 360, "°"));

    const quick = el("div", "quick");
    for (const step of [-90, -15, 15, 90]) {
      const b = el("button", "chip", `${step > 0 ? "+" : ""}${step}°`);
      b.title = "Повернуть вокруг вертикали";
      b.addEventListener("click", () => { o.rot.y += step; editor.touch(o.uid); });
      quick.append(b);
    }
    const flat = el("button", "chip", "сброс");
    flat.addEventListener("click", () => { o.rot = { x: 0, y: 0, z: 0 }; editor.touch(o.uid); });
    quick.append(flat);
    inspector.append(quick);

    /* --- масштаб ----------------------------------------------------- */
    inspector.append(el("div", "section", "Масштаб"));
    for (const axis of ["x", "y", "z"] as const)
      inspector.append(numberRow(axis.toUpperCase(), o.scale[axis], 0.05, (val) => {
        o.scale[axis] = val === 0 ? 0.01 : val;
        editor.touch(o.uid);
      }, 0.01, 20, "×"));

    const uniform = el("div", "quick");
    for (const k of [0.5, 0.75, 1, 1.5, 2]) {
      const b = el("button", "chip", `×${k}`);
      b.addEventListener("click", () => { o.scale = { x: k, y: k, z: k }; editor.touch(o.uid); });
      uniform.append(b);
    }
    inspector.append(uniform);

    /* --- параметры шаблона ------------------------------------------- */
    inspector.append(el("div", "section", "Параметры шаблона"));
    inspector.append(el("div", "section-note",
      "Меняют устройство предмета, а не растягивают его: у стеллажа прибавляется полка, а не толщина."));

    for (const p of tpl.params)
      inspector.append(sliderRow(p.label, o.params[p.id], p.min, p.max, p.step, p.unit ?? "", (val) => {
        o.params[p.id] = val;
        o.params = clampParams(tpl, o.params);
        editor.refresh(o.uid);
      }));

    /* --- створки ------------------------------------------------------ */
    const parts = (tpl.build(o.params).parts ?? []).filter((x) => x.motion);
    if (parts.length) {
      inspector.append(el("div", "section", "Подвижные части"));
      for (const part of parts) {
        const m = part.motion as NonNullable<typeof part.motion>;
        inspector.append(sliderRow(
          m.label, o.motion[part.id] ?? m.def, m.min, m.max,
          m.kind === "swing" ? 1 : 0.01, m.kind === "swing" ? "°" : "м",
          (val) => { o.motion[part.id] = val; editor.touch(o.uid); },
        ));
      }
    }

    /* --- прочее ------------------------------------------------------- */
    const foot = el("div", "quick foot");
    const dup = el("button", "chip", "Дублировать");
    dup.addEventListener("click", () => editor.duplicate(o.uid));
    const look = el("button", "chip", "Показать");
    look.addEventListener("click", () => editor.focusOn(o.uid));
    const del = el("button", "chip danger", "Удалить");
    del.addEventListener("click", () => editor.remove(o.uid));
    foot.append(dup, look, del);
    inspector.append(foot);
  }

  /* ---------------------------------------------------------------- */
  /* Всплывающее сообщение                                             */
  /* ---------------------------------------------------------------- */

  let toastTimer = 0;
  function toast(text: string) {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = text;
    node.classList.add("on");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => node.classList.remove("on"), 2600);
  }

  /* ---------------------------------------------------------------- */

  function syncBar() {
    for (const m of Object.keys(modeButtons))
      modeButtons[m].classList.toggle("on", editor.mode === m);
    const count = document.getElementById("count");
    if (count) count.textContent = `предметов: ${editor.objects.length}`;
  }

  editor.onChange(() => { drawInspector(); syncBar(); });
  drawInspector();
  syncBar();

  return { toast, redraw: drawInspector };
}
