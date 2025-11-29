import { Component, OnInit, OnDestroy } from '@angular/core';
import { SupabaseService, Usuario } from '../../services/supabase';
import { QrHandlerService } from '../../services/qr-handler';
import { ToastService } from '../../services/toast';
import { Router } from '@angular/router';
import { NotificacionesService, NotificacionTiempoReal } from '../../services/notificaciones';
import { Subscription } from 'rxjs';
import { 
  LoadingController, 
  IonContent, IonButton, IonCol, IonGrid, IonRow, 
  IonHeader, IonToolbar, IonCard, IonCardHeader, 
  IonCardTitle, IonSpinner, IonBadge, IonIcon 
} from '@ionic/angular/standalone';
import { Preferences } from '@capacitor/preferences';

// --- Interfaces Unificadas ---
type TipoCliente = 'registrado' | 'anonimo';

interface DatosCliente {
  id: number;
  nombre: string;
  foto_url?: string;
  tipo: TipoCliente;
  perfil?: string; // Para el usuario registrado será 'cliente'
}

interface OpcionMenu {
  titulo: string;
  icono?: string;
  accion: () => void;
  deshabilitado?: boolean;
  badge?: number;
}

type EstadoCliente = 'sin_registrar' | 'esperando_mesa' | 'mesa_asignada';

@Component({
  selector: 'app-home-cliente', // Cambio sugerido de selector
  templateUrl: './home-anonimo.component.html',
  styleUrls: ['./home-anonimo.component.scss'],
  imports: [IonContent, IonButton, IonCol, IonGrid, IonRow, IonHeader, IonToolbar, IonCard, IonCardHeader, IonCardTitle, IonSpinner, IonBadge, IonIcon],
  standalone: true
})
export class HomeAnonimoComponent implements OnInit, OnDestroy {
  clienteActual: DatosCliente | null = null;
  estadoActual: EstadoCliente = 'sin_registrar';
  verificandoEstado: boolean = true;
  notificacionesNoLeidas: number = 0;
  
  private readonly CLIENTE_ANONIMO_KEY = 'cliente_anonimo_actual';
  private readonly ESTADO_KEY = 'estado_cliente';
  
  private notificacionesSubscription?: Subscription;
  private verificacionInterval?: any;

  opcionesDisponibles: OpcionMenu[] = [];

  constructor(
    private supabaseService: SupabaseService,
    private qrHandler: QrHandlerService,
    private toastService: ToastService,
    private router: Router,
    private notificacionesService: NotificacionesService,
    private loadingController: LoadingController
  ) {}

