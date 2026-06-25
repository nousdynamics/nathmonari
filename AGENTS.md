## Development

Site estático puro (HTML + CSS + JS). Arquivos servidos ficam em `public/`. Sem build step.

Dev local (qualquer servidor estático):

```bash
python -m http.server 8000 --directory public      # http://localhost:8000
```

Ou via Wrangler (igual ao runtime de produção):

```bash
npm install        # instala wrangler (devDependency)
npm run dev        # wrangler dev
```

## Deploy — Cloudflare Workers (static assets)

Sem Worker script; serve só os assets de `public/` (config em `wrangler.jsonc`).

```bash
npm install
npx wrangler login     # uma vez
npm run deploy         # wrangler deploy
```

## Estrutura

```text
public/                    # tudo que vai pro ar
  index.html               # índice com links
  vendas-rc-v3.html        # página de vendas (sem VSL)
  vendas-rc-v3-vsl.html    # página de vendas (com vídeo)
  404.html
  css/styles.css           # estilo compartilhado
  js/main.js               # FAQ + scroll suave + carrossel de depoimentos
  images/                  # assets locais
wrangler.jsonc             # config Cloudflare Workers (assets.directory = ./public)
package.json               # scripts dev/deploy (wrangler)
raw/                       # HTML original do WordPress (referência, git-ignored)
scripts/process-clone.py   # pipeline de extração
```

## Convenções de layout

- Largura de conteúdo: **1160px** (`--conteudo`). Fundos full-bleed; imagens de background (foto do hero) sangram até a borda; só o conteúdo respeita o limite.
- Altura do hero: **720px** (`height` fixo nas duas páginas).
- Depoimentos: carrossel infinito, **3 imagens por vez** (ajustável na CSS var `--pv` em `.carrossel`), avança 1 por clique, com botões prev/next minimalistas. Componente: `[data-carrossel]` em `js/main.js`.
