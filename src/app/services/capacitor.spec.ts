import { TestBed } from '@angular/core/testing';

import { Capacitor } from './capacitor';

describe('Capacitor', () => {
  let service: Capacitor;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Capacitor);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
