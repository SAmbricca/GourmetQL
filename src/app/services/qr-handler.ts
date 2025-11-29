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

// Tipo auxiliar para manejar la lógica dual
export type TipoClienteQR = 'registrado' | 'anonimo';

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
    // ... (Este método queda igual que tu original) ...
    const loading = await this.loadingController.create({
      message: 'Preparando escáner...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const moduloListo = await this.escaneoService.verificarEInstalarModuloGoogle();
      await loading.dismiss();

      if (!moduloListo) {
        return { exito: false, tipo: 'invalido', mensaje: 'No se pudo preparar el escáner' };
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
      return { exito: false, tipo: 'invalido', mensaje: 'Error al escanear el código QR' };
    }
  }

  private identificarTipoQR(contenido: string): ResultadoQR {
    if (contenido === 'QR_INGRESO_LOCAL') {
      return { exito: true, tipo: 'ingreso', mensaje: 'QR de ingreso detectado' };
    }
    const matchMesa = contenido.match(/^(?:MESA_|mesa-)(\d+)$/i);
    if (matchMesa) {
      const numeroMesa = parseInt(matchMesa[1], 10);
      return { exito: true, tipo: 'mesa', mensaje: 'Mesa verificada', datos: { numeroMesa } };
    }
    return { exito: false, tipo: 'invalido', mensaje: 'Mesa incorrecta. Escanee el QR de su mesa' };
  }

  // --- MÉTODO ACTUALIZADO: Acepta tipo de usuario ---
  async registrarEnListaEspera(userId: number, tipo: TipoClienteQR): Promise<boolean> {
    const loading = await this.loadingController.create({
      message: 'Registrando en lista de espera...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      // Preparamos el payload dinámicamente según el tipo
      const payload: any = {
        estado: 'esperando'
      };

      if (tipo === 'registrado') {
        payload.cliente_id = userId;
      } else {
        payload.cliente_anonimo_id = userId;
      }

      const { data, error } = await this.supabaseService.supabase
        .from('lista_espera')
        .insert(payload)
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

  // --- MÉTODO ACTUALIZADO: Lógica condicional para validación y pedidos ---
  async verificarYAccederMesa(userId: number, tipo: TipoClienteQR, numeroMesa: number): Promise<boolean> {
    const loading = await this.loadingController.create({
      message: 'Validando acceso a mesa...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      // 1. Obtener datos de la mesa
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

      // 2. Verificar asignación en lista_espera (Dinámico)
      // Nota: Asumo que tienes una columna 'mesa_asignada_id' aunque no estaba en tu schema inicial SQL, 
      // ya que tu código original TS la usaba.
      let queryAsignacion = this.supabaseService.supabase
        .from('lista_espera')
        .select('*')
        .eq('estado', 'atendido')
        .eq('mesa_asignada_id', mesa.id);

      if (tipo === 'registrado') {
        queryAsignacion = queryAsignacion.eq('cliente_id', userId);
      } else {
        queryAsignacion = queryAsignacion.eq('cliente_anonimo_id', userId);
      }

      const { data: asignacion } = await queryAsignacion.maybeSingle();

      // 3. Verificar si ya tiene pedido activo (Dinámico)
      // Traemos relaciones tanto de cliente_anonimo como de usuario para tener el nombre disponible
      let queryPedido = this.supabaseService.supabase
        .from('pedidos')
        .select(`
            *, 
            cliente_anonimo:clientes_anonimos(nombre),
            cliente:usuarios(nombre)
         `)
        .eq('mesa_id', mesa.id)
        .neq('estado', 'pagado')
        .order('fecha_creacion', { ascending: false })
        .limit(1);

      if (tipo === 'registrado') {
        queryPedido = queryPedido.eq('cliente_id', userId);
      } else {
        queryPedido = queryPedido.eq('cliente_anonimo_id', userId);
      }

      const { data: pedidoExistente } = await queryPedido.maybeSingle();

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
    // Obtenemos el nombre sea registrado o anónimo
    // Supabase devuelve el objeto anidado según la relación
    const nombreCliente = pedido.cliente?.nombre || pedido.cliente_anonimo?.nombre || 'Cliente';

    const navigationExtras: NavigationExtras = {
      queryParams: {
        mesaId: mesa.id,
        numeroMesa: mesa.numero,
        pedidoId: pedido.id,
        clienteNombre: nombreCliente,
        estado: pedido.estado 
      }
    };

    // La lógica de ruteo es idéntica
    switch (pedido.estado) {
      case 'pendiente':
        this.toastService.mostrarToastExito(`Su mesa: ${mesa.numero}`);
        this.router.navigate(['/mesa-opciones'], navigationExtras);
        return true;

      case 'confirmado':
      case 'preparacion':
        this.toastService.mostrarToastInfo('Tu pedido está en cocina. ¡Juga mientras esperas!');
        this.router.navigate(['/mesa-opciones'], {
            queryParams: { ...navigationExtras.queryParams, vista: 'espera' }
        });
        return true;

      case 'listo':
        this.toastService.mostrarToastExito('¡Tu pedido está listo para servir!');
        this.router.navigate(['/mesa-opciones'], {
            queryParams: { ...navigationExtras.queryParams, vista: 'listo' }
        });
        return true;

      case 'entregado':
        this.toastService.mostrarToastExito('Disfruta tu comida.');
        this.router.navigate(['/mesa-opciones'], {
            queryParams: { ...navigationExtras.queryParams, vista: 'comiendo' }
        });
        return true;

      default:
        this.router.navigate(['/mesa-opciones'], navigationExtras);
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