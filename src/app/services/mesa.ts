import { Injectable } from '@angular/core';
import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Observable } from 'rxjs';
import { SupabaseService } from './supabase';

export interface Mesa {
  id: number;
  numero: number;
  cantidad_comensales: number;
  codigo_qr: string;
  foto_url: string;
  estado: 'libre' | 'ocupada';
}

export interface ListaEspera {
  id: number;
  cliente_anonimo_id: number;
  fecha_ingreso: string;
  estado: 'esperando' | 'atendido';
  cliente_anonimo: {
    id: number;
    nombre: string;
    foto_url: string;
  };
}

export interface Pedido {
    id: number;
    mesa_id: number;
    cliente_anonimo_id: number;
    estado: string;
}

@Injectable({
  providedIn: 'root'
})
export class MesaService {
  private supabase: SupabaseClient;
  private listaEsperaChannel: RealtimeChannel | null = null;

  constructor(private supabaseService: SupabaseService) {
    this.supabase = this.supabaseService.supabase;
  }

  // ==================== MÉTODOS DE GESTIÓN DE MESAS ====================
  
  async subirImagenMesa(fileName: string, file: Blob): Promise<{ success: boolean; url?: string; message: string }> {
    return await this.supabaseService.subirImagen('mesas', fileName, file);
  }

  async subirCodigoQR(fileName: string, file: Blob): Promise<{ success: boolean; url?: string; message: string }> {
    return await this.supabaseService.subirImagen('codigos-qr', fileName, file);
  }

  async agregarMesa(mesaData: any): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('mesas')
        .insert([mesaData])
        .select()
        .single();
      
      if (error) {
        console.error('Error en agregarMesa:', error);
        throw error;
      }
      
      return data;
    } catch (error: any) {
      console.error('Error al agregar mesa:', error);
      throw error;
    }
  }

  async actualizarMesa(id: number, data: any): Promise<any> {
    const { data: updatedData, error } = await this.supabase
      .from('mesas')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    return updatedData;
  }

  async obtenerMesaPorNumero(numero: number): Promise<Mesa | null> {
    const { data, error } = await this.supabase
      .from('mesas')
      .select('*')
      .eq('numero', numero)
      .single();
    
    return data;
  }

  // ==================== MÉTODOS DE LISTA DE ESPERA ====================

  obtenerListaEspera(): Observable<ListaEspera[]> {
    return new Observable(observer => {
      const fetchLista = async () => {
        // CORRECCIÓN: Traer también datos de usuarios registrados
        const { data, error } = await this.supabase
          .from('lista_espera')
          .select('*, cliente_anonimo:clientes_anonimos(*), cliente:usuarios(*)')
          .eq('estado', 'esperando')
          .order('fecha_ingreso');

        if (error) {
          observer.error(error);
        } else {
          observer.next(data as any[]);
        }
      };

      fetchLista();
      this.listaEsperaChannel = this.supabase
        .channel('lista-espera-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lista_espera' },
          () => fetchLista()
        ).subscribe();
        
      return () => {
        if (this.listaEsperaChannel) {
          this.supabase.removeChannel(this.listaEsperaChannel);
        }
      };
    });
  }

  async obtenerMesasDisponibles(): Promise<Mesa[]> {
    const { data, error } = await this.supabase
      .from('mesas')
      .select('*')
      .eq('estado', 'libre')
      .order('numero');
    if (error) throw error;
    return data || [];
  }

  async asignarMesa(mesaId: number, clienteAnonimoId: number | null, clienteId: number | null): Promise<Pedido> {
    try {
      // 1. Crear el Pedido
      const { data: pedidoData, error: pedidoError } = await this.supabase
        .from('pedidos')
        .insert({
          mesa_id: mesaId,
          cliente_anonimo_id: clienteAnonimoId, // Puede ser null
          cliente_id: clienteId,               // Puede ser null
          estado: 'pendiente',
          total: 0,
          descuento: 0,
          propina: 0
        })
        .select()
        .single();

      if (pedidoError) throw new Error(`Error al crear pedido: ${pedidoError.message}`);

      // 2. Marcar mesa como ocupada
      await this.supabase
        .from('mesas')
        .update({ estado: 'ocupada' })
        .eq('id', mesaId);

      // 3. Actualizar Lista de Espera (Dinámico según quién sea el cliente)
      let updateQuery = this.supabase
        .from('lista_espera')
        .update({ estado: 'atendido' })
        .eq('estado', 'esperando');

      if (clienteId) {
        updateQuery = updateQuery.eq('cliente_id', clienteId);
      } else if (clienteAnonimoId) {
        updateQuery = updateQuery.eq('cliente_anonimo_id', clienteAnonimoId);
      }

      const { error: listaError } = await updateQuery;

      if (listaError) {
        console.warn('Advertencia al actualizar lista de espera:', listaError.message);
      }

      return pedidoData as Pedido;

    } catch (error: any) {
      console.error('Error en asignarMesa:', error);
      throw new Error(error.message || 'No se pudo asignar la mesa');
    }
  }
  
  async verificarAsignacionCliente(clienteAnonimoId: number): Promise<Pedido | null> {
    const { data, error } = await this.supabase
      .from('pedidos')
      .select('*')
      .eq('cliente_anonimo_id', clienteAnonimoId)
      .in('estado', ['pendiente', 'confirmado', 'preparacion', 'listo', 'entregado'])
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }
  
  async obtenerPedidoActivoPorMesaQR(qrData: string): Promise<Pedido | null> {
      const numeroMesa = qrData.split('_')[1];
      if (!numeroMesa) return null;

      const { data: mesaData, error: mesaError } = await this.supabase
          .from('mesas')
          .select('id')
          .eq('numero', Number(numeroMesa))
          .single();

      if (mesaError || !mesaData) return null;

      const { data, error } = await this.supabase
          .from('pedidos')
          .select('*')
          .eq('mesa_id', mesaData.id)
          .in('estado', ['pendiente', 'confirmado', 'preparacion', 'listo', 'entregado'])
          .order('fecha_creacion', { ascending: false })
          .limit(1)
          .single();

      if (error) return null;
      return data;
  }

  async verificarMesaOcupada(mesaId: number): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('mesas')
      .select('estado')
      .eq('id', mesaId)
      .single();
    
    if (error) throw error;
    return data?.estado === 'ocupada';
  }

  async obtenerMesaAsignadaCliente(clienteId?: number, clienteAnonimoId?: number): Promise<number | null> {
    let query = this.supabase
      .from('pedidos')
      .select('mesa_id')
      .in('estado', ['pendiente', 'confirmado', 'preparacion', 'listo', 'entregado'])
      .order('fecha_creacion', { ascending: false })
      .limit(1);

    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    } else if (clienteAnonimoId) {
      query = query.eq('cliente_anonimo_id', clienteAnonimoId);
    } else {
      return null;
    }

    const { data, error } = await query.single();
    if (error && error.code !== 'PGRST116') throw error;
    return data?.mesa_id || null;
  }

  async obtenerNumeroMesa(mesaId: number): Promise<number | null> {
    const { data } = await this.supabase.from('mesas').select('numero').eq('id', mesaId).single();
    return data?.numero || null;
  }
}
