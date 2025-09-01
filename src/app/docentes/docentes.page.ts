import { Component } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AlertController, ActionSheetController, NavController } from '@ionic/angular';
import { forkJoin } from 'rxjs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import autoTable from 'jspdf-autotable';
import jsPDF from 'jspdf';

interface Student {
  idEstudiante: number;
  ApellidosNombres: string;
  idInstitucionEducativa: number;
  selected?: boolean;
}

interface DocenteForm {
  idDocente?: number;
  DNIDocente: string;
  NombreDocente: string;
  Email: string;
  Telefono?: string;
  GradoSeccionLabora?: string;
  idEstudiante: number[];
}

interface SearchResponse {
  DNIDocente: string;
  NombreDocente: string;
  Email: string;
  Telefono?: string;
  GradoSeccionLabora?: string;
  idEstudiante: number[];
}

export interface DocenteView {
  idDocente: number;
  idEstudiante: number;
  NombreEstudiante: string;
  NombreDocente: string;
  DNIDocente: string;
  Email: string;
  Telefono?: string;
  GradoSeccionLabora?: string;
  displayId: number;
}

@Component({
  selector: 'app-docentes',
  templateUrl: './docentes.page.html',
  styleUrls: [
    './docentes.page.scss',
  './docentes.page2.scss',
'./docentes.page3.scss'],
  standalone: false,
})
export class DocentesPage {
  private baseUrl = 'http://localhost:3000';
  private idInstitucionEducativa = 0;

  docentes: DocenteView[] = [];
  docentesFiltrados: DocenteView[] = [];
  estudiantes: Student[] = [];
  allAsignados: number[] = [];
  asignados: number[] = [];

  showStudentsModal = false;
  studentFilter = '';
  allStudents: Student[] = [];
  filteredStudents: Student[] = [];

  datosCargados = false;
  buscandoDocente = false;
    mostrarAlertaExportar = false;
  mostrarErrorCampos = false;

  nombreBusqueda = '';
  docente: DocenteForm = {
    DNIDocente: '',
    NombreDocente: '',
    Email: '',
    Telefono: '',
    GradoSeccionLabora: '',
    idEstudiante: []
  };
  selectedStudentNames = '';

  emailInvalid = false;
  private emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(
    private http: HttpClient,
    private alertCtrl: AlertController,
    private actionSheetCtrl: ActionSheetController,
    private navCtrl: NavController
  ) {}
  cerrarAlertaExportar(): void {
    this.mostrarAlertaExportar = false;
  }

  cerrarErrorCampos(): void {
    this.mostrarErrorCampos = false;
  }

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
    this.cargarAsignadosGlobal();
    this.cargarDocentes();
  }

  private cargarDocentes(): void {
    const params = new HttpParams().set('idInstitucionEducativa', this.idInstitucionEducativa.toString());
    this.http.get<DocenteView[]>(`${this.baseUrl}/docentes-estudiante`, { params })
      .subscribe(list => {
        this.docentes = list.map((d, i) => ({ ...d, displayId: i + 1 }));
        this.docentesFiltrados = [...this.docentes];
      });
  }

  private cargarEstudiantes(): void {
    const params = new HttpParams().set('idInstitucionEducativa', this.idInstitucionEducativa.toString());
    this.http.get<Student[]>(`${this.baseUrl}/estudiantes`, { params })
      .subscribe(list => this.estudiantes = list);
  }

  private cargarAsignadosGlobal(): void {
    const params = new HttpParams().set('idInstitucionEducativa', this.idInstitucionEducativa.toString());
    this.http.get<number[]>(`${this.baseUrl}/estudiantes-con-docente`, { params })
      .subscribe(ids => {
        this.allAsignados = ids;
        this.asignados = [...ids];
      });
  }

