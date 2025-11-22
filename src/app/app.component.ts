import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet, Platform } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { NotificacionesService } from './services/notificaciones';
import { LocalNotifications } from '@capacitor/local-notifications';
import { SupabaseService } from './services/supabase';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {

  constructor(
    private platform: Platform,
    private router: Router,
    private notificacionesService: NotificacionesService,
    private supabaseService: SupabaseService
  ) {
    this.initializeApp();
  }

  ngOnInit() {
    console.log('App iniciada');
  }

  async initializeApp() {
    await this.platform.ready();
    
    await this.configurarNotificaciones();
    
    const usuario = await this.supabaseService.obtenerUsuarioActual();
    if (usuario) {
      await this.notificacionesService.suscribirNotificaciones(usuario.id.toString());
    }
    
    setTimeout(() => {
      this.router.navigate(['/splash']);
    }, 1000);
  }

  private async configurarNotificaciones() {
    try {
      const tienePermisos = await this.notificacionesService.verificarPermisos();
      
      if (tienePermisos) {
      } else {
        await LocalNotifications.requestPermissions();
      }

    } catch (error) {
      console.error('Error al configurar notificaciones:', error);
    }
  }

  ngOnDestroy() {
    LocalNotifications.removeAllListeners();
  }
}