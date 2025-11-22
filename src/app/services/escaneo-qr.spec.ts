import { TestBed } from '@angular/core/testing';

import { EscaneoQr } from './escaneo-qr';

describe('EscaneoQr', () => {
  let service: EscaneoQr;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EscaneoQr);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
