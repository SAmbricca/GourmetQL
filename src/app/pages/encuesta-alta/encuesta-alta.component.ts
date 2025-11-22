import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonButton, IonIcon, IonCard, IonCardContent, IonRange, 
  IonTextarea, IonLabel, IonItem, IonList, IonText 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, star, starOutline, sendOutline, happyOutline, sadOutline } from 'ionicons/icons';
import { EncuestasService } from '../../services/encuestas';
import { SupabaseService } from '../../services/supabase';
import { ToastService } from '../../services/toast';
import { ClienteAnonimoService } from '../../services/cliente-anonimo';

@Component({
  selector: 'app-encuesta-alta',
  templateUrl: './encuesta-alta.component.html',
  styleUrls: ['./encuesta-alta.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
    IonButton, IonIcon, IonCard, IonCardContent, IonRange, 
    IonTextarea, IonLabel
  ]
})
export class EncuestaAltaComponent implements OnInit {
  // Inyecciones
  private encuestasService = inject(EncuestasService);
  private supabaseService = inject(SupabaseService);
  private clienteAnonimoService = inject(ClienteAnonimoService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Estado
  pedidoId: number = 0;
  cargando: boolean = false;

  // Modelo del formulario (3 aspectos visuales)
  calificacionComida: number = 5;
  calificacionServicio: number = 5;
  calificacionAmbiente: number = 5;
  comentariosTexto: string = '';
  fotos: string[] = []; // Preparado para futura implementación de cámara

  constructor() {
    addIcons({ arrowBackOutline, star, starOutline, sendOutline, happyOutline, sadOutline });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(async params => {
      if (params['pedidoId']) {
        this.pedidoId = Number(params['pedidoId']);
        await this.verificarPermiso();
      } else {
        this.toastService.mostrarToastError('Error de navegación');
        this.volver();
      }
    });
  }

  async verificarPermiso() {
    const yaExiste = await this.encuestasService.verificarEncuestaExistente(this.pedidoId);
    if (yaExiste) {
      // Si ya existe, redirigimos directamente a los resultados (Punto 20.3)
      this.router.navigate(['/encuesta-resultados']);
    }
  }

  // Helpers visuales para las estrellas
  getArray(n: number) { return new Array(n); }

  // Calcular promedio general para la BD
  get promedioGeneral(): number {
    const promedio = (this.calificacionComida + this.calificacionServicio + this.calificacionAmbiente) / 3;
    return Math.round(promedio); // Redondeamos para que encaje en el campo integer de DB
  }

  async enviarEncuesta() {
    if (this.cargando) return;
    this.cargando = true;

    try {
      // Obtener IDs de usuario
      let clienteId = undefined;
      let anonimoId = undefined;
      const usuario = await this.supabaseService.obtenerUsuarioActual();
      
      if (usuario) {
        const { data } = await this.supabaseService.supabase
          .from('usuarios').select('id').eq('auth_user_id', usuario.id).single();
        clienteId = data?.id;
      } else {
        const anonimo = await this.clienteAnonimoService.obtenerClienteAnonimoActual();
        anonimoId = anonimo?.id;
      }

      // Empaquetar los detalles en el campo comentarios (JSON string)
      const detalleComentarios = JSON.stringify({
        texto: this.comentariosTexto,
        desglose: {
          comida: this.calificacionComida,
          servicio: this.calificacionServicio,
          ambiente: this.calificacionAmbiente
        }
      });

      const resultado = await this.encuestasService.crearEncuesta({
        pedido_id: this.pedidoId,
        cliente_id: clienteId,
        cliente_anonimo_id: anonimoId,
        calificacion: this.promedioGeneral, // 1-5 General
        comentarios: detalleComentarios
      });

      if (resultado.success) {
        await this.toastService.mostrarToastExito('¡Gracias por tu opinión!');
        this.router.navigate(['/encuesta-resultados']); // Redirigir a gráficos
      } else {
        await this.toastService.mostrarToastError(resultado.message || 'Error al enviar');
      }

    } catch (error) {
      console.error(error);
      this.toastService.mostrarToastError('Error desconocido');
    } finally {
      this.cargando = false;
    }
  }

  volver() {
    this.router.navigate(['/mesa-opciones']);
  }
}