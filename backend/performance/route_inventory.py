"""
Inventário estático de rotas — Sprint 3 (hot path discovery).

Classifica CADA rota da aplicação percorrendo o call graph (rota -> services
-> helpers), e não apenas a assinatura do endpoint. Isso é necessário porque
"async def sem await" NÃO implica "DB-bound": a rota pode ser CPU-bound,
estática, delegar para service síncrono ou chamar integração externa.

Saída: JSON em stdout (consumido por gen_hot_paths_doc.py).

Uso:
    python performance/route_inventory.py > performance/_inventory.json
"""

from __future__ import annotations

import ast
import json
import pathlib
from typing import Any

APP = pathlib.Path(__file__).resolve().parent.parent / "app"

# ---------------------------------------------------------------------------
# Assinaturas de detecção
# ---------------------------------------------------------------------------
DB_CALLS = {"query", "execute", "get", "add", "commit", "flush", "refresh", "delete", "scalars",
            "scalar_one_or_none", "add_all", "merge", "rollback", "bulk_save_objects"}

EXTERNAL_HINTS = {
    "sendgrid": "SendGrid", "send_email": "SendGrid", "smtp": "SMTP",
    "cloudinary": "Cloudinary", "upload": "Cloudinary",
    "firebase": "Firebase", "verify_token": "Firebase",
    "webpush": "WebPush", "send_push": "WebPush", "pywebpush": "WebPush",
    "httpx": "HTTP externo", "requests": "HTTP externo", "urlopen": "HTTP externo",
    "brasilapi": "BrasilAPI", "liturgia": "Liturgia",
    "redis": "Redis",
}

CPU_HINTS = {"encrypt", "decrypt", "hash_cpf", "hash_", "pbkdf2", "bcrypt", "scrypt",
             "hashlib", "csv", "writer", "b64", "sha256", "fernet"}


def _name_of(node: ast.AST) -> str:
    """Nome textual de um nó de chamada (func.attr / func.id)."""
    if isinstance(node, ast.Attribute):
        return node.attr
    if isinstance(node, ast.Name):
        return node.id
    return ""


def _full_dotted(node: ast.AST) -> str:
    parts: list[str] = []
    while isinstance(node, ast.Attribute):
        parts.append(node.attr)
        node = node.value
    if isinstance(node, ast.Name):
        parts.append(node.id)
    return ".".join(reversed(parts))


class FnFacts:
    """Fatos observáveis do corpo de uma função."""

    def __init__(self) -> None:
        self.db_ops = 0
        self.has_await = False
        self.external: set[str] = set()
        self.cpu = False
        self.calls: set[str] = set()
        self.loops_with_db = False
        self.via_service = False

    def merge(self, other: "FnFacts") -> None:
        self.db_ops += other.db_ops
        self.external |= other.external
        self.cpu = self.cpu or other.cpu
        self.loops_with_db = self.loops_with_db or other.loops_with_db
        self.via_service = self.via_service or other.via_service


def analyze_fn(fn: ast.AST) -> FnFacts:
    f = FnFacts()
    for node in ast.walk(fn):
        if isinstance(node, (ast.Await, ast.AsyncWith, ast.AsyncFor)):
            f.has_await = True
        if isinstance(node, ast.Call):
            nm = _name_of(node.func)
            dotted = _full_dotted(node.func).lower()
            # Receptor de sessão: db.*, session.*, self.db.*, self.session.*, algo.db.*
            if nm in DB_CALLS and (
                dotted.startswith(("db.", "session.", "self.db.", "self.session."))
                or ".db." in dotted
                or ".session." in dotted
            ):
                f.db_ops += 1
            # Instanciação de Service/Repository recebendo a sessão -> toca banco.
            # Sem isso, rotas que delegam 100% para um service (ex.: /inbox/*)
            # eram classificadas como "sem banco" (falso-negativo comprovado).
            if nm.endswith(("Service", "Repository", "Repo")) and any(
                isinstance(a, ast.Name) and a.id in {"db", "session"} for a in node.args
            ):
                f.db_ops += 1
                f.via_service = True
            if nm:
                f.calls.add(nm)
            for hint, label in EXTERNAL_HINTS.items():
                if hint in dotted:
                    f.external.add(label)
            for hint in CPU_HINTS:
                if hint in dotted:
                    f.cpu = True
        # query dentro de laço => risco de N+1
        if isinstance(node, (ast.For, ast.While)):
            for sub in ast.walk(node):
                if isinstance(sub, ast.Call):
                    d = _full_dotted(sub.func).lower()
                    if _name_of(sub.func) in DB_CALLS and d.startswith(("db.", "session.")):
                        f.loops_with_db = True
    return f


