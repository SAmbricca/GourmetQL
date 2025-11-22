import { TestBed } from '@angular/core/testing';

import { QrHandler } from './qr-handler';

describe('QrHandler', () => {
  let service: QrHandler;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(QrHandler);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
