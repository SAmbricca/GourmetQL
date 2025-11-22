import { TestBed } from '@angular/core/testing';

import { ListaEspera } from './lista-espera';

describe('ListaEspera', () => {
  let service: ListaEspera;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ListaEspera);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
