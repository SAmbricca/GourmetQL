import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButton, 
  IonButtons, IonIcon, IonInput, IonCard, IonCardHeader, IonCardContent,
  IonText, IonBadge, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { ChatService, Mensaje } from '../../services/chat';
import { SupabaseService } from '../../services/supabase';
import { NotificacionesService } from '../../services/notificaciones';
import { ToastService } from '../../services/toast';
import { Subscription } from 'rxjs';

interface ChatActivo {
  pedido_id: number;
  mesa_numero: number;
  cliente_id?: number;
  cliente_anonimo_id?: number; // Agregado para soporte de anónimos
  cliente_nombre: string;
  mensajes: Mensaje[];
  ultimo_mensaje: Mensaje | null;
  mostrarChat: boolean;
  estado_visual: 'pendiente' | 'respondida';
}

@Component({
  selector: 'app-consulta-mozo-admin',
  templateUrl: './consulta-mozo-admin.component.html',
  styleUrls: ['./consulta-mozo-admin.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, 
    IonContent, IonHeader, IonToolbar, IonTitle, IonButton, 
    IonButtons, IonIcon, IonInput, IonCard, IonCardHeader, IonCardContent,
    IonText, IonBadge, IonRefresher, IonRefresherContent
  ]
})
export class ConsultaMozoAdminComponent implements OnInit, OnDestroy {
  
  chats: ChatActivo[] = [];
  respuestaMozo: string = '';
  cargando: boolean = true;
  enviando: boolean = false;
  
  private notifSub?: Subscription;
  private activeChatSub?: Subscription;
  private chatSeleccionado: ChatActivo | null = null;

  constructor(
    private supabaseService: SupabaseService,
    private chatService: ChatService,
    private notificacionesService: NotificacionesService,
    private toastService: ToastService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.cargarChats(null);
    
    // Escuchar notificaciones entrantes (ej: un cliente manda mensaje mientras el mozo está en esta pantalla)
    this.notifSub = this.notificacionesService.notificaciones$.subscribe(n => {
      if (n && n.tipo === 'consulta_mozo') {
        // Si no estamos chateando con esa mesa específica, actualizamos la lista para mostrar el badge/estado
        if (!this.chatSeleccionado || this.chatSeleccionado.pedido_id !== n.datos.pedido_id) {
            this.cargarChats(null);
        }
      }
    });
  }

  ngOnDestroy() {
    if (this.notifSub) this.notifSub.unsubscribe();
    if (this.activeChatSub) this.activeChatSub.unsubscribe();
    this.chatService.desuscribir();
  }

  async cargarChats(event: any) {
    this.cargando = true;
    // 1. Traer pedidos activos con información completa de cliente y cliente anónimo
    const { data: pedidos } = await this.supabaseService.supabase
      .from('pedidos')
      .select(`
        id, mesa_id, cliente_id, cliente_anonimo_id,
        mesas(numero),
        clientes:usuarios(nombre),
        clientes_anonimos(nombre)
      `)
      .in('estado', ['pendiente', 'preparacion', 'listo', 'entregado', 'confirmado']); 

    if (!pedidos) {
        this.cargando = false;
        if (event) event.target.complete();
        return;
    }

    const listaTemp: ChatActivo[] = [];

    // 2. Buscar último mensaje de cada chat
    for (const p of pedidos) {
        const { data: msgs } = await this.supabaseService.supabase
            .from('chat_mensajes')
            .select('*')
            .eq('pedido_id', p.id)
            .order('fecha_creacion', { ascending: false })
            .limit(1);

        if (msgs && msgs.length > 0) {
            const ultimo = msgs[0] as Mensaje;
            // Determinar nombre, sea registrado o anónimo
            const nombre = p.clientes ? (p.clientes as any).nombre : ((p.clientes_anonimos as any)?.nombre || 'Cliente');

            listaTemp.push({
                pedido_id: p.id,
                mesa_numero: (p.mesas as any).numero,
                cliente_id: p.cliente_id,
                cliente_anonimo_id: p.cliente_anonimo_id, // Guardamos el ID anónimo
                cliente_nombre: nombre,
                mensajes: [],
                ultimo_mensaje: ultimo,
                mostrarChat: false,
                estado_visual: ultimo.emisor_tipo === 'cliente' ? 'pendiente' : 'respondida'
            });
        }
    }

    // Ordenar: Pendientes primero
    this.chats = listaTemp.sort((a, b) => {
        if (a.estado_visual === 'pendiente' && b.estado_visual !== 'pendiente') return -1;
        if (a.estado_visual !== 'pendiente' && b.estado_visual === 'pendiente') return 1;
        return 0;
    });

    this.cargando = false;
    if (event) event.target.complete();
  }

