# Design — Compilador `html2elementor`

**Data:** 2026-06-26
**Status:** aprovado (design); aguardando revisão do spec

## Objetivo e princípio

Permitir construir as páginas em HTML/CSS/JS (rápido, via IA no Claude Code) e
publicá-las no **Elementor Pro** com **widgets nativos editáveis**, mantendo o
layout o mais fiel possível ao HTML aprovado.

- **Prioridade:** fidelidade visual ao HTML original, em desktop **e** mobile.
- **Requisito aceito:** saída em **widgets nativos** (alguém vai editar no editor
  visual do Elementor).
- **Não-objetivo (limite assumido):** pixel-perfect 100%. A rota nativa atinge
  ~95-98% por construção (o Elementor embrulha tudo no DOM/CSS dele). O loop de
  diff visual existe para minimizar o desvio, não para prometer identidade total.
  - Se algum dia a prioridade virar "100% idêntico", a rota é outra (bloco HTML),
    fora do escopo deste design.

## Escopo

- Páginas: **vendas-rc-v3** (sem VSL) e a **variante VSL** (vendas-rc-v3-vsl).
- Fora de escopo: generalizar para todas as páginas do site (pode vir depois).

## Fonte da verdade e fluxo

- **Fonte:** [public/vendas-rc-v3.html](../../../public/vendas-rc-v3.html) +
  [public/css/styles.css](../../../public/css/styles.css) (+ variante VSL).
- **Fluxo:** editar HTML/CSS → rodar o compilador → importar o JSON no Elementor
  (Modelos → Importar Modelos) → conferir com o diff visual.
- O molde Python atual [scripts/build_elementor.py](../../../scripts/build_elementor.py)
  é **aposentado** quando o compilador empatar na fidelidade. Seu conhecimento
  (mapa de imagens, padrões de CSS por elemento) migra para o compilador.

## Arquitetura (módulos pequenos e isolados)

```
scripts/html2elementor/
  __init__.py
  cssmap.py    # parseia CSS, resolve var(--token), separa @media, mapeia declaração→controle Elementor
  registry.py  # classe/tag → tipo de widget; casos especiais; mapa de imagens
  widgets.py   # construtores de widget e container (heading/text/button/image/carousel/accordion/icon-list)
  compile.py   # percorre o DOM, monta a árvore de containers, emite JSON + CLI
scripts/validate_elementor.py  # checagem estrutural pós-build
```

Responsabilidade de cada módulo:
- **cssmap** — entrada: caminho do CSS. Saída: (a) `seletor → declarações` com
  `:root` resolvido; (b) balde `@media(max-width:768px)`; (c) função
  `to_controls(declarações)` que separa o que vira controle nativo do que sobra
  para CSS por elemento. Não conhece HTML nem Elementor-JSON além dos nomes de
  controle.
- **registry** — tabelas puras: `tag/classe → widget`, lista de padrões de caso
  especial (nº 10, gradiente, badge, sticky) e o mapa de imagens (8 URLs reais +
  3 base64). Sem lógica de parsing.
- **widgets** — funções que produzem dicts de widget/container do Elementor
  (formato container/flexbox). Recebem conteúdo + settings já resolvidos.
- **compile** — orquestra: usa cssmap + registry + widgets para transformar o DOM
  em árvore Elementor e serializar. Único módulo que conhece todos os outros.

## Pipeline

1. **CSS** (`cssmap`): parse → `seletor → declarações`; resolve `:root`
   (`--ouro`→`#C9A84C`, etc.); separa o bloco `@media(max-width:768px)`.
2. **HTML** (`compile`): DOM via BeautifulSoup; processa `<body>`.
3. **Percorre o DOM:** cada `<div class>` de seção → container full-bleed com
   conteúdo boxed (1160). Layouts (`.hero`, `.identificacao`, `.reframe`,
   `.historia`, `.para-quem`, `.dias-grid`, `.mecanismo-grid`, `.bonus-grid`,
   `.modulos-grid`) → containers em linha/grid. Folhas → widgets via `registry`.
