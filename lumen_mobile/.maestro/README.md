# Fluxos E2E (Maestro)

Cobrem os caminhos que a **App Review testa manualmente** antes de aprovar.
Não são testes de regressão genéricos: cada fluxo aqui existe porque a
ausência dele já é motivo de rejeição documentado.

| Fluxo | Gate |
|---|---|
| `01-excluir-conta.yaml` | App Store 5.1.1(v) — o revisor precisa achar e usar a exclusão |
| `02-denunciar-conteudo.yaml` | App Store 1.2 — denúncia de conteúdo censurável |
| `03-bloquear-usuario.yaml` | App Store 1.2 — bloqueio de usuário abusivo |

## Por que `testID` e não texto

Os fluxos ancoram em `testID`, não na copy dos botões. Prender o E2E ao texto
faria o teste quebrar a cada ajuste de redação — e um E2E que quebra por
motivo cosmético acaba desativado, que é o pior resultado possível.

`testID`s usados: `profile-delete-account`, `profile-blocked-users`,
`delete-account-confirm-input`, `delete-account-submit`, `post-report`,
`post-block-author`.

## Como rodar

Maestro **não é executável no Windows** (requer macOS/Linux). Rodar em WSL,
Linux ou macOS, com emulador/dispositivo conectado:

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
maestro test .maestro/
```

Contra um APK específico:

```bash
adb install -r build-artifacts/app-release.apk
maestro test .maestro/01-excluir-conta.yaml
```

## Pré-condição de dados

Os fluxos assumem um usuário **de teste** autenticado, em um ambiente **de
teste**. Nunca rodar contra produção: `01-excluir-conta.yaml` exclui a conta
de verdade.

## Estado

**Escritos, não executados.** Este ambiente é Windows e não roda Maestro; a
execução depende de runner Linux/macOS — o mesmo bloqueio do job iOS.
