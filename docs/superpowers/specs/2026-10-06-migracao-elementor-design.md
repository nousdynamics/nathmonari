# Migração das páginas para o WordPress/Elementor

**Data:** 2026-10-06
**Estado:** aguardando revisão

## Objetivo

Levar 9 páginas que hoje rodam no Cloudflare (`ev.nathmonari.com.br`) para o
WordPress, coladas em widgets HTML do Elementor, com animação e polimento.

As páginas no Cloudflare continuam no ar e intactas. Elas seguem como
referência de comparação e como plano B.

## Decisões tomadas

| Pergunta | Decisão |
| --- | --- |
| Quais páginas | As 9 variantes das três famílias |
| Imagens e fontes | Continuam no Cloudflare, via URL absoluta |
| Nível de mudança | Animação + polimento; copy e estrutura de seções preservadas |
| GTM | Sai dos blocos; o WordPress já carrega o container no site inteiro |

## Escopo: as 9 páginas

| Origem em `public/` | Wrapper | CSS a embutir | JS a embutir |
| --- | --- | --- | --- |
| `evoluto-day-va/index.html` | `nm-evoluto-day-va` | `evoluto-day.css` | `utms.js`, `evoluto-day.js` |
| `evoluto-day-vb/index.html` | `nm-evoluto-day-vb` | `evoluto-day.css` | `utms.js`, `evoluto-day.js` |
| `evoluto-day-vc/index.html` | `nm-evoluto-day-vc` | `evoluto-day.css` | `utms.js`, `evoluto-day.js` |
| `evoluto-day-vd/index.html` | `nm-evoluto-day-vd` | `evoluto-day.css` | `utms.js`, `evoluto-day.js` |
| `vendas-evoluto-v1/index.html` | `nm-vendas-evoluto-v1` | inline da própria página | inline da própria página |
| `vendas-evoluto-2-0/index.html` | `nm-vendas-evoluto-2-0` | inline da própria página | inline da própria página |
| `vendas-evoluto-v3/index.html` | `nm-vendas-evoluto-v3` | inline da própria página | inline da própria página |
| `vendas-rc-v3.html` | `nm-vendas-rc-v3` | `fonts-min.css`, `styles.css` | `utms.js`, `main.js` |
| `vendas-rc-v3-vsl.html` | `nm-vendas-rc-v3-vsl` | `fonts-min.css`, `styles.css` | `utms.js`, `main.js` |

As três famílias chegam em formatos diferentes:

- **Evoluto Day e Reconstrua-se** são páginas próprias que dependem de CSS e JS
  em `/css` e `/js`.
- **Evoluto** é um clone de WordPress: um documento HTML completo (`#evoluto-page`,
  com CSS e JS próprios) dentro de um invólucro do Elementor que carrega jQuery,
  `elementor-frontend` e `v4-shims`. Esses arquivos de invólucro **não entram na
  migração**: o conteúdo da página não depende deles, e no WordPress de destino
  o jQuery e o runtime do Elementor já existem. Incluí-los duplicaria o jQuery.
  Isso reduz o bloco de ~240 KB para ~80 KB.

## Arquitetura do conversor

Script em `scripts/elementor/`, executado por página ou em lote. Entrada: um
arquivo de `public/`. Saída: `dist/elementor/<pagina>.html`, um bloco único no
formato `<style> + markup + <script>`, sem `<html>`, `<head>` nem `<body>`.

Etapas, nesta ordem:

1. **Extrair** o conteúdo. Para o Evoluto, recorta o documento interno a partir
   de `<div id="evoluto-page">` e descarta o invólucro do Elementor. Para as
   outras, recorta o conteúdo do `<body>`.
2. **Resolver dependências.** Lê os `<link>` e `<script src>` locais e embute o
   conteúdo. Fontes do Google continuam por `@import` no topo do `<style>`.
3. **Reescrever caminhos.** Todo `/images/...`, `./assets/...` e similares vira
   `https://ev.nathmonari.com.br/...`. Caminhos que já são absolutos ou `data:`
   ficam como estão.
4. **Isolar o CSS** (regras na seção seguinte).
5. **Remover o GTM**: as tags `<script>` do container e o `<noscript>` do iframe.
   Também saem `<title>`, `canonical`, `og:*` e demais metadados de `<head>`:
   num widget HTML eles não têm efeito, e no WordPress quem controla isso é a
   própria página e o plugin de SEO. O relatório lista o que foi descartado,
   para você reconfigurar no Elementor.
6. **Injetar a camada de animação** (seção própria).
7. **Gravar** o arquivo e registrar um relatório por página: tamanho final,
   nº de recursos externos, nº de seletores reescritos, nº de regras descartadas.

