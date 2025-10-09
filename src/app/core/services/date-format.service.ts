import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DateFormatService {
  
  /**
   * Convierte cualquier fecha al formato europeo DD/MM/YYYY
   */
  toEuropeanFormat(date: Date | string): string {
    if (!date) return '';
    
    let dateObj: Date;
    
    if (typeof date === 'string') {
      // Si viene en formato YYYY-MM-DD, parsing manual para evitar problemas de timezone
      if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const parts = date.split('-');
        dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else if (date.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        // Si ya viene en formato DD/MM/YYYY, devolverlo tal como está
        return date;
      } else {
        dateObj = new Date(date);
      }
    } else {
      dateObj = date;
    }
    
    // Verificar que es una fecha válida
    if (isNaN(dateObj.getTime())) {
      console.warn('Fecha inválida recibida:', date);
      return '';
    }
    
    // Formato DD/MM/YYYY garantizado
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();
    
    const result = `${day}/${month}/${year}`;
    console.log(`📅 FRONTEND toEuropeanFormat: "${date}" → "${result}"`);
    return result;
  }
  
  /**
   * Convierte fecha europea DD/MM/YYYY a formato ISO YYYY-MM-DD
   */
  fromEuropeanFormat(europeanDate: string): string {
    if (!europeanDate || !europeanDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      return '';
    }
    
    const parts = europeanDate.split('/');
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    
    return `${year}-${month}-${day}`;
  }
  
  /**
   * Obtiene la fecha actual en formato europeo DD/MM/YYYY
   */
  getCurrentEuropeanDate(): string {
    return this.toEuropeanFormat(new Date());
  }
  
  /**
   * Obtiene la fecha actual en formato ISO YYYY-MM-DD
   */
  getCurrentISODate(): string {
    return new Date().toISOString().split('T')[0];
  }
  
  /**
   * Convierte fecha para input HTML (requiere YYYY-MM-DD)
   */
  toInputFormat(europeanDate: string): string {
    return this.fromEuropeanFormat(europeanDate);
  }
  
  /**
   * Convierte desde input HTML (YYYY-MM-DD) a formato europeo
   */
  fromInputFormat(isoDate: string): string {
    return this.toEuropeanFormat(isoDate);
  }

  /**
   * Verifica si una fecha está vencida respecto a hoy
   * IMPORTANTE: Asume que todas las fechas del backend están en formato DD/MM/YYYY (europeo)
   */
  isDateOverdue(dateString: string): boolean {
    console.log(`🔍 FRONTEND isDateOverdue - Entrada: "${dateString}"`);
    
    if (!dateString) {
      console.log(`🔍 FRONTEND isDateOverdue - Sin fecha, no vencida`);
      return false;
    }
    
    try {
      let dateToCheck: Date;
      
      // Si viene en formato ISO (YYYY-MM-DD) desde el backend
      if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.log(`🔍 FRONTEND - Detectado formato ISO: ${dateString}`);
        const parts = dateString.split('-');
        dateToCheck = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        console.log(`🔍 FRONTEND - Parseado ISO: año=${parts[0]}, mes=${parts[1]}, día=${parts[2]} → ${dateToCheck}`);
      } 
      // Si viene en formato DD/MM/YYYY (formato europeo - ESTE ES EL CASO PROBLEMÁTICO)
      else if (dateString.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        console.log(`🔍 FRONTEND - ¡FORMATO EUROPEO DETECTADO!: ${dateString}`);
        const parts = dateString.split('/');
        // CRÍTICO: Interpretar como día/mes/año (europeo), NO mes/día/año (americano)
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // JavaScript months are 0-based
        const year = parseInt(parts[2]);
        
        dateToCheck = new Date(year, month, day);
        console.log(`🔍 FRONTEND - Parseado EUROPEO: día=${day}, mes=${month + 1}, año=${year} → ${dateToCheck.toDateString()}`);
      }
      // Otros formatos - FORZAR interpretación europea si contiene "/"
      else if (dateString.includes('/')) {
        console.log(`🔍 FRONTEND - Formato con "/" - FORZANDO interpretación europea: ${dateString}`);
        const parts = dateString.split('/');
        if (parts.length >= 3) {
          const day = parseInt(parts[0]) || 1;
          const month = (parseInt(parts[1]) || 1) - 1;
          const year = parseInt(parts[2]) || new Date().getFullYear();
          dateToCheck = new Date(year, month, day);
          console.log(`🔍 FRONTEND - FORZADO europeo: día=${day}, mes=${month + 1}, año=${year} → ${dateToCheck.toDateString()}`);
        } else {
          dateToCheck = new Date(dateString);
        }
      }
      // Último recurso
      else {
        console.log(`🔍 FRONTEND - Formato desconocido, usando new Date(): ${dateString}`);
        dateToCheck = new Date(dateString);
      }
      
      // Verificar que es una fecha válida
      if (isNaN(dateToCheck.getTime())) {
        console.warn('❌ FRONTEND - Fecha inválida para verificar vencimiento:', dateString);
        return false;
      }
      
      // Comparar solo las fechas (sin horas)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dateToCheck.setHours(0, 0, 0, 0);
      
      const isOverdue = dateToCheck < today;
      console.log(`📅 FRONTEND - Comparación final: ${dateToCheck.toDateString()} < ${today.toDateString()} = ${isOverdue ? 'VENCIDA ❌' : 'VÁLIDA ✅'}`);
      
      return isOverdue;
      
    } catch (error) {
      console.error('❌ FRONTEND - Error al verificar vencimiento de fecha:', dateString, error);
      return false;
    }
  }
}