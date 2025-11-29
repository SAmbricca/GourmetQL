import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { ToastService } from '../../services/toast';
import { NotificacionesService } from '../../services/notificaciones';
import { EncuestasService } from '../../services/encuestas'; 
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { 
  gameControllerOutline, listOutline, chatbubblesOutline, 
  restaurantOutline, cashOutline, clipboardOutline, 
  timeOutline, checkmarkCircleOutline, warningOutline, 
  bookOutline, chevronForwardOutline, starOutline, // <--- AGREGADO
  receiptOutline, personCircleOutline, arrowBackOutline // <--- AGREGADO
} from 'ionicons/icons';

interface EstadoPedido {
  estado: 'pendiente' | 'confirmado' | 'preparacion' | 'listo' | 'entregado' | 'pagado';
  tiempoEstimado?: number;
  total?: number;
}

@Component({
  selector: 'app-mesa-opciones',
  templateUrl: './mesa-opciones.component.html',
  styleUrls: ['./mesa-opciones.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class MesaOpcionesComponent implements OnInit, OnDestroy {
  // Datos de navegación
  mesaId: number = 0;
  numeroMesa: number = 0;
  pedidoId: number = 0;
  clienteNombre: string = 'Cliente';

  // Estado
  infoPedido: EstadoPedido | null = null;
  cargando: boolean = true;
  pedidoSubscription: Subscription | null = null;
  
  // Banderas de control UI
  mostrarConfirmarEntrega: boolean = false;
  mostrarJuegos: boolean = false;
  mostrarEncuesta: boolean = false;
  mostrarCuenta: boolean = false;
  
  private supabase = inject(SupabaseService).supabase;
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastService = inject(ToastService);
  private encuestasService = inject(EncuestasService);
  private notificacionesService = inject(NotificacionesService);

  constructor() {
    // REGISTRO COMPLETO DE ICONOS
    addIcons({ 
      gameControllerOutline, listOutline, chatbubblesOutline, 
      restaurantOutline, cashOutline, clipboardOutline, 
      timeOutline, checkmarkCircleOutline, warningOutline, bookOutline,
      chevronForwardOutline, starOutline, receiptOutline, personCircleOutline, arrowBackOutline
    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['pedidoId']) {
        this.pedidoId = Number(params['pedidoId']);
        this.mesaId = Number(params['mesaId']);
        this.numeroMesa = Number(params['numeroMesa']);
        if (params['clienteNombre']) this.clienteNombre = params['clienteNombre'];
        
        // Carga inicial rápida si vienen parámetros
        if (params['estado']) {
           this.actualizarUI({
             estado: params['estado'],
             total: params['total'] || 0,
             tiempo_estimado: 0
           });
        }

        this.cargarDatosPedido();
        this.suscribirseACambiosPedido();
      } else {
        this.router.navigate(['/home-anonimo']);
      }
    });
  }

  ngOnDestroy() {
    if (this.pedidoSubscription) {
      this.pedidoSubscription.unsubscribe();
    }
    this.supabase.removeAllChannels();
  }

  async cargarDatosPedido() {
    this.cargando = true;
    try {
      const { data, error } = await this.supabase
        .from('pedidos')
        .select(`
           estado, 
           total, 
           detalles_pedido(
             menu:producto_id(tiempo_elaboracion)
           )
        `) 
        .eq('id', this.pedidoId)
        .single();

      if (data) {
        const tiempos = data.detalles_pedido?.map((d: any) => d.menu?.tiempo_elaboracion || 0) || [];
        const maxTiempo = tiempos.length > 0 ? Math.max(...tiempos) : 0;

        this.actualizarUI({
            ...data,
            tiempo_estimado: maxTiempo
        });
      }
    } catch (error) {
      console.error('Error cargando pedido', error);
    } finally {
      this.cargando = false;
    }
  }

  suscribirseACambiosPedido() {
    this.supabase
      .channel(`pedido-${this.pedidoId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'pedidos', 
        filter: `id=eq.${this.pedidoId}` 
      }, (payload) => {
        this.actualizarUI(payload.new);
        const nuevoEstado = payload.new['estado'] as string;
        this.toastService.mostrarToastInfo(`Estado actualizado: ${nuevoEstado.toUpperCase()}`);
      })
      .subscribe();
  }

  actualizarUI(data: any) {
    this.infoPedido = {
      estado: data.estado,
      total: data.total,
      tiempoEstimado: data.tiempo_estimado
    };

    // Lógica de visualización (Estado puro)
    switch (this.infoPedido.estado) {
      case 'pendiente':
        this.mostrarJuegos = false;
        break;
      case 'confirmado':
      case 'preparacion':
        this.mostrarJuegos = true;
        this.mostrarEncuesta = false;
        this.mostrarCuenta = false;
        this.mostrarConfirmarEntrega = false;
        break;
        
      case 'listo':
        this.mostrarJuegos = true;
        this.mostrarConfirmarEntrega = true; 
        break;

      case 'entregado':
        this.mostrarConfirmarEntrega = false;
        this.mostrarJuegos = true;
        this.mostrarEncuesta = true;
        this.mostrarCuenta = true;
        break;

      case 'pagado':
        this.router.navigate(['/home-anonimo']);
        break;
    }
  }

  // --- ACCIONES DE NAVEGACIÓN ---

  irAlChat() {
    this.router.navigate(['/consulta-mozo'], {
      queryParams: { pedidoId: this.pedidoId, mesaId: this.mesaId, numeroMesa: this.numeroMesa }
    });
  }

  irAJuegos() {
    this.router.navigate(['/juegos-dashboard'], {
      queryParams: { pedidoId: this.pedidoId, anonimo: false }
    });
  }

  async irAEncuesta() {
    const yaExiste = await this.encuestasService.verificarEncuestaExistente(this.pedidoId);
    if (yaExiste) {
      this.toastService.mostrarToastInfo('Encuesta ya realizada. Podes ver todas las encuestas');
      this.router.navigate(['/encuesta-resultados']);
    } else {
      this.router.navigate(['/encuesta-alta'], {
        queryParams: { pedidoId: this.pedidoId }
      });
    }
  }

  irAlMenu() {
    this.router.navigate(['/menu-cliente'], { 
       queryParams: { mesaId: this.mesaId, numeroMesa: this.numeroMesa, pedidoId: this.pedidoId }
    });
  }

  verDetallePedido() {
    this.router.navigate(['/estado-pedido'], {
      queryParams: { 
        pedidoId: this.pedidoId,
        mesaId: this.mesaId,
        numeroMesa: this.numeroMesa
      }
    });
  }

  confirmarRecepcion() {
    this.mostrarConfirmarEntrega = false;
    this.mostrarEncuesta = true;
    this.mostrarCuenta = true;
    this.toastService.mostrarToastExito('¡Que lo disfrutes!');
  }

  async pedirCuenta() {
    try {
      const { data: mozos } = await this.supabase
        .from('usuarios')
        .select('id')
        .eq('perfil', 'mozo')
        .eq('estado', 'habilitado'); // Asumiendo que existe estado habilitado/trabajando

      if (mozos && mozos.length > 0) {
        const promesas = mozos.map(m => 
           this.notificacionesService.enviarNotificacion({
             tipo: 'consulta_mozo' as any,
             titulo: 'Solicitud de Cuenta',
             mensaje: `Mesa ${this.numeroMesa} pide la cuenta.`,
             destinatario_id: m.id,
             destinatario_perfil: 'mozo',
             datos: { pedido_id: this.pedidoId, accion: 'cobrar' }
           })
        );
        await Promise.all(promesas);
        this.toastService.mostrarToastExito('Mozo notificado.');
      }
    } catch (error) {
      console.error('Error notificando mozo:', error);
    }
    
    // Navegar aunque falle la notificación
    this.router.navigate(['/pedir-cuenta'], {
      queryParams: { pedidoId: this.pedidoId, total: this.infoPedido?.total }
    });
  }
}