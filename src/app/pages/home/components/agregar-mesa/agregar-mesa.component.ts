import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { 
  IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonInput, 
  IonButton, IonIcon, IonSelect, IonSelectOption, IonHeader, IonToolbar, 
  IonTitle, IonButtons, IonBackButton, IonGrid, IonRow, IonCol, LoadingController, IonSpinner, IonText } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MesaService } from '../../../../services/mesa';
import { ToastService } from '../../../../services/toast';
import { ImagenesService } from '../../../../services/imagenes';
import QRCode from 'qrcode';
import { addIcons } from 'ionicons';
import { camera, images, save, closeCircle } from 'ionicons/icons';

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
    IonContent, IonItem, IonLabel, IonInput, 
    IonButton, IonIcon, IonSelect, IonSelectOption, IonHeader, IonToolbar,  IonButtons, IonBackButton,
    FormsModule, CommonModule
  ]
})
export class AgregarMesaComponent implements OnInit {
  numero: number | null = null;
  cantidadComensales: number | null = null;
  tipo: string = 'estandar';
  foto: FotoMesa | null = null;

  constructor(
    private router: Router,
    private mesaService: MesaService,
    private toastService: ToastService,
    private imagenesService: ImagenesService,
    private loadingController: LoadingController
  ) {
    addIcons({ camera, images, save, closeCircle });
  }

  ngOnInit() {}

  // --- LOADING PERSONALIZADO GOURMET ---
  async mostrarLoading() {
    const loading = await this.loadingController.create({
      cssClass: 'custom-loading-gourmet', 
      message: undefined, 
      spinner: null, 
      duration: 15000 // Un poco más largo por si la subida de fotos tarda
    });
    await loading.present();
    return loading;
  }

  validarFormulario(): { valido: boolean; mensaje: string } {
    if (this.numero === null || this.numero === undefined || this.numero <= 0) {
      return { valido: false, mensaje: 'Número de mesa inválido' };
    }
    if (!Number.isInteger(this.numero)) {
      return { valido: false, mensaje: 'El número debe ser entero' };
    }
    if (this.cantidadComensales === null || this.cantidadComensales <= 0 || this.cantidadComensales > 20) {
      return { valido: false, mensaje: 'Comensales inválidos (1-20)' };
    }
    if (!this.foto) {
      return { valido: false, mensaje: 'La foto de la mesa es obligatoria' };
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
      
      this.toastService.mostrarToastExito('Foto agregada');
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
      console.error('Error QR:', error);
      throw new Error('No se pudo generar el código QR');
    }
  }

  async guardarMesa() {
    const validacion = this.validarFormulario();
    if (!validacion.valido) {
      this.toastService.mostrarToastError(validacion.mensaje);
      return;
    }

    const loading = await this.mostrarLoading();

    try {
      // 1. Subir Foto Mesa
      const nombreArchivoFoto = `mesa-${this.numero}-${Date.now()}.jpg`;
      const resultadoFoto = await this.mesaService.subirImagenMesa(
        nombreArchivoFoto,
        this.foto!.blob!
      );

      if (!resultadoFoto.success || !resultadoFoto.url) throw new Error('Error al subir foto');

      // 2. Crear Registro BD
      const mesaData = {
        numero: this.numero!,
        cantidad_comensales: this.cantidadComensales!,
        foto_url: resultadoFoto.url,
        estado: 'libre',
        codigo_qr: null
      };

      const mesaCreada = await this.mesaService.agregarMesa(mesaData);
      if (!mesaCreada || !mesaCreada.id) throw new Error('Error al guardar en BD');

      // 3. Generar y Subir QR
      const qrBlob = await this.generarCodigoQR(mesaCreada.numero);
      const nombreArchivoQR = `qr-mesa-${mesaCreada.numero}-${Date.now()}.png`;
      const resultadoQR = await this.mesaService.subirCodigoQR(
        nombreArchivoQR,
        qrBlob
      );

      if (!resultadoQR.success || !resultadoQR.url) throw new Error('Error al subir QR');

      // 4. Actualizar Mesa con QR
      await this.mesaService.actualizarMesa(mesaCreada.id, {
        codigo_qr: resultadoQR.url
      });

      this.toastService.mostrarToastExito('¡Mesa agregada!');
      await loading.dismiss();
      this.router.navigate(['/home']);

    } catch (error) {
      await loading.dismiss();
      console.error('Error al guardar mesa:', error);
      
      let mensajeError = 'Error al guardar la mesa';
      if (error instanceof Error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          mensajeError = 'El número de mesa ya existe';
        }
      }
      this.toastService.mostrarToastError(mensajeError);
    }
  }
}