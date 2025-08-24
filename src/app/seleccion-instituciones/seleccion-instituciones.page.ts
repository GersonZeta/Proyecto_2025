// --------------------------------------------
// seleccion-instituciones.page.ts (completo)
// --------------------------------------------
import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';

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
  private baseUrl = 'http://localhost:3000';
  correo: string = '';

  // Para la ventana de “Confirmar Salir”
  mostrarAlertaSalir: boolean = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private alertCtrl: AlertController
  ) {}

  ionViewWillEnter() {
    // Restablecer la alerta de “Salir” cada vez que volvemos a esta página
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
    this.http
      .get<Profesor>(`${this.baseUrl}/instituciones-profesor`, {
        params: { correo: this.correo }
      })
      .subscribe(
        data => {
          this.profesor = data;
          this.cargarInstituciones();
        },
        () => this.mostrarAlerta('Error', 'No se pudo obtener datos del profesor.')
      );
  }

  private cargarInstituciones() {
    if (!this.profesor) { return; }
    this.http.get<Institucion[]>(`${this.baseUrl}/instituciones-all`)
      .subscribe(
        data => {
          this.instituciones = data.filter(inst =>
            this.profesor!.Instituciones.includes(inst.idInstitucionEducativa)
          );
        },
        () => this.mostrarAlerta('Error', 'No se pudieron cargar instituciones.')
      );
  }

  irAEstudiantes(inst: Institucion) {
    localStorage.setItem('idInstitucionEducativa', inst.idInstitucionEducativa.toString());
    this.router.navigate(['/estudiantes']);
  }

  // ALERTA PERSONALIZADA “SALIR”
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

  // PARA MOSTRAR ALERTAS NATIVAS (errores HTTP, etc.)
  private async mostrarAlerta(header: string, message: string) {
    const a = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await a.present();
  }
}
