# Bonus Editorial and Contextual CTAs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a lista editorial de bônus e seis CTAs contextuais, com botões retangulares e seta SVG, nas duas páginas de venda.

**Architecture:** O HTML continuará estático e duplicado intencionalmente entre as versões com e sem VSL. Um único conjunto de classes no CSS compartilhado controlará bônus, botões e posicionamento contextual. Um verificador Python sem dependências externas fará testes estruturais nas duas páginas.

**Tech Stack:** HTML5, CSS3, JavaScript existente para rolagem suave, Python 3 `html.parser` para validação.

## Global Constraints

- Não adicionar build step ou dependências.
- Alterar igualmente `public/vendas-rc-v3.html` e `public/vendas-rc-v3-vsl.html`.
- Preservar as alterações já existentes do usuário em `public/css/styles.css`.
- Manter o texto “Sim, quero reconectar com quem sou”.
- Todos os seis CTAs intermediários apontam para `#preco`.
- CTAs de compra existentes continuam apontando para a Kiwify.
- `.btn-cta` usa borda de `2px` e SVG inline; nenhum pseudo-elemento desenha a seta.
- Não inserir CTA entre `futuro`, `preco`, `garantia`, `cta-section`, `faq` e `ps-final`.

---

### Task 1: Verificador estrutural das páginas

**Files:**
- Create: `scripts/verify-sales-page.py`
- Test: `public/vendas-rc-v3.html`
- Test: `public/vendas-rc-v3-vsl.html`

**Interfaces:**
- Consumes: HTML estático e `public/css/styles.css`.
- Produces: processo com exit code `0` quando ambas as páginas cumprem o contrato; mensagens de erro e exit code `1` caso contrário.

- [ ] **Step 1: Criar o teste inicialmente falho**

Criar um parser baseado em `HTMLParser` que registre classes abertas, links `.btn-cta`, SVGs descendentes, wrappers `.section-cta`, linhas `.bonus-row` e preços `.bonus-item-preco`. Para cada página, exigir:

```python
assert len(result.section_ctas) == 6
assert all(item.href == "#preco" for item in result.section_ctas)
assert all(item.has_svg for item in result.buttons)
assert len(result.bonus_rows) == 5
assert all(row.has_svg and row.has_price for row in result.bonus_rows)
```

Também exigir no CSS:

```python
assert ".btn-cta::after" not in css
assert ".btn-cta-icon" in css
assert ".bonus-item-preco" in css
```

- [ ] **Step 2: Executar para confirmar a falha**

Run: `python scripts/verify-sales-page.py`

Expected: FAIL informando ausência dos seis `.section-cta`, falta de SVG nos botões e presença de `.btn-cta::after`.

---

### Task 2: Componente de botão retangular e CTAs contextuais

**Files:**
- Modify: `public/css/styles.css:124-128`
- Modify: `public/css/styles.css:443-444`
- Modify: `public/css/styles.css:487-488`
- Modify: `public/vendas-rc-v3.html`
- Modify: `public/vendas-rc-v3-vsl.html`

**Interfaces:**
- Consumes: `#preco`, paleta CSS existente e rolagem suave existente em `public/js/main.js`.
- Produces: `.btn-cta-text`, `.btn-cta-icon`, `.section-cta`, `.section-cta--dark` e `.section-cta--grid`.

- [ ] **Step 1: Substituir a seta por markup SVG em todos os CTAs existentes**

Usar este conteúdo dentro de cada `<a class="btn-cta">`:

```html
<span class="btn-cta-text">Sim, quero reconectar com quem sou</span>
<span class="btn-cta-icon" aria-hidden="true">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path>
  </svg>
</span>
```

- [ ] **Step 2: Implementar o CSS mínimo do componente**

Substituir o CSS de `.btn-cta`/`::after` por:

```css
.btn-cta{display:inline-grid;grid-template-columns:minmax(0,1fr) 44px;align-items:stretch;background:linear-gradient(180deg,#3fe084 0%,var(--verde-cta) 100%);color:var(--branco);font-family:var(--font-body);font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;text-decoration:none;border-radius:2px;overflow:hidden;cursor:pointer;border:none;box-shadow:0 12px 30px -12px rgba(46,204,113,.55);transition:transform .25s ease,box-shadow .25s ease}
.btn-cta-text{display:flex;align-items:center;justify-content:center;padding:15px 24px}
.btn-cta-icon{display:flex;align-items:center;justify-content:center;border-left:1px solid rgba(255,255,255,.36);transition:transform .25s ease}
.btn-cta-icon svg{width:18px;height:18px;display:block}
.btn-cta:hover{transform:translateY(-2px);box-shadow:0 18px 42px -12px rgba(46,204,113,.7)}
.btn-cta:hover .btn-cta-icon svg{transform:translateX(2px)}
.btn-cta:focus-visible{outline:2px solid var(--ouro);outline-offset:4px}
.section-cta{width:100%;display:flex;justify-content:center;margin-top:48px}
.section-cta--grid{grid-column:1/-1}
.section-cta .btn-cta{width:min(100%,430px)}
```

