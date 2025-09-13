// src/app/seleccion-instituciones/seleccion-instituciones.page.ts
import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { environment } from 'src/environments/environment'; // <- import agregado

interface Profesor {
  idProfesor: number;
  Correo: string;
  NombreProfesor: string;
  TelefonoProf: string;
  Instituciones: number[];
}

interface Institucion {
  idInstitucionEducativa: number;
  NombreInstitucion: string;
}

@Component({
  selector: 'app-seleccion-instituciones',
  templateUrl: './seleccion-instituciones.page.html',
  styleUrls: ['./seleccion-instituciones.page.scss'],
  standalone: false,
})
export class SeleccionInstitucionesPage {
  profesor: Profesor | null = null;
  instituciones: Institucion[] = [];

  // usa environment.apiUrl para que funcione en local y en Vercel
  private baseUrl = environment.apiUrl;

  correo: string = '';
  mostrarAlertaSalir: boolean = false;
  isLoading: boolean = false; // control de carga

  constructor(
    private http: HttpClient,
    private router: Router,
    private alertCtrl: AlertController
  ) {}

  // Se ejecuta cada vez que se entra en la vista
  ionViewWillEnter() {
    this.mostrarAlertaSalir = false;
    this.correo = localStorage.getItem('profesorCorreo') || '';

    if (this.correo) {
      this.buscarProfesor();
    } else {
      this.profesor = null;
      this.instituciones = [];
    }
  }

  private buscarProfesor() {
    this.isLoading = true;
    this.profesor = null;
    this.instituciones = [];

    this.http
      .get<Profesor>(`${this.baseUrl}/instituciones-profesor`, {
        params: { correo: this.correo }
      })
      .subscribe({
        next: data => {
          // Guardamos datos del profesor tal cual vienen del servidor
          this.profesor = data;
          // Cargamos las instituciones asociadas (normalizando campos)
          this.cargarInstituciones();
        },
        error: err => {
          this.isLoading = false;
          this.profesor = null;
          this.instituciones = [];
          console.error('Error buscarProfesor:', err);
          this.mostrarAlerta('Error', 'No se pudo obtener datos del profesor.');
        }
      });
  }

  private cargarInstituciones() {
    if (!this.profesor) {
      this.isLoading = false;
      return;
    }

    this.http.get<any[]>(`${this.baseUrl}/instituciones-all`)
      .subscribe({
        next: data => {
          // Normalizar campos del servidor (snake_case) a los que usa el cliente (camelCase)
          const todas: Institucion[] = (data || []).map(d => ({
            idInstitucionEducativa: d.idinstitucioneducativa ?? d.idInstitucionEducativa,
            NombreInstitucion: d.nombreinstitucion ?? d.NombreInstitucion
          }));

          // Filtrar solo las instituciones que pertenecen al profesor
          this.instituciones = todas.filter(inst =>
            this.profesor!.Instituciones.includes(inst.idInstitucionEducativa)
          );

          this.isLoading = false;
        },
        error: err => {
          this.isLoading = false;
          this.instituciones = [];
          console.error('Error cargarInstituciones:', err);
          this.mostrarAlerta('Error', 'No se pudieron cargar instituciones.');
        }
      });
  }

  irAEstudiantes(inst: Institucion) {
    localStorage.setItem('idInstitucionEducativa', inst.idInstitucionEducativa.toString());
    this.router.navigate(['/estudiantes']);
  }

  // ALERTA PERSONALIZADA “SALIR” (overlay propio)
  abrirAlertaSalir() {
    this.mostrarAlertaSalir = true;
  }

  cerrarAlertaSalir() {
    this.mostrarAlertaSalir = false;
  }

  confirmarSalir() {
    localStorage.removeItem('profesorCorreo');
    localStorage.removeItem('idInstitucionEducativa');
    this.router.navigate(['/home']);
  }

  // Para usar alertas nativas de Ionic (por si prefieres)
  private async mostrarAlerta(header: string, message: string) {
    const a = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await a.present();
  }
}
