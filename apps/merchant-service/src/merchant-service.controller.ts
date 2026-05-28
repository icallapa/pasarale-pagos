import { Controller, Get, Post, Put, Body, UseGuards, Request } from '@nestjs/common';
import { ApiKeyGuard } from '@app/common';
import { MerchantServiceService, RegisterMerchantDto } from './merchant-service.service';

@Controller('v1/merchants')
export class MerchantServiceController {
  constructor(private readonly merchantService: MerchantServiceService) {}

  /**
   * Endpoint público para registro/onboarding de comercios (Fase 2)
   * POST /v1/merchants
   */
  @Post()
  async register(@Body() dto: RegisterMerchantDto) {
    return this.merchantService.register(dto);
  }

  /**
   * Endpoint privado para obtener el perfil del comercio autenticado
   * GET /v1/merchants/me
   */
  @UseGuards(ApiKeyGuard)
  @Get('me')
  async getProfile(@Request() req: any) {
    // req.merchantId es inyectado por el ApiKeyGuard al verificar la clave
    return this.merchantService.getProfile(req.merchantId);
  }

  /**
   * Endpoint privado para actualizar la URL de webhook del comercio
   * PUT /v1/merchants/me/webhook
   */
  @UseGuards(ApiKeyGuard)
  @Put('me/webhook')
  async updateWebhook(@Request() req: any, @Body('webhookUrl') webhookUrl: string) {
    return this.merchantService.updateWebhookUrl(req.merchantId, webhookUrl);
  }

  /**
   * Endpoint privado para solicitar la rotación de API Keys
   * POST /v1/merchants/me/api-keys/rotate
   */
  @UseGuards(ApiKeyGuard)
  @Post('me/api-keys/rotate')
  async rotateApiKey(@Request() req: any) {
    return this.merchantService.rotateApiKey(req.merchantId);
  }
}
