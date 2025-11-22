import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';

export interface Encuesta {
  id?: number;
  pedido_id: number;
  cliente_id?: number;
  cliente_anonimo_id?: number;
  calificacion: number; // 1 a 5
  comentarios: string; // Guardaremos detalles aquí
  fecha_creacion?: string;
}

@Injectable({
  providedIn: 'root'
})
export class EncuestasService {
  private supabase = inject(SupabaseService).supabase;

  async verificarEncuestaExistente(pedidoId: number): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('encuestas')
        .select('id')
        .eq('pedido_id', pedidoId)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Error verificando encuesta:', error);
      return false;
    }
  }

  async crearEncuesta(encuesta: Encuesta): Promise<{ success: boolean; message?: string }> {
    try {
      // Doble check de seguridad
      const existe = await this.verificarEncuestaExistente(encuesta.pedido_id);
      if (existe) {
        return { success: false, message: 'Ya enviaste una encuesta para este pedido.' };
      }

      const { error } = await this.supabase
        .from('encuestas')
        .insert(encuesta);

      if (error) throw error;
      return { success: true };

    } catch (error: any) {
      console.error('Error creando encuesta:', error);
      return { success: false, message: error.message };
    }
  }


  async obtenerEstadisticas(): Promise<{ success: boolean; data?: any[] }> {
    try {
      const { data, error } = await this.supabase
        .from('encuestas')
        .select('calificacion, fecha_creacion')
        .order('fecha_creacion', { ascending: false })
        .limit(100);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false };
    }
  }
}