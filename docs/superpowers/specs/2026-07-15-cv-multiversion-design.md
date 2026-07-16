# CV Multi-Versão — Design

**Data:** 2026-07-15
**Repositório:** `resume-pt` (conteúdo antigo será substituído; histórico git preservado)
**Status:** aprovado pelo usuário no brainstorming

## Objetivo

Substituir o pipeline antigo (YAML → Jinja → PDF) por um sistema de CV moderno com:

- **Fonte de dados única** (`content/resume.yaml`) — bilíngue (EN/PT) e multi-perfil (`data` | `software`)
- **Dois sites estáticos** com identidade visual própria, hospedados na Cloudflare:
  - `data.italoguimaraes.dev` — CV de Engenharia de Dados (acento **verde-limão** `#ccff00`)
  - `software.italoguimaraes.dev` — CV de Engenharia de Software (acento **ciano** `#22d3ee`)
- **Toggle EN/PT** em cada site (rotas estáticas `/en` e `/pt`)
- **4 PDFs** gerados no build (2 perfis × 2 idiomas), ATS-friendly
- LinkedIn é atualizado **manualmente** usando o `resume.yaml` como referência (API do LinkedIn não permite sync programático para apps pessoais)

O repo `italovinicius18.github.io` fica intocado.

## Identidade visual (decidida via mockups no visual companion)

**Brutalista dark** ("I — Brutalista dominante" nos mockups, persistidos em `.superpowers/brainstorm/`):

- Fundo quase-preto (`#0a0a0e`), conteúdo dentro de **moldura com borda 2px e sombra dura gigante** na cor de acento
- Tipografia display pesada (peso 900, uppercase, letter-spacing negativo) para títulos; **monospace** para metadados (datas, locais, `[EN|PT]`, paths)
- Blocos e métricas em **grid com bordas grossas** internas
- **Marquee animado** de skills no topo e rodapé da moldura, na cor de acento
- Tags/badges com fundo de acento, ocasionalmente rotacionadas (-1.2°)
- Animações discretas de entrada no scroll; marquee pausável; tudo respeita `prefers-reduced-motion`
- Mesma identidade nos dois sites; **só a cor de acento muda** (limão ↔ ciano)

## Arquitetura

**Stack:** Astro (site estático), TypeScript, Zod (validação), Playwright (PDF no CI), pnpm, GitHub Actions, Cloudflare Workers com static assets.

**Um codebase, dois builds:** `PROFILE=data|software` (env no build) seleciona filtro de conteúdo e tema CSS.

### Estrutura do repositório

```
resume-pt/
├── content/
│   └── resume.yaml            # FONTE DA VERDADE (já escrito; ver seção Modelo de dados)
├── src/
│   ├── pages/
│   │   ├── index.astro        # fallback de redirecionamento p/ idioma
│   │   ├── pt.astro           # página PT
│   │   ├── en.astro           # página EN
│   │   └── print/
│   │       ├── pt.astro       # layout de impressão PT (para PDF)
│   │       └── en.astro       # layout de impressão EN (para PDF)
│   ├── components/            # Hero, Marquee, Experience, Research, Stack,
│   │                          # Certifications, Projects, Education, Contact, Nav
│   ├── styles/
│   │   ├── tokens.css         # identidade compartilhada (cores base, sombras, bordas, tipografia)
│   │   └── themes/
│   │       ├── data.css       # --accent: #ccff00 (+ tons derivados)
│   │       └── software.css   # --accent: #22d3ee (+ tons derivados)
│   └── lib/
│       ├── schema.ts          # schema Zod do resume.yaml
│       └── resume.ts          # load + filtro por perfil/idioma + helpers (datas, "atual")
├── scripts/
│   ├── generate-pdf.mjs       # Playwright: renderiza /print/{en,pt} e salva PDFs
│   └── smoke-check.mjs        # valida páginas geradas no dist/
├── public/pdf/                # PDFs gerados no CI (não commitados; artefato do build)
├── docs/superpowers/specs/    # este documento
├── .github/workflows/deploy.yml
├── astro.config.mjs
├── wrangler.data.jsonc        # config Worker cv-data
└── wrangler.software.jsonc    # config Worker cv-software
```

### Limpeza do repo (primeiro passo da implementação)

- **Remover:** `src/` antigo (Python/Jinja), `Pipfile`, `requirements.txt`, `index.html`, `dist/`, workflow `generate_files.yml`, `resume.yaml` da raiz (substituído por `content/resume.yaml` no novo formato)
- **Manter:** histórico git, `LICENSE`; `README.md` será reescrito

## Modelo de dados (`content/resume.yaml`)

Conteúdo completo **já fornecido pelo usuário e commitado em `content/resume.yaml`** junto com este spec — a implementação consome esse arquivo como está.

### Convenções do schema

- **Texto bilíngue:** objeto `{ en, pt }`. Campos invariantes (nomes de empresas, e-mail, tech tags) são strings simples.
- **`profiles: [data, software]`**: em qualquer item (experiência, highlight, skill, projeto, certificação, research, idioma). **Ausente = aparece nos dois perfis.**
- **`role` por perfil:** experiências têm `role.data` e/ou `role.software` — o título do cargo muda conforme o CV.
- **`end: null` = vínculo atual.** Nubank e Ministério da Saúde são ambos atuais (confirmado pelo usuário) — os dois exibem "atual"/"present".
- **`clients`** (usado na A3Data): sub-engajamentos com `name`, `duration {en,pt}` e `highlights` próprios, renderizados como sub-cards da experiência.
- **Certificações com `priority`:** `high`/`medium` visíveis por padrão; `low` dentro de colapsável "ver todas". Filtro por `profiles` se aplica antes.
- **Skills com `category` e `level`:** agrupadas por categoria na seção Stack; `level` (basic/intermediate/advanced/expert) exibido visualmente.
- **Ordem no YAML = ordem de exibição.** Sem ordenação automática.
- **Seções:** `basics`, `experience`, `research`, `education`, `certifications`, `skills`, `projects`, `languages`.

