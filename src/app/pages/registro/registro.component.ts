import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonButton, IonContent, IonHeader, IonTitle, IonToolbar, IonAvatar, IonIcon, IonText, IonInput, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { EscaneoQRService, ResultadoEscaneo } from '../../services/escaneo-qr';
import { ToastService } from '../../services/toast';
import { SupabaseService } from '../../services/supabase';
import { UsuariosService } from 'src/app/services/usuarios';

@Component({
  selector: 'app-registro',
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonButton,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonAvatar,
    IonIcon,
    IonText,
    IonInput,
    IonSelect,
    IonSelectOption
  ]
})
export class RegistroComponent implements OnInit {
  registroForm!: FormGroup;
  fotoUrl: string = '';
  fotoError: string = '';
  
  perfilesDisponibles: string[] = ['dueño', 'supervisor', 'cocinero', 'bartender', 'mozo', 'maitre'];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private escaneoQRService: EscaneoQRService,
    private toastService: ToastService,
    private supabaseService: SupabaseService,
    private usuariosService: UsuariosService
  ) {}

  ngOnInit() {
    this.inicializarFormulario();
  }

  private inicializarFormulario(): void {
    this.registroForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      apellido: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      dni: ['', [Validators.required, Validators.pattern(/^\d{7,8}$/)]],
      cuil: ['', [Validators.pattern(/^\d{2}-\d{8}-\d$/)]],
      contrasenia: ['', [Validators.required, Validators.minLength(6)]],
      confirmarContrasenia: ['', [Validators.required]],
      perfil: ['', [Validators.required]]
    }, { 
      validators: this.validarContraseniasCoinciden 
    });
  }

  private validarContraseniasCoinciden(group: FormGroup): { [key: string]: boolean } | null {
    const contrasenia = group.get('contrasenia')?.value;
    const confirmarContrasenia = group.get('confirmarContrasenia')?.value;
    
    if (contrasenia !== confirmarContrasenia) {
      group.get('confirmarContrasenia')?.setErrors({ contraseniasNoCoinciden: true });
      return { contraseniasNoCoinciden: true };
    }
    
    return null;
  }

  async escanearCodigoBarras(): Promise<void> {
    try {
      const resultado: ResultadoEscaneo = await this.escaneoQRService.escanearCodigoBarras();
      
      if (resultado.exito && resultado.datos) {
        if (resultado.datos.nombre) {
          this.registroForm.patchValue({ nombre: resultado.datos.nombre });
        }
        if (resultado.datos.apellido) {
          this.registroForm.patchValue({ apellido: resultado.datos.apellido });
        }
        if (resultado.datos.dni) {
          this.registroForm.patchValue({ dni: resultado.datos.dni });
        }
        
        this.toastService.mostrarToastExito('Datos cargados desde el DNI');
      } else {
        this.toastService.mostrarToastError(resultado.mensaje || 'No se pudo escanear el código');
      }
    } catch (error) {
      console.error('Error al escanear código de barras:', error);
      this.toastService.mostrarToastError('Error al escanear el DNI');
    }
  }

  async tomarFoto(): Promise<void> {
    try {
      this.fotoError = '';
      
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      if (image.dataUrl) {
        this.fotoUrl = image.dataUrl;
      }
    } catch (error) {
      console.error('Error al capturar foto:', error);
      this.fotoError = 'Error al capturar la foto';
      this.toastService.mostrarToastError('Error al capturar la foto');
    }
  }

  async registrarUsuario(): Promise<void> {
    if (this.registroForm.invalid) {
      this.registroForm.markAllAsTouched();
      this.toastService.mostrarToastError('Por favor complete todos los campos correctamente');
      return;
    }

    if (!this.fotoUrl) {
      this.fotoError = 'La foto de perfil es obligatoria';
      this.toastService.mostrarToastError('Por favor agregue una foto de perfil');
      return;
    }

    try {
      const formData = this.registroForm.value;
      let fotoUrlSubida = '';
      if (this.fotoUrl) {
        const base64Data = this.fotoUrl.split(',')[1];
        const fileName = `perfil_${formData.dni}_${Date.now()}.jpg`;
        const blob = this.base64ToBlob(base64Data);
        
        const { data: uploadData, error: uploadError } = await this.supabaseService.supabase.storage
          .from('fotos-perfil')
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw new Error('Error al subir la foto: ' + uploadError.message);
        }

        const { data: urlData } = this.supabaseService.supabase.storage
          .from('fotos-perfil')
          .getPublicUrl(fileName);

        fotoUrlSubida = urlData.publicUrl;
      }

      const nuevoUsuario = {
        email: formData.email,
        contrasenia: formData.contrasenia,
        nombre: formData.nombre,
        apellido: formData.apellido,
        dni: formData.dni,
        cuil: formData.cuil || '',
        perfil: formData.perfil,
        foto_url: fotoUrlSubida,
        estado: 'habilitado' as const
      };

      const resultado = await this.usuariosService.crearUsuario(nuevoUsuario);

      if (resultado.success) {
        this.toastService.mostrarToastExito('Usuario registrado exitosamente');
        this.router.navigate(['/login']);
      } else {
        throw new Error(resultado.message);
      }

    } catch (error: any) {
      console.error('Error al registrar usuario:', error);
      let mensajeError = 'Error al registrar usuario';
      
      if (error.message) {
        if (error.message.includes('duplicate') || error.message.includes('duplicado')) {
          if (error.message.includes('email') || error.message.includes('correo')) {
            mensajeError = 'El correo electrónico ya está registrado';
          } else if (error.message.includes('dni')) {
            mensajeError = 'El DNI ya está registrado';
          }
        } else {
          mensajeError = error.message;
        }
      }
      
      this.toastService.mostrarToastError(mensajeError);
    }
  }

  private base64ToBlob(base64: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'image/jpeg' });
  }

  get nombreError(): string {
    const control = this.registroForm.get('nombre');
    if (control?.hasError('required') && control?.touched) {
      return 'El nombre es requerido';
    }
    if (control?.hasError('minlength')) {
      return 'El nombre debe tener al menos 2 caracteres';
    }
    return '';
  }

  get apellidoError(): string {
    const control = this.registroForm.get('apellido');
    if (control?.hasError('required') && control?.touched) {
      return 'El apellido es requerido';
    }
    if (control?.hasError('minlength')) {
      return 'El apellido debe tener al menos 2 caracteres';
    }
    return '';
  }

  get emailError(): string {
    const control = this.registroForm.get('email');
    if (control?.hasError('required') && control?.touched) {
      return 'El correo electrónico es requerido';
    }
    if (control?.hasError('email')) {
      return 'Ingrese un correo electrónico válido';
    }
    return '';
  }

  get dniError(): string {
    const control = this.registroForm.get('dni');
    if (control?.hasError('required') && control?.touched) {
      return 'El DNI es requerido';
    }
    if (control?.hasError('pattern')) {
      return 'El DNI debe tener 7 u 8 dígitos';
    }
    return '';
  }

  get cuilError(): string {
    const control = this.registroForm.get('cuil');
    if (control?.hasError('pattern')) {
      return 'El CUIL debe tener el formato XX-XXXXXXXX-X';
    }
    return '';
  }

  get contraseniaError(): string {
    const control = this.registroForm.get('contrasenia');
    if (control?.hasError('required') && control?.touched) {
      return 'La contraseña es requerida';
    }
    if (control?.hasError('minlength')) {
      return 'La contraseña debe tener al menos 6 caracteres';
    }
    return '';
  }

  get confirmarContraseniaError(): string {
    const control = this.registroForm.get('confirmarContrasenia');
    if (control?.hasError('required') && control?.touched) {
      return 'Debe confirmar la contraseña';
    }
    if (control?.hasError('contraseniasNoCoinciden')) {
      return 'Las contraseñas no coinciden';
    }
    return '';
  }

  get contraseniasCoinciden(): boolean {
    const contrasenia = this.registroForm.get('contrasenia')?.value;
    const confirmarContrasenia = this.registroForm.get('confirmarContrasenia')?.value;
    return contrasenia === confirmarContrasenia && contrasenia !== '';
  }

  get client() {
    return this.supabaseService['supabase'];
  }
}