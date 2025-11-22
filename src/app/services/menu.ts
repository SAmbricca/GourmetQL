import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase';

export interface Menu {
  id: number;
  nombre: string;
  descripcion: string;
  tipo: 'comida' | 'bebida';
  tiempo_elaboracion: number;
  precio: number;
  foto_url: string[];
  activo: boolean;
  fecha_creacion: string;
}

export interface ItemPedido {
  menu: Menu;
  cantidad: number;
}

export interface Pedido {
  mesa_id: number;
  cliente_id?: number;
  cliente_anonimo_id?: number;
  estado: string;
  total: number;
  descuento: number;
  propina: number;
  items: ItemPedido[];
}

@Injectable({
  providedIn: 'root'
})
export class MenuService {

  constructor(private supabaseService: SupabaseService) {}

  async obtenerMenu(): Promise<{ success: boolean; data?: Menu[]; message?: string }> {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('menu')
        .select('*')
        .eq('activo', true)
        .order('tipo', { ascending: true })
        .order('nombre', { ascending: true });

      if (error) throw error;

      const menuConFotos = data.map(item => ({
        ...item,
        foto_url: this.parsearFotos(item.foto_url)
      }));

      return { success: true, data: menuConFotos };
    } catch (error) {
      return { success: false, message: 'Error al obtener el menú' };
    }
  }

  async obtenerDetallesPedido(pedidoId: number): Promise<ItemPedido[]> {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('detalles_pedido')
        .select(`
          cantidad,
          menu ( * )
        `)
        .eq('pedido_id', pedidoId);

      if (error) throw error;

      return data.map((detalle: any) => ({
        cantidad: detalle.cantidad,
        menu: {
          ...detalle.menu,
          foto_url: this.parsearFotos(detalle.menu.foto_url)
        }
      }));

    } catch (error) {
      console.error('Error recuperando detalles:', error);
      return [];
    }
  }

  // --- AQUÍ ESTÁ EL ARREGLO ---
  async crearPedido(pedido: Pedido): Promise<{ success: boolean; pedido_id?: number; message?: string }> {
    try {
      let pedidoId: number;

      // 1. Buscar pedido pendiente existente
      const { data: pedidoExistente, error: buscarError } = await this.supabaseService.supabase
        .from('pedidos')
        .select('id')
        .eq('mesa_id', pedido.mesa_id)
        .eq('estado', 'pendiente')
        .maybeSingle();

      if (buscarError) throw buscarError;

      if (pedidoExistente && pedidoExistente.id) {
        // --- ACTUALIZAR PEDIDO EXISTENTE ---
        pedidoId = pedidoExistente.id;

        const { error: updateError } = await this.supabaseService.supabase
          .from('pedidos')
          .update({
            total: Number(pedido.total),
            descuento: Number(pedido.descuento || 0),
            propina: Number(pedido.propina || 0),
            estado: 'realizado'
          })
          .eq('id', pedidoId)
          .select(); // <-- FIX IMPORTANTE: Obliga a devolver respuesta y evita el error de null body

        if (updateError) throw updateError;

        // Borrar detalles viejos
        const { error: deleteError } = await this.supabaseService.supabase
          .from('detalles_pedido')
          .delete()
          .eq('pedido_id', pedidoId)
          .select(); // <-- FIX IMPORTANTE: .select() también en delete por seguridad

        if (deleteError) throw deleteError;

      } else {
        // --- CREAR PEDIDO NUEVO ---
        // Limpiamos undefineds para evitar errores
        const nuevoPedido = {
          mesa_id: pedido.mesa_id,
          cliente_id: pedido.cliente_id || null,
          cliente_anonimo_id: pedido.cliente_anonimo_id || null,
          estado: 'realizado',
          total: Number(pedido.total),
          descuento: Number(pedido.descuento || 0),
          propina: Number(pedido.propina || 0)
        };

        const { data: pedidoData, error: insertError } = await this.supabaseService.supabase
          .from('pedidos')
          .insert(nuevoPedido)
          .select('id') // Aquí ya tenías el select, por eso este paso no fallaba
          .single();

        if (insertError) throw insertError;
        pedidoId = pedidoData.id;
      }

      // 2. Insertar los items (Detalles)
      // Verificamos que haya items para evitar errores
      if (pedido.items && pedido.items.length > 0) {
        const detallesParaInsertar = pedido.items.map(item => ({
          pedido_id: pedidoId,
          producto_id: item.menu.id,
          cantidad: item.cantidad,
          precio_unitario: Number(item.menu.precio),
          estado: 'pendiente'
        }));

        const { error: detallesError } = await this.supabaseService.supabase
          .from('detalles_pedido')
          .insert(detallesParaInsertar)
          .select(); // <-- FIX CRÍTICO: Aquí faltaba el select(). Esto causaba el error.

        if (detallesError) throw detallesError;
      }

      return { success: true, pedido_id: pedidoId, message: 'Pedido realizado!' };
      
    } catch (error: any) {
      console.error('❌ Error procesando pedido:', error);
      // Extraemos el mensaje real si viene anidado
      const msg = error.message || (error.error ? error.error.message : 'Error desconocido');
      return { success: false, message: msg };
    }
  }

  private parsearFotos(fotoUrl: any): string[] {
    try {
      if (typeof fotoUrl === 'string') return JSON.parse(fotoUrl);
      if (Array.isArray(fotoUrl)) return fotoUrl;
      return [];
    } catch (error) {
      return [];
    }
  }

  calcularTotalPedido(items: ItemPedido[]): number {
    return items.reduce((total, item) => total + (item.menu.precio * item.cantidad), 0);
  }

  calcularTiempoTotal(items: ItemPedido[]): number {
    if (items.length === 0) return 0;
    return Math.max(...items.map(item => item.menu.tiempo_elaboracion));
  }
}