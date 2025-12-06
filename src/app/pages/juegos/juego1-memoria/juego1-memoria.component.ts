import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-juego1-memoria',
  templateUrl: './juego1-memoria.component.html',
  styleUrls: ['./juego1-memoria.component.scss'],
  imports: [],
})
export class Juego1MemoriaComponent  implements OnInit {

  @Input() pedidoId!: number;
  @Input() clienteId!: number;
  @Output() juegoTerminado = new EventEmitter<any>();

  images = [
    'assets/games/DURAZNO(1).png',
    'assets/games/KIWI(1).png',
    'assets/games/GRANADA(1).png',
    'assets/games/FRUTILLA(1).png',
    'assets/games/MORAS(1).png',
    'assets/games/LIMON(1).png'
  ];


  cards: MemoryCard[] = [];
  flippedCards: number[] = [];
  attempts = 0;
  matches = 0;

  partidas = 1;        //  Intentos del juego completo
  finalizado = false;  //  Evita emitir más de una vez
 


  ngOnInit() {
  this.resetGame();
  }


  resetGame() {
    this.attempts = 0;
    this.cards = [];
    this.matches = 0;

    let duplicated = [...this.images, ...this.images];
    duplicated.sort(() => Math.random() - 0.5);


    this.cards = duplicated.map(img => ({
      image: img,
      flipped: false,
      matched: false,
    }));


    this.partidas++; //el usuario volvio a jugar partidas
  }


  flipCard(index: number) {
    const card = this.cards[index];
    if (card.flipped || card.matched || this.flippedCards.length === 2) return;


    card.flipped = true;
    this.flippedCards.push(index);


    if (this.flippedCards.length === 2) {
      this.attempts++;
      this.checkMatch();
    }
  }


  checkMatch() {
    const [i, j] = this.flippedCards;
    const card1 = this.cards[i];
    const card2 = this.cards[j];


    if (card1.image === card2.image) {
      card1.matched = true;
      card2.matched = true;
      this.matches++;

      if (this.matches === this.images.length) {
        this.terminarJuego(true);
      }
    } else {
    setTimeout(() => {
    card1.flipped = false;
    card2.flipped = false;
    }, 800);
  }
  this.flippedCards = [];
  }

  terminarJuego(gano: boolean) {
    if (this.finalizado) return;
    this.finalizado = true;

    const descuento = gano && this.partidas === 1 ? 10 : 0;

    this.juegoTerminado.emit({
      juego: 'memoria',
      gano,
      intentos: this.partidas,
      descuentoAplicado: descuento,
    });
  }
}

interface MemoryCard {
image: string;
flipped: boolean;
matched: boolean;
}