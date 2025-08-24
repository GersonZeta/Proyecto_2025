import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FamiliasPage } from './familias.page';

describe('FamiliasPage', () => {
  let component: FamiliasPage;
  let fixture: ComponentFixture<FamiliasPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(FamiliasPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
