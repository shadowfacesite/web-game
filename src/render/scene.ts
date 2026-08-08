/**
 * scene.ts — сцена, камера, рендерер.
 *
 * Можно: создавать рендерер, камеру, свет, тестовую геометрию Э0.
 * Нельзя: знать про управление, стадии сценария и планировку дома.
 *
 * Все параметры рендера выставлены здесь ЯВНО, даже там, где значение
 * совпадает с умолчанием библиотеки. Это сделано нарочно: когда картинка
 * окажется не той, список подозреваемых должен читаться в одном месте,
 * а не собираться по документации.
 */

import * as THREE from "three";

/** Рост глаз игрока в метрах. Дом строится под это число. */
export const EYE_HEIGHT = 1.65;

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  resize(): void;
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
    // stencil не нужен, но отключение иногда ломает постобработку — оставляем
  });

  // Цвет. Ошибка здесь даёт «выцветшую» или «пережжённую» картинку,
  // и по скриншоту её легко спутать с ошибкой освещения.
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // Плотность пикселей. Без ограничения сверху на экране с DPR 3
  // рисуется девять пикселей вместо одного, и FPS падает втрое ни за что.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Тени включаются на Э4, не раньше. Здесь — только тип, чтобы потом
  // не искать, где он задаётся.
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0b0c);

  const camera = new THREE.PerspectiveCamera(
    70, // по вертикали; на широком мониторе даёт около 100° по горизонтали
    1, // настоящее соотношение выставит resize()
    0.05, // ближе 5 см — нос упирается в стену
    120, // дом 24 м, дальше смотреть некуда
  );
  // Порядок вращения для вида от первого лица: сначала рыскание, потом тангаж.
  // При порядке по умолчанию камера заваливается набок на взгляде вверх.
  camera.rotation.order = "YXZ";
  camera.position.set(0, EYE_HEIGHT, 4);

  buildProbe(scene);

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // false — размер холста задаёт CSS, рендерер меняет только буфер.
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  resize();
  window.addEventListener("resize", resize);

  return { renderer, scene, camera, resize };
}

/**
 * Испытательная площадка Э0. Дома здесь нет и не будет: дом строится
 * на Э2 из карты. Всё, что тут стоит, — эталоны, по которым на скриншоте
 * видно, что масштаб и свет не врут.
 */
function buildProbe(scene: THREE.Scene) {
  // Свет намеренно скучный: два источника, никакой атмосферы.
  // Атмосфера — это Э4, и до неё нельзя судить о картинке.
  const sky = new THREE.HemisphereLight(0x8899aa, 0x2a2724, 1.1);
  scene.add(sky);

  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(6, 10, 4);
  scene.add(sun);

  // Пол 40 × 40 м. Материала пола ещё нет — серый, как и должно быть
  // на блокауте.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: 0.95, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Сетка с шагом 0.5 м — той же, что клетка планировки в house-map.json.
  // На скриншоте по ней сразу видно, совпадает ли масштаб мира с картой.
  const grid = new THREE.GridHelper(40, 80, 0x3a3a3a, 0x242424);
  grid.position.y = 0.002; // топим в пол, иначе z-борьба — грабли 1
  scene.add(grid);

  // Куб 1 × 1 × 1 м из приёмки Э0.
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xb0a898, roughness: 0.7, metalness: 0 }),
  );
  cube.position.set(0, 0.5, 0);
  scene.add(cube);

  // Эталон роста: столб 1.80 м. Если на скриншоте он выглядит ниже или
  // выше человека — врут либо угол обзора, либо высота камеры.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 1.8, 12),
    new THREE.MeshStandardMaterial({ color: 0x8f5a3c, roughness: 0.8, metalness: 0 }),
  );
  pole.position.set(3, 0.9, -1);
  scene.add(pole);

  // Дверной проём в натуральную величину: 0.9 × 2.05 м. По нему на глаз
  // проверяется, что мир не «кукольный» и не «великанский».
  const jamb = new THREE.MeshStandardMaterial({ color: 0x4d4a45, roughness: 0.9, metalness: 0 });
  const doorway = new THREE.Group();
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.05, 0.2), jamb);
  left.position.set(-0.5, 2.05 / 2, 0);
  const right = left.clone();
  right.position.x = 0.5;
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.2), jamb);
  top.position.set(0, 2.05 + 0.05, 0);
  doorway.add(left, right, top);
  doorway.position.set(-3, 0, -2);
  scene.add(doorway);
}
