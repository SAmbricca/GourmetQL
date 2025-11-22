import { Component, OnInit, OnDestroy } from '@angular/core';
import { SupabaseService } from '../../services/supabase';
import { QrHandlerService } from '../../services/qr-handler';
import { ToastService } from '../../services/toast';
import { Router } from '@angular/router';
import { NotificacionesService, NotificacionTiempoReal } from '../../services/notificaciones';
import { Subscription } from 'rxjs';
import { IonContent, IonButton, IonText, IonButtons, IonCol, IonGrid, IonRow, IonTitle, IonToolbar, IonHeader, IonCard, IonCardHeader, IonCardTitle, IonSpinner, IonBadge} from '@ionic/angular/standalone';
import { Preferences } from '@capacitor/preferences';

interface ClienteAnonimo {
  id: number;
  nombre: string;
  foto_url: string;
  fecha_creacion: string;
}

interface OpcionMenu {
  titulo: string;
  descripcion?: string;
  icono?: string;
  accion: () => void;
  deshabilitado?: boolean;
  badge?: number;
}

type EstadoCliente = 'sin_registrar' | 'esperando_mesa' | 'mesa_asignada';

@Component({
  selector: 'app-home-anonimo',
  templateUrl: './home-anonimo.component.html',
  styleUrls: ['./home-anonimo.component.scss'],
  imports: [IonContent, IonButton, IonText, IonTitle, IonButtons, IonCol, IonGrid, IonRow, IonHeader, IonToolbar, IonCard, IonCardHeader, IonCardTitle, IonSpinner, IonBadge],
  standalone: true
})
export class HomeAnonimoComponent implements OnInit, OnDestroy {
  clienteActual: ClienteAnonimo | null = null;
  estadoActual: EstadoCliente = 'sin_registrar';
  verificandoEstado: boolean = true;
  notificacionesNoLeidas: number = 0;
  
  private readonly CLIENTE_KEY = 'cliente_anonimo_actual';
  private readonly ESTADO_KEY = 'estado_cliente';
  
  private notificacionesSubscription?: Subscription;
  private verificacionInterval?: any;

  opcionesDisponibles: OpcionMenu[] = [];

  constructor(
    private supabaseService: SupabaseService,
    private qrHandler: QrHandlerService,
    private toastService: ToastService,
    private router: Router,
    private notificacionesService: NotificacionesService
  ) {}

  async ngOnInit() {
    await this.cargarCliente();
    await this.verificarEstadoCliente();
    this.configurarOpciones();
    await this.inicializarNotificaciones();
    
    this.iniciarVerificacionPeriodica();
  }

  ngOnDestroy() {
    this.desuscribirNotificaciones();
    if (this.verificacionInterval) {
      clearInterval(this.verificacionInterval);
    }
  }

