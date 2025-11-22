import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { MesaOpcionesComponent } from './mesa-opciones.component';

describe('MesaOpcionesComponent', () => {
  let component: MesaOpcionesComponent;
  let fixture: ComponentFixture<MesaOpcionesComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ MesaOpcionesComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(MesaOpcionesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
