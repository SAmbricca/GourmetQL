import { TestBed } from '@angular/core/testing';

import { Consulta } from './consulta';

describe('Consulta', () => {
  let service: Consulta;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Consulta);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
