import { TestBed } from '@angular/core/testing';

import { Splash } from './splash';

describe('Splash', () => {
  let service: Splash;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Splash);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
