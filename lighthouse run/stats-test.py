"""
stats-tests.py
Mann-Whitney U tests comparing React (CSR) and Next.js (SSR) for each
page x condition, on LCP, FCP and products-visible.

Usage (from the folder that contains results/raw.csv):
    pip install pandas scipy
    python stats-tests.py                # reads results/raw.csv
    python stats-tests.py path/to/raw.csv

Outputs:
    results/stats.csv         full table
    results/stats_table.tex   LaTeX table to paste into the paper
"""
import sys
import numpy as np  # type: ignore[import-not-found]
import pandas as pd  # type: ignore[reportMissingModuleSource]
from scipy.stats import mannwhitneyu  # type: ignore[import-not-found]

RAW = sys.argv[1] if len(sys.argv) > 1 else "results/raw.csv"
OUT_CSV = "results/stats.csv"
OUT_TEX = "results/stats_table.tex"

CSR, SSR = "react-csr", "nextjs-ssr"
METRICS = [("lcp_ms", "LCP"), ("fcp_ms", "FCP"), ("products_visible_ms", "Visible")]
PAGES = [("list", "List"), ("detail", "Detail")]
CONDS = [("unthrottled", "Unthrottled"), ("slow4g", "Slow 4G")]


def holm(p):
    """Holm-Bonferroni adjusted p-values."""
    p = np.asarray(p, dtype=float)
    m = len(p)
    adj = np.empty(m)
    running = 0.0
    for rank, idx in enumerate(np.argsort(p)):
        running = max(running, (m - rank) * p[idx])
        adj[idx] = min(1.0, running)
    return adj


def fmt_p(p):
    return "$<0.001$" if p < 0.001 else f"{p:.3f}"


df = pd.read_csv(RAW)
rows = []
for col, mlabel in METRICS:
    for page, plabel in PAGES:
        for cond, clabel in CONDS:
            sub = df[(df["page"] == page) & (df["condition"] == cond)]
            a = sub[sub["app"] == CSR][col].dropna().to_numpy()
            b = sub[sub["app"] == SSR][col].dropna().to_numpy()
            if len(a) < 2 or len(b) < 2:
                continue
            u, p = mannwhitneyu(a, b, alternative="two-sided")
            # rank-biserial correlation (= Cliff's delta).
            # Positive: CSR values tend to be larger, i.e. SSR is faster.
            r = 2 * u / (len(a) * len(b)) - 1
            rows.append(dict(
                metric=mlabel, page=plabel, condition=clabel,
                n_csr=len(a), n_ssr=len(b),
                median_csr=np.median(a), median_ssr=np.median(b),
                U=u, p=p, r=r,
            ))

res = pd.DataFrame(rows)
res["p_holm"] = holm(res["p"].to_numpy())  # correction over all tests together
res.to_csv(OUT_CSV, index=False)

lines = [
    r"\begin{table}[t]",
    r"\caption{Mann-Whitney U tests, CSR vs SSR (Holm-adjusted $p$; $r$ = rank-biserial correlation, positive when SSR is faster)}",
    r"\label{tab:stats}",
    r"\centering",
    r"\footnotesize",
    r"\setlength{\tabcolsep}{3pt}",
    r"\begin{tabular}{@{}lllrrr@{}}",
    r"\toprule",
    r"Metric & Page & Condition & $U$ & $p_{\mathrm{adj}}$ & $r$ \\",
    r"\midrule",
]
for _, x in res.iterrows():
    lines.append(
        f"{x.metric} & {x.page} & {x.condition} & {x.U:.0f} & {fmt_p(x.p_holm)} & {x.r:+.2f} \\\\"
    )
lines += [r"\bottomrule", r"\end{tabular}", r"\end{table}"]
with open(OUT_TEX, "w") as f:
    f.write("\n".join(lines) + "\n")

pd.set_option("display.width", 200)
print(res.round({"median_csr": 1, "median_ssr": 1, "p": 4, "p_holm": 4, "r": 3}).to_string(index=False))
print(f"\nWrote {OUT_CSV} and {OUT_TEX}")