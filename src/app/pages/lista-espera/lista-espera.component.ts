import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import {IonContent,IonButton, IonText, IonButtons, IonCol, IonIcon, IonGrid, IonRow, IonTitle, IonToolbar, IonHeader, IonCard, IonCardHeader, IonSpinner, IonBadge,
  IonCardTitle,IonCardContent,IonRefresher,IonRefresherContent} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ListaEsperaService, ListaEsperaConCliente } from '../../services/lista-espera';
import { SupabaseService, Usuario } from '../../services/supabase';
import { MesaService } from '../../services/mesa';
import { ToastService } from '../../services/toast';
import { NotificacionesService } from '../../services/notificaciones';

@Component({
  selector: 'app-lista-espera',
  templateUrl: './lista-espera.component.html',
  styleUrls: ['./lista-espera.component.scss'],
  standalone: true,
  imports: [CommonModule,FormsModule,IonContent, IonButton, IonIcon, IonTitle, IonButtons, IonCol, IonGrid, IonRow, IonHeader, IonToolbar, IonBadge, IonText,
    IonCard, IonCardHeader, IonCardTitle,IonCardContent,IonRefresher,IonRefresherContent, IonSpinner ]})

export class ListaEsperaComponent implements OnInit {
  @ViewChild('inputMesa') inputMesa!: ElementRef<HTMLInputElement>;
  
  clientesEnEspera: ListaEsperaConCliente[] = [];
  clientesAnonimosEnEspera: ListaEsperaConCliente[] = [];
  usuarioActual: Usuario | null = null;
  cargando: boolean = true;
  mesaSeleccionadaId: number | null = null;
  numeroMesaInput: number | null = null;

  constructor(
    private listaEsperaService: ListaEsperaService,
    private supabaseService: SupabaseService,
    private mesaService: MesaService,
    private toastService: ToastService,
    private notificacionesService: NotificacionesService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.cargarListas();
  }

  async cargarListas(): Promise<void> {
    this.cargando = true;
    try {
      const [clientes, clientesAnonimos] = await Promise.all([
        this.listaEsperaService.obtenerClientesEnEspera(),
        this.listaEsperaService.obtenerClientesAnonimosEnEspera()
      ]);

      this.clientesEnEspera = clientes;
      this.clientesAnonimosEnEspera = clientesAnonimos;
    } catch (error) {
      console.error('Error al cargar listas:', error);
      await this.toastService.mostrarToastError('Error al cargar las listas de espera');
    } finally {
      this.cargando = false;
    }
  }

  async handleRefresh(event: any): Promise<void> {
    await this.cargarListas();
    event.target.complete();
  }

  mostrarInputMesa(listaEsperaId: number): void {
    this.mesaSeleccionadaId = listaEsperaId;
    this.numeroMesaInput = null;
    
    setTimeout(() => {
      if (this.inputMesa?.nativeElement) {
        this.inputMesa.nativeElement.focus();
      }
    }, 100);
  }

  cancelarAsignacion(): void {
    this.mesaSeleccionadaId = null;
    this.numeroMesaInput = null;
  }

  // CORRECCIÓN PRINCIPAL AQUÍ
  async confirmarAsignacion(listaEsperaId: number, esAnonimo: boolean): Promise<void> {
    if (!this.numeroMesaInput || this.numeroMesaInput <= 0) {
      await this.toastService.mostrarToastError('Ingrese un número de mesa válido');
      return;
    }

    try {
      const listaItem = esAnonimo 
        ? this.clientesAnonimosEnEspera.find(c => c.id === listaEsperaId)
        : this.clientesEnEspera.find(c => c.id === listaEsperaId);

      if (!listaItem) {
        await this.toastService.mostrarToastError('No se encontró el cliente en la lista');
        return;
      }

      // Normalización de datos para evitar nulls
      const clienteId = listaItem.cliente_id;
      const clienteAnonimoId = listaItem.cliente_anonimo_id;
      const nombreCliente = this.obtenerNombreCliente(listaItem);

      // Verificación de mesa asignada previa
      const mesaAsignada = await this.mesaService.obtenerMesaAsignadaCliente(
        clienteId || undefined, 
        clienteAnonimoId || undefined
      );

      if (mesaAsignada) {
        const numeroMesa = await this.mesaService.obtenerNumeroMesa(mesaAsignada);
        await this.toastService.mostrarToastAdvertencia(
          `${nombreCliente} ya tiene la mesa ${numeroMesa} asignada`
        );
        this.cancelarAsignacion();
        return;
      }

      // Llamada corregida pasando el ID de la lista de espera para actualizarlo luego
      await this.asignarMesaPorNumero(
        this.numeroMesaInput,
        listaItem, // Pasamos el objeto completo o los IDs saneados
        nombreCliente
      );

    } catch (error: any) {
      console.error('Error al asignar mesa:', error);
      await this.toastService.mostrarToastError(
        error.message || 'Error al asignar la mesa'
      );
    }
  }

