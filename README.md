# CV — italoguimaraes.dev

Fonte única de dados → dois CVs bilíngues:

| Site | Perfil | Acento |
| --- | --- | --- |
| [data.italoguimaraes.dev](https://data.italoguimaraes.dev) | Engenharia de Dados | verde-limão |
| [software.italoguimaraes.dev](https://software.italoguimaraes.dev) | Engenharia de Software | ciano |

## Como atualizar o CV

1. Edite **`content/resume.yaml`** (única fonte da verdade — EN e PT lado a lado,
   `profiles: [data, software]` controla onde cada item aparece).
2. `pnpm check` para validar.
3. `git push` na `main` — o CI valida, builda os dois sites, gera os 4 PDFs e deploya.
4. (Manual) Atualize o LinkedIn usando o YAML como referência.

## Desenvolvimento

    pnpm install
    PROFILE=data pnpm dev        # ou PROFILE=software
    pnpm test                    # unit tests da lib de dados
    pnpm check                   # valida o resume.yaml

## Pipeline

`pnpm check` → `pnpm test` → build ×2 → PDFs (Playwright) → smoke-check → `wrangler deploy` ×2

Specs e planos em `docs/superpowers/`.
