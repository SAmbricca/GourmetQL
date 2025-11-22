import { TestBed } from '@angular/core/testing';

import { Mesa } from './mesa';

describe('Mesa', () => {
  let service: Mesa;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Mesa);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
