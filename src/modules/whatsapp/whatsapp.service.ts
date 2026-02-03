import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { adminPrisma } from '@grayskull/admin-database';

/**
 * Service para validação de permissões e proxy para o grayskull-baileys-service.
 */
@Injectable()
export class WhatsAppService {
  private readonly baileysServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baileysServiceUrl = this.configService.get<string>('BAILEYS_SERVICE_URL') || 'http://localhost:9000';
  }

  /**
   * Valida se o tenant tem o módulo WhatsApp habilitado.
   */
  async validateTenantModule(tenantId: string): Promise<void> {
    // Busca o tenant
    const tenant = await adminPrisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        modules: {
          include: { module: true }
        }
      }
    });

    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado');
    }

    if (tenant.status !== 'ACTIVE' && tenant.status !== 'TRIAL') {
      throw new ForbiddenException('Tenant não está ativo');
    }

    // Verifica se o módulo WhatsApp está habilitado
    const whatsappModule = tenant.modules.find(
      tm => tm.module.code === 'whatsapp' || tm.module.code === 'baileys'
    );

    if (!whatsappModule || !whatsappModule.isEnabled) {
      throw new ForbiddenException('Módulo WhatsApp não está habilitado para este tenant');
    }
  }

  /**
   * Faz proxy de uma requisição para o grayskull-baileys-service.
   */
  async proxyRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    body?: any
  ): Promise<any> {
    const url = `${this.baileysServiceUrl}${path}`;

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      
      // Verifica content-type antes de fazer parse
      const contentType = response.headers.get('content-type') || '';
      
      let data: any;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        // Se não for JSON, tenta parsear ou retorna como mensagem
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`Resposta inesperada do serviço WhatsApp: ${text.substring(0, 100)}`);
        }
      }

      if (!response.ok) {
        if (response.status === 404) {
          throw new NotFoundException(data.message || 'Recurso não encontrado');
        }
        if (response.status === 400) {
          throw new BadRequestException(data.message || 'Requisição inválida');
        }
        throw new Error(data.message || 'Erro no serviço de WhatsApp');
      }

      return data;
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }

      if (error.code === 'ECONNREFUSED') {
        throw new Error('Serviço de WhatsApp indisponível');
      }
      
      // Erro de parsing JSON
      if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
        throw new Error('Serviço de WhatsApp retornou resposta inválida');
      }

      throw error;
    }
  }

  // ==================== SESSION OPERATIONS ====================

  /**
   * Cria uma nova sessão.
   */
  async createSession(tenantId: string, name?: string, branchId?: string, provider?: string): Promise<any> {
    await this.validateTenantModule(tenantId);
    return this.proxyRequest('POST', '/sessions', { name, branchId, provider });
  }

  /**
   * Lista todas as sessões.
   */
  async listSessions(tenantId: string): Promise<any> {
    await this.validateTenantModule(tenantId);
    return this.proxyRequest('GET', '/sessions');
  }

  /**
   * Conecta uma sessão.
   */
  async connectSession(tenantId: string, sessionId: string, provider?: string, metadata?: any): Promise<any> {
    await this.validateTenantModule(tenantId);
    return this.proxyRequest('POST', `/sessions/${sessionId}/connect`, { provider, metadata });
  }

  /**
   * Obtém status de uma sessão.
   */
  async getSessionStatus(tenantId: string, sessionId: string): Promise<any> {
    await this.validateTenantModule(tenantId);
    return this.proxyRequest('GET', `/sessions/${sessionId}/status`);
  }

  /**
   * Desconecta (pausa) uma sessão.
   */
  async disconnectSession(tenantId: string, sessionId: string): Promise<any> {
    await this.validateTenantModule(tenantId);
    return this.proxyRequest('POST', `/sessions/${sessionId}/disconnect`);
  }

  /**
   * Reconecta uma sessão.
   */
  async reconnectSession(tenantId: string, sessionId: string): Promise<any> {
    await this.validateTenantModule(tenantId);
    return this.proxyRequest('POST', `/sessions/${sessionId}/reconnect`);
  }

  /**
   * Remove uma sessão.
   */
  async removeSession(tenantId: string, sessionId: string): Promise<any> {
    await this.validateTenantModule(tenantId);
    return this.proxyRequest('DELETE', `/sessions/${sessionId}`);
  }

  /**
   * Lista sessões ativas.
   */
  async listActiveSessions(tenantId: string): Promise<any> {
    await this.validateTenantModule(tenantId);
    return this.proxyRequest('GET', '/sessions/active');
  }

  // ==================== MESSAGE OPERATIONS ====================

  /**
   * Envia mensagem de texto.
   */
  async sendMessage(tenantId: string, sessionId: string, to: string, body: string): Promise<any> {
    await this.validateTenantModule(tenantId);
    return this.proxyRequest('POST', `/sessions/${sessionId}/messages`, { to, body });
  }

  /**
   * Lista mensagens de uma sessão.
   */
  async listMessages(
    tenantId: string, 
    sessionId: string, 
    contactId?: string,
    limit?: number,
    offset?: number
  ): Promise<any> {
    await this.validateTenantModule(tenantId);
    
    let path = `/sessions/${sessionId}/messages?limit=${limit || 50}&offset=${offset || 0}`;
    if (contactId) {
      path += `&contactId=${contactId}`;
    }
    
    return this.proxyRequest('GET', path);
  }

  /**
   * Marca mensagem como lida.
   */
  async markMessageAsRead(tenantId: string, sessionId: string, messageId: string): Promise<any> {
    await this.validateTenantModule(tenantId);
    return this.proxyRequest('POST', `/sessions/${sessionId}/messages/${messageId}/read`);
  }

  /**
   * Deleta uma mensagem.
   */
  async deleteMessage(tenantId: string, sessionId: string, messageId: string, deleteForEveryone?: boolean): Promise<any> {
    await this.validateTenantModule(tenantId);
    const query = deleteForEveryone ? '?deleteForEveryone=true' : '';
    return this.proxyRequest('DELETE', `/sessions/${sessionId}/messages/${messageId}${query}`);
  }

  // ==================== CONTACT OPERATIONS ====================

  /**
   * Lista contatos de uma sessão.
   */
  async listContacts(tenantId: string, sessionId: string, limit?: number, offset?: number): Promise<any> {
    await this.validateTenantModule(tenantId);
    return this.proxyRequest('GET', `/sessions/${sessionId}/contacts?limit=${limit || 50}&offset=${offset || 0}`);
  }

  // ==================== HEALTH ====================

  /**
   * Verifica saúde do serviço de WhatsApp.
   */
  async healthCheck(): Promise<any> {
    return this.proxyRequest('GET', '/health');
  }
}
