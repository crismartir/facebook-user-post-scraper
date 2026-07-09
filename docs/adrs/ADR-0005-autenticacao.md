# ADR-0005 — Autenticação: JWT curto + refresh rotativo + WebAuthn

- **Status**: Aceito
- **Contexto**: RFC-0001, seção 7; detalhado em `docs/architecture/auth-and-authz.md`

## Decisão

- Senha com hash **Argon2id** (parâmetros: memória 19 MiB, iterações 2, paralelismo 1 — ajustável por benchmark no VPS de produção).
- **MFA obrigatório** para papéis Owner/Admin; opcional (mas incentivado) para os demais. TOTP como piso mínimo; **WebAuthn/Passkeys** como método preferencial, oferecido no onboarding.
- **Access token JWT de vida curta** (10–15 min), assinado com chave assimétrica (EdDSA/ES256), transportado em cookie `httpOnly; Secure; SameSite=Strict`.
- **Refresh token rotativo**: opaco, armazenado com hash (não em claro) na tabela `refresh_tokens`, vinculado a `user_id` + `session_id` + fingerprint do device. A cada uso, o token antigo é invalidado e um novo é emitido (rotation). Reuse de um refresh token já invalidado é tratado como indício de roubo de token: toda a cadeia de sessão é revogada e o usuário é notificado.
- Sessões visíveis e revogáveis pelo próprio usuário ("dispositivos conectados").

## Alternativas consideradas

- **JWT de longa duração sem refresh**: rejeitado — impossibilita revogação imediata (ex.: usuário removido do tenant continuaria com acesso até o token expirar).
- **Sessão stateful pura (server-side session store) sem JWT**: rejeitado como único mecanismo — dificulta o objetivo de stateless horizontal scaling (ADR de escalabilidade); usado apenas como registro de auditoria/controle de revogação, não como mecanismo primário de autorização por requisição.

## Consequências

- Positivo: janela de exposição de um access token vazado é pequena (minutos); refresh rotativo com detecção de reuse limita o dano de um refresh token vazado.
- Positivo: compatível com múltiplas réplicas do backend (nenhuma sessão fixada em memória de processo).
- Negativo: exige tabela de refresh tokens com limpeza periódica (job de expurgo) e lógica de revogação em cascata — custo de implementação assumido conscientemente em troca de segurança.
