import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase';
import { ClienteAnonimoService } from './cliente-anonimo';

export interface ConsultaMozo {
  id?: number;
  pedido_id?: number;
  mensaje_cliente: string;
  respuesta_mozo?: string;
  estado: 'pendiente' | 'respondida';
  fecha_creacion?: string;
}

export interface MensajeChat {
  id: number;
  texto: string;
  esCliente: boolean;
  fecha: Date;
  estado?: 'pendiente' | 'respondida';
}

export interface ResultadoOperacion<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConsultaService {

  constructor(
    private supabaseService: SupabaseService,
    private clienteAnonimoService: ClienteAnonimoService
  ) {}

  async crearConsulta(mesaId: number, mensaje: string): Promise<ResultadoOperacion<ConsultaMozo>> {
    try {
      let clienteId: number | null = null;
      let clienteAnonimoId: number | null = null;

      const usuario = await this.supabaseService.obtenerUsuarioActual();
      
      if (usuario?.id) {
        clienteId = usuario.id;
      } else {
        const clienteAnonimo = await this.clienteAnonimoService.obtenerClienteAnonimoActual();
        
        if (!clienteAnonimo) {
          return {
            success: false,
            message: 'No se pudo identificar al cliente'
          };
        }
        
        clienteAnonimoId = clienteAnonimo.id;
      }

      let query = this.supabaseService.supabase
        .from('pedidos')
        .select('id')
        .eq('mesa_id', mesaId);

      if (clienteId) {
        query = query.eq('cliente_id', clienteId);
      } else if (clienteAnonimoId) {
        query = query.eq('cliente_anonimo_id', clienteAnonimoId);
      }

      const { data: pedidoActivo, error: errorPedido } = await query
        .in('estado', ['pendiente', 'preparando', 'listo'])
        .order('fecha_pedido', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (errorPedido && errorPedido.code !== 'PGRST116') {
        console.error('Error al buscar pedido:', errorPedido);
      }

      const consultaData = {
        pedido_id: pedidoActivo?.id || null,
        mensaje_cliente: mensaje,
        estado: 'pendiente' as const,
        fecha_creacion: new Date().toISOString()
      };

      const { data, error } = await this.supabaseService.supabase
        .from('consultas_mozo')
        .insert(consultaData)
        .select()
        .single();

      if (error) {
        console.error('Error al crear consulta:', error);
        return {
          success: false,
          message: 'Error al enviar la consulta'
        };
      }

      return {
        success: true,
        data: data,
        message: 'Consulta enviada exitosamente'
      };

    } catch (error) {
      console.error('Error en crearConsulta:', error);
      return {
        success: false,
        message: 'Error inesperado al crear la consulta'
      };
    }
  }

  async responderConsulta(consultaId: number, respuesta: string): Promise<ResultadoOperacion> {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('consultas_mozo')
        .update({
          respuesta_mozo: respuesta,
          estado: 'respondida'
        })
        .eq('id', consultaId)
        .select()
        .single();

      if (error) {
        console.error('Error al responder consulta:', error);
        return {
          success: false,
          message: 'Error al enviar la respuesta'
        };
      }

      return {
        success: true,
        data: data,
        message: 'Respuesta enviada exitosamente'
      };

    } catch (error) {
      console.error('Error en responderConsulta:', error);
      return {
        success: false,
        message: 'Error inesperado al responder'
      };
    }
  }

