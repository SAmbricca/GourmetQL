import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { BehaviorSubject } from 'rxjs';

export interface Mensaje {
  id?: number;
  pedido_id: number;
  emisor_tipo: 'cliente' | 'mozo';
  mensaje: string; // En la BD es 'mensaje', en tu HTML anterior era 'texto'
  fecha_creacion: string; // Timestamp
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private mensajesSubject = new BehaviorSubject<Mensaje[]>([]);
  public mensajes$ = this.mensajesSubject.asObservable();
  private canalChat: RealtimeChannel | null = null;

  constructor(private supabaseService: SupabaseService) {}

  // 1. Validar Mesa (Buscar Pedido Activo)
  async obtenerPedidoActivo(clienteId?: number, anonimoId?: number): Promise<{ success: boolean, pedidoId?: number, mesaId?: number, mesaNumero?: number, message?: string }> {
    let query = this.supabaseService.supabase
      .from('pedidos')
      .select('id, mesa_id, estado, mesas(numero)')
      .neq('estado', 'pagado')
      .neq('estado', 'finalizado');

    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    } else if (anonimoId) {
      query = query.eq('cliente_anonimo_id', anonimoId);
    } else {
      return { success: false, message: 'No se identificó al usuario.' };
    }

    const { data, error } = await query;

    if (error) return { success: false, message: error.message };
    
    if (data && data.length > 0) {
      const pedido = data[data.length - 1]; 
      return { 
        success: true, 
        pedidoId: pedido.id, 
        mesaId: pedido.mesa_id,
        mesaNumero: (pedido.mesas as any).numero 
      };
    }

    return { success: false, message: 'No tienes una mesa asignada actualmente.' };
  }

  // 2. Cargar Chat y Suscribirse
  async cargarChat(pedidoId: number) {
    // Cargar historial previo
    const { data, error } = await this.supabaseService.supabase
      .from('chat_mensajes')
      .select('*')
      .eq('pedido_id', pedidoId)
      .order('fecha_creacion', { ascending: true });

    if (!error && data) {
      this.mensajesSubject.next(data as Mensaje[]);
    }

    // Suscribirse a nuevos
    if (this.canalChat) this.supabaseService.supabase.removeChannel(this.canalChat);

    this.canalChat = this.supabaseService.supabase
      .channel(`chat_pedido_${pedidoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_mensajes',
          filter: `pedido_id=eq.${pedidoId}`
        },
        (payload) => {
          const nuevoMensaje = payload.new as Mensaje;
          // Evitar duplicados si el insert local ya lo agregó (opcional, pero buena práctica)
          const actuales = this.mensajesSubject.value;
          if (!actuales.find(m => m.id === nuevoMensaje.id)) {
            this.mensajesSubject.next([...actuales, nuevoMensaje]);
          }
        }
      )
      .subscribe();
  }

  // 3. Enviar Mensaje
  async enviarMensaje(pedidoId: number, mensaje: string, emisor: 'cliente' | 'mozo'): Promise<boolean> {
    const { error } = await this.supabaseService.supabase
      .from('chat_mensajes')
      .insert({
        pedido_id: pedidoId,
        mensaje: mensaje,
        emisor_tipo: emisor
      });

    if (error) {
      console.error('Error enviando mensaje:', error);
      return false;
    }
    return true;
  }

  desuscribir() {
    if (this.canalChat) {
      this.supabaseService.supabase.removeChannel(this.canalChat);
      this.canalChat = null;
    }
    this.mensajesSubject.next([]); // Limpiar memoria
  }
}