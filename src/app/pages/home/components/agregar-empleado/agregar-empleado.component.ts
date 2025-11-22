import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonButton, IonContent, IonHeader, IonTitle, IonToolbar, IonAvatar, IonIcon, IonText, IonInput, IonSelect, IonSelectOption, IonButtons, IonBackButton } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { EscaneoQRService, ResultadoEscaneo } from '../../../../services/escaneo-qr';
import { ToastService } from '../../../../services/toast';
import { SupabaseService } from '../../../../services/supabase';
import { UsuariosService } from 'src/app/services/usuarios';
import { ImagenesService } from '../../../../services/imagenes';
// 1. Importamos el servicio de notificaciones
import { NotificacionesService } from '../../../../services/notificaciones';

interface FotoEmpleado {
  url: string;
  blob?: Blob;
}

@Component({
  selector: 'app-agregar-empleado',
  templateUrl: './agregar-empleado.component.html',
  styleUrls: ['./agregar-empleado.component.scss'],
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, IonButton, IonContent, IonHeader, IonTitle, IonToolbar, IonAvatar, IonIcon, IonText, IonInput, IonSelect, IonSelectOption, IonButtons, IonBackButton
  ]
})
export class AgregarEmpleadoComponent implements OnInit {
  empleadoForm!: FormGroup;
  foto: FotoEmpleado | null = null;
  fotoError: string = '';
  cargando: boolean = false;
  
