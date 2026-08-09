/**
 * stage.ts — движок, сцена, камеры, свет, пустая карта.
 *
 * Можно: заводить Babylon и всё, что вокруг сцены.
 * Нельзя: знать про шаблоны и редактор.
 *
 * Про правостороннюю систему координат. Babylon по умолчанию левосторонний,
 * и это единственное place, где он расходится с three.js, glTF, Blender и
 * с тем, как записаны все шаблоны кита. Оставить как есть — значит получить
 * зеркальный дом: двери открываются не в ту сторону, а понять это можно
 * только на скриншоте. Поэтому переключаем сразу.
 */

import {
  ArcRotateCamera, Color3, Color4, DirectionalLight, Engine, HemisphericLight,
  Mesh, MeshBuilder, Scene, StandardMaterial, UniversalCamera, Vector3,
} from "@babylonjs/core";

export interface StageView {
  engine: Engine;
  scene: Scene;
  orbit: ArcRotateCamera;
  walk: UniversalCamera;
  ground: Mesh;
  grid: Mesh;
  /** Переключить облёт и ходьбу от первого лица. */
  setWalk(on: boolean): void;
  readonly walking: boolean;
  setGrid(on: boolean): void;
  dispose(): void;
}

/** Высота глаз. То же число, что в доме: масштаб должен читаться одинаково. */
export const EYE = 1.65;

export function createStage(canvas: HTMLCanvasElement): StageView {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true, // чтобы скриншот из движка не выходил чёрным
    stencil: false,
    antialias: true,
  });
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio, 2));

  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  scene.clearColor = new Color4(0.05, 0.055, 0.06, 1);
  scene.ambientColor = new Color3(0.2, 0.2, 0.22);

  /* --- свет ---------------------------------------------------------- */

  // Полусфера даёт разный оттенок горизонтальным и вертикальным граням —
  // без неё серый предмет на серой земле сливается в пятно.
  const sky = new HemisphericLight("небо", new Vector3(0, 1, 0), scene);
  sky.intensity = 0.85;
  sky.diffuse = Color3.FromHexString("#b9c6d6");
  sky.groundColor = Color3.FromHexString("#2f2c28");

  const sun = new DirectionalLight("солнце", new Vector3(-0.5, -1, -0.35), scene);
  sun.intensity = 1.1;
  sun.position = new Vector3(12, 20, 10);

  const fill = new DirectionalLight("подсветка", new Vector3(0.6, -0.4, 0.7), scene);
  fill.intensity = 0.35;

  /* --- земля и сетка -------------------------------------------------- */

  const ground = MeshBuilder.CreateGround("земля", { width: 120, height: 120 }, scene);
  const gm = new StandardMaterial("мат:земля", scene);
  gm.diffuseColor = Color3.FromHexString("#3b3b3d");
  gm.specularColor = new Color3(0, 0, 0);
  ground.material = gm;
  ground.position.y = -0.002; // топим на два миллиметра — иначе спорит с полом
  ground.isPickable = true;

  const grid = makeGrid(scene, 40, 0.5);

  /* --- камеры --------------------------------------------------------- */

  const orbit = new ArcRotateCamera("облёт", -Math.PI / 2.2, Math.PI / 3.1, 9, new Vector3(0, 1, 0), scene);
  orbit.minZ = 0.05;
  orbit.maxZ = 400;
  orbit.lowerRadiusLimit = 0.6;
  orbit.upperRadiusLimit = 90;
  orbit.wheelDeltaPercentage = 0.02;
  orbit.panningSensibility = 120;
  orbit.useBouncingBehavior = false;

  const walk = new UniversalCamera("ходьба", new Vector3(0, EYE, -5), scene);
  walk.minZ = 0.05;
  walk.maxZ = 400;
  walk.speed = 0.22;
  walk.angularSensibility = 900;
  walk.inertia = 0.6;
  // WASD. Стрелки Babylon вешает сам, эти — сверху.
  walk.keysUp = [87, 38];
  walk.keysDown = [83, 40];
  walk.keysLeft = [65, 37];
  walk.keysRight = [68, 39];

  let walking = false;
  scene.activeCamera = orbit;
  orbit.attachControl(canvas, true);

  function setWalk(on: boolean) {
    if (on === walking) return;
    walking = on;
    if (on) {
      orbit.detachControl();
      // Встаём туда, куда смотрели: иначе после переключения непонятно, где ты.
      const t = orbit.getTarget();
      const dir = t.subtract(orbit.position);
      dir.y = 0;
      const back = dir.length() > 0.1 ? dir.normalize().scale(-2.5) : new Vector3(0, 0, -2.5);
      walk.position.set(t.x + back.x, EYE, t.z + back.z);
      walk.setTarget(new Vector3(t.x, EYE, t.z));
      scene.activeCamera = walk;
      walk.attachControl(canvas, true);
    } else {
      walk.detachControl();
      const t = walk.getFrontPosition(3);
      orbit.setTarget(new Vector3(t.x, Math.max(0.5, t.y), t.z));
      scene.activeCamera = orbit;
      orbit.attachControl(canvas, true);
    }
  }

  window.addEventListener("resize", () => engine.resize());

  return {
    engine, scene, orbit, walk, ground, grid,
    setWalk,
    get walking() { return walking; },
    setGrid(on: boolean) { grid.setEnabled(on); },
    dispose() { scene.dispose(); engine.dispose(); },
  };
}

/**
 * Сетка с шагом полметра — та же клетка, что в планировке дома.
 * Каждая пятая линия ярче: без неё по сетке нельзя отсчитать метры.
 */
function makeGrid(scene: Scene, half: number, step: number): Mesh {
  const lines: Vector3[][] = [];
  const count = Math.round(half / step);
  for (let i = -count; i <= count; i++) {
    const p = i * step;
    lines.push([new Vector3(-half, 0, p), new Vector3(half, 0, p)]);
    lines.push([new Vector3(p, 0, -half), new Vector3(p, 0, half)]);
  }
  const grid = MeshBuilder.CreateLineSystem("сетка", { lines }, scene);
  grid.color = Color3.FromHexString("#4a4a4d");
  grid.alpha = 0.5;
  grid.isPickable = false;
  grid.position.y = 0.001;

  // Оси: красная вдоль X, синяя вдоль Z. По ним видно, куда смотрит предмет.
  const axes = MeshBuilder.CreateLineSystem("оси", {
    lines: [
      [new Vector3(-half, 0, 0), new Vector3(half, 0, 0)],
      [new Vector3(0, 0, -half), new Vector3(0, 0, half)],
    ],
  }, scene);
  axes.color = Color3.FromHexString("#7d5a5a");
  axes.alpha = 0.9;
  axes.isPickable = false;
  axes.position.y = 0.0015;
  axes.parent = grid;

  return grid;
}
