# Motion and Loading Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar movimento cinematográfico equilibrado e otimizar prioridades de carregamento nas duas páginas estáticas.

**Architecture:** CSS controla entrada do hero, variantes de reveal e reduced motion. `main.js` continua sem dependências e usa `IntersectionObserver`, Page Visibility API e `matchMedia`. O HTML fornece preloads responsivos, dimensões intrínsecas e atributos de carregamento.

**Tech Stack:** HTML5, CSS3, JavaScript ES5 compatível com o código atual, Python 3 para verificação estrutural.

## Global Constraints

- Sem bibliotecas externas, build step, service worker ou listener contínuo de scroll.
- Alterar igualmente as páginas com e sem VSL.
- Animar somente `opacity` e `transform`.
- Respeitar `prefers-reduced-motion` no CSS e JavaScript.
- Não inventar métricas de Core Web Vitals sem Chrome DevTools MCP.

---

### Task 1: Contrato automatizado de movimento e recursos

**Files:**
- Modify: `scripts/verify-sales-page.py`
- Test: `public/vendas-rc-v3.html`
- Test: `public/vendas-rc-v3-vsl.html`
- Test: `public/css/styles.css`
- Test: `public/js/main.js`

**Interfaces:**
- Consumes: HTML, CSS e JavaScript finais.
- Produces: falhas específicas para resource hints, atributos de imagem, reduced motion e autoplay inteligente.

- [ ] **Step 1: Adicionar verificações inicialmente falhas**

Exigir no HTML:

```python
assert 'media="(min-width: 769px)"' in html
assert 'media="(max-width: 768px)"' in html
assert html.count('as="font"') == 2
assert 'fetchpriority="high" width="700" height="140"' in html
```

Na página VSL, exigir `loading="lazy"`, `title="Vídeo do Protocolo RC"` e `referrerpolicy="strict-origin-when-cross-origin"` no iframe.

Exigir no CSS/JS:

```python
assert "--ease-out:" in css
assert "hero-enter" in css
assert "prefers-reduced-motion" in css
assert "visibilitychange" in javascript
assert "motionQuery.matches" in javascript
assert "IntersectionObserver" in javascript
assert 'addEventListener("scroll"' not in javascript
```

- [ ] **Step 2: Rodar e confirmar RED**

Run: `python scripts/verify-sales-page.py`

Expected: FAIL por preloads não responsivos, iframe eager e lógica de movimento/visibilidade ausente.

---

### Task 2: Prioridade de recursos e estabilidade visual

**Files:**
- Modify: `public/vendas-rc-v3.html`
- Modify: `public/vendas-rc-v3-vsl.html`

**Interfaces:**
- Consumes: assets WebP e WOFF2 locais.
- Produces: preloads responsivos e dimensões intrínsecas.

- [ ] **Step 1: Corrigir preloads nas duas páginas**

Usar:

```html
<link rel="preload" href="fonts/-nFnOHM81r4j6k0gjAW3mujVU2B2G_Bx0g.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/QGYvz_MVcBeNP4NJtEtq.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="images/bg-hero-reconstrua-se-v2.webp" as="image" type="image/webp" media="(min-width: 769px)" fetchpriority="high">
<link rel="preload" href="images/bg-hero-reconstrua-se-mobile.webp" as="image" type="image/webp" media="(max-width: 768px)" fetchpriority="high">
```

- [ ] **Step 2: Reservar dimensões das imagens**

Adicionar `width`/`height` medidos aos logos (`700x140`), `nath-historia` (`900x1596`), `nath-futuro` (`900x600`), pagamentos (`768x122`) e carrosséis: depoimentos (`717x1280`, `1153x513`, `512x324`) e resultados (`484x390`, `489x301`, `1600x1273`, `1173x669`, `900x1600`).

- [ ] **Step 3: Tornar o iframe menos custoso**

Aplicar:

```html
<iframe src="https://www.youtube.com/embed/HQAGbNDz47A" title="Vídeo do Protocolo RC" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
```

- [ ] **Step 4: Rodar o verificador**

Run: `python scripts/verify-sales-page.py`

Expected: recursos HTML passam; CSS/JS ainda falham.

---

### Task 3: Sistema de movimento e carrossel inteligente

**Files:**
- Modify: `public/css/styles.css`
- Modify: `public/js/main.js`

**Interfaces:**
- Consumes: elementos existentes das páginas.
- Produces: tokens `--ease-out`, classes `.hero-enter`, `.reveal--left`, `.reveal--right` e timers condicionados à visibilidade.

- [ ] **Step 1: Implementar os tokens e a entrada do hero**

Adicionar tokens de duração/easing, keyframes `hero-enter` com `opacity`/`translateY` e delays progressivos para logo, títulos, corpo/VSL e CTA.

- [ ] **Step 2: Refinar reveal e stagger**

Usar variáveis CSS `--reveal-x`, `--reveal-y` e `--reveal-delay`. No JavaScript, atribuir laterais a pares de colunas e delays de `min(index * 55, 240)ms` em listas/grids antes de observar.

- [ ] **Step 3: Generalizar scroll interno**

Selecionar `a[href^="#"]`, validar o alvo e usar:

```javascript
target.scrollIntoView({ behavior: motionQuery.matches ? "auto" : "smooth", block: "start" });
```

- [ ] **Step 4: Condicionar o autoplay**

Criar `isVisible`, observar cada carrossel, ouvir `visibilitychange`, `focusin`/`focusout` e impedir `start()` se a aba estiver oculta, o carrossel estiver fora da tela ou reduced motion estiver ativo.

- [ ] **Step 5: Implementar reduced motion integral**

No media query, remover animação, transição e transform de hero/reveal/carrossel/CTA. O JavaScript não iniciará autoplay quando `motionQuery.matches` for verdadeiro.

- [ ] **Step 6: Rodar GREEN**

Run: `python scripts/verify-sales-page.py`

Expected: PASS nas duas páginas, CSS e JavaScript.

---

### Task 4: Verificação final

**Files:**
- Verify: todos os arquivos anteriores.

- [ ] **Step 1: Validar sintaxe e whitespace**

Run: `python scripts/verify-sales-page.py` e `git diff --check`.

Expected: zero falhas.

- [ ] **Step 2: Validar entrega HTTP**

Abrir as duas páginas no servidor local e confirmar HTTP 200.

- [ ] **Step 3: Revisar escopo**

Run: `git diff -- public/vendas-rc-v3.html public/vendas-rc-v3-vsl.html public/css/styles.css public/js/main.js`.

Expected: somente movimento, resource hints, atributos de mídia e lógica de pausa; sem alterações de copy ou checkout.
