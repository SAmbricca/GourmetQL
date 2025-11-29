import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar,
  IonButton, IonIcon, IonCard, IonCardContent,
  IonSegment, IonSegmentButton, IonLabel 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { homeOutline, barChartOutline, pieChartOutline } from 'ionicons/icons';
import { EncuestasService } from '../../services/encuestas';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-encuesta-resultados',
  templateUrl: './encuesta-resultados.component.html',
  styleUrls: ['./encuesta-resultados.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar,
    IonButton, IonIcon, IonCard, IonCardContent,
    IonSegment, IonSegmentButton, IonLabel
  ]
})
export class EncuestaResultadosComponent implements OnInit {
  private encuestasService = inject(EncuestasService);
  private router = inject(Router);

  cargando: boolean = true;
  tipoGrafico: 'barras' | 'torta' = 'barras';
  
  // Datos procesados
  totalEncuestas: number = 0;
  promedioGeneral: number = 0;
  conteoEstrellas: number[] = [0,0,0,0,0]; // Indices 0-4 representan 1-5 estrellas
  porcentajes: number[] = [0,0,0,0,0];

  constructor() {
    addIcons({ homeOutline, barChartOutline, pieChartOutline });
  }

  async ngOnInit() {
    await this.cargarDatos();
  }

  async cargarDatos() {
    this.cargando = true;
    const resultado = await this.encuestasService.obtenerEstadisticas();
    
    if (resultado.success && resultado.data) {
      this.procesarDatos(resultado.data);
    }
    this.cargando = false;
  }

  procesarDatos(data: any[]) {
    this.totalEncuestas = data.length;
    
    if (this.totalEncuestas === 0) return;

    let sumaTotal = 0;
    // Reiniciar conteos
    this.conteoEstrellas = [0,0,0,0,0];

    data.forEach(encuesta => {
      const calif = encuesta.calificacion; // 1 a 5
      sumaTotal += calif;
      
      // Guardar conteo (ajustar indice -1)
      if(calif >= 1 && calif <= 5) {
        this.conteoEstrellas[calif - 1]++;
      }
    });

    this.promedioGeneral = parseFloat((sumaTotal / this.totalEncuestas).toFixed(1));

    // Calcular porcentajes para gráficos
    this.porcentajes = this.conteoEstrellas.map(count => 
      Math.round((count / this.totalEncuestas) * 100)
    );
  }

  // CSS para el gráfico de torta (Conic Gradient dinámico)
  get pieChartStyle() {
    let degAcumulado = 0;
    const colores = ['#eb445a', '#ffc409', '#ffc409', '#2dd36f', '#2dd36f']; // Rojo, amarillo, verde
    
    let gradiente = this.porcentajes.map((p, i) => {
      const start = degAcumulado;
      const end = degAcumulado + (p * 3.6);
      degAcumulado = end;
      return `${colores[i]} ${start}deg ${end}deg`;
    }).join(', ');

    return {
      'background': `conic-gradient(${gradiente})`
    };
  }

  irAlHome() {
    this.router.navigate(['/home-anonimo']);
  }
}