  async cargarCliente(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: this.CLIENTE_KEY });
      if (value) {
        this.clienteActual = JSON.parse(value);
        console.log('Cliente cargado:', this.clienteActual);
      } else {
        this.router.navigate(['/login']);
      }
    } catch (error) {
      console.error('Error al cargar cliente:', error);
      this.router.navigate(['/login']);
    }
  }

  async verificarEstadoCliente(): Promise<void> {
    this.verificandoEstado = true;
    
    try {
      if (!this.clienteActual) {
        this.estadoActual = 'sin_registrar';
        return;
      }

      const { data: listaEspera, error: errorLista } = await this.supabaseService.supabase
        .from('lista_espera')
        .select('*')
        .eq('cliente_anonimo_id', this.clienteActual.id)
        .order('fecha_ingreso', { ascending: false })
        .limit(1)
        .single();

      if (errorLista && errorLista.code !== 'PGRST116') {
        console.error('Error al verificar lista de espera:', errorLista);
      }

      console.log('Lista espera encontrada:', listaEspera);

      if (listaEspera) {
        if (listaEspera.estado === 'esperando') {
          this.estadoActual = 'esperando_mesa';
          console.log('Estado: esperando_mesa');
        } else if (listaEspera.estado === 'atendido') {
          this.estadoActual = 'mesa_asignada';
          console.log('Estado: mesa_asignada');
        }
      } else {
        this.estadoActual = 'sin_registrar';
        console.log('Estado: sin_registrar');
      }

      await Preferences.set({
        key: this.ESTADO_KEY,
        value: this.estadoActual
      });

      this.configurarOpciones();

    } catch (error) {
      console.error('Error al verificar estado:', error);
      this.estadoActual = 'sin_registrar';
    } finally {
      this.verificandoEstado = false;
    }
  }

  // Verificación periódica cada 10 segundos
  private iniciarVerificacionPeriodica(): void {
    this.verificacionInterval = setInterval(async () => {
      console.log('Verificación periódica del estado...');
      await this.verificarEstadoCliente();
    }, 10000); // Cada 10 segundos
  }

  private async inicializarNotificaciones(): Promise<void> {
    if (!this.clienteActual) return;

    try {
      console.log('Suscribiéndose a notificaciones para cliente:', this.clienteActual.id);
      await this.notificacionesService.suscribirNotificaciones(this.clienteActual.id.toString());
      await this.cargarNotificacionesNoLeidas();
      this.escucharNotificaciones();

      console.log('✅ Sistema de notificaciones inicializado para cliente anónimo ID:', this.clienteActual.id);
    } catch (error) {
      console.error('Error al inicializar notificaciones:', error);
    }
  }

  private escucharNotificaciones(): void {
    this.notificacionesSubscription = this.notificacionesService.notificaciones$
      .subscribe(async (notificacion: NotificacionTiempoReal | null) => {
        if (notificacion) {
          console.log('🔔 Nueva notificación recibida:', notificacion);
          this.notificacionesNoLeidas++;
          
          if (notificacion.tipo === 'mesa_asignada') {
            await this.manejarMesaAsignada(notificacion);
          }
        }
      });
  }

  private async manejarMesaAsignada(notificacion: NotificacionTiempoReal): Promise<void> {
    this.estadoActual = 'mesa_asignada';
    
    await Preferences.set({
      key: this.ESTADO_KEY,
      value: this.estadoActual
    });
    
    // Reconfigurar opciones
    this.configurarOpciones();
    
    // Mostrar toast
    await this.toastService.mostrarToastExito('¡Le han asignado una mesa! Escanee el QR de su mesa');
    
    // Marcar notificación como leída
    if (notificacion.id) {
      await this.notificacionesService.marcarComoLeida(notificacion.id);
      this.notificacionesNoLeidas = Math.max(0, this.notificacionesNoLeidas - 1);
    }
    
    // Verificar estado completo
    await this.verificarEstadoCliente();
  }

  private async cargarNotificacionesNoLeidas(): Promise<void> {
    if (!this.clienteActual) return;

    try {
      const notificaciones = await this.notificacionesService
        .obtenerNotificacionesNoLeidas(this.clienteActual.id.toString());
      
      this.notificacionesNoLeidas = notificaciones.length;
      console.log(`Notificaciones no leídas: ${this.notificacionesNoLeidas}`);
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

  configurarOpciones(): void {
    this.opcionesDisponibles = [];

    switch (this.estadoActual) {
      case 'sin_registrar':
        this.opcionesDisponibles = [
          {
            titulo: 'Escanear QR de Ingreso',
            descripcion: 'Únase a la lista de espera',
            accion: () => this.escanearQRIngreso(),
            deshabilitado: false
          },
          {
            titulo: 'Ver Encuestas Previas',
            descripcion: 'Consulte opiniones de otros clientes',
            accion: () => this.verEncuestas(),
            deshabilitado: false
          }
        ];
        break;

      case 'esperando_mesa':
        this.opcionesDisponibles = [
          {
            titulo: 'Estado en Lista de Espera',
            descripcion: 'Esperando asignación de mesa',
            accion: () => {},
            deshabilitado: true
          },
          {
            titulo: 'Ver Encuestas Previas',
            descripcion: 'Consulte opiniones de otros clientes',
            accion: () => this.verEncuestas(),
            deshabilitado: false
          }
        ];
        break;

      case 'mesa_asignada':
        this.opcionesDisponibles = [
          {
            titulo: 'Escanear QR de Mesa',
            descripcion: 'Acceda a su mesa y realice pedidos',
            accion: () => this.escanearQRMesa(),
            deshabilitado: false
          },
          {
            titulo: 'Ver Encuestas Previas',
            descripcion: 'Consulte opiniones de otros clientes',
            accion: () => this.verEncuestas(),
            deshabilitado: false
          }
        ];
        break;
    }
  }

  async escanearQRIngreso(): Promise<void> {
    if (this.estadoActual !== 'sin_registrar') {
      this.toastService.mostrarToastError('Ya está registrado en el sistema');
      return;
    }

    const resultado = await this.qrHandler.escanearYProcesarQR();

    if (!resultado.exito) {
      this.toastService.mostrarToastError(resultado.mensaje);
      return;
    }

    if (resultado.tipo !== 'ingreso') {
      this.toastService.mostrarToastError('Debe escanear el QR de ingreso al local');
      return;
    }

    const registrado = await this.qrHandler.registrarEnListaEspera(this.clienteActual!.id);
    
    if (registrado) {
      this.estadoActual = 'esperando_mesa';
      await Preferences.set({
        key: this.ESTADO_KEY,
        value: this.estadoActual
      });
      this.configurarOpciones();

      // -------------------------------------------------------------------------
      // LOGICA DE NOTIFICACION A MAITRES
      // -------------------------------------------------------------------------
      try {
        // 1. Obtener todos los maitres
        const { data: maitres } = await this.supabaseService.supabase
            .from('usuarios')
            .select('id, perfil')
            .eq('perfil', 'maitre');

        // 2. Enviar notificación a cada uno
        if (maitres && maitres.length > 0) {
            for (const maitre of maitres) {
                await this.notificacionesService.enviarNotificacion({
                    // Usamos 'as any' para tipos nuevos no estrictos en la interfaz actual
                    tipo: 'nuevo_cliente_espera' as any, 
                    titulo: 'Nuevo Cliente en Espera',
                    mensaje: `${this.clienteActual!.nombre} (Anónimo) ingresó a la lista de espera.`,
                    destinatario_id: maitre.id,
                    destinatario_perfil: maitre.perfil,
                    datos: { 
                        cliente_anonimo_id: this.clienteActual!.id,
                        accion: 'revisar_lista'
                    }
                });
            }
        }
      } catch (error) {
        console.error('Error al notificar a los maitres:', error);
        // No bloqueamos el flujo principal si falla la notificación
      }
      // -------------------------------------------------------------------------
    }
  }

  async escanearQRMesa(): Promise<void> {
    if (this.estadoActual !== 'mesa_asignada') {
      this.toastService.mostrarToastError('Primero debe estar en lista de espera y ser asignado a una mesa');
      return;
    }

    const resultado = await this.qrHandler.escanearYProcesarQR();

    if (!resultado.exito) {
      this.toastService.mostrarToastError(resultado.mensaje);
      return;
    }

    if (resultado.tipo !== 'mesa') {
      this.toastService.mostrarToastError('Debe escanear el QR de su mesa asignada');
      return;
    }

    const acceso = await this.qrHandler.verificarYAccederMesa(
      this.clienteActual!.id,
      resultado.datos!.numeroMesa!
    );
  }

  verEncuestas(): void {
    this.router.navigate(['/encuesta-resultados']);
  }

  async cerrarSesion(): Promise<void> {
    this.desuscribirNotificaciones();
    await this.notificacionesService.cancelarTodasLasNotificaciones();
    
    await Preferences.remove({ key: this.CLIENTE_KEY });
    await Preferences.remove({ key: this.ESTADO_KEY });
    this.router.navigate(['/login']);
  }

  get nombreCliente(): string {
    return this.clienteActual?.nombre || 'Cliente';
  }

  get estadoTexto(): string {
    if (this.verificandoEstado) return 'Verificando...';
    
    switch (this.estadoActual) {
      case 'sin_registrar':
        return 'Sin registrar';
      case 'esperando_mesa':
        return 'En lista de espera';
      case 'mesa_asignada':
        return 'Mesa asignada';
      default:
        return 'Estado desconocido';
    }
  }

  get estadoColor(): string {
    if (this.verificandoEstado) return 'medium';
    
    switch (this.estadoActual) {
      case 'sin_registrar':
        return 'warning';
      case 'esperando_mesa':
        return 'primary';
      case 'mesa_asignada':
        return 'success';
      default:
        return 'medium';
    }
  }

  get estadoColorHex(): string {
    if (this.verificandoEstado) return '#9ca3af';
    
    switch (this.estadoActual) {
      case 'sin_registrar':
        return '#f59e0b';
      case 'esperando_mesa':
        return '#3b82f6';
      case 'mesa_asignada':
        return '#10b981';
      default:
        return '#9ca3af';
    }
  }
}