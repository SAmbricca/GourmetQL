import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonButton, IonIcon, IonRefresher, IonRefresherContent, 
  IonGrid, IonRow, IonCol, IonCard, IonCardHeader, 
  IonCardTitle, IonCardContent, IonAvatar, IonText, 
  IonBadge, IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  calendarOutline, timeOutline, peopleOutline, 
  checkmarkCircleOutline, closeCircleOutline, arrowBackOutline,
  logOutOutline
} from 'ionicons/icons';
import { SupabaseService, Usuario } from '../../services/supabase';
import { ToastService } from '../../services/toast';
// import { NotificacionesService } from '../../services/notificaciones'; // ELIMINADO
import { Email } from '../../services/email'; // AGREGADO

interface ReservaConCliente {
  id: number;
  fecha_hora: string;
  cantidad_comensales: number;
  estado: 'pendiente' | 'confirmada' | 'cancelada' | 'rechazada' | 'finalizada';
  cliente_id: number;
  cliente: {
    nombre: string;
    apellido: string;
    email: string;
    foto_url: string;
  };
}

@Component({
  selector: 'app-lista-reservas',
  templateUrl: './lista-reservas.component.html',
  styleUrls: ['./lista-reservas.component.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
    IonButton, IonIcon, IonRefresher, IonRefresherContent, 
    IonGrid, IonRow, IonCol, IonCard, IonCardHeader, 
    IonCardTitle, IonCardContent, IonAvatar, IonText, 
    IonBadge, IonSpinner
  ]
})
export class ListaReservasComponent implements OnInit {
  reservasPendientes: ReservaConCliente[] = [];
  reservasConfirmadas: ReservaConCliente[] = [];
  cargando: boolean = true;
  usuarioActual: Usuario | null = null;

  // Manejo de rechazo
  reservaRechazarId: number | null = null;
  motivoRechazo: string = '';

  constructor(
    private supabaseService: SupabaseService,
    private toastService: ToastService,
    private emailService: Email, // INYECTADO
    private router: Router
  ) {
    addIcons({ 
      calendarOutline, timeOutline, peopleOutline, 
      checkmarkCircleOutline, closeCircleOutline, arrowBackOutline,
      logOutOutline
    });
  }

  async ngOnInit() {
    this.usuarioActual = await this.supabaseService.obtenerUsuarioActual();
    if (!this.usuarioActual || !['dueño', 'supervisor'].includes(this.usuarioActual.perfil)) {
      this.router.navigate(['/home']);
      return;
    }
    await this.cargarReservas();
  }

  async handleRefresh(event: any) {
    await this.cargarReservas();
    event.target.complete();
  }

  async cargarReservas() {
    this.cargando = true;
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('reservas')
        .select(`
          *,
          cliente:usuarios (
            nombre,
            apellido,
            email,
            foto_url
          )
        `)
        .in('estado', ['pendiente', 'confirmada'])
        .order('fecha_hora', { ascending: true });

      if (error) throw error;

      const todas = (data as any[]) || [];
      await this.verificarYLimpiarVencidas(todas);

      this.reservasPendientes = todas.filter(r => r.estado === 'pendiente');
      this.reservasConfirmadas = todas.filter(r => r.estado === 'confirmada');

    } catch (error) {
      console.error('Error cargando reservas:', error);
      this.toastService.mostrarToastError('Error al cargar reservas');
    } finally {
      this.cargando = false;
    }
  }

  async verificarYLimpiarVencidas(reservas: ReservaConCliente[]) {
    const ahora = new Date().getTime();
    const toleranciaMs = 45 * 60 * 1000; 

    for (const reserva of reservas) {
      const fechaReserva = new Date(reserva.fecha_hora).getTime();
      
      if (ahora > (fechaReserva + toleranciaMs)) {
        await this.supabaseService.supabase
          .from('reservas')
          .update({ estado: 'cancelada' })
          .eq('id', reserva.id);
        
        reserva.estado = 'cancelada'; 
      }
    }
  }

  // --- ACCIÓN: APROBAR RESERVA (MODIFICADO: EMAIL) ---
  async aprobarReserva(reserva: ReservaConCliente) {
    this.cargando = true; // Bloqueo visual simple
    try {
      // 1. Actualizar estado en Supabase
      const { error } = await this.supabaseService.supabase
        .from('reservas')
        .update({ estado: 'confirmada' })
        .eq('id', reserva.id);

      if (error) throw error;

      // 2. Enviar Email de Confirmación
      // No bloqueamos el flujo principal si el email falla, pero lo logueamos
      this.emailService.enviarConfirmacionReserva(reserva)
        .then(enviado => {
            if(!enviado) console.warn('Reserva guardada pero email falló');
        });

      this.toastService.mostrarToastExito('Reserva confirmada y email enviado');
      await this.cargarReservas();

    } catch (error) {
      console.error('Error al aprobar:', error);
      this.toastService.mostrarToastError('No se pudo confirmar la reserva');
    } finally {
      this.cargando = false;
    }
  }

  // --- INTERFAZ: MOSTRAR INPUT RECHAZO ---
  iniciarRechazo(id: number) {
    this.reservaRechazarId = id;
    this.motivoRechazo = '';
  }

  cancelarRechazo() {
    this.reservaRechazarId = null;
    this.motivoRechazo = '';
  }

  // --- ACCIÓN: RECHAZAR RESERVA (MODIFICADO: EMAIL) ---
  async confirmarRechazo(reserva: ReservaConCliente) {
    if (!this.motivoRechazo.trim()) {
      this.toastService.mostrarToastError('Debe indicar un motivo de rechazo');
      return;
    }

    this.cargando = true;
    try {
      // 1. Actualizar estado
      const { error } = await this.supabaseService.supabase
        .from('reservas')
        .update({ estado: 'rechazada' })
        .eq('id', reserva.id);

      if (error) throw error;

      // 2. Enviar Email de Rechazo con motivo
      this.emailService.enviarRechazoReserva(reserva, this.motivoRechazo)
        .then(enviado => {
            if(!enviado) console.warn('Reserva rechazada pero email falló');
        });

      this.toastService.mostrarToastInfo('Reserva rechazada y cliente notificado por email');
      this.cancelarRechazo();
      await this.cargarReservas();

    } catch (error) {
      console.error('Error al rechazar:', error);
      this.toastService.mostrarToastError('Error al procesar el rechazo');
    } finally {
        this.cargando = false;
    }
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    });
  }

  formatearFechaCorta(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' });
  }

  volverAlHome() {
    this.router.navigate(['/home']);
  }

  cerrarSesion() {
    this.supabaseService.cerrarSesion();
  }
}