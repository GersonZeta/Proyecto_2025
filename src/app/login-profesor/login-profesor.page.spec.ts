import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginProfesorPage } from './login-profesor.page';

describe('LoginProfesorPage', () => {
  let component: LoginProfesorPage;
  let fixture: ComponentFixture<LoginProfesorPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(LoginProfesorPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
