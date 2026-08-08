/**
 * player.ts — управление от первого лица: мышь, WASD, бег.
 *
 * Можно: читать ввод, двигать камеру.
 * Нельзя: рисовать, знать про стадии сценария.
 *
 * Захват мыши написан здесь руками, а не взят из аддонов three.js.
 * Причина: чувствительность мыши — один из пунктов, которые ты будешь
 * называть словами «вялая» или «дёрганая», и я хочу, чтобы за это
 * отвечало одно число в известном мне месте, а не чужой класс.
 *
 * Коллизий здесь нет. На Э0 их не с чем считать: дом появится на Э2,
 * и коллизии придут из той же карты, из которой он вырастет.
 */

import * as THREE from "three";
import { EYE_HEIGHT } from "../render/scene";

/** Радиан поворота на пиксель движения мыши. Крутить это число можно смело. */
export const MOUSE_SENSITIVITY = 0.0022;

/** Метры в секунду. Хоррор от быстрой ходьбы много теряет. */
export const WALK_SPEED = 2.2;
export const RUN_SPEED = 4.2;

/** Насколько резко набирается и гасится скорость, 1/с. */
const ACCEL = 34;

const PITCH_LIMIT = THREE.MathUtils.degToRad(89);

export interface Player {
  update(dt: number): void;
  readonly locked: boolean;
  position: THREE.Vector3;
}

export function createPlayer(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement): Player {
  const keys = new Set<string>();
  let yaw = camera.rotation.y;
  let pitch = camera.rotation.x;
  let locked = false;

  const velocity = new THREE.Vector3();
  const wish = new THREE.Vector3();

  // --- захват мыши -------------------------------------------------------

  const veil = document.getElementById("veil");

  function requestLock() {
    // unadjustedMovement снимает ускорение мыши, которое добавляет ОС.
    // Поддерживается не везде; там, где нет, — обычный захват.
    const maybePromise = (
      canvas.requestPointerLock as (opts?: { unadjustedMovement?: boolean }) => unknown
    ).call(canvas, { unadjustedMovement: true });

    if (maybePromise && typeof (maybePromise as Promise<void>).catch === "function") {
      (maybePromise as Promise<void>).catch(() => canvas.requestPointerLock());
    }
  }

  veil?.addEventListener("click", requestLock);
  canvas.addEventListener("click", () => {
    if (!locked) requestLock();
  });

  document.addEventListener("pointerlockchange", () => {
    locked = document.pointerLockElement === canvas;
    if (veil) veil.hidden = locked;
    if (!locked) keys.clear(); // иначе после Esc игрок уезжает сам
  });

  document.addEventListener("mousemove", (e) => {
    if (!locked) return;
    yaw -= e.movementX * MOUSE_SENSITIVITY;
    pitch -= e.movementY * MOUSE_SENSITIVITY;
    pitch = THREE.MathUtils.clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
  });

  // --- клавиши -----------------------------------------------------------

  window.addEventListener("keydown", (e) => {
    keys.add(e.code);
    // Пробел браузер иначе трактует как прокрутку страницы.
    if (e.code === "Space") e.preventDefault();
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => keys.clear());

  // --- шаг ---------------------------------------------------------------

  function update(dt: number) {
    camera.rotation.set(pitch, yaw, 0);

    const fwd = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
    const side = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
    const running = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const speed = running ? RUN_SPEED : WALK_SPEED;

    // Направление берётся только от рыскания: взгляд вверх не должен
    // замедлять шаг и не должен поднимать игрока над полом.
    wish.set(side, 0, -fwd);
    if (wish.lengthSq() > 0) wish.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    wish.multiplyScalar(speed);

    // Разгон и торможение одним и тем же коэффициентом: шаг без рывка,
    // но и без длинного скольжения.
    const k = 1 - Math.exp(-ACCEL * dt);
    velocity.lerp(wish, k);

    camera.position.addScaledVector(velocity, dt);
    camera.position.y = EYE_HEIGHT; // пола как поверхности ещё нет, держим высоту
  }

  return {
    update,
    get locked() {
      return locked;
    },
    get position() {
      return camera.position;
    },
    set position(v: THREE.Vector3) {
      camera.position.copy(v);
    },
  };
}
