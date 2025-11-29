import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { Preferences } from '@capacitor/preferences';
import { CapacitorService } from './capacitor';
import { NotificacionesService } from './notificaciones';
import { Email } from './email';

export interface Usuario {
  id: number;
  email: string;
  nombre: string;
  apellido: string;
  dni: string;
  cuil: string;
  perfil: 'dueño' | 'supervisor' | 'cocinero' | 'bartender' | 'mozo' | 'maitre' | 'cliente';
  foto_url: string;
  estado: 'habilitado' | 'deshabilitado' | 'pendiente';
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  public supabase: SupabaseClient;
  private usuarioActual: Usuario | null = null;
  private readonly USUARIO_KEY = 'usuario_actual';

  constructor(
    private router: Router,
    private capacitorService: CapacitorService,
    private notificacionesService: NotificacionesService
  ) {
    this.supabase = createClient(
      environment.supabaseUrl, 
      environment.supabaseKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
        global: {
          fetch: this.capacitorService.capacitorFetch.bind(this.capacitorService)
        }
      }
    );
    this.inicializarUsuario();
  }

  private async inicializarUsuario(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: this.USUARIO_KEY });
      if (value) {
        this.usuarioActual = JSON.parse(value);
      }
    } catch (error) {
      console.error('Error al inicializar usuario:', error);
    }
  }

  // --- LOGIN ORIGINAL ---
  async iniciarSesion(email: string, contrasenia: string): Promise<{ success: boolean; message: string; usuario?: Usuario }> {
    try {
      const { data, error } = await this.supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .eq('contrasenia', contrasenia)
        .limit(1);

      if (!data || !Array.isArray(data) || data.length === 0) {
        return { success: false, message: 'Credenciales incorrectas' };
      }

      const usuario = data[0];
      return this.procesarUsuarioLogin(usuario);
      
    } catch (error) {
      return { success: false, message: 'Error al conectar con el servidor' };
    }
  }

  // --- NUEVO: LOGIN SIMULADO GOOGLE (Solo Email) ---
  async iniciarSesionConGoogleSimulado(email: string): Promise<{ success: boolean; message: string; usuario?: Usuario }> {
    try {
      // Buscamos SOLO por email, ignorando la contraseña
      const { data, error } = await this.supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .limit(1);

      if (!data || !Array.isArray(data) || data.length === 0) {
        return { success: false, message: 'Este correo de Google no está registrado en el sistema.' };
      }

      const usuario = data[0];
      return this.procesarUsuarioLogin(usuario);

    } catch (error) {
      return { success: false, message: 'Error de conexión con Google (Simulado)' };
    }
  }

  // Refactoricé esto para reutilizar lógica entre ambos logins
  private async procesarUsuarioLogin(usuario: Usuario): Promise<{ success: boolean; message: string; usuario?: Usuario }> {
      if (usuario.estado === 'pendiente') {
        return { success: false, message: 'Su registro aún está pendiente de aprobación.' };
      }

      if (usuario.estado === 'deshabilitado') {
        return { success: false, message: 'Su registro fue rechazado. Contacte con soporte.' };
      }

      this.usuarioActual = usuario;
      await Preferences.set({
        key: this.USUARIO_KEY,
        value: JSON.stringify(usuario)
      });

      await this.notificacionesService.suscribirNotificaciones(usuario.id.toString());
      return { success: true, message: 'Inicio de sesión exitoso', usuario };
  }

  async cerrarSesion(): Promise<void> {
    await this.notificacionesService.desuscribirNotificaciones();
    
    this.usuarioActual = null;
    await Preferences.remove({ key: this.USUARIO_KEY });
    this.router.navigate(['/login']);
  }

  async obtenerUsuarioActual(): Promise<Usuario | null> {
    if (!this.usuarioActual) {
      try {
        const { value } = await Preferences.get({ key: this.USUARIO_KEY });
        if (value) {
          this.usuarioActual = JSON.parse(value);
        }
      } catch (error) {
        console.error('Error al obtener usuario de Preferences:', error);
      }
    }
    return this.usuarioActual;
  }

  async obtenerUsuarioActualConNotificacion(): Promise<Usuario | null> {
    const usuario = await this.obtenerUsuarioActual();
    return usuario;
  }

  async estaLogueado(): Promise<boolean> {
    const usuario = await this.obtenerUsuarioActual();
    return usuario !== null;
  }

  async subirImagen(
    bucket: string, 
    fileName: string, 
    file: Blob
  ): Promise<{ success: boolean; url?: string; message: string }> {
    try {
      const contentType = file.type || 'image/jpeg';
      const uploadUrl = `${environment.supabaseUrl}/storage/v1/object/${bucket}/${fileName}`;
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const formData = new FormData();
      const fileObject = new File([bytes], fileName, { type: contentType });
      formData.append('file', fileObject);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${environment.supabaseKey}`,
          'apikey': environment.supabaseKey,
          'x-upsert': 'false',
        },
        body: formData
      });

      let responseData;
      const responseText = await response.text();
      
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { message: responseText };
      }

      if (!response.ok) {
        console.error('Error en la respuesta:', responseData);
        const errorMessage = responseData.error || responseData.message || 'Error desconocido';
        if (errorMessage.includes('not found')) {
          return { success: false, message: 'El bucket no existe o no es accesible' };
        }
        
        return { 
          success: false, 
          message: `Error al subir: ${errorMessage}` 
        };
      }
      const publicUrl = `${environment.supabaseUrl}/storage/v1/object/public/${bucket}/${fileName}`;

      return { 
        success: true, 
        url: publicUrl, 
        message: 'Imagen subida exitosamente' 
      };
    } catch (error: any) {
      console.error('Error crítico al subir imagen:', error);
      return { 
        success: false, 
        message: 'Error de conexión: ' + (error.message || 'Error desconocido')
      };
    }
  }

  async agregarPlato(plato: any) {
    const { data, error } = await this.supabase
      .from('menu')
      .insert(plato);
    
    if (error) throw error;
    return data;
  }

  async iniciarSesionConGoogle(email: string): Promise<{ success: boolean; message: string; usuario?: Usuario }> {

    try {
      // 1. Buscar si el usuario ya existe en TU tabla personalizada
      const { data, error } = await this.supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .limit(1);

      if (error) throw error;
      return { success: true, message: 'Ingreso exitoso con Google. Bienvenido/a SANTIAGO AMBRICCA CIMINIERI' };

    } catch (error: any) {
      console.error('Error Google Login Service:', error);
      return { success: false, message: 'Error de conexión con Google Auth' };
    }
  }
}