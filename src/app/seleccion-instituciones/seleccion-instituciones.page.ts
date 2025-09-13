// src/app/seleccion-instituciones/seleccion-instituciones.page.ts
import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { environment } from 'src/environments/environment';

interface Profesor {
  idprofesorsaanee: number;
  correo: string;
  nombreprofesorsaanee: string;
  clave: string;
  telefonosaanee: string;
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

  private baseUrl = environment.apiUrl;
  correo: string = '';

  mostrarAlertaSalir: boolean = false;
  isLoading: boolean = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private alertCtrl: AlertController
  ) {}

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
      .get<Profesor[]>(`${this.baseUrl}/instituciones-profesor`, { params: { correo: this.correo } })
      .subscribe({
        next: profs => {
          const prof = profs[0]; // asumimos que correo es único
          if (prof) {
            this.profesor = prof;
            this.cargarInstituciones();
          } else {
            this.isLoading = false;
            this.mostrarAlerta('Error', 'No se encontró información del profesor.');
          }
        },
        error: err => {
          this.isLoading = false;
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

    this.http.get<any[]>(`${this.baseUrl}/instituciones/all`).subscribe({
      next: data => {
        const todas: Institucion[] = (data || []).map(d => ({
          idInstitucionEducativa: d.idinstitucioneducativa ?? d.idInstitucionEducativa,
          NombreInstitucion: d.nombreinstitucion ?? d.NombreInstitucion
        }));

        const profesorInstIds = (this.profesor!.Instituciones || []).map(i => Number(i));
        this.instituciones = todas.filter(inst =>
          profesorInstIds.includes(Number(inst.idInstitucionEducativa))
        );

        this.isLoading = false;
      },
      error: err => {
        this.isLoading = false;
        console.error('Error cargarInstituciones:', err);
        this.mostrarAlerta('Error', 'No se pudieron cargar instituciones.');
      }
    });
  }

  irAEstudiantes(inst: Institucion) {
    localStorage.setItem('idInstitucionEducativa', inst.idInstitucionEducativa.toString());
    this.router.navigate(['/estudiantes']);
  }

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

  private async mostrarAlerta(header: string, message: string) {
    const a = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await a.present();
  }
}
