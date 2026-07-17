# EVOLUTO DAY — Guia de Construção da Página

Guia único para construir `/EVOLUTO DAY - VA`, `/EVOLUTO DAY - VB` e `/EVOLUTO DAY - VC`.
Fonte: copy `PÁGINA DE VENDAS EVOLUTO DAY - V1.md` + `ID EVOLUTO DAY DESIGN.md` + board de identidade visual.

---

## 0. Regra zero

Todo texto em vermelho na copy é **anotação interna** (rótulo de seção, marcação de headline/sub-headline, comentários de produção). **Não vai para a página.** Vermelho `#D94B4B` só existe em wireframe. Na versão final não há vermelho em lugar nenhum.

---

## 1. As 3 variantes

As três páginas são **idênticas em tudo**, exceto Hero (pré-headline é a mesma; muda headline + sub-headline). Mesma estrutura, mesma CSS, mesma oferta, mesmo CTA.

| Rota | Headline | Sub-headline |
|---|---|---|
| `/evoluto-day-va` | Uma imersão de um fim de semana para mulheres cansadas de viver em círculos e prontas pra sair disso de uma vez por todas. | Em dois dias você vai identificar o que te trava, reprogramar a crença que te sabota e construir o plano definitivo de 90 dias que vai tirar você do ciclo de começar e desistir. |
| `/evoluto-day-vb` | Chegou a hora em que você parar de sonhar com a mudança de vida e sai com um plano de 90 dias pronto para executar | Dois dias para você identificar o que te trava, reprogramar a crença que te sabota e acessar o passo a passo que vai tirar você do ciclo de começar e desistir. |
| `/evoluto-day-vc` | Como sair do ciclo de começar e desistir em um único fim de semana, sem depender de motivação, mesmo que você já tenha tentado de tudo. | Dois dias de imersão ao vivo, um método de três etapas que ajudou 700 mulheres e um plano de 90 dias na sua mão até domingo à tarde é tudo o que você precisa para iniciar uma vida nova segunda-feira. |

Comum às três:

- **Pré-headline:** Para a mulher que já tentou de tudo pra mudar de vida e continua se sentindo presa no mesmo lugar
- **Linha de evento:** Dia 08/07/2026 | 📍 Online e Ao Vivo no Zoom
- **Preço no hero:** De R$497 por R$47 só no primeiro lote
- **CTA:** Quero garantir minha vaga

VC tem a headline mais longa (3 linhas em desktop). O hero precisa acomodar a mais longa sem quebrar altura — travar altura mínima do hero e deixar o bloco de texto crescer, não o contrário.

Implementação recomendada: **um arquivo HTML por variante** (mesmo padrão já usado em `public/vendas-evoluto-v1/` e `public/vendas-evoluto-2-0/`), com CSS e JS compartilhados. Só o `<h1>` e o `<p class="hero__sub">` diferem. Cada variante precisa de tracking próprio para a leitura de teste A/B ser possível.

---

## 2. Direção de arte

Premium, minimalista, cinemático. Fundo verde quase preto. Contraste alto. Muito respiro. Poucos elementos decorativos. Fotografia real (mulheres 25–45, luz cinematográfica) — nunca banco de imagem genérico.

Atmosfera: luxo discreto, calma, confiança, transformação.

---

## 3. Paleta

Resolvi a divergência entre o board de identidade e o `ID EVOLUTO DAY DESIGN.md` a favor do documento oficial (é o guia nomeado como sistema de design; o board é render de referência). Os valores do board estão na coluna direita — se a preferência for o board, é só trocar os tokens, o resto do guia não muda.

| Token | Uso | Valor (oficial) | Board (alternativo) |
|---|---|---|---|
| `--verde-fundo` | Fundo principal | `#050F08` | `#050F08` (igual) |
| `--verde-fundo-2` | Fundo de seção alternada | `#0E1F14` | `#0F2516` |
| `--verde-card` | Cards | `#173423` | `#1E3A22` |
| `--verde-cta` | Botão CTA | `#A8F05A` | `#A4E65C` |
| `--verde-cta-hover` | Hover CTA | `#B8FF70` | — |
| `--texto` | Texto principal | `#F7F8F5` | `#F7FDF5` |
| `--texto-2` | Texto secundário | `#B8C2BB` | — |
| `--divisoria` | Bordas/divisórias | `rgba(255,255,255,.08)` | — |

Seções claras (as poucas com fundo verde-claro ou branco pedidas): usar `--verde-cta` como fundo com texto `#050F08`, ou `#F7F8F5` com texto `#050F08`. **Nunca texto claro sobre verde claro.** Onde inverter: ver §6.

