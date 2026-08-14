"""Rotas com status sem corpo (204/304) não podem declarar response_model.

POR QUE ESTE TESTE EXISTE
-------------------------
Três rotas `DELETE ... status_code=204` derrubaram TODO o backend no CI, com

    AssertionError: Status code 204 must not have a response body

falhando no import do conftest — ou seja, 264 testes de uma vez, sem nenhum
deles chegar a rodar.

O detalhe que tornou o bug traiçoeiro: **passava localmente**. O venv de
desenvolvimento tinha fastapi 0.128/pydantic novo, enquanto o CI instala o que
está pinado em requirements.txt (fastapi 0.109). Na versão pinada, o FastAPI
infere `response_model` a partir da anotação de retorno:

    if isinstance(response_model, DefaultPlaceholder):
        return_annotation = get_typed_return_annotation(endpoint)
        ...
        response_model = return_annotation     # `-> None` vira NoneType
    ...
    if self.response_model:                    # NoneType é truthy!
        assert is_body_allowed_for_status_code(status_code)

Passar `response_model=None` explicitamente desliga a inferência e resolve em
qualquer versão.

Este teste não depende da versão do FastAPI: inspeciona as rotas registradas e
falha se alguma combinar status sem corpo com response_model. Assim o problema
aparece como um teste vermelho, e não como o import do conftest explodindo.
"""

from fastapi.routing import APIRoute

from app.main import app

# RFC 9110: respostas com estes status não podem ter corpo.
STATUS_SEM_CORPO = {204, 205, 304}


def test_rotas_sem_corpo_nao_declaram_response_model() -> None:
    ofensoras = []

    for rota in app.routes:
        if not isinstance(rota, APIRoute):
            continue
        if rota.status_code not in STATUS_SEM_CORPO:
            continue
        if rota.response_model is not None:
            ofensoras.append(
                f"{sorted(rota.methods or [])} {rota.path} "
                f"(status={rota.status_code}, response_model={rota.response_model!r})"
            )

    assert not ofensoras, (
        "Rotas com status sem corpo declarando response_model — isto quebra o "
        "registro da rota no FastAPI pinado e derruba a suíte inteira no import:\n  "
        + "\n  ".join(ofensoras)
        + "\n\nCorreção: passe response_model=None explicitamente no decorator."
    )


def test_existe_ao_menos_uma_rota_204_coberta() -> None:
    """Guarda contra o teste virar vácuo.

    Se um refactor remover todas as rotas 204, o teste acima passaria por não
    ter o que checar — e pararia de proteger sem ninguém perceber.
    """
    rotas_204 = [
        r
        for r in app.routes
        if isinstance(r, APIRoute) and r.status_code in STATUS_SEM_CORPO
    ]
    assert rotas_204, (
        "Nenhuma rota com status sem corpo encontrada. Se isso for intencional, "
        "remova este arquivo de teste; caso contrário, o teste acima está vazio."
    )
