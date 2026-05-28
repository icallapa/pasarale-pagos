import { Test, TestingModule } from '@nestjs/testing';
import { SettlementServiceController } from './settlement-service.controller';
import { SettlementServiceService } from './settlement-service.service';
import { ApiKeyGuard, RolesGuard } from '@app/common';

describe('SettlementServiceController', () => {
  let controller: SettlementServiceController;
  let service: any;

  beforeEach(async () => {
    service = {
      processClearing: jest.fn(),
      getAllRuns: jest.fn(),
      getRun: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettlementServiceController],
      providers: [
        {
          provide: SettlementServiceService,
          useValue: service,
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SettlementServiceController>(SettlementServiceController);
  });

  it('debería estar definido', () => {
    expect(controller).toBeDefined();
  });

  describe('processClearing', () => {
    it('debería llamar al servicio processClearing', async () => {
      const dto = { runDate: '2026-05-28', transactions: [] };
      service.processClearing.mockResolvedValue({ id: 'run-123', status: 'COMPLETED' });

      const result = await controller.processClearing(dto);
      expect(result).toEqual({ id: 'run-123', status: 'COMPLETED' });
      expect(service.processClearing).toHaveBeenCalledWith(dto);
    });
  });

  describe('getAllRuns', () => {
    it('debería retornar el listado de ejecuciones', async () => {
      const expectedResult = [{ id: 'run-123', status: 'COMPLETED' }];
      service.getAllRuns.mockResolvedValue(expectedResult);

      const result = await controller.getAllRuns();
      expect(result).toEqual(expectedResult);
      expect(service.getAllRuns).toHaveBeenCalled();
    });
  });

  describe('getRunDetails', () => {
    it('debería retornar el detalle de una corrida por ID', async () => {
      const expectedResult = { id: 'run-123', status: 'COMPLETED', details: [] };
      service.getRun.mockResolvedValue(expectedResult);

      const result = await controller.getRunDetails('run-123');
      expect(result).toEqual(expectedResult);
      expect(service.getRun).toHaveBeenCalledWith('run-123');
    });
  });
});
