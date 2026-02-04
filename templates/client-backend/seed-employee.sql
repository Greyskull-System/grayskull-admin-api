-- =============================================================================
-- Seed: 1 empresa, 1 filial, 1 perfil, 1 funcionário com acesso ao sistema
-- Execute no banco do tenant (ex: translog_erp) para poder fazer login.
-- Senha do usuário: admin123
-- =============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_branch_id UUID;
  v_role_id UUID;
BEGIN
  -- 1) Empresa
  INSERT INTO companies (id, name, "tradeName", document, email, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid(),
    'Minha Empresa',
    'Empresa',
    '00000000000191',
    'contato@empresa.com',
    now(),
    now()
  )
  ON CONFLICT (document) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_company_id;

  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id FROM companies WHERE document = '00000000000191' LIMIT 1;
  END IF;

  -- 2) Filial
  INSERT INTO branches (id, name, code, "companyId", "isActive", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid(),
    'Matriz',
    'MATRIZ',
    v_company_id,
    true,
    now(),
    now()
  )
  ON CONFLICT ("companyId", code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_branch_id;

  IF v_branch_id IS NULL THEN
    SELECT id INTO v_branch_id FROM branches WHERE "companyId" = v_company_id AND code = 'MATRIZ' LIMIT 1;
  END IF;

  -- 3) Perfil (role) - precisa existir pelo menos 1 permissão; criamos role sem permissões se não houver
  INSERT INTO roles (id, name, "companyId", "isActive", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid(),
    'Administrador',
    v_company_id,
    true,
    now(),
    now()
  )
  ON CONFLICT ("companyId", name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_role_id;

  IF v_role_id IS NULL THEN
    SELECT id INTO v_role_id FROM roles WHERE "companyId" = v_company_id AND name = 'Administrador' LIMIT 1;
  END IF;

  -- 4) Funcionário com acesso ao sistema (senha: admin123)
  INSERT INTO employees (
    id,
    name,
    email,
    cpf,
    "companyId",
    "branchId",
    "roleId",
    "hasSystemAccess",
    password,
    "isActive",
    "hireDate",
    "createdAt",
    "updatedAt"
  ) VALUES (
    gen_random_uuid(),
    'Administrador',
    'admin@empresa.com',
    '12345678901',
    v_company_id,
    v_branch_id,
    v_role_id,
    true,
    '$2b$10$gdMmgZm2cTKG65iYfd8fQOY7hLUeoJ6SngjnTZStd9ZVdKAWSEAsm',
    true,
    now(),
    now(),
    now()
  )
  ON CONFLICT ("companyId", email) DO UPDATE SET
    "hasSystemAccess" = true,
    password = EXCLUDED.password,
    "roleId" = EXCLUDED."roleId";
END $$;

-- Credenciais para login no backend do cliente:
-- Email: admin@empresa.com
-- Senha: admin123

-- =============================================================================
-- OPÇÃO B: Só inserir employee (se empresa/filial/perfil já existem)
-- Substitua os UUIDs abaixo pelos IDs reais do seu banco.
-- =============================================================================
/*
INSERT INTO employees (
  id, name, email, cpf, "companyId", "branchId", "roleId",
  "hasSystemAccess", password, "isActive", "hireDate", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(),
  'Administrador',
  'admin@empresa.com',
  '12345678901',
  'COLE_AQUI_ID_DA_COMPANY'::uuid,
  'COLE_AQUI_ID_DA_BRANCH'::uuid,
  'COLE_AQUI_ID_DO_ROLE'::uuid,
  true,
  '$2b$10$gdMmgZm2cTKG65iYfd8fQOY7hLUeoJ6SngjnTZStd9ZVdKAWSEAsm',
  true,
  now(),
  now(),
  now()
)
ON CONFLICT ("companyId", email) DO UPDATE SET
  "hasSystemAccess" = true,
  password = EXCLUDED.password,
  "roleId" = EXCLUDED."roleId";
*/
