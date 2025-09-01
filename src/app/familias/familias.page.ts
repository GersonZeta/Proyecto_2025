// src/app/familias/familias.page.ts
import { Component } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AlertController, NavController } from '@ionic/angular';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import autoTable from 'jspdf-autotable';
import jsPDF from 'jspdf';

export interface Familia {
  idFamilia?: number;
  idEstudiante: number | null;
  NombreEstudiante?: string;
  NombreMadreApoderado: string;
  DNI: string;
  Direccion?: string;
  Telefono?: string;
  Ocupacion?: string;
  displayId?: number;
}

@Component({
  selector: 'app-familias',
  templateUrl: './familias.page.html',
  styleUrls: [
    './familias.page.scss',
   './familias.page2.scss'
  ],
  standalone: false,
})
export class FamiliasPage {
  private baseUrl = 'http://localhost:3000';
  private idInstitucionEducativa = 0;

  familias: Familia[] = [];
  familiasFiltradas: Familia[] = [];
  estudiantes: { idEstudiante: number; ApellidosNombres: string }[] = [];
  asignados: number[] = [];

  datosCargados = false;
  seleccionMultiple = false;
  busquedaMadre = '';
  familia: Familia = {
    idEstudiante: null,
    NombreMadreApoderado: '',
    DNI: '',
    Direccion: '',
    Telefono: '',
    Ocupacion: ''
  };

  // Para modal de Estudiantes
  showStudentsModal = false;
  allStudents: Array<{ idEstudiante: number; ApellidosNombres: string; selected?: boolean }> = [];
  filteredStudents: typeof this.allStudents = [];
  studentFilter = '';
  selectedStudentNames = '';

  // Overlays
  mostrarAlertaExportar = false;
  mostrarErrorCampos = false;

  constructor(
    private http: HttpClient,
    private alertCtrl: AlertController,
    private navCtrl: NavController,
  ) {}

  ionViewWillEnter(): void {
    const stored = localStorage.getItem('idInstitucionEducativa');
    this.idInstitucionEducativa = stored ? +stored : 0;
    if (!this.idInstitucionEducativa) {
      this.mostrarAlerta('Error', 'Primero selecciona una institución.');
      this.navCtrl.navigateRoot('/seleccion-instituciones');
      return;
    }
    this.resetForm();
    this.cargarEstudiantes();
    this.cargarAsignados();
    this.cargarFamilias();
  }

  private cargarEstudiantes(): void {
    const params = new HttpParams().set('idInstitucionEducativa', this.idInstitucionEducativa.toString());
    this.http.get<{ idEstudiante: number; ApellidosNombres: string }[]>(
      `${this.baseUrl}/estudiantes`, { params }
    ).subscribe(list => this.estudiantes = list);
  }

  private cargarAsignados(): void {
    const params = new HttpParams().set('idInstitucionEducativa', this.idInstitucionEducativa.toString());
    this.http.get<number[]>(
      `${this.baseUrl}/estudiantes-con-familia`, { params }
    ).subscribe(ids => this.asignados = ids);
  }

  private cargarFamilias(): void {
    const params = new HttpParams().set('idInstitucionEducativa', this.idInstitucionEducativa.toString());
    this.http.get<Familia[]>(
      `${this.baseUrl}/familias-estudiante`, { params }
    ).subscribe(list => {
      this.familias = list.map((f, i) => ({ ...f, displayId: i + 1 }));
      this.familiasFiltradas = [...this.familias];
    });
  }

  get estudiantesDisponibles() {
    return this.estudiantes.filter(e => !this.asignados.includes(e.idEstudiante));
  }

  validateNumber(evt: KeyboardEvent): void {
    if (!/[0-9]/.test(evt.key)) evt.preventDefault();
  }

  validateLetters(evt: KeyboardEvent): void {
    if (!/[a-zA-ZñÑáéíóúÁÉÍÓÚ ]/.test(evt.key)) evt.preventDefault();
  }

  formatTelefono(event: any): void {
    const val = event.detail.value.replace(/[^0-9]/g, '').slice(0, 9);
    const parts: string[] = [];
    for (let i = 0; i < val.length; i += 3) parts.push(val.substring(i, i + 3));
    this.familia.Telefono = parts.join('-');
  }

  buscarFamilia(): void {
    this.seleccionMultiple = false;
    this.datosCargados = false;

    const raw = this.busquedaMadre.trim();
    if (!raw) {
      this.mostrarAlerta('Error', 'Ingresa parte del nombre de la Madre/Apoderado');
      return;
    }

    const normalize = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const query = normalize(raw);

    const matches = this.familias.filter(f =>
      normalize(f.NombreMadreApoderado).startsWith(query)
    );

    if (matches.length === 0) {
      this.mostrarAlerta('Error', 'No hay familias con ese nombre.');
      return;
    }

    this.familiasFiltradas = matches;
    if (matches.length > 1) {
      this.seleccionMultiple = true;
      return;
    }
    const f = matches[0];
    this.familia = { ...f };
    this.datosCargados = true;
    this.asignados = this.asignados.filter(id => id !== f.idEstudiante!);
  }

  seleccionarFamilia(f: Familia): void {
    this.familia = { ...f };
    this.datosCargados = true;
    this.asignados = this.asignados.filter(id => id !== f.idEstudiante!);
  }

  validarYRegistrar(): void {
    if (
      this.familia.idEstudiante == null ||
      !this.familia.NombreMadreApoderado.trim() ||
      !this.familia.DNI.trim()
    ) {
      this.mostrarErrorCampos = true;
      return;
    }
    this.registrarFamilia();
  }

