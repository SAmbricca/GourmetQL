import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import lottie, { AnimationItem } from 'lottie-web';
import { SplashService } from '../../services/splash';

@Component({
  selector: 'app-splash',
  templateUrl: './splash.component.html',
  styleUrls: ['./splash.component.scss'],
  standalone: true,
  imports: [IonContent, CommonModule]
})
export class SplashComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('lottieContainer', { static: true }) lottieContainer!: ElementRef;
  
  private animation!: AnimationItem;
  private animationLoaded = false;

  constructor(
    private router: Router,
    private splashService: SplashService
  ) { }

  async ngOnInit() {
    console.log('Splash component initialized');
  }

  ngAfterViewInit() {
    // Primero carga la animación, luego oculta el splash nativo
    setTimeout(() => {
      this.loadAnimation();
    }, 500);
  }

  loadAnimation() {
    try {
      this.animation = lottie.loadAnimation({
        container: this.lottieContainer.nativeElement,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        path: 'assets/animacion/splash.json'
      });

      this.animation.addEventListener('complete', () => {
        this.animationLoaded = true;
        setTimeout(() => {
          this.navigateToLogin();
        }, 800);
      });

      this.animation.addEventListener('DOMLoaded', async () => {
        await this.splashService.hideSplash();
      });

      setTimeout(() => {
        if (!this.animationLoaded) {
          console.warn('Animation timeout, navigating to login');
          this.navigateToLogin();
        }
      }, 5000);

    } catch (error) {
      console.error('Error loading animation:', error);
      this.navigateToLogin();
    }
  }

  private async navigateToLogin() {
    await this.splashService.hideSplash();
    this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    if (this.animation) {
      this.animation.destroy();
    }
  }
}