import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonItem, IonLabel, IonInput, IonTextarea, IonButton, 
  IonIcon, IonHeader, IonToolbar, IonButtons, IonBackButton, 
  IonGrid, IonRow, IonCol } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../../services/supabase';
import { ToastService } from '../../../../services/toast';
import { ImagenesService } from '../../../../services/imagenes';

interface FotoPlato {
  url: string;
  blob?: Blob;
}

@Component({
  selector: 'app-agregar-plato',
  templateUrl: './agregar-plato.component.html',
  styleUrls: ['./agregar-plato.component.scss'],
  standalone: true,
  imports: [
    IonContent, IonItem, IonLabel, IonInput, IonTextarea, IonButton, 
    IonIcon, IonHeader, IonToolbar,  IonButtons, IonBackButton, 
    IonGrid, IonRow, IonCol, FormsModule, CommonModule
  ]
})
export class AgregarPlatoComponent implements OnInit {
  nombre: string = '';
  descripcion: string = '';
  tipo: string = 'comida';
  tiempoElaboracion: number | null = null;
  precio: number | null = null;
  fotos: FotoPlato[] = [];
  
  // Variables para el loading
  isLoading: boolean = false;
  loadingMessage: string = '';

  constructor(
    private router: Router,
    private supabaseService: SupabaseService,
    private toastService: ToastService,
    private imagenesService: ImagenesService
  ) {}

  ngOnInit() {}

  validarFormulario(): { valido: boolean; mensaje: string } {
    if (!this.nombre || this.nombre.trim().length === 0) {
      return { valido: false, mensaje: 'El nombre del plato es obligatorio' };
    }

    if (this.nombre.trim().length > 100) {
      return { valido: false, mensaje: 'El nombre no puede superar los 100 caracteres' };
    }

    if (!this.descripcion || this.descripcion.trim().length === 0) {
      return { valido: false, mensaje: 'La descripción es obligatoria' };
    }

    if (!this.tipo || (this.tipo !== 'comida' && this.tipo !== 'bebida')) {
      return { valido: false, mensaje: 'Debe seleccionar un tipo válido (comida o bebida)' };
    }

    if (this.tiempoElaboracion === null || this.tiempoElaboracion === undefined) {
      return { valido: false, mensaje: 'El tiempo de elaboración es obligatorio' };
    }
    if (typeof this.tiempoElaboracion !== 'number' || isNaN(this.tiempoElaboracion)) {
      return { valido: false, mensaje: 'El tiempo de elaboración debe ser un número válido' };
    }
    if (!Number.isInteger(this.tiempoElaboracion)) {
      return { valido: false, mensaje: 'El tiempo de elaboración debe ser un número entero' };
    }

    if (this.precio === null || this.precio === undefined) {
      return { valido: false, mensaje: 'El precio es obligatorio' };
    }
    if (typeof this.precio !== 'number' || isNaN(this.precio)) {
      return { valido: false, mensaje: 'El precio debe ser un número válido' };
    }
    if (this.precio <= 0) {
      return { valido: false, mensaje: 'El precio debe ser mayor a 0' };
    }

    if (this.fotos.length !== 3) {
      return { valido: false, mensaje: 'Debe agregar exactamente 3 fotos del plato' };
    }

    return { valido: true, mensaje: '' };
  }

  async agregarFoto(source: 'camera' | 'gallery') {
    try {
      const imageResult = await this.imagenesService.capturarFoto(source, {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.75
      });

      this.fotos.push({ 
        url: imageResult.url, 
        blob: imageResult.blob 
      });
      
      this.toastService.mostrarToastExito(`Foto ${this.fotos.length} agregada y optimizada`);
    } catch (error) {
      console.error('Error al tomar foto:', error);
      this.toastService.mostrarToastError('Error al capturar la foto');
    }
  }

  eliminarFoto(index: number) {
    if (index >= 0 && index < this.fotos.length) {
      this.fotos.splice(index, 1);
      this.toastService.mostrarToastExito('Foto eliminada');
    }
  }

  async guardarPlato() {
    const validacion = this.validarFormulario();
    if (!validacion.valido) {
      this.toastService.mostrarToastError(validacion.mensaje);
      return;
    }

    this.isLoading = true;
    this.loadingMessage = 'Preparando...';

    try {
      const fotosUrls: string[] = [];
      
      for (let i = 0; i < this.fotos.length; i++) {
        this.loadingMessage = `Subiendo foto ${i + 1} de ${this.fotos.length}...`;
        
        const nombreArchivo = `plato-${this.nombre.trim().toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${i}.jpg`;
        
        const resultado = await this.supabaseService.subirImagen(
          'platos', 
          nombreArchivo, 
          this.fotos[i].blob!
        );

        if (!resultado.success || !resultado.url) {
          throw new Error(resultado.message || 'Error al subir imagen');
        }

        fotosUrls.push(resultado.url);
      }

      this.loadingMessage = 'Guardando información del plato...';

      const platoData = {
        nombre: this.nombre.trim(),
        descripcion: this.descripcion.trim(),
        tipo: this.tipo,
        tiempo_elaboracion: this.tiempoElaboracion!,
        precio: this.precio!,
        foto_url: JSON.stringify(fotosUrls),
        activo: true
      };

      await this.supabaseService.agregarPlato(platoData);

      this.toastService.mostrarToastExito('¡Plato agregado!');
      this.router.navigate(['/home']);
    } catch (error) {
      console.error('Error al guardar plato:', error);
      this.toastService.mostrarToastError('Error al guardar el plato. Intente nuevamente.');
    } finally {
      this.isLoading = false;
      this.loadingMessage = '';
    }
  }
}