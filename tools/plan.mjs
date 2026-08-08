/**
 * plan.mjs — рисует обмерный чертёж из spec/house-map.json.
 *
 *   node tools/plan.mjs   →  public/plan.html
 *
 * Чертёж не хранится в репозитории. Он собирается из той же карты, из
 * которой строятся дом, коллизии и валидатор, и пересобирается при каждой
 * публикации. Это и есть механика правила «одна планировка»: разойтись
 * с игрой чертёж физически не может, потому что своих данных у него нет.
 *
 * Открывается по адресу игры с хвостом /plan.html
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAP = JSON.parse(readFileSync(join(root, "spec/house-map.json"), "utf8"));

const S = 38; // пикселей на метр
const PAD = 26;
const W = MAP.w * S + PAD * 2;
const H = MAP.d * S + PAD * 2;
const px = (m) => (m * S + PAD).toFixed(1);

const MAT = { parquet: "#2b2722", tile: "#232a2e", concrete: "#212326", planks: "#2d2823", metal: "#1f272b" };

const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);

function roomShape(r) {
  const fill = MAT[r.mat] ?? "#26282b";
  if (r.pts) {
    const pts = r.pts.map(([x, z]) => `${px(x)},${px(z)}`).join(" ");
    return `<polygon points="${pts}" fill="${fill}" stroke="#454b52"/>`;
  }
  return `<rect x="${px(r.x0)}" y="${px(r.z0)}" width="${((r.x1 - r.x0) * S).toFixed(1)}" ` +
         `height="${((r.z1 - r.z0) * S).toFixed(1)}" fill="${fill}" stroke="#454b52"/>`;
}

function centroid(r) {
  // Подпись ставится в точку, максимально удалённую от стен, и никогда —
  // поверх ядра. У «петлевого» коридора центр тяжести вообще лежит снаружи,
  // в котельной, поэтому простого среднего тут мало.
  const xs = r.pts ? r.pts.map((p) => p[0]) : [r.x0, r.x1];
  const zs = r.pts ? r.pts.map((p) => p[1]) : [r.z0, r.z1];
  const cores = [MAP.core.shaft, MAP.core.stairwell, MAP.core.hatch];
  let best = null, bestD = -1;
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.25)
    for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.25) {
      if (cores.some((b) => x > b[0] - 0.6 && x < b[2] + 0.6 && z > b[1] - 0.4 && z < b[3] + 0.4)) continue;
      let d;
      if (r.pts) {
        if (!inPoly(x, z, r.pts)) continue;
        d = Infinity;
        for (let i = 0, n = r.pts.length; i < n; i++)
          d = Math.min(d, segDist(x, z, r.pts[i], r.pts[(i + 1) % n]));
      } else {
        d = Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z);
        if (d < 0) continue;
      }
      if (d > bestD) { bestD = d; best = [x, z]; }
    }
  return best ?? [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
}

function inPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % n];
    if (z1 > z !== z2 > z && x < ((x2 - x1) * (z - z1)) / (z2 - z1) + x1) inside = !inside;
  }
  return inside;
}

function segDist(x, z, [x1, z1], [x2, z2]) {
  const dx = x2 - x1, dz = z2 - z1;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - (x1 + t * dx), z - (z1 + t * dz));
}

function box(b, fill, stroke, label, sub) {
  const [x0, z0, x1, z1] = b;
  const cxm = (x0 + x1) / 2;
  // Подпись прижата к верху пятна: в центре стоит метка лифта или скоб.
  return `<g><rect x="${px(x0)}" y="${px(z0)}" width="${((x1 - x0) * S).toFixed(1)}" ` +
    `height="${((z1 - z0) * S).toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-dasharray="4 3"/>` +
    `<text class="core" x="${px(cxm)}" y="${px(z0 + 0.4)}">${label}</text>` +
    (sub ? `<text class="sub" x="${px(cxm)}" y="${px(z1 - 0.4)}">${sub}</text>` : "") + `</g>`;
}

const COLLAPSE = { solid: ["кладка", "#33211f"], rubble: ["завал", "#3a2420"], void: ["провал", "#160f0f"] };

function level(L) {
  const rooms = MAP.rooms.filter((r) => r.level === L.id);
  let s = `<rect x="${PAD}" y="${PAD}" width="${MAP.w * S}" height="${MAP.d * S}" fill="#0d0e0f"/>`;

  // сетка 0.5 м — та же клетка, что в карте
  for (let x = 0; x <= MAP.w; x += MAP.cell)
    s += `<line class="${x % 1 ? "g5" : "g1"}" x1="${px(x)}" y1="${px(0)}" x2="${px(x)}" y2="${px(MAP.d)}"/>`;
  for (let z = 0; z <= MAP.d; z += MAP.cell)
    s += `<line class="${z % 1 ? "g5" : "g1"}" x1="${px(0)}" y1="${px(z)}" x2="${px(MAP.w)}" y2="${px(z)}"/>`;

  for (const r of rooms) s += roomShape(r);

  s += box(MAP.core.shaft, "#2a201c", "#7a5c48", "ШАХТА");
  const [cl, cc] = COLLAPSE[MAP.core.collapse[L.id]];
  s += box(MAP.core.stairwell, cc, "#8a4a44", "ОБВАЛ", cl);
  if (L.id === "f1" || L.id === "cellar") s += box(MAP.core.hatch, "#2c2a1c", "#8a7c44", "ЛЮК");

  for (const f of MAP.furniture.filter((f) => f.level === L.id))
    s += `<circle class="furn" cx="${px(f.x)}" cy="${px(f.z)}" r="2.6"><title>${esc(f.name)}</title></circle>`;

  for (const r of rooms) {
    const [x, z] = centroid(r);
    s += `<text class="room" x="${px(x)}" y="${px(z)}">${esc(r.name)}</text>`;
  }

  for (const o of MAP.openings.filter((o) => o.level === L.id)) {
    const w = o.o === "v" ? 0.24 : 1.0, h = o.o === "v" ? 1.0 : 0.24;
    s += `<rect class="open" x="${px(o.x - w / 2)}" y="${px(o.z - h / 2)}" ` +
      `width="${(w * S).toFixed(1)}" height="${(h * S).toFixed(1)}"><title>${esc(o.label)}</title></rect>`;
  }

  for (const d of MAP.doors.filter((d) => d.level === L.id)) {
    const w = d.o === "v" ? 0.3 : 0.95, h = d.o === "v" ? 0.95 : 0.3;
    s += `<rect class="door" data-door="${d.id}" x="${px(d.x - w / 2)}" y="${px(d.z - h / 2)}" ` +
      `width="${(w * S).toFixed(1)}" height="${(h * S).toFixed(1)}">` +
      `<title>${esc(d.label)} — ${d.stage === null ? "заперта всегда" : "стадия " + d.stage +
        (d.close !== null ? ", закрывается на " + d.close : "")}</title></rect>`;
  }

  for (const l of MAP.links.filter((l) => l.from === L.id))
    s += `<g class="link"><circle cx="${px(l.x)}" cy="${px(l.z)}" r="7"/>` +
      `<text x="${px(l.x)}" y="${px(l.z)}">${l.kind === "lift" ? "Л" : l.kind === "stair" ? "Т" : "С"}</text>` +
      `<title>${esc(l.label)}</title></g>`;

  for (const it of MAP.items.filter((i) => i.level === L.id))
    s += `<circle class="item" cx="${px(it.x)}" cy="${px(it.z)}" r="5"><title>${esc(it.name)} — появляется на ${it.appear}, нужен на ${it.need}</title></circle>`;

  for (const b of MAP.beats.filter((b) => b.level === L.id))
    s += `<circle class="beat" data-stage="${b.stage}" cx="${px(b.x)}" cy="${px(b.z)}" r="5"><title>${b.stage}: ${esc(b.text)}</title></circle>`;

  if (MAP.focus && MAP.focus.level === L.id)
    s += `<g class="focus"><circle cx="${px(MAP.focus.x)}" cy="${px(MAP.focus.z)}" r="9"/>` +
      `<title>${esc(MAP.focus._)}</title></g>`;

  return `<section data-level="${L.id}"><h2>${L.name} <span>отметка ${L.y.toFixed(1)} м · ` +
    `${rooms.length} помещ.</span></h2><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${s}</svg></section>`;
}

const doorData = JSON.stringify(
  MAP.doors.map((d) => ({ id: d.id, stage: d.stage, close: d.close, label: d.label })));
const stageData = JSON.stringify(MAP.stages.map((s) => ({ n: s.n, name: s.name, goal: s.goal, level: s.level })));

const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<title>ЗАТОН — обмерный чертёж</title>
<style>
 :root{color-scheme:dark}
 body{margin:0;padding:22px;background:#0b0b0c;color:#cfcabf;
      font:13px/1.6 ui-monospace,"Cascadia Mono",Menlo,Consolas,monospace}
 h1{font-size:14px;letter-spacing:.4em;text-transform:uppercase;font-weight:400;margin:0 0 4px}
 .warn{color:#6e6a63;max-width:70ch;margin:0 0 20px}
 h2{font-size:13px;font-weight:400;margin:26px 0 6px;letter-spacing:.18em;text-transform:uppercase}
 h2 span{color:#6e6a63;letter-spacing:0;text-transform:none}
 svg{display:block;background:#0b0b0c}
 .g1{stroke:#1c1e20}.g5{stroke:#141516}
 text{font:10px ui-monospace,monospace;fill:#8d8880;text-anchor:middle;dominant-baseline:middle}
 text.room{fill:#9a948a;letter-spacing:.06em}
 text.core{fill:#b09070;font-size:9px;letter-spacing:.22em}
 text.sub{fill:#7a6a60;font-size:8px}
 .furn{fill:#4d535a}
 .item{fill:#d8b46a}
 .beat{fill:#6fa8c8}
 .beat.off{fill:#2f3d45}
 .open{fill:#5f7f5f}
 .door{fill:#7fbf7f}
 .door.shut{fill:#6b4a4a}
 .door.never{fill:#4a3a44}
 .link circle{fill:#2a2b30;stroke:#7a6a9a}
 .link text{fill:#a99ac8;font-size:9px}
 .focus circle{fill:none;stroke:#8a4a44;stroke-dasharray:3 3}
 .bar{position:sticky;top:0;background:#0b0b0cee;padding:10px 0 12px;z-index:2;
      backdrop-filter:blur(4px);border-bottom:1px solid #1c1e20}
 input[type=range]{width:340px;vertical-align:middle}
 #st{color:#cfcabf}
 #goal{color:#6e6a63}
 .legend{color:#6e6a63;margin-top:6px}
 .legend b{font-weight:400}
 .k{display:inline-block;width:9px;height:9px;border-radius:2px;vertical-align:-1px;margin:0 4px 0 12px}
</style></head><body>
<h1>Затон — обмерный чертёж</h1>
<p class="warn">Файл собран из <code>spec/house-map.json</code> скриптом <code>tools/plan.mjs</code>
и в репозитории не хранится. Править чертёж напрямую бессмысленно: при следующей
публикации он перерисуется из карты. Правится карта.</p>
<div class="bar">
 Стадия <input id="s" type="range" min="0" max="${MAP.stages.length - 1}" value="0">
 <b id="st"></b> — <span id="goal"></span>
 <div class="legend">
  <span class="k" style="background:#7fbf7f"></span>дверь открыта
  <span class="k" style="background:#6b4a4a"></span>закрыта
  <span class="k" style="background:#4a3a44"></span>заперта навсегда
  <span class="k" style="background:#d8b46a"></span>предмет
  <span class="k" style="background:#6fa8c8"></span>событие стадии
  <span class="k" style="background:#2a2b30;border:1px solid #7a6a9a"></span>Л лифт · Т лестница · С скобы
 </div>
</div>
${MAP.levels.map(level).join("\n")}
<script>
const DOORS=${doorData}, STAGES=${stageData};
const r=document.getElementById("s");
function draw(){
 const n=+r.value, s=STAGES.find(x=>x.n===n);
 document.getElementById("st").textContent=n+" — "+s.name;
 document.getElementById("goal").textContent=s.goal;
 for(const d of DOORS){
  const el=document.querySelector('[data-door="'+d.id+'"]');
  if(!el) continue;
  el.classList.remove("shut","never");
  if(d.stage===null) el.classList.add("never");
  else if(n<d.stage||(d.close!==null&&n>=d.close)) el.classList.add("shut");
 }
 for(const b of document.querySelectorAll(".beat"))
  b.classList.toggle("off", +b.dataset.stage!==n);
 for(const sec of document.querySelectorAll("section"))
  sec.style.opacity = sec.dataset.level===s.level ? 1 : .45;
}
r.addEventListener("input",draw); draw();
</script></body></html>`;

mkdirSync(join(root, "public"), { recursive: true });
writeFileSync(join(root, "public/plan.html"), html);
console.log(`Чертёж собран: public/plan.html, ${(html.length / 1024).toFixed(0)} КБ, ` +
            `${MAP.levels.length} уровня, ${MAP.doors.length} дверей.`);
