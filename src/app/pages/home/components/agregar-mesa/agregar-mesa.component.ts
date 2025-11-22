import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { 
  IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonInput, 
  IonButton, IonIcon, IonSelect, IonSelectOption, IonHeader, IonToolbar, 
  IonTitle, IonButtons, IonBackButton, IonGrid, IonRow, IonCol, IonSpinner 
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MesaService } from '../../../../services/mesa';
import { ToastService } from '../../../../services/toast';
import { ImagenesService } from '../../../../services/imagenes';
import QRCode from 'qrcode';

interface FotoMesa {
  url: string;
  blob?: Blob;
}

@Component({
  selector: 'app-agregar-mesa',
  templateUrl: './agregar-mesa.component.html',
  styleUrls: ['./agregar-mesa.component.scss'],
  standalone: true,
  imports: [
    IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonInput, 
    IonButton, IonIcon, IonSelect, IonSelectOption, IonHeader, IonToolbar, 
    IonTitle, IonButtons, IonBackButton, IonGrid, IonRow, IonCol, IonSpinner,
    FormsModule, CommonModule
  ]
})
export class AgregarMesaComponent implements OnInit {
  numero: number | null = null;
  cantidadComensales: number | null = null;
  tipo: string = 'estandar';
  foto: FotoMesa | null = null;

  // Variables para el loading
  isLoading: boolean = false;
  loadingMessage: string = '';

  constructor(
    private router: Router,
    private mesaService: MesaService,
    private toastService: ToastService,
    private imagenesService: ImagenesService
  ) {}

  ngOnInit() {}

  validarFormulario(): { valido: boolean; mensaje: string } {
    if (this.numero === null || this.numero === undefined) {
      return { valido: false, mensaje: 'El número de mesa es obligatorio' };
    }
    if (typeof this.numero !== 'number' || isNaN(this.numero)) {
      return { valido: false, mensaje: 'El número de mesa debe ser un número válido' };
    }
    if (!Number.isInteger(this.numero)) {
      return { valido: false, mensaje: 'El número de mesa debe ser un número entero' };
    }
    if (this.numero <= 0) {
      return { valido: false, mensaje: 'El número de mesa debe ser mayor a 0' };
    }

    if (this.cantidadComensales === null || this.cantidadComensales === undefined) {
      return { valido: false, mensaje: 'La cantidad de comensales es obligatoria' };
    }

    if (!Number.isInteger(this.cantidadComensales)) {
      return { valido: false, mensaje: 'La cantidad de comensales debe ser un número entero' };
    }
    if (this.cantidadComensales <= 0) {
      return { valido: false, mensaje: 'La cantidad de comensales debe ser mayor a 0' };
    }
    if (this.cantidadComensales > 20) {
      return { valido: false, mensaje: 'La cantidad de comensales no puede superar 20 personas' };
    }

    if (!this.tipo || (this.tipo !== 'estandar' && this.tipo !== 'vip' && this.tipo !== 'movilidad_reducida')) {
      return { valido: false, mensaje: 'Debe seleccionar un tipo válido de mesa' };
    }

    if (!this.foto) {
      return { valido: false, mensaje: 'Debe agregar una foto de la mesa' };
    }

    return { valido: true, mensaje: '' };
  }

  async agregarFoto(source: 'camera' | 'gallery') {
    try {
      const imageResult = await this.imagenesService.capturarFoto(source, {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.7
      });

      this.foto = { 
        url: imageResult.url, 
        blob: imageResult.blob 
      };
      
      this.toastService.mostrarToastExito('Foto agregada y optimizada');
    } catch (error) {
      console.error('Error al tomar foto:', error);
      this.toastService.mostrarToastError('Error al capturar la foto');
    }
  }

  eliminarFoto() {
    this.foto = null;
    this.toastService.mostrarToastExito('Foto eliminada');
  }

  private async generarCodigoQR(mesaNumero: number): Promise<Blob> {
    try {
      const qrContent = `MESA_${mesaNumero}`;
      
      return await this.imagenesService.generarQRCode(qrContent, QRCode, 512);
    } catch (error) {
      console.error('Error al generar código QR:', error);
      throw new Error('No se pudo generar el código QR');
    }
  }

  async guardarMesa() {
    const validacion = this.validarFormulario();
    if (!validacion.valido) {
      this.toastService.mostrarToastError(validacion.mensaje);
      return;
    }

    this.isLoading = true;
    this.loadingMessage = 'Preparando...';

    try {
      this.loadingMessage = 'Subiendo foto de la mesa...';
      
      const nombreArchivoFoto = `mesa-${this.numero}-${Date.now()}.jpg`;
      const resultadoFoto = await this.mesaService.subirImagenMesa(
        nombreArchivoFoto,
        this.foto!.blob!
      );

      if (!resultadoFoto.success || !resultadoFoto.url) {
        throw new Error(resultadoFoto.message || 'Error al subir la foto');
      }

      this.loadingMessage = 'Guardando información de la mesa...';

      const mesaData = {
        numero: this.numero!,
        cantidad_comensales: this.cantidadComensales!,
        foto_url: resultadoFoto.url,
        estado: 'libre',
        codigo_qr: null
      };

      const mesaCreada = await this.mesaService.agregarMesa(mesaData);
      
      if (!mesaCreada || !mesaCreada.id) {
        throw new Error('Error al crear la mesa en la base de datos');
      }

      this.loadingMessage = 'Generando código QR...';
      
      const qrBlob = await this.generarCodigoQR(mesaCreada.numero);
      this.loadingMessage = 'Subiendo código QR...';

      const nombreArchivoQR = `qr-mesa-${mesaCreada.numero}-${Date.now()}.png`;
      const resultadoQR = await this.mesaService.subirCodigoQR(
        nombreArchivoQR,
        qrBlob
      );

      if (!resultadoQR.success || !resultadoQR.url) {
        throw new Error(resultadoQR.message || 'Error al subir el código QR');
      }

      this.loadingMessage = 'Finalizando...';

      await this.mesaService.actualizarMesa(mesaCreada.id, {
        codigo_qr: resultadoQR.url
      });

      this.toastService.mostrarToastExito('¡Mesa agregada!');
      this.router.navigate(['/home']);
    } catch (error) {
      console.error('Error al guardar mesa:', error);
      
      let mensajeError = 'Error al guardar la mesa. Intente nuevamente.';
      if (error instanceof Error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          mensajeError = 'Ya existe una mesa con ese número';
        } else if (error.message) {
          mensajeError = error.message;
        }
      }
      
      this.toastService.mostrarToastError(mensajeError);
    } finally {
      this.isLoading = false;
      this.loadingMessage = '';
    }
  }
}