buscarDocente(): void {
  const raw = this.nombreBusqueda.trim();
  if (!raw) {
    this.mostrarAlerta('Error', 'Ingresa un nombre de docente para buscar.');
    return;
  }

  // Normalizamos la búsqueda
  const normalizedRaw = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // 1) Buscamos coincidencia exacta NORMALIZADA
  const exacto = this.docentes.find(d =>
    d.NombreDocente
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase() === normalizedRaw
  );

  if (exacto) {
    // Si hay exacto, lo asignamos como único filtrado y lo cargamos
    this.docentesFiltrados = [exacto];
    this.buscandoDocente  = true;
    this.datosCargados    = false;

    const view: DocenteView & { index: number } = {
      ...exacto,
      index: exacto.displayId!
    };
    this.buscarPorId(view);
    return;
  }

  // 2) Si no hay exacto, hacemos el filtrado por "includes"
  this.docentesFiltrados = this.docentes.filter(d =>
    d.NombreDocente
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .includes(normalizedRaw)
  );

  if (!this.docentesFiltrados.length) {
    this.mostrarAlerta('Error', 'No hay docentes con ese nombre.');
    return;
  }

  // Activamos modo búsqueda para que el usuario seleccione
  this.buscandoDocente = true;
  this.datosCargados   = false;
}

  buscarPorId(d: DocenteView & { index: number }): void {
    const params = new HttpParams().set('nombreDocente', d.NombreDocente);
    this.http.get<SearchResponse>(`${this.baseUrl}/buscar-docente`, { params })
      .subscribe({
        next: res => {
          const views: DocenteView[] = res.idEstudiante.map((idEst, i) => ({
            idDocente: res.idEstudiante[0] || 0,
            idEstudiante: idEst,
            NombreEstudiante: this.getEstudianteNombre(idEst),
            NombreDocente: res.NombreDocente,
            DNIDocente: res.DNIDocente,
            Email: res.Email,
            Telefono: res.Telefono,
            GradoSeccionLabora: res.GradoSeccionLabora,
            displayId: i + 1
          }));
          this.docentesFiltrados = views;
          this.docente = {
            idDocente: views[0].idDocente,
            DNIDocente: res.DNIDocente,
            NombreDocente: res.NombreDocente,
            Email: res.Email,
            Telefono: res.Telefono,
            GradoSeccionLabora: res.GradoSeccionLabora,
            idEstudiante: res.idEstudiante
          };
          this.datosCargados = true;
          this.buscandoDocente = false;
          this.asignados = this.allAsignados.filter(id => !res.idEstudiante.includes(id));
          this.onEstudiantesChange();
        },
        error: () => this.mostrarAlerta('Error', 'No se pudo obtener los estudiantes del docente.')
      });
  }

  private getEstudianteNombre(id: number): string {
    const est = this.estudiantes.find(e => e.idEstudiante === id);
    return est ? est.ApellidosNombres : '-';
  }

  validateLetters(evt: KeyboardEvent): void {
    if (!/[a-zA-ZñÑáéíóúÁÉÍÓÚ ]/.test(evt.key)) evt.preventDefault();
  }

  validateNumber(evt: KeyboardEvent): void {
    if (!/\d/.test(evt.key)) evt.preventDefault();
  }

  formatTelefono(event: any): void {
    let val = event.detail.value.replace(/\D/g, '').slice(0, 9);
    const parts: string[] = [];
    for (let i = 0; i < val.length; i += 3) parts.push(val.substring(i, i + 3));
    this.docente.Telefono = parts.join('-');
  }

  validarEmail(): void {
    this.emailInvalid = !!this.docente.Email && !this.emailPattern.test(this.docente.Email);
  }

actualizarDocente(): void {
  this.validarEmail();

  // Validación de campos requeridos
  if (!this.docente.NombreDocente.trim() ||
      !this.docente.DNIDocente.trim() ||
      !this.docente.Email.trim() ||
      this.emailInvalid) {
    this.mostrarErrorCampos = true;
    return;
  }

  const payload = {
    ...this.docente,
    idInstitucionEducativa: this.idInstitucionEducativa
  };

  this.http.put(`${this.baseUrl}/actualizar-docente`, payload).subscribe({
    next: () => {
      this.mostrarAlerta('Éxito', 'Datos actualizados.');
      this.cargarAsignadosGlobal();
      this.resetForm();
      this.cargarDocentes();
    },
    error: () => this.mostrarAlerta('Error', 'No fue posible actualizar')
  });
}


