import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/splash',
    pathMatch: 'full',
  },
  {
    path: 'splash',
    loadComponent: () => import('./pages/splash/splash.component').then(m => m.SplashComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'registro',
    loadComponent: () => import('./pages/registro/registro.component').then(m => m.RegistroComponent),
  },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'home-anonimo',
    loadComponent: () => import('./pages/home-anonimo/home-anonimo.component').then(m => m.HomeAnonimoComponent),
  },
  {
    path: 'pedidos-mozo',
    loadComponent: () => import('./pages/pedidos-mozo/pedidos-mozo.component').then(m => m.PedidosMozoComponent),
  },
  {
    path: 'sector-cocina',
    loadComponent: () => import('./pages/sector-cocina/sector-cocina.component').then(m => m.SectorCocinaComponent),
  },
  {
    path: 'sector-bar',
    loadComponent: () => import('./pages/sector-bar/sector-bar.component').then(m => m.SectorBarComponent),
  },
  {
    path: 'agregar-empleado',
    loadComponent: () => import('./pages/home/components/agregar-empleado/agregar-empleado.component').then(m => m.AgregarEmpleadoComponent),
  },
  {
    path: 'agregar-plato',
    loadComponent: () => import('./pages/home/components/agregar-plato/agregar-plato.component').then(m => m.AgregarPlatoComponent),
  },
  {
    path: 'agregar-bebida',
    loadComponent: () => import('./pages/home/components/agregar-bebida/agregar-bebida.component').then(m => m.AgregarBebidaComponent),
  },
  {
    path: 'agregar-mesa',
    loadComponent: () => import('./pages/home/components/agregar-mesa/agregar-mesa.component').then(m => m.AgregarMesaComponent),
  },
  {
    path: 'gestion-clientes',
    loadComponent: () => import('./pages/gestion-clientes/gestion-clientes.component').then(m => m.GestionClientesComponent)
  },
  {
    path: 'lista-espera',
    loadComponent: () => import('./pages/lista-espera/lista-espera.component').then(m => m.ListaEsperaComponent)
  },
  {
    path: 'menu-cliente',
    loadComponent: () => import('./pages/menu-cliente/menu-cliente.component').then(m => m.MenuClienteComponent)
  },
  {
    path: 'menu-delivery',
    loadComponent: () => import('./pages/menu-delivery/menu-delivery.component').then(m => m.MenuDeliveryComponent)
  },
  {
    path: 'mesa-opciones',
    loadComponent: () => import('./pages/mesa-opciones/mesa-opciones.component').then(m => m.MesaOpcionesComponent)
  },
  {
    path: 'consulta-mozo',
    loadComponent: () => import('./pages/consulta-mozo/consulta-mozo.component').then(m => m.ConsultaMozoComponent)
  },
  {
    path: 'consulta-mozo-admin',
    loadComponent: () => import('./pages/consulta-mozo-admin/consulta-mozo-admin.component').then(m => m.ConsultaMozoAdminComponent)
  },
  {
    path: 'estado-pedido',
    loadComponent: () => import('./pages/estado-pedido/estado-pedido.component').then(m => m.EstadoPedidoComponent)
  },
  {
    path: 'encuesta-alta',
    loadComponent: () => import('./pages/encuesta-alta/encuesta-alta.component').then(m => m.EncuestaAltaComponent)
  },
  {
    path: 'encuesta-resultados',
    loadComponent: () => import('./pages/encuesta-resultados/encuesta-resultados.component').then(m => m.EncuestaResultadosComponent)
  },
  {
    path: 'pedir-cuenta',
    loadComponent: () => import('./pages/pedir-cuenta/pedir-cuenta.component').then(m => m.PedirCuentaComponent)
  },
  {
    path: 'reservas',
    loadComponent: () => import('./pages/reservas/reservas.component').then(m => m.ReservasComponent)
  },
  {
    path: 'delivery',
    loadComponent: () => import('./pages/delivery/delivery.component').then(m => m.DeliveryComponent)
  },
  {
    path: 'lista-reservas',
    loadComponent: () => import('./pages/lista-reservas/lista-reservas.component').then(m => m.ListaReservasComponent)
  },
];