4. **Estilo (modo inteligente)** por elemento:
   - **Controles nativos:** cor, font-family/size/weight/line-height/
     letter-spacing/text-transform, padding, margin, background sólido,
     text-align, border, width.
   - **CSS por elemento (`custom_css`, usa `selector`):** gradientes, `position`
     absoluta, `transform`, `opacity`, `::before`/`::after`, `aspect-ratio`,
     `object-fit`, valores `clamp()`, e regras `@media` não mapeáveis.
5. **Responsivo:** props mapeáveis do `@media(768px)` → controles responsivos
   mobile do Elementor (ex.: `typography_font_size_mobile`, `_padding_mobile`);
   o resto → `@media` dentro do `custom_css`. Breakpoint mobile do Elementor
   ajustado para **768px** (casar com o CSS).
6. **Imagens** (`registry`): resolve `src` do HTML pelo mapa — 8 screenshots em
   URLs reais (`/uploads/2026/05/`, .png/.jpg) + 3 do hero/logo/história em
   base64 (webp local leve).
7. **Emissão:** árvore de containers + `page_settings` + `version:"0.4"` +
   `type:"page"` → `elementor/<pagina>.container.json`.

## Casos especiais (registro fixo, só destas páginas)

Reconhecidos por classe e injetados com posição/CSS conhecidos:
- `.barra-topo` → efeito **Sticky no topo** (desktop/tablet/mobile).
- `.hero-num` → bloco "Desafio / 10 / Dias" em **posição absoluta** sobre a foto.
- `.hero-foto-overlay` / `.historia-foto-container::after` → **máscara de
  gradiente** via `::after`.
- `.historia-badge` → **badge preto** absoluto.

## Tratamento de erros

- **Nada some calado** (foi o bug original — grids descartados sem aviso):
  elemento/classe não reconhecida vira `text-editor`/`html` preservando o
  conteúdo e entra num **relatório de "não mapeados"** impresso ao fim, para
  estender o `registry`.
- Imagem sem entrada no mapa → aviso + mantém o `src` original.

## Verificação de fidelidade

1. **Estrutural** (`validate_elementor.py`, sempre): 0 containers vazios, IDs
   únicos, todas as imagens resolvidas, 22 seções, JSON válido.
2. **Diff visual** (browser/screenshot MCP — Chrome DevTools ou Playwright):
   - Referência: serve `public/` local; print do HTML em **desktop (~1280px)** e
     **mobile (~390px)**.
   - Saída: após importar numa **página de rascunho** no WP, print da página
     Elementor em desktop e mobile.
   - Compara os pares e aponta regiões divergentes → lista de ajustes no
     compilador.

**Pré-requisitos do diff (não bloqueiam o compilador):**
- Instalar o browser MCP no Claude Code.
- URL de rascunho no WP (página privada em nathmonari.com.br) para renderizar o
  lado Elementor.

> Limite honesto: o JSON do Elementor só renderiza dentro do WP+Elementor — o
> print "de verdade" do lado Elementor depende da página de rascunho. Antes do
> import, só dá para fixar o print de referência do HTML.

## Dependências

- `beautifulsoup4` (parse HTML) e `tinycss2` (parse CSS) — via `pip`.
  Justificativa: parser robusto > regex frágil. Adiciona um `requirements.txt`
  em `scripts/` (o projeto já usa Python para dev/local).

## Critérios de sucesso

- Rodar o compilador em vendas-rc-v3 produz JSON que importa no Elementor sem
  erro, com as 22 seções e todas as imagens visíveis.
- Diff visual desktop e mobile dentro de ~95-98% (sem quebras de layout: hero
  empilha no mobile, grids viram 1-2 colunas).
- Editar um texto/cor no HTML e regenerar reflete a mudança no JSON.
- A variante VSL compila pelo mesmo caminho.
