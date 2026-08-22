# VenusP Planning Report — App Desktop (código protegido)

Esta pasta contém o **app desktop nativo** do VenusP. Em vez de entregar um `.html` que qualquer pessoa pode abrir e copiar, o app roda dentro de um **executável** com os recursos empacotados em `resources.neu` (não é um arquivo HTML solto).

## O que muda em relação ao HTML

| Entrega HTML | App Desktop (Neutralino) |
|---|---|
| Arquivo `.html` visível | Executável + `resources.neu` empacotado |
| "Ver código-fonte" no navegador | DevTools desativado (`enableInspector: false`) |
| Fácil de copiar a lógica | JavaScript ofuscado no build de produção |
| Abre no Chrome/Edge | Janela própria, offline, sem barra de URL |

> **Nota honesta:** nenhum app que roda no computador do usuário é 100% à prova de engenharia reversa. O desktop **dificulta muito** o uso casual do seu código, mas um especialista ainda poderia extrair recursos com esforço. Para proteção forte, combine com licença/contrato.

## Build (desenvolvedor)

Requisitos: Node.js 18+

```bash
cd venusp-desktop
npm install
npm run build:protected    # ofusca JS + copia para VenusP-Desktop/resources/
npm run build:desktop      # gera executável na pasta dist/
```

### Windows
Execute no **Windows** (ou CI Windows):
```bash
cd VenusP-Desktop
npx neu build --release
```
Saída: `dist/VenusP-Planning/venusp-planning-win_x64.exe` + `resources.neu`

### macOS (M1/M2/M3 ou Intel)
Execute no **Mac**:
```bash
cd VenusP-Desktop
npx neu build --release
```
Saída: `dist/VenusP-Planning/venusp-planning-mac_arm64` (ou `_x64` no Intel) + `resources.neu`

### Linux
```bash
cd VenusP-Desktop
npx neu build --release
```

Distribua a **pasta inteira** `dist/VenusP-Planning/` (executável + `resources.neu` + `.neu` dependencies).

## Uso pelo médico/usuário final

- **Windows:** dois cliques em `venusp-planning-win_x64.exe`
- **Mac:** dois cliques no binário (pode precisar botão direito → Abrir na 1ª vez)
- **Senha:** `venus2026`
- **Export PDF:** funciona offline, mesmo proforma de 6 páginas do Dr. Phuoc

## Estrutura

```
VenusP-Desktop/
  neutralino.config.json   # config da janela (título, tamanho, sem inspector)
  resources/
    index.html             # app (gerado pelo build protegido)
    icons/appIcon.png
  bin/                     # binários Neutralino por plataforma
```
