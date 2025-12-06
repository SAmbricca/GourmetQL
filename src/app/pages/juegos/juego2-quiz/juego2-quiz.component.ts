import { Component,  EventEmitter,  Input,  Output,  signal } from '@angular/core';

@Component({
  selector: 'app-juego2-quiz',
  templateUrl: './juego2-quiz.component.html',
  styleUrls: ['./juego2-quiz.component.scss'],
})
export class Juego2QuizComponent{

  @Input() pedidoId!: number;
  @Input() clienteId!: number;

  @Output() juegoTerminado = new EventEmitter<any>();

  questions: Question[] = [
    { question: '¿Cuál es la capital de Francia?', options: ['Madrid', 'París', 'Berlín', 'Roma'], answer: 1 },
    { question: '¿Dónde está la Tierra del Fuego?', options: ['Brasil', 'Argentina', 'Francia', 'Colombia'], answer: 1 },
    { question: '¿Cuál es el planeta más grande del sistema solar?', options: ['Tierra', 'Júpiter', 'Saturno', 'Marte'], answer: 1 },
    {
      question: '¿Cuál fue la primera película de Disney?',
      options: ['Robin Hood', 'Blancanieves', 'Cenicienta', 'La Dama y el Vagabundo'],
      answer: 1
    },
    {
      question: '¿Cuántos dedos tiene por lo general una caricatura?',
      options: ['3', '5', '4', '6'],
      answer: 2
    },
    {
      question: '¿Quién tiene más balones de oro?',
      options: ['Franz Beckenbauer', 'Michel Platini', 'Cristiano Ronaldo', 'Lionel Messi'],
      answer: 3
    },
    {
      question: '¿Cuántos jugadores componen usualmente un equipo de rugby?',
      options: ['15', '10', '12', '9'],
      answer: 0
    },
    {
      question: '¿Cómo se llama el cangrejo de la película "La sirenita" de Walt Disney?',
      options: ['Doris', 'Daniel', 'Ariel', 'Sebastian'],
      answer: 3
    },
    {
      question: '¿Cuántas veces hay que nombrar a Beetlejuice para que aparezca?',
      options: ['5', '3', '1', '9'],
      answer: 1
    },
    {
      question: '¿Cuál es la capital de Uruguay?',
      options: ['Washington DC', 'Santiago del chile', 'Montevideo', 'Brasilia'],
      answer: 2
    },
    {
      question: '¿En qué provincia de Argentina se encuentra el obelisco?',
      options: ['Chaco', 'Chubut', 'San Luis', 'Buenos Aires'],
      answer: 3
    },
  ];

  currentQuestionIndex = 0;
  selectedOption: number | null = null;
  score = 0;
  quizFinished = false;
  showAnswer: boolean = false;

  intentos = 1;       // Nuevo
  finalizado = false; // Evita repetir envío

  selectOption(index: number) {
    this.selectedOption = index;
  }

  nextQuestion() {
    if (this.selectedOption === null) return; ///AGREGADOOOOOOOOOO
    if (this.selectedOption === this.questions[this.currentQuestionIndex].answer) {
      this.score++;
    }
    // Mostrar la respuesta correcta antes de pasar
    this.showAnswer = true;

    setTimeout(() => {
      this.currentQuestionIndex++;
      this.selectedOption = null;
      this.showAnswer = false;

      if (this.currentQuestionIndex >= this.questions.length) {
        this.quizFinished = true;
      }
    }, 1000); // 1 segundo para mostrar las respuestas
  }

  restartQuiz() {
    this.currentQuestionIndex = 0;
    this.selectedOption = null;
    this.score = 0;
    this.quizFinished = false;
    this.showAnswer = false;
  }

  isCorrect(index: number) {
    return this.questions[this.currentQuestionIndex].answer === index;
  }

  isWrong(index: number) {
    return this.selectedOption === index && !this.isCorrect(index);
  }
  
  terminarJuego() {
    if (this.finalizado) return;
    this.finalizado = true;

    const gano = this.score === this.questions.length;
    const descuento = gano ? 10 : 0;

    this.juegoTerminado.emit({
      juego: 'quiz',
      gano,
      intentos: this.intentos,
      descuentoAplicado: descuento,
    });
  }

}

interface Question {
  question: string;
  options: string[];
  answer: number; // índice de la opción correcta
}