"""
Cria usuários SINTÉTICOS e emite tokens para a suíte de carga.

REGRAS DE SEGURANÇA APLICADAS AQUI:
- Recusa qualquer alvo que case com padrão de produção (mesma trava do config.js).
- Nenhum dado real. E-mails usam o TLD reservado `.invalid` (RFC 2606), que não
  é roteável — impossível enviar e-mail de verdade para eles por acidente.
- `--cleanup` remove os usuários sintéticos ao final (DELETE /auth/me, que o
  backend trata como anonimização).

LIMITAÇÃO IMPORTANTE (leia antes de usar em staging):
Este script só consegue emitir tokens sozinho quando o alvo roda `AUTH_MODE=DEV`
(formato `dev:<uid>:<email>`). Se o staging rodar com Firebase real, os tokens
precisam vir do Firebase — use `--tokens-file` com tokens já obtidos. Não há
como contornar isso sem credencial, e isso é um blocker humano legítimo.

Uso:
    python seed_synthetic_users.py --base-url https://backend-staging.up.railway.app --count 50
    python seed_synthetic_users.py --base-url ... --count 50 --cleanup
"""

from __future__ import annotations

import argparse
import re
import sys
import urllib.error
import urllib.request

PRODUCTION_PATTERNS = [
    r"backend-production",
    r"lumenplus\.vercel\.app",
    r"(^|\.)lumenplus\.app",
    r"lumenserfeliz\.org",
]

EMAIL_DOMAIN = "synthetic.invalid"  # TLD reservado: não roteável


def assert_not_production(url: str, override: bool) -> None:
    for pat in PRODUCTION_PATTERNS:
        if re.search(pat, url, re.I):
            if not override:
                sys.exit(
                    f"RECUSADO: '{url}' casa com padrao de PRODUCAO ({pat}).\n"
                    "Esta suite nao roda contra producao. Use o backend de staging."
                )
            print(f"AVISO GRAVE: alvo de producao '{url}' por override explicito.", file=sys.stderr)


def call(url: str, token: str, method: str = "GET") -> int:
    req = urllib.request.Request(url, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--base-url", required=True)
    p.add_argument("--count", type=int, default=50)
    p.add_argument("--prefix", default="loadtest")
    p.add_argument("--cleanup", action="store_true", help="anonimiza os usuarios sinteticos")
    p.add_argument("--tokens-file", default="", help="usa tokens ja obtidos (staging com Firebase)")
    p.add_argument("--i-understand-this-hits-production", action="store_true")
    a = p.parse_args()

    base = a.base_url.rstrip("/")
    assert_not_production(base, a.i_understand_this_hits_production)

    if a.tokens_file:
        tokens = [t.strip() for t in open(a.tokens_file, encoding="utf-8") if t.strip()]
        print(f"# {len(tokens)} tokens lidos de {a.tokens_file}", file=sys.stderr)
    else:
        tokens = [f"dev:{a.prefix}-{i}:{a.prefix}-{i}@{EMAIL_DOMAIN}" for i in range(a.count)]

    if a.cleanup:
        removed = sum(1 for t in tokens if call(f"{base}/auth/me", t, "DELETE") in (200, 204))
        print(f"# cleanup: {removed}/{len(tokens)} usuarios sinteticos anonimizados", file=sys.stderr)
        return

    ok = 0
    for t in tokens:
        code = call(f"{base}/auth/me", t)
        if code == 200:
            ok += 1
        elif code == 401:
            sys.exit(
                "FALHA: /auth/me devolveu 401 para token DEV.\n"
                "O alvo provavelmente NAO roda AUTH_MODE=DEV (usa Firebase real).\n"
                "Obtenha tokens validos do Firebase e passe via --tokens-file.\n"
                "BLOCKER HUMANO: requer credencial que este processo nao possui."
            )

    print(f"# {ok}/{len(tokens)} usuarios sinteticos provisionados", file=sys.stderr)
    print("TOKENS=" + ",".join(tokens))


if __name__ == "__main__":
    main()
