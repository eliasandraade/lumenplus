"""
Gera um resumo Markdown a partir dos summaries JSON do k6 (make report).

Lê out/*.json (--summary-export do k6) e produz uma tabela com RPS, p50/p90/p95/
p99, taxa de erro e checks por execução, mais um veredicto de gate por nível.

Uso: python gen_load_report.py [out_dir]
"""

from __future__ import annotations

import json
import pathlib
import sys


def _metric(summary: dict, name: str, field: str, default=None):
    m = summary.get("metrics", {}).get(name, {})
    # k6 summary-export: métricas de trend têm 'values' com p(95) etc.
    vals = m.get("values", m)
    return vals.get(field, default)


def main() -> None:
    out_dir = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "out")
    files = sorted(out_dir.glob("*.json"))
    if not files:
        print(f"Nenhum JSON em {out_dir}/ — rode um alvo `make load-*` antes.")
        return

    rows = []
    for f in files:
        try:
            s = json.loads(f.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"- (ignorado {f.name}: {e})")
            continue
        dur = "http_req_duration"
        err_rate = _metric(s, "http_req_failed", "rate", 0.0) or 0.0
        rows.append({
            "name": f.stem,
            "rps": _metric(s, "http_reqs", "rate"),
            "p50": _metric(s, dur, "med"),
            "p90": _metric(s, dur, "p(90)"),
            "p95": _metric(s, dur, "p(95)"),
            "p99": _metric(s, dur, "p(99)"),
            "err": err_rate,
            "checks": _metric(s, "checks", "rate"),
        })

    def fmt(x, suf=""):
        return f"{x:.1f}{suf}" if isinstance(x, (int, float)) else "—"

    print("# Relatório de carga (k6)\n")
    print("| Execução | RPS | p50 | p90 | p95 | p99 | erro | checks | gate |")
    print("|---|---:|---:|---:|---:|---:|---:|---:|---|")
    for r in rows:
        # gate: erro < 2% e p95 < 2000ms (mesmos thresholds da suíte)
        gate = "OK" if (r["err"] or 0) < 0.02 and (r["p95"] or 0) < 2000 else "FALHOU"
        print(f"| {r['name']} | {fmt(r['rps'])} | {fmt(r['p50'],'ms')} | {fmt(r['p90'],'ms')} | "
              f"{fmt(r['p95'],'ms')} | {fmt(r['p99'],'ms')} | {fmt((r['err'] or 0)*100,'%')} | "
              f"{fmt((r['checks'] or 0)*100,'%')} | {gate} |")

    print("\n**Gate por nível:** erro < 2% E p95 < 2000ms. Um nível só valida a "
          "capacidade se cumprir o gate; o próximo só deve rodar após o anterior passar.")
    print("\n> Números de carga só valem se coletados contra STAGING (nunca produção) "
          "com a configuração do commit registrada no nome do arquivo.")


if __name__ == "__main__":
    main()
