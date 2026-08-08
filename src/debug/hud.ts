/**
 * hud.ts — отладочная строка в углу экрана.
 *
 * Существует ради скриншотов: на любой присланной картинке должно быть
 * видно, при каком FPS и в какой точке она снята. Без этого половина
 * вопросов «а почему тут так» остаётся без ответа.
 *
 * Убирается целиком на Э10.
 */

import * as THREE from "three";

export interface Hud {
  update(dt: number, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer): void;
  readonly fps: number;
}

export function createHud(): Hud {
  const el = document.getElementById("hud");
  let fps = 0;
  let sinceRedraw = 0;

  function update(dt: number, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {
    // Экспоненциальное сглаживание: мгновенный FPS прыгает так, что
    // на скриншоте оказывается случайное число.
    const instant = dt > 0 ? 1 / dt : 0;
    fps = fps === 0 ? instant : fps * 0.9 + instant * 0.1;

    sinceRedraw += dt;
    if (sinceRedraw < 0.2 || !el) return;
    sinceRedraw = 0;

    const p = camera.position;
    const info = renderer.info.render;
    el.textContent =
      `${fps.toFixed(0).padStart(3)} FPS   ${(dt * 1000).toFixed(1)} мс\n` +
      `x ${p.x.toFixed(2)}  y ${p.y.toFixed(2)}  z ${p.z.toFixed(2)}\n` +
      `вызовов ${info.calls}   треугольников ${info.triangles}\n` +
      `F9 — отчёт о железе`;
  }

  return {
    update,
    get fps() {
      return fps;
    },
  };
}
