"""Integridade do conteúdo da Política de Privacidade v1.4 (Encarregado atualizado)."""

from app.legal_content import PRIVACY_V1_4, PRIVACY_V1_3


def test_v1_4_tem_encarregado_e_canal_institucional():
    assert "Felipe Rocha Pinheiro Bastos" in PRIVACY_V1_4
    assert "lgpd@lumenserfeliz.org" in PRIVACY_V1_4
    assert "Versão 1.4" in PRIVACY_V1_4


def test_v1_4_remove_dpo_e_emails_anteriores():
    assert "Elias Sales de Freitas" not in PRIVACY_V1_4
    assert "oeliasandraade@gmail.com" not in PRIVACY_V1_4
    assert "privacidade@obralumen.org.br" not in PRIVACY_V1_4


def test_v1_4_preserva_estrutura_da_politica():
    assert "ENCARREGADO DE PROTEÇÃO DE DADOS (DPO)" in PRIVACY_V1_4
    assert "CONTATO" in PRIVACY_V1_4
    assert PRIVACY_V1_4 != PRIVACY_V1_3
