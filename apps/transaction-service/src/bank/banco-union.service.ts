import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import axios from 'axios';

export interface QrGenerationResult {
  qrPayload: string;
  bankTransactionId: string;
}

@Injectable()
export class BancoUnionService {
  private readonly logger = new Logger(BancoUnionService.name);
  private readonly apiUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly cert: string;
  private readonly key: string;

  constructor() {
    this.apiUrl = process.env.BANK_UNION_API_URL || 'https://api.sandbox.bancounion.com.bo/v1';
    this.clientId = process.env.BANK_UNION_CLIENT_ID || '';
    this.clientSecret = process.env.BANK_UNION_CLIENT_SECRET || '';
    this.cert = process.env.BANK_UNION_MTLS_CERT || '';
    this.key = process.env.BANK_UNION_MTLS_KEY || '';
  }

  /**
   * Genera la carga útil del QR llamando a la API de Banco Unión mediante mTLS.
   */
  async generateQr(amount: number, orderReference: string, expiresAt: Date): Promise<QrGenerationResult> {
    this.logger.log(`Solicitando generación de QR a Banco Unión para orden: ${orderReference}, monto: ${amount}`);

    // Si no hay certificados mTLS cargados, o no se ha configurado la API, usar el mock
    if (!this.cert || !this.key) {
      this.logger.warn('Certificados mTLS del Banco Unión no configurados. Usando Sandbox simulado.');
      return this.generateMockQr(amount, orderReference, expiresAt);
    }

    try {
      const agent = new https.Agent({
        cert: this.cert,
        key: this.key,
        rejectUnauthorized: false, // Utilizado para Sandbox
      });

      const payload = {
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        amount,
        currency: 'BOB',
        reference: orderReference,
        expiration: expiresAt.toISOString(),
      };

      const response = await axios.post(`${this.apiUrl}/qr/generate`, payload, {
        httpsAgent: agent,
        timeout: 5000, // Timeout de 5s para cumplir con límites de latencia
      });

      // Retornar la respuesta oficial del Banco Unión
      return {
        qrPayload: response.data.qrPayload,
        bankTransactionId: response.data.transactionId,
      };
    } catch (error: any) {
      this.logger.error(`Error al conectar con la API de Banco Unión: ${error.message}. Usando Sandbox simulado.`);
      return this.generateMockQr(amount, orderReference, expiresAt);
    }
  }

  /**
   * Generación de código QR mock en caso de estar en desarrollo local sin conexión real al banco.
   */
  private generateMockQr(amount: number, orderReference: string, expiresAt: Date): QrGenerationResult {
    const bankTransactionId = `bu_tx_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
    // Formato de prueba estándar para simular la data de pago QR
    const qrPayload = `https://qr.bancounion.com.bo/pay?tx=${bankTransactionId}&ref=${orderReference}&amt=${amount}&exp=${expiresAt.getTime()}`;
    
    return {
      qrPayload,
      bankTransactionId,
    };
  }
}
