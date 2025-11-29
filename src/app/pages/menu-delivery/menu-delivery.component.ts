import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { 
  IonContent, IonHeader, IonToolbar, IonButton, 
  IonIcon, IonBadge, IonSpinner, Platform, IonTitle, IonButtons
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  timeOutline, removeCircleOutline, addCircleOutline, 
  arrowBackCircle, phonePortraitOutline, swapHorizontalOutline,
  removeOutline, addOutline
} from 'ionicons/icons';

// Plugins Capacitor
import { Motion } from '@capacitor/motion';
import { PluginListenerHandle } from '@capacitor/core';

// Servicios
import { MenuService, Menu, ItemPedido } from '../../services/menu';
import { SupabaseService } from '../../services/supabase';
import { ToastService } from '../../services/toast';
import { DeliveryService } from '../../services/delivery';
import { NotificacionesService } from '../../services/notificaciones';

export interface PedidoDelivery {
  mesa_id: number; // Siempre 0 o null
  cliente_id?: number | null;
  cliente_anonimo_id?: number | null; // Opcional para delivery
  estado: string;
  total: number;
  descuento: number;
  propina: number;
  items: ItemPedido[];
}

@Component({
  selector: 'app-menu-delivery',
  templateUrl: './menu-delivery.component.html',
  styleUrls: ['../menu-cliente/menu-cliente.component.scss'], // Reutilizamos el SCSS Premium
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonButton,
    IonIcon, IonBadge, IonSpinner, IonTitle, IonButtons
  ]
})
export class MenuDeliveryComponent implements OnInit, OnDestroy {
  
  menuCompleto: Menu[] = [];
  itemsSeleccionados: ItemPedido[] = [];
  cargando: boolean = true;
  
  // UI State
  currentProductIndex: number = 0;
  currentImageIndex: number = 0;
  
  // Variables Movimiento
  private motionListener: PluginListenerHandle | undefined;
  private lastUpdate: number = 0;
  private shakeCounter: number = 0;
  private lastShakeTime: number = 0;
  private isDebouncing: boolean = false; 
  private debounceTimeMs: number = 1000;

  // Variables Swipe
  private touchStartX: number = 0;
  private touchEndX: number = 0;

  constructor(
    private menuService: MenuService,
    private deliveryService: DeliveryService,
    private supabaseService: SupabaseService,
    private toastService: ToastService,
    private router: Router,
    private notificacionesService: NotificacionesService,
    private platform: Platform,
    private ngZone: NgZone
  ) {
    addIcons({ 
        timeOutline, removeCircleOutline, addCircleOutline, 
        arrowBackCircle, phonePortraitOutline, swapHorizontalOutline,
        removeOutline, addOutline 
    });
  }

  async ngOnInit() {
    // 1. Validar Dirección
    const direccion = this.deliveryService.getDireccionActual();
    if (!direccion) {
      this.toastService.mostrarToastError('Seleccione una dirección primero');
      this.router.navigate(['/delivery']);
      return;
    }

    // 2. Cargar Menú
    await this.cargarMenu();

    // 3. Iniciar Sensores (Solo móviles/híbridos)
    if (this.platform.is('capacitor') || this.platform.is('hybrid') || this.platform.is('mobile')) {
      this.iniciarDeteccionMovimiento();
    }
  }

  ngOnDestroy() {
    if (this.motionListener) {
      this.motionListener.remove();
    }
  }

  // ----------------------------------------------------------------------
  // GESTIÓN DE SWIPE (TÁCTIL) - Copia exacta para UX consistente
  // ----------------------------------------------------------------------
  onTouchStart(e: TouchEvent) {
    this.touchStartX = e.changedTouches[0].screenX;
  }

  onTouchEnd(e: TouchEvent) {
    this.touchEndX = e.changedTouches[0].screenX;
    this.handleSwipe();
  }

  handleSwipe() {
    const threshold = 50; 
    const swipeDistance = this.touchEndX - this.touchStartX;

    if (Math.abs(swipeDistance) > threshold) {
      if (swipeDistance < 0) {
        this.cambiarProducto('siguiente');
      } else {
        this.cambiarProducto('anterior');
      }
    }
  }

