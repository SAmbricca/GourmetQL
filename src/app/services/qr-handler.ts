import { Injectable } from '@angular/core';
import { Router, NavigationExtras } from '@angular/router';
import { EscaneoQRService } from './escaneo-qr';
import { SupabaseService } from './supabase';
import { ToastService } from './toast';
import { LoadingController } from '@ionic/angular/standalone';

export interface ResultadoQR {
  exito: boolean;
  tipo: 'ingreso' | 'mesa' | 'invalido';
  mensaje: string;
  datos?: {
    mesaId?: number;
    numeroMesa?: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class QrHandlerService {
  
  constructor(
    private escaneoService: EscaneoQRService,
    private supabaseService: SupabaseService,
    private toastService: ToastService,
    private loadingController: LoadingController,
    private router: Router
  ) {}

  async escanearYProcesarQR(): Promise<ResultadoQR> {
    const loading = await this.loadingController.create({
      message: 'Preparando escáner...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const moduloListo = await this.escaneoService.verificarEInstalarModuloGoogle();
      await loading.dismiss();

      if (!moduloListo) {
        return {
          exito: false,
          tipo: 'invalido',
          mensaje: 'No se pudo preparar el escáner'
        };
      }

      const resultado = await this.escaneoService.escanearCodigoQR();

      if (resultado.exito && resultado.datos) {
        return this.identificarTipoQR(resultado.datos.contenidoCompleto);
      } else {
        return {
          exito: false,
          tipo: 'invalido',
          mensaje: resultado.mensaje || 'No se pudo escanear el código QR'
        };
      }
    } catch (error) {
      await loading.dismiss();
      console.error('Error al escanear:', error);
      return {
        exito: false,
        tipo: 'invalido',
        mensaje: 'Error al escanear el código QR'
      };
    }
  }

  private identificarTipoQR(contenido: string): ResultadoQR {
    if (contenido === 'QR_INGRESO_LOCAL') {
      return {
        exito: true,
        tipo: 'ingreso',
        mensaje: 'QR de ingreso detectado'
      };
    }

    const matchMesa = contenido.match(/^(?:MESA_|mesa-)(\d+)$/i);
    if (matchMesa) {
      const numeroMesa = parseInt(matchMesa[1], 10);
      return {
        exito: true,
        tipo: 'mesa',
        mensaje: 'Mesa verificada', 
        datos: {
          numeroMesa
        }
      };
    }

    return {
      exito: false,
      tipo: 'invalido',
      mensaje: 'Mesa incorrecta. Escanee el QR de su mesa'
    };
  }

  async registrarEnListaEspera(clienteAnonimoId: number): Promise<boolean> {
    const loading = await this.loadingController.create({
      message: 'Registrando en lista de espera...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const { data, error } = await this.supabaseService.supabase
        .from('lista_espera')
        .insert({
          cliente_anonimo_id: clienteAnonimoId,
          estado: 'esperando'
        })
        .select()
        .single();

      await loading.dismiss();

      if (error) {
        console.error('Error al registrar en lista de espera:', error);
        this.toastService.mostrarToastError('Error al registrarse en la lista de espera');
        return false;
      }

      this.toastService.mostrarToastExito('¡Registrado en lista de espera! Espere a ser atendido');
      return true;

    } catch (error) {
      await loading.dismiss();
      console.error('Error:', error);
      this.toastService.mostrarToastError('Error al procesar el registro');
      return false;
    }
  }

  async verificarYAccederMesa(clienteAnonimoId: number, numeroMesa: number): Promise<boolean> {
    const loading = await this.loadingController.create({
      message: 'Validando acceso a mesa...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const { data: mesa, error: errorMesa } = await this.supabaseService.supabase
        .from('mesas')
        .select('id, numero, estado')
        .eq('numero', numeroMesa)
        .single();

      if (errorMesa || !mesa) {
        await loading.dismiss();
        this.toastService.mostrarToastError('Mesa no encontrada en el sistema');
        return false;
      }

      const { data: asignacion } = await this.supabaseService.supabase
        .from('lista_espera')
        .select('*')
        .eq('cliente_anonimo_id', clienteAnonimoId)
        .eq('estado', 'atendido')
        .eq('mesa_asignada_id', mesa.id)
        .maybeSingle();

      const { data: pedidoExistente } = await this.supabaseService.supabase
        .from('pedidos')
        .select('*, cliente_anonimo:clientes_anonimos(nombre)')
        .eq('mesa_id', mesa.id)
        .eq('cliente_anonimo_id', clienteAnonimoId)
        .neq('estado', 'pagado')
        .order('fecha_creacion', { ascending: false })
        .limit(1)
        .maybeSingle();

      await loading.dismiss();

      if (pedidoExistente) {
        return await this.navegarSegunEstadoPedido(pedidoExistente, mesa);
      } else {
        if (!asignacion) {
             this.toastService.mostrarToastError('Esta mesa no te fue asignada por el Maître.');
             return false;
        }

        this.toastService.mostrarToastExito(`Tu mesa: ${numeroMesa}`);
        this.router.navigate(['/menu'], { 
            queryParams: { mesaId: mesa.id, numeroMesa: mesa.numero }
        });
        return true;
      }

    } catch (error) {
      await loading.dismiss();
      console.error('Error acceso mesa:', error);
      this.toastService.mostrarToastError('Error de conexión al verificar mesa');
      return false;
    }
  }

  private async navegarSegunEstadoPedido(pedido: any, mesa: any): Promise<boolean> {
    const navigationExtras: NavigationExtras = {
      queryParams: {
        mesaId: mesa.id,
        numeroMesa: mesa.numero,
        pedidoId: pedido.id,
        clienteNombre: pedido.cliente_anonimo?.nombre,
        // --- AGREGADO AQUÍ ---
        estado: pedido.estado 
      }
    };

    switch (pedido.estado) {
      case 'pendiente':
        // FASE 1: PEDIR COMIDA
        this.toastService.mostrarToastExito(`Hola ${pedido.cliente_anonimo?.nombre || ''}, puedes realizar tu pedido.`);
        this.router.navigate(['/mesa-opciones'], navigationExtras);
        return true;

      case 'confirmado':
      case 'preparacion':
        // FASE 2: ESPERAR Y JUGAR
        this.toastService.mostrarToastInfo('Tu pedido está en cocina. ¡Juga mientras esperas!');
        this.router.navigate(['/mesa-opciones'], {
            queryParams: { ...navigationExtras.queryParams, vista: 'espera' }
        });
        return true;

      case 'listo':
        // FASE 3: MOZO EN CAMINO
        this.toastService.mostrarToastExito('¡Tu pedido está listo para servir!');
        this.router.navigate(['/mesa-opciones'], {
            queryParams: { ...navigationExtras.queryParams, vista: 'listo' }
        });
        return true;

      case 'entregado':
        // FASE 4: COMER, ENCUESTA, CUENTA
        this.toastService.mostrarToastExito('Disfruta tu comida.');
        this.router.navigate(['/mesa-opciones'], {
            queryParams: { ...navigationExtras.queryParams, vista: 'comiendo' }
        });
        return true;

      default:
        this.router.navigate(['/menu-cliente'], navigationExtras);
        return true;
    }
  }

  async verificarMesaLibre(numeroMesa: number): Promise<boolean> {
    try {
      const { data: mesa, error } = await this.supabaseService.supabase
        .from('mesas')
        .select('estado')
        .eq('numero', numeroMesa)
        .single();

      if (error) {
        console.error('Error al verificar estado de mesa:', error);
        return false;
      }

      return mesa.estado === 'libre';
    } catch (error) {
      console.error('Error:', error);
      return false;
    }
  }
}