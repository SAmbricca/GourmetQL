import { Component, EventEmitter, Input, Output} from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-juego3-math',
  templateUrl: './juego3-math.component.html',
  styleUrls: ['./juego3-math.component.scss'],
  imports: [FormsModule] ,
})
export class Juego3MathComponent  {

  @Input() pedidoId!: number;
  @Input() clienteId!: number;

  @Output() juegoTerminado = new EventEmitter<any>();

  questions: MathQuestion[] = [
    { question: '5 + 7 = ?', answer: 12 },
    { question: '12 × 3 = ?', answer: 36 },
    { question: '15 - 8 = ?', answer: 7 },
    { question: '18 ÷ 3 = ?', answer: 6 },
    { question: '9 + 14 = ?', answer: 23 },
    { question: '20 + 14 = ?', answer: 34 },
    { question: '9 × 3 = ?', answer: 27 },
    { question: '24 ÷ 2 = ?', answer: 12 },
    { question: '12 ÷ 2 = ?', answer: 6 },
    { question: '7 × 7 = ?', answer: 49 },
    { question: '60 + 60 = ?', answer: 120 },
    { question: '50 - 25 = ?', answer: 25 },
    { question: '48 ÷ 4 = ?', answer: 12 },
  ];

  currentQuestionIndex: number = 0;
  userAnswer: number | null = null;
  score: number = 0;


  quizFinished: boolean = false;
  showFeedback: boolean = false;
  correctAnswer: boolean = false;

  intentos = 1;      
  finalizado = false; 

  submitAnswer() {
    if (this.userAnswer === null) return;

    this.correctAnswer = this.userAnswer === this.questions[this.currentQuestionIndex].answer;

    if (this.correctAnswer) this.score++;

    this.showFeedback = true;

    // Mostrar la respuesta por 1 segundo antes de pasar
    setTimeout(() => {
      this.currentQuestionIndex++;
      this.userAnswer = null;
      this.showFeedback = false;

      if (this.currentQuestionIndex >= this.questions.length) {
        this.quizFinished = true;
      }
    }, 1000);
  }

  restartQuiz() {
    this.currentQuestionIndex = 0;
    this.userAnswer = null;
    this.score = 0;
    this.quizFinished = false;
    this.showFeedback = false;
    this.correctAnswer = false;

    this.intentos++; //Regustra que hay intentos extra
  }

  terminarJuego() {
    if (!this.quizFinished) return;
    if (!this.quizFinished) return; // evita terminar antes

    this.finalizado = true;

    const gano = this.score >= this.questions.length / 2;
    const descuento = gano ? 10 : 0;
    this.juegoTerminado.emit({
      juego: 'math',
      gano,
      intentos: this.intentos,
      descuentoAplicado: descuento,
    });
 
  }

}

interface MathQuestion {
  question: string;
  answer: number; // respuesta correcta
}
