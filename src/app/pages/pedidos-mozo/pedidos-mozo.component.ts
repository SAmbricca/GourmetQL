import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonButton, IonSegment, IonSegmentButton, IonLabel, IonCard, 
  IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, 
  IonBadge, IonRefresher, IonRefresherContent, IonIcon, IonSpinner
} from '@ionic/angular/standalone';
import { PedidosService } from '../../services/pedidos';
import { ToastService } from '../../services/toast';
import { Router } from '@angular/router';
import { NotificacionesService, NotificacionTiempoReal } from '../../services/notificaciones';
import { FacturaService } from '../../services/factura';
import { SupabaseService } from '../../services/supabase';
import { addIcons } from 'ionicons';
// Agregamos iconos para delivery: bicycle, location, home
import { checkmarkDoneOutline, cashOutline, mailOutline, documentTextOutline, bicycleOutline, locationOutline, restaurantOutline } from 'ionicons/icons';
import { Email } from '../../services/email';

@Component({
  selector: 'app-pedidos-mozo',
  templateUrl: './pedidos-mozo.component.html',
  styleUrls: ['./pedidos-mozo.component.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
    IonButton, IonSegment, IonSegmentButton, IonLabel, IonCard, 
    IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, 
    IonBadge, IonRefresher, IonRefresherContent, IonIcon, IonSpinner
  ]
})
export class PedidosMozoComponent implements OnInit {
  segmentoActual: string = 'nuevos';
  pedidosNuevos: any[] = [];
  pedidosEnCurso: any[] = [];
  cargando: boolean = false;
  procesandoPagoId: number | null = null;

  constructor(
    private pedidosService: PedidosService,
    private toastService: ToastService,
    private router: Router,
    private notificacionesService: NotificacionesService,
    private facturaService: FacturaService,
    private supabaseService: SupabaseService,
    private emailService: Email
  ) {
    // Registramos los nuevos iconos
    addIcons({ checkmarkDoneOutline, cashOutline, mailOutline, documentTextOutline, bicycleOutline, locationOutline, restaurantOutline });
  }

  async ngOnInit() {
    await this.cargarPedidos();
  }

  async cargarPedidos() {
    this.cargando = true;
    try {
      const [nuevos, enCurso] = await Promise.all([
        this.pedidosService.obtenerPedidosPorEstado(['realizado']),
        this.pedidosService.obtenerPedidosPorEstado(['confirmado', 'listo', 'entregado', 'pagado']) 
      ]);
      
      this.pedidosNuevos = nuevos;
      this.pedidosEnCurso = enCurso;

    } catch (error) {
      console.error('Error cargando pedidos:', error);
    } finally {
      this.cargando = false;
    }
  }

  // --- HELPERS VISUALES ---
  esDelivery(pedido: any): boolean {
    return pedido.tipo_servicio === 'delivery';
  }

  getIdentificadorPedido(pedido: any): string {
    if (this.esDelivery(pedido)) {
      return 'Delivery';
    }
    return `Mesa ${pedido.mesa?.numero || '?'}`;
  }

  getDetalleUbicacion(pedido: any): string {
    if (this.esDelivery(pedido)) {
      return pedido.direccion_envio || 'Dirección no especificada';
    }
    return 'Salón Principal';
  }

  private async notificarCambioEstado(pedido: any, tipo: NotificacionTiempoReal['tipo'], titulo: string, mensaje: string, datosExtra: any = {}) {
      let destinatarioId: number | null = null;
      let perfilDestino: 'cliente' | 'cliente_anonimo' = 'cliente';

      if (pedido.cliente_id) {
          destinatarioId = pedido.cliente_id;
          perfilDestino = 'cliente';
      } else if (pedido.cliente_anonimo_id) {
          destinatarioId = pedido.cliente_anonimo_id;
          perfilDestino = 'cliente_anonimo';
      }

      if (destinatarioId) {
          await this.notificacionesService.enviarNotificacion({
              tipo: tipo,
              titulo: titulo,
              mensaje: mensaje,
              destinatario_id: destinatarioId,
              destinatario_perfil: perfilDestino,
              datos: { pedido_id: pedido.id, ...datosExtra }
          });
      }
  }

  async confirmarPedido(pedido: any) {
    try {
      await this.pedidosService.cambiarEstadoPedido(pedido.id, 'confirmado');
      const textoIdentificador = this.getIdentificadorPedido(pedido);
      this.toastService.mostrarToastExito(`${textoIdentificador}: Pedido confirmado`);
      
      await this.notificarCambioEstado(
          pedido, 
          'pedido_aceptado', 
          '¡Pedido Confirmado!', 
          'El mozo ha confirmado tu pedido y está en preparación.'
      );

      this.cargarPedidos(); 
    } catch (error: any) {
      console.error('Error confirmando:', error);
      this.toastService.mostrarToastError('No se pudo confirmar el pedido');
    }
  }

  async rechazarPedido(pedido: any) {
    try {
      await this.pedidosService.cambiarEstadoPedido(pedido.id, 'pendiente'); 
      this.toastService.mostrarToastAdvertencia(`Pedido devuelto al cliente`);
      
      await this.notificarCambioEstado(
          pedido, 
          'pedido_rechazado', 
          'Pedido Observado', 
          'El mozo ha devuelto tu pedido. Por favor revisalo o consulta al local.'
      );

      this.cargarPedidos();
    } catch (error) {
      this.toastService.mostrarToastError('Error al rechazar');
    }
  }

  async entregarPedido(pedido: any) {
    try {
      // Si es delivery, "entregar" significa que sale para envio o se entrega al delivery
      const nuevoEstado = 'entregado'; 
      await this.pedidosService.cambiarEstadoPedido(pedido.id, nuevoEstado);
      
      const mensajeExito = this.esDelivery(pedido) ? 'Pedido enviado a domicilio' : 'Pedido entregado en mesa';
      this.toastService.mostrarToastExito(mensajeExito);
      
      await this.notificarCambioEstado(
          pedido, 
          'pedido_aceptado', 
          this.esDelivery(pedido) ? '¡En camino!' : '¡A comer!', 
          this.esDelivery(pedido) ? 'Tu pedido ha salido hacia tu domicilio.' : 'Tu pedido ha sido entregado a la mesa.'
      );

      this.cargarPedidos();
    } catch (error) {
      this.toastService.mostrarToastError('Error al entregar');
    }
  }

  async cobrarYLiberar(pedido: any) {
    if (this.procesandoPagoId === pedido.id) return;
    this.procesandoPagoId = pedido.id;

    try {
      this.toastService.mostrarToastExito('Generando factura y procesando cobro...');
      
      // 1. Generar el BLOB del PDF
      const pdfBlob = await this.facturaService.generarPDFBlob(pedido);

      // 2. Lógica para Cliente Registrado (Envío de Email)
      if (pedido.cliente && pedido.cliente.email) {
        
        // A. Subir PDF a Supabase Storage
        const urlFactura = await this.facturaService.subirFacturaStorage(pdfBlob, pedido.id);
        
        if (urlFactura) {
            // B. Enviar Email con el link
            const enviado = await this.emailService.enviarFactura(
                pedido.cliente, 
                urlFactura, 
                pedido.total
            );
            
            if (enviado) {
                this.toastService.mostrarToastExito(`Factura enviada a ${pedido.cliente.email}`);
            } else {
                this.toastService.mostrarToastAdvertencia('No se pudo enviar el email de la factura');
            }
        }
      }
      // Notificar Admin
      const { data: administradores } = await this.supabaseService.supabase
        .from('usuarios')
        .select('id, perfil')
        .in('perfil', ['dueño', 'supervisor'])
        .eq('estado', 'habilitado');

      if (administradores && administradores.length > 0) {
          const totalCobrado = pedido.total || 0;
          const identificador = this.getIdentificadorPedido(pedido);
          
          const promesasAdmins = administradores.map((admin: any) => 
              this.notificacionesService.enviarNotificacion({
                  tipo: 'mesa_liberada', // Reutilizamos el tipo 'mesa_liberada' aunque sea delivery para que llegue al admin
                  titulo: `${identificador} Cobrado`,
                  mensaje: `Se cobraron $${totalCobrado} del ${identificador}.`,
                  destinatario_id: admin.id,
                  destinatario_perfil: admin.perfil,
                  datos: { pedido_id: pedido.id }
              })
          );
          await Promise.all(promesasAdmins);
      }

      // Notificar Cliente Anónimo
      if (pedido.cliente_anonimo_id) {
          await this.notificacionesService.enviarNotificacion({
              tipo: 'factura_disponible' as any, 
              titulo: '¡Gracias por su compra!',
              mensaje: 'Presiona la notificación para descargar su factura.',
              destinatario_id: pedido.cliente_anonimo_id,
              destinatario_perfil: 'cliente_anonimo',
              datos: { pedido_id: pedido.id, accion: 'descargar_pdf' }
          });
      }
 
      // LOGICA CRÍTICA: MESA VS DELIVERY
      if (this.esDelivery(pedido)) {
          // Delivery: Solo marcamos como pagado, no intentamos liberar mesa (porque mesa_id es null)
          await this.pedidosService.cambiarEstadoPedido(pedido.id, 'pagado');
          this.toastService.mostrarToastExito(`Delivery finalizado y cobrado.`);
      } else {
          // Mesa: Usamos el método existente que libera la mesa
          await this.pedidosService.confirmarPagoYLibearMesa(pedido.id, pedido.mesa_id);
          this.toastService.mostrarToastExito(`Mesa ${pedido.mesa.numero} liberada y facturada.`);
      }
      
      await this.cargarPedidos();

    } catch (error) {
      console.error('Error en cobrarYLiberar:', error);
      this.toastService.mostrarToastError('Error al procesar el cobro.');
    } finally {
      this.procesandoPagoId = null;
    }
  }

  handleRefresh(event: any) {
    this.cargarPedidos().then(() => event.target.complete());
  }

  volver() {
    this.router.navigate(['/home']);
  }
}