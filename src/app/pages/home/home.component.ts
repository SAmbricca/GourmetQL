import { Component, OnInit, OnDestroy } from '@angular/core';
import { SupabaseService, Usuario } from '../../services/supabase';
import { Router } from '@angular/router';
import { NotificacionesService, NotificacionTiempoReal } from '../../services/notificaciones';
import { Subscription } from 'rxjs';
import { IonContent, IonButton, IonText, IonButtons, IonCol, IonGrid, IonRow, IonTitle, IonToolbar, IonHeader, IonCard, IonCardHeader, IonCardTitle, IonBadge } from '@ionic/angular/standalone';

interface OpcionMenu {
  titulo: string;
  ruta: string;
  perfiles: string[];
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  imports: [IonContent, IonButton, IonText, IonTitle, IonButtons, IonCol, IonGrid, IonRow, IonHeader, IonToolbar, IonCard, IonCardHeader, IonCardTitle]
})
export class HomeComponent implements OnInit, OnDestroy {
  usuarioActual: Usuario | null = null;
  opcionesDisponibles: OpcionMenu[] = [];
  notificacionesNoLeidas: number = 0;
  
  private notificacionesSubscription?: Subscription;
  
  private todasLasOpciones: OpcionMenu[] = [
    {
      titulo: 'Agregar Empleado',
      ruta: '/agregar-empleado',
      perfiles: ['dueño', 'supervisor'],
    },
    {
      titulo: 'Agregar Mesa',
      ruta: '/agregar-mesa',
      perfiles: ['dueño', 'supervisor'],
    },
    {
      titulo: 'Gestión Clientes',
      ruta: '/gestion-clientes',
      perfiles: ['dueño', 'supervisor'],
    },
    {
      titulo: 'Crear Cliente registrado',
      ruta: '/agregar-empleado',
      perfiles: ['cliente', 'maitre'],
    },
    {
      titulo: 'Lista de Espera',
      ruta: '/lista-espera',
      perfiles: ['maitre'],
    },
    {
      titulo: 'Agregar Plato',
      ruta: '/agregar-plato',
      perfiles: ['cocinero'],
    },
    {
      titulo: 'Pedidos',
      ruta: '/sector-cocina',
      perfiles: ['cocinero'],
    },
    {
      titulo: 'Agregar Bebida',
      ruta: '/agregar-bebida',
      perfiles: ['bartender'],
    },
    {
      titulo: 'Pedidos',
      ruta: '/sector-bar',
      perfiles: ['bartender'],
    },
    {
      titulo: 'Consultas Clientes',
      ruta: '/consulta-mozo-admin',
      perfiles: ['mozo'],
    },
    {
      titulo: 'Pedidos',
      ruta: '/pedidos-mozo',
      perfiles: ['mozo'],
    },
  ];

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private notificacionesService: NotificacionesService
  ) {}

  async ngOnInit() {
    await this.cargarUsuario();
    this.filtrarOpcionesPorPerfil();
    await this.inicializarNotificaciones();
  }

  ngOnDestroy() {
    this.desuscribirNotificaciones();
  }

  async cargarUsuario(): Promise<void> {
    this.usuarioActual = await this.supabaseService.obtenerUsuarioActual();
    
    if (!this.usuarioActual) {
      this.router.navigate(['/login']);
    }
  }

  filtrarOpcionesPorPerfil(): void {
    if (!this.usuarioActual) {
      this.opcionesDisponibles = [];
      return;
    }

    this.opcionesDisponibles = this.todasLasOpciones.filter(opcion => {
      return opcion.perfiles.includes(this.usuarioActual!.perfil);
    });
  }

  private async inicializarNotificaciones(): Promise<void> {
    if (!this.usuarioActual) return;

    try {
      await this.notificacionesService.suscribirNotificaciones(this.usuarioActual.id.toString());
      await this.cargarNotificacionesNoLeidas();
      this.escucharNotificaciones();
    } catch (error) {
      console.error('Error al inicializar notificaciones:', error);
    }
  }

  private escucharNotificaciones(): void {
    this.notificacionesSubscription = this.notificacionesService.notificaciones$
      .subscribe((notificacion: NotificacionTiempoReal | null) => {
        if (notificacion) {
          console.log('Nueva notificación:', notificacion);
          
          this.notificacionesNoLeidas++;
        }
      });
  }

  private async cargarNotificacionesNoLeidas(): Promise<void> {
    if (!this.usuarioActual) return;

    try {
      const notificaciones = await this.notificacionesService
        .obtenerNotificacionesNoLeidas(this.usuarioActual.id.toString());
      
      this.notificacionesNoLeidas = notificaciones.length;
    } catch (error) {
      console.error('Error al cargar notificaciones no leídas:', error);
    }
  }

  private desuscribirNotificaciones(): void {
    if (this.notificacionesSubscription) {
      this.notificacionesSubscription.unsubscribe();
    }
    this.notificacionesService.desuscribirNotificaciones();
  }

  navegarA(ruta: string): void {
    this.router.navigate([ruta]);
  }

  async cerrarSesion(): Promise<void> {
    this.desuscribirNotificaciones();
    await this.notificacionesService.cancelarTodasLasNotificaciones();
    
    this.supabaseService.cerrarSesion();
  }

  get nombreCompleto(): string {
    if (!this.usuarioActual) return '';
    return `${this.usuarioActual.nombre} ${this.usuarioActual.apellido}`;
  }

  get perfilCapitalizado(): string {
    if (!this.usuarioActual) return '';
    return this.usuarioActual.perfil.charAt(0).toUpperCase() + 
           this.usuarioActual.perfil.slice(1);
  }
}