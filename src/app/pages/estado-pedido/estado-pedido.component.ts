import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { addIcons } from 'ionicons';
import { 
  arrowBackOutline, timeOutline, checkmarkCircleOutline, 
  hourglassOutline, flameOutline, bagCheckOutline 
} from 'ionicons/icons';

@Component({
  selector: 'app-estado-pedido',
  templateUrl: './estado-pedido.component.html',
  styleUrls: ['./estado-pedido.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class EstadoPedidoComponent implements OnInit {
  pedidoId: number = 0;
  mesaId: number = 0;
  numeroMesa: number = 0;
  
  pedido: any = null;
  cargando: boolean = true;
  total: number = 0;

  private supabase = inject(SupabaseService).supabase;
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  constructor() {
    addIcons({ 
      arrowBackOutline, timeOutline, checkmarkCircleOutline, 
      hourglassOutline, flameOutline, bagCheckOutline 
    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['pedidoId']) {
        this.pedidoId = Number(params['pedidoId']);
        this.mesaId = Number(params['mesaId']);
        this.numeroMesa = Number(params['numeroMesa']);
        this.cargarDetallePedido();
      } else {
        this.volver();
      }
    });
  }

  async cargarDetallePedido() {
    this.cargando = true;
    try {
      // 1. Query corregida (sin tiempo_estimado y con relación correcta)
      const { data, error } = await this.supabase
        .from('pedidos')
        .select(`
          id,
          estado,
          total,
          detalles_pedido (
            id,
            cantidad,
            precio_unitario,
            estado,
            menu:producto_id (
              nombre,
              foto_url,
              descripcion,
              tiempo_elaboracion
            )
          )
        `)
        .eq('id', this.pedidoId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // 2. Procesamos los datos antes de asignarlos
        this.pedido = this.procesarDatosPedido(data);
        this.total = data.total;
      }

    } catch (error: any) {
      console.error('Error cargando detalle', JSON.stringify(error, null, 2));
    } finally {
      this.cargando = false;
    }
  }

  private procesarDatosPedido(data: any): any {
    if (!data.detalles_pedido) return data;

    const tiempos = data.detalles_pedido.map((d: any) => d.menu?.tiempo_elaboracion || 0);
    const tiempoMaximo = tiempos.length > 0 ? Math.max(...tiempos) : 0;
    data.tiempo_estimado = tiempoMaximo;

    data.detalles_pedido = data.detalles_pedido.map((detalle: any) => {
      if (detalle.menu && detalle.menu.foto_url) {
        detalle.menu.foto_url = this.parsearFotos(detalle.menu.foto_url);
      }
      return detalle;
    });

    return data;
  }

  private parsearFotos(fotoUrl: any): string[] {
    try {
      if (typeof fotoUrl === 'string') return JSON.parse(fotoUrl);
      if (Array.isArray(fotoUrl)) return fotoUrl;
      return [];
    } catch (error) {
      return ['assets/placeholder.jpg'];
    }
  }

  getImagenProducto(detalle: any): string {
    if (detalle.menu && detalle.menu.foto_url && detalle.menu.foto_url.length > 0) {
      return detalle.menu.foto_url[0];
    }
    return 'assets/placeholder.jpg';
  }

  getIconoEstadoProducto(estado: string): string {
    switch (estado) {
      case 'pendiente': return 'hourglass-outline';
      case 'preparacion': return 'flame-outline'; 
      case 'listo': return 'checkmark-circle-outline';
      default: return 'ellipse-outline';
    }
  }

  getColorEstadoProducto(estado: string): string {
    switch (estado) {
      case 'pendiente': return 'medium';
      case 'preparacion': return 'warning';
      case 'listo': return 'success';
      default: return 'primary';
    }
  }

  volver() {
    this.router.navigate(['/mesa-opciones'], {
      queryParams: { 
        pedidoId: this.pedidoId, 
        mesaId: this.mesaId, 
        numeroMesa: this.numeroMesa,
        estado: this.pedido?.estado // Pasamos el estado para UI optimista
      }
    });
  }
}