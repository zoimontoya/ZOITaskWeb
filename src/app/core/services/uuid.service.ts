import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UuidService {
  
  /**
   * Genera un ID único híbrido para tareas
   * Formato: YYYYMMDD-HHMMSS-USERID-RANDOM
   */
  generateTaskId(userId?: string): string {
    const now = new Date();
    
    // Fecha: YYYYMMDD
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    // Tiempo: HHMMSS
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const timeStr = `${hours}${minutes}${seconds}`;
    
    // User ID (primeros 3 caracteres si existe)
    const userStr = userId ? userId.slice(0, 3) : 'anon';
    
    // Random de 3 dígitos
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    // Formato final: 20251009-143052-u01-847
    return `${dateStr}-${timeStr}-${userStr}-${random}`;
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
    // Validar formato híbrido: YYYYMMDD-HHMMSS-XXX-NNN
    const hybridPattern = /^\d{8}-\d{6}-\w{1,4}-\d{3}$/;
    
    // Validar formato UUID
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    // Validar formato corto
    const shortPattern = /^[0-9a-z]+-[0-9a-z]+$/;
    
    return hybridPattern.test(id) || uuidPattern.test(id) || shortPattern.test(id);
  }
}