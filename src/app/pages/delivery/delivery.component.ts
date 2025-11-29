import { Component, OnInit, OnDestroy } from '@angular/core'; // Quitamos AfterViewInit
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton, 
  IonTitle, IonItem, IonLabel, IonInput, IonButton, IonIcon, 
  IonTextarea, IonSpinner, ViewDidEnter, ViewWillLeave 
} from '@ionic/angular/standalone';
import { Geolocation } from '@capacitor/geolocation';
import { DeliveryService } from '../../services/delivery';
import { ToastService } from '../../services/toast';
import { addIcons } from 'ionicons';
import { locationOutline, mapOutline, navigateCircleOutline } from 'ionicons/icons';
import * as L from 'leaflet';

@Component({
  selector: 'app-delivery',
  templateUrl: './delivery.component.html',
  styleUrls: ['./delivery.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton,
    IonTitle, IonItem, IonLabel, IonInput, IonButton, IonIcon, 
    IonTextarea
  ]
})
export class DeliveryComponent implements ViewDidEnter, ViewWillLeave { // Usamos ciclos de Ionic
  direccion: string = '';
  aclaraciones: string = '';
  buscando: boolean = false;
  
  map: any;
  markerUsuario: any;
  markerLocal: any;
  lineaConector: any; // Variable para la línea

  // Coordenadas FIJAS de tu Restaurante (Cámbialas por las reales)
  private readonly LOCAL_COORDS = { lat: -34.6037, lng: -58.3816 }; 
  private userCoords: { lat: number, lng: number } | undefined;

  constructor(
    private router: Router,
    private deliveryService: DeliveryService,
    private toastService: ToastService
  ) {
    addIcons({ locationOutline, mapOutline, navigateCircleOutline });
    this.configurarIconosLeaflet();
  }

  // Se ejecuta cuando la animación de entrada termina (ESTO SOLUCIONA TU ERROR DE IMAGEN)
  ionViewDidEnter() {
    this.initMap();
  }

  // Limpieza al salir
  ionViewWillLeave() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  configurarIconosLeaflet() {
    const iconDefault = L.icon({
      iconRetinaUrl: 'assets/marker-icon-2x.png',
      iconUrl: 'assets/marker-icon.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34]
    });
    L.Marker.prototype.options.icon = iconDefault;
  }

  initMap() {
    // Si el mapa ya existe, no lo recreamos
    if (this.map) return;

    // 1. Inicializamos el mapa
    this.map = L.map('mapId', {
      zoomControl: false // Opcional: quitamos zoom default para estética móvil
    }).setView([this.LOCAL_COORDS.lat, this.LOCAL_COORDS.lng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    // 2. FIX CRÍTICO: Forzar actualización de tamaño tras renderizado
    setTimeout(() => {
      this.map.invalidateSize();
    }, 200);

    // 3. Agregamos marcador del Restaurante (Fijo)
    // Intenta usar un icono diferente si tienes (restaurant-marker.png), sino usará el default
    const iconoLocal = L.icon({
      iconUrl: 'assets/restaurant-marker.png', // Asegúrate de tener este asset o comenta esta linea
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40]
    });

    // Si no tienes la imagen restaurant-marker, borra la opción {icon: iconoLocal}
    this.markerLocal = L.marker([this.LOCAL_COORDS.lat, this.LOCAL_COORDS.lng]) 
      .addTo(this.map)
      .bindPopup('<b>GourmetQL</b>').openPopup();

    // 4. Evento Click en mapa
    this.map.on('click', (e: any) => {
      this.actualizarMarcadorUsuario(e.latlng.lat, e.latlng.lng);
    });
  }


  actualizarMarcadorUsuario(lat: number, lng: number) {
    this.userCoords = { lat, lng };

    // 1. Mover o crear marcador de usuario
    if (this.markerUsuario) {
      this.markerUsuario.setLatLng([lat, lng]);
    } else {
      this.markerUsuario = L.marker([lat, lng], { draggable: true }).addTo(this.map);
      this.markerUsuario.on('dragend', (event: any) => {
        const pos = event.target.getLatLng();
        this.actualizarMarcadorUsuario(pos.lat, pos.lng); // Recursivo para actualizar línea al arrastrar
      });
    }

    // 2. Dibujar línea recta hacia el local
    this.dibujarLineaConector();

    // 3. Obtener dirección texto (Geocoding)
    this.obtenerDireccionTexto(lat, lng);
  }

  dibujarLineaConector() {
    // Si ya existe una línea, la borramos para no tener muchas líneas
    if (this.lineaConector) {
      this.map.removeLayer(this.lineaConector);
    }

    // Creamos la nueva línea (Polyline)
    const puntos = [
      [this.LOCAL_COORDS.lat, this.LOCAL_COORDS.lng], // Punto A: Local
      [this.userCoords!.lat, this.userCoords!.lng]    // Punto B: Usuario
    ];

    this.lineaConector = L.polyline(puntos as any, {
      color: '#0400ffff', // Color dorado acorde a tu tema
      weight: 6,        // Grosor
      opacity: 1
    }).addTo(this.map);
  }

  async obtenerDireccionTexto(lat: number, lng: number) {
    try {
      // Usamos fetch simple a Nominatim (OSM)
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      if (data && data.display_name) {
        // Limpiamos un poco la dirección para que no sea kilométrica
        const partes = data.display_name.split(',');
        this.direccion = partes.slice(0, 3).join(','); 
      }
    } catch (e) {
      console.error('Error reverse geocoding', e);
    }
  }

  irAlMenu() {
    if (!this.direccion || this.direccion.length < 3) {
      this.toastService.mostrarToastError('Seleccione una ubicación válida en el mapa');
      return;
    }

    this.deliveryService.setDireccion({
      direccion: this.direccion,
      coords: this.userCoords,
      aclaraciones: this.aclaraciones
    });

    this.router.navigate(['/menu-delivery']); // Asegúrate que esta ruta exista en app.routes
  }
}