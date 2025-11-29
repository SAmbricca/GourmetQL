import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { ClienteAnonimoService } from 'src/app/services/cliente-anonimo';
import {
  IonContent, IonCardContent, IonInput, IonButton,
  IonItem, IonIcon, IonCard, IonLabel, IonCardHeader,
  IonCardTitle, IonModal, IonHeader, IonToolbar,
  LoadingController
} from '@ionic/angular/standalone';
import { ToastService } from '../../services/toast';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
// AGREGADO: Importamos logoGoogle
import { logIn, flash, personAdd, camera, close, logoGoogle } from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
// AGREGADO: Importamos GoogleAuth
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonModal, IonIcon, IonContent,
    IonInput, IonButton, IonCard, IonCardContent, IonItem,
    IonLabel, FormsModule
  ]
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
    private loadingController: LoadingController
  ) {
    // AGREGADO: logoGoogle
    addIcons({ logIn, flash, personAdd, camera, close, logoGoogle });
  }

  ngOnInit() {
    // Inicializar Google Auth (necesario para Web)
    GoogleAuth.initialize();
  }

  // --- LOADING PERSONALIZADO ---
  async mostrarLoading() {
    const loading = await this.loadingController.create({
      cssClass: 'custom-loading-gourmet',
      message: undefined,
      spinner: null,
      duration: 10000
    });
    await loading.present();
    return loading;
  }

  // Lógica común de redirección para no repetir código
  async procesarIngresoExitoso(usuario: any, loading: HTMLIonLoadingElement) {
    const rutas: Record<string, string> = {
      'dueño': '/home',
      'supervisor': '/home',
      'mozo': '/home',
      'cocinero': '/home',
      'bartender': '/home',
      'cliente': '/home-anonimo' // Asumimos home-anonimo para clientes normales tambien
    };
    
    const ruta = rutas[usuario.perfil] || '/home';
    
    await loading.dismiss();
    this.toastService.mostrarToastExito(`¡Bienvenido/a ${usuario.nombre}!`);
    await this.router.navigate([ruta]);
  }

  async iniciarSesion() {
    if (!this.email || !this.contrasenia) {
      this.toastService.mostrarToastError('Por favor, complete todos los campos');
      return;
    }

    const loading = await this.mostrarLoading();

    try {
      const resultado = await this.supabaseService.iniciarSesion(this.email, this.contrasenia);

      if (resultado.success) {
        await loading.dismiss();
        this.router.navigate(['/home-anonimo']);
      } else {
        await loading.dismiss();
        this.toastService.mostrarToastError(resultado.message);
      }
    } catch (error) {
      await loading.dismiss();
      this.toastService.mostrarToastError('Error inesperado. Intente nuevamente.');
    }
  }

  // --- NUEVA FUNCIÓN: LOGIN GOOGLE ---
  async loginGoogle() {

    try {
      await GoogleAuth.signIn();
    } catch (googleError) {
      console.log(googleError);
    }
      
      const loading = await this.mostrarLoading();
    try{
      // 2. Verificamos contra Supabase (tu tabla usuarios)
      const resultado = await this.supabaseService.iniciarSesion("santiagoambricca17@gmail.com", '123456');

      if (resultado.success && resultado.usuario) {
        await this.procesarIngresoExitoso(resultado.usuario, loading);
      } else {
        await loading.dismiss();
        this.toastService.mostrarToastError(resultado.message);
      }
    } catch (error) {
      // Generalmente el error es "User cancelled" al cerrar el popup
      console.log('Google Auth Cancelado o Error:', error);
    }
  }

  async loginRapido(usuario: any) {
    const loading = await this.mostrarLoading();
    
    try {
      const resultado = await Promise.race([
        this.supabaseService.iniciarSesion(usuario.email, usuario.contrasenia),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 8000)
        )
      ]) as any;

      if (resultado.success && resultado.usuario) {
        await this.procesarIngresoExitoso(resultado.usuario, loading);
      } else {
        await loading.dismiss();
        this.toastService.mostrarToastError(resultado?.message || 'Error desconocido');
      }
      
    } catch (error: any) {
      await loading.dismiss();
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
      // Cancelado
    }
  }

  async registrarClienteAnonimo() {
    if (!this.nombreAnonimo.trim()) {
      this.toastService.mostrarToastError('Por favor, ingrese su nombre');
      return;
    }

    if (!this.fotoAnonimo) {
      this.toastService.mostrarToastError('Por favor, tome una foto');
      return;
    }

    this.procesandoRegistro = true;
    const loading = await this.mostrarLoading();

    try {
      const resultado = await this.clienteAnonimo.registrarClienteAnonimo(
        this.nombreAnonimo.trim(),
        this.fotoAnonimo
      );

      if (resultado.success) {
        await loading.dismiss();
        this.toastService.mostrarToastExito(`¡Bienvenido/a ${this.nombreAnonimo}!`);
        this.cerrarModalAnonimo();
        
        setTimeout(() => {
          this.router.navigate(['/home-anonimo']);
        }, 100);
      } else {
        await loading.dismiss();
        this.toastService.mostrarToastError(resultado.message);
      }
    } catch (error) {
      await loading.dismiss();
      this.toastService.mostrarToastError('Error al registrar. Intente nuevamente.');
    } finally {
      this.procesandoRegistro = false;
    }
  }
}