---

## 4. Tipografia

- **Headlines:** Archivo (Black/Bold) — o board mostra Montserrat/Poppins como alternativa; escolhi Archivo por ser o que o guia oficial define. Decisão a confirmar antes de baixar as fontes.
- **Corpo:** Inter
- **Labels:** Inter Medium, uppercase, letter-spacing amplo (o board usa tracking bem aberto nos rótulos — `.16em`)

Escala: H1 64 / H2 48 / H3 36 / H4 28 / Body 20 / Small 16.

Mobile: H1 40 / H2 32 / H3 24 / H4 20 / Body 16.

Fontes servidas localmente em `public/fonts/` (o projeto já faz isso), nunca via CDN do Google.

---

## 5. Grid e espaçamento

Container **1200px**, 12 colunas. Padding: desktop 80 / tablet 48 / mobile 24.
Escala de espaçamento: 8, 16, 24, 32, 48, 64, 96, 128.

Atenção: o resto do repositório usa `--conteudo: 1160px` (ver `CLAUDE.md`). O guia do Evoluto Day pede 1200. Como é página nova com identidade própria, mantive 1200 — mas se a decisão for uniformizar com o resto do site, é trocar um token.

Fundos são full-bleed; imagens de fundo sangram até a borda; só o conteúdo respeita o limite. Mesma convenção do resto do projeto.

Breakpoints: 1440 desktop / 1280 notebook / 768 tablet / 390 mobile.

---

## 6. Seções (ordem final da página)

Numeração da copy entre parênteses. Os títulos em vermelho da copy viram estrutura, não texto visível — exceto onde indicado como título real.

1. **Hero (1)** — fundo `#050F08` + foto emocional sangrando à direita, gradiente escuro por cima para garantir contraste do texto. Pré-headline (label), H1, sub-headline, linha de data/local, linha de preço, CTA 1. Fundo escuro.
2. **Abertura (2)** — lead de história. Fundo `#050F08`, coluna de texto estreita (máx. ~720px), muito respiro. A frase *"Já tentei de tudo, acho que o problema sou eu é melhor desistir."* é destaque em itálico, tamanho maior, com filete verde à esquerda. Fecha em "**o Evoluto Day é para você**" com "Evoluto Day" em `--verde-cta`.
3. **O que é o Evoluto Day (3)** — título real: `O QUE É O EVOLUTO DAY`. Fundo `#0E1F14`. Intro + **3 cards iguais** do método CRM (Clareza / Reprogramação / Manifestação), cada um com ícone outline, subtítulo, parágrafo e 3 bullets. Cards do mesmo tamanho, sem card "destaque".
4. **Cronograma (4)** — título real: `CRONOGRAMA DO EVENTO`. Timeline vertical em duas colunas (Sábado / Domingo), marcadores verdes. Fundo `#050F08`.
   *Erro na copy a corrigir com a Nath: o domingo está escrito "Abertura do Evoluto Day - Dia 1" — deveria ser Dia 2.*
5. **Para quem é (5)** — título real: `PARA QUEM É O EVOLUTO DAY`. 7 itens "É para você que…", cada um com marcador/ícone verde. Fundo `#0E1F14`.
6. **Prova social (6)** — cards com foto/vídeo. Há 3 links do Google Drive na copy: os vídeos precisam ser baixados e hospedados localmente (link do Drive não embeda de forma confiável e mata a performance). **Bloqueio: pendente de acesso aos arquivos.** Enquanto não houver, a seção fica com estrutura pronta e placeholder.
7. **Bio (7)** — título real: `QUEM É A NATH`. Foto grande à esquerda, texto à direita. Fundo `#050F08`. Destaque numérico: "mais de 700 alunas".
8. **Oferta (9)** — **seção clara**: caixa destacada com fundo `--verde-cta` (ou branco), texto escuro. Stack de valor (3 linhas com preço riscado), VALOR TOTAL R$497, desconto 90%, 12x de R$00,00 ou R$47 à vista, CTA.
   *Pendência: "12x de R$ 00,00" está sem valor na copy — precisa do parcelamento real antes de publicar.*
9. **Garantia (8)** — fundo `#0E1F14`, card com ícone de selo. 7 dias pós-evento, e-mail `suportenathmonari@gmail.com` clicável (`mailto:`).
   Coloquei a garantia **depois** da oferta: quebra de objeção logo após o preço converte melhor que antes dele. Se a preferência for seguir a ordem literal da copy, é só inverter.
