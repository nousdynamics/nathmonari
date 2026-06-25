# Design System — Protocolo RC / Nath Monari

Identidade editorial-feminina: serifa de display elegante sobre fundos quentes
(off-white / preto amadeirado), com **ouro** como único acento, fios (hairlines)
finos e rótulos em caixa-alta espaçada. Sóbrio, premium, sem ruído.

Todos os tokens vivem em `:root` (`public/css/styles.css`). Use sempre o token,
nunca o valor cru.

## 1. Cor

| Token | Hex | Uso |
| --- | --- | --- |
| `--ouro` | `#C9A84C` | acento único (rótulos, fios, números, CTAs secundários) |
| `--ouro-claro` | `#E8C97A` | assinatura, realces |
| `--ouro-escuro` | `#8B6914` | rótulos sobre claro |
| `--preto` | `#1A1208` | fundo escuro / texto principal (preto amadeirado) |
| `--preto-card` | `#1F1A0D` | cards sobre fundo escuro |
| `--off-white` | `#F5F2EC` | fundo claro principal |
| `--areia` | `#E8E4DC` | fundo alternado / bordas claras |
| `--branco` | `#FFFFFF` | fundo neutro |
| `--texto-sec` | `#5C4F3A` | texto secundário sobre claro |
| `--texto-ter` | `#7A6E60` | texto terciário sobre claro |
| `--on-dark` | `#C8BFB0` | texto sobre fundo escuro |
| `--on-dark-muted` | `#8A7D6E` | texto secundário sobre escuro |
| `--on-dark-faint` | `#6A5F50` | texto fraco sobre escuro |
| `--verde-cta` | `#2ECC71` | botão de conversão (única cor "viva") |
| `--vermelho` | `#E53935` | preço "de" (riscado) |
| `--linha` | `rgba(201,168,76,.12)` | hairline ouro translúcido sobre escuro |

Regra: o **ouro é o único acento**. Verde aparece só no botão de compra.

## 2. Tipografia

Três vozes, papéis fixos:

| Família | Token | Papel |
| --- | --- | --- |
| DM Serif Display | `--font-display` | títulos, números grandes, citações em itálico |
| Libre Baskerville | `--font-sec` | rótulos/eyebrows (bold caixa-alta), headers curtos, FAQ |
| Outfit | `--font-body` | corpo, descrições, UI (pesos 200–500) |

### Escala (fluida, `clamp`)

| Token | Valor | Papel |
| --- | --- | --- |
| `--fs-hero` | `clamp(26px,2.8vw,44px)` | h1 do hero (calibrado pra caber em 720px) |
| `--fs-h2` | `clamp(28px,3vw,42px)` | título de seção |
| `--fs-h2-sm` | `clamp(26px,2.4vw,36px)` | título de seção menor |
| `--fs-h3` | `clamp(18px,1.6vw,24px)` | subtítulo |
| `--fs-h4` | `15px` | título de card |
| `--fs-eyebrow` | `12px` | rótulo / sobrescrito |
| `--fs-lead` | `clamp(17px,1.4vw,19px)` | descrição / intro |
| `--fs-body` | `17px` | corpo |
| `--fs-body-sm` | `15px` | corpo menor |
| `--fs-small` | `13px` | legendas |
| `--fs-xs` | `11px` | micro (garantias, footer, botões) |

Pesos: `--fw-extralight 200 · --fw-light 300 · --fw-regular 400 · --fw-medium 500 · --fw-bold 700`.
Corpo base = 300 (leve). Títulos display = 400.

Entrelinha: `--lh-tight 1.1` (títulos) · `--lh-snug 1.45` · `--lh-body 1.8` · `--lh-loose 1.9`.
Tracking: `--ls-tight -0.02em` (títulos) · `--ls-eyebrow 0.14em` (rótulos) · `--ls-wide 0.2em`.

## 3. Espaçamento

Base 8px: `--sp-1 4 · --sp-2 8 · --sp-3 12 · --sp-4 16 · --sp-5 20 · --sp-6 24 · --sp-8 32 · --sp-10 40 · --sp-12 48 · --sp-14 56 · --sp-16 64 · --sp-18 72 · --sp-20 80`.

Ritmo vertical das seções: **`--sp-section: clamp(64px,8vw,100px)`** (mobile aperta pra 60px via media query).

## 4. Layout / forma

- `--conteudo: 1160px` — largura do conteúdo (fit-content). Fundos full-bleed; imagens de background (foto do hero) sangram além do limite.
- `--gutter: 24px` — calha mínima.
- `--radius: 2px` — cantos (quase reto, sóbrio).
- `--hair: 0.5px` — espessura dos fios.
- Hero: **720px** de altura fixa nas duas páginas.

## 5. Componentes-assinatura

- **Eyebrow** (`.secao-label`): Libre Baskerville bold, `--fs-eyebrow`, caixa-alta, `--ls-eyebrow`, ouro.
- **Hairline rules**: fios de `--hair` em ouro/areia separando blocos.
- **Numeração sequencial** (01–10): só onde há ordem real (dias do protocolo, itens). DM Serif itálico ouro.
- **Carrossel de depoimentos**: 3 por vez (`--pv`), loop infinito, controles circulares outline ouro (`‹ › `) + contador.
- **Botão de conversão** (`.btn-cta`): verde, caixa-alta `--fs-xs`, `--ls` largo.

## 6. Performance

- **Fontes self-hosted** (`public/fonts/*.woff2`, latin + latin-ext) via `fonts/fonts.css`; sem render-block do Google Fonts. As 3 críticas (DM Serif normal, Outfit, Libre Baskerville — latin) têm `<link rel="preload" as="font" crossorigin>`.
- **Imagens 100% WebP** (`~5,6 MB → ~0,9 MB`). Logo lossless; screenshots q90; fotos q82; dimensão máx. 1600px.
- **Hero LCP**: `<link rel="preload" as="image" fetchpriority="high">` na foto do hero.