  // ----------------------------------------------------------------------
  // LÓGICA DE MOVIMIENTO (ACELERÓMETRO)
  // ----------------------------------------------------------------------
  async iniciarDeteccionMovimiento() {
    try {
      this.motionListener = await Motion.addListener('accel', event => {
        this.ngZone.run(() => {
          this.procesarMovimiento(event.acceleration.x, event.acceleration.y, event.acceleration.z);
        });
      });
    } catch (e) {
      console.error('Error iniciando acelerómetro', e);
    }
  }

  procesarMovimiento(x: number, y: number, z: number) {
    const now = Date.now();
    
    if (this.isDebouncing && (now - this.lastUpdate) < this.debounceTimeMs) return;

    // 1. SHAKE LATERAL
    if (Math.abs(x) > 25) { 
      if ((now - this.lastShakeTime) < 600) {
        this.shakeCounter++;
      } else {
        this.shakeCounter = 1;
      }
      this.lastShakeTime = now;

      if (this.shakeCounter >= 3) {
        this.resetearAlPrincipio();
        this.shakeCounter = 0; 
        this.activarDebounce(now);
        return;
      }
    }

    // 2. TILT VERTICAL (Cambiar Producto)
    if (y < -5) { 
      this.cambiarProducto('siguiente');
      this.activarDebounce(now);
      return;
    } 
    if (y > 11 && z > 5) { 
       this.cambiarProducto('anterior');
       this.activarDebounce(now);
       return;
    }

    // 3. TILT HORIZONTAL (Cambiar Foto)
    if (Math.abs(x) < 20) { 
        if (x > 7) {
            this.cambiarFoto('anterior'); 
            this.activarDebounce(now);
        } else if (x < -7) {
            this.cambiarFoto('siguiente');
            this.activarDebounce(now);
        }
    }
  }

  activarDebounce(timestamp: number) {
    this.isDebouncing = true;
    this.lastUpdate = timestamp;
    setTimeout(() => {
      this.isDebouncing = false;
    }, this.debounceTimeMs);
  }

  // ----------------------------------------------------------------------
  // NAVEGACIÓN VISUAL
  // ----------------------------------------------------------------------
  resetearAlPrincipio() {
    if (this.currentProductIndex !== 0) {
        this.currentProductIndex = 0;
        this.currentImageIndex = 0;
        this.toastService.mostrarToastInfo('¡Menú reiniciado al principio!');
    }
  }

  cambiarProducto(direccion: 'siguiente' | 'anterior') {
    if (direccion === 'siguiente') {
      if (this.currentProductIndex < this.menuCompleto.length - 1) {
        this.currentProductIndex++;
        this.currentImageIndex = 0;
        this.precargarSiguienteImagen();
      } else {
        this.toastService.mostrarToastInfo('Estás en el último producto');
      }
    } else {
      if (this.currentProductIndex > 0) {
        this.currentProductIndex--;
        this.currentImageIndex = 0;
      }
    }
  }

  cambiarFoto(direccion: 'siguiente' | 'anterior') {
    const producto = this.productoActual;
    if (!producto.foto_url || producto.foto_url.length <= 1) return;

    if (direccion === 'siguiente') {
      this.currentImageIndex = (this.currentImageIndex + 1) % producto.foto_url.length;
    } else {
      this.currentImageIndex = (this.currentImageIndex - 1 + producto.foto_url.length) % producto.foto_url.length;
    }
  }

  precargarSiguienteImagen() {
    if (this.currentProductIndex < this.menuCompleto.length - 1) {
      const siguienteProd = this.menuCompleto[this.currentProductIndex + 1];
      if (siguienteProd.foto_url && siguienteProd.foto_url.length > 0) {
        const img = new Image();
        img.src = siguienteProd.foto_url[0];
      }
    }
  }

  get productoActual(): Menu {
    return this.menuCompleto[this.currentProductIndex];
  }

  obtenerImagenActual(): string {
    const producto = this.productoActual;
    if (!producto || !producto.foto_url || producto.foto_url.length === 0) {
      return 'assets/placeholder.jpg'; 
    }
    return producto.foto_url[this.currentImageIndex];
  }

  // ----------------------------------------------------------------------
  // DATA & CARRITO
  // ----------------------------------------------------------------------
  async cargarMenu(): Promise<void> {
    this.cargando = true;
    const resultado = await this.menuService.obtenerMenu();
    if (resultado.success && resultado.data) {
      this.menuCompleto = resultado.data;
      this.precargarSiguienteImagen();
    } else {
      await this.toastService.mostrarToastError(resultado.message || 'Error al cargar el menú');
    }
    this.cargando = false;
  }

