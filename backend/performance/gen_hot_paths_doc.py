"""
Gera docs/engineering/backend-hot-paths.md a partir de performance/_inventory.json.

Sprint 3 — hot path discovery. A frequência NÃO vem de logs de produção
(não existem logs acessíveis); é ESTIMATIVA derivada da participação de cada
rota nas jornadas reais do app, e está marcada como tal no documento.
"""

from __future__ import annotations

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
INV = pathlib.Path(__file__).resolve().parent / "_inventory.json"
OUT = ROOT / "docs" / "engineering" / "backend-hot-paths.md"

# ---------------------------------------------------------------------------
# Jornadas reais (derivadas do fluxo do app, não de logs)
# ---------------------------------------------------------------------------
JOURNEYS: dict[str, tuple[str, ...]] = {
    "J1 abertura do app": ("/auth/me", "/legal/latest", "/inbox/unread", "/health"),
    "J2 login e provisionamento": ("/auth/me", "/auth/login", "/auth/register", "/auth/check-cpf"),
    "J3 home": ("/inbox/unread", "/inbox", "/auth/me", "/org/my-memberships"),
    "J4 eventos (lista/detalhe)": ("/retreats", "/retreats/{retreat_id}"),
    "J5 notificações": ("/inbox", "/inbox/unread", "/inbox/{recipient_id}/read", "/inbox/read-all"),
    "J6 perfil": ("/profile", "/profile/catalogs", "/profile/sectors", "/profile/missions"),
    "J7 documentos legais": ("/legal/latest", "/legal/accept"),
    "J8 rajada pós-Push": ("/auth/me", "/inbox/unread", "/inbox", "/legal/latest"),
    "J9 administração": ("/admin/dashboard", "/admin/users", "/admin/audit-logs"),
}

# Frequência relativa ESTIMADA (1..10), indexada por MÉTODO + PATH.
# Indexar só pelo path era um viés real: `DELETE /auth/me` (exclusão de conta,
# rara) herdava a frequência de `GET /auth/me` e liderava o ranking.
FREQ: dict[str, int] = {
    "GET /auth/me": 10,          # toda abertura de app + refresh de token
    "GET /inbox/unread": 8,      # badge da home
    "GET /legal/latest": 7,      # toda abertura enquanto houver pendência
    "GET /inbox": 6,
    "GET /retreats": 5,
    "GET /retreats/{retreat_id}": 4,
    "GET /profile": 4,
    "GET /org/my-memberships": 3,
    "POST /legal/accept": 2,
    "GET /admin/dashboard": 2,   # poucos usuários, mas custo alto
    "GET /health": 9,            # healthcheck da plataforma (barato)
    "DELETE /auth/me": 1,        # exclusão de conta — rara por definição
}
DEFAULT_FREQ = 1


def freq_of(method: str, path: str) -> tuple[int, str]:
    key = f"{method} {path}"
    if key in FREQ:
        return FREQ[key], "estimativa por jornada"
    return DEFAULT_FREQ, "baseline (não está em jornada quente)"


def journeys_of(path: str) -> list[str]:
    return [j for j, paths in JOURNEYS.items() if path in paths]


def concurrency_of(path: str, journeys: list[str]) -> int:
    """Potencial de concorrência: rotas de abertura/rajada concentram acessos."""
    if any(j.startswith(("J1", "J8")) for j in journeys):
        return 3
    if journeys:
        return 2
    return 1


