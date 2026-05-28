import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiKeyGuard, RolesGuard, Roles } from '@app/common';
import { SettlementServiceService, ProcessClearingDto } from './settlement-service.service';

@UseGuards(ApiKeyGuard, RolesGuard)
@Roles('admin')
@Controller('v1/settlements')
export class SettlementServiceController {
  constructor(private readonly settlementService: SettlementServiceService) {}

  /**
   * Endpoint privado para cargar y procesar el archivo de clearing del banco
   * Requiere rol 'admin'
   * POST /v1/settlements/clearings
   */
  @Post('clearings')
  async processClearing(@Body() dto: ProcessClearingDto) {
    return this.settlementService.processClearing(dto);
  }

  /**
   * Endpoint privado para listar todas las corridas de conciliación ejecutadas
   * Requiere rol 'admin'
   * GET /v1/settlements/runs
   */
  @Get('runs')
  async getAllRuns() {
    return this.settlementService.getAllRuns();
  }

  /**
   * Endpoint privado para obtener los detalles e incidencias de un run de conciliación
   * Requiere rol 'admin'
   * GET /v1/settlements/runs/:id
   */
  @Get('runs/:id')
  async getRunDetails(@Param('id') id: string) {
    return this.settlementService.getRun(id);
  }
}
