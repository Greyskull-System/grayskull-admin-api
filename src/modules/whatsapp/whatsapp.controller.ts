import { Controller, Get, Post, Delete, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';

/**
 * Controller para proxy de requisições WhatsApp.
 * Todas as rotas passam por validação de tenant antes de ir ao microserviço.
 */
@Controller('tenants/:tenantId/whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  // ==================== SESSION ROUTES ====================

  /**
   * Cria uma nova sessão.
   */
  @Post('sessions')
  async createSession(
    @Param('tenantId') tenantId: string,
    @Body() body: { name?: string; branchId: string; provider?: string }
  ) {
    return this.whatsappService.createSession(tenantId, body.name, body.branchId, body.provider);
  }

  /**
   * Lista todas as sessões do tenant.
   */
  @Get('sessions')
  async listSessions(@Param('tenantId') tenantId: string) {
    return this.whatsappService.listSessions(tenantId);
  }

  /**
   * Conecta uma sessão.
   */
  @Post('sessions/:sessionId/connect')
  async connectSession(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: { provider?: string; metadata?: any }
  ) {
    return this.whatsappService.connectSession(tenantId, sessionId, body.provider, body.metadata);
  }

  /**
   * Obtém status de uma sessão.
   */
  @Get('sessions/:sessionId/status')
  async getSessionStatus(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string
  ) {
    return this.whatsappService.getSessionStatus(tenantId, sessionId);
  }

  /**
   * Desconecta (pausa) uma sessão.
   */
  @Post('sessions/:sessionId/disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnectSession(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string
  ) {
    return this.whatsappService.disconnectSession(tenantId, sessionId);
  }

  /**
   * Reconecta uma sessão.
   */
  @Post('sessions/:sessionId/reconnect')
  @HttpCode(HttpStatus.OK)
  async reconnectSession(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string
  ) {
    return this.whatsappService.reconnectSession(tenantId, sessionId);
  }

  /**
   * Remove uma sessão.
   */
  @Delete('sessions/:sessionId')
  async removeSession(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string
  ) {
    return this.whatsappService.removeSession(tenantId, sessionId);
  }

  /**
   * Lista sessões ativas.
   */
  @Get('sessions/active')
  async listActiveSessions(@Param('tenantId') tenantId: string) {
    return this.whatsappService.listActiveSessions(tenantId);
  }

  // ==================== MESSAGE ROUTES ====================

  /**
   * Envia mensagem de texto.
   */
  @Post('sessions/:sessionId/messages')
  async sendMessage(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: { to: string; body: string }
  ) {
    return this.whatsappService.sendMessage(tenantId, sessionId, body.to, body.body);
  }

  /**
   * Lista mensagens de uma sessão.
   */
  @Get('sessions/:sessionId/messages')
  async listMessages(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
    @Query('contactId') contactId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return this.whatsappService.listMessages(
      tenantId, 
      sessionId, 
      contactId, 
      limit ? parseInt(limit) : undefined,
      offset ? parseInt(offset) : undefined
    );
  }

  /**
   * Marca mensagem como lida.
   */
  @Post('sessions/:sessionId/messages/:messageId/read')
  @HttpCode(HttpStatus.OK)
  async markMessageAsRead(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
    @Param('messageId') messageId: string
  ) {
    return this.whatsappService.markMessageAsRead(tenantId, sessionId, messageId);
  }

  /**
   * Deleta uma mensagem.
   */
  @Delete('sessions/:sessionId/messages/:messageId')
  async deleteMessage(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
    @Param('messageId') messageId: string,
    @Query('deleteForEveryone') deleteForEveryone?: string
  ) {
    return this.whatsappService.deleteMessage(tenantId, sessionId, messageId, deleteForEveryone === 'true');
  }

  // ==================== CONTACT ROUTES ====================

  /**
   * Lista contatos de uma sessão.
   */
  @Get('sessions/:sessionId/contacts')
  async listContacts(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return this.whatsappService.listContacts(
      tenantId, 
      sessionId,
      limit ? parseInt(limit) : undefined,
      offset ? parseInt(offset) : undefined
    );
  }

  // ==================== HEALTH ====================

  /**
   * Health check do serviço de WhatsApp.
   */
  @Get('health')
  async healthCheck(@Param('tenantId') tenantId: string) {
    // Valida tenant primeiro
    await this.whatsappService.validateTenantModule(tenantId);
    return this.whatsappService.healthCheck();
  }
}