  perfilesDisponibles: string[] = ['cocinero', 'bartender', 'mozo', 'maitre'];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private escaneoQRService: EscaneoQRService,
    private toastService: ToastService,
    private supabaseService: SupabaseService,
    private usuariosService: UsuariosService,
    private imagenesService: ImagenesService,
    // 2. Inyectamos el servicio en el constructor
    private notificacionesService: NotificacionesService
  ) {}

  ngOnInit() {
    this.inicializarFormulario();
  }

  private inicializarFormulario(): void {
    this.empleadoForm = this.fb.group({
      nombre: ['', Validators.required],
      apellido: ['', Validators.required],
      email: ['', [
        Validators.required, 
        Validators.email,
        Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
      ]],
      dni: ['', [
        Validators.required, 
        Validators.pattern(/^\d{7,8}$/),
        Validators.min(1000000),
        Validators.max(99999999)
      ]],
      cuil: ['', [
        Validators.required,
        Validators.pattern(/^\d{2}-\d{8}-\d{1}$/)
      ]],
      contrasenia: ['', Validators.required],
      perfil: ['', Validators.required]
    });

    this.empleadoForm.get('dni')?.valueChanges.subscribe(dni => {
      if (dni && dni.length >= 7) {
        this.calcularCUIL(dni);
      }
    });
  }

  private calcularCUIL(dni: string): void {
    if (!/^\d{7,8}$/.test(dni)) {
      return;
    }
    const dniPadded = dni.padStart(8, '0');
    const prefijo = '20';
    
    const digitoVerificador = this.calcularDigitoVerificadorCUIL(prefijo + dniPadded);
    const cuilSugerido = `${prefijo}-${dniPadded}-${digitoVerificador}`;
    
    if (!this.empleadoForm.get('cuil')?.value) {
      this.empleadoForm.patchValue({ cuil: cuilSugerido }, { emitEvent: false });
    }
  }

  private calcularDigitoVerificadorCUIL(cuilSinDigito: string): number {
    const multiplicadores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;

    for (let i = 0; i < 10; i++) {
      suma += parseInt(cuilSinDigito[i]) * multiplicadores[i];
    }

    const resto = suma % 11;
    const digitoVerificador = 11 - resto;

    if (digitoVerificador === 11) return 0;
    if (digitoVerificador === 10) return 9;
    return digitoVerificador;
  }

  async escanearDNI(): Promise<void> {
    try {
      this.cargando = true;
      const resultado: ResultadoEscaneo = await this.escaneoQRService.escanearCodigoBarras();
      
      if (resultado.exito && resultado.datos) {
        const datosActualizados: any = {};
        
        if (resultado.datos.nombre) {
          datosActualizados.nombre = resultado.datos.nombre.trim().toUpperCase();
        }
        if (resultado.datos.apellido) {
          datosActualizados.apellido = resultado.datos.apellido.trim().toUpperCase();
        }
        if (resultado.datos.dni) {
          datosActualizados.dni = resultado.datos.dni.replace(/\D/g, '');
        }
        
        this.empleadoForm.patchValue(datosActualizados);
        this.toastService.mostrarToastExito('Datos cargados desde el DNI correctamente');
      } else {
        this.toastService.mostrarToastError(resultado.mensaje || 'No se pudo leer el código QR del DNI');
      }
    } catch (error) {
      console.error('Error al escanear DNI:', error);
      this.toastService.mostrarToastError('Error al escanear el código QR del DNI');
    } finally {
      this.cargando = false;
    }
  }

  async tomarFoto(source: 'camera' | 'gallery' = 'camera'): Promise<void> {
    try {
      this.fotoError = '';
      
      const imageResult = await this.imagenesService.capturarFoto(source, {
        maxWidth: 500,
        maxHeight: 500,
        quality: 0.8
      });

      this.foto = {
        url: imageResult.url,
        blob: imageResult.blob
      };
      
      this.toastService.mostrarToastExito('Foto tomada');
    } catch (error: any) {
      console.error('Error al capturar foto:', error);
      if (error.message !== 'User cancelled photos app') {
        this.fotoError = 'Error al capturar la foto';
        this.toastService.mostrarToastError('Error al capturar la foto');
      }
    }
  }

  eliminarFoto(): void {
    this.foto = null;
    this.fotoError = '';
    this.toastService.mostrarToastExito('Foto eliminada');
  }

  async agregarEmpleado(): Promise<void> {
    if (this.empleadoForm.invalid) {
      this.empleadoForm.markAllAsTouched();
      this.toastService.mostrarToastError('Por favor complete todos los campos');
      return;
    }

    if (!this.foto || !this.foto.blob) {
      this.fotoError = 'La foto de perfil es obligatoria';
      this.toastService.mostrarToastError('Por favor tome una foto del empleado');
      return;
    }

    this.cargando = true;

    try {
      const formData = this.empleadoForm.value;

      const fileName = `empleado_${formData.dni}_${Date.now()}.jpg`;
      
      const resultadoSubida = await this.supabaseService.subirImagen(
        'fotos-perfil',
        fileName,
        this.foto.blob
      );

      if (!resultadoSubida.success || !resultadoSubida.url) {
        throw new Error(resultadoSubida.message || 'Error al subir la foto');
      }

      const nuevoEmpleado = {
        email: formData.email.toLowerCase().trim(),
        contrasenia: formData.contrasenia,
        nombre: formData.nombre.trim(),
        apellido: formData.apellido.trim(),
        dni: formData.dni,
        cuil: formData.cuil,
        perfil: formData.perfil,
        foto_url: resultadoSubida.url,
        estado: 'pendiente' as const
      };

      const resultado = await this.usuariosService.crearUsuario(nuevoEmpleado);

      if (resultado.success) {
        // -----------------------------------------------------------------------
        // 3. Lógica de Notificaciones a Dueños y Supervisores
        // -----------------------------------------------------------------------
        
        // A. Buscamos a todos los usuarios con perfil 'dueño' o 'supervisor'
        const { data: administradores } = await this.supabaseService.supabase
          .from('usuarios')
          .select('id, perfil')
          .in('perfil', ['dueño', 'supervisor']);

        // B. Enviamos notificación a cada uno
        if (administradores && administradores.length > 0) {
            for (const admin of administradores) {
                await this.notificacionesService.enviarNotificacion({
                    // Nota: Usamos 'as any' temporalmente porque 'nuevo_empleado' 
                    // no está explícito en tu interfaz actual, pero la BD lo acepta.
                    tipo: 'mesa_asignada' as any, // Reutilizo uno existente o idealmente agrega 'nuevo_empleado' a tu interface
                    titulo: 'Nuevo Empleado Pendiente',
                    mensaje: `${formData.nombre} ${formData.apellido} se ha registrado como ${formData.perfil}.`,
                    destinatario_id: admin.id,
                    destinatario_perfil: admin.perfil,
                    datos: { 
                        dni: formData.dni,
                        nombre: formData.nombre 
                    }
                });
            }
        }
        // -----------------------------------------------------------------------

        this.toastService.mostrarToastExito('Empleado agregado');
        this.empleadoForm.reset();
        this.foto = null;
        this.router.navigate(['/home']);
      } else {
        throw new Error(resultado.message);
      }

    } catch (error: any) {
      console.error('Error al agregar empleado:', error);
      let mensajeError = 'Error al agregar el empleado';
      
      if (error.message) {
        mensajeError = error.message;
      }
      
      this.toastService.mostrarToastError(mensajeError);
    } finally {
      this.cargando = false;
    }
  }

  get nombreError(): string {
    const control = this.empleadoForm.get('nombre');
    if (!control?.touched) return '';
    
    if (control?.hasError('required')) return 'El nombre es obligatorio';
    return '';
  }

  get apellidoError(): string {
    const control = this.empleadoForm.get('apellido');
    if (!control?.touched) return '';
    
    if (control?.hasError('required')) return 'El apellido es obligatorio';
    return '';
  }

  get emailError(): string {
    const control = this.empleadoForm.get('email');
    if (!control?.touched) return '';
    
    if (control?.hasError('required')) return 'El correo electrónico es obligatorio';
    if (control?.hasError('email') || control?.hasError('pattern')) {
      return 'Ingrese un correo electrónico válido';
    }
    return '';
  }

  get dniError(): string {
    const control = this.empleadoForm.get('dni');
    if (!control?.touched) return '';
    
    if (control?.hasError('required')) return 'El DNI es obligatorio';
    if (control?.hasError('pattern')) return 'El DNI debe tener 8 dígitos numéricos';
    if (control?.hasError('min') || control?.hasError('max')) {
      return 'Ingrese un número de DNI válido';
    }
    return '';
  }

  get cuilError(): string {
    const control = this.empleadoForm.get('cuil');
    if (!control?.touched) return '';
    
    if (control?.hasError('required')) return 'El CUIL es obligatorio';
    if (control?.hasError('pattern')) return 'El CUIL debe tener el formato XX-XXXXXXXX-X';
    return '';
  }

  navegarAHome(): void {
    this.router.navigate(['/home']);
  }
}