  private async asignarMesaPorNumero(
    numeroMesa: number, 
    listaItem: ListaEsperaConCliente,
    nombreCliente: string
  ): Promise<void> {
    try {
      const mesa = await this.mesaService.obtenerMesaPorNumero(numeroMesa);

      if (!mesa) {
        await this.toastService.mostrarToastError(`La mesa ${numeroMesa} no existe`);
        return;
      }

      if (mesa.estado === 'ocupada') {
        await this.toastService.mostrarToastAdvertencia(
          `La mesa ${numeroMesa} ya está ocupada por otro cliente`
        );
        return;
      }

      const clienteId = listaItem.cliente_id;
      const clienteAnonimoId = listaItem.cliente_anonimo_id;
      
      if (clienteAnonimoId) {
          await this.mesaService.asignarMesa(mesa.id, clienteAnonimoId, null);
      } else if (clienteId) {
          await this.mesaService.asignarMesa(mesa.id, null, clienteId); 
      }

      // 2. Determinar destinatario notificación
      const destinatarioId = clienteAnonimoId ? clienteAnonimoId : clienteId;
      const perfilDestinatario = clienteAnonimoId ? 'cliente_anonimo' : 'cliente';

      if (!destinatarioId) throw new Error("No se pudo identificar al cliente");

      // 3. Enviar Notificación
      await this.notificacionesService.enviarNotificacion({
        tipo: 'mesa_asignada',
        titulo: 'Mesa Asignada',
        mensaje: `${nombreCliente}, diríjase a la mesa ${numeroMesa}`,
        destinatario_id: destinatarioId, // Ahora es seguro, no es null
        destinatario_perfil: perfilDestinatario, // Dinámico
        datos: {
          numero_mesa: numeroMesa,
          mesa_id: mesa.id,
          nombre_cliente: nombreCliente
        }
      });

      // 4. CRUCIAL: Actualizar estado en Lista de Espera
      // Esto faltaba y es lo que causaba que siguiera en "esperando"
      await this.listaEsperaService.marcarComoAtendido(listaItem.id);

      await this.toastService.mostrarToastExito(
        `Mesa ${numeroMesa} asignada a ${nombreCliente}`
      );

      // Notificación local (opcional si ya usas realtime)
      // await this.notificacionesService.notificarMesaAsignada(nombreCliente, numeroMesa);

      this.cancelarAsignacion();
      await this.cargarListas();

    } catch (error: any) {
      console.error('Error al confirmar asignación:', error);
      throw error; // Re-lanzar para que lo capture el método padre
    }
  }

  obtenerNombreCliente(item: ListaEsperaConCliente): string {
    if (item.cliente) {
      return `${item.cliente.nombre} ${item.cliente.apellido}`;
    }
    if (item.cliente_anonimo) {
      return item.cliente_anonimo.nombre;
    }
    return 'Desconocido';
  }

  formatearHora(fecha: string): string {
    const date = new Date(fecha);
    return date.toLocaleTimeString('es-AR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  volverAlHome(): void {
    this.router.navigate(['/home']);
  }

  cerrarSesion(): void {
    this.supabaseService.cerrarSesion();
  }
}