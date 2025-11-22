import { Injectable } from '@angular/core';
import { SupabaseService, Usuario } from './supabase';
import { ToastService } from './toast';
import { Email } from './email';

@Injectable({
  providedIn: 'root'
})
export class UsuariosService {

  constructor(
    private supabaseClient: SupabaseService,
    private toastService: ToastService,
    private emailService: Email
  ) {}

  async obtenerTodosLosUsuarios(): Promise<Usuario[]> {
    try {
      const { data, error } = await this.supabaseClient.supabase
        .from('usuarios')
        .select('*')
        .eq('estado', 'habilitado');

      if (error) {
        console.error('Error al obtener usuarios:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error al conectar con la base de datos:', error);
      return [];
    }
  }

  async obtenerClientesPendientes(): Promise<Usuario[]> {
    try {
      const { data, error } = await this.supabaseClient.supabase
        .from('usuarios')
        .select('*')
        .eq('perfil', 'maitre')
        .eq('estado', 'pendiente');

      if (error) {
        console.error('Error al obtener clientes pendientes:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error al conectar con la base de datos:', error);
      return [];
    }
  }

  async aprobarCliente(cliente: Usuario): Promise<boolean> {
    try {
      const { error } = await this.supabaseClient.supabase
        .from('usuarios')
        .update({ estado: 'habilitado' })
        .eq('id', cliente.id);

      if (error) {
        this.toastService.mostrarToastError('Error al aprobar cliente');
        return false;
      }

      this.toastService.mostrarToastAprobacionExitosa(cliente);
      await this.emailService.enviarAprobacion(cliente);
      return true;

    } catch (error) {
      console.error('Error al aprobar cliente:', error);
      this.toastService.mostrarToastError('Error al conectar con el servidor');
      return false;
    }
  }

  async rechazarCliente(cliente: Usuario): Promise<boolean> {
    try {
      const { error } = await this.supabaseClient.supabase
        .from('usuarios')
        .update({ estado: 'deshabilitado' })
        .eq('id', cliente.id);

      if (error) {
        this.toastService.mostrarToastError('Error al rechazar cliente');
        return false;
      }

      this.toastService.mostrarToastRechazoExitoso(cliente);
      await this.emailService.enviarRechazo(cliente);
      return true;
    } catch (error) {
      console.error('Error al rechazar cliente:', error);
      this.toastService.mostrarToastError('Error al conectar con el servidor');
      return false;
    }
  }

  async crearUsuario(usuario: Omit<Usuario, 'id'>): Promise<{ success: boolean; message: string }> {
    try {
      const { data, error } = await this.supabaseClient.supabase
        .from('usuarios')
        .insert([usuario]);

      if (error) {
        return { success: false, message: 'Error al crear usuario: ' + error.message };
      }

      return { success: true, message: 'Usuario creado' };
    } catch (error) {
      console.error('Error al crear usuario:', error);
      return { success: false, message: 'Error al conectar con el servidor' };
    }
  }

  async actualizarUsuario(id: number, datos: Partial<Usuario>): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await this.supabaseClient.supabase
        .from('usuarios')
        .update(datos)
        .eq('id', id);

      if (error) {
        return { success: false, message: 'Error al actualizar usuario: ' + error.message };
      }

      return { success: true, message: 'Usuario actualizado' };
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      return { success: false, message: 'Error al conectar con el servidor' };
    }
  }

  async obtenerUsuarioPorId(id: number): Promise<Usuario | null> {
    try {
      const { data, error } = await this.supabaseClient.supabase
        .from('usuarios')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error al obtener usuario:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error al conectar con la base de datos:', error);
      return null;
    }
  }

  async obtenerUsuariosPorPerfil(perfil: Usuario['perfil']): Promise<Usuario[]> {
    try {
      const { data, error } = await this.supabaseClient.supabase
        .from('usuarios')
        .select('*')
        .eq('perfil', perfil)
        .eq('estado', 'habilitado');

      if (error) {
        console.error('Error al obtener usuarios por perfil:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error al conectar con la base de datos:', error);
      return [];
    }
  }
}