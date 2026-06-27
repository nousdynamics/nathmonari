# Design: movimento equilibrado e carregamento otimizado

## Objetivo

Dar às duas páginas de venda uma navegação mais viva e fluida sem transformar movimento em distração nem aumentar o custo de carregamento. Como o Chrome DevTools MCP não está disponível, a otimização será conservadora e baseada no código, no peso dos assets locais e em práticas seguras para uma página estática.

As versões `vendas-rc-v3.html` e `vendas-rc-v3-vsl.html` receberão o mesmo sistema de movimento e prioridade de recursos, preservando suas diferenças de hero.

## Direção de movimento

A direção escolhida é “cinemática equilibrada”: uma entrada marcante no hero, seguida por movimentos menores e previsíveis durante a leitura. Toda animação usará apenas `opacity` e `transform`, evitando propriedades que provoquem recálculo de layout.

### Entrada do hero

O hero terá uma sequência curta, executada uma única vez:

1. logo e eyebrow entram primeiro;
2. título e subtítulo sobem suavemente;
3. corpo/VSL e CTA entram por último.

A duração ficará entre `500ms` e `750ms`, com intervalos curtos de no máximo `100ms`. Não haverá tela de loading nem bloqueio da interação.

### Entrada das seções

O `IntersectionObserver` existente continuará sendo o único mecanismo de reveal. O sistema será refinado com:

- deslocamento vertical curto como padrão;
- entrada lateral discreta apenas em layouts de duas colunas;
- stagger de até `240ms` para listas, cards e linhas de bônus;
- animação executada uma única vez por elemento;
- fallback visível caso `IntersectionObserver` não exista.

Elementos decorativos não receberão animações independentes. A assinatura visual será a sequência de leitura, não uma coleção de efeitos soltos.

### Microinterações

- CTAs manterão o lift e deslocamento da seta já existentes;
- cards e linhas usarão apenas respostas leves de borda, sombra ou translação já compatíveis com o layout;
- FAQ preservará a abertura atual;
- carrosséis manterão a transição horizontal existente.

## Scroll suave e acessibilidade

Links internos válidos usarão scroll suave. O comportamento respeitará `prefers-reduced-motion`: usuários que pedem menos movimento receberão rolagem imediata e nenhum reveal/hero animation.

O destino `#preco` terá `scroll-margin-top` suficiente para não ficar oculto pela barra superior fixa. Foco por teclado e nomes acessíveis existentes serão preservados.

## Carrossel inteligente

O autoplay não poderá consumir recursos quando não oferece valor. Cada carrossel:

- inicia apenas quando estiver visível na viewport;
- pausa quando sai da viewport;
- pausa quando a aba fica oculta;
- pausa em hover ou foco de teclado;
- permanece parado quando `prefers-reduced-motion` estiver ativo;
- mantém os controles manuais sempre funcionais.

O timer será único por carrossel, evitando intervalos acumulados após interações repetidas.

## Prioridade de carregamento

### Recursos críticos

- O background WebP desktop será preloaded somente em telas a partir de `769px`.
- O background WebP mobile será preloaded somente até `768px`.
- Permanecerão preloaded apenas as fontes latinas realmente críticas para o hero: DM Serif Display normal e Outfit.
- O preload de Libre Baskerville será removido porque a fonte não é necessária para o primeiro conteúdo principal.
- A logo do hero receberá `fetchpriority="high"`, `width="700"` e `height="140"`.

### Recursos não críticos

- Imagens abaixo da dobra continuarão com `loading="lazy"` e `decoding="async"`.
- Imagens de conteúdo e carrossel receberão seus `width` e `height` intrínsecos já medidos nos WebP locais, permitindo que o navegador reserve espaço antes do download.
- O iframe do YouTube receberá `loading="lazy"`, `title` e política de referrer restrita.
- Não serão adicionados preloads para depoimentos, imagens futuras ou meios de pagamento.
- Não será criado service worker, biblioteca de animação ou dependência externa.

## Estrutura técnica

O CSS compartilhado conterá tokens de duração/easing e as variantes de reveal. O JavaScript compartilhado continuará dividido em blocos pequenos: FAQ, âncoras, carrossel e reveal. Nenhum listener contínuo de `scroll` será criado.

O HTML receberá apenas resource hints, atributos de prioridade/acessibilidade e, se necessário, classes semânticas mínimas para a entrada do hero.

## Validação

Sem métricas de laboratório disponíveis, a validação automatizada confirmará:

- preloads responsivos corretos nas duas páginas;
- apenas duas fontes críticas preloaded;
- iframe VSL lazy e nomeado;
- respeito a `prefers-reduced-motion` no CSS e JavaScript;
- autoplay condicionado à visibilidade e ao estado da aba;
- reveal baseado em `IntersectionObserver` e sem listeners de scroll;
- scroll interno com tratamento de alvo inexistente;
- manutenção dos testes estruturais existentes de CTAs e bônus;
- ausência de erros em `git diff --check` e resposta HTTP 200 das duas páginas.

A ausência do Chrome DevTools MCP será registrada na entrega; não serão inventados valores de Core Web Vitals.