  async obtenerTodasLasConsultas(): Promise<ResultadoOperacion<ConsultaMozo[]>> {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('consultas_mozo')
        .select('*')
        .order('fecha_creacion', { ascending: false });

      if (error) {
        console.error('Error al obtener consultas:', error);
        return {
          success: false,
          message: 'Error al cargar consultas'
        };
      }

      return {
        success: true,
        data: data || []
      };

    } catch (error) {
      console.error('Error en obtenerTodasLasConsultas:', error);
      return {
        success: false,
        message: 'Error inesperado al obtener consultas'
      };
    }
  }

  async obtenerConsultasPorPedido(pedidoId: number): Promise<ResultadoOperacion<MensajeChat[]>> {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('consultas_mozo')
        .select('*')
        .eq('pedido_id', pedidoId)
        .order('fecha_creacion', { ascending: true });

      if (error) {
        console.error('Error al obtener consultas:', error);
        return {
          success: false,
          message: 'Error al cargar el historial de consultas'
        };
      }

      const mensajes = this.convertirConsultasAMensajes(data || []);

      return {
        success: true,
        data: mensajes
      };

    } catch (error) {
      console.error('Error en obtenerConsultasPorPedido:', error);
      return {
        success: false,
        message: 'Error inesperado al obtener consultas'
      };
    }
  }

  async obtenerConsultasPorMesa(mesaId: number): Promise<ResultadoOperacion<MensajeChat[]>> {
    try {
      let clienteId: number | null = null;
      let clienteAnonimoId: number | null = null;

      const usuario = await this.supabaseService.obtenerUsuarioActual();
      
      if (usuario?.id) {
        clienteId = usuario.id;
      } else {
        const clienteAnonimo = await this.clienteAnonimoService.obtenerClienteAnonimoActual();
        
        if (!clienteAnonimo) {
          return {
            success: false,
            message: 'No se pudo identificar al cliente'
          };
        }
        
        clienteAnonimoId = clienteAnonimo.id;
      }

      let queryPedidos = this.supabaseService.supabase
        .from('pedidos')
        .select('id')
        .eq('mesa_id', mesaId);

      if (clienteId) {
        queryPedidos = queryPedidos.eq('cliente_id', clienteId);
      } else if (clienteAnonimoId) {
        queryPedidos = queryPedidos.eq('cliente_anonimo_id', clienteAnonimoId);
      }

      const { data: pedidos, error: errorPedidos } = await queryPedidos;

      if (errorPedidos) {
        console.error('Error al obtener pedidos:', errorPedidos);
        return {
          success: false,
          message: 'Error al buscar pedidos'
        };
      }

      if (!pedidos || pedidos.length === 0) {
        console.log('⚠️ No hay pedidos para esta mesa');
        return {
          success: true,
          data: []
        };
      }

      const pedidoIds = pedidos.map(p => p.id);

      const { data, error } = await this.supabaseService.supabase
        .from('consultas_mozo')
        .select('*')
        .in('pedido_id', pedidoIds)
        .order('fecha_creacion', { ascending: true });

      if (error) {
        console.error('Error al obtener consultas:', error);
        return {
          success: false,
          message: 'Error al cargar el historial de consultas'
        };
      }

      const mensajes = this.convertirConsultasAMensajes(data || []);

      return {
        success: true,
        data: mensajes
      };

    } catch (error) {
      console.error('Error en obtenerConsultasPorMesa:', error);
      return {
        success: false,
        message: 'Error inesperado al obtener consultas'
      };
    }
  }

  private convertirConsultasAMensajes(consultas: ConsultaMozo[]): MensajeChat[] {
    const mensajes: MensajeChat[] = [];

    consultas.forEach(consulta => {
      mensajes.push({
        id: consulta.id || 0,
        texto: consulta.mensaje_cliente,
        esCliente: true,
        fecha: new Date(consulta.fecha_creacion || new Date()),
        estado: consulta.estado
      });

      if (consulta.respuesta_mozo) {
        mensajes.push({
          id: consulta.id || 0,
          texto: consulta.respuesta_mozo,
          esCliente: false,
          fecha: new Date(consulta.fecha_creacion || new Date()),
          estado: consulta.estado
        });
      }
    });

    return mensajes;
  }

  async suscribirseAConsultas(mesaId: number, callback: (payload: any) => void): Promise<any> {
    try {
      const subscription = this.supabaseService.supabase
        .channel(`consultas-mesa-${mesaId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'consultas_mozo'
          },
          callback
        )
        .subscribe();

      return subscription;

    } catch (error) {
      console.error('Error al suscribirse a consultas:', error);
      return null;
    }
  }

  async suscribirseATodasLasConsultas(callback: (payload: any) => void): Promise<any> {
    try {
      const subscription = this.supabaseService.supabase
        .channel('todas-consultas')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'consultas_mozo'
          },
          callback
        )
        .subscribe();

      return subscription;

    } catch (error) {
      console.error('Error al suscribirse a consultas:', error);
      return null;
    }
  }
}