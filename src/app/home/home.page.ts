// src/app/home/home.page.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment'; // <- import agregado

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

  // usa environment.apiUrl para que funcione en local y en Vercel
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient, private router: Router) {}

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
      `${this.baseUrl}/login-admin`, { correo, clave }
    ).subscribe({
      next: r => {
        if (r.ok) {
          this.limpiarCampos();
          this.router.navigate(['/login-profesor']);
        } else {
          // Si falla como admin, intentar como PROFESOR SAANEE
          if (!nombre) {
            this.errorMensaje = 'Falta nombre del profesor';
            return;
          }
          this.http.get<any>(
            `${this.baseUrl}/instituciones-profesor`,
            { params: { correo } }
          ).subscribe({
            next: prof => {
              if (
                prof.NombreProfesor === nombre &&
                prof.Clave === clave
              ) {
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

  verificarAdminAntesDeCrearCuenta() {
    this.mostrarAlertaAdmin = false;
    this.mostrarAlertaLoginAdmin = false;

    this.http.get<{ existe: boolean }>(`${this.baseUrl}/existe-admin`)
      .subscribe({
        next: r => r.existe
          ? this.mostrarAlertaLoginAdmin = true
          : this.mostrarAlertaAdmin = true,
        error: () => this.errorMensaje = 'Error verificando administrador'
      });
  }

  registrarAdmin() {
    this.errorAdmin = '';
    const c = this.correoAdmin.trim(), k = this.claveAdmin.trim();
    if (!c || !k) { this.errorAdmin = 'Completa ambos campos'; return; }
    this.http.post<{ ok: boolean; mensaje?: string }>(
      `${this.baseUrl}/registrar-admin`,
      { correo: c, clave: k }
    ).subscribe({
      next: r => {
        if (r.ok) {
          this.cerrarAlertaAdmin();
          // Limpio los inputs del admin
          this.correoAdmin = '';
          this.claveAdmin = '';

          // **Antes tenías esto y es la causa de que se copie en los inputs principales:**
          // this.correo = c;
          // this.clave  = k;
        } else {
          this.errorAdmin = r.mensaje || 'No se pudo registrar';
        }
      },
      error: () => this.errorAdmin = 'Error al conectar con el servidor'
    });
  }

  loginAdmin() {
    this.errorAdmin = '';
    const c = this.correoAdmin.trim(), k = this.claveAdmin;
    if (!c || !k) { this.errorAdmin = 'Falta correo o clave'; return; }
    this.http.post<{ ok: boolean; mensaje?: string }>(
      `${this.baseUrl}/login-admin`,
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

  enviarCorreoReset() {
    if (!this.correoReset.trim()) {
      this.errorReset = 'Ingresa tu correo';
      return;
    }
    this.http.post<{ ok: boolean; mensaje?: string }>(
      `${this.baseUrl}/solicitar-reset`,
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

  confirmarReset() {
    if (!this.tokenReset.trim() || !this.nuevaClave) {
      this.errorReset = 'Ingresa token y nueva clave';
      return;
    }
    this.http.post<{ ok: boolean; mensaje?: string }>(
      `${this.baseUrl}/reset-security-code`,
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