  registrarFamilia(): void {
    this.http.post<{ idFamilia: number }>(
      `${this.baseUrl}/registrar-familia`,
      { ...this.familia, idInstitucionEducativa: this.idInstitucionEducativa }
    ).subscribe({
      next: res => {
        this.mostrarAlerta('Éxito', `Familia ID ${res.idFamilia} registrada`);
        this.asignados.push(this.familia.idEstudiante!);
        this.reloadAll();
      },
      error: err => this.mostrarAlerta('Error', err.error?.error || 'No fue posible registrar')
    });
  }

  actualizarFamilia(): void {
    if (!this.familia.idFamilia) return;
    this.http.put(
      `${this.baseUrl}/actualizar-familia`,
      { ...this.familia, idInstitucionEducativa: this.idInstitucionEducativa }
    ).subscribe({
      next: () => {
        this.mostrarAlerta('Éxito', 'Familia actualizada con éxito');
        this.reloadAll();
      },
      error: err => this.mostrarAlerta('Error', err.error?.error || 'No fue posible actualizar')
    });
  }

  async confirmEliminar(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Confirmación',
      message: '¿Estás seguro de eliminar esta familia?',
      buttons: [
        { text: 'No', role: 'cancel' },
        { text: 'Sí', handler: () => this.eliminarFamilia() }
      ]
    });
    await alert.present();
  }

  private eliminarFamilia(): void {
    if (!this.familia.idFamilia) return;
    this.http.delete<{ message: string }>(
      `${this.baseUrl}/eliminar-familia/${this.familia.idFamilia}`
    ).subscribe({
      next: res => {
        this.mostrarAlerta('Éxito', res.message || 'Familia eliminada');
        this.resetForm();
        this.cargarFamilias();
        this.cargarAsignados();
      },
      error: err => this.mostrarAlerta('Error', err.error?.error || 'No fue posible eliminar')
    });
  }

  // ——— Métodos para el modal de Estudiantes ———

  openStudentsModal(): void {
    // 1) Estudiantes ya asignados a esta familia
    const asignadosAFamilia = this.estudiantes
      .filter(e => this.familia.idEstudiante === e.idEstudiante)
      .map(e => ({ ...e, selected: true }));
    // 2) Estudiantes disponibles
    const sinAsignar = this.estudiantes
      .filter(e => !this.asignados.includes(e.idEstudiante))
      .map(e => ({ ...e, selected: false }));
    this.allStudents = [...asignadosAFamilia, ...sinAsignar];
    this.filteredStudents = [...this.allStudents];
    this.studentFilter = '';
    this.showStudentsModal = true;
  }

  filterStudents(): void {
    const txt = this.studentFilter.trim().toLowerCase();
    this.filteredStudents = this.allStudents.filter(s =>
      s.ApellidosNombres.toLowerCase().includes(txt)
    );
  }

  closeStudentsModal(): void {
    this.showStudentsModal = false;
  }

  applyStudentsSelection(): void {
    const seleccionados = this.allStudents.filter(s => s.selected).map(s => s.idEstudiante);
    // Asignar el primero (es solo uno)
    this.familia.idEstudiante = seleccionados.length ? seleccionados[0] : null;
    this.selectedStudentNames = this.allStudents
      .filter(s => s.selected)
      .map(s => s.ApellidosNombres)
      .join(', ');
    this.closeStudentsModal();
  }

  // Overlays Exportar / Error
  showExportOptions(): void {
    this.mostrarAlertaExportar = true;
  }
  cerrarAlertaExportar(): void {
    this.mostrarAlertaExportar = false;
  }
  exportExcel(): void {
    const data = this.familiasFiltradas.map(f => ({
      ID: f.displayId,
      Estudiante: f.NombreEstudiante ?? '',
      Madre: f.NombreMadreApoderado,
      DNI: f.DNI,
      Dirección: f.Direccion ?? '',
      Teléfono: f.Telefono ?? '',
      Ocupación: f.Ocupacion ?? ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Familias');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), 'familias.xlsx');
  }
  exportPDF(): void {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    autoTable(doc, {
      head: [['ID','Estudiante','Madre/Apoderado','DNI','Dirección','Teléfono','Ocupación']],
      body: this.familiasFiltradas.map(f => [
        f.displayId?.toString() ?? '',
        f.NombreEstudiante ?? '',
        f.NombreMadreApoderado,
        f.DNI,
        f.Direccion ?? '',
        f.Telefono ?? '',
        f.Ocupacion ?? ''
      ]),
      startY: 40
    });
    doc.save('familias.pdf');
  }

  cerrarErrorCampos(): void {
    this.mostrarErrorCampos = false;
  }

  private reloadAll(): void {
    this.resetForm();
    this.cargarFamilias();
    this.cargarAsignados();
  }

  resetForm(): void {
    this.familia = {
      idEstudiante: null,
      NombreMadreApoderado: '',
      DNI: '',
      Direccion: '',
      Telefono: '',
      Ocupacion: ''
    };
    this.datosCargados = false;
    this.seleccionMultiple = false;
    this.busquedaMadre = '';
    this.familiasFiltradas = [...this.familias];
    this.selectedStudentNames = '';
  }

  private async mostrarAlerta(header: string, message: string) {
    const alert = await this.alertCtrl.create({ header, message, buttons: ['OK'] });
    await alert.present();
  }
}
