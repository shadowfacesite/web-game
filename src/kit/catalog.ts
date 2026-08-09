/**
 * catalog.ts — все шаблоны в одном списке, и расстановка как данные.
 *
 * Можно: собирать каталог, создавать и сериализовать расставленные предметы.
 * Нельзя: импортировать движок.
 *
 * Расстановка — это JSON, а не состояние сцены. Причина та же, по которой
 * планировка дома живёт в одном файле: то, что нельзя открыть текстовым
 * редактором и сравнить построчно, рано или поздно разъезжается с тем, что
 * видно на экране.
 */

import { clampParams, defaults, builtBounds, sizeOf, v } from "./core.ts";
import type { Built, GroupId, TemplateDef, Params, V3 } from "./core.ts";
import { STRUCTURE } from "./lib/structure.ts";
import { OPENINGS } from "./lib/openings.ts";
import { FURNITURE } from "./lib/furniture.ts";
import { PROPS } from "./lib/props.ts";

export const CATALOG: TemplateDef[] = [...STRUCTURE, ...OPENINGS, ...FURNITURE, ...PROPS];

export const byId = (id: string): TemplateDef | undefined => CATALOG.find((t) => t.id === id);

export function byGroup(): { group: GroupId; items: TemplateDef[] }[] {
  const order: GroupId[] = ["structure", "openings", "furniture", "props", "light"];
  return order
    .map((group) => ({ group, items: CATALOG.filter((t) => t.group === group) }))
    .filter((g) => g.items.length > 0);
}

/* ------------------------------------------------------------------ */
/* Расставленный предмет                                               */
/* ------------------------------------------------------------------ */

export interface Placed {
  /** Свой номер, чтобы предмет можно было выделить и найти в файле. */
  uid: string;
  tpl: string;
  name: string;
  pos: V3;
  /** Поворот в градусах по трём осям. */
  rot: V3;
  /** Масштаб. Отдельно от параметров: параметры меняют устройство предмета,
   *  масштаб — просто растягивает готовое. Нужны оба. */
  scale: V3;
  params: Params;
  /** Положение подвижных частей: id части → градусы или метры. */
  motion: Record<string, number>;
  locked?: boolean;
}

let counter = 0;
export const nextUid = (): string => `o${(++counter).toString(36)}${Date.now().toString(36).slice(-3)}`;

export function place(tplId: string, pos: V3 = v(0, 0, 0)): Placed | null {
  const t = byId(tplId);
  if (!t) return null;
  const params = defaults(t);
  const motion: Record<string, number> = {};
  for (const part of t.build(params).parts ?? [])
    if (part.motion) motion[part.id] = part.motion.def;
  return {
    uid: nextUid(),
    tpl: t.id,
    name: t.name,
    pos: { ...pos },
    rot: v(0, 0, 0),
    scale: v(1, 1, 1),
    params,
    motion,
  };
}

/** Пересобрать предмет после правки параметров. */
export function rebuild(o: Placed): { tpl: TemplateDef; built: Built } | null {
  const tpl = byId(o.tpl);
  if (!tpl) return null;
  o.params = clampParams(tpl, o.params);
  return { tpl, built: tpl.build(o.params) };
}

/** Габарит предмета с учётом масштаба — нужен для подписей и раскладки витрины. */
export function footprint(o: Placed): V3 {
  const r = rebuild(o);
  if (!r) return v(0, 0, 0);
  const s = sizeOf(builtBounds(r.built));
  return v(s.x * o.scale.x, s.y * o.scale.y, s.z * o.scale.z);
}

/* ------------------------------------------------------------------ */
/* Файл сцены                                                          */
/* ------------------------------------------------------------------ */

export interface SceneFile {
  kind: "zaton-kit-scene";
  version: 1;
  saved: string;
  objects: Placed[];
}

export function serialize(objects: Placed[]): string {
  const file: SceneFile = {
    kind: "zaton-kit-scene",
    version: 1,
    saved: new Date().toISOString(),
    objects,
  };
  return JSON.stringify(file, null, 2);
}

/** Разбор с проверками: чужой или битый файл не должен ронять редактор. */
export function parse(text: string): { objects: Placed[]; problems: string[] } {
  const problems: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { objects: [], problems: ["Это не JSON"] };
  }

  const file = raw as Partial<SceneFile>;
  if (file.kind !== "zaton-kit-scene") problems.push("Не файл расстановки кита — пробую разобрать всё равно");

  const src = Array.isArray(file.objects) ? file.objects : [];
  const objects: Placed[] = [];

  for (const item of src) {
    const o = item as Partial<Placed>;
    const tpl = typeof o.tpl === "string" ? byId(o.tpl) : undefined;
    if (!tpl) { problems.push(`Неизвестный шаблон: ${String(o.tpl)}`); continue; }

    const num = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? x : d);
    const vec = (x: unknown, d: number): V3 => {
      const p = (x ?? {}) as Partial<V3>;
      return v(num(p.x, d), num(p.y, d), num(p.z, d));
    };

    const params = clampParams(tpl, (o.params ?? {}) as Params);
    const motion: Record<string, number> = {};
    for (const part of tpl.build(params).parts ?? [])
      if (part.motion) {
        const given = (o.motion ?? {})[part.id];
        motion[part.id] = Math.min(part.motion.max, Math.max(part.motion.min, num(given, part.motion.def)));
      }

    objects.push({
      uid: typeof o.uid === "string" ? o.uid : nextUid(),
      tpl: tpl.id,
      name: typeof o.name === "string" ? o.name : tpl.name,
      pos: vec(o.pos, 0),
      rot: vec(o.rot, 0),
      scale: vec(o.scale, 1),
      params,
      motion,
      locked: o.locked === true,
    });
  }

  return { objects, problems };
}