  async toggleChat(chat: ChatActivo) {
    if (chat.mostrarChat) {
        // Cerrar
        chat.mostrarChat = false;
        this.chatSeleccionado = null;
        if (this.activeChatSub) this.activeChatSub.unsubscribe();
        this.chatService.desuscribir();
        return;
    }

    // Cerrar otros
    this.chats.forEach(c => c.mostrarChat = false);
    
    // Abrir este
    chat.mostrarChat = true;
    this.chatSeleccionado = chat;

    // Conectar Realtime
    await this.chatService.cargarChat(chat.pedido_id);
    
    if (this.activeChatSub) this.activeChatSub.unsubscribe();
    
    this.activeChatSub = this.chatService.mensajes$.subscribe(msgs => {
        chat.mensajes = msgs;
        // Actualizar estado visual
        if (msgs.length > 0) {
            const ultimo = msgs[msgs.length - 1];
            chat.ultimo_mensaje = ultimo;
            chat.estado_visual = ultimo.emisor_tipo === 'cliente' ? 'pendiente' : 'respondida';
        }
    });
  }

  async responderConsulta(chat: ChatActivo) {
    if (!this.respuestaMozo.trim()) return;

    this.enviando = true;
    const texto = this.respuestaMozo.trim();
    this.respuestaMozo = '';

    const exito = await this.chatService.enviarMensaje(chat.pedido_id, texto, 'mozo');

    if (exito) {
        // Lógica para enviar Push Notification al destinatario correcto
        let destinatarioId: number | null = null;
        let perfilDestino: 'cliente' | 'cliente_anonimo' = 'cliente';

        if (chat.cliente_id) {
            destinatarioId = chat.cliente_id;
            perfilDestino = 'cliente';
        } else if (chat.cliente_anonimo_id) {
            destinatarioId = chat.cliente_anonimo_id;
            perfilDestino = 'cliente_anonimo';
        }
        
        if (destinatarioId) {
            await this.notificacionesService.enviarNotificacion({
                tipo: 'consulta_mozo',
                titulo: 'Respuesta del Mozo',
                mensaje: `Mesa ${chat.mesa_numero}: ${texto}`,
                destinatario_id: destinatarioId,
                destinatario_perfil: perfilDestino,
                datos: { pedido_id: chat.pedido_id }
            });
        }
        
        this.toastService.mostrarToastExito('Respuesta enviada');
    } else {
        this.toastService.mostrarToastError('Error al enviar');
        this.respuestaMozo = texto;
    }
    this.enviando = false;
  }

  // Getters para el HTML
  obtenerConsultasPendientes(): number {
      return this.chats.filter(c => c.estado_visual === 'pendiente').length;
  }

  filtrarConsultas(estado: 'pendiente' | 'respondida'): ChatActivo[] {
      return this.chats.filter(c => c.estado_visual === estado);
  }

  formatearFecha(fecha?: string): string {
      if (!fecha) return '';
      const d = new Date(fecha);
      return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  
  formatearFechaCompleta(fecha?: string): string {
      if (!fecha) return '';
      const d = new Date(fecha);
      return `${d.getDate()}/${d.getMonth()+1} ${this.formatearFecha(fecha)}`;
  }

  volver() {
    this.router.navigate(['/home']);
  }
}