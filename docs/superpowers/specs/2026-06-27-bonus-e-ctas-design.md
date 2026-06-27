# Design: bônus editoriais e CTAs contextuais

## Objetivo

Atualizar as duas páginas de venda (`vendas-rc-v3.html` e `vendas-rc-v3-vsl.html`) com:

1. a seção de bônus no layout editorial B, preservando ícones e descrições;
2. valores individuais dos bônus riscados para indicar que já estão inclusos;
3. botões com bordas retas e seta SVG confiável;
4. seis CTAs intermediários integrados ao desenho das seções, sem duplicar CTAs existentes ou criar botões próximos deles.

As duas páginas devem permanecer visualmente equivalentes, exceto pelas diferenças já existentes no hero/VSL.

## Seção de bônus

A grade de cinco cards será substituída por um painel editorial escuro. O cabeçalho terá duas colunas no desktop: título à esquerda e texto de apoio à direita. Abaixo dele, os cinco bônus serão apresentados em linhas.

Cada linha conterá, nesta ordem:

- o mesmo ícone SVG de presente, identificando visualmente que o item é um bônus;
- identificação do bônus e título;
- descrição completa atual;
- valor antigo riscado.

Os valores permanecem `R$47`, `R$47`, `R$37`, `R$37` e `R$32`. O risco será explícito por CSS e terá contraste suficiente. Os preços terão `15px` no desktop e `13px` em telas de até `480px`. No celular, cada linha reorganizará título, descrição e preço sem ocultar conteúdo.

O painel usará a paleta escura e dourada já presente no projeto, cantos de no máximo `2px` e divisórias discretas. Os cinco presentes permanecerão dentro do círculo dourado atual, sem animação flutuante.

## Sistema de botões

Todos os elementos `.btn-cta` terão aparência retangular, coerente com os demais componentes do projeto:

- raio de borda máximo de `2px`;
- fundo verde atual;
- texto em caixa alta;
- seta desenhada por SVG inline, nunca por caractere em pseudo-elemento;
- área da seta retangular, separada do texto por uma linha vertical;
- estados de hover e foco visível sem alterar a geometria do componente.

O pseudo-elemento `.btn-cta::after` será removido. A seta SVG será adicionada a todos os CTAs existentes e novos. Isso elimina a origem do ícone inconsistente e mantém o mesmo markup acessível nas duas páginas.

## Cadência dos CTAs intermediários

Os novos CTAs aparecerão depois de cada par de seções elegíveis, com reinício da contagem após o CTA do hero. Serão seis inserções:

1. ao final de `identificacao`, depois de `prova-abertura + identificacao`;
2. ao final de `reframe`, depois de `agitacao + reframe`;
3. ao final de `mecanismo`, depois de `historia + mecanismo`;
4. ao final de `modulos`, depois de `produto + modulos`;
5. ao final de `prova-densa`, depois de `bonus + prova-densa`;
6. ao final de `para-quem`, depois de `stack + para-quem`.

Não haverá novo CTA depois de `futuro`, pois a seção seguinte (`preco`) já contém um botão. Também não haverá inserções entre `preco`, `garantia`, `cta-section`, `faq` e `ps-final`, pois essa região já possui CTAs próximos.

Todos os novos botões usarão o texto existente “Sim, quero reconectar com quem sou” e apontarão para `#preco`. Os CTAs de compra já presentes na seção de preço e no final continuarão apontando para a Kiwify.

## Integração contextual — opção C

Os CTAs não serão faixas independentes entre seções. Cada um será parte do contêiner da seção em que aparece:

- em seções de uma coluna, ficará centralizado após o conteúdo principal;
- em seções com grade, ocupará uma nova linha com `grid-column: 1 / -1`;
- em fundos escuros, usará uma variação de contraste compatível com a paleta;
- em fundos claros, manterá respiro por margem superior e alinhamento com a largura do conteúdo;
- no celular, ocupará a largura disponível e preservará uma área de seta com largura fixa.

Um wrapper reutilizável (`section-cta`) controlará espaçamento e alinhamento. Modificadores de contexto serão limitados ao necessário para fundo claro, fundo escuro e seção em grade. Não será adicionada nova copy promocional fora do texto do botão.

## Comportamento e acessibilidade

- A rolagem para `#preco` reutilizará o comportamento suave existente em `main.js`.
- O SVG será decorativo (`aria-hidden="true"`) porque o texto do link já descreve a ação.
- O foco por teclado continuará visível.
- A área clicável manterá altura confortável em desktop e mobile.
- A preferência `prefers-reduced-motion` será respeitada nas transições.

## Validação

A implementação será verificada nas duas páginas em desktop e mobile. A checagem cobrirá:

- seis CTAs intermediários por página, todos com `href="#preco"`;
- ausência de CTAs intermediários na vizinhança da seção de preço e dos CTAs finais;
- seta SVG presente e alinhada em todos os botões;
- ausência do pseudo-elemento antigo;
- bordas retas em todos os CTAs;
- cinco linhas de bônus com o ícone de presente, título, descrição e preço riscado em tamanho ampliado;
- nenhuma regressão no hero, carrosséis, FAQ ou rolagem suave.
