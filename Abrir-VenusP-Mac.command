#!/bin/bash
# ============================================================
#  VenusP Planning Report - Lancador OFFLINE para macOS
#  (compativel com Apple Silicon M1/M2/M3 e Intel)
#
#  Basta dar dois cliques neste arquivo. Ele abre o app
#  venusp-planning-report.html (que deve estar na MESMA pasta)
#  no navegador padrao. Nao precisa de internet.
#
#  1a vez: se o macOS bloquear, clique com o botao direito
#  neste arquivo > Abrir > Abrir (Gatekeeper).
# ============================================================
cd "$(dirname "$0")"
if [ -f "venusp-planning-report.html" ]; then
    open "venusp-planning-report.html"
else
    osascript -e 'display alert "VenusP Planning Report" message "Arquivo venusp-planning-report.html nao encontrado nesta pasta. Mantenha este lancador na mesma pasta do app." as critical'
fi
