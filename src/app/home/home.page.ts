// src/app/home/home.page.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { AlertController } from '@ionic/angular';

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

  correoReset = '';
  tokenReset = '';
  nuevaClave = '';
  errorReset = '';
  pasoReset = 1;

  private baseUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private router: Router,
    private alertController: AlertController
  ) {}

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

  limpiarCampos() {
    this.correo = '';
    this.nombreProfesor = '';
    this.clave = '';
  }

  // --- ALERTA CREAR / LOGIN ADMIN
  async verificarAdminAntesDeCrearCuenta() {
    try {
      const r = await this.http.get<{ existe: boolean }>(
        `${this.baseUrl}/admin?action=existe`
      ).toPromise();

      if (r?.existe) {
        await this.abrirLoginAdmin();
      } else {
        await this.abrirRegistrarAdmin();
      }
    } catch (e) {
      this.errorMensaje = 'Error verificando administrador';
      console.error(e);
    }
  }

  async abrirRegistrarAdmin() {
    const alert = await this.alertController.create({
      header: 'Registrar Administrador',
      inputs: [
        { name: 'correo', type: 'email', placeholder: 'Correo' },
        { name: 'clave', type: 'password', placeholder: 'Clave' }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Registrar', handler: data => this.registrarAdmin(data) }
      ]
    });
    await alert.present();
  }

  async abrirLoginAdmin() {
    const alert = await this.alertController.create({
      header: 'Login Administrador',
      inputs: [
        { name: 'correo', type: 'email', placeholder: 'Correo' },
        { name: 'clave', type: 'password', placeholder: 'Clave' }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Ingresar', handler: data => this.loginAdmin(data) }
      ]
    });
    await alert.present();
  }

  // --- REGISTRAR ADMIN
  registrarAdmin(data: { correo: string; clave: string }) {
    const correo = data.correo?.trim();
    const clave = data.clave?.trim();
    if (!correo || !clave) return;

    this.http.post<{ ok: boolean; mensaje?: string }>(
      `${this.baseUrl}/admin?action=registrar`,
      { correo, clave }
    ).subscribe({
      next: r => {
        if (r.ok) {
          console.log('Admin registrado');
        } else {
          console.error(r.mensaje);
        }
      },
      error: e => console.error('Error registrar admin', e)
    });
  }

  // --- LOGIN ADMIN
  loginAdmin(data: { correo: string; clave: string }) {
    const correo = data.correo?.trim();
    const clave = data.clave;
    if (!correo || !clave) return;

    this.http.post<{ ok: boolean; mensaje?: string }>(
      `${this.baseUrl}/admin?action=login`,
      { correo, clave }
    ).subscribe({
      next: r => {
        if (r.ok) {
          this.limpiarCampos();
          this.router.navigate(['/login-profesor']);
        } else {
          console.error(r.mensaje);
        }
      },
      error: e => console.error('Error login admin', e)
    });
  }

  // --- RESET CLAVE
  abrirAlertaReset() {
    this.pasoReset = 1;
    this.errorReset = '';
    this.correoReset = '';
    this.tokenReset = '';
    this.nuevaClave = '';
    this.mostrarResetPrompt();
  }

  async mostrarResetPrompt() {
    if (this.pasoReset === 1) {
      const alert = await this.alertController.create({
        header: 'Resetear Clave - Paso 1',
        inputs: [
          { name: 'correo', type: 'email', placeholder: 'Correo' }
        ],
        buttons: [
          { text: 'Cancelar', role: 'cancel' },
          { text: 'Aceptar', handler: data => this.enviarCorreoReset(data.correo) }
        ]
      });
      await alert.present();
    } else if (this.pasoReset === 2) {
      const alert = await this.alertController.create({
        header: 'Resetear Clave - Paso 2',
        inputs: [
          { name: 'token', type: 'text', placeholder: 'Token' },
          { name: 'nuevaClave', type: 'password', placeholder: 'Nueva clave' }
        ],
        buttons: [
          { text: 'Cancelar', role: 'cancel' },
          { text: 'Aceptar', handler: data => this.confirmarReset(data.token, data.nuevaClave) }
        ]
      });
      await alert.present();
    }
  }

  enviarCorreoReset(correo: string) {
    if (!correo?.trim()) return;
    this.http.post<{ ok: boolean; mensaje?: string }>(
      `${this.baseUrl}/admin?action=solicitar-reset`,
      { correo: correo.trim() }
    ).subscribe({
      next: r => {
        if (r.ok) {
          this.pasoReset = 2;
          this.mostrarResetPrompt();
        } else {
          console.error(r.mensaje);
        }
      },
      error: e => console.error(e)
    });
  }

  confirmarReset(token: string, nuevaClave: string) {
    if (!token || !nuevaClave) return;
    this.http.post<{ ok: boolean; mensaje?: string }>(
      `${this.baseUrl}/admin?action=reset-security-code`,
      { correo: this.correoReset.trim(), token, nuevaClave }
    ).subscribe({
      next: r => {
        if (r.ok) console.log('Clave cambiada con éxito');
        else console.error(r.mensaje);
      },
      error: e => console.error(e)
    });
  }
}
