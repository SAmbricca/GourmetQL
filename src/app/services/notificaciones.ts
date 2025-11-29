import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Usuario } from './supabase';
import { SupabaseClient, createClient, RealtimeChannel } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface NotificacionPerfil {
  perfil: Usuario['perfil'];
  titulo: string;
  mensaje: string;
}

export interface NotificacionTiempoReal {
  id?: number;
  tipo: 'pedido_rechazado' | 'pedido_modificado' | 'pedido_aceptado' | 'consulta_mozo' | 'pedido_listo' | 'mesa_asignada' | 'nuevo_pedido_delivery' | 'nueva_reserva' | 'mesa_liberada';
  titulo: string;
  mensaje: string;
  destinatario_id?: number | string;
  destinatario_perfil?: string;
  datos?: any;
  leido?: boolean;
  fecha_creacion?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificacionesService {

  private supabase: SupabaseClient;
  private canal?: RealtimeChannel;
  private notificacionesSubject = new BehaviorSubject<NotificacionTiempoReal | null>(null);
  
  public notificaciones$: Observable<NotificacionTiempoReal | null> = this.notificacionesSubject.asObservable();

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
    this.inicializarNotificaciones();
  }

  private async inicializarNotificaciones(): Promise<void> {
    try {
      const permisos = await LocalNotifications.checkPermissions();
      
      if (permisos.display === 'prompt') {
        await LocalNotifications.requestPermissions();
      }
    } catch (error) {
      console.error('Error al inicializar notificaciones:', error);
    }
  }

  async suscribirNotificaciones(usuarioId: string): Promise<void> {
    try {
      if (this.canal) {
        await this.supabase.removeChannel(this.canal);
      }

      // Crear nuevo canal para notificaciones del usuario
      this.canal = this.supabase
        .channel(`notificaciones:${usuarioId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notificaciones',
            filter: `destinatario_id=eq.${usuarioId}`
          },
          (payload) => {
            const notificacion = payload.new as NotificacionTiempoReal;
            this.notificacionesSubject.next(notificacion);
            
            // Mostrar notificación local en el dispositivo
            this.mostrarNotificacionCustom(
              notificacion.titulo, 
              notificacion.mensaje,
              500
            );
          }
        )
        .subscribe();

      console.log('Suscrito a notificaciones en tiempo real');
    } catch (error) {
      console.error('Error al suscribirse a notificaciones:', error);
    }
  }

  async desuscribirNotificaciones(): Promise<void> {
    if (this.canal) {
      await this.supabase.removeChannel(this.canal);
      this.canal = undefined;
    }
  }

  async enviarNotificacion(notificacion: NotificacionTiempoReal): Promise<{ success: boolean; message?: string }> {
    try {
      if (!notificacion.destinatario_id) throw new Error("Falta destinatario ID");

      const { error } = await this.supabase
        .from('notificaciones')
        .insert([
          {
            tipo: notificacion.tipo,
            titulo: notificacion.titulo,
            mensaje: notificacion.mensaje,
            // Convertimos a string para asegurar compatibilidad con base de datos (text)
            destinatario_id: notificacion.destinatario_id.toString(), 
            destinatario_perfil: notificacion.destinatario_perfil,
            datos: notificacion.datos,
            leido: false,
            fecha_creacion: new Date().toISOString()
          }
        ]);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error al enviar notificación:', error);
      return { success: false, message: error.message };
    }
  }


  async marcarComoLeida(notificacionId: number): Promise<void> {
    try {
      await this.supabase
        .from('notificaciones')
        .update({ leido: true })
        .eq('id', notificacionId);
    } catch (error) {
      console.error('Error al marcar notificación como leída:', error);
    }
  }


  async obtenerNotificacionesNoLeidas(usuarioId: string): Promise<NotificacionTiempoReal[]> {
    try {
      const { data, error } = await this.supabase
        .from('notificaciones')
        .select('*')
        .eq('destinatario_id', usuarioId)
        .eq('leido', false)
        .order('fecha_creacion', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al obtener notificaciones no leídas:', error);
      return [];
    }
  }

  async mostrarNotificacionCustom(titulo: string, mensaje: string, delay: number = 1000): Promise<void> {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: titulo,
            body: mensaje,
            id: Math.floor(Math.random() * 100000),
            schedule: { at: new Date(Date.now() + delay) },
            sound: undefined,
            smallIcon: 'ic_launcher',
            actionTypeId: '',
            extra: null
          }
        ]
      });
    } catch (error) {
      console.error('Error al mostrar notificación custom:', error);
    }
  }

  async notificarPedidoNuevo(tipoPedido: 'comida' | 'bebida', numeroMesa: number): Promise<void> {
    const titulo = tipoPedido === 'comida' ? '🍳 Nuevo Pedido - Cocina' : '🍹 Nuevo Pedido - Bar';
    const mensaje = `Mesa ${numeroMesa} ha realizado un pedido de ${tipoPedido}`;
    
    await this.mostrarNotificacionCustom(titulo, mensaje, 500);
  }

  async notificarClientePendiente(nombreCliente: string): Promise<void> {
    await this.mostrarNotificacionCustom(
      'Cliente Pendiente',
      `${nombreCliente} está esperando aprobación`,
      500
    );
  }

  async notificarConsultaMozo(numeroMesa: number): Promise<void> {
    await this.mostrarNotificacionCustom(
      'Consulta de Mesa',
      `La mesa ${numeroMesa} necesita tu atención`,
      500
    );
  }

  async notificarMesaAsignada(nombreCliente: string, numeroMesa: number) {
    // Implementación simple para llamar desde el componente si se desea
    await LocalNotifications.schedule({
        notifications: [{
            title: 'Mesa Asignada',
            body: `${nombreCliente}, tu mesa es la ${numeroMesa}`,
            id: Math.floor(Math.random() * 1000),
            schedule: { at: new Date(Date.now() + 100) }
        }]
    });
  }

  async cancelarTodasLasNotificaciones(): Promise<void> {
    try {
      const pendientes = await LocalNotifications.getPending();
      if (pendientes.notifications.length > 0) {
        const ids = pendientes.notifications.map(n => n.id);
        await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) });
      }
    } catch (error) {
      console.error('Error al cancelar notificaciones:', error);
    }
  }

  async verificarPermisos(): Promise<boolean> {
    try {
      const permisos = await LocalNotifications.checkPermissions();
      return permisos.display === 'granted';
    } catch (error) {
      console.error('Error al verificar permisos:', error);
      return false;
    }
  }
}