  async ngOnInit() {
    await this.cargarDatosCliente();
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

  // --- LOADING PERSONALIZADO GOURMET ---
  async mostrarLoading() {
    const loading = await this.loadingController.create({
      cssClass: 'custom-loading-gourmet', 
      message: undefined, 
      spinner: null,
      duration: 10000 
    });
    await loading.present();
    return loading;
  }

  // Lógica unificada para cargar Registrado o Anónimo
  async cargarDatosCliente(): Promise<void> {
    try {
      // 1. Intentar obtener usuario registrado desde el servicio
      const usuarioRegistrado = await this.supabaseService.obtenerUsuarioActual();

      if (usuarioRegistrado && usuarioRegistrado.perfil === 'cliente') {
        this.clienteActual = {
          id: usuarioRegistrado.id,
          nombre: usuarioRegistrado.nombre,
          foto_url: usuarioRegistrado.foto_url,
          tipo: 'registrado',
          perfil: 'cliente'
        };
      } else {
        // 2. Si no hay registrado, buscar anónimo en storage
        const { value } = await Preferences.get({ key: this.CLIENTE_ANONIMO_KEY });
        
        if (value) {
          const anon = JSON.parse(value);
          this.clienteActual = {
            id: anon.id,
            nombre: anon.nombre,
            foto_url: anon.foto_url,
            tipo: 'anonimo',
            perfil: 'cliente_anonimo' // Helper para notificaciones
          };
        } else {
          // Si no es ninguno, al login
          this.router.navigate(['/login']);
        }
      }
    } catch (error) {
      console.error('Error al cargar datos del cliente:', error);
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

      // Determinar qué columna consultar según el tipo
      const columnaId = this.clienteActual.tipo === 'registrado' ? 'cliente_id' : 'cliente_anonimo_id';

      const { data: listaEspera, error: errorLista } = await this.supabaseService.supabase
        .from('lista_espera')
        .select('*')
        .eq(columnaId, this.clienteActual.id) // Query dinámica
        .order('fecha_ingreso', { ascending: false })
        .limit(1)
        .single();

      if (errorLista && errorLista.code !== 'PGRST116') {
        console.error('Error al verificar lista de espera:', errorLista);
      }

      if (listaEspera) {
        if (listaEspera.estado === 'esperando') {
          this.estadoActual = 'esperando_mesa';
        } else if (listaEspera.estado === 'atendido') {
          this.estadoActual = 'mesa_asignada';
        }
      } else {
        this.estadoActual = 'sin_registrar';
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

  private iniciarVerificacionPeriodica(): void {
    this.verificacionInterval = setInterval(async () => {
      await this.verificarEstadoCliente();
    }, 10000); 
  }

  private async inicializarNotificaciones(): Promise<void> {
    if (!this.clienteActual) return;

    try {
      // Importante: Asegurarse de suscribirse al ID correcto
      await this.notificacionesService.suscribirNotificaciones(this.clienteActual.id.toString());
      await this.cargarNotificacionesNoLeidas();
      this.escucharNotificaciones();
    } catch (error) {
      console.error('Error al inicializar notificaciones:', error);
    }
  }

  private escucharNotificaciones(): void {
    this.notificacionesSubscription = this.notificacionesService.notificaciones$
      .subscribe(async (notificacion: NotificacionTiempoReal | null) => {
        if (notificacion) {
          // Filtrado extra de seguridad: verificar que la notificación sea para mi perfil
          // (cliente vs cliente_anonimo) si el servicio no lo hace.
          const perfilEsperado = this.clienteActual?.tipo === 'registrado' ? 'cliente' : 'cliente_anonimo'; // O 'anonimo' según tu lógica de inserción
          
          // Asumimos que si llega aquí es válida, o agregas un if(notificacion.destinatario_perfil === ...)
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
    
    this.configurarOpciones();
    await this.toastService.mostrarToastExito('¡Le han asignado una mesa! Escanee el QR de su mesa');
    
    if (notificacion.id) {
      await this.notificacionesService.marcarComoLeida(notificacion.id);
      this.notificacionesNoLeidas = Math.max(0, this.notificacionesNoLeidas - 1);
    }
    
    await this.verificarEstadoCliente();
  }

  private async cargarNotificacionesNoLeidas(): Promise<void> {
    if (!this.clienteActual) return;

    try {
      const notificaciones = await this.notificacionesService
        .obtenerNotificacionesNoLeidas(this.clienteActual.id.toString());
      
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

  configurarOpciones(): void {
    this.opcionesDisponibles = [];

    // La lógica de opciones es idéntica, pero ahora aplica a ambos tipos de usuario
    switch (this.estadoActual) {
      case 'sin_registrar':
        this.opcionesDisponibles = [
          {
            titulo: 'Escanear QR de Ingreso',
            accion: () => this.escanearQRIngreso(),
            deshabilitado: false
          },
          {
            titulo: 'Ver Encuestas Previas',
            accion: () => this.verEncuestas(),
            deshabilitado: false
          },
          {
            titulo: 'Agendar una reserva',
            accion: () => this.router.navigate(['/reservas']),
            deshabilitado: false
          },
          {
            titulo: 'Pedido Delivery',
            accion: () => this.router.navigate(['/delivery']),
            deshabilitado: false
          },
          {
            titulo: 'Estado Delivery',
            accion: () => this.router.navigate(['/estado-pedido']),
            deshabilitado: false
          }
        ];
        break;

      case 'esperando_mesa':
        this.opcionesDisponibles = [
          {
            titulo: 'Estado en Lista de Espera',
            accion: () => {},
            deshabilitado: true
          },
          {
            titulo: 'Ver Encuestas Previas',
            accion: () => this.verEncuestas(),
            deshabilitado: false
          }
        ];
        break;

      case 'mesa_asignada':
        this.opcionesDisponibles = [
          {
            titulo: 'Escanear QR de Mesa',
            accion: () => this.escanearQRMesa(),
            deshabilitado: false
          },
          {
            titulo: 'Ver Encuestas Previas',
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

    const loading = await this.mostrarLoading();
    const resultado = await this.qrHandler.escanearYProcesarQR();
    await loading.dismiss();

    if (!resultado.exito) {
      if (resultado.mensaje !== 'Escaneo cancelado') {
        this.toastService.mostrarToastError(resultado.mensaje);
      }
      return;
    }

    if (resultado.tipo !== 'ingreso') {
      this.toastService.mostrarToastError('Debe escanear el QR de ingreso al local');
      return;
    }
    
    if (!this.clienteActual) return;

    const registrado = await this.qrHandler.registrarEnListaEspera(
        this.clienteActual.id, 
        this.clienteActual.tipo
    );
      
    if (registrado) {
        this.estadoActual = 'esperando_mesa';
        await Preferences.set({
          key: this.ESTADO_KEY,
          value: this.estadoActual
        });
        this.configurarOpciones();

        await this.notificarMaitres();
    }
  }

  private async notificarMaitres() {
    try {
      const { data: maitres } = await this.supabaseService.supabase
          .from('usuarios')
          .select('id, perfil')
          .eq('perfil', 'maitre');

      if (maitres && maitres.length > 0) {
        // Preparamos los datos dinámicos para la notificación
        const datosNotificacion: any = {
           accion: 'revisar_lista'
        };
        
        // Asignamos la key correcta
        if (this.clienteActual!.tipo === 'registrado') {
          datosNotificacion.cliente_id = this.clienteActual!.id;
        } else {
          datosNotificacion.cliente_anonimo_id = this.clienteActual!.id;
        }

        const etiqueta = this.clienteActual!.tipo === 'registrado' ? '(Registrado)' : '(Anónimo)';

          for (const maitre of maitres) {
              await this.notificacionesService.enviarNotificacion({
                  tipo: 'nuevo_cliente_espera' as any, 
                  titulo: 'Nuevo Cliente en Espera',
                  mensaje: `${this.clienteActual!.nombre} ${etiqueta} ingresó a la lista de espera.`,
                  destinatario_id: maitre.id.toString(), // Convertir a string si tu tabla usa texto
                  destinatario_perfil: maitre.perfil,
                  datos: datosNotificacion
              });
          }
      }
    } catch (error) {
      console.error('Error al notificar maitres', error);
    }
  }

  async escanearQRMesa(): Promise<void> {
    if (this.estadoActual !== 'mesa_asignada') {
      this.toastService.mostrarToastError('Primero debe estar en lista de espera y ser asignado a una mesa');
      return;
    }

    const loading = await this.mostrarLoading();
    const resultado = await this.qrHandler.escanearYProcesarQR();
    await loading.dismiss();

    if (!resultado.exito) {
      if (resultado.mensaje !== 'Escaneo cancelado') {
        this.toastService.mostrarToastError(resultado.mensaje);
      }
      return;
    }

    if (resultado.tipo !== 'mesa') {
      this.toastService.mostrarToastError('Debe escanear el QR de su mesa asignada');
      return;
    }

    if (!this.clienteActual) return;

    // 2. Procesar acceso usando el SERVICIO actualizado
    // El servicio maneja la navegación y validación de pedidos
    await this.qrHandler.verificarYAccederMesa(
        this.clienteActual.id,
        this.clienteActual.tipo, // 'registrado' | 'anonimo'
        resultado.datos!.numeroMesa!
    );
  }

  verEncuestas(): void {
    this.router.navigate(['/encuesta-resultados']);
  }

  async cerrarSesion(): Promise<void> {
    const loading = await this.mostrarLoading();
    
    try {
      this.desuscribirNotificaciones();
      await this.notificacionesService.cancelarTodasLasNotificaciones();
      
      if (this.clienteActual?.tipo === 'registrado') {
        await this.supabaseService.cerrarSesion();
      } else {
        await Preferences.remove({ key: this.CLIENTE_ANONIMO_KEY });
      }
      
      await Preferences.remove({ key: this.ESTADO_KEY });
      
      await loading.dismiss();
      this.router.navigate(['/login']);
    } catch (error) {
      await loading.dismiss();
      this.router.navigate(['/login']);
    }
  }

  get nombreCliente(): string {
    return this.clienteActual?.nombre || 'Cliente';
  }

  get estadoTexto(): string {
    if (this.verificandoEstado) return 'Verificando...';
    
    switch (this.estadoActual) {
      case 'sin_registrar': return 'Sin registrar';
      case 'esperando_mesa': return 'En lista de espera';
      case 'mesa_asignada': return 'Mesa asignada';
      default: return 'Estado desconocido';
    }
  }

  get estadoColorHex(): string {
    if (this.verificandoEstado) return '#9ca3af';
    
    switch (this.estadoActual) {
      case 'sin_registrar': return '#f59e0b';
      case 'esperando_mesa': return '#3b82f6';
      case 'mesa_asignada': return '#10b981';
      default: return '#9ca3af';
    }
  }
}