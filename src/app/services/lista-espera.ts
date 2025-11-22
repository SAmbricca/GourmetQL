import { Injectable } from '@angular/core';
import { SupabaseService, Usuario } from './supabase';
import { ClienteAnonimo } from './cliente-anonimo';

export interface ListaEspera {
  id: number;
  cliente_id: number | null;
  cliente_anonimo_id: number | null;
  fecha_ingreso: string;
  estado: 'esperando' | 'atendido';
  fecha_creacion: string;
}

export interface ListaEsperaConCliente extends ListaEspera {
  cliente?: Usuario;
  cliente_anonimo?: ClienteAnonimo;
}

@Injectable({
  providedIn: 'root'
})
export class ListaEsperaService {

  constructor(private supabaseClient: SupabaseService) {}

  async obtenerClientesEnEspera(): Promise<ListaEsperaConCliente[]> {
    try {
      const { data, error } = await this.supabaseClient.supabase
        .from('lista_espera')
        .select(`
          *,
          cliente:usuarios!cliente_id (*)
        `)
        .eq('estado', 'esperando')
        .not('cliente_id', 'is', null)
        .order('fecha_ingreso', { ascending: true });

      if (error) {
        console.error('Error al obtener clientes en espera:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error al conectar con la base de datos:', error);
      return [];
    }
  }

  async obtenerClientesAnonimosEnEspera(): Promise<ListaEsperaConCliente[]> {
    try {
      const { data, error } = await this.supabaseClient.supabase
        .from('lista_espera')
        .select(`
          *,
          cliente_anonimo:clientes_anonimos!cliente_anonimo_id (*)
        `)
        .eq('estado', 'esperando')
        .not('cliente_anonimo_id', 'is', null)
        .order('fecha_ingreso', { ascending: true });

      if (error) {
        console.error('Error al obtener clientes anónimos en espera:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error al conectar con la base de datos:', error);
      return [];
    }
  }

  async agregarClienteALista(clienteId: number): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await this.supabaseClient.supabase
        .from('lista_espera')
        .insert({
          cliente_id: clienteId,
          estado: 'esperando'
        });

      if (error) {
        return { success: false, message: 'Error al agregar cliente a la lista: ' + error.message };
      }

      return { success: true, message: 'Cliente agregado a la lista de espera' };
    } catch (error) {
      console.error('Error al agregar cliente:', error);
      return { success: false, message: 'Error al conectar con el servidor' };
    }
  }

  async agregarClienteAnonimoALista(clienteAnonimoId: number): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await this.supabaseClient.supabase
        .from('lista_espera')
        .insert({
          cliente_anonimo_id: clienteAnonimoId,
          estado: 'esperando'
        });

      if (error) {
        return { success: false, message: 'Error al agregar cliente anónimo a la lista: ' + error.message };
      }

      return { success: true, message: 'Cliente anónimo agregado a la lista de espera' };
    } catch (error) {
      console.error('Error al agregar cliente anónimo:', error);
      return { success: false, message: 'Error al conectar con el servidor' };
    }
  }

  async marcarComoAtendido(id: number): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await this.supabaseClient.supabase
        .from('lista_espera')
        .update({ estado: 'atendido' })
        .eq('id', id);

      if (error) {
        return { success: false, message: 'Error al marcar como atendido: ' + error.message };
      }

      return { success: true, message: 'Cliente marcado como atendido' };
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      return { success: false, message: 'Error al conectar con el servidor' };
    }
  }

  async eliminarDeLista(id: number): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await this.supabaseClient.supabase
        .from('lista_espera')
        .delete()
        .eq('id', id);

      if (error) {
        return { success: false, message: 'Error al eliminar de la lista: ' + error.message };
      }

      return { success: true, message: 'Cliente eliminado de la lista de espera' };
    } catch (error) {
      console.error('Error al eliminar:', error);
      return { success: false, message: 'Error al conectar con el servidor' };
    }
  }
}