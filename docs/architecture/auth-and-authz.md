# Autenticação e Autorização — OPFY Board

## Fluxo de autenticação

1. **Cadastro/Login**: e-mail + senha (Argon2id). Rate limit por IP e por e-mail (proteção contra credential stuffing/brute force — ver `security-model.md`).
2. **MFA**: se habilitado (obrigatório para Owner/Admin), desafio TOTP ou WebAuthn/Passkey após validar a senha.
3. **Emissão de tokens**: access token JWT (10–15 min, EdDSA) em cookie `httpOnly/Secure/SameSite=Strict` + refresh token opaco rotativo (hash armazenado em `refresh_tokens`).
4. **Requisições autenticadas**: middleware valida o JWT, extrai `user_id`/`tenant_id`/`role`, e abre a transação de banco com `SET LOCAL app.tenant_id`.
5. **Renovação**: pouco antes de expirar, o frontend chama `/auth/refresh`; o backend valida o refresh token, verifica se já não foi usado (rotation), emite novo par access+refresh e invalida o anterior.
6. **Reuse detectado**: se um refresh token já rotacionado for reapresentado, toda a sessão (e as sessões derivadas dela) é revogada, o usuário é deslogado em todos os dispositivos e um evento de segurança é registrado em `audit_log` + alerta.
7. **Logout**: revoga a sessão (refresh token e todos os seus descendentes) imediatamente.

## WebAuthn/Passkeys

- Oferecido no onboarding e nas configurações de segurança.
- Fluxo padrão WebAuthn (registro de credencial pública, desafio assinado no login).
- Tratado como fator forte suficiente para dispensar TOTP quando presente (mas não dispensa MFA como conceito — a chave de segurança/biometria já é o segundo fator).

## Modelo de autorização (RBAC granular)

Papéis por tenant (`memberships.role`):

| Papel | Descrição |
|---|---|
| `owner` | Controle total do tenant, billing, remoção de membros |
| `admin` | Gestão de usuários e configurações, sem billing |
| `manager` | Acesso de escrita aos módulos de domínio (KPIs, planos de ação, documentos) |
| `member` | Uso do Conselho Executivo e leitura ampla, escrita limitada ao que criou |
| `viewer` | Somente leitura (dashboards e relatórios) |

Permissões são expressas como `(module, action)`, ex.: `board:chat`, `kpi:write`, `billing:manage`, `users:invite`. Cada papel mapeia para um conjunto fixo de permissões (matriz versionada em código, não editável por tenant nesta fase — customização por tenant é um item de roadmap futuro, não do MVP).

- Todo endpoint declara a permissão exigida via decorator (`@RequirePermission('kpi:write')`).
- Guard de autorização roda **depois** do guard de tenant (um usuário sem `membership` ativa no tenant do recurso é rejeitado antes mesmo de avaliar o papel).
- Auditoria: toda ação de escrita relevante (convite, mudança de papel, exclusão, exportação de dados) gera uma linha em `audit_log`.

## Ameaças cobertas por este desenho

- **CSRF**: cookies `SameSite=Strict` + verificação de origem em mutações + token CSRF de dupla submissão em formulários sensíveis.
- **Session hijacking**: cookies `httpOnly`/`Secure`, fingerprint de device armazenado por sessão, TTL curto do access token.
- **Replay attack**: rotation de refresh token com detecção de reuse (acima).
- **Escalonamento de privilégio horizontal** (acessar tenant alheio): guard de tenant + RLS (defesa em profundidade, ADR-0001).