10. **FAQ (10)** — título real: `PERGUNTAS FREQUENTES`. Accordion, 7 perguntas. Reaproveitar o componente de FAQ já existente em `public/js/main.js`.
11. **Fechamento (11)** — fundo `#050F08`, texto centralizado curto, CTA final grande.
12. **Rodapé** — minimalista: logo, e-mail de suporte, links legais, copyright.

---

## 7. Componentes

**Botão primário (CTA)**
Altura 60px. Radius 999px. Fundo `#A8F05A`. Texto preto, peso 700, uppercase. Glow verde suave. Ícone de seta à direita. Hover: escala 1.03 + fundo `#B8FF70`. **Pulse contínuo de 2.5s** (pedido explícito).

```css
@keyframes pulse-cta {
  0%, 100% { box-shadow: 0 0 0 0 rgba(168, 240, 90, .45); }
  50%      { box-shadow: 0 0 0 16px rgba(168, 240, 90, 0); }
}
.cta { animation: pulse-cta 2.5s ease-out infinite; }
@media (prefers-reduced-motion: reduce) { .cta { animation: none; } }
```

O `prefers-reduced-motion` não é opcional: animação infinita sem escape é barreira de acessibilidade real.

**Botão secundário** — outline verde, fundo transparente.

**Cards** — radius 24px, borda branca 8%, blur 18px, fundo `--verde-card`.

**Ícones** — outline, traço 2px, verde claro. SVG inline, sem biblioteca externa.

---

## 8. Microinterações

Fade-up de 400ms na entrada das seções (IntersectionObserver, sem biblioteca). CTA pulse. Hover suave em tudo. Nada além disso — o guia pede poucos efeitos.

---

## 9. CTAs

3 CTAs no total: hero, oferta, fechamento. Todos com o mesmo texto — **"Quero garantir minha vaga"** — e o mesmo destino de checkout. Cada um com identificador próprio no tracking para saber qual converte.

UTMs e Meta Pixel: reaproveitar `public/js/utms.js` e `public/js/meta-pixel.js`, já existentes no projeto.

---

## 10. Checklist de publicação

- [ ] Nenhum texto vermelho / anotação interna na página
- [ ] 3 variantes no ar, diferindo só no hero
- [ ] Tracking separado por variante (senão o teste A/B não lê)
- [ ] Valor do parcelamento preenchido (hoje "R$ 00,00")
- [ ] Vídeos de depoimento baixados e hospedados localmente
- [ ] "Dia 1" do domingo corrigido para "Dia 2"
- [ ] Fontes locais, sem CDN
- [ ] Imagens em `.webp` (padrão do projeto)
- [ ] Contraste AA em todas as seções claras
- [ ] `prefers-reduced-motion` respeitado no pulse
- [ ] Testado em 1440 / 1280 / 768 / 390

---

## 11. Como as páginas são geradas

As três variantes saem de um único template para não divergirem com o tempo:

```bash
python scripts/build-evoluto-day.py
```

Isso reescreve `public/evoluto-day-va|vb|vc/index.html`. **Edite o template em `scripts/build-evoluto-day.py`, não os HTML gerados** — qualquer mudança no corpo da página é feita uma vez e vale para as três. As headlines/sub-headlines ficam na lista `VARIANTES`, no topo do arquivo.

Arquivos:

- `scripts/build-evoluto-day.py` — template + copy das 3 variantes
- `public/css/evoluto-day.css` — sistema de design
- `public/js/evoluto-day.js` — FAQ accordion + reveal
- `public/fonts/evoluto-day.css` + `ed-*.woff2` — Archivo e Inter servidas localmente
- `public/data/routes.json` — as 3 rotas registradas

## 12. Decisões tomadas na construção

Resolvidas para destravar o build. Todas são um token/uma linha de trocar se a preferência for outra:

1. **Fonte das headlines** — Archivo (guia oficial), não Montserrat/Poppins (board).
2. **Paleta** — tons do guia oficial (`#A8F05A`, `#0E1F14`, `#173423`), não os do board.
3. **Container** — 1200px (guia), não os 1160px do resto do site.
4. **Ordem** — garantia depois da oferta.
5. **Hero** — sem foto: não existe imagem do Evoluto Day no repositório. O hero é atmosférico (gradientes verdes). A CSS já tem `.hero-foto` pronta — é só adicionar o `<img class="hero-foto">` no template quando a foto existir.
6. **Checkout** — os 3 CTAs apontam para `#oferta` (constante `CHECKOUT` no script). Trocar pela URL real do checkout.
7. **`noindex`** — as três estão com `robots: noindex` porque três páginas de conteúdo idêntico indexadas competem entre si. Remover se a intenção for tráfego orgânico.
