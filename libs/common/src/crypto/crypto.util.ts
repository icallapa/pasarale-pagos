import * as crypto from 'crypto';

export class CryptoUtil {
  private static readonly ALGORITHM = 'aes-256-cbc';
  private static readonly IV_LENGTH = 16; // Para AES, el IV es de 16 bytes

  /**
   * Obtiene la llave de cifrado de 32 bytes de forma determinista.
   * Si no está definida en el entorno, deriva una del secreto del sistema.
   */
  private static getEncryptionKey(): Buffer {
    const keySource = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'fallback-system-secret-key-32bytes';
    // Generar un hash SHA-256 para garantizar una longitud exacta de 32 bytes (256 bits)
    return crypto.createHash('sha256').update(keySource).digest();
  }

  /**
   * Cifra un texto utilizando AES-256-CBC.
   * Retorna el resultado en formato "iv_hex:cipher_hex".
   */
  static encrypt(text: string): string {
    if (!text) return '';
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.getEncryptionKey(), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Descifra un texto en formato "iv_hex:cipher_hex" utilizando AES-256-CBC.
   */
  static decrypt(encryptedText: string): string {
    if (!encryptedText) return '';
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      throw new Error('Formato cifrado inválido. Debe ser "iv:texto_cifrado".');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(this.ALGORITHM, this.getEncryptionKey(), iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
