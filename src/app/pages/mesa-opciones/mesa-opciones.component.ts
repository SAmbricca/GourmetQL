import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { ToastService } from '../../services/toast';
// 1. Importar el servicio de notificaciones
import { NotificacionesService } from '../../services/notificaciones';
import { Subscription, interval } from 'rxjs';
import { addIcons } from 'ionicons';
import { 
  gameControllerOutline, listOutline, chatbubblesOutline, 
  restaurantOutline, cashOutline, clipboardOutline, 
  timeOutline, checkmarkCircleOutline, warningOutline, bookOutline 
} from 'ionicons/icons';
import { EncuestasService } from '../../services/encuestas'; 

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
  yaJugoDescuento: boolean = false; // TODO: Recuperar de BD si ya ganó descuento

  private supabase = inject(SupabaseService).supabase;
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastService = inject(ToastService);
  private encuestasService = inject(EncuestasService);
  // 2. Inyectar NotificacionesService
  private notificacionesService = inject(NotificacionesService);

  constructor() {
    addIcons({ 
      gameControllerOutline, listOutline, chatbubblesOutline, 
      restaurantOutline, cashOutline, clipboardOutline, 
      timeOutline, checkmarkCircleOutline, warningOutline, bookOutline
    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['pedidoId']) {
        this.pedidoId = Number(params['pedidoId']);
        this.mesaId = Number(params['mesaId']);
        this.numeroMesa = Number(params['numeroMesa']);
        if (params['clienteNombre']) this.clienteNombre = params['clienteNombre'];
        
        if (params['estado']) {
           this.actualizarUI({
             estado: params['estado'],
             total: 0,
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
        const tiempos = data.detalles_pedido.map((d: any) => d.menu?.tiempo_elaboracion || 0);
        const maxTiempo = tiempos.length > 0 ? Math.max(...tiempos) : 0;

        this.actualizarUI({
            ...data,
            tiempo_estimado: maxTiempo
        });
      }
    } catch (error) {
      console.error('Error cargando pedido', JSON.stringify(error));
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
        console.log('Cambio en pedido:', payload.new);
        this.actualizarUI(payload.new);
        const nuevoEstado = payload.new['estado'] as string;
        
        this.toastService.mostrarToastInfo(`El estado de tu pedido cambió a: ${nuevoEstado.toUpperCase()}`);
      })
      .subscribe();
  }

  actualizarUI(data: any) {
    this.infoPedido = {
      estado: data.estado,
      total: data.total,
      tiempoEstimado: data.tiempo_estimado
    };

    // Lógica de visualización según estado (Puntos 14-19)
    switch (this.infoPedido.estado) {
      case 'confirmado':
      case 'preparacion':
        this.mostrarJuegos = true;
        this.mostrarEncuesta = false;
        this.mostrarCuenta = false;
        this.mostrarConfirmarEntrega = false;
        break;
        
      case 'listo':
        this.mostrarJuegos = true;
        this.mostrarConfirmarEntrega = true; // Mozo trae comida
        break;

      case 'entregado':
        this.mostrarConfirmarEntrega = false;
        this.mostrarJuegos = true; // Puede seguir jugando libremente
        this.mostrarEncuesta = true;
        this.mostrarCuenta = true;
        break;

      case 'pagado':
        this.router.navigate(['/home-anonimo']); // O pantalla despedida
        break;
    }
  }

  // --- ACCIONES ---

  irAlChat() {
    this.router.navigate(['/consulta-mozo'], {
      queryParams: { pedidoId: this.pedidoId, mesaId: this.mesaId, numeroMesa: this.numeroMesa }
    });
  }

  irAJuegos() {
    // Punto 15: Verificar si ya ganó descuento
    this.router.navigate(['/juegos-dashboard'], {
      queryParams: { pedidoId: this.pedidoId, anonimo: false } // Anónimo NO gana descuento según PDF
    });
  }

  async irAEncuesta() {
    // 2. Consultar BD si ya existe la encuesta
    const yaExiste = await this.encuestasService.verificarEncuestaExistente(this.pedidoId);

    if (yaExiste) {
      this.toastService.mostrarToastInfo('Ya realizaste la encuesta, navegando a todas las encuestas');
      this.router.navigate(['/encuesta-resultados']);
    } else {
      this.router.navigate(['/encuesta-alta'], {
        queryParams: { pedidoId: this.pedidoId }
      });
    }
  }

  irAlMenu() {
    // Asumo que tu ruta de menú es '/menu' o '/home' filtrado. 
    // Ajusta la ruta según tu configuración de rutas.
    this.router.navigate(['/menu-cliente'], { // O la ruta que uses para mostrar la carta
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
    // Punto 19: Cliente confirma recepción
    this.mostrarConfirmarEntrega = false;
    this.mostrarEncuesta = true;
    this.mostrarCuenta = true;
    this.toastService.mostrarToastExito('¡Que lo disfrutes!');
  }

  async pedirCuenta() {
    // -------------------------------------------------------------------------
    // 3. Notificar al Mozo
    // -------------------------------------------------------------------------
    try {
      const { data: mozos } = await this.supabase
        .from('usuarios')
        .select('id')
        .eq('perfil', 'mozo')
        .eq('estado', 'habilitado');

      if (mozos && mozos.length > 0) {
        const promesas = mozos.map(m => 
           this.notificacionesService.enviarNotificacion({
              tipo: 'consulta_mozo' as any, // Reutilizamos el tipo consulta
              titulo: 'Solicitud de Cuenta',
              mensaje: `La Mesa ${this.numeroMesa} ha solicitado la cuenta.`,
              destinatario_id: m.id,
              destinatario_perfil: 'mozo',
              datos: { 
                 pedido_id: this.pedidoId,
                 accion: 'cobrar'
              }
           })
        );
        await Promise.all(promesas);
        
        this.toastService.mostrarToastExito('Se ha notificado al mozo.');
      }
    } catch (error) {
      console.error('Error al notificar pedido de cuenta:', error);
      // No bloqueamos la navegación si falla la notificación
    }
    // -------------------------------------------------------------------------

    this.router.navigate(['/pedir-cuenta'], {
      queryParams: { pedidoId: this.pedidoId, total: this.infoPedido?.total }
    });
  }

  // --- HELPERS VISUALES ---

  get textoEstado(): string {
    switch (this.infoPedido?.estado) {
      case 'confirmado': return 'Pedido Confirmado';
      case 'preparacion': return 'En Cocina';
      case 'listo': return '¡Listo para servir!';
      case 'entregado': return 'Disfrutando';
      default: return 'Sin realizar';
    }
  }

  get colorEstado(): string {
    switch (this.infoPedido?.estado) {
      case 'confirmado': return 'warning';
      case 'preparacion': return 'secondary';
      case 'listo': return 'success';
      case 'entregado': return 'primary';
      default: return 'medium';
    }
  }

  get porcentajeProgreso(): number {
    switch (this.infoPedido?.estado) {
      case 'pendiente': return 0.1;
      case 'confirmado': return 0.3;
      case 'preparacion': return 0.6;
      case 'listo': return 0.9;
      case 'entregado': return 1;
      default: return 0;
    }
  }
}