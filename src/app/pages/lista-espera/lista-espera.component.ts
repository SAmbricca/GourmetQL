import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import {IonContent,IonButton, IonText, IonButtons, IonCol, IonGrid, IonRow, IonTitle, IonToolbar, IonHeader, IonCard, IonCardHeader, 
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
  imports: [CommonModule,FormsModule,IonContent, IonButton, IonText, IonTitle, IonButtons, IonCol, IonGrid, IonRow, IonHeader, IonToolbar, 
    IonCard, IonCardHeader, IonCardTitle,IonCardContent,IonRefresher,IonRefresherContent]})

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

      const clienteId = listaItem.cliente_id;
      const clienteAnonimoId = listaItem.cliente_anonimo_id;
      const nombreCliente = this.obtenerNombreCliente(listaItem);

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

      await this.asignarMesaPorNumero(
        this.numeroMesaInput,
        clienteAnonimoId!,
        clienteId || undefined,
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
    clienteAnonimoId: number,
    clienteId: number | undefined,
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

      const mesaYaAsignada = await this.mesaService.obtenerMesaAsignadaCliente(
        clienteId, 
        clienteAnonimoId
      );
      
      if (mesaYaAsignada) {
        const numeroMesaAsignada = await this.mesaService.obtenerNumeroMesa(mesaYaAsignada);
        await this.toastService.mostrarToastAdvertencia(
          `${nombreCliente} ya tiene la mesa ${numeroMesaAsignada} asignada`
        );
        return;
      }

      await this.mesaService.asignarMesa(mesa.id, clienteAnonimoId);
      
      await this.notificacionesService.enviarNotificacion({
        tipo: 'mesa_asignada',
        titulo: 'Mesa Asignada',
        mensaje: `${nombreCliente}, diríjase a la mesa ${numeroMesa}`,
        destinatario_id: clienteAnonimoId,
        destinatario_perfil: 'cliente_anonimo',
        datos: {
          numero_mesa: numeroMesa,
          mesa_id: mesa.id,
          nombre_cliente: nombreCliente
        }
      });

      await this.toastService.mostrarToastExito(
        `Mesa ${numeroMesa} asignada a ${nombreCliente}`
      );

      await this.notificacionesService.notificarMesaAsignada(nombreCliente, numeroMesa);

      this.cancelarAsignacion();
      await this.cargarListas();

    } catch (error: any) {
      console.error('Error al confirmar asignación:', error);
      await this.toastService.mostrarToastError(
        error.message || 'Error al asignar la mesa'
      );
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