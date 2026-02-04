import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join, relative } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import * as archiver from 'archiver';
import { Readable } from 'stream';
import { TenantService } from '../tenant/tenant.service';
import { TemplatesService } from '../templates/templates.service';

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', '.turbo', 'coverage', '.cache']);
const SKIP_FILES = new Set(['.env', '.env.local', '.env*.local']);
const TEXT_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.md', '.html', '.yml', '.yaml']);

/** Substituições para projeto gerado: companyId vindo do auth (sem valor fixo). */
const COMPANY_CONSTANTS_CONTENT = `/**
 * Projeto gerado pelo Modulys Pax - companyId vem do contexto de autenticação.
 * Use useCompanyId() dentro de componentes.
 */
import { useAuth } from '@/lib/auth/auth-context';

export const DEFAULT_COMPANY_ID = '';

export function useCompanyId(): string {
  const auth = useAuth();
  return auth?.user?.companyId ?? '';
}
`;

@Injectable()
export class ProjectGeneratorService {
  constructor(
    private readonly configService: ConfigService,
    private readonly tenantService: TenantService,
    private readonly templatesService: TemplatesService,
  ) {}

  /**
   * Gera um ZIP com frontend (template) + backend do cliente (login + proxy Core/Chat).
   */
  async generateZip(tenantId: string, templateId: string): Promise<{ stream: Readable; filename: string }> {
    const tenant = await this.tenantService.findById(tenantId);
    const template = await this.templatesService.findById(templateId);

    const basePath = this.configService.get<string>('TEMPLATES_BASE_PATH');
    if (!basePath || !existsSync(basePath)) {
      throw new BadRequestException(
        'TEMPLATES_BASE_PATH não configurado ou diretório inexistente. Configure a variável de ambiente.',
      );
    }

    const frontendSourcePath = template.sourcePath
      ? join(basePath, template.sourcePath)
      : join(basePath, template.code);

    if (!existsSync(frontendSourcePath) || !statSync(frontendSourcePath).isDirectory()) {
      throw new NotFoundException(
        `Template source não encontrado: ${frontendSourcePath}. Verifique TEMPLATES_BASE_PATH e sourcePath do template.`,
      );
    }

    const workDir = join(tmpdir(), `modulys-pax-gen-${randomUUID()}`);
    mkdirSync(workDir, { recursive: true });
    const frontendDir = join(workDir, 'frontend');
    mkdirSync(frontendDir, { recursive: true });

    try {
      this.copyDir(frontendSourcePath, frontendDir);
      this.applyTransformations(frontendDir);

      const clientBackendPath = this.getClientBackendTemplatePath();
      if (existsSync(clientBackendPath) && statSync(clientBackendPath).isDirectory()) {
        const backendDir = join(workDir, 'backend');
        mkdirSync(backendDir, { recursive: true });
        this.copyDir(clientBackendPath, backendDir);
        this.applyBackendReplacements(backendDir, tenant.code);
      }

      const filename = `project-${tenant.code}-${template.code}-${Date.now()}.zip`;
      const stream = this.createZipStream(workDir, filename);
      return { stream, filename };
    } catch (err) {
      throw new BadRequestException(
        `Erro ao gerar projeto: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private getClientBackendTemplatePath(): string {
    const customPath = this.configService.get<string>('CLIENT_BACKEND_TEMPLATE_PATH');
    if (customPath && existsSync(customPath)) return customPath;
    return join(process.cwd(), 'templates', 'client-backend');
  }

  private applyBackendReplacements(dir: string, tenantCode: string): void {
    this.walkAndReplace(dir, dir, (content) => content.replace(/__TENANT_CODE__/g, tenantCode));
  }

  private copyDir(src: string, dest: string): void {
    mkdirSync(dest, { recursive: true });
    const entries = readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        this.copyDir(srcPath, destPath);
      } else {
        if (SKIP_FILES.has(entry.name)) continue;
        const content = readFileSync(srcPath, 'utf8');
        writeFileSync(destPath, content, 'utf8');
      }
    }
  }

  private applyTransformations(dir: string): void {
    const companyConstantsPath = join(dir, 'lib', 'constants', 'company.constants.ts');
    if (existsSync(companyConstantsPath)) {
      writeFileSync(companyConstantsPath, COMPANY_CONSTANTS_CONTENT, 'utf8');
    }

    this.walkAndReplace(dir, dir, (content, ext) => {
      if (!TEXT_EXT.has(ext)) return content;
      if (!content.includes('DEFAULT_COMPANY_ID')) return content;
      return content
        .replace(/\bDEFAULT_COMPANY_ID\b/g, 'useCompanyId()')
        .replace(
          /import\s*\{\s*DEFAULT_COMPANY_ID\s*\}\s*from\s*['"]@\/lib\/constants\/company\.constants['"];?\s*\n?/g,
          'import { useCompanyId } from \'@/lib/constants/company.constants\';\n',
        );
    });
  }

  private walkAndReplace(
    root: string,
    current: string,
    replace: (content: string, ext?: string) => string,
  ): void {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        this.walkAndReplace(root, fullPath, replace);
      } else {
        const ext = entry.name.includes('.') ? '.' + entry.name.split('.').pop()! : '';
        if (!TEXT_EXT.has(ext)) continue;
        try {
          const content = readFileSync(fullPath, 'utf8');
          const next = replace(content, ext);
          if (next !== content) writeFileSync(fullPath, next, 'utf8');
        } catch {
          // ignore binary or invalid utf-8
        }
      }
    }
  }

  private createZipStream(workDir: string, _filename: string): Readable {
    const archive = archiver.create('zip', { zlib: { level: 9 } });
    this.appendDirToArchive(archive, workDir, '');
    archive.finalize();
    return archive as unknown as Readable;
  }

  private appendDirToArchive(archive: archiver.Archiver, dir: string, prefix: string): void {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        this.appendDirToArchive(archive, fullPath, entryPath);
      } else {
        if (SKIP_FILES.has(entry.name)) continue;
        archive.file(fullPath, { name: entryPath });
      }
    }
  }
}
