import { Injectable } from '@angular/core';
import emailjs from '@emailjs/browser';

@Injectable({
  providedIn: 'root'
})
export class Email {
  private servicioId = 'service_gourmetql'; 
  private llavePublica = 'WpFJizV6vcIfkX2Uw'; 

  // --- MÉTODOS EXISTENTES (USUARIOS) ---
  async enviarAprobacion(usuario: any){
    return this.enviarCorreo('template_aprobado', {
        nombre: usuario.nombre,
        email: usuario.email
    });
  }

  async enviarRechazo(usuario: any){
    return this.enviarCorreo('template_rechazado', {
        nombre: usuario.nombre,
        email: usuario.email
    });
  }

  // --- NUEVOS MÉTODOS (RESERVAS) ---
  
  async enviarConfirmacionReserva(reserva: any) {
    const fechaFormateada = new Date(reserva.fecha_hora).toLocaleString('es-AR');
    
    const params = {
      nombre: reserva.cliente.nombre,
      apellido: reserva.cliente.apellido,
      email: reserva.cliente.email,
      fecha: fechaFormateada,
      comensales: reserva.cantidad_comensales,
      titulo: '¡Tu mesa está lista!',
      mensaje: 'Nos complace informarte que tu reserva ha sido confirmada.'
    };

    // Asume que creaste un template para esto, o reutiliza uno genérico
    return this.enviarCorreo('template_aprobado', params); 
  }

  async enviarRechazoReserva(reserva: any, motivo: string) {
    const fechaFormateada = new Date(reserva.fecha_hora).toLocaleString('es-AR');

    const params = {
      nombre: reserva.cliente.nombre,
      apellido: reserva.cliente.apellido,
      email: reserva.cliente.email,
      fecha: fechaFormateada,
      motivo: motivo,
      titulo: 'Estado de tu Reserva',
      mensaje: 'Lamentablemente no podemos confirmar tu reserva en este momento.'
    };

    return this.enviarCorreo('template_aprobado', params);
  }

  // --- MÉTODO PRIVADO GENÉRICO ---
  private async enviarCorreo(templateId: string, params: any) {
    try {
      // Agregamos el logo y configuraciones base a todos los correos
      const baseParams = {
        ...params,
        logo: 'https://i.postimg.cc/pXF9Zbp7/logo.png'
      };

      const result = await emailjs.send(
        this.servicioId,
        templateId,
        baseParams,
        this.llavePublica
      );
      console.log('Correo enviado:', result.text);
      return true;
    } catch (error) {
      console.error('Error al enviar correo:', error);
      return false;
    }
  }

  async enviarFactura(cliente: any, linkFactura: string, total: number) {
    const params = {
      to_name: cliente.nombre,
      to_email: cliente.email,
      link_factura: linkFactura, // Asegúrate de agregar {{link_factura}} en tu template de EmailJS
      monto: total,
      logo: 'https://i.postimg.cc/pXF9Zbp7/logo.png',
      mensaje: 'Adjunto encontrarás el enlace para descargar tu factura.'
    };

    // Recomiendo crear un template específico en EmailJS llamado 'template_factura'
    // que tenga un botón: <a href="{{link_factura}}">Descargar Factura PDF</a>
    return this.enviarCorreo('template_aprobado', params);
  }
}