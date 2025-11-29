import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MenuService, Menu, ItemPedido } from '../../services/menu';
import { SupabaseService } from '../../services/supabase';
import { ClienteAnonimoService } from '../../services/cliente-anonimo';
import { ToastService } from '../../services/toast';
import { ChatService } from '../../services/chat';
import { NotificacionesService } from '../../services/notificaciones';
import { 
  IonContent, IonHeader, IonToolbar, IonButton, 
  IonIcon, IonBadge, IonSpinner, Platform, IonTitle, IonButtons
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { 
  timeOutline, removeCircleOutline, addCircleOutline, 
  arrowBackCircle, phonePortraitOutline, swapHorizontalOutline,
  removeOutline, addOutline
} from 'ionicons/icons';

import { Motion } from '@capacitor/motion';
import { PluginListenerHandle } from '@capacitor/core';

export interface Pedido {
  mesa_id: number;
  cliente_id?: number | null;
  cliente_anonimo_id?: number | null;
  estado: string;
  total: number;
  descuento: number;
  propina: number;
  items: ItemPedido[];
}

@Component({
  selector: 'app-menu-cliente',
  templateUrl: './menu-cliente.component.html',
  styleUrls: ['./menu-cliente.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonButton,
    IonIcon, IonBadge, IonSpinner, IonTitle, IonButtons
  ]
})
export class MenuClienteComponent implements OnInit, OnDestroy {
  
  menuCompleto: Menu[] = [];
  itemsSeleccionados: ItemPedido[] = [];
  cargando: boolean = true;
  mesaId!: number;
  numeroMesa?: number;
  pedidoId: number | null = null;

  currentProductIndex: number = 0;
  currentImageIndex: number = 0;
  
  // Variables Movimiento
  private motionListener: PluginListenerHandle | undefined;
  private lastUpdate: number = 0;
  private shakeCounter: number = 0;
  private lastShakeTime: number = 0;
  private isDebouncing: boolean = false; 
  private debounceTimeMs: number = 1000; // Reducido levemente para mejor respuesta

  // Variables Swipe
  private touchStartX: number = 0;
  private touchEndX: number = 0;

  constructor(
    private menuService: MenuService,
    private supabaseService: SupabaseService,
    private clienteAnonimoService: ClienteAnonimoService,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService,
    private chatService: ChatService,
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
    this.route.queryParams.subscribe(params => {
      this.mesaId = +params['mesaId'];
      this.numeroMesa = +params['numeroMesa'];
      if(params['pedidoId']) this.pedidoId = +params['pedidoId'];
    });

    await this.cargarMenu();
    await this.obtenerPedidoActual();
    
    if (this.pedidoId) {
       await this.restaurarPedidoPrevio();
    }

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
  // GESTIÓN DE SWIPE (TÁCTIL)
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

    // 1. SHAKE LATERAL (Izquierda/Derecha repetidas veces) -> Reset al inicio
    // Detectamos movimientos fuertes en el eje X
    if (Math.abs(x) > 25) { // Umbral ajustado para "agitar"
      if ((now - this.lastShakeTime) < 600) {
        this.shakeCounter++;
      } else {
        this.shakeCounter = 1;
      }
      this.lastShakeTime = now;

      // Si agita 3 veces seguidas (izquierda-derecha-izquierda)
      if (this.shakeCounter >= 3) {
        this.resetearAlPrincipio();
        this.shakeCounter = 0; // Reset counter
        this.activarDebounce(now);
        return;
      }
    }

    // 2. TILT VERTICAL (Cambiar Producto - Adelante/Atrás)
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

    // 3. TILT HORIZONTAL (Cambiar Foto - Izquierda/Derecha suave)
    // Solo si NO se está agitando violentamente (para no confundir con el reset)
    if (Math.abs(x) < 20) { 
        if (x > 7) {
            this.cambiarFoto('anterior'); // Invertido para sensación natural
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
  // NAVEGACIÓN
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
      return 'assets/placeholder.jpg'; // Asegúrate de tener esta imagen o cambiarla
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

  async obtenerPedidoActual() {
    const usuario = await this.supabaseService.obtenerUsuarioActual();
    const anonimo = !usuario ? await this.clienteAnonimoService.obtenerClienteAnonimoActual() : null;
    const validacion = await this.chatService.obtenerPedidoActivo(usuario?.id, anonimo?.id);
    if (validacion.success && validacion.pedidoId) this.pedidoId = validacion.pedidoId;
  }

  async restaurarPedidoPrevio() {
    if (!this.pedidoId) return;
    const detallesPrevios = await this.menuService.obtenerDetallesPedido(this.pedidoId);
    if (detallesPrevios.length > 0) {
      this.itemsSeleccionados = detallesPrevios.map(detalle => {
        const productoEnMenu = this.menuCompleto.find(m => m.id === detalle.menu.id);
        return productoEnMenu ? { menu: productoEnMenu, cantidad: detalle.cantidad } : null;
      }).filter((item): item is ItemPedido => item !== null);
    }
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

  async confirmarPedido(): Promise<void> {
    if (this.itemsSeleccionados.length === 0) return;
    await this.enviarPedido();
  }

  private async enviarPedido(): Promise<void> {
    try {
      let clienteId: number | undefined = undefined;
      let clienteAnonimoId: number | undefined = undefined;
      
      const usuario = await this.supabaseService.obtenerUsuarioActual();
      
      if (usuario?.id) {
        const { data: usuarioData } = await this.supabaseService.supabase
          .from('usuarios').select('id').eq('auth_user_id', usuario.id).maybeSingle();
        if (usuarioData) clienteId = usuarioData.id;
      }

      if (!clienteId) {
        const clienteAnonimo = await this.clienteAnonimoService.obtenerClienteAnonimoActual();
        if (clienteAnonimo) clienteAnonimoId = clienteAnonimo.id;
      }

      const pedido: Pedido = { 
        mesa_id: this.mesaId,
        cliente_id: clienteId, 
        cliente_anonimo_id: clienteAnonimoId,
        estado: 'realizado',
        total: this.totalPedido,
        descuento: 0,
        propina: 0,
        items: this.itemsSeleccionados
      };

      const resultado = await this.menuService.crearPedido(pedido);

      if (resultado.success) {
        await this.toastService.mostrarToastExito('¡Pedido realizado!');
        
        // Notificación a mozos... (misma lógica)
        const { data: mozos } = await this.supabaseService.supabase
          .from('usuarios').select('id').eq('perfil', 'mozo').eq('estado', 'habilitado');

        if (mozos && mozos.length > 0) {
          const accion = this.pedidoId ? 'Actualización' : 'Nuevo Pedido';
          const promesas = mozos.map(m => 
             this.notificacionesService.enviarNotificacion({
                 tipo: 'pedido_modificado',
                 titulo: `Mesa ${this.numeroMesa} - ${accion}`,
                 mensaje: `Se realizó un pedido por $${this.totalPedido}`,
                 destinatario_id: m.id,
                 destinatario_perfil: 'mozo',
                 datos: { pedido_id: resultado.pedido_id, mesa_id: this.mesaId }
             })
          );
          await Promise.all(promesas);
        }

        this.router.navigate(['/mesa-opciones'], {
          queryParams: { 
            mesaId: this.mesaId,
            numeroMesa: this.numeroMesa,
            pedidoId: resultado.pedido_id,
          }
        });
      } else {
        await this.toastService.mostrarToastError(resultado.message || 'Error al enviar el pedido');
      }
      
    } catch (error) {
      await this.toastService.mostrarToastError('Error crítico al procesar');
      console.error(error);
    }
  }

  volver(): void {
    if (this.pedidoId) {
      this.router.navigate(['/mesa-opciones'], {
        queryParams: { mesaId: this.mesaId, numeroMesa: this.numeroMesa, pedidoId: this.pedidoId }
      });
    } else {
      this.router.navigate(['/home-anonimo']);
    }
  }
}