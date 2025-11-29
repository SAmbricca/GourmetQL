import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase';
import { MenuService, Pedido } from './menu';

export interface DireccionDelivery {
  direccion: string;
  coords?: { lat: number; lng: number };
  aclaraciones?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DeliveryService {
  
  // Estado reactivo para guardar la dirección mientras navega al menú
  private direccionActualSubject = new BehaviorSubject<DireccionDelivery | null>(null);
  direccionActual$ = this.direccionActualSubject.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private menuService: MenuService
  ) {}

  setDireccion(direccion: DireccionDelivery) {
    this.direccionActualSubject.next(direccion);
  }

  getDireccionActual(): DireccionDelivery | null {
    return this.direccionActualSubject.value;
  }

  // Wrapper para crear el pedido con los datos de delivery
  async crearPedidoDelivery(pedidoBase: Pedido, direccion: DireccionDelivery) {
    // Ajustamos el objeto pedido para que coincida con la nueva estructura de DB
    const pedidoDelivery = {
      ...pedidoBase,
      mesa_id: null, // Importante: null para delivery
      // Campos adicionales que manejaremos en el insert manual o modificando el servicio menu
      // Nota: Como MenuService espera un tipo Pedido estricto, 
      // pasamos los datos extra en el insert directo o extendemos la interfaz.
      // Aquí haremos la llamada directa a Supabase para tener control total de los campos nuevos.
    };

    try {
      // 1. Insertar Cabecera
      const { data: pedidoData, error: insertError } = await this.supabaseService.supabase
        .from('pedidos')
        .insert({
          cliente_id: pedidoDelivery.cliente_id,
          cliente_anonimo_id: pedidoDelivery.cliente_anonimo_id,
          estado: 'pendiente', // O 'confirmado' según tu flujo
          total: pedidoDelivery.total,
          tipo_servicio: 'delivery',
          direccion_envio: direccion.direccion,
          ubicacion_envio: direccion.coords,
          // costo_envio: 200 (ejemplo)
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // 2. Insertar Detalles (Reutilizamos la lógica de items)
      if (pedidoDelivery.items && pedidoDelivery.items.length > 0) {
        const detalles = pedidoDelivery.items.map(item => ({
          pedido_id: pedidoData.id,
          producto_id: item.menu.id,
          cantidad: item.cantidad,
          precio_unitario: item.menu.precio,
          estado: 'pendiente'
        }));

        const { error: detallesError } = await this.supabaseService.supabase
          .from('detalles_pedido')
          .insert(detalles);

        if (detallesError) throw detallesError;
      }

      return { success: true, pedido_id: pedidoData.id };

    } catch (error: any) {
      console.error('Error creando delivery:', error);
      return { success: false, message: error.message };
    }
  }
}