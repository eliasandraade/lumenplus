# Observabilidade — dashboards e alertas versionados

Artefatos de observabilidade do backend Lumen+, versionados para importação.
Não substituem o provedor — são a **configuração** a importar nele.

## O que já existe no código
- `GET /metrics` (formato Prometheus) — ver `docs/engineering/observability-resilience.md`.
- Logs estruturados (`structlog`) com `request_id`.
- Sentry (erros + traces).
- `GET /health/live` e `GET /health/ready`.

## Arquivos
| Arquivo | O que é | Onde importar |
|---|---|---|
| `prometheus-alerts.yml` | regras de alerta | Prometheus / Alertmanager (`rule_files`) |
| `grafana-dashboard.json` | dashboard | Grafana → Import → colar JSON |

## Como conectar (passos exatos)

### 1. Scrape das métricas
O `/metrics` precisa ser **raspado** por um Prometheus (ou agent compatível).
Config de scrape (exemplo):

```yaml
scrape_configs:
  - job_name: lumen-backend
    metrics_path: /metrics
    scheme: https
    static_configs:
      - targets: ["backend-staging.up.railway.app"]   # nunca produção pública sem token
    # Em produção, o /metrics exige o header X-Metrics-Token:
    # authorization / headers conforme o provedor. Ver gate no main.py.
```

> **Acesso necessário (ação humana):** provisionar/So configurar um Prometheus
> (Railway add-on, Grafana Cloud, ou self-hosted) e apontar o scrape para o
> serviço. Sem esse componente, `/metrics` existe mas ninguém o coleta.

### 2. Alertas
Carregar `prometheus-alerts.yml` em `rule_files` do Prometheus e conectar um
Alertmanager (e-mail/Slack/Discord) para o roteamento.

### 3. Dashboard
Grafana → **Dashboards → Import** → colar `grafana-dashboard.json` → selecionar o
datasource Prometheus.

## Alertas incluídos (todos VALOR INICIAL — A VALIDAR NA SPRINT 7)
- erro 5xx > 2% por rota;
- p95 > 2s por rota;
- pool > 80% em uso;
- pool em overflow por 5min;
- taxa alta de 5xx (possível 503 de backpressure);
- readiness indisponível (requer blackbox_exporter em `/health/ready`);
- in-flight > 100.

## Dashboard inclui
tráfego e latência (p50/p95 por rota), taxa de erro, estado do pool
(size/checkedout/overflow), in-flight e queries por request.

## Checklist de validação (após a Sprint 7)
- [ ] scrape de `/metrics` funcionando (target UP).
- [ ] alertas disparam nos limiares reais medidos (recalibrar thresholds).
- [ ] readiness monitorado (blackbox).
- [ ] Alertmanager roteando para o canal do time.
- [ ] dashboard mostra dados reais sob carga.

> **Métricas ainda não cobertas** (follow-up, exigem instrumentação extra):
> event-loop lag, threadpool borrowed tokens, latência/erros de integrações
> externas (Firebase/SendGrid/Cloudinary/Redis). Ver observability-resilience.md.