  getCantidadItem(menuItem: Menu): number {
    const item = this.itemsSeleccionados.find(i => i.menu.id === menuItem.id);
    return item ? item.cantidad : 0;
  }

  agregarItem(menuItem: Menu): void {
    const itemExistente = this.itemsSeleccionados.find(i => i.menu.id === menuItem.id);
    if (itemExistente) itemExistente.cantidad++;
    else this.itemsSeleccionados.push({ menu: menuItem, cantidad: 1 });
  }

  quitarItem(menuItem: Menu): void {
    const itemExistente = this.itemsSeleccionados.find(i => i.menu.id === menuItem.id);
    if (itemExistente) {
      if (itemExistente.cantidad > 1) itemExistente.cantidad--;
      else this.itemsSeleccionados = this.itemsSeleccionados.filter(i => i.menu.id !== menuItem.id);
    }
  }

  get totalPedido(): number {
    return this.menuService.calcularTotalPedido(this.itemsSeleccionados);
  }

  get cantidadTotalItems(): number {
    return this.itemsSeleccionados.reduce((total, item) => total + item.cantidad, 0);
  }

  // ----------------------------------------------------------------------
  // CONFIRMACIÓN DE DELIVERY
  // ----------------------------------------------------------------------
  async confirmarPedido(): Promise<void> {
    if (this.itemsSeleccionados.length === 0) return;

    try {
      // 1. Obtener Datos Contextuales
      const direccion = this.deliveryService.getDireccionActual();
      if(!direccion) {
        this.toastService.mostrarToastError('Error: No se encontró la dirección de entrega');
        return;
      }

      const usuario = await this.supabaseService.obtenerUsuarioActual();
      let clienteId = null; 

      if (usuario?.id) {
        const { data: usuarioData } = await this.supabaseService.supabase
          .from('usuarios').select('id').eq('auth_user_id', usuario.id).maybeSingle();
        if (usuarioData) clienteId = usuarioData.id;
      }

      // 2. Construir Pedido
      // Nota: Usamos 'any' temporalmente si la interfaz Pedido estricta del menu.service 
      // exige mesaId obligatorio no nulo, aunque aquí mandamos 0.
      const pedido: PedidoDelivery = { 
        mesa_id: 0, // 0 Indica delivery o sin mesa
        cliente_id: clienteId, 
        cliente_anonimo_id: null,
        estado: 'pendiente', // Los delivery entran como pendientes de confirmación
        total: this.totalPedido,
        descuento: 0,
        propina: 0,
        items: this.itemsSeleccionados
      };

      // 3. Enviar a través del DeliveryService (que maneja la inserción en BD)
      const resultado = await this.deliveryService.crearPedidoDelivery(pedido, direccion);

      if (resultado.success) {
        await this.toastService.mostrarToastExito('¡Pedido de delivery enviado!');
        
        // 4. Notificar a STAFF (Dueños y Supervisores)
        await this.notificarPersonal(resultado.pedido_id!, direccion.direccion);

        // 5. Redirección
        this.router.navigate(['/home-anonimo']); 
      } else {
        await this.toastService.mostrarToastError(resultado.message || 'Error al enviar el pedido');
      }
      
    } catch (error) {
      await this.toastService.mostrarToastError('Error crítico al procesar delivery');
      console.error(error);
    }
  }

  async notificarPersonal(pedidoId: number, direccionTexto: string) {
    // Buscamos usuarios con perfil dueño o supervisor
    const { data: staff } = await this.supabaseService.supabase
       .from('usuarios')
       .select('id, perfil')
       .in('perfil', ['dueño', 'supervisor'])
       .eq('estado', 'habilitado'); // Importante: solo activos

    if (staff && staff.length > 0) {
       const promesas = staff.map(s => 
          this.notificacionesService.enviarNotificacion({
              tipo: 'nuevo_pedido_delivery', 
              titulo: `Nuevo Delivery 🛵 (#${pedidoId})`,
              mensaje: `Pedido por $${this.totalPedido} para: ${direccionTexto}`,
              destinatario_id: s.id,
              destinatario_perfil: s.perfil,
              datos: { pedido_id: pedidoId, es_delivery: true }
          })
       );
       await Promise.all(promesas);
    }
  }

  volver(): void {
    this.router.navigate(['/delivery']);
  }
}