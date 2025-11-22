import { Component, OnInit, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MenuService, Menu, ItemPedido } from '../../services/menu';
import { SupabaseService } from '../../services/supabase';
import { ClienteAnonimoService } from '../../services/cliente-anonimo';
import { ToastService } from '../../services/toast';
import { ChatService } from '../../services/chat';
// 1. Importar NotificacionesService
import { NotificacionesService } from '../../services/notificaciones';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButton, 
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonText, IonIcon, IonButtons, IonBadge, IonFooter,
  LoadingController
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { register } from 'swiper/element/bundle';
import { addIcons } from 'ionicons';
import { timeOutline, cashOutline, remove, add, timerOutline, cartOutline } from 'ionicons/icons';

register();

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

@Component({
  selector: 'app-menu-cliente',
  templateUrl: './menu-cliente.component.html',
  styleUrls: ['./menu-cliente.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButton,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonText, IonIcon, IonButtons, IonBadge, IonFooter
  ]
})
export class MenuClienteComponent implements OnInit {
  @ViewChild(IonContent) content!: IonContent;
  
  menu: Menu[] = [];
  menuPorTipo: { tipo: string; items: Menu[] }[] = [];
  itemsSeleccionados: ItemPedido[] = [];
  cargando: boolean = true;
  mesaId!: number;
  numeroMesa?: number;
  pedidoId: number | null = null;

  constructor(
    private menuService: MenuService,
    private supabaseService: SupabaseService,
    private clienteAnonimoService: ClienteAnonimoService,
    private router: Router,
    private route: ActivatedRoute,
    private loadingController: LoadingController,
    private toastService: ToastService,
    private chatService: ChatService,
    // 2. Inyectar servicio
    private notificacionesService: NotificacionesService
  ) {
    addIcons({ timeOutline, cashOutline, remove, add, timerOutline, cartOutline });
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
  }

  async obtenerPedidoActual() {
      const usuario = await this.supabaseService.obtenerUsuarioActual();
      const anonimo = !usuario ? await this.clienteAnonimoService.obtenerClienteAnonimoActual() : null;

      const validacion = await this.chatService.obtenerPedidoActivo(
          usuario?.id, 
          anonimo?.id
      );

      if (validacion.success && validacion.pedidoId) {
          this.pedidoId = validacion.pedidoId;
          console.log('Pedido activo encontrado:', this.pedidoId);
      }
  }

  async cargarMenu(): Promise<void> {
    this.cargando = true;
    const resultado = await this.menuService.obtenerMenu();
    
    if (resultado.success && resultado.data) {
      this.menu = resultado.data;
      this.agruparMenuPorTipo();
    } else {
      await this.toastService.mostrarToastError(resultado.message || 'Error al cargar el menú');
    }
    
    this.cargando = false;
  }
  
  async restaurarPedidoPrevio() {
    if (!this.pedidoId) return;

    const detallesPrevios = await this.menuService.obtenerDetallesPedido(this.pedidoId);
    
    if (detallesPrevios.length > 0) {
      this.toastService.mostrarToastInfo('Podes modificar tu pedido.');

      this.itemsSeleccionados = detallesPrevios.map(detalle => {
        const productoEnMenu = this.menu.find(m => m.id === detalle.menu.id);
        if (productoEnMenu) {
          return {
            menu: productoEnMenu,
            cantidad: detalle.cantidad
          };
        }
        return null;
      }).filter((item): item is ItemPedido => item !== null);
    }
  }

  agruparMenuPorTipo(): void {
    const tipos = [...new Set(this.menu.map(item => item.tipo))];
    
    const etiquetas: { [key: string]: string } = {
      'comida': 'Comida',
      'bebida': 'Bebidas',
      'postre': 'Postres'
    };

    this.menuPorTipo = tipos.map(tipo => ({
      tipo: etiquetas[tipo] || tipo, 
      items: this.menu.filter(item => item.tipo === tipo)
    }));
  }