### Validação

`pnpm check` roda o schema Zod (`src/lib/schema.ts`) sobre o YAML:

- Campo obrigatório faltando, idioma esquecido (`en` sem `pt` ou vice-versa), perfil inválido, `priority`/`level`/`category` fora do enum, data malformada (`YYYY-MM` ou `YYYY`) → **erro com caminho do campo** (ex.: `experience[2].highlights[1].text.pt missing`)
- Roda localmente e como primeiro passo do CI (falha o build)

## Páginas e seções

Cada site é **one-page**, seções numeradas na navegação (01–07):

| # | Seção | Conteúdo | Observações por perfil |
|---|---|---|---|
| 01 | Hero | Nome gigante, headline do perfil, tag rotacionada, grid de métricas (anos de experiência, nº de certificações, papers aceitos), badges "atual" | Métricas calculadas do YAML em build time |
| 02 | Experiência | Timeline em blocos de borda grossa; datas/locais em monospace | A3Data expande `clients` como sub-cards (só perfil data); highlights filtrados por perfil |
| 03 | Pesquisa | Research + papers (CLOSER 2026, SEMISH/CSBC 2026) | Só aparece no perfil data (`profiles: [data]`); a seção some se vazia |
| 04 | Stack | Skills agrupadas por `category`, nível visual | Filtrado por perfil |
| 05 | Certificações | `high`+`medium` em destaque; `low` em colapsável | Filtrado por perfil |
| 06 | Projetos | Cards com tech tags + link GitHub | Filtrado por perfil |
| 07 | Formação + Idiomas + Contato | Mestrado PPCA em destaque; e-mail, LinkedIn, GitHub, telefone; botão "Baixar CV (PDF)" | PDF do perfil+idioma correspondente |

**Regra geral:** qualquer seção sem itens após o filtro de perfil é omitida.

**Navegação:** header fino fixo — âncoras numeradas, toggle `[EN|PT]` (preserva posição de scroll via âncora), link cruzado "ver versão software ↗" / "see data version ↗".

**Idiomas e rotas:**

- `/pt` e `/en` — páginas completas estáticas
- `/` — redireciona conforme `Accept-Language` (regra no Worker; fallback `/pt`)
- `hreflang` + canonical em ambas; `og:image` própria por perfil (estática, gerada uma vez com a identidade)

**Acessibilidade/performance:** contraste AA sobre o dark (limão/ciano sobre `#0a0a0e` passam), `prefers-reduced-motion` desativa marquee e animações, HTML semântico (uma `<h1>`, seções com `aria-label`), zero JS de framework no cliente — só vanilla para marquee/toggle/scroll-reveal.

## PDF

- Rotas `/print/en` e `/print/pt`: layout **claro, sóbrio, 2 páginas A4**, tipografia limpa, sem elementos decorativos — otimizado para ATS (texto real, sem imagens de fundo, hierarquia simples)
- Conteúdo: mesmos dados filtrados do perfil; certificações `low` ficam de fora do PDF
- CI: `scripts/generate-pdf.mjs` sobe preview do build, renderiza as duas rotas com Playwright (Chromium) e salva `public/pdf/cv-italo-guimaraes-{profile}-{en|pt}.pdf` antes do deploy
- Botão "Baixar CV" aponta para o PDF do perfil+idioma da página

## Deploy (Cloudflare)

- **2 Workers com static assets** (modelo recomendado atual da Cloudflare):
  - `cv-data` → `data.italoguimaraes.dev` (`wrangler.data.jsonc`)
  - `cv-software` → `software.italoguimaraes.dev` (`wrangler.software.jsonc`)
- Worker minimalista: serve assets + redireciona `/` por `Accept-Language`
- **DNS:** `italoguimaraes.dev` já está na Cloudflare; vincular custom domain ao Worker cria os registros automaticamente (setup único, guiado)
- **Secrets no GitHub:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

### CI (`.github/workflows/deploy.yml`), a cada push na `main`:

1. `pnpm check` — validação Zod do YAML
2. Build `PROFILE=data` e `PROFILE=software`
3. Playwright gera os 4 PDFs e os injeta nos respectivos `dist/`
4. `scripts/smoke-check.mjs` — confere nas 4 páginas geradas: nome presente, seção de experiência renderizada, link de PDF existente e apontando para arquivo real
5. `wrangler deploy` ×2

**Rollback:** versões anteriores do Worker disponíveis no painel da Cloudflare.

## Fluxo de atualização (dia a dia)

```
editar content/resume.yaml → git push → CI valida, builda, gera PDFs, deploya os 2 sites
                                   ↘ (manual, quando quiser) atualizar LinkedIn usando o YAML como referência
```

## Testes

- **Validação de dados:** schema Zod (build + local)
- **Smoke pós-build:** 4 páginas × (nome, experiência, link PDF)
- **Unit (Vitest):** `src/lib/resume.ts` — filtro por perfil (incl. ausência de `profiles` = ambos), seleção de idioma, formatação de datas/"atual", cálculo das métricas do hero
- **Visual/manual:** conferência das duas identidades antes do primeiro deploy

## Fora de escopo

- Sync automático com LinkedIn (inviável via API pessoal)
- Aposentar/redirecionar `italovinicius18.github.io` (decisão futura)
- Analytics (pode ser adicionado depois via Cloudflare Web Analytics)
- Terceiro perfil (o schema já suporta — basta novo valor em `profiles`, tema e Worker)
