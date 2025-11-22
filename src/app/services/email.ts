import { Injectable } from '@angular/core';
import emailjs from '@emailjs/browser';
@Injectable({
  providedIn: 'root'
})
export class Email {
  private servicioId = 'service_gourmet'; //ID de tu servicio
  private llavePublica = 'WpFJizV6vcIfkX2Uw'; //public key de emailjs

  //Metodo async encargado de enviar le correo de aprobación
  async enviarAprobacion(usuario: any){
    return this.enviarCorreo('template_aprobado', usuario);
  }

  //Metodo async encargado de enviar el correo de rechazo
  async enviarRechazo( usuario: any){
    return this.enviarCorreo('template_rechazado', usuario);
  }

  //Metodo que utilizara el servicio de email para enviar el correo
  private async enviarCorreo(templateId: string, usuario: any) {
    try {
      const result = await emailjs.send(
        this.servicioId,
        templateId,
        {
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          email: usuario.email,
          logo: 'https://i.postimg.cc/FzM41B6Z/logo.png' // Logo de la empresa (utilice POSTIMAGE: ahi cargas la foto del logo y tomas el link del enlace directo)
        },
        this.llavePublica
      );
      console.log('Correo enviado:', result.text);
      return true;
    } catch (error) {
      console.error('Error al enviar correo:', error);
      return false;
    }
  }

}