  obtenerImagenActual(item: Menu, index: number): string {
    if (!item.foto_url || item.foto_url.length === 0) {
      return 'assets/placeholder.jpg';
    }
    return item.foto_url[index % item.foto_url.length];
  }

  getCantidadItem(menuItem: Menu): number {
    const item = this.itemsSeleccionados.find(i => i.menu.id === menuItem.id);
    return item ? item.cantidad : 0;
  }

  agregarItem(menuItem: Menu): void {
    const itemExistente = this.itemsSeleccionados.find(i => i.menu.id === menuItem.id);
    
    if (itemExistente) {
      itemExistente.cantidad++;
    } else {
      this.itemsSeleccionados.push({
        menu: menuItem,
        cantidad: 1
      });
    }
  }

  quitarItem(menuItem: Menu): void {
    const itemExistente = this.itemsSeleccionados.find(i => i.menu.id === menuItem.id);
    
    if (itemExistente) {
      if (itemExistente.cantidad > 1) {
        itemExistente.cantidad--;
      } else {
        this.itemsSeleccionados = this.itemsSeleccionados.filter(i => i.menu.id !== menuItem.id);
      }
    }
  }

  get totalPedido(): number {
    return this.menuService.calcularTotalPedido(this.itemsSeleccionados);
  }

  get tiempoTotal(): number {
    return this.menuService.calcularTiempoTotal(this.itemsSeleccionados);
  }

  get cantidadTotalItems(): number {
    return this.itemsSeleccionados.reduce((total, item) => total + item.cantidad, 0);
  }

  async confirmarPedido(): Promise<void> {
    if (this.itemsSeleccionados.length === 0) {
      await this.toastService.mostrarToastAdvertencia('Debe seleccionar al menos un producto');
      return;
    }

    await this.enviarPedido();
  }

  private async enviarPedido(): Promise<void> {
    const loading = await this.loadingController.create({
      message: this.pedidoId ? 'Actualizando pedido...' : 'Enviando pedido...',
      spinner: 'crescent'
    });
    await loading.present();

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

      const pedido: Pedido = { // Usar la interfaz Pedido
        mesa_id: this.mesaId,
        cliente_id: clienteId, // El servicio ahora maneja si es undefined convirtiéndolo a null
        cliente_anonimo_id: clienteAnonimoId,
        estado: 'realizado',
        total: this.totalPedido,
        descuento: 0,
        propina: 0,
        items: this.itemsSeleccionados
      };

      const resultado = await this.menuService.crearPedido(pedido);

      await loading.dismiss();

      if (resultado.success) {
        await this.toastService.mostrarToastExito(this.pedidoId ? '¡Pedido modificado y enviado!' : '¡Pedido realizado!');
        
        // --------------------------------------------------------------------
        // NOTIFICAR A MOZOS
        // --------------------------------------------------------------------
        const { data: mozos } = await this.supabaseService.supabase
          .from('usuarios')
          .select('id')
          .eq('perfil', 'mozo')
          .eq('estado', 'habilitado');

        if (mozos && mozos.length > 0) {
          const accion = this.pedidoId ? 'Actualización' : 'Nuevo Pedido';
          const promesas = mozos.map(m => 
             this.notificacionesService.enviarNotificacion({
                 tipo: 'pedido_modificado', // Reutilizamos tipo existente o "pedido_nuevo" si lo agregas
                 titulo: `Mesa ${this.numeroMesa} - ${accion}`,
                 mensaje: `Se ha enviado un pedido por $${this.totalPedido}`,
                 destinatario_id: m.id,
                 destinatario_perfil: 'mozo',
                 datos: { 
                   pedido_id: resultado.pedido_id,
                   mesa_id: this.mesaId 
                 }
             })
          );
          await Promise.all(promesas);
        }
        // --------------------------------------------------------------------

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
      await loading.dismiss();
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