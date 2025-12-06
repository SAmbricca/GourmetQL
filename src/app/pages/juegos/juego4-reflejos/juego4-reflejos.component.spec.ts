import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { Juego4ReflejosComponent } from './juego4-reflejos.component';

describe('Juego4ReflejosComponent', () => {
  let component: Juego4ReflejosComponent;
  let fixture: ComponentFixture<Juego4ReflejosComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ Juego4ReflejosComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(Juego4ReflejosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
