# Comandos de carga — Sprint 7. Um alvo por fase do ramp.
#
# Cada alvo: confirma ambiente, BLOQUEIA produção (via config.js), registra
# commit/config/timestamp, salva JSON, e respeita os abort criteria (thresholds
# do k6 com abortOnFail em >2% de erro).
#
# Pré-requisitos (env):
#   BASE_URL  -> backend de STAGING (nunca produção; config.js recusa)
#   TOKENS    -> saída de seed_synthetic_users.py
#
# Uso:
#   export BASE_URL=https://backend-staging.up.railway.app TOKENS=...
#   make load-smoke      # valida a suíte contra o alvo, carga mínima
#   make load-25         # e assim por diante, PROGRESSIVAMENTE
#   make ramp            # ramp completo 10->250 com sustentação e recuperação

OUT := out
COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo nogit)
# timestamp vem do shell no momento da execução (não versionado)
STAMP = $(shell date -u +%Y%m%dT%H%M%SZ)
K6 := k6

# guarda comum: exige BASE_URL e TOKENS, cria OUT
define _guard
	@test -n "$(BASE_URL)" || { echo "ERRO: defina BASE_URL (staging)"; exit 1; }
	@test -n "$(TOKENS)" || { echo "ERRO: defina TOKENS (rode seed_synthetic_users.py)"; exit 1; }
	@case "$(BASE_URL)" in *backend-production*|*lumenplus.vercel.app*|*lumenplus.app*|*lumenserfeliz.org*) \
		echo "RECUSADO: BASE_URL parece produção."; exit 1;; esac
	@mkdir -p $(OUT)
	@echo "# alvo=$(BASE_URL) commit=$(COMMIT) stamp=$(STAMP)"
endef

# executa um perfil/carga e salva o summary com metadados no nome
# $(1)=nome  $(2)=flags extras do k6
define _run
	$(_guard)
	$(K6) run \
	  -e BASE_URL=$(BASE_URL) -e TOKENS=$(TOKENS) -e ENV_NAME=staging \
	  $(2) \
	  --summary-export=$(OUT)/$(1)_$(COMMIT)_$(STAMP).json \
	  main.js
	@echo "-> $(OUT)/$(1)_$(COMMIT)_$(STAMP).json"
endef

.PHONY: help load-smoke load-25 load-50 load-100 load-150 load-200 load-250 load-burst-300 ramp report clean

help:
	@echo "Alvos: load-smoke load-25 load-50 load-100 load-150 load-200 load-250 load-burst-300 ramp report"
	@echo "Cada nivel so deve iniciar se o anterior cumpriu os gates (erro<2%, sem pool timeout, memoria estavel)."

load-smoke:      ## Perfil A, carga mínima (fumaça)
	$(call _run,smoke,-e PROFILE=A -e VUS=5 -e DURATION=30s)

load-25:
	$(call _run,c25,-e PROFILE=A -e VUS=25 -e DURATION=2m)

load-50:
	$(call _run,c50,-e PROFILE=A -e VUS=50 -e DURATION=2m)

load-100:
	$(call _run,c100,-e PROFILE=B -e VUS=100 -e DURATION=3m)

load-150:
	$(call _run,c150,-e PROFILE=B -e VUS=150 -e DURATION=3m)

load-200:
	$(call _run,c200,-e PROFILE=B -e VUS=200 -e DURATION=5m)

load-250:
	$(call _run,c250,-e PROFILE=B -e VUS=250 -e DURATION=5m)

load-burst-300:  ## rajada pós-Push — só se 250 estiver saudável
	$(call _run,burst300,-e PROFILE=C -e VUS=300 -e DURATION=1m)

ramp:            ## ramp de certificação 10->250 com sustentação e recuperação
	$(call _run,ramp,-e PROFILE=A -e RAMP=1)

report:          ## gera resumo Markdown a partir dos JSON em out/
	@python gen_load_report.py $(OUT) || echo "coloque os JSON em $(OUT)/ e rode de novo"

clean:
	@rm -rf $(OUT)
