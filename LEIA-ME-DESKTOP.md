# VenusP Planning Report — App Desktop (código protegido)

Esta versão **não entrega um arquivo HTML** que qualquer pessoa pode abrir e copiar.

O app roda como **programa nativo** (executável + `resources.neu`), com:
- JavaScript da lógica **ofuscado** no build
- **DevTools desativado** (sem "inspecionar elemento" fácil)
- Recursos empacotados (não há `venusp-planning-report.html` solto na pasta)

## Windows

1. Descompacte `VenusP-Desktop-Windows.zip`
2. Dois cliques em **`VenusP-Planning-win_x64.exe`**
3. Senha: `venus2026`

> Mantenha `resources.neu` na **mesma pasta** do `.exe`.

## Mac (Apple Silicon M1 / M2 / M3)

1. Descompacte `VenusP-Desktop-Mac-AppleSilicon.zip`
2. Dois cliques em **`Abrir-VenusP-Mac.command`**
   - Na 1ª vez: botão direito → **Abrir** → **Abrir** (Gatekeeper)
3. Senha: `venus2026`

> Alternativa: no Terminal, `chmod +x VenusP-Planning-mac_arm64` e executar `./VenusP-Planning-mac_arm64`

## Mac (Intel)

Use `VenusP-Desktop-Mac-Intel.zip` e o binário `VenusP-Planning-mac_x64`.

## Export PDF

Funciona **offline**, mesmo proforma de 6 páginas (Dr. Phuoc).

## Proteção do código

Dificulta muito cópia casual do seu sizing engine, mas **nenhum app local é 100% inviolável**. Para uso corporativo, combine com contrato/licença.