registrarDocente(): void {
  this.validarEmail();

  // Validación de campos requeridos
  if (!this.docente.NombreDocente.trim() ||
      !this.docente.DNIDocente.trim() ||
      !this.docente.Email.trim() ||
      this.emailInvalid ||
      this.docente.idEstudiante.length === 0) {
    this.mostrarErrorCampos = true;
    return;
  }

  const reqs = this.docente.idEstudiante.map(id => {
    const payload = {
      idEstudiante: id,
      NombreDocente: this.docente.NombreDocente,
      DNIDocente: this.docente.DNIDocente,
      Email: this.docente.Email,
      Telefono: this.docente.Telefono,
      GradoSeccionLabora: this.docente.GradoSeccionLabora,
      idInstitucionEducativa: this.idInstitucionEducativa
    };
    return this.http.post<{ idDocente: number }>(`${this.baseUrl}/registrar-docente`, payload);
  });

  forkJoin(reqs).subscribe(() => {
    this.allAsignados.push(...this.docente.idEstudiante);
    this.asignados.push(...this.docente.idEstudiante);
    this.resetForm();
    this.cargarDocentes();
  });
}


  eliminarDocente(): void {
    if (!this.docente.idDocente) {
      this.mostrarAlerta('Error', 'No hay docente seleccionado para eliminar.');
      return;
    }
    this.http.delete<{ error?: string }>(`${this.baseUrl}/eliminar-docente/${this.docente.idDocente}`)
      .subscribe({
        next: res => {
          if (res.error) {
            this.mostrarAlerta('Error', res.error);
            return;
          }
          this.mostrarAlerta('Éxito', 'Docente eliminado correctamente.');
          this.resetForm();
          this.cargarAsignadosGlobal();
          this.cargarDocentes();
        },
        error: err => this.mostrarAlerta('Error', err.error?.error || 'No fue posible eliminar el docente.')
      });
  }

  async showExportOptions(): Promise<void> {
    const sheet = await this.actionSheetCtrl.create({
      header: 'Exportar como',
      cssClass: 'custom-export-sheet',
      buttons: [
        { text: 'PDF', handler: () => this.exportPDF() },
        { text: 'Excel', handler: () => this.exportExcel() },
        { text: 'Cancelar', role: 'cancel' }
      ]
    });
    await sheet.present();
  }

  exportExcel(): void {
    const data = this.docentesFiltrados.map(d => ({
      Estudiante: d.NombreEstudiante,
      Docente: d.NombreDocente,
      DNI: d.DNIDocente,
      Email: d.Email,
      'Teléfono': d.Telefono || '',
      'Grado/Sección': d.GradoSeccionLabora || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Docentes');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), 'docentes.xlsx');
  }

  exportPDF(): void {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const cols = ['ID','Estudiante','Docente','DNI','Email','Teléfono','Grado/Sección'];
    const rows = this.docentesFiltrados.map((d, i) => [
      i + 1, d.NombreEstudiante, d.NombreDocente, d.DNIDocente, d.Email,
      d.Telefono || '-', d.GradoSeccionLabora || '-'
    ]);
    autoTable(doc, { head: [cols], body: rows, startY: 40 });
    doc.save('docentes.pdf');
  }

  private async mostrarAlerta(header: string, message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header, message, buttons: ['OK'] });
    await alert.present();
  }

  resetForm(): void {
    this.docente = {
      DNIDocente: '',
      NombreDocente: '',
      Email: '',
      Telefono: '',
      GradoSeccionLabora: '',
      idEstudiante: []
    };
    this.selectedStudentNames = '';
    this.nombreBusqueda = '';
    this.datosCargados = false;
    this.buscandoDocente = false;
    this.asignados = [...this.allAsignados];
    this.emailInvalid = false;
    this.docentesFiltrados = [...this.docentes];
  }

  onEstudiantesChange(): void {
    this.selectedStudentNames = this.estudiantes
      .filter(e => this.docente.idEstudiante.includes(e.idEstudiante))
      .map(e => e.ApellidosNombres)
      .join(', ');
  }

openStudentsModal(): void {
  // 1) Los que ya tiene asignados ESTE docente (selected = true)
  const asignadosAlDocente = this.estudiantes
    .filter(e => this.docente.idEstudiante.includes(e.idEstudiante))
    .map(e => ({ ...e, selected: true }));

  // 2) Sólo los que NO están en ningún docente (selected = false)
  const sinAsignar = this.estudiantes
    .filter(e => !this.allAsignados.includes(e.idEstudiante))
    .map(e => ({ ...e, selected: false }));

  // 3) Unimos ambos grupos (no habrá duplicados porque un estudiante no puede estar
  //    simultáneamente en docente.idEstudiante y en allAsignados “global”)
  this.allStudents = [...asignadosAlDocente, ...sinAsignar];

  // 4) Inicializamos el filtrado y abrimos el modal
  this.filteredStudents = [...this.allStudents];
  this.studentFilter    = '';
  this.showStudentsModal = true;
}

  closeStudentsModal(): void {
    this.showStudentsModal = false;
  }

  filterStudents(): void {
    const txt = this.studentFilter.trim().toLowerCase();
    this.filteredStudents = this.allStudents.filter(s => s.ApellidosNombres.toLowerCase().includes(txt));
  }

  applyStudentsSelection(): void {
    this.docente.idEstudiante = this.allStudents.filter(s => s.selected!).map(s => s.idEstudiante);
    this.onEstudiantesChange();
    this.closeStudentsModal();
  }

  goTo(page: string): void {
    this.navCtrl.navigateRoot(`/${page}`);
  }

  // —————— Estos getters para el template ——————
get estudiantesDisponibles(): Student[] {
  return this.estudiantes.filter(e => !this.asignados.includes(e.idEstudiante));
}
  get docentesFiltradosIndexados(): Array<DocenteView & { index: number }> {
    return this.docentesFiltrados.map(d => ({ ...d, index: d.displayId! }));
  }
}
