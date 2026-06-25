# Nath Monari — Landing Pages Protocolo RC

Clone local das páginas de vendas do Protocolo Reconstrua-se, extraídas do WordPress/Elementor e reconstruídas como **site estático puro (HTML + CSS + JS)**, sem build step nem dependências.

## Páginas

| Arquivo | Original |
| --- | --- |
| `vendas-rc-v3.html` | [nathmonari.com.br/vendas-rc-v3](https://nathmonari.com.br/vendas-rc-v3/) |
| `vendas-rc-v3-vsl.html` | [nathmonari.com.br/vendas-rc-v3-vsl](https://nathmonari.com.br/vendas-rc-v3-vsl/) |

A versão VSL é igual à padrão, com vídeo do YouTube no hero.

## Como rodar (local)

Não há build. Sirva a pasta `public/`:

```bash
python -m http.server 8000 --directory public      # http://localhost:8000
```

Ou via Wrangler (mesmo runtime da produção): `npm install` e depois `npm run dev`.

## Deploy — Cloudflare Workers

O site é servido como **static assets** de um Worker (sem código de Worker). Config em `wrangler.jsonc`.

```bash
npm install
npx wrangler login     # uma vez, autentica a conta Cloudflare
npm run deploy         # = wrangler deploy
```

## Layout

- **Largura de conteúdo: 1160px** — definida por `--conteudo` em `css/styles.css`. Os fundos das seções vão de borda a borda e as imagens de background (foto do hero) sangram até a borda; só o conteúdo é centralizado em 1160px.
- **Altura do hero: 720px** (`height` fixo nas duas páginas).
- **Depoimentos: carrossel infinito** (3 imagens por vez, ajustável na var `--pv`) com botões prev/next minimalistas em ouro.

## Estrutura

```text
public/                    # tudo que vai pro ar (assets.directory do Worker)
  index.html               # índice com links para as páginas
  vendas-rc-v3.html        # página de vendas (sem VSL)
  vendas-rc-v3-vsl.html    # página de vendas (com vídeo)
  404.html
  css/styles.css           # estilo + design tokens (:root)
  js/main.js               # FAQ + scroll suave + carrossel de depoimentos
  fonts/                   # fontes self-hosted (woff2) + fonts.css
  images/                  # assets locais (WebP)
wrangler.jsonc             # config Cloudflare Workers
package.json               # scripts dev/deploy
DESIGN-SYSTEM.md           # tokens de cor, tipografia e espaçamento
raw/                       # HTML original do WordPress (git-ignored)
scripts/process-clone.py   # pipeline de extração (git-ignored)
```

## Reprocessar a partir do HTML bruto

Se as páginas no WordPress forem atualizadas:

1. Baixe o HTML novamente para `raw/temp-v3.html` e `raw/temp-vsl.html`
2. Execute: `python scripts/process-clone.py`

## Próximos passos de otimização (sugeridos)

1. **Imagens WebP/AVIF** com `srcset` e lazy-load abaixo da dobra
2. **Fontes self-hosted** (subset Outfit + DM Serif) em vez do Google Fonts
3. **YouTube facade** na VSL — carregar iframe só após clique
4. **Minificar** `css/styles.css` para produção
5. **Domínio custom** no Worker (rota/`routes` em `wrangler.jsonc`)
