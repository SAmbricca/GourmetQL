import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase';

@Injectable({
  providedIn: 'root'
})
export class Games {

  constructor(private supabaseService: SupabaseService) {}
 async registrarJuego(data: {
    pedido_id: number,
    cliente_id: number,
    tipo_juego: string,
    descuento_obtenido: number
  }) {
    const { supabase } = this.supabaseService;

    const { error } = await supabase
      .from('juegos')
      .insert(data);

    console.log("DATA ENVIADA:", data);
    console.log("ERROR:", error);

    if (error) {
      console.error('Error guardando juego:', error);
      throw error;
    }
  }
  //Buscamos al usuario que ya jugo por primera vez sea el resultado no se le aplique descuento
async obtenerJuegoPorPedidoYCliente(pedidoId: number, clienteId: number) {
    const { supabase } = this.supabaseService;

    const { data, error } = await supabase
      .from('juegos')
      .select('*')
      .eq('pedido_id', pedidoId)
      .eq('cliente_id', clienteId)
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return data;
  }  
}
