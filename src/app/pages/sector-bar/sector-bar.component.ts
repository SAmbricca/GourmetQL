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
import { hourglassOutline, wine, beer } from 'ionicons/icons';
import { PedidosService, DetallePedido } from '../../services/pedidos';
import { ToastService } from '../../services/toast';
// 1. Importaciones necesarias
import { SupabaseService } from '../../services/supabase';
import { NotificacionesService } from '../../services/notificaciones';

@Component({
  selector: 'app-sector-bar',
  templateUrl: './sector-bar.component.html',
  styleUrls: ['./sector-bar.component.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
    IonButton, IonCard, IonCardContent, IonGrid, 
    IonRow, IonCol, IonRefresher, IonRefresherContent,
    IonText, IonIcon 
  ]
})
export class SectorBarComponent implements OnInit {
  pendientes: DetallePedido[] = [];
  
  constructor(
    private pedidosService: PedidosService, 
    private router: Router, 
    private toast: ToastService,
    // 2. Inyección de servicios
    private supabaseService: SupabaseService,
    private notificacionesService: NotificacionesService
  ) {
    addIcons({ hourglassOutline, wine, beer });
  }

  ngOnInit() { 
    this.cargarItems(); 
  }

  async cargarItems() {
    this.pendientes = await this.pedidosService.obtenerPendientesPorSector(['bebida']);
  }

  async preparar(item: DetallePedido) {
    try {
        item.estado = 'preparacion'; // Feedback instantáneo
        await this.pedidosService.actualizarEstadoDetalle(item.id, 'preparacion');
    } catch (error) {
        this.toast.mostrarToastError('Error al actualizar');
        this.cargarItems();
    }
  }

  async terminar(item: DetallePedido | any) {
    try {
        await this.pedidosService.actualizarEstadoDetalle(item.id, 'listo');
        this.toast.mostrarToastExito('Bebida lista');

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
                const producto = item.menu?.nombre || 'Bebida';

                const promesas = mozos.map(m => 
                    this.notificacionesService.enviarNotificacion({
                        tipo: 'pedido_listo' as any, // Tipo personalizado
                        titulo: '¡Bebida Lista para Retirar!',
                        mensaje: `Mesa ${mesaNum}: ${producto} está listo en la barra.`,
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
    } catch (error) {
    }
  }
  
  volver() { 
    this.router.navigate(['/home']); 
  }
  
  handleRefresh(e: any) { 
    this.cargarItems().then(() => e.target.complete()); 
  }
}