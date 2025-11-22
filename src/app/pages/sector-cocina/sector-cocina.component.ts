import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonButton, IonCard, IonCardContent, IonBadge, IonGrid, 
  IonRow, IonCol, IonRefresher, IonRefresherContent,
  IonText, IonIcon 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { flame, checkmarkDone } from 'ionicons/icons';
import { PedidosService, DetallePedido } from '../../services/pedidos';
import { ToastService } from '../../services/toast';
// 1. Importaciones necesarias
import { SupabaseService } from '../../services/supabase';
import { NotificacionesService } from '../../services/notificaciones';

@Component({
  selector: 'app-sector-cocina',
  templateUrl: './sector-cocina.component.html',
  styleUrls: ['./sector-cocina.component.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
    IonButton, IonCard, IonCardContent, IonBadge, IonGrid, 
    IonRow, IonCol, IonRefresher, IonRefresherContent
  ]
})
export class SectorCocinaComponent implements OnInit {
  pendientes: DetallePedido[] = [];
  cargando: boolean = false;

  constructor(
    private pedidosService: PedidosService,
    private router: Router,
    private toast: ToastService,
    // 2. Inyección de servicios
    private supabaseService: SupabaseService,
    private notificacionesService: NotificacionesService
  ) {
    addIcons({ flame, checkmarkDone });
  }

  ngOnInit() {
    this.cargarItems();
  }

  async cargarItems() {
    this.cargando = true;
    try {
      this.pendientes = await this.pedidosService.obtenerPendientesPorSector(['comida', 'postre']);
    } catch (error) {
      console.error(error);
    } finally {
      this.cargando = false;
    }
  }

  async empezarPreparacion(item: DetallePedido) {
    try {
      item.estado = 'preparacion'; 
      await this.pedidosService.actualizarEstadoDetalle(item.id, 'preparacion');
    } catch (e) { 
      this.toast.mostrarToastError('Error de conexión');
      this.cargarItems();
    }
  }

  async finalizarItem(item: DetallePedido | any) {
    try {
      await this.pedidosService.actualizarEstadoDetalle(item.id, 'listo');
      this.toast.mostrarToastExito('Plato terminado');

      // ------------------------------------------------------------------
      // 3. Lógica de Notificación a Mozos
      // ------------------------------------------------------------------
      try {
          const { data: mozos } = await this.supabaseService.supabase
              .from('usuarios')
              .select('id')
              .eq('perfil', 'mozo')
              .eq('estado', 'habilitado');

          if (mozos && mozos.length > 0) {
              const mesaNum = item.pedidos?.mesas?.numero || '?';
              const producto = item.menu?.nombre || 'Plato';

              const promesas = mozos.map(m => 
                  this.notificacionesService.enviarNotificacion({
                      tipo: 'pedido_listo' as any, // Tipo personalizado
                      titulo: '¡Pedido Listo en Cocina!',
                      mensaje: `Mesa ${mesaNum}: ${producto} está listo para servir.`,
                      destinatario_id: m.id,
                      destinatario_perfil: 'mozo',
                      datos: { 
                          pedido_id: item.pedido_id,
                          detalle_id: item.id
                      }
                  })
              );
              await Promise.all(promesas);
          }
      } catch (notifError) {
          console.error('Error al notificar mozos:', notifError);
      }
      // ------------------------------------------------------------------

      this.cargarItems();
    } catch (e) { 
    }
  }

  volver() { this.router.navigate(['/home']); }
  handleRefresh(e: any) { this.cargarItems().then(() => e.target.complete()); }
}