def collect_all_functions() -> dict[str, tuple[ast.AST, pathlib.Path]]:
    """Todas as funções definidas em app/ — base para o call graph."""
    out: dict[str, tuple[ast.AST, pathlib.Path]] = {}
    for path in APP.rglob("*.py"):
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except SyntaxError:
            continue
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                out.setdefault(node.name, (node, path))
    return out


def resolve_deps(fn: ast.AST) -> list[str]:
    """Dependencies FastAPI declaradas na assinatura."""
    deps: list[str] = []
    args = getattr(fn, "args", None)
    if args is None:
        return deps
    for a in list(args.args) + list(args.kwonlyargs):
        ann = a.annotation
        if ann is None:
            continue
        txt = ast.unparse(ann) if hasattr(ast, "unparse") else ""
        if "CurrentUser" in txt:
            deps.append("CurrentUser")
        elif "DBSession" in txt:
            deps.append("DBSession")
        elif "Depends" in txt:
            deps.append(txt)
    for d in args.defaults + [x for x in args.kw_defaults if x]:
        if isinstance(d, ast.Call) and _name_of(d.func) == "Depends":
            inner = d.args[0] if d.args else None
            if inner is not None:
                deps.append(f"Depends({_full_dotted(inner) or _name_of(inner)})")
    return deps


def router_prefix(tree: ast.AST) -> str:
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Call):
            if _name_of(node.value.func) == "APIRouter":
                for kw in node.value.keywords:
                    if kw.arg == "prefix" and isinstance(kw.value, ast.Constant):
                        return str(kw.value.value)
    return ""


def main() -> None:
    allfns = collect_all_functions()
    routes: list[dict[str, Any]] = []

    for path in sorted((APP / "api").rglob("*.py")):
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except SyntaxError:
            continue
        prefix = router_prefix(tree)

        for node in ast.walk(tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for dec in node.decorator_list:
                if not isinstance(dec, ast.Call):
                    continue
                verb = _name_of(dec.func)
                if verb not in {"get", "post", "put", "patch", "delete"}:
                    continue
                sub = dec.args[0].value if dec.args and isinstance(dec.args[0], ast.Constant) else ""

                facts = analyze_fn(node)
                # --- call graph: 2 niveis de profundidade dentro de app/ ---
                visited: set[str] = {node.name}
                frontier = set(facts.calls)
                chain: list[str] = []
                for _ in range(2):
                    nxt: set[str] = set()
                    for cname in frontier:
                        if cname in visited or cname not in allfns:
                            continue
                        visited.add(cname)
                        cnode, cpath = allfns[cname]
                        if cpath.match("*/api/*"):
                            pass
                        sub_facts = analyze_fn(cnode)
                        facts.merge(sub_facts)
                        chain.append(cname)
                        nxt |= sub_facts.calls
                    frontier = nxt

                touches_db = facts.db_ops > 0
                is_async = isinstance(node, ast.AsyncFunctionDef)

                # ---- classificação (A/B/C/D) ----
                if facts.external:
                    cat = "C"  # integração externa síncrona
                elif touches_db and facts.db_ops >= 4:
                    cat = "A"  # DB-bound pesada
                elif touches_db:
                    cat = "B"  # DB-bound leve
                elif facts.cpu:
                    cat = "A"  # CPU-bound
                else:
                    cat = "D"  # estática / sem trabalho relevante

                if is_async and not facts.has_await and (touches_db or facts.external or facts.cpu):
                    rec = "CONVERTER para def"
                elif is_async and facts.has_await:
                    rec = "manter async (tem await)"
                elif is_async:
                    rec = "def opcional (sem trabalho bloqueante)"
                else:
                    rec = "ja e def"

                routes.append({
                    "method": verb.upper(),
                    "path": (prefix + sub) or "/",
                    "file": str(path.relative_to(APP.parent.parent)).replace("\\", "/"),
                    "fn": node.name,
                    "kind": "async def" if is_async else "def",
                    "has_await": facts.has_await,
                    "deps": resolve_deps(node),
                    "touches_db": touches_db,
                    "db_ops_static": facts.db_ops,
                    "n_plus_1_risk": facts.loops_with_db,
                    "external": sorted(facts.external),
                    "cpu_bound": facts.cpu,
                    "call_chain": chain[:8],
                    "category": cat,
                    "recommendation": rec,
                })

    routes.sort(key=lambda r: (r["category"], -r["db_ops_static"], r["path"]))
    print(json.dumps(routes, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
