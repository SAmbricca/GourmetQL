import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router} from '@angular/router';
import { Games } from 'src/app/services/games';
import { Juego1MemoriaComponent } from './juego1-memoria/juego1-memoria.component';
import { Juego2QuizComponent } from './juego2-quiz/juego2-quiz.component';
import { Juego3MathComponent } from './juego3-math/juego3-math.component';
import { Juego4ReflejosComponent } from './juego4-reflejos/juego4-reflejos.component';
import { SupabaseService } from 'src/app/services/supabase';
import { environment } from 'src/environments/environment';
import { createClient } from '@supabase/supabase-js';


@Component({
  selector: 'app-juegos',
  templateUrl: './juegos.page.html',
  styleUrls: ['./juegos.page.scss'],
  standalone: true,
  imports: [ CommonModule, FormsModule, Juego1MemoriaComponent,Juego2QuizComponent,Juego3MathComponent,Juego4ReflejosComponent]
})
export class JuegosPage implements OnInit{

  pedidoId!: number;
  clienteId!: number;
  yaTieneDescuento: any;
  juegoSeleccionado: string | null = null;
  primeraVezJugado = false  // Flag que indica si ya tuvo su oportunidad del descuento
  supabase = createClient(environment.supabaseUrl, environment.supabaseKey);

  constructor(
    private router: Router, 
    private route: ActivatedRoute,
    private gameService: Games,
    private games: Games) {}

  
  
  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.pedidoId = Number(params['pedidoId']);
      this.clienteId = Number(params['clienteId']);

      console.log("pedidoId recibido:", this.pedidoId);
      console.log("clienteId recibido:", this.clienteId);

      if (!this.pedidoId || !this.clienteId) {
        console.error("ERROR: IDs inválidos", this.pedidoId, this.clienteId);
        return;
      }
      
      this.verificarPrimerJuego();
    });  
  }

  //los redirige a los juegos
  goToGame(game: string) {
    this.router.navigate([`/${game}`]);
  }


  seleccionarJuego(tipo: string) {
    this.juegoSeleccionado = tipo;
  }

  /** 
   * Revisa en la BD si este cliente ya jugó por PRIMERA VEZ.
   * Si ya jugó, no puede recibir descuento de nuevo.
   */
  async verificarPrimerJuego() {
    const resultado = await this.gameService.obtenerJuegoPorPedidoYCliente(
      this.pedidoId, 
      this.clienteId
    );

    this.primeraVezJugado = resultado !== null;
  }

/**
   * Recibe del hijo:
   * { juego, gano, intentos, descuentoAplicado }
   */
  async guardarResultado(event: any) {
    const { juego, gano, intentos, descuentoAplicado } = event;

    let descuentoFinal = 0;

    // Si es la primera vez y ganó → aplica descuento.
    if (!this.primeraVezJugado && gano) {
      descuentoFinal = descuentoAplicado;
    }

    // Guardamos el resultado del juego SIEMPRE (para estadísticas)
    await this.gameService.registrarJuego({
      pedido_id: this.pedidoId,
      cliente_id: this.clienteId,
      tipo_juego: juego,
      descuento_obtenido: descuentoFinal
    });

    // Marcamos que ya tuvo su oportunidad
    this.primeraVezJugado = true;

    // Redirección a mesa-opciones
    this.router.navigate(['/mesa-opciones'], {
      queryParams: { pedido: this.pedidoId }
    });
  }

  async procesarFinDeJuego(evento: any) {
    console.log('RESULTADO DEL JUEGO:', evento);

    const descuento = evento.descuentoAplicado ?? 0;

    // ⬇️ GUARDA EN SUPABASE DE VERDAD
    await this.games.registrarJuego({
      pedido_id: this.pedidoId,
      cliente_id: this.clienteId,
      tipo_juego: evento.juego,
      descuento_obtenido: descuento
    });

    console.log('JUEGO GUARDADO EN SUPABASE');
  }



}
