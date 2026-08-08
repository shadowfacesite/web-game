/**
 * map.ts — типизированный доступ к планировке.
 *
 * Можно: читать spec/house-map.json и отдавать его игре.
 * Нельзя: хранить здесь координаты. Ни одной. Если в этом файле появится
 * число, описывающее дом, — значит планировок снова две, и мы вернулись
 * туда, где прошлый заход и умер.
 *
 * Геометрия, коллизии, валидатор и чертёж читают один и тот же файл.
 */

import raw from "../../spec/house-map.json";

export type LevelId = "cellar" | "f1" | "f2" | "f3";

export interface Room {
  level: LevelId;
  id: string;
  name: string;
  mat: string;
  x0?: number; z0?: number; x1?: number; z1?: number;
  pts?: [number, number][];
}

export interface Door {
  level: LevelId;
  id: string;
  x: number;
  z: number;
  o: "v" | "h";
  /** Стадия, с которой дверь проходима. null — заперта навсегда. */
  stage: number | null;
  /** Стадия, с которой она снова закрыта. null — остаётся открытой. */
  close: number | null;
  label: string;
}

export interface Link {
  id: string;
  kind: "lift" | "stair" | "ladder";
  from: LevelId;
  to: LevelId | null;
  x: number;
  z: number;
  stage: number | null;
  close: number | null;
  label: string;
}

export const MAP = raw as unknown as {
  cell: number; w: number; d: number; floorH: number;
  levels: { id: LevelId; name: string; y: number }[];
  core: {
    shaft: [number, number, number, number];
    stairwell: [number, number, number, number];
    hatch: [number, number, number, number];
    collapse: Record<LevelId, "solid" | "rubble" | "void">;
  };
  rooms: Room[];
  doors: Door[];
  openings: { level: LevelId; id: string; x: number; z: number; o: "v" | "h"; label: string }[];
  links: Link[];
  furniture: { level: LevelId; x: number; z: number; name: string; kind: string }[];
  stages: { n: number; name: string; goal: string; level: LevelId;
            at: { level: LevelId; x: number; z: number } }[];
  items: { level: LevelId; id: string; name: string; x: number; z: number; appear: number; need: number }[];
  beats: { level: LevelId; id: string; stage: number; x: number; z: number; text: string }[];
  focus: { level: LevelId; x: number; z: number };
  start: { level: LevelId; x: number; z: number };
};

/** Размер клетки в метрах. Всё, что строится, кратно ему. */
export const CELL = MAP.cell;

export const levelY = (id: LevelId): number =>
  MAP.levels.find((l) => l.id === id)?.y ?? 0;

export const roomsOf = (id: LevelId): Room[] => MAP.rooms.filter((r) => r.level === id);

/** Проходима ли дверь на данной стадии. Та же формула, что в валидаторе. */
export const doorOpen = (d: Door | Link, stage: number): boolean =>
  d.stage !== null && stage >= d.stage && (d.close === null || stage < d.close);
