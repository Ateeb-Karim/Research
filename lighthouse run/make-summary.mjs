// make-summary.mjs
// Builds results/summary.csv from results/raw.csv (no Lighthouse needed).
// Put this file in the same folder as run-lighthouse.mjs and run:
//   node make-summary.mjs

import fs from "node:fs";

const RAW = "results/raw.csv";
const OUT = "results/summary.csv";

const text = fs.readFileSync(RAW, "utf8").trim();
const [headerLine, ...dataLines] = text.split(/\r?\n/);
const cols = headerLine.split(",");
const idx = (name) => cols.indexOf(name);

// Blank cell -> NaN (not 0), so missing values never pollute the stats
const num = (cell) => (cell === undefined || cell.trim() === "" ? NaN : Number(cell));
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const fmt = (v, digits = 1) => (isNum(v) ? v.toFixed(digits) : "");

const rows = dataLines
  .filter((l) => l.trim())
  .map((l) => {
    const c = l.split(",");
    const get = (name) => (idx(name) === -1 ? undefined : c[idx(name)]);
    return {
      app: get("app"),
      page: get("page"),
      condition: get("condition"),
      fcp: num(get("fcp_ms")),
      lcp: num(get("lcp_ms")),
      tbt: num(get("tbt_ms")),
      cls: num(get("cls")),
      speedIndex: num(get("speed_index_ms")),
      productsVisible: num(get("products_visible_ms")), // blank if the column/mark is missing
      score: num(get("score")),
    };
  });

const median = (values) => {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return NaN;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const groups = new Map();
for (const r of rows) {
  const key = `${r.app}|${r.page}|${r.condition}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}

const out = [
  "app,page,condition,n,fcp_median,fcp_min,fcp_max,lcp_median,lcp_min,lcp_max,tbt_median,tbt_min,tbt_max,cls_median,cls_max,speed_index_median,products_visible_median,score_median",
];

for (const [key, list] of groups) {
  const [app, page, condition] = key.split("|");
  const values = (f) => list.map((x) => x[f]).filter(isNum);
  const stat = (f, digits = 1) => {
    const v = values(f);
    if (!v.length) return ["", "", ""];
    return [median(v), Math.min(...v), Math.max(...v)].map((n) => n.toFixed(digits));
  };
  const clsV = values("cls");
  out.push(
    [
      app, page, condition, list.length,
      ...stat("fcp"), ...stat("lcp"), ...stat("tbt"),
      fmt(median(clsV), 4), fmt(clsV.length ? Math.max(...clsV) : NaN, 4),
      fmt(median(values("speedIndex"))),
      fmt(median(values("productsVisible"))),
      fmt(median(values("score")), 0),
    ].join(",")
  );
}

fs.writeFileSync(OUT, out.join("\n"));
console.log(`Read ${rows.length} runs from ${RAW}`);
console.log(`Wrote ${OUT} with ${groups.size} groups\n`);
console.log(out.join("\n"));
