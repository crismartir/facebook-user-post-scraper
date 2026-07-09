# ADR-0004 — Integração com o Voice OS via Ports & Adapters

- **Status**: Aceito, **contrato pendente de validação** (ver riscos abertos na RFC-0001, seção 17)
- **Contexto**: RFC-0001, seção 6

## Contexto

A diretriz do produto é taxativa: "nunca criar outro runtime", "nunca duplicar memória", "nunca criar outro GraphRAG", "todos os especialistas devem compartilhar contexto através do sistema existente" (Voice OS). Esta sessão não teve acesso ao repositório do Voice OS para inspecionar sua API real.

## Decisão

Isolar toda a comunicação com o Voice OS atrás de uma única interface de aplicação, `VoiceOSPort` (RFC-0001, seção 6), implementada por um adapter de infraestrutura (`VoiceOSHttpAdapter` ou `VoiceOSGrpcAdapter`, a definir quando o contrato real for confirmado). Nenhum módulo de domínio do OPFY Board chama o Voice OS diretamente — todos passam pela porta.

O OPFY Board:
- **Não** implementa modelo de linguagem, orquestração de agentes, memória de longo prazo, embeddings ou grafo de conhecimento.
- **Persiste apenas metadados de produto**: qual especialista foi acionado, quando, por quem, e a resposta recebida (para exibir histórico e para auditoria) — não a representação interna de memória/RAG do Voice OS.
- Trata falhas do Voice OS como falhas de dependência externa: timeout curto, retry com backoff, circuit breaker, fallback visual no dashboard ("especialista indisponível no momento") — nunca bloqueia o restante do produto.

## Consequências

- Positivo: quando o contrato real do Voice OS for confirmado, apenas o adapter muda — nenhuma regra de negócio do `board` module precisa ser reescrita.
- Positivo: elimina o risco de "arquitetura paralela" citado como proibição explícita do produto.
- Negativo/risco: até a validação do contrato real, a interface `VoiceOSPort` é uma hipótese de trabalho. **Ação obrigatória antes da Fase 2 do roadmap**: revisar este ADR com acesso ao código/documentação real do Voice OS (repositórios `OPFY-AI` e/ou `opfy-ai-codex`, a confirmar) e ajustar a assinatura da porta conforme necessário — sem alterar a regra de nunca acoplar módulos de domínio diretamente à infraestrutura de IA.
