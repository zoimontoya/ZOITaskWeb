import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UuidService {
  
  /**
   * Genera un ID único híbrido para tareas con alta entropía
   * Formato: YYYYMMDD-HHMMSSMS-USERID-RANDOM
   */
  generateTaskId(userId?: string): string {
    const now = new Date();
    const timestamp = now.getTime(); // Milliseconds since epoch para mayor precisión
    
    // Fecha: YYYYMMDD
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    // Tiempo con microsegundos: HHMMSSMS
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
    const timeStr = `${hours}${minutes}${seconds}${milliseconds}`;
    
    // User ID (primeros 3 caracteres si existe, limpiado)
    const userStr = userId ? userId.slice(0, 3).replace(/[^a-zA-Z0-9]/g, '') : 'anon';
    
    // Random de 4 dígitos + timestamp parcial para máxima unicidad
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const timestampSuffix = (timestamp % 1000).toString().padStart(3, '0');
    
    // Formato final: 20251009-143052847-u01-4738291
    return `${dateStr}-${timeStr}-${userStr}-${random}${timestampSuffix}`;
  }

  /**
   * Genera UUID v4 completo (para casos que requieren máxima unicidad)
   */
  generateUUID(): string {
    return 'xxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Genera ID corto basado en timestamp
   */
  generateShortId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 5);
    return `${timestamp}-${randomPart}`;
  }

  /**
   * Valida si un ID tiene formato válido
   */
  isValidTaskId(id: string): boolean {
    // Validar formato híbrido mejorado: YYYYMMDD-HHMMSSMS-XXX-NNNNNNN
    const hybridPatternNew = /^\d{8}-\d{9}-\w{1,4}-\d{7}$/;
    
    // Validar formato híbrido anterior: YYYYMMDD-HHMMSS-XXX-NNN
    const hybridPatternOld = /^\d{8}-\d{6}-\w{1,4}-\d{3}$/;
    
    // Validar formato UUID
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    // Validar formato corto
    const shortPattern = /^[0-9a-z]+-[0-9a-z]+$/;
    
    return hybridPatternNew.test(id) || hybridPatternOld.test(id) || uuidPattern.test(id) || shortPattern.test(id);
  }

  // Cache de IDs generados para evitar duplicados en la misma sesión
  private generatedIds = new Set<string>();

  /**
   * Genera un ID único garantizado (sin duplicados en sesión)
   */
  generateUniqueTaskId(userId?: string, maxAttempts: number = 5): string {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const id = this.generateTaskId(userId);
      
      if (!this.generatedIds.has(id)) {
        this.generatedIds.add(id);
        console.log(`🆔 ID único generado: ${id} (intento ${attempt + 1})`);
        return id;
      }
      
      console.warn(`⚠️ Colisión de ID detectada: ${id} (intento ${attempt + 1})`);
      
      // Esperar un milisegundo para cambiar el timestamp
      const now = Date.now();
      while (Date.now() === now) { /* busy wait */ }
    }
    
    // Fallback a UUID si falla después de maxAttempts
    const fallbackId = this.generateUUID();
    this.generatedIds.add(fallbackId);
    console.error(`🚨 Usando UUID fallback después de ${maxAttempts} intentos: ${fallbackId}`);
    return fallbackId;
  }

  /**
   * Limpia el cache de IDs (llamar periódicamente)
   */
  clearIdCache(): void {
    this.generatedIds.clear();
    console.log('🧹 Cache de IDs limpiado');
  }
}