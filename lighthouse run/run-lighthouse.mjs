// run-lighthouse.mjs
// Runs Lighthouse repeatedly on the React (CSR) and Next.js (SSR) apps
// and exports raw results + medians to CSV.
//
// Setup (once, in an empty folder):
//   npm init -y
//   npm install lighthouse chrome-launcher
// Run:
//   node run-lighthouse.mjs

import fs from "node:fs";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

// ---------- CONFIG: edit these ----------
const APPS = [
  { name: "react-csr", baseUrl: "https://research-react-csr.vercel.app" },
  { name: "nextjs-ssr", baseUrl: "https://research-next-ssr.vercel.app" }, // FIXED: new project name
];
const PAGES = [
  { name: "list", path: "/" },
  { name: "detail", path: "/product/1" },
];
const RUNS = 20; // test with 2 first, then change to 20 for the full run
const CPU_SLOWDOWN = 4; // same value for every run; lower it (2 or 3) if your laptop triggers the CPU warning
const PAUSE_MS = 2000; // pause between runs
// ----------------------------------------

const CONDITIONS = [
  {
    name: "unthrottled",
    settings: { throttlingMethod: "provided" },
  },
  {
    name: "slow4g",
    settings: {
      throttlingMethod: "simulate",
      throttling: {
        rttMs: 150,
        throughputKbps: 1638.4,
        cpuSlowdownMultiplier: CPU_SLOWDOWN,
      },
    },
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const fmt = (v, digits = 1) => (isNum(v) ? v.toFixed(digits) : "");

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function runOnce(url, condition) {
  // Fresh Chrome per run so nothing is cached between runs
  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", "--no-sandbox"],
  });
  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      logLevel: "error",
      output: "json",
      onlyCategories: ["performance"],
      ...condition.settings,
    });
    const lhr = result.lhr;

    // FIXED: stop with a clear message if Lighthouse could not load the page
    if (lhr.runtimeError) {
      throw new Error(`Lighthouse error ${lhr.runtimeError.code}: ${lhr.runtimeError.message}`);
    }

    const a = lhr.audits;

    // FIXED: reject runs where the main document did not return HTTP 200
    const doc = a["network-requests"]?.details?.items?.[0];
    if (doc && doc.statusCode !== 200) {
      throw new Error(`Main document returned HTTP ${doc.statusCode} (${lhr.finalDisplayedUrl})`);
    }

    const metrics = {
      fcp: a["first-contentful-paint"]?.numericValue,
      lcp: a["largest-contentful-paint"]?.numericValue,
      tbt: a["total-blocking-time"]?.numericValue,
      cls: a["cumulative-layout-shift"]?.numericValue,
      speedIndex: a["speed-index"]?.numericValue,
    };

    // FIXED: fail with a readable message instead of crashing on .toFixed()
    const missing = Object.entries(metrics)
      .filter(([, v]) => !isNum(v))
      .map(([k]) => k);
    if (missing.length) {
      throw new Error(`Missing metrics: ${missing.join(", ")} (final URL: ${lhr.finalDisplayedUrl})`);
    }

    // OPTIONAL: custom mark performance.mark("products-visible") set in the app.
    // Stays blank if the mark is not present or Lighthouse does not report it.
    const marks = a["user-timings"]?.details?.items ?? [];
    const productsVisible = marks.find((m) => m.name === "products-visible")?.startTime;

    return {
      ...metrics,
      productsVisible,
      score: Math.round(lhr.categories.performance.score * 100),
      benchmark: lhr.environment?.benchmarkIndex ?? "",
      lhVersion: lhr.lighthouseVersion,
    };
  } finally {
    await chrome.kill();
  }
}

async function main() {
  fs.mkdirSync("results", { recursive: true });
  const rows = [];
  const header =
    "app,page,condition,run,fcp_ms,lcp_ms,tbt_ms,cls,speed_index_ms,products_visible_ms,score,benchmark_index,lighthouse_version";
  const lines = [header];
  let failures = 0;

  // Interleave apps inside each run so slow/fast DummyJSON periods
  // affect both apps roughly equally.
  for (const condition of CONDITIONS) {
    for (const page of PAGES) {
      for (let run = 1; run <= RUNS; run++) {
        for (const app of APPS) {
          const url = app.baseUrl + page.path;
          try {
            const r = await runOnce(url, condition);
            rows.push({ app: app.name, page: page.name, condition: condition.name, ...r });
            lines.push(
              [
                app.name, page.name, condition.name, run,
                fmt(r.fcp), fmt(r.lcp), fmt(r.tbt), fmt(r.cls, 4), fmt(r.speedIndex),
                fmt(r.productsVisible), r.score, r.benchmark, r.lhVersion,
              ].join(",")
            );
            fs.writeFileSync("results/raw.csv", lines.join("\n")); // save after every run
            console.log(
              `${condition.name} | ${page.name} | run ${run}/${RUNS} | ${app.name}: ` +
              `FCP ${fmt(r.fcp, 0)} LCP ${fmt(r.lcp, 0)} TBT ${fmt(r.tbt, 0)}` +
              (isNum(r.productsVisible) ? ` PV ${fmt(r.productsVisible, 0)}` : "")
            );
          } catch (err) {
            failures++;
            console.error(
              `FAILED ${app.name} ${page.name} ${condition.name} run ${run} (${url}):`,
              err.message
            );
          }
          await sleep(PAUSE_MS);
        }
      }
    }
  }

  // Summary: median, min, max per group
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.app}|${r.page}|${r.condition}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const summary = [
    "app,page,condition,n,fcp_median,fcp_min,fcp_max,lcp_median,lcp_min,lcp_max,tbt_median,tbt_min,tbt_max,speed_index_median,products_visible_median",
  ];
  for (const [key, list] of groups) {
    const [app, page, condition] = key.split("|");
    const stat = (f) => {
      const v = list.map((x) => x[f]).filter(isNum);
      if (!v.length) return ["", "", ""];
      return [median(v), Math.min(...v), Math.max(...v)].map((n) => n.toFixed(1));
    };
    const pv = list.map((x) => x.productsVisible).filter(isNum);
    summary.push(
      [
        app, page, condition, list.length,
        ...stat("fcp"), ...stat("lcp"), ...stat("tbt"),
        fmt(median(list.map((x) => x.speedIndex))),
        pv.length ? fmt(median(pv)) : "",
      ].join(",")
    );
  }
  fs.writeFileSync("results/summary.csv", summary.join("\n"));

  const expected = CONDITIONS.length * PAGES.length * RUNS * APPS.length;
  console.log(`\nDone. ${rows.length}/${expected} runs succeeded, ${failures} failed.`);
  console.log("See results/raw.csv and results/summary.csv");
}

main();
