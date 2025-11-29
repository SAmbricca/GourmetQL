import { TestBed } from '@angular/core/testing';

import { Delivery } from './delivery';

describe('Delivery', () => {
  let service: Delivery;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Delivery);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
