import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonInput, IonTextarea, IonButton, 
  IonIcon, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonGrid, IonRow, IonCol, IonSpinner } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../../services/supabase';
import { ToastService } from '../../../../services/toast';
import { ImagenesService } from '../../../../services/imagenes';

interface FotoBebida {
  url: string;
  blob?: Blob;
}

@Component({
  selector: 'app-agregar-bebida',
  templateUrl: './agregar-bebida.component.html',
  styleUrls: ['./agregar-bebida.component.scss'],
  standalone: true,
  imports: [
    IonContent, IonItem, IonLabel, IonInput, IonTextarea, 
    IonButton, IonIcon, IonHeader, IonToolbar, IonButtons, IonBackButton, 
    IonGrid, IonRow, IonCol, FormsModule, CommonModule
  ]
})
export class AgregarBebidaComponent implements OnInit {
  nombre: string = '';
  descripcion: string = '';
  tiempoElaboracion: number | null = null;
  precio: number | null = null;
  fotos: FotoBebida[] = [];
  
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
      return { valido: false, mensaje: 'El nombre es obligatorio' };
    }

    if (this.nombre.trim().length > 100) {
      return { valido: false, mensaje: 'El nombre no puede superar los 100 caracteres' };
    }

    if (!this.descripcion || this.descripcion.trim().length === 0) {
      return { valido: false, mensaje: 'La descripción es obligatoria' };
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
      return { valido: false, mensaje: 'Debe agregar exactamente 3 fotos de la bebida' };
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

  async guardarBebida() {
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
        
        const nombreArchivo = `bebida-${this.nombre.trim().toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${i}.jpg`;
        
        const resultado = await this.supabaseService.subirImagen(
          'bebidas', 
          nombreArchivo, 
          this.fotos[i].blob!
        );

        if (!resultado.success || !resultado.url) {
          throw new Error(resultado.message || 'Error al subir imagen');
        }

        fotosUrls.push(resultado.url);
      }

      this.loadingMessage = 'Guardando información de la bebida...';

      const bebidaData = {
        nombre: this.nombre.trim(),
        descripcion: this.descripcion.trim(),
        tipo: 'bebida',
        tiempo_elaboracion: this.tiempoElaboracion!,
        precio: this.precio!,
        foto_url: JSON.stringify(fotosUrls),
        activo: true
      };

      const { error } = await this.supabaseService.supabase
        .from('menu')
        .insert([bebidaData]);

      if (error) {
        throw error;
      }

      this.toastService.mostrarToastExito('¡Bebida agregada!');
      this.router.navigate(['/home']);
    } catch (error) {
      console.error('Error al guardar bebida:', error);
      this.toastService.mostrarToastError('Error al guardar la bebida. Intente nuevamente.');
    } finally {
      this.isLoading = false;
      this.loadingMessage = '';
    }
  }
}