- [ ] **Step 3: Inserir os seis CTAs em cada página**

Adicionar o wrapper abaixo ao final de `identificacao`, `reframe`, `mecanismo`, `modulos`, `prova-densa` e `para-quem`. Usar `section-cta--grid` nas três seções que são grids e `section-cta--dark` nos fundos escuros.

```html
<div class="section-cta section-cta--grid">
  <a href="#preco" class="btn-cta">
    <span class="btn-cta-text">Sim, quero reconectar com quem sou</span>
    <span class="btn-cta-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path>
      </svg>
    </span>
  </a>
</div>
```

- [ ] **Step 4: Ajustar o mobile**

Aplicar:

```css
@media(max-width:768px){.section-cta{margin-top:32px}.section-cta .btn-cta,.btn-cta-wrap .btn-cta{width:100%}.btn-cta{font-size:10px;letter-spacing:.08em;white-space:normal}.btn-cta-text{padding:14px 16px}}
@media(max-width:480px){.btn-cta{grid-template-columns:minmax(0,1fr) 40px;font-size:9px}.btn-cta-text{padding:13px 12px}.section-cta{margin-top:26px}}
@media(prefers-reduced-motion:reduce){.btn-cta,.btn-cta-icon svg{transition:none}}
```

- [ ] **Step 5: Executar o verificador**

Run: `python scripts/verify-sales-page.py`

Expected: ainda FAIL apenas nas verificações da seção de bônus.

---

### Task 3: Painel editorial de bônus

**Files:**
- Modify: `public/vendas-rc-v3.html:287-326`
- Modify: `public/vendas-rc-v3-vsl.html:291-330`
- Modify: `public/css/styles.css:70-79`
- Modify: `public/css/styles.css:213-223`
- Modify: media queries de bônus em `public/css/styles.css`

**Interfaces:**
- Consumes: os cinco SVGs, títulos, descrições e valores existentes.
- Produces: `.bonus-shell`, `.bonus-list`, `.bonus-row`, `.bonus-row-info`, `.bonus-row-descricao` e `.bonus-item-preco`.

- [ ] **Step 1: Trocar a grade pelo painel editorial nas duas páginas**

Estruturar cada bônus desta forma, repetindo os cinco conteúdos existentes:

```html
<div class="bonus-shell">
  <div class="bonus-header">
    <div><span class="secao-label">5 bônus inclusos</span><h2>Tudo incluído no mesmo valor</h2></div>
    <p>Sem cobranças extras. Sem surpresas.</p>
  </div>
  <div class="bonus-list">
    <article class="bonus-row">
      <div class="bonus-ic"><!-- SVG existente --></div>
      <div class="bonus-row-info"><span class="bonus-item-label">Bônus 01</span><h4>Indicação de livros</h4></div>
      <p class="bonus-row-descricao">Os livros que mais impactaram a jornada da Nath, curados para quem está em processo de reconstrução.</p>
      <span class="bonus-item-preco">R$47</span>
    </article>
  </div>
</div>
```

- [ ] **Step 2: Implementar o CSS editorial**

```css
.bonus-shell{background:var(--preto);border-radius:2px;padding:clamp(32px,5vw,58px);box-shadow:0 30px 70px -45px rgba(0,0,0,.8)}
.bonus-header{display:grid;grid-template-columns:.9fr 1.1fr;gap:48px;align-items:end;text-align:left;margin-bottom:28px;padding-bottom:28px;border-bottom:1px solid rgba(201,168,76,.22)}
.bonus-header h2{color:var(--off-white);margin:0}.bonus-header p{color:var(--on-dark-muted);line-height:1.7}
.bonus-list{display:flex;flex-direction:column}
.bonus-row{display:grid;grid-template-columns:54px minmax(180px,.75fr) minmax(240px,1.6fr) auto;gap:20px;align-items:center;padding:22px 0;border-bottom:1px solid rgba(255,255,255,.09)}
.bonus-row:last-child{border-bottom:0}
.bonus-ic{width:46px;height:46px;margin:0;border-radius:50%;animation:none}
.bonus-item-label{font-size:9px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--ouro)}
.bonus-row-info h4{font-family:var(--font-sec);font-size:15px;color:var(--off-white);line-height:1.35;margin-top:5px}
.bonus-row-descricao{font-size:12px;font-weight:300;color:var(--on-dark-muted);line-height:1.6}
.bonus-item-preco{font-family:var(--font-body);font-size:13px;color:var(--on-dark-faint);text-decoration:line-through;text-decoration-color:var(--ouro);text-decoration-thickness:1.5px;white-space:nowrap}
```

