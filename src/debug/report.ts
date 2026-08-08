/**
 * report.ts — отчёт о железе и настройках рендера по F9.
 *
 * Это самый важный файл в Э0, и он не про игру.
 *
 * Я не вижу экран. Всё, что можно превратить из «выглядит мыльно» в число,
 * должно быть превращено в число, иначе разговор про картинку снова
 * станет гаданием. F9 собирает то, чего не видно на скриншоте: какая
 * видеокарта, какая максимальная анизотропия, какое цветовое
 * пространство, какое ограничение плотности пикселей.
 *
 * Нажал F9 — отчёт лёг в буфер обмена и в консоль. Прислал мне текстом.
 */

import * as THREE from "three";

export function installReport(renderer: THREE.WebGLRenderer, fpsSource: () => number) {
  window.addEventListener("keydown", (e) => {
    if (e.code !== "F9") return;
    e.preventDefault();
    const text = collect(renderer, fpsSource());
    console.log(text);
    copy(text);
  });
}

function collect(renderer: THREE.WebGLRenderer, fps: number): string {
  const gl = renderer.getContext();
  const caps = renderer.capabilities;

  let gpu = "неизвестно";
  try {
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    if (dbg) {
      gpu = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
    } else {
      gpu = String(gl.getParameter(gl.RENDERER));
    }
  } catch {
    // Firefox с защитой от отпечатка браузера это закрывает — так и запишем.
    gpu = "скрыто браузером";
  }

  const lines: [string, unknown][] = [
    ["three.js", THREE.REVISION],
    ["браузер", navigator.userAgent],
    ["язык / часовой пояс", `${navigator.language} / ${Intl.DateTimeFormat().resolvedOptions().timeZone}`],
    ["тёмная тема", matchMedia("(prefers-color-scheme: dark)").matches ? "да" : "нет"],
    ["экран", `${screen.width}×${screen.height}, окно ${innerWidth}×${innerHeight}`],
    ["плотность пикселей", `${devicePixelRatio} (рендерим при ${renderer.getPixelRatio()})`],
    ["видеокарта", gpu],
    // Не через caps.isWebGL2: это свойство уехало из библиотеки вместе
    // с поддержкой WebGL 1 и в свежих версиях просто отсутствует.
    [
      "WebGL2",
      typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext
        ? "да"
        : "нет",
    ],
    ["макс. анизотропия", caps.getMaxAnisotropy()],
    ["макс. размер текстуры", caps.maxTextureSize],
    ["точность в шейдере", caps.precision],
    ["цветовое пространство", renderer.outputColorSpace],
    ["тональная компрессия", `${renderer.toneMapping}, экспозиция ${renderer.toneMappingExposure}`],
    ["тени", renderer.shadowMap.enabled ? `вкл, тип ${renderer.shadowMap.type}` : "выкл"],
    ["FPS на момент отчёта", fps.toFixed(0)],
  ];

  const pad = Math.max(...lines.map(([k]) => k.length));
  return (
    "=== ЗАТОН · отчёт Э0 ===\n" +
    lines.map(([k, v]) => `${k.padEnd(pad)} : ${v}`).join("\n") +
    "\n========================"
  );
}

function copy(text: string) {
  // Запись в буфер требует жеста пользователя. Нажатие F9 им и является —
  // но только пока обработчик не ушёл в асинхронность. Поэтому пишем сразу.
  navigator.clipboard
    ?.writeText(text)
    .then(() => toast("Отчёт скопирован. Пришли его в чат."))
    .catch(() => toast("Буфер недоступен — отчёт лежит в консоли (F12)."));
}

let toastTimer = 0;

function toast(message: string) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("on"), 2600);
}