def main() -> None:
    routes = json.loads(INV.read_text(encoding="utf-8"))

    for r in routes:
        js = journeys_of(r["path"])
        f, origin = freq_of(r["method"], r["path"])
        c = concurrency_of(r["path"], js)
        # impacto = frequência × concorrência × custo de banco (proxy de latência)
        r["journeys"] = js
        r["freq"] = f
        r["freq_origin"] = origin
        r["conc"] = c
        r["impact"] = f * c * max(r["db_ops_static"], 1)

    ranked = sorted(routes, key=lambda r: -r["impact"])
    conv = [r for r in routes if r["recommendation"] == "CONVERTER para def"]

    L: list[str] = []
    A = L.append
    A("# Backend — Inventário de Rotas e Hot Paths (Sprint 3)")
    A("")
    A("**Gerado por:** `backend/performance/route_inventory.py` + `gen_hot_paths_doc.py` "
      "(reproduzível: `python performance/route_inventory.py > performance/_inventory.json`).")
    A("")
    A("## Método e limitações (ler antes de usar os números)")
    A("")
    A("A classificação é **análise estática de AST com travessia de call graph de 2 níveis** "
      "(rota → service → helper). Não é perfilamento em produção.")
    A("")
    A("**Limitações conhecidas e comprovadas:**")
    A("")
    A("- `db_ops` é **contagem estática de chamadas no código**, não queries executadas em "
      "runtime. Um laço conta 1 estaticamente e N em execução.")
    A("- A primeira versão do detector produziu **falso-negativo comprovado**: as rotas "
      "`/inbox/*` foram classificadas como \"sem banco\" porque delegam 100% para "
      "`InboxService(db)`. Corrigido detectando instanciação de Service/Repository "
      "que recebe a sessão. **Podem restar outros falsos-negativos** — categoria D "
      "significa *\"nenhum trabalho bloqueante detectado\"*, não *\"comprovadamente sem banco\"*.")
    A("- **Frequência não vem de logs de produção** (não há logs acessíveis). É estimativa "
      "derivada da participação da rota nas jornadas do app — marcada como tal em cada linha.")
    A("")
    A("## Resumo")
    A("")
    A(f"- **Total de rotas:** {len(routes)}")
    cats = {"A": 0, "B": 0, "C": 0, "D": 0}
    for r in routes:
        cats[r["category"]] += 1
    A(f"- **Categoria A** (DB-bound pesada / CPU-bound): {cats['A']}")
    A(f"- **Categoria B** (DB-bound leve): {cats['B']}")
    A(f"- **Categoria C** (integração externa síncrona): {cats['C']}")
    A(f"- **Categoria D** (nenhum trabalho bloqueante detectado): {cats['D']}")
    A(f"- **Já são `def`:** {sum(1 for r in routes if r['kind'] == 'def')}")
    A(f"- **`async def` sem `await` COM trabalho bloqueante (a converter):** {len(conv)}")
    A("")
    A("> **Correção de uma afirmação anterior:** o checkpoint pós-Sprint 4 disse que o problema "
      "era \"app-wide\" a partir de \"104 de 105 rotas async sem await\". O inventário completo "
      "mostra que o total real é "
      f"{len(routes)} rotas, que **{sum(1 for r in routes if r['kind'] == 'def')} já eram `def`**, "
      f"e que **{cats['D']} rotas não têm trabalho bloqueante detectado** — converter essas não "
      "traz ganho. A generalização estava errada; o número correto de alvos é "
      f"**{len(conv)}**.")
    A("")
    A("## Jornadas reais mapeadas")
    A("")
    for j, paths in JOURNEYS.items():
        A(f"- **{j}** → {', '.join(f'`{p}`' for p in paths)}")
    A("")
    A("## Fórmula de ranking")
    A("")
    A("```")
    A("impacto = frequência(estimada) × concorrência × custo_de_banco(db_ops estático)")
    A("```")
    A("")
    A("`concorrência` = 3 para rotas de abertura/rajada pós-Push (acessos concentrados), "
      "2 para rotas de jornada, 1 caso contrário.")
    A("")
    A("## Top 20 hot paths por impacto")
    A("")
    A("| # | Impacto | Método | Path | Cat | Tipo | db_ops | Freq (origem) | Jornadas | Recomendação |")
    A("|---|--------:|--------|------|-----|------|-------:|---------------|----------|--------------|")
    for i, r in enumerate(ranked[:20], 1):
        js = ", ".join(x.split()[0] for x in r["journeys"]) or "—"
        A(f"| {i} | {r['impact']} | {r['method']} | `{r['path']}` | {r['category']} | "
          f"{r['kind']} | {r['db_ops_static']} | {r['freq']} ({r['freq_origin']}) | {js} | "
          f"{r['recommendation']} |")
    A("")
    A("## Seleção justificada das rotas da Sprint 4")
    A("")
    A("Convertidas no PR #21 (primeiro lote, deliberadamente pequeno):")
    A("")
    A("| Alvo | Justificativa |")
    A("|------|---------------|")
    A("| `get_current_user` (dependency) | Não é rota: é a dependency de **toda** rota autenticada. "
      "Era `async def` sem `await` executando verificação de token + I/O de banco. Enquanto ela "
      "bloqueasse o loop, converter rotas isoladas não produziria ganho. **Maior alavancagem do projeto.** |")
    A("| `GET /auth/me` | Maior impacto do ranking (frequência 10 × concorrência 3). |")
    A("| `GET /legal/latest` | Jornada de abertura + rajada pós-Push. |")
    A("")
    A("## Risco de N+1 remanescente (queries dentro de laço)")
    A("")
    A("| Método | Path | db_ops | Observação |")
    A("|--------|------|-------:|------------|")
    for r in sorted([x for x in routes if x["n_plus_1_risk"]], key=lambda x: -x["db_ops_static"])[:15]:
        A(f"| {r['method']} | `{r['path']}` | {r['db_ops_static']} | query dentro de laço — "
          "candidato a `joinedload`/`selectinload` |")
    A("")
    A("## Integrações externas síncronas (categoria C)")
    A("")
    for r in [x for x in routes if x["category"] == "C"]:
        A(f"- `{r['method']} {r['path']}` → {', '.join(r['external'])}")
    A("")
    A("## Inventário completo")
    A("")
    A("| Método | Path | Arquivo | Tipo | await | Deps | Banco | db_ops | N+1? | Externa | CPU | Cat | Recomendação |")
    A("|--------|------|---------|------|-------|------|-------|-------:|------|---------|-----|-----|--------------|")
    for r in sorted(routes, key=lambda x: (x["category"], x["path"])):
        deps = ", ".join(d.replace("Depends(", "").replace(")", "") for d in r["deps"][:3]) or "—"
        ext = ", ".join(r["external"]) or "—"
        A(f"| {r['method']} | `{r['path']}` | `{r['file'].replace('backend/app/api/', '')}` | "
          f"{r['kind']} | {'sim' if r['has_await'] else 'não'} | {deps} | "
          f"{'sim' if r['touches_db'] else 'não det.'} | {r['db_ops_static']} | "
          f"{'SIM' if r['n_plus_1_risk'] else '—'} | {ext} | {'sim' if r['cpu_bound'] else '—'} | "
          f"{r['category']} | {r['recommendation']} |")
    A("")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"OK -> {OUT.relative_to(ROOT)}  ({len(L)} linhas, {len(routes)} rotas)")


if __name__ == "__main__":
    main()
