# =============================================================================
# Lumen+ Web — imagem estatica
# =============================================================================
# SEM Node no runtime: o `expo export --platform web` ja produziu arquivos
# estaticos, entao a imagem final e nginx + os arquivos. Menos superficie, menos
# atualizacao de seguranca a acompanhar, e ~50 MB em vez de ~1 GB.
#
# O CONTEXTO DE BUILD PRECISA CONTER `dist/` JA CONSTRUIDO.
# Nao construimos aqui de proposito: a build usada e a que foi verificada
# (nenhuma referencia ao backend da Railway, URL da API nova presente, nenhum
# secret de backend embutido). Reconstruir dentro do Dockerfile produziria um
# artefato DIFERENTE do que foi validado — exatamente o que nao se quer num
# cutover.
#
# Como gerar o dist/ (a partir de lumen_mobile/):
#   EXPO_PUBLIC_API_URL=https://api.lumenplus.andradesystems.com.br \
#   EXPO_PUBLIC_ENV=production npm run build

FROM nginx:1.27-alpine

# Config propria substitui a default: SPA fallback, cache por tipo de arquivo
# e cabecalhos de seguranca.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/lumenplus.conf
# Incluido por cada bloco `location` que precisa dos cabecalhos: no nginx,
# `add_header` num location descarta os herdados do server, sem merge.
COPY seguranca.conf /etc/nginx/seguranca.conf

COPY dist/ /usr/share/nginx/html/

# A imagem oficial ja roda o master como root e os workers como `nginx`, que e
# o necessario para escutar na 80. Nao ha estado gravado em disco.
EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/nginx-health || exit 1
