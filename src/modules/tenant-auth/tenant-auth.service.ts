import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Client } from 'pg';
import * as bcrypt from 'bcrypt';
import { TenantService } from '../tenant/tenant.service';
import { ProvisioningService } from '../provisioning/provisioning.service';

export interface TenantLoginDto {
  tenantCode: string;
  email: string;
  password: string;
}

export interface TenantAuthPayload {
  sub: string;       // employeeId
  tenantId: string;
  companyId: string;
  branchId: string;
  roleId: string | null;
  roleName: string;
  roleDescription: string | null;
  email: string;
  name: string;
}

export interface TenantAuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    tenantId: string;
    companyId: string;
    branchId: string;
    roleId: string | null;
    role: {
      id: string;
      name: string;
      description: string | null;
    };
    permissions: string[];
  };
}

@Injectable()
export class TenantAuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly tenantService: TenantService,
    private readonly provisioningService: ProvisioningService,
  ) {}

  /**
   * Autentica um colaborador do tenant no banco do próprio tenant.
   * Usado pelo backend do cliente (gerado ou próprio) para login do frontend.
   */
  async login(dto: TenantLoginDto): Promise<TenantAuthResponse> {
    const { tenantCode, email, password } = dto;

    const tenant = await this.tenantService.findByCode(tenantCode);
    if (!tenant) {
      throw new UnauthorizedException('Tenant ou credenciais inválidos');
    }

    if (!tenant.isProvisioned) {
      throw new BadRequestException('Tenant ainda não foi provisionado');
    }

    if (tenant.status !== 'ACTIVE' && tenant.status !== 'TRIAL') {
      throw new UnauthorizedException('Tenant não está ativo');
    }

    const { connectionString } = await this.provisioningService.getConnectionString(tenant.id);
    const client = new Client({ connectionString });

    try {
      await client.connect();

      const result = await client.query<{
        id: string;
        name: string;
        email: string;
        password: string | null;
        companyId: string;
        branchId: string;
        roleId: string | null;
      }>(
        `SELECT id, name, email, password, "companyId", "branchId", "roleId"
         FROM employees
         WHERE email = $1 AND "hasSystemAccess" = true AND "isActive" = true
         LIMIT 1`,
        [email],
      );

      if (result.rows.length === 0) {
        throw new UnauthorizedException('Tenant ou credenciais inválidos');
      }

      const employee = result.rows[0];
      if (!employee.password) {
        throw new UnauthorizedException('Tenant ou credenciais inválidos');
      }

      const valid = await bcrypt.compare(password, employee.password);
      if (!valid) {
        throw new UnauthorizedException('Tenant ou credenciais inválidos');
      }

      let role: { id: string; name: string; description: string | null } = {
        id: '',
        name: 'Usuário',
        description: null,
      };
      let permissions: string[] = [];
      if (employee.roleId) {
        const roleResult = await client.query<{ id: string; name: string; description: string | null }>(
          `SELECT id, name, description FROM roles WHERE id = $1 LIMIT 1`,
          [employee.roleId],
        );
        if (roleResult.rows.length > 0) {
          const r = roleResult.rows[0];
          role = { id: r.id, name: r.name, description: r.description ?? null };
        }
        const permResult = await client.query<{ code: string }>(
          `SELECT p.code FROM role_permissions rp
           JOIN permissions p ON p.id = rp."permissionId"
           WHERE rp."roleId" = $1`,
          [employee.roleId],
        );
        permissions = permResult.rows.map((row) => row.code);
      }

      const payload: TenantAuthPayload = {
        sub: employee.id,
        tenantId: tenant.id,
        companyId: employee.companyId,
        branchId: employee.branchId,
        roleId: employee.roleId,
        roleName: role.name,
        roleDescription: role.description,
        email: employee.email,
        name: employee.name,
      };

      const accessToken = this.jwtService.sign(payload as object);

      return {
        accessToken,
        user: {
          id: employee.id,
          email: employee.email,
          name: employee.name,
          tenantId: tenant.id,
          companyId: employee.companyId,
          branchId: employee.branchId,
          roleId: employee.roleId,
          role,
          permissions,
        },
      };
    } finally {
      await client.end().catch(() => {});
    }
  }

  /**
   * Retorna o usuário (employee + role + permissions) a partir do token.
   * Usado pelo backend do cliente em GET /auth/me para devolver user com permissões.
   */
  async getMe(accessToken: string): Promise<TenantAuthResponse['user']> {
    const payload = this.jwtService.verify(accessToken) as TenantAuthPayload;
    const { connectionString } = await this.provisioningService.getConnectionString(payload.tenantId);
    const client = new Client({ connectionString });
    try {
      await client.connect();
      const empResult = await client.query<{
        id: string;
        name: string;
        email: string;
        companyId: string;
        branchId: string;
        roleId: string | null;
      }>(
        `SELECT id, name, email, "companyId", "branchId", "roleId"
         FROM employees
         WHERE id = $1 AND "hasSystemAccess" = true AND "isActive" = true
         LIMIT 1`,
        [payload.sub],
      );
      if (empResult.rows.length === 0) {
        throw new UnauthorizedException('Usuário não encontrado ou inativo');
      }
      const employee = empResult.rows[0];
      let role: { id: string; name: string; description: string | null } = {
        id: '',
        name: 'Usuário',
        description: null,
      };
      let permissions: string[] = [];
      if (employee.roleId) {
        const roleResult = await client.query<{ id: string; name: string; description: string | null }>(
          `SELECT id, name, description FROM roles WHERE id = $1 LIMIT 1`,
          [employee.roleId],
        );
        if (roleResult.rows.length > 0) {
          const r = roleResult.rows[0];
          role = { id: r.id, name: r.name, description: r.description ?? null };
        }
        const permResult = await client.query<{ code: string }>(
          `SELECT p.code FROM role_permissions rp
           JOIN permissions p ON p.id = rp."permissionId"
           WHERE rp."roleId" = $1`,
          [employee.roleId],
        );
        permissions = permResult.rows.map((row) => row.code);
      }
      return {
        id: employee.id,
        email: employee.email,
        name: employee.name,
        tenantId: payload.tenantId,
        companyId: employee.companyId,
        branchId: employee.branchId,
        roleId: employee.roleId,
        role,
        permissions,
      };
    } finally {
      await client.end().catch(() => {});
    }
  }
}
