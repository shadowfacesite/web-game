/**
 * importer.ts — загрузка .glb из Blender в сцену.
 *
 * Можно: читать модель и ставить её на карту.
 * Нельзя: считать, что модель правильная. Проверять — обязанность этого файла.
 *
 * Что делает Blender не так, и почему проверки здесь есть.
 *
 *   Масштаб. В Blender единица — метр, но если объект собирали при масштабе
 *   объекта 0.01 и забыли применить (Ctrl+A → Scale), то в игре он приедет
 *   сантиметровым. На картинке это выглядит как «пропала модель», и ищут
 *   её обычно долго.
 *
 *   Оси. Blender внутри Z вверх, glTF — Y вверх. Экспортёр переворачивает
 *   сам, но галку «+Y Up» иногда снимают. Тогда дом лежит на боку.
 *
 *   Начало координат. Модель, у которой начало координат где-то в углу
 *   сцены, ставится не туда, куда её кладут, и повернуть её нельзя.
 *
 * Всё это ловится по габаритам и говорится вслух, а не молча исправляется:
 * молча исправленная ошибка вернётся в следующей модели.
 */

import { AbstractMesh, BoundingInfo, SceneLoader, TransformNode, Vector3 } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

export interface Imported {
  root: TransformNode;
  meshes: AbstractMesh[];
  /** Габарит в метрах — по нему видно, не приехало ли всё в сантиметрах. */
  size: Vector3;
  center: Vector3;
  triangles: number;
  notes: string[];
  dispose(): void;
}

export async function importGlb(scene: Scene, file: File): Promise<Imported> {
  const url = URL.createObjectURL(file);
  try {
    // Расширение передаём явно: у ссылки на объект в памяти его нет,
    // и без подсказки загрузчик не поймёт, какой формат читает.
    const ext = file.name.toLowerCase().endsWith(".gltf") ? ".gltf" : ".glb";
    const res = await SceneLoader.ImportMeshAsync("", "", url, scene, undefined, ext);

    const root = new TransformNode(`из blender: ${file.name}`, scene);
    const meshes = res.meshes.filter((m) => m.getTotalVertices() > 0);

    for (const m of res.meshes) if (!m.parent) m.parent = root;

    const notes: string[] = [];
    let triangles = 0;
    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);

    for (const m of meshes) {
      m.computeWorldMatrix(true);
      m.refreshBoundingInfo();
      const bi: BoundingInfo = m.getBoundingInfo();
      min = Vector3.Minimize(min, bi.boundingBox.minimumWorld);
      max = Vector3.Maximize(max, bi.boundingBox.maximumWorld);
      triangles += m.getTotalIndices() / 3;
      m.isPickable = true;
    }

    if (!meshes.length) {
      notes.push("В файле нет ни одной поверхности — вероятно, экспортировали пустую коллекцию.");
      min = Vector3.Zero();
      max = Vector3.Zero();
    }

    const size = max.subtract(min);
    const center = max.add(min).scale(0.5);

    /* --- разбор частых бед --------------------------------------------- */

    const biggest = Math.max(size.x, size.y, size.z);
    if (meshes.length && biggest < 0.05)
      notes.push(
        `Модель размером ${biggest.toFixed(3)} м — почти наверняка масштаб не применён. ` +
        "В Blender: выделить всё, Ctrl+A → Scale, экспортировать заново.",
      );
    if (biggest > 200)
      notes.push(`Модель ${biggest.toFixed(0)} м в поперечнике — проверь единицы сцены в Blender.`);

    // Дом выше, чем шире, — почти всегда признак того, что сняли «+Y Up».
    if (meshes.length && size.y > (size.x + size.z) * 1.6 && size.y > 8)
      notes.push("Модель вытянута вверх сильнее, чем в плане: похоже, при экспорте снята галка «+Y Up».");

    const off = Math.hypot(center.x, center.z);
    if (off > Math.max(4, biggest))
      notes.push(
        `Начало координат в ${off.toFixed(1)} м от модели. ` +
        "Object → Set Origin → Origin to Geometry, иначе предмет не встанет туда, куда его кладут.",
      );

    if (triangles > 400_000)
      notes.push(`${Math.round(triangles / 1000)} тысяч треугольников — для веба тяжело, стоит проредить.`);

    return {
      root, meshes, size, center, triangles, notes,
      dispose() {
        for (const m of res.meshes) m.dispose();
        root.dispose();
      },
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Загрузка модели, лежащей рядом с сайтом, — для готовой карты из Blender.
 * Путь относительный: абсолютные ломаются на GitHub Pages, где сайт живёт
 * не в корне домена, а в подпапке с именем репозитория.
 */
export async function importFromUrl(scene: Scene, folder: string, name: string) {
  const res = await SceneLoader.ImportMeshAsync("", folder, name, scene);
  const root = new TransformNode(`карта: ${name}`, scene);
  for (const m of res.meshes) if (!m.parent) m.parent = root;
  return { root, meshes: res.meshes };
}
