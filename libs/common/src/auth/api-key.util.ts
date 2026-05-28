import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

export interface GeneratedApiKey {
  id: string;      // El UUID que se almacenará en la BD (llave primaria)
  rawKey: string;  // La API Key en texto plano que se le mostrará una sola vez al usuario (formato: id.secret)
  keyHash: string; // El hash bcrypt del secret para guardar en la BD
}

export class ApiKeyUtil {
  private static readonly BCRYPT_SALT_ROUNDS = 12;

  /**
   * Genera un nuevo par de API Key.
   * La clave en texto plano tiene el formato: "id_uuid.secret_aleatorio"
   */
  static async generate(): Promise<GeneratedApiKey> {
    const id = crypto.randomUUID();
    // Generar un secreto aleatorio de 32 bytes (256 bits de entropía) en formato hex
    const secret = crypto.randomBytes(32).toString('hex');
    const rawKey = `${id}.${secret}`;
    const keyHash = await bcrypt.hash(secret, this.BCRYPT_SALT_ROUNDS);

    return {
      id,
      rawKey,
      keyHash,
    };
  }

  /**
   * Extrae el ID y el secreto de una API Key en texto plano.
   */
  static parse(rawKey: string): { id: string; secret: string } | null {
    if (!rawKey) return null;
    const parts = rawKey.split('.');
    if (parts.length !== 2) return null;
    return {
      id: parts[0],
      secret: parts[1],
    };
  }

  /**
   * Compara el secreto recibido en la petición contra el hash almacenado en la BD.
   */
  static async verify(secret: string, keyHash: string): Promise<boolean> {
    return bcrypt.compare(secret, keyHash);
  }
}
