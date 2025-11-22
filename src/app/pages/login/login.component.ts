import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService, Usuario } from '../../services/supabase';
import { ClienteAnonimoService } from 'src/app/services/cliente-anonimo';
import { IonContent, IonCardContent, IonInput, IonButton, IonItem, IonIcon, IonCard, IonLabel, IonCardHeader, IonCardTitle, IonModal} from '@ionic/angular/standalone';
import { ToastService } from '../../services/toast';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { logIn, flash, personAdd, camera, close } from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [IonModal, IonIcon, IonContent, IonInput, IonButton, IonCard, IonCardContent, IonItem, IonLabel, IonCardHeader, IonCardTitle, FormsModule]
})
export class LoginComponent implements OnInit {
  email: string = '';
  contrasenia: string = '';
  mostrarContrasenia: boolean = false;

  mostrarModalAnonimo: boolean = false;
  nombreAnonimo: string = '';
  fotoAnonimo: string | null = null;
  procesandoRegistro: boolean = false;

  usuariosRapidos = [
    { email: 'dueno@gmail.com', contrasenia: '123456', nombre: 'Sofia', perfil: 'dueño' },
    { email: 'supervisor@gmail.com', contrasenia: '123456', nombre: 'Santiago', perfil: 'supervisor' },
    { email: 'mozo@gmail.com', contrasenia: '123456', nombre: 'Lionel', perfil: 'mozo' },
    { email: 'cocinero22@gmail.com', contrasenia: '123456', nombre: 'Matias', perfil: 'cocinero' },
    { email: 'bartender@gmail.com', contrasenia: '123456', nombre: 'Julian', perfil: 'bartender' },
    { email: 'maitre@gmail.com', contrasenia: '123456', nombre: 'Ema', perfil: 'maitre' },
  ];

  constructor(
    private router: Router,
    private supabaseService: SupabaseService,
    private clienteAnonimo: ClienteAnonimoService,
    private toastService: ToastService,
  ) {
    addIcons({ logIn, flash, personAdd, camera, close });
  }

  ngOnInit() {
  }

  async iniciarSesion() {
    if (!this.email || !this.contrasenia) {
      this.toastService.mostrarToastError('Por favor, complete todos los campos');
      return;
    }

    this.toastService.mostrarToastInfo(`Ingresando...`);

    try {
      const resultado = await this.supabaseService.iniciarSesion(this.email, this.contrasenia);

      if (resultado.success && resultado.usuario) {
        this.toastService.mostrarToastExito(`¡Bienvenido/a ${resultado.usuario.nombre}!`);

        const rutas: Record<string, string> = {
          'dueño': '/home',
          'supervisor': '/home',
          'mozo': '/home',
          'cocinero': '/home',
          'bartender': '/home',
          'cliente': '/home-anonimo'
        };
        
        const ruta = rutas[resultado.usuario.perfil] || '/home';
        await this.router.navigate([ruta]);

      } else {
        this.toastService.mostrarToastError(resultado.message);
      }
    } catch (error) {
      this.toastService.mostrarToastError('Error inesperado. Intente nuevamente.');
    }
  }

  async loginRapido(usuario: any) {
    this.toastService.mostrarToastInfo(`Ingresando como ${usuario.perfil}...`);
    
    try {
      const resultado = await Promise.race([
        this.supabaseService.iniciarSesion(usuario.email, usuario.contrasenia),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 8000)
        )
      ]) as any;

      if (resultado.success && resultado.usuario) {
        this.toastService.mostrarToastExito(`¡Bienvenido/a ${usuario.nombre}!`);
        
        const rutas: Record<string, string> = {
          'dueño': '/home',
          'supervisor': '/home',
          'mozo': '/home',
          'cocinero': '/home',
          'bartender': '/home',
          'cliente': '/home-anonimo'
        };
        
        const ruta = rutas[resultado.usuario.perfil] || '/home';
        await this.router.navigate([ruta]);
      } else {
        this.toastService.mostrarToastError(resultado?.message || 'Error desconocido');
      }
      
    } catch (error: any) {
      this.toastService.mostrarToastError('Error al ingresar');
    }
  }

  abrirModalAnonimo() {
    this.mostrarModalAnonimo = true;
    this.nombreAnonimo = '';
    this.fotoAnonimo = null;
  }

  cerrarModalAnonimo() {
    this.mostrarModalAnonimo = false;
    this.nombreAnonimo = '';
    this.fotoAnonimo = null;
  }

  async tomarFoto() {
    try {
      const imagen = await Camera.getPhoto({
        quality: 70,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      });

      if (imagen.base64String) {
        this.fotoAnonimo = `data:image/jpeg;base64,${imagen.base64String}`;
      }
    } catch (error) {
      this.toastService.mostrarToastError('Error al tomar la foto');
    }
  }

  async seleccionarFoto() {
    try {
      const imagen = await Camera.getPhoto({
        quality: 70,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos
      });

      if (imagen.base64String) {
        this.fotoAnonimo = `data:image/jpeg;base64,${imagen.base64String}`;
      }
    } catch (error) {
      this.toastService.mostrarToastError('Error al seleccionar la foto');
    }
  }

  async registrarClienteAnonimo() {
    if (!this.nombreAnonimo.trim()) {
      this.toastService.mostrarToastError('Por favor, ingrese su nombre');
      return;
    }

    if (!this.fotoAnonimo) {
      this.toastService.mostrarToastError('Por favor, tome o seleccione una foto');
      return;
    }

    this.procesandoRegistro = true;
    this.toastService.mostrarToastInfo('Registrando...');

    try {
      const resultado = await this.clienteAnonimo.registrarClienteAnonimo(
        this.nombreAnonimo.trim(),
        this.fotoAnonimo
      );

      if (resultado.success) {
        this.toastService.mostrarToastExito(`¡Bienvenido/a ${this.nombreAnonimo}!`);
        this.cerrarModalAnonimo();
        
        setTimeout(() => {
          this.router.navigate(['/home-anonimo']);
        }, 100);
      } else {
        this.toastService.mostrarToastError(resultado.message);
      }
    } catch (error) {
      this.toastService.mostrarToastError('Error al registrar. Intente nuevamente.');
    } finally {
      this.procesandoRegistro = false;
    }
  }
}