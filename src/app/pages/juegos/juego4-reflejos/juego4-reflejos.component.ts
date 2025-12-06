import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Motion } from '@capacitor/motion';


@Component({
  selector: 'app-juego4-reflejos',
  templateUrl: './juego4-reflejos.component.html',
  styleUrls: ['./juego4-reflejos.component.scss'],
  imports: [CommonModule],
})
export class Juego4ReflejosComponent implements OnInit, OnDestroy{

  //sirve para los juegos-------------------------------------
  @Input() pedidoId!: number;
  @Input() clienteId!: number;

  @Output() juegoTerminado = new EventEmitter<any>();
  

  yaTieneDescuento: boolean = false;
  finalizado = false;
  partidas = 1;   //  Para saber si ganó en su primer intento

  width = 400;
  height = 600;

  mozoX = 30;
  mozoY = 50;
  mesaX = 150;
  mesaY = 400;

  gameOver = false;
  gameWin = false;
  gameError = false;

  objects = [
    { name: 'banana', x: 200, y: 250, image: '/assets/games/LOGO-BANANA(1).png' },
    { name: 'patines', x: 70, y: 410, image: '/assets/games/LOGO-PATINES(1).png'},
    { name: 'aceite', x: 300, y: 400, image: '/assets/games/LOGO-ACEITE(1).png'},

  ];

  moveSpeed = 10; // pixeles por movimiento
  motionListener: any;


  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    this.playSound('start');
    this.startMotion();
  } 
  
  ngOnDestroy() {
    // Detener Motion cuando el componente se destruya
    if (this.motionListener) this.motionListener.remove();
  }

  async startMotion() {
    // Escuchar acelerómetro con Capacitor Motion
    this.motionListener = await Motion.addListener('accel', (accel) => {
      if (this.gameOver || this.gameWin || this.gameError) return;

      // Valores del acelerómetro
      const gamma = accel.accelerationIncludingGravity?.x ?? 0;
      const beta = accel.accelerationIncludingGravity?.y ?? 0;

      const sensitivity = 1.5; // ajusta según necesidad
      this.mozoX += gamma * sensitivity;
      this.mozoY -= beta * sensitivity;

      this.clampPosition();
      this.checkCollision();
    });
  }


  handleOrientation(event: DeviceOrientationEvent) {
    if (this.gameOver || this.gameWin || this.gameError) return;

    console.log('beta:', event.beta, 'gamma:', event.gamma);

    // event.gamma → izquierda/derecha
    // event.beta → adelante/atrás
    const gamma = event.gamma ?? 0; 
    const beta = event.beta ?? 0;
    console.log('gamma:', gamma, 'beta:', beta);

    const sensitivity = 2;


    this.mozoX += gamma * sensitivity; 
    this.mozoY += beta * sensitivity;

    this.clampPosition();
    this.checkCollision();
  }

  clampPosition() {
    // Evitar que el mozo salga de la pantalla
    this.mozoX = Math.max(0, Math.min(this.mozoX, this.width - 50));
    this.mozoY = Math.max(0, Math.min(this.mozoY, this.height - 50));
  }

  checkCollision() {
    // Colisión con objetos
    for (let obj of this.objects) {
      if (Math.abs(this.mozoX - obj.x) < 40 && Math.abs(this.mozoY - obj.y) < 40) {
        this.gameError = true;
        this.playSound('error');
        this.partidas++; 

        // emitimos resultado parcial (no ganador)
        this.emitResultado(false);
        return;
      }
    }

    // Llegar a la mesa
    if (Math.abs(this.mozoX - this.mesaX) < 40 && Math.abs(this.mozoY - this.mesaY) < 40) {
      this.gameWin = true;
      this.playSound('win');
      this.emitResultado(true);

    }
  }

  restartGame() {
    this.mozoX = 50;
    this.mozoY = 50;
    this.gameOver = false;
    this.gameWin = false;
    this.gameError = false;
    this.playSound('start');
  }

  playSound(type: 'start' | 'win' | 'error') {
    let audio = new Audio();
    switch (type) {
      case 'start':
        audio.src = '/assets/sounds/gamestart.mp3';
        break;
      case 'win':
        audio.src = '/assets/sounds/end.mp3';
        break;
      case 'error':
        audio.src = '/assets/sounds/error.mp3';
        break;
    }
    audio.load();
    audio.play();
  }

  // Opcional: permitir mover con teclado (para probar en PC)
  @HostListener('window:keydown', ['$event'])
  handleKey(event: KeyboardEvent) {
    if (this.gameOver || this.gameWin || this.gameError) return;

    switch (event.key) {
      case 'ArrowUp': this.mozoY -= this.moveSpeed; break;
      case 'ArrowDown': this.mozoY += this.moveSpeed; break;
      case 'ArrowLeft': this.mozoX -= this.moveSpeed; break;
      case 'ArrowRight': this.mozoX += this.moveSpeed; break;
    }
    this.clampPosition();
    this.checkCollision();
  }  

  emitResultado(gano: boolean) {
    if (this.finalizado) return;
    this.finalizado = true;

    const descuento = gano && this.partidas === 1 ? 20 : 0;

    this.juegoTerminado.emit({
      juego: 'reflejos',
      gano,
      intentos: this.partidas,
      descuentoAplicado: descuento
    });
  }
}




