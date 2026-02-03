import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { adminPrisma } from '@grayskull/admin-database';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async login(email: string, password: string) {
    const user = await adminPrisma.adminUser.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Atualiza último login
    await adminPrisma.adminUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Log de auditoria
    await adminPrisma.auditLog.create({
      data: {
        action: 'LOGIN',
        entity: 'AdminUser',
        entityId: user.id,
        adminUserId: user.id,
      },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async createAdminUser(data: {
    email: string;
    password: string;
    name: string;
    role?: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'SUPPORT';
  }) {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    return adminPrisma.adminUser.create({
      data: {
        ...data,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
  }
}
