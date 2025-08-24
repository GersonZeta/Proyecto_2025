import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SeleccionInstitucionesPage } from './seleccion-instituciones.page';

describe('SeleccionInstitucionesPage', () => {
  let component: SeleccionInstitucionesPage;
  let fixture: ComponentFixture<SeleccionInstitucionesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SeleccionInstitucionesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
