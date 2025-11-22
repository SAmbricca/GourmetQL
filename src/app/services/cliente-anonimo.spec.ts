import { TestBed } from '@angular/core/testing';

import { ClienteAnonimo } from './cliente-anonimo';

describe('ClienteAnonimo', () => {
  let service: ClienteAnonimo;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ClienteAnonimo);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
