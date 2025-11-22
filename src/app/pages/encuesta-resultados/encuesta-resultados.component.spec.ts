import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { EncuestaResultadosComponent } from './encuesta-resultados.component';

describe('EncuestaResultadosComponent', () => {
  let component: EncuestaResultadosComponent;
  let fixture: ComponentFixture<EncuestaResultadosComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ EncuestaResultadosComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(EncuestaResultadosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
