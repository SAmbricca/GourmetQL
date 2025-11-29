import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService, Usuario } from '../../services/supabase';
import { ToastService } from '../../services/toast';
import { NotificacionesService } from '../../services/notificaciones'; // Importar servicio
import { Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonButton, IonIcon, IonGrid, IonRow, IonCol, IonCard, 
  IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonItem, IonLabel, IonDatetime, IonDatetimeButton, IonModal,
  IonSpinner, IonBadge
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, calendarOutline, addOutline, timeOutline, peopleOutline } from 'ionicons/icons';

interface Reserva {
  id: number;
  fecha_hora: string;
  estado: 'pendiente' | 'confirmada' | 'cancelada' | 'finalizada' | 'vencida';
  cantidad_comensales: number;
}

@Component({
  selector: 'app-reservas',
  templateUrl: './reservas.component.html',
  styleUrls: ['./reservas.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
    IonButton, IonIcon, IonGrid, IonRow, IonCol, IonCard, 
    IonCardHeader, IonCardTitle, IonDatetime, IonModal,
    IonSpinner, IonBadge
  ]
})
export class ReservasComponent implements OnInit {
  usuarioActual: Usuario | null = null;
  reservas: Reserva[] = [];
  cargando: boolean = true;

  // Variables para nueva reserva
  fechaSeleccionada: string;
  minFecha: string; // Para restringir el datetime
  comensales: number = 2;
  modalAbierto: boolean = false;
  
  protected readonly Math = Math; // Para usar Math en el HTML si fuera necesario

  constructor(
    private supabaseService: SupabaseService,
    private toastService: ToastService,
    private notificacionesService: NotificacionesService, // Inyectar notificación
    private router: Router
  ) {
    addIcons({ arrowBackOutline, calendarOutline, addOutline, timeOutline, peopleOutline });
    
    // Configurar fecha mínima: Ahora + 1 hora
    const ahora = new Date();
    ahora.setHours(ahora.getHours() + 1);
    this.minFecha = ahora.toISOString();
    this.fechaSeleccionada = this.minFecha;
  }

  async ngOnInit() {
    await this.verificarUsuario();
    if (this.usuarioActual) {
      await this.cargarReservas();
    }
  }

  async verificarUsuario() {
    this.usuarioActual = await this.supabaseService.obtenerUsuarioActual();
    
    if (!this.usuarioActual || this.usuarioActual.perfil !== 'cliente') {
      this.toastService.mostrarToastError('Solo los clientes registrados pueden realizar reservas.');
      this.router.navigate(['/home']);
      return;
    }
  }

