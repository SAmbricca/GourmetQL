import { Injectable } from '@angular/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { LoadingController, AlertController } from '@ionic/angular/standalone';
import { ToastService } from './toast';

export interface DatosEscaneados {
  nombre?: string;
  apellido?: string;
  dni?: string;
  contenidoCompleto: string;
}

export interface ResultadoEscaneo {
  exito: boolean;
  datos?: DatosEscaneados;
  mensaje?: string;
}

@Injectable({
  providedIn: 'root'
})
export class EscaneoQRService {
  public instalandoModulo = false;

  constructor(
    public loadingController: LoadingController,
    public alertController: AlertController,
    public toastService: ToastService
  ) { }

  async escanearCodigoQR(): Promise<ResultadoEscaneo> {
    try {

      const moduloInstalado = await this.verificarEInstalarModuloGoogle();
      if (!moduloInstalado) {
        return {
          exito: false,
          mensaje: 'No se pudo preparar el escáner de código QR'
        };
      }

      console.log('Escaneando código QR...');
      
      const result = await BarcodeScanner.scan({
        formats: [
          BarcodeFormat.QrCode,    // Formato QR
          BarcodeFormat.DataMatrix, // Formato alternativo
          BarcodeFormat.Aztec      // Formato alternativo
        ]
      });

      if (result.barcodes && result.barcodes.length > 0) {
        const qrContent = result.barcodes[0].rawValue;
        const datosEscaneados = this.procesarDatosCodigoQR(qrContent);
        
        return {
          exito: true,
          datos: datosEscaneados,
          mensaje: 'Código QR escaneado exitosamente'
        };
      } else {
        return {
          exito: false,
          mensaje: 'No se detectó ningún código QR válido'
        };
      }

    } catch (error: any) {
      console.error('Error completo al escanear código QR:', error);
      return {
        exito: false,
        mensaje: await this.obtenerMensajeErrorEscaneo(error)
      };
    }
  }

  async escanearCodigoBarras(): Promise<ResultadoEscaneo> {
    try {
      const moduloInstalado = await this.verificarEInstalarModuloGoogle();
      if (!moduloInstalado) {
        return {
          exito: false,
          mensaje: 'No se pudo preparar el escáner de código de barras'
        };
      }

      console.log('Escaneando código de barras...');
      
      const result = await BarcodeScanner.scan({
        formats: [
          BarcodeFormat.Pdf417,    // Formato principal del DNI argentino
          BarcodeFormat.Code128,   // Formato alternativo
          BarcodeFormat.Code39,    // Formato alternativo
          BarcodeFormat.Ean13,     // Por compatibilidad
          BarcodeFormat.Ean8       // Por compatibilidad
        ]
      });

      if (result.barcodes && result.barcodes.length > 0) {
        const barcodeContent = result.barcodes[0].rawValue;
        const datosEscaneados = this.procesarDatosCodigoBarras(barcodeContent);
        
        return {
          exito: true,
          datos: datosEscaneados,
          mensaje: 'Código de barras escaneado exitosamente'
        };
      } else {
        return {
          exito: false,
          mensaje: 'No se detectó ningún código de barras válido'
        };
      }

    } catch (error: any) {
      console.error('Error completo al escanear código de barras:', error);
      return {
        exito: false,
        mensaje: await this.obtenerMensajeErrorEscaneo(error)
      };
    }
  }

  async verificarDisponibilidadEscaner(): Promise<boolean> {
    try {
      const isAvailable = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      return isAvailable.available;
    } catch (error) {
      console.error('Error al verificar disponibilidad del escáner:', error);
      return false;
    }
  }