- [ ] **Step 3: Implementar a reorganização mobile**

```css
@media(max-width:768px){.bonus-header{grid-template-columns:1fr;gap:10px}.bonus-row{grid-template-columns:46px minmax(0,1fr) auto;gap:12px}.bonus-row-descricao{grid-column:2/4}.bonus-shell{padding:28px 22px}}
@media(max-width:480px){.bonus-row{padding:18px 0}.bonus-row-info h4{font-size:13px}.bonus-row-descricao{font-size:11px}.bonus-item-preco{font-size:11px}}
```

- [ ] **Step 4: Executar o verificador completo**

Run: `python scripts/verify-sales-page.py`

Expected: PASS para as duas páginas.

---

### Task 4: Revisão visual e regressão

**Files:**
- Verify: `public/vendas-rc-v3.html`
- Verify: `public/vendas-rc-v3-vsl.html`
- Verify: `public/css/styles.css`
- Verify: `public/js/main.js`

**Interfaces:**
- Consumes: servidor estático local em `http://localhost:8000`.
- Produces: confirmação de responsividade e comportamento sem regressões.

- [ ] **Step 1: Verificar desktop nas duas páginas**

Confirmar em largura aproximada de `1440px`: seis CTAs intermediários, alinhamento contextual, bordas retas, setas SVG centradas, painel de bônus completo e ausência de CTA entre `futuro` e `preco`.

- [ ] **Step 2: Verificar mobile nas duas páginas**

Confirmar em largura aproximada de `390px`: botões sem overflow, texto legível, seta com coluna fixa, linhas de bônus sem sobreposição e descrições completas.

- [ ] **Step 3: Verificar interações**

Testar um CTA intermediário para confirmar rolagem até `#preco`; testar FAQ e carrossel para garantir que o JavaScript existente continua operacional.

- [ ] **Step 4: Rodar a validação final**

Run: `python scripts/verify-sales-page.py`

Expected: `PASS: vendas-rc-v3.html` e `PASS: vendas-rc-v3-vsl.html`.

- [ ] **Step 5: Revisar o diff final sem incluir artefatos do companion visual**

Run: `git diff -- public/vendas-rc-v3.html public/vendas-rc-v3-vsl.html public/css/styles.css scripts/verify-sales-page.py`

Expected: apenas mudanças do layout aprovado e preservação das alterações anteriores do usuário na seção de bônus.

---

### Task 5: Refinar preços e unificar ícones dos bônus

**Files:**
- Modify: `scripts/verify-sales-page.py`
- Modify: `public/vendas-rc-v3.html`
- Modify: `public/vendas-rc-v3-vsl.html`
- Modify: `public/css/styles.css`

**Interfaces:**
- Consumes: `.bonus-row`, `.bonus-ic` e `.bonus-item-preco` já implementados.
- Produces: cinco ícones de presente idênticos por página e preços em `15px` no desktop/`13px` no mobile.

- [ ] **Step 1: Fazer o verificador exigir o ícone de presente e os tamanhos aprovados**

Em cada `BonusRow`, registrar o atributo `data-icon` do SVG e exigir:

```python
assert len(result.bonus_rows) == 5
assert all(row.icon == "gift" for row in result.bonus_rows)
assert ".bonus-item-preco{font-family:var(--font-body);font-size:15px" in css
assert ".bonus-item-preco{font-size:13px}" in css
```

- [ ] **Step 2: Executar para confirmar a falha**

Run: `python scripts/verify-sales-page.py`

Expected: FAIL informando que os SVGs atuais não são presentes e que os preços ainda usam `13px`/`11px`.

- [ ] **Step 3: Substituir os dez SVGs por um presente**

Usar exatamente o mesmo SVG nos cinco bônus das duas páginas:

```html
<svg data-icon="gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="8" width="18" height="4"></rect>
  <path d="M5 12v9h14v-9M12 8v13M12 8H7.5a2.5 2.5 0 1 1 0-5C10.5 3 12 8 12 8ZM12 8h4.5a2.5 2.5 0 1 0 0-5C13.5 3 12 8 12 8Z"></path>
</svg>
```

- [ ] **Step 4: Aumentar os preços**

Aplicar:

```css
.bonus-item-preco{font-size:15px}
@media(max-width:480px){.bonus-item-preco{font-size:13px}}
```

- [ ] **Step 5: Executar a verificação final**

Run: `python scripts/verify-sales-page.py`

Expected: PASS para as duas páginas, CSS e JavaScript.
