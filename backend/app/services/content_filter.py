"""
Filtro de conteúdo censurável (pré-publicação)
==============================================
Apple App Store Review Guideline 1.2 exige, para apps com UGC, **quatro**
salvaguardas. As outras três já existem (denúncia, bloqueio, moderação); esta é
a primeira: *"A method for filtering objectionable material from being posted
to the app"*.

Escopo deliberadamente CONSERVADOR: bloqueia o que é inequivocamente abusivo e
sinaliza o duvidoso para a fila de moderação humana. Um filtro agressivo num app
de comunidade religiosa produziria falsos positivos em conversas legítimas sobre
sofrimento, morte, vício ou conflito — assuntos naturais de acompanhamento
pastoral.

Decisões:
- BLOQUEIA apenas termos de ódio/sexual explícito inequívocos.
- SINALIZA (publica, mas cria denúncia automática) casos limítrofes.
- Nunca "corrige" nem reescreve o texto do usuário.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from enum import Enum


class FilterVerdict(Enum):
    ALLOW = "ALLOW"      # publica normalmente
    FLAG = "FLAG"        # publica, mas entra na fila de moderação
    BLOCK = "BLOCK"      # não publica


@dataclass(frozen=True)
class FilterResult:
    verdict: FilterVerdict
    reason: str | None = None
    matched_rule: str | None = None


# ---------------------------------------------------------------------------
# Listas
# ---------------------------------------------------------------------------
# BLOQUEIO: termos inequivocamente abusivos. Mantidos como radicais para pegar
# variações de flexão. Escritos aqui de forma técnica — é uma lista de bloqueio,
# não conteúdo do produto.
_BLOCK_PATTERNS = [
    # Ódio / desumanização por grupo protegido
    r"\bmorte\s+aos?\s+(judeus|negros|gays|mu[cç]ulmanos|nordestinos)\b",
    r"\b(judeus|negros|gays|mu[cç]ulmanos)\s+(devem?\s+)?morrer\b",
    # Ameaça direta
    r"\bvou\s+te\s+(matar|estuprar)\b",
    r"\bte\s+mato\b",
    # Sexual explícito com menor — bloqueio absoluto
    r"\b(crian[cç]a|menor)\b.{0,20}\b(nu[ad]?|pelad[ao]|sexo)\b",
]

# SINALIZAÇÃO: indícios que merecem olhar humano, sem impedir a publicação.
_FLAG_PATTERNS = [
    r"\b(idiota|imbecil|burro|est[uú]pid[ao])\b",          # ofensa pessoal leve
    r"\bgolpe\b.{0,30}\b(pix|dinheiro|transfer[eê]ncia)\b",  # possível fraude
    r"(https?://)?\b\w+\.(top|xyz|click|loan)\b",            # TLDs típicos de spam
    r"\b(compre|promo[cç][aã]o|desconto)\b.{0,30}\bwhatsapp\b",  # propaganda
]

# Variante COLAPSADA: o mesmo conjunto de bloqueio, sem espacos nem limites de
# palavra. Serve para pegar evasao por pontuacao ("v.o.u t.e m.a.t.a.r"), que a
# normalizacao por si so nao resolve.
_BLOCK_COLLAPSED = [
    r"morteaos?(judeus|negros|gays|mu[cs]ulmanos|nordestinos)",
    r"(judeus|negros|gays|mu[cs]ulmanos)devemmorrer",
    r"vout[e]?(matar|estuprar)",
    r"tematoz?",
    r"(crianca|menor).{0,12}(nu[ad]?|pelad[ao]|sexo)",
]

_BLOCK_RE = [re.compile(p, re.IGNORECASE) for p in _BLOCK_PATTERNS]
_BLOCK_COLLAPSED_RE = [re.compile(p, re.IGNORECASE) for p in _BLOCK_COLLAPSED]
_FLAG_RE = [re.compile(p, re.IGNORECASE) for p in _FLAG_PATTERNS]

# Excesso de caixa alta / repetição — sinal de spam, não de abuso.
_SHOUT_MIN_LEN = 40
_SHOUT_RATIO = 0.7
_REPEAT_RE = re.compile(r"(.)\1{9,}")            # 10+ do mesmo caractere
_LINK_RE = re.compile(r"https?://", re.IGNORECASE)
_MAX_LINKS = 5


def _normalize(text: str) -> str:
    """
    Normaliza para dificultar evasão trivial: remove acentuação e colapsa
    separadores usados para "furar" filtro (m.a.t.a.r, m a t a r).
    """
    nfkd = unicodedata.normalize("NFKD", text)
    no_accent = "".join(c for c in nfkd if not unicodedata.combining(c))
    # colapsa pontuação/espaço entre letras isoladas
    collapsed = re.sub(r"(?<=\b\w)[\s.\-_*]+(?=\w\b)", "", no_accent)
    return collapsed


def check_content(text: str) -> FilterResult:
    """
    Avalia um texto antes de publicar.

    Não levanta exceção e não modifica o texto — devolve só o veredito, para
    que o chamador decida (rejeitar com 422 ou publicar e abrir denúncia).
    """
    if not text or not text.strip():
        return FilterResult(FilterVerdict.ALLOW)

    normalized = _normalize(text)
    # tudo que nao for letra/numero removido — desmonta evasao por pontuacao
    collapsed = re.sub(r"[^a-zA-Z0-9]", "", normalized).lower()

    for rx in _BLOCK_COLLAPSED_RE:
        if rx.search(collapsed):
            return FilterResult(
                FilterVerdict.BLOCK,
                reason="Conteúdo viola a política da comunidade.",
                matched_rule=f"collapsed:{rx.pattern}",
            )

    for rx in _BLOCK_RE:
        if rx.search(normalized):
            return FilterResult(
                FilterVerdict.BLOCK,
                reason="Conteúdo viola a política da comunidade.",
                matched_rule=rx.pattern,
            )

    for rx in _FLAG_RE:
        if rx.search(normalized):
            return FilterResult(
                FilterVerdict.FLAG,
                reason="Conteúdo sinalizado para revisão.",
                matched_rule=rx.pattern,
            )

    stripped = text.strip()
    if len(stripped) >= _SHOUT_MIN_LEN:
        letters = [c for c in stripped if c.isalpha()]
        if letters and sum(1 for c in letters if c.isupper()) / len(letters) >= _SHOUT_RATIO:
            return FilterResult(
                FilterVerdict.FLAG,
                reason="Texto quase todo em maiúsculas.",
                matched_rule="shouting",
            )

    if _REPEAT_RE.search(stripped):
        return FilterResult(
            FilterVerdict.FLAG, reason="Repetição excessiva de caracteres.",
            matched_rule="repeat",
        )

    if len(_LINK_RE.findall(stripped)) > _MAX_LINKS:
        return FilterResult(
            FilterVerdict.FLAG, reason="Muitos links.", matched_rule="links",
        )

    return FilterResult(FilterVerdict.ALLOW)
