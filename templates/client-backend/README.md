# Backend do Cliente (Modulys Pax)

Backend mínimo que autentica usuários via Modulys Pax (tenant-auth) e faz proxy para os serviços Core e Chat.

## Configuração

1. Copie `.env.example` para `.env`
2. Preencha:
   - `MODULYS_PAX_ADMIN_API_URL`: URL da API Admin (ex: https://admin.seudominio.com/api/admin)
   - `MODULYS_PAX_TENANT_CODE`: Código do tenant (ex: translog)
   - `MODULYS_PAX_JWT_SECRET`: Mesmo JWT_SECRET da Admin API (para validar tokens)
   - `CORE_SERVICE_URL`: URL do Core Service (ex: http://localhost:3001)
   - `CHAT_SERVICE_URL`: URL do Chat Service (ex: http://localhost:3002)

## Endpoints

- `POST /auth/login` – body: `{ email, password }` – chama tenant-auth e retorna `{ accessToken, user }`
- `GET /auth/me` – Bearer token – retorna usuário do token
- `GET/POST /api/core/*` – proxy para Core Service com `x-tenant-id` (ex: `/api/core/companies`, `/api/core/employees`)
- `GET/POST /api/chat/*` – proxy para Chat Service com `x-tenant-id` (ex: `/api/chat/channels`)

## Frontend

O frontend deve apontar para este backend (ex: `NEXT_PUBLIC_API_URL=http://localhost:4000`) e usar `/auth/login` e enviar o token em `Authorization: Bearer <token>` nas requisições para `/api/core/*` e `/api/chat/*`.
