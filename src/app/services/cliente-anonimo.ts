import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { SupabaseService } from './supabase';

export interface ClienteAnonimo {
  id: number;
  nombre: string;
  foto_url: string;
  fecha_creacion: string;
}

@Injectable({
  providedIn: 'root'
})
export class ClienteAnonimoService {
  private clienteAnonimoActual: ClienteAnonimo | null = null;
  private readonly CLIENTE_ANONIMO_KEY = 'cliente_anonimo_actual';

  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {
    this.inicializarClienteAnonimo();
  }

  private async inicializarClienteAnonimo(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: this.CLIENTE_ANONIMO_KEY });
      if (value) {
        this.clienteAnonimoActual = JSON.parse(value);
      }
    } catch (error) {
      console.error('Error al inicializar cliente anónimo:', error);
    }
  }

  async registrarClienteAnonimo(nombre: string, fotoBase64: string): Promise<{ success: boolean; message: string; cliente?: ClienteAnonimo }> {
    try {
      const base64Response = await fetch(fotoBase64);
      const blob = await base64Response.blob();

      const timestamp = Date.now();
      const fileName = `cliente_${timestamp}.jpg`;

      const resultadoFoto = await this.supabaseService.subirImagen('fotos-clientes-anonimos', fileName, blob);

      if (!resultadoFoto.success) {
        return { success: false, message: resultadoFoto.message };
      }

      const { data, error } = await this.supabaseService.supabase
        .from('clientes_anonimos')
        .insert({
          nombre: nombre,
          foto_url: resultadoFoto.url
        })
        .select()
        .single();

      if (error) {
        return { success: false, message: 'Error al registrar el cliente: ' + error.message };
      }

      this.clienteAnonimoActual = data;
      await Preferences.set({
        key: this.CLIENTE_ANONIMO_KEY,
        value: JSON.stringify(data)
      });

      return { success: true, message: 'Cliente registrado', cliente: data };

    } catch (error: any) {
      console.error('Error en registrarClienteAnonimo:', error);
      return { success: false, message: 'Error al conectar con el servidor' };
    }
  }

  async obtenerClienteAnonimoActual(): Promise<ClienteAnonimo | null> {
    if (!this.clienteAnonimoActual) {
      try {
        const { value } = await Preferences.get({ key: this.CLIENTE_ANONIMO_KEY });
        if (value) {
          this.clienteAnonimoActual = JSON.parse(value);
        }
      } catch (error) {
        console.error('Error al obtener cliente anónimo de Preferences:', error);
      }
    }
    return this.clienteAnonimoActual;
  }

  async estaLogueado(): Promise<boolean> {
    const cliente = await this.obtenerClienteAnonimoActual();
    return cliente !== null;
  }

  async cerrarSesion(): Promise<void> {
    this.clienteAnonimoActual = null;
    await Preferences.remove({ key: this.CLIENTE_ANONIMO_KEY });
    this.router.navigate(['/login']);
  }

  async actualizarCliente(id: number, datos: Partial<ClienteAnonimo>): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await this.supabaseService.supabase
        .from('clientes_anonimos')
        .update(datos)
        .eq('id', id);

      if (error) {
        return { success: false, message: 'Error al actualizar: ' + error.message };
      }

      if (this.clienteAnonimoActual && this.clienteAnonimoActual.id === id) {
        this.clienteAnonimoActual = { ...this.clienteAnonimoActual, ...datos };
        await Preferences.set({
          key: this.CLIENTE_ANONIMO_KEY,
          value: JSON.stringify(this.clienteAnonimoActual)
        });
      }

      return { success: true, message: 'Cliente actualizado exitosamente' };
    } catch (error: any) {
      console.error('Error al actualizar cliente:', error);
      return { success: false, message: 'Error al conectar con el servidor' };
    }
  }

  async obtenerClientePorId(id: number): Promise<ClienteAnonimo | null> {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('clientes_anonimos')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error al obtener cliente por ID:', error);
      return null;
    }
  }
}