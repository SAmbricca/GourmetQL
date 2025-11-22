import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ConsultaMozoAdminComponent } from './consulta-mozo-admin.component';

describe('ConsultaMozoAdminComponent', () => {
  let component: ConsultaMozoAdminComponent;
  let fixture: ComponentFixture<ConsultaMozoAdminComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ ConsultaMozoAdminComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(ConsultaMozoAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
