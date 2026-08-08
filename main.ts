/**
 * main.ts — точка входа и игровой цикл.
 *
 * Можно: собрать модули вместе и крутить кадры.
 * Нельзя: содержать игровую логику. Всё, что здесь появится сверх
 * пятидесяти строк, — признак того, что оно должно жить в своём файле.
 */

import "./style.css";
import { createStage } from "./render/scene";
import { createPlayer } from "./game/player";
import { createHud } from "./debug/hud";
import { installReport } from "./debug/report";

const canvas = document.getElementById("view") as HTMLCanvasElement | null;
if (!canvas) throw new Error("Нет <canvas id=\"view\"> в index.html");

const stage = createStage(canvas);
const player = createPlayer(stage.camera, canvas);
const hud = createHud();
installReport(stage.renderer, () => hud.fps);

let last = performance.now();

function frame(now: number) {
  // Ограничение сверху: после переключения вкладки между кадрами
  // проходят минуты, и без потолка игрок улетает сквозь весь дом.
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  player.update(dt);
  stage.renderer.render(stage.scene, stage.camera);
  hud.update(dt, stage.camera, stage.renderer);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
