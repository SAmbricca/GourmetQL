import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButton, 
  IonButtons, IonIcon, IonFooter, IonInput, IonText
} from '@ionic/angular/standalone';
import { ChatService, Mensaje } from '../../services/chat';
import { NotificacionesService } from '../../services/notificaciones';
import { ToastService } from '../../services/toast';
import { SupabaseService } from '../../services/supabase';
import { ClienteAnonimoService } from '../../services/cliente-anonimo';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-consulta-mozo',
  templateUrl: './consulta-mozo.component.html',
  styleUrls: ['./consulta-mozo.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, 
    IonContent, IonHeader, IonToolbar, IonTitle, IonButton, 
    IonButtons, IonIcon, IonFooter, IonInput, IonText
  ]
})
export class ConsultaMozoComponent implements OnInit, OnDestroy {
  @ViewChild(IonContent) content!: IonContent;
  
  mensajes: Mensaje[] = [];
  nuevoMensaje: string = '';
  cargando: boolean = true;
  enviando: boolean = false;
  
  pedidoId: number | null = null;
  mesaNumero: number | null = null;
  nombreCliente: string = '';
  
  private chatSub?: Subscription;

  constructor(
    private chatService: ChatService,
    private notificacionesService: NotificacionesService,
    private toastService: ToastService,
    private supabaseService: SupabaseService,
    private clienteAnonimoService: ClienteAnonimoService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  async ngOnInit() {
    this.cargando = true;

    const usuario = await this.supabaseService.obtenerUsuarioActual();
    if (usuario) {
      this.nombreCliente = usuario.nombre;
    } else {
      const anonimo = await this.clienteAnonimoService.obtenerClienteAnonimoActual();
      this.nombreCliente = anonimo ? anonimo.nombre : 'Cliente';
    }

    const params = this.route.snapshot.queryParams;
    
    if (params['pedidoId'] && params['mesaNumero']) {
        console.log('⚡ Carga rápida de chat por parámetros');
        this.pedidoId = +params['pedidoId'];
        this.mesaNumero = +params['mesaNumero'];
        
        await this.iniciarChat();

    } else {
        await this.validarYObtenerPedido(usuario?.id);
    }
  }

  async validarYObtenerPedido(clienteId?: number) {
      let anonimoId = undefined;
      if (!clienteId) {
          const anonimo = await this.clienteAnonimoService.obtenerClienteAnonimoActual();
          anonimoId = anonimo?.id;
      }

      const validacion = await this.chatService.obtenerPedidoActivo(clienteId, anonimoId);

      if (!validacion.success || !validacion.pedidoId) {
        await this.toastService.mostrarToastError('Debes tener una mesa asignada.');
        this.router.navigate(['/home']); 
        return;
      }

      this.pedidoId = validacion.pedidoId;
      this.mesaNumero = validacion.mesaNumero || 0;
      await this.iniciarChat();
  }

  async iniciarChat() {
      if (!this.pedidoId) return;

      await this.chatService.cargarChat(this.pedidoId);
      
      this.chatSub = this.chatService.mensajes$.subscribe(msgs => {
        this.mensajes = msgs;
        this.cargando = false;
        setTimeout(() => this.scrollToBottom(), 100);
      });
  }

  ngOnDestroy() {
    this.chatService.desuscribir();
    if (this.chatSub) this.chatSub.unsubscribe();
  }


  async enviarMensaje() {
    if (!this.nuevoMensaje.trim() || !this.pedidoId) return;

    this.enviando = true;
    const texto = this.nuevoMensaje.trim();
    this.nuevoMensaje = ''; 

    const mensajeTemp: Mensaje = {
      pedido_id: this.pedidoId!,
      emisor_tipo: 'cliente',
      mensaje: texto,
      fecha_creacion: new Date().toISOString()
    };
    
    this.mensajes.push(mensajeTemp);
    setTimeout(() => this.scrollToBottom(), 100);

    const exito = await this.chatService.enviarMensaje(this.pedidoId, texto, 'cliente');

    if (exito) {
      await this.notificarMozos(texto); // Agregado await para asegurar el ciclo
    } else {
      this.mensajes.pop(); 
      this.nuevoMensaje = texto;
      this.toastService.mostrarToastError('Error al enviar. Revisa tu conexión.');
    }
    this.enviando = false;
  }

  private async notificarMozos(texto: string) {
    try {
      // Buscamos a todos los mozos habilitados
      const { data: mozos } = await this.supabaseService.supabase
        .from('usuarios')
        .select('id')
        .eq('perfil', 'mozo')
        .eq('estado', 'habilitado'); // Aseguramos que solo reciban mozos activos

      if (mozos && mozos.length > 0) {
        // Creamos un array de promesas para enviar en paralelo
        const promesas = mozos.map(m => 
          this.notificacionesService.enviarNotificacion({
            tipo: 'consulta_mozo',
            titulo: `Mesa ${this.mesaNumero} - Consulta`,
            mensaje: `${this.nombreCliente}: ${texto.substring(0, 40)}${texto.length > 40 ? '...' : ''}`,
            // CORRECCIÓN: Eliminado .toString(). La interfaz pide number y Supabase maneja la conversión.
            destinatario_id: m.id, 
            destinatario_perfil: 'mozo',
            datos: { pedido_id: this.pedidoId }
          })
        );
        await Promise.all(promesas);
      }
    } catch (error) {
      console.error('Error notificando mozos:', error);
    }
  }

  obtenerInfoMesa(): string {
      const ahora = new Date();
      const fecha = `${ahora.getDate()}/${ahora.getMonth() + 1} ${ahora.getHours()}:${String(ahora.getMinutes()).padStart(2,'0')}`;
      return `Mesa ${this.mesaNumero || '?'} - ${fecha}`;
  }
  
  formatearFecha(fecha: string): string {
    const date = new Date(fecha);
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  private scrollToBottom() {
    if (this.content) this.content.scrollToBottom(300);
  }

  volver() {
    this.router.navigate(['/mesa-opciones']);
  }
}