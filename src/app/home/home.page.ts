// src/app/home/home.page.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false
})
export class HomePage {
  correo = '';
  nombreProfesor = '';
  clave = '';
  errorMensaje = '';

  correoAdmin = '';
  claveAdmin = '';
  errorAdmin = '';
  mostrarAlertaAdmin = false;
  mostrarAlertaLoginAdmin = false;

  mostrarAlertaReset = false;
  pasoReset = 1;
  correoReset = '';
  tokenReset = '';
  nuevaClave = '';
  errorReset = '';

  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient, private router: Router) {}

  // --- LOGIN PROFESOR / ADMIN
  ingresar() {
    this.errorMensaje = '';
    const correo = this.correo.trim();
    const clave = this.clave;
    const nombre = this.nombreProfesor.trim();

    if (!correo || !clave) {
      this.errorMensaje = 'Falta correo o clave';
      return;
    }

    // Intentar login como ADMIN
    this.http.post<{ ok: boolean; mensaje?: string }>(
      `${this.baseUrl}/admin?action=login`,
      { correo, clave }
    ).subscribe({
      next: r => {
        if (r.ok) {
          this.limpiarCampos();
          this.router.navigate(['/login-profesor']);
        } else {
          // Intentar como PROFESOR SAANEE
          if (!nombre) {
            this.errorMensaje = 'Falta nombre del profesor';
            return;
          }
          this.http.get<any>(
            `${this.baseUrl}/instituciones-profesor`,
            { params: { correo } }
          ).subscribe({
            next: prof => {
              if (prof.NombreProfesor === nombre && prof.Clave === clave) {
                localStorage.setItem('profesorCorreo', correo);
                this.limpiarCampos();
                this.router.navigate(['/seleccion-instituciones']);
              } else {
                this.errorMensaje = 'Datos de profesor incorrectos';
              }
            },
            error: () => this.errorMensaje = 'Datos de profesor incorrectos'
          });
        }
      },
      error: () => this.errorMensaje = 'Error al conectar con el servidor'
    });
  }

  // --- VERIFICAR SI EXISTE ADMIN
  verificarAdminAntesDeCrearCuenta() {
    this.mostrarAlertaAdmin = false;
    this.mostrarAlertaLoginAdmin = false;

    this.http.get<{ existe: boolean }>(`${this.baseUrl}/admin?action=existe`)
      .subscribe({
        next: r => r.existe
          ? this.mostrarAlertaLoginAdmin = true
          : this.mostrarAlertaAdmin = true,
        error: () => this.errorMensaje = 'Error verificando administrador'
      });
  }

  // --- REGISTRAR ADMIN
  registrarAdmin() {
    this.errorAdmin = '';
    const c = this.correoAdmin.trim(), k = this.claveAdmin.trim();
    if (!c || !k) { this.errorAdmin = 'Completa ambos campos'; return; }

    this.http.post<{ ok: boolean; mensaje?: string }>(
      `${this.baseUrl}/admin?action=registrar`,
      { correo: c, clave: k }
    ).subscribe({
      next: r => {
        if (r.ok) {
          this.cerrarAlertaAdmin();
          this.correoAdmin = '';
          this.claveAdmin = '';
        } else {
          this.errorAdmin = r.mensaje || 'No se pudo registrar';
        }
      },
      error: () => this.errorAdmin = 'Error al conectar con el servidor'
    });
  }

  // --- LOGIN ADMIN DESDE ALERTA
  loginAdmin() {
    this.errorAdmin = '';
    const c = this.correoAdmin.trim(), k = this.claveAdmin;
    if (!c || !k) { this.errorAdmin = 'Falta correo o clave'; return; }

    this.http.post<{ ok: boolean; mensaje?: string }>(
      `${this.baseUrl}/admin?action=login`,
      { correo: c, clave: k }
    ).subscribe({
      next: r => {
        if (r.ok) {
          this.cerrarAlertaLoginAdmin();
          this.correoAdmin = '';
          this.claveAdmin = '';
          this.limpiarCampos();
          this.router.navigate(['/login-profesor']);
        } else {
          this.errorAdmin = r.mensaje || 'Credenciales inválidas';
        }
      },
      error: () => this.errorAdmin = 'Error al conectar con el servidor'
    });
  }

  limpiarCampos() {
    this.correo = '';
    this.nombreProfesor = '';
    this.clave = '';
  }

  abrirAlertaReset() {
    this.mostrarAlertaReset = true;
    this.pasoReset = 1;
    this.errorReset = '';
    this.correoReset = '';
    this.tokenReset = '';
    this.nuevaClave = '';
  }

  cerrarAlertaReset() { this.mostrarAlertaReset = false; }
  cerrarAlertaAdmin() { this.mostrarAlertaAdmin = false; }
  cerrarAlertaLoginAdmin() { this.mostrarAlertaLoginAdmin = false; }

  // --- RESET: solicitar token
  enviarCorreoReset() {
    if (!this.correoReset.trim()) {
      this.errorReset = 'Ingresa tu correo';
      return;
    }

    this.http.post<{ ok: boolean; mensaje?: string }>(
      `${this.baseUrl}/admin?action=solicitar-reset`,
      { correo: this.correoReset.trim() }
    ).subscribe({
      next: r => {
        if (r.ok) {
          this.pasoReset = 2;
          this.errorReset = '';
        } else {
          this.errorReset = r.mensaje || 'No se pudo generar token';
        }
      },
      error: () => this.errorReset = 'Error al conectar con el servidor'
    });
  }

  // --- RESET: confirmar token y nueva clave
  confirmarReset() {
    if (!this.tokenReset.trim() || !this.nuevaClave) {
      this.errorReset = 'Ingresa token y nueva clave';
      return;
    }

    this.http.post<{ ok: boolean; mensaje?: string }>(
      `${this.baseUrl}/admin?action=reset-security-code`,
      {
        correo: this.correoReset.trim(),
        token: this.tokenReset.trim(),
        nuevaClave: this.nuevaClave
      }
    ).subscribe({
      next: r => {
        if (r.ok) {
          this.cerrarAlertaReset();
        } else {
          this.errorReset = r.mensaje || 'Token inválido o expirado';
        }
      },
      error: () => this.errorReset = 'Error al conectar con el servidor'
    });
  }
}
