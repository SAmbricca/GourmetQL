import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';

@Injectable({
  providedIn: 'root'
})
export class ToastService {

  constructor(private toastController: ToastController) { }

  async mostrarToastExito(mensaje: string) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 5000,
      position: 'top',
      color: 'success',
      icon: 'checkmark-circle',
      cssClass: 'toast-success'
    });
    await toast.present();
  }

  async mostrarToastError(mensaje: string) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 5000,
      position: 'top',
      color: 'danger',
      icon: 'close-circle',
      cssClass: 'toast-error'
    });
    await toast.present();
  }

  async mostrarToastAdvertencia(mensaje: string) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 5000,
      position: 'top',
      color: 'warning', 
      icon: 'warning',
      cssClass: 'toast-warning'
    });
    await toast.present();
  }

  async mostrarToastInfo(mensaje: string) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 5000,
      position: 'top',
      color: 'primary',
      icon: 'information-circle',
      cssClass: 'toast-info'
    });
    await toast.present();
  }

  async mostrarToastAprobacionExitosa(usuario: any) {
    const toast = await this.toastController.create({
      message: `${usuario.nombre} ${usuario.apellido} ha sido aprobado exitosamente. Se ha enviado un email de bienvenida a ${usuario.email}.`,
      duration: 5000,
      position: 'top',
      color: 'success',
      icon: 'checkmark-circle',
      cssClass: 'toast-success-detailed'
    });
    await toast.present();
  }

  async mostrarToastRechazoExitoso(usuario: any) {
    const toast = await this.toastController.create({
      message: `${usuario.nombre} ${usuario.apellido} ha sido rechazado. Se ha enviado un email de notificación a ${usuario.email}.`,
      duration: 5000,
      position: 'top',
      color: 'medium',
      icon: 'information-circle',
      cssClass: 'toast-info-detailed'
    });
    await toast.present();
  }
}