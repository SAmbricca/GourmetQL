import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase';

export interface DetallePedido {
  id: number;
  pedido_id: number;
  producto_id: number;
  cantidad: number;
  estado: 'pendiente' | 'preparacion' | 'listo';
  menu: {
    nombre: string;
    tipo: 'comida' | 'bebida' | 'postre';
    foto_url: string | string[]; 
  };
  pedido?: {
    mesa_id: number;
    mesa: { numero: number };
    fecha_creacion: string;
    estado: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class PedidosService {

  constructor(private supabase: SupabaseService) {}

  // --- MOZO ---

  async obtenerPedidosPorEstado(estados: string[]): Promise<any[]> {
    const { data, error } = await this.supabase.supabase
      .from('pedidos')
      .select(`
        *,
        mesa:mesas(numero),
        cliente:usuarios(nombre, apellido, email, dni),
        cliente_anonimo:clientes_anonimos(nombre),
        detalles:detalles_pedido(
          *,
          menu(nombre, precio, tipo)
        )
      `)
      .in('estado', estados)
      .order('fecha_creacion', { ascending: true });

    if (error) {
        console.error('Error fetching pedidos:', JSON.stringify(error));
        return [];
    }
    return data || [];
  }

  async cambiarEstadoPedido(pedidoId: number, nuevoEstado: string): Promise<void> {
    const { error } = await this.supabase.supabase
      .from('pedidos')
      .update({ estado: nuevoEstado })
      .eq('id', pedidoId)
      .select(); // <--- CORRECCIÓN CRÍTICA: .select() evita respuesta vacía (204) que rompe Android

    if (error) {
        console.error('Error detallado Supabase (cambiarEstado):', JSON.stringify(error));
        throw new Error(error.message);
    }
  }

  async confirmarPagoYLibearMesa(pedidoId: number, mesaId: number): Promise<void> {
    try {
        // Validación básica
        if (!mesaId) throw new Error('ID de mesa inválido para liberar');

        // 1. Marcar pedido como pagado (ya corregido arriba con .select())
        await this.cambiarEstadoPedido(pedidoId, 'pagado');
        
        // 2. Liberar mesa
        const { error } = await this.supabase.supabase
        .from('mesas')
        .update({ estado: 'libre' }) 
        .eq('id', mesaId)
        .select(); // <--- CORRECCIÓN CRÍTICA: Agregado .select() aquí también

        if (error) {
          console.error('ERROR SUPABASE AL LIBERAR MESA:', JSON.stringify(error));
          throw error;
        }

    } catch (error) {
        console.error('Error en confirmarPagoYLibearMesa:', error);
        throw error;
    }
  }

  // --- SECTORES (Cocina/Bar) ---

  async obtenerPendientesPorSector(tipos: string[]): Promise<DetallePedido[]> {
    const { data, error } = await this.supabase.supabase
      .from('detalles_pedido')
      .select(`
        *,
        menu!inner(nombre, tipo, foto_url),
        pedido:pedidos!inner(
          id, mesa_id, fecha_creacion, estado,
          mesa:mesas(numero)
        )
      `)
      .eq('pedido.estado', 'confirmado') 
      .in('menu.tipo', tipos)
      .neq('estado', 'listo') 
      .order('fecha_creacion', { ascending: true });

    if (error) {
        console.error('Error fetching sector:', JSON.stringify(error));
        return [];
    }
    return data || [];
  }

  async actualizarEstadoDetalle(detalleId: number, nuevoEstado: 'preparacion' | 'listo'): Promise<void> {
    const { error } = await this.supabase.supabase
      .from('detalles_pedido')
      .update({ estado: nuevoEstado })
      .eq('id', detalleId)
      .select(); // <--- CORRECCIÓN CRÍTICA: Agregado .select()

    if (error) throw error;

    if (nuevoEstado === 'listo') {
      await this.verificarYCompletarPedido(detalleId);
    }
  }

  private async verificarYCompletarPedido(detalleId: number) {
    const { data: detalle } = await this.supabase.supabase
      .from('detalles_pedido')
      .select('pedido_id')
      .eq('id', detalleId)
      .single();

    if (!detalle) return;

    const { data: pendientes } = await this.supabase.supabase
      .from('detalles_pedido')
      .select('id')
      .eq('pedido_id', detalle.pedido_id)
      .neq('estado', 'listo');

    if (!pendientes || pendientes.length === 0) {
      console.log('Pedido completado! Cambiando estado padre...');
      await this.cambiarEstadoPedido(detalle.pedido_id, 'listo');
    }
  }
}