  public async verificarEInstalarModuloGoogle(): Promise<boolean> {
    try {
      const isAvailable = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      
      if (!isAvailable.available) {
        const loading = await this.loadingController.create({
          message: 'Preparando escáner de código...',
          spinner: 'crescent'
        });
        await loading.present();
        
        this.instalandoModulo = true;
        
        try {
          await BarcodeScanner.installGoogleBarcodeScannerModule();
          console.log('Módulo instalado correctamente');
          
          const verificacion = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
          
          await loading.dismiss();
          this.instalandoModulo = false;
          
          if (verificacion.available) {
            this.toastService.mostrarToastExito('Escáner de código listo para usar');
            return true;
          } else {
            throw new Error('El módulo no se pudo verificar después de la instalación');
          }
          
        } catch (installError) {
          await loading.dismiss();
          this.instalandoModulo = false;
          throw installError;
        }
      }
      
      return true;
      
    } catch (error: any) {
      console.error('Error con módulo Google:', error);
      
      let mensaje = 'Error al preparar el escáner de código';
      
      if (error.message?.includes('network')) {
        mensaje = 'Error de conexión. Verifique su conexión a internet e intente nuevamente';
      } else if (error.message?.includes('Google Play')) {
        mensaje = 'Error con Google Play Services. Actualice Google Play Services e intente nuevamente';
      } else if (error.message?.includes('storage') || error.message?.includes('space')) {
        mensaje = 'Espacio insuficiente. Libere espacio en su dispositivo e intente nuevamente';
      }
      
      this.toastService.mostrarToastError(mensaje);
      return false;
    }
  }

  public procesarDatosCodigoQR(contenido: string): DatosEscaneados {
    const resultado: DatosEscaneados = {
      contenidoCompleto: contenido
    };

    // Para códigos QR, simplemente devolvemos el contenido completo
    // El procesamiento específico se hará en el componente que use este servicio
    return resultado;
  }

  public procesarDatosCodigoBarras(contenido: string): DatosEscaneados {
    const resultado: DatosEscaneados = {
      contenidoCompleto: contenido
    };

    try {
      if (contenido.includes('@')) {
        const datos = contenido.split('@');
        
        if (datos.length >= 3) {
          const apellido = datos[1]?.trim();
          const nombre = datos[2]?.trim();
          const dni = datos[4]?.trim();
          
          if (!apellido || !nombre || !dni) {
            const apellidoAlt = datos[0]?.trim();
            const nombreAlt = datos[1]?.trim();
            const dniAlt = datos[2]?.trim();
            
            if (apellidoAlt && nombreAlt && dniAlt && /^\d{7,8}$/.test(dniAlt)) {
              resultado.apellido = apellidoAlt;
              resultado.nombre = nombreAlt;
              resultado.dni = dniAlt;
              return resultado;
            }
          } else if (/^\d{7,8}$/.test(dni)) {
            resultado.apellido = apellido;
            resultado.nombre = nombre;
            resultado.dni = dni;
            return resultado;
          }
        }
      }

      const dniMatch = contenido.match(/\b\d{7,8}\b/);
      if (dniMatch) {
        resultado.dni = dniMatch[0];
        return resultado;
      }

      return resultado;
      
    } catch (error) {
      console.error('Error al procesar código de barras:', error);
      return resultado;
    }
  }

  public async obtenerMensajeErrorEscaneo(error: any): Promise<string> {
    let mensaje = 'Error al escanear código';
    
    if (error.message?.includes('Google Barcode Scanner Module')) {
      mensaje = 'Error con el módulo de escaneo. Intente reiniciar la aplicación';
    } else if (error.message?.includes('permission')) {
      mensaje = 'Permisos de cámara requeridos. Verifique los permisos en configuración';
    } else if (error.message?.includes('camera')) {
      mensaje = 'Error con la cámara. Cierre otras aplicaciones que puedan estar usándola';
    } else if (error.message?.includes('cancelled') || error.message?.includes('canceled')) {
      mensaje = 'Escaneo cancelado por el usuario';
    }
    
    return mensaje;
  }

  get estaInstalandoModulo(): boolean {
    return this.instalandoModulo;
  }
}