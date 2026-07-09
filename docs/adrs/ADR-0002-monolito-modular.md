# ADR-0002 — Monólito modular em vez de microsserviços nas fases iniciais

- **Status**: Aceito
- **Contexto**: RFC-0001, seções 3-4

## Contexto

O material de referência de arquitetura (fundamentos de software) descreve três estilos principais: monolítico, microsserviços e serverless, cada um com vantagens/desvantagens e "caso de uso" próprio. O prompt do produto exige: menor custo, menor complexidade operacional, alta escalabilidade para milhares de empresas, e reaproveitamento máximo da infraestrutura existente (VPS único).

## Decisão

Adotar um **monólito modular** (módulos com fronteiras de domínio claras, comunicação interna via interfaces de aplicação, nunca acesso direto a repositório de outro módulo) como estilo do backend nas Fases 0–5 do roadmap, com workers assíncronos (BullMQ) para tudo que não precisa de resposta síncrona.

Cada módulo é desenhado como se pudesse ser extraído para um serviço próprio (fronteiras de domínio + comunicação só por interfaces), mas **não extraímos preventivamente**: microsserviços resolvem um problema de escala de time e de deploy independente que o OPFY Board não tem hoje.

## Alternativas consideradas

- **Microsserviços desde o início**: rejeitado. Exigiria orquestração (Kubernetes ou similar), mais serviços pagos, mais complexidade de observabilidade distribuída e maturidade de DevOps que contraria o princípio de "menor custo e menor complexidade" do produto nesta fase.
- **Serverless (functions)**: rejeitado como padrão principal — cold starts são inadequados para chat com os especialistas de IA (latência perceptível), e o modelo de custo por invocação é pior que um VPS fixo para uma carga previsível e contínua (SaaS B2B com uso diário). Mantido como opção pontual para jobs esporádicos e leves no futuro (ex.: processamento de webhook de billing), não como arquitetura principal.

## Consequências

- Positivo: um único deploy, uma única esteira de CI/CD, custo previsível (um VPS), depuração mais simples (sem tracing distribuído obrigatório desde o dia 1).
- Positivo: caminho de extração para microsserviços existe e é barato **se e quando** a escala ou o time exigirem (ex.: extrair `voice-os-adapter` como serviço próprio se o volume de chamadas de IA justificar scaling independente).
- Negativo: um bug ou pico de carga em um módulo pode, em tese, afetar os demais dentro do mesmo processo — mitigado com: workers separados do processo web (containers distintos), limites de memória/CPU por container no Compose, e filas para isolar picos de carga de IA do caminho crítico do dashboard.
