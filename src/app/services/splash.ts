import { Injectable } from '@angular/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { Platform } from '@ionic/angular/standalone';

@Injectable({
  providedIn: 'root'
})
export class SplashService {

  constructor(private platform: Platform) { }

  async hideSplash() {
    if (this.platform.is('capacitor')) {
      console.log('Ocultando splash nativo');
      await SplashScreen.hide();
      console.log('Splash nativo ocultado');
    }
  }
}