  async cargarReservas() {
    this.cargando = true;
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('reservas')
        .select('*')
        .eq('cliente_id', this.usuarioActual!.id)
        .order('fecha_hora', { ascending: true });

      if (error) throw error;
      
      this.reservas = data || [];
      
      // Validar regla de los 45 minutos al cargar
      await this.verificarVencimientoReservas();

    } catch (error) {
      console.error('Error cargando reservas:', error);
      this.toastService.mostrarToastError('No se pudieron cargar sus reservas.');
    } finally {
      this.cargando = false;
    }
  }

  // --- LÓGICA DE VENCIMIENTO (45 MINUTOS) ---
  // Si la reserva 'confirmada' ya pasó hace más de 45 mins y no fue finalizada/atendida, se cancela.
  async verificarVencimientoReservas() {
    const ahora = new Date().getTime();
    const tiempoToleranciaMs = 45 * 60 * 1000; // 45 minutos en milisegundos

    const reservasVencidas = this.reservas.filter(r => {
      if (r.estado !== 'confirmada' && r.estado !== 'pendiente') return false;
      
      const fechaReserva = new Date(r.fecha_hora).getTime();
      // Si la hora actual es mayor a la hora de reserva + 45 min
      return ahora > (fechaReserva + tiempoToleranciaMs);
    });

    for (const reserva of reservasVencidas) {
      // Actualizar en BD a cancelada por inasistencia
      await this.supabaseService.supabase
        .from('reservas')
        .update({ estado: 'vencida' })
        .eq('id', reserva.id);
        
      // Actualizar localmente
      reserva.estado = 'vencida';
    }

    if (reservasVencidas.length > 0) {
      this.toastService.mostrarToastInfo('Una reserva venció por superar los 45 minutos de espera. Se liberó la mesa.');
    }
  }

  async crearReserva() {
    if (!this.usuarioActual) return;

    const fechaReserva = new Date(this.fechaSeleccionada);
    const ahoraMasUnaHora = new Date();
    ahoraMasUnaHora.setHours(ahoraMasUnaHora.getHours() + 1);

    // Validación 1: Tiempo futuro (Mínimo 1 hora)
    // Restamos 1 minuto a la validación por posibles diferencias de segundos al procesar
    if (fechaReserva < new Date(Date.now() + 59 * 60 * 1000)) {
      this.toastService.mostrarToastError('La reserva debe realizarse con al menos 1 hora de anticipación.');
      return;
    }

    try {
      const { data, error } = await this.supabaseService.supabase
        .from('reservas')
        .insert({
          cliente_id: this.usuarioActual.id,
          fecha_hora: this.fechaSeleccionada,
          cantidad_comensales: this.comensales,
          estado: 'pendiete' 
        })
        .select()
        .single();

      if (error) throw error;

      this.toastService.mostrarToastExito('¡Reserva solicitada!');
      
      // Notificar a Dueños y Supervisores
      await this.notificarStaffNuevaReserva(data);

      this.modalAbierto = false;
      await this.cargarReservas(); 

    } catch (error) {
      console.error('Error creando reserva:', error);
      this.toastService.mostrarToastError('Hubo un error al crear la reserva.');
    }
  }

  // --- LÓGICA DE NOTIFICACIONES ---
  async notificarStaffNuevaReserva(reserva: Reserva) {
    try {
      // 1. Obtener Dueños y Supervisores
      const { data: staff } = await this.supabaseService.supabase
        .from('usuarios')
        .select('id, perfil')
        .in('perfil', ['dueño', 'supervisor']);

      if (!staff || staff.length === 0) return;

      const fechaFormateada = new Date(reserva.fecha_hora).toLocaleString('es-AR', { hour: '2-digit', minute:'2-digit', day: '2-digit', month: '2-digit' });

      // 2. Enviar notificación a cada uno
      const promesas = staff.map(usuario => {
        return this.notificacionesService.enviarNotificacion({
          tipo: 'nueva_reserva' as any, // Casteo a any porque 'nueva_reserva' no estaba en tu interface original, agrégalo si quieres strict typing
          titulo: 'Nueva Reserva Agendada',
          mensaje: `Cliente: ${this.usuarioActual?.nombre} - Fecha: ${fechaFormateada} - Pax: ${reserva.cantidad_comensales}`,
          destinatario_id: usuario.id.toString(),
          destinatario_perfil: usuario.perfil,
          datos: {
            reserva_id: reserva.id,
            cliente_id: this.usuarioActual?.id
          }
        });
      });

      await Promise.all(promesas);

    } catch (error) {
      console.error('Error enviando notificaciones al staff:', error);
    }
  }

  // --- Métodos de Control del Modal ---
  aumentarComensales() {
    if (this.comensales < 10) this.comensales++;
  }

  disminuirComensales() {
    if (this.comensales > 1) this.comensales--;
  }

  setOpen(isOpen: boolean) {
    this.modalAbierto = isOpen;
    if (isOpen) {
      // Recalcular minFecha al abrir por si pasó tiempo
      const ahora = new Date();
      ahora.setHours(ahora.getHours() + 1);
      this.minFecha = ahora.toISOString();
      
      // Si la fecha seleccionada quedó vieja, actualizarla
      if (new Date(this.fechaSeleccionada) < ahora) {
        this.fechaSeleccionada = this.minFecha;
      }
    }
  }

  volver() {
    this.router.navigate(['/home-anonimo']);
  }

  getBadgeColor(estado: string): string {
    switch(estado) {
      case 'confirmada': return 'success';
      case 'pendiente': return 'warning';
      case 'cancelada': return 'danger';
      case 'finalizada': return 'medium';
      default: return 'primary';
    }
  }
}