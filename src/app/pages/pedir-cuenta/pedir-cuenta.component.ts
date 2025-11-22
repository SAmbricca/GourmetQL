import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase';
import { ToastService } from '../../services/toast';
import { EscaneoQRService } from '../../services/escaneo-qr';
// 1. Importar NotificacionesService
import { NotificacionesService } from '../../services/notificaciones';
import { addIcons } from 'ionicons';
import { 
  receiptOutline, cashOutline, qrCodeOutline, 
  walletOutline, checkmarkCircleOutline, arrowBackOutline,
  happyOutline, sadOutline 
} from 'ionicons/icons';

interface DetalleItem {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  importe: number;
}

@Component({
  selector: 'app-pedir-cuenta',
  templateUrl: './pedir-cuenta.component.html',
  styleUrls: ['./pedir-cuenta.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class PedirCuentaComponent implements OnInit {
  private supabase = inject(SupabaseService).supabase;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private escaneoService = inject(EscaneoQRService);
  private navCtrl = inject(NavController);
  // 2. Inyectar el servicio
  private notificacionesService = inject(NotificacionesService);

  pedidoId: number = 0;
  totalPedido: number = 0; 
  subtotal: number = 0;    
  descuentoJuego: number = 0; 
  
  // Variables de Propina
  propina: number = 0;
  propinaPorcentaje: number = 0; // Para el range slider (0-20%)
  
  listaItems: DetalleItem[] = [];
  loading: boolean = true;
  propinaHabilitada: boolean = false;
  procesandoPago: boolean = false;

  constructor() {
    addIcons({ 
      receiptOutline, cashOutline, qrCodeOutline, 
      walletOutline, checkmarkCircleOutline, arrowBackOutline,
      happyOutline, sadOutline 
    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['pedidoId']) {
        this.pedidoId = Number(params['pedidoId']);
        this.cargarDetalleCuenta();
      } else {
        this.navCtrl.back();
      }
    });
  }

  async cargarDetalleCuenta() {
    this.loading = true;
    try {
      const { data: detalles, error: errorDetalles } = await this.supabase
        .from('detalles_pedido')
        .select(`cantidad, precio_unitario, producto:menu ( nombre )`)
        .eq('pedido_id', this.pedidoId)
        .in('estado', ['entregado', 'listo']);

      if (errorDetalles) throw errorDetalles;

      this.listaItems = detalles.map((d: any) => ({
        nombre: d.producto.nombre,
        cantidad: d.cantidad,
        precioUnitario: d.precio_unitario,
        importe: d.cantidad * d.precio_unitario
      }));

      this.subtotal = this.listaItems.reduce((acc, item) => acc + item.importe, 0);

      const { data: pedido, error: errorPedido } = await this.supabase
        .from('pedidos')
        .select('descuento')
        .eq('id', this.pedidoId)
        .single();

      if (!errorPedido) this.descuentoJuego = pedido.descuento || 0;
      
      this.calcularTotal();

    } catch (error) {
      this.toastService.mostrarToastError('Error al cargar detalle.');
    } finally {
      this.loading = false;
    }
  }

  calcularTotal() {
    let calculo = this.subtotal - this.descuentoJuego + this.propina;
    this.totalPedido = calculo > 0 ? calculo : 0;
  }

  async escanearQRPropina() {
    const resultado = await this.escaneoService.escanearCodigoQR();

    if (resultado.exito && resultado.datos) {
      if (resultado.datos.contenidoCompleto === 'PROPINA_CLIENTE' || resultado.datos.contenidoCompleto.includes('MESA_')) {
        this.propinaHabilitada = true;
        this.toastService.mostrarToastExito('¡Ingreso de propina habilitado!');
        this.cambiarPorcentajePropina(10);
      } else {
        this.toastService.mostrarToastError('QR inválido para propinas.');
      }
    }
  }

  alCambiarSlider(event: any) {
    this.propinaPorcentaje = event.detail.value;
    this.propina = Math.round(this.subtotal * (this.propinaPorcentaje / 100));
    this.calcularTotal();
  }

  cambiarPorcentajePropina(porcentaje: number) {
    this.propinaPorcentaje = porcentaje;
    this.propina = Math.round(this.subtotal * (porcentaje / 100));
    this.calcularTotal();
  }

  alCambiarMontoManual() {
    if (this.propina < 0) this.propina = 0;
    this.calcularTotal();
    this.propinaPorcentaje = 0; 
  }

  async realizarPago() {
    this.procesandoPago = true;
    try {
      const { error } = await this.supabase
        .from('pedidos')
        .update({
          estado: 'pagado',
          total: this.totalPedido,
          propina: this.propina
        })
        .eq('id', this.pedidoId);

      if (error) throw error;

      // ----------------------------------------------------------------------
      // 3. Notificación a Mozos, Dueños y Supervisores
      // ----------------------------------------------------------------------
      try {
        // CAMBIO: Usamos .in() para seleccionar múltiples perfiles
        const { data: staff } = await this.supabase
          .from('usuarios')
          .select('id, perfil') // Traemos el perfil también para registrarlo bien
          .in('perfil', ['mozo', 'dueño', 'supervisor']) 
          .eq('estado', 'habilitado');

        if (staff && staff.length > 0) {
          const promesas = staff.map(usuario => 
             this.notificacionesService.enviarNotificacion({
                tipo: 'pedido_aceptado' as any, // O un tipo 'pago_realizado' si prefieres
                titulo: '¡Pago Recibido!',
                mensaje: `Se ha registrado un pago de $${this.totalPedido} (Propina: $${this.propina}).`,
                destinatario_id: usuario.id,
                destinatario_perfil: usuario.perfil, // Asignamos el perfil dinámicamente
                datos: { 
                   pedido_id: this.pedidoId,
                   accion: 'liberar_mesa'
                }
             })
          );
          await Promise.all(promesas);
        }
      } catch (notifError) {
        console.error('Error al notificar pago al staff:', notifError);
      }
      // ----------------------------------------------------------------------

      this.toastService.mostrarToastExito('¡Pago realizado con éxito!');
      this.router.navigate(['/home-anonimo']); 

    } catch (error) {
      console.error(error);
      this.toastService.mostrarToastError('Error al procesar pago.');
    } finally {
      this.procesandoPago = false;
    }
  }

  volver() {
    this.navCtrl.back();
  }
}