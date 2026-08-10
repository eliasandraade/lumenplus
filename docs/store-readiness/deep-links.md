# Deep links — estado e o que falta

## O que já funciona

`app.json` declara `expo.scheme = "lumenplus"`. Isso habilita deep links por
esquema personalizado — `lumenplus://evento/123` — que o `expo-router` roteia
automaticamente, sem handler explícito no código.

Testável sem domínio nenhum:

```bash
adb shell am start -a android.intent.action.VIEW -d "lumenplus://perfil" com.lumenchristi.lumenplus
```

**Limite honesto:** esquema personalizado é suficiente para navegação interna e
para links vindos de notificações do próprio app. **Não** é suficiente para um
link `https://` clicado no WhatsApp ou no e-mail abrir o app — isso exige App
Links (Android) e Universal Links (iOS), ambos com verificação de domínio.

## O que falta — e por quê não dá para fazer sem humano

Android App Links e iOS Universal Links exigem, os dois, publicar um arquivo de
verificação **no domínio**, servido por HTTPS:

| Plataforma | Arquivo | Caminho exigido |
|---|---|---|
| Android | `assetlinks.json` | `https://<dominio>/.well-known/assetlinks.json` |
| iOS | `apple-app-site-association` | `https://<dominio>/.well-known/apple-app-site-association` |

Faltam duas coisas, nenhuma delas de engenharia:

1. **O domínio de produção.**
2. **A impressão digital SHA-256 do certificado de assinatura** — a
   institucional. Se for Play App Signing, a impressão é a que o Google exibe
   na Play Console, **não** a da chave de upload.

> A impressão do keystore descartável usado nos testes **não foi registrada em
> lugar nenhum, de propósito**. Publicar uma impressão de chave descartável
> num `assetlinks.json` faria o Android verificar contra uma chave que não
> existe mais, e os links parariam de abrir o app — falha silenciosa e
> difícil de diagnosticar.

## Modelo para preencher

Trocar `EXEMPLO_DOMINIO` e `EXEMPLO_SHA256` pelos valores reais:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.lumenchristi.lumenplus",
    "sha256_cert_fingerprints": ["EXEMPLO_SHA256"]
  }
}]
```

```json
{
  "applinks": {
    "apps": [],
    "details": [{
      "appID": "TEAMID.com.lumenchristi.lumenplus",
      "paths": ["/evento/*", "/perfil/*", "/comunidade/*", "/excluir-conta"]
    }]
  }
}
```

`TEAMID` é o Team ID de 10 caracteres do Apple Developer Program.

## Depois que o domínio existir

Adicionar em `app.json`:

```jsonc
"ios":     { "associatedDomains": ["applinks:<dominio>"] },
"android": { "intentFilters": [{
  "action": "VIEW", "autoVerify": true,
  "data": [{ "scheme": "https", "host": "<dominio>" }],
  "category": ["BROWSABLE", "DEFAULT"]
}]}
```

Depois, verificar de verdade — configurar não é o mesmo que funcionar:

```bash
adb shell pm verify-app-links --re-verify com.lumenchristi.lumenplus
adb shell pm get-app-links com.lumenchristi.lumenplus
```

O estado precisa aparecer como `verified`. Enquanto estiver `legacy_failure`
ou `verification_failure`, o link abre o navegador, não o app.

## Classificação

**BLOQUEADO POR HUMANO** — depende do domínio de produção e da impressão
digital da chave institucional. O esquema personalizado, que é a parte que não
depende de nada externo, já está no app e é testável hoje.
