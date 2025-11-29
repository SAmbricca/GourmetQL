import { Component, OnInit } from '@angular/core';
import { Usuario } from 'src/app/services/supabase';
import { UsuariosService } from 'src/app/services/usuarios';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, 
  IonItem, IonLabel, IonButton, IonCard, IonSpinner, IonIcon 
} from "@ionic/angular/standalone";
import { addIcons } from 'ionicons'; 
import { checkmarkCircle, closeCircle } from 'ionicons/icons';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-gestion-clientes',
  templateUrl: './gestion-clientes.component.html',
  styleUrls: ['./gestion-clientes.component.scss'],
  // Agregamos IonSpinner e IonIcon para mejor UX
  imports: [CommonModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonList, 
    IonItem, IonLabel, IonButton, IonCard, IonSpinner
  ],
})
export class GestionClientesComponent implements OnInit {

  clientesPendientes: Usuario[] = [];
  loading: boolean = false; // Bandera para bloquear botones mientras procesa

  constructor(private usuarioService: UsuariosService) { 
    // Registramos los iconos si los usas en los botones
    addIcons({ checkmarkCircle, closeCircle });
  }

  async ngOnInit() {
    await this.cargarClientesPendientes();
  }

  async cargarClientesPendientes() {
    this.loading = true; // Iniciamos carga
    try {
      this.clientesPendientes = await this.usuarioService.obtenerClientesPendientes();
    } finally {
      this.loading = false; // Terminamos carga sea éxito o error
    }
  }

  async aprobar(cliente: Usuario) {
    if (this.loading) return; // Evita doble click
    this.loading = true;

    try {
      const exito = await this.usuarioService.aprobarCliente(cliente);
      if (exito) {
        // Eliminamos localmente para que la UI sea instantánea
        // y luego recargamos en segundo plano para confirmar
        this.clientesPendientes = this.clientesPendientes.filter(c => c.id !== cliente.id);
      }
    } catch (error) {
      console.error(error);
    } finally {
      this.loading = false;
      // Opcional: Recargar todo de la BD para asegurar consistencia
      // await this.cargarClientesPendientes(); 
    }
  }

  async rechazar(cliente: Usuario) {
    if (this.loading) return;
    this.loading = true;

    try {
      const exito = await this.usuarioService.rechazarCliente(cliente);
      if (exito) {
        this.clientesPendientes = this.clientesPendientes.filter(c => c.id !== cliente.id);
      }
    } catch (error) {
      console.error(error);
    } finally {
      this.loading = false;
    }
  }
} 