import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { HomeAnonimoComponent } from './home-anonimo.component';

describe('HomeAnonimoComponent', () => {
  let component: HomeAnonimoComponent;
  let fixture: ComponentFixture<HomeAnonimoComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ HomeAnonimoComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeAnonimoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
