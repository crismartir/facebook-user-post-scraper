# Modelo de Segurança — OPFY Board

Security by Design / Secure by Default: toda decisão abaixo é o padrão do sistema, não uma opção a ser ativada.

## Identidade e sessão
- Senhas: Argon2id, nunca reversível, nunca logado.
- MFA obrigatório para Owner/Admin (TOTP piso mínimo, WebAuthn/Passkeys preferencial).
- JWT de acesso curto + refresh rotativo com detecção de reuse (ADR-0005).
- Sessões revogáveis pelo usuário; revogação em cascata em caso de comprometimento.

## Proteções de aplicação web
- **CSRF**: `SameSite=Strict` + verificação de origem + token de dupla submissão em mutações sensíveis.
- **XSS**: sanitização de entrada, escaping padrão do React/Next.js, `Content-Security-Policy` restritiva (sem `unsafe-inline` em produção; nonces para scripts necessários).
- **Clickjacking**: `X-Frame-Options: DENY` / `frame-ancestors 'none'` no CSP.
- **SQL Injection**: ORM parametrizado (Prisma) — nenhuma concatenação de SQL; RLS como segunda barreira.
- **SSRF**: o `voice-os-adapter` e qualquer integração externa usam allowlist de hosts de destino; nenhum endpoint da aplicação aceita URL arbitrária para fetch server-side sem validação estrita.

## Contra abuso e automação
- **Rate limiting**: por IP e por conta, em login, refresh, e endpoints de custo alto (chamadas ao Voice OS).
- **Brute force / credential stuffing**: backoff progressivo + bloqueio temporário + CAPTCHA após N tentativas + detecção de padrão distribuído (mesmo e-mail, IPs variados).
- **Replay attack**: nonces/rotation em tokens (ADR-0005); timestamps assinados em webhooks recebidos (ex.: gateway de pagamento).

## Dados em trânsito e em repouso
- TLS 1.2+ (preferencialmente 1.3) em toda borda pública, gerido automaticamente pelo Caddy.
- Campos sensíveis (ex.: segredo de MFA) cifrados em repouso com AES-256, chave fora do banco (variável de ambiente/vault do VPS, nunca no código-fonte ou no repositório).
- Segredos de aplicação (JWT signing key, credenciais de banco, chave de storage) exclusivamente via variáveis de ambiente injetadas no deploy — nunca commitados.

## Auditoria e integridade
- `audit_log` append-only (sem UPDATE/DELETE em nível de permissão de banco para o usuário de aplicação).
- Toda ação sensível (login, MFA alterado, convite, mudança de papel, exportação/exclusão de dados, acesso a documento) é auditada com ator, IP, timestamp.
- Logs estruturados correlacionáveis por `trace_id`/`tenant_id` (ver `observability-strategy.md`), sem PII desnecessária em texto livre.

## LGPD / Privacy by Design
- Coleta mínima (apenas dados necessários ao funcionamento do produto).
- Base legal e finalidade documentadas por categoria de dado.
- Direito de acesso/portabilidade: exportação dos dados do tenant sob demanda.
- Direito ao esquecimento: fluxo de exclusão com expurgo real após retenção mínima legal/contratual, incluindo expurgo correspondente no Voice OS via a porta de integração.
- Dados de um tenant nunca usados para treinar/ajustar modelos que sirvam outro tenant — responsabilidade contratual a formalizar com o time do Voice OS (fora do escopo de código do OPFY Board, mas é um requisito de integração a validar no ADR-0004).

## Operação e infraestrutura
- Backups cifrados (ver `backup-strategy.md`).
- Health checks e readiness probes em todo container.
- Compatibilidade com WAF de borda (Cloudflare ou equivalente) como camada adicional opcional, sem dependência rígida — a aplicação já é segura sem ele.
- Princípio do menor privilégio: usuário de banco da aplicação sem permissão de DDL em produção; migrações rodam com um usuário separado, só durante o deploy.