O conversor é determinístico e idempotente: rodar de novo sobre a mesma origem
produz o mesmo arquivo. Toda troca é verificada por contagem — se um trecho
esperado não for encontrado, o script para em vez de gravar um arquivo pela
metade. Esse é o mesmo método usado na `vendas-evoluto-v3`, que permitiu
regerar a página do zero dezenas de vezes sem erro.

## Isolamento do CSS

Tudo entra dentro de `<div id="nm-<pagina>">`. Regras:

- **Prefixação.** Cada seletor recebe `#nm-<pagina> ` na frente. Seletores que
  já começam com `#evoluto-page` têm o id trocado pelo wrapper, sem duplicar.
- **Tags globais.** `html` e `body` não existem dentro do bloco: suas
  declarações (fonte, cor, fundo, `line-height`) passam para o próprio wrapper.
  `*` vira `#nm-<pagina> *`.
- **Reset defensivo** no topo do bloco. O tema do WordPress e o Elementor
  injetam `margin`, `color`, `line-height` e `text-decoration` em `h1`–`h6`,
  `p`, `ul`, `li`, `a`, `button` e `img` dentro do widget. Sem o reset, a página
  colada não fica igual à original.
- **`@media` e `@keyframes`** são preservados; dentro do `@media`, os seletores
  internos também são prefixados. Nomes de `@keyframes` recebem prefixo para não
  colidir com animações do tema.
- **`position: fixed`** é auditado: dentro de um container com `transform` do
  Elementor, elemento fixo passa a se posicionar pelo container, não pela
  janela. Onde aparecer, o relatório avisa.

## Camada de animação

Compartilhada entre as páginas, injetada pelo conversor:

- **Entrada por scroll** com atraso em cascata entre itens irmãos.
- **Contadores** nos números da oferta (preço, parcelas, quantidade de módulos).
- **Brilho** percorrendo os botões de CTA, em laço lento.
- **Microinterações** de hover em cards, itens de lista e ícones.

Duas regras invioláveis:

1. Nada anima antes de entrar na tela — via `IntersectionObserver`, sem custo
   no carregamento inicial e sem travar a rolagem.
2. `prefers-reduced-motion: reduce` desliga todo o movimento e entrega a página
   estática, com todo o conteúdo visível.

Sem biblioteca externa. As páginas do Evoluto já têm um sistema `.reveal`
próprio; o conversor detecta e não duplica — nesse caso só acrescenta o que
falta (contadores, brilho do CTA, hover).

## Verificação, antes de colar

Um simulador local reproduz o ambiente de destino: página com os estilos típicos
de tema WordPress + Elementor, com o bloco colado dentro de um container padrão.

Checagens automáticas por página:

- Nenhum recurso quebrado: todo CSS, JS, imagem e fonte responde 200.
- Nenhuma rolagem horizontal em 390px e 320px de largura.
- Nenhum seletor escapando do wrapper: nenhum estilo do bloco pode alterar um
  elemento de controle colocado fora dele no simulador.
- O inverso também: os estilos do tema não podem alterar o bloco. Comparação
  por screenshot contra a página original no Cloudflare.
- Screenshots no motor do Safari (iPhone 13) e no desktop (1440px).
- Links de checkout do Kiwify preservados, com as UTMs propagando.

## Entrega

- `dist/elementor/<pagina>.html` — 9 arquivos, um por página.
- `dist/elementor/README.md` — ordem de colagem e o que configurar em cada
  página do Elementor: layout em largura total, sem padding do container,
  título da página oculto.
- Relatório da conversão por página (tamanho, recursos, avisos).

## Consequências aceitas

- **O bloco do Reconstrua-se fica grande**: ~47 KB de CSS embutido (~10 KB
  comprimido). O editor do Elementor fica mais lento nessa página. A alternativa
  (CSS por `<link>`) faria a página depender do Cloudflare para renderizar, não
  só para as imagens.
- **As páginas seguem dependendo do Cloudflare** para imagens e fontes. Se
  `ev.nathmonari.com.br` sair do ar, as páginas no WordPress perdem as imagens.
- **O GTM sai dos blocos.** Se alguma página dispara evento próprio pelo
  container (clique de CTA, scroll), isso passa a depender da configuração do
  site. Conferir depois da primeira página no ar.

## Fora de escopo

- Reescrever copy ou mudar estrutura de seções.
- Migrar as demais páginas (`desafio-10dias`, `imersao-uma-nova-identidade`,
  `links`, painel administrativo).
- Reconstruir as páginas como widgets nativos do Elementor.
- Desligar o Cloudflare ou mexer em DNS.
