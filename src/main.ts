/**
 * main.ts — точка входа.
 *
 * Можно: собрать модули вместе и крутить кадры.
 * Нельзя: содержать логику. Всё, что здесь разрастётся сверх сотни строк,
 * должно уехать в свой файл.
 */

import "./style.css";
import { Vector3 } from "@babylonjs/core";
import type { TransformNode } from "@babylonjs/core";

import { createStage } from "./engine/stage.ts";
import { makeMaterials, buildPrims } from "./engine/render.ts";
import { createEditor } from "./editor/editor.ts";
import { installUI } from "./editor/ui.ts";
import { layoutShowcase, layoutEmpty, buildHouseFromMap, createLabels } from "./editor/scenes.ts";
import type { HouseView } from "./editor/scenes.ts";
import { importGlb } from "./engine/importer.ts";

const canvas = document.getElementById("view") as HTMLCanvasElement | null;
if (!canvas) throw new Error("Нет <canvas id=\"view\"> в index.html");

const stage = createStage(canvas);
const mats = makeMaterials(stage.scene);

/** Плавно подвести облёт к предмету — иначе «Показать» телепортирует. */
function focus(node: TransformNode) {
  const p = node.getAbsolutePosition();
  stage.orbit.setTarget(new Vector3(p.x, p.y + 0.8, p.z));
}

const editor = createEditor(stage.scene, mats, focus);
const labels = createLabels(stage.scene, document.getElementById("labels") as HTMLElement);

/* ------------------------------------------------------------------ */
/* Режимы карты                                                        */
/* ------------------------------------------------------------------ */

let house: HouseView | null = null;

function dropHouse() {
  if (house) { house.dispose(); house = null; }
}

function showShowcase() {
  dropHouse();
  stage.setGrid(true);
  labels.set(layoutShowcase(editor));
  stage.orbit.setTarget(new Vector3(0, 1, 12));
  stage.orbit.radius = 26;
}

function showEmpty() {
  dropHouse();
  stage.setGrid(true);
  labels.set(layoutEmpty(editor));
  stage.orbit.setTarget(new Vector3(0, 1, 0));
  stage.orbit.radius = 6;
}

function showHouse() {
  dropHouse();
  editor.clear();
  stage.setGrid(false);
  house = buildHouseFromMap(stage.scene, mats, 0,
    (prims, parent, name) => buildPrims(stage.scene, mats, prims, parent, name));
  labels.set(house.labels);
  stage.orbit.setTarget(new Vector3(12, 2, 8));
  stage.orbit.radius = 34;
}

/* ------------------------------------------------------------------ */
/* Панели и клавиши                                                    */
/* ------------------------------------------------------------------ */

const ui = installUI(editor, {
  onShowcase: showShowcase,
  onEmpty: showEmpty,
  onHouse: showHouse,
  onWalk: (on) => { stage.setWalk(on); labels.setVisible(!on); },
  walking: () => stage.walking,
});

// Приём .glb из Blender: перетащить файл на окно.
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", async (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  if (!/\.(glb|gltf)$/i.test(file.name)) { ui.toast("Перетащи .glb или .gltf из Blender"); return; }
  ui.toast(`Читаю ${file.name}…`);
  try {
    const res = await importGlb(stage.scene, file);
    const s = res.size;
    ui.toast(
      `${file.name}: ${s.x.toFixed(2)} × ${s.y.toFixed(2)} × ${s.z.toFixed(2)} м, ` +
      `${Math.round(res.triangles)} тр.` + (res.notes.length ? ` — ${res.notes[0]}` : ""),
    );
    for (const n of res.notes) console.warn("Импорт:", n);
  } catch (err) {
    ui.toast(`Не читается: ${(err as Error).message}`);
  }
});

window.addEventListener("keydown", (e) => {
  const inField = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
  if (inField && e.code !== "Escape") return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  switch (e.code) {
    case "KeyW": if (!stage.walking) { editor.setMode("move"); e.preventDefault(); } break;
    case "KeyE": if (!stage.walking) { editor.setMode("rotate"); e.preventDefault(); } break;
    case "KeyR": if (!stage.walking) { editor.setMode("scale"); e.preventDefault(); } break;
    case "Digit1": editor.setMode("move"); break;
    case "Digit2": editor.setMode("rotate"); break;
    case "Digit3": editor.setMode("scale"); break;
    case "KeyD": editor.duplicate(); break;
    case "KeyZ": editor.undo(); break;
    case "Delete":
    case "Backspace": editor.remove(); break;
    case "Escape": editor.select(null); break;
    case "Tab":
      e.preventDefault();
      stage.setWalk(!stage.walking);
      labels.setVisible(!stage.walking);
      break;
    default: break;
  }
});

/* ------------------------------------------------------------------ */
/* Кадры                                                               */
/* ------------------------------------------------------------------ */

showShowcase();

let frames = 0;
let acc = 0;
const fpsNode = document.getElementById("fps");

stage.engine.runRenderLoop(() => {
  stage.scene.render();
  labels.update();

  // FPS считаем усреднённо: мгновенный прыгает так, что на скриншоте
  // оказывается случайное число.
  acc += stage.engine.getDeltaTime();
  if (++frames >= 20 && fpsNode) {
    fpsNode.textContent = `${Math.round(1000 / (acc / frames))} FPS`;
    frames = 0;
    acc = 0;
  }
});
