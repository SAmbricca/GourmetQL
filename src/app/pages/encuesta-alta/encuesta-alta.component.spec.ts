import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { EncuestaAltaComponent } from './encuesta-alta.component';

describe('EncuestaAltaComponent', () => {
  let component: EncuestaAltaComponent;
  let fixture: ComponentFixture<EncuestaAltaComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ EncuestaAltaComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(EncuestaAltaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
