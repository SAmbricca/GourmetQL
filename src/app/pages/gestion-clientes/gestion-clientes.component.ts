import { Component, OnInit } from '@angular/core';
import { Usuario } from 'src/app/services/supabase';
import { UsuariosService } from 'src/app/services/usuarios';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonButton, IonCard} from "@ionic/angular/standalone";
@Component({
  selector: 'app-gestion-clientes',
  templateUrl: './gestion-clientes.component.html',
  styleUrls: ['./gestion-clientes.component.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonButton, IonCard],
})
export class GestionClientesComponent  implements OnInit {

  clientesPendientes: Usuario[] = [];

  //Injectamos el servicio
  constructor(
    private usuarioService: UsuariosService) 
    { }

  //Se ejecutara cuando inicie el componente
  async ngOnInit() {
    await this.cargarClientesPendientes();
  }

  //metodo que se encargara de cargar los clientes pendientes
  async cargarClientesPendientes(){
    this.clientesPendientes = await this.usuarioService.obtenerClientesPendientes();
  }

  //Metodo de aprobar cliente 
  async aprobar(cliente: Usuario){
    if(await this.usuarioService.aprobarCliente(cliente)){
      await this.cargarClientesPendientes();
    }
  }

  //Metodo de rechazar el cliente
  async rechazar(cliente: Usuario){
    if (await this.usuarioService.rechazarCliente(cliente)){
      await this.cargarClientesPendientes();
    }
  }

}
