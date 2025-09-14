import { Component } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AlertController, ActionSheetController, NavController } from '@ionic/angular';
import { forkJoin, Subscription } from 'rxjs';
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
  index?: number;
}

@Component({
  selector: 'app-docentes',
  templateUrl: './docentes.page.html',
  styleUrls: [
    './docentes.page.scss',
    './docentes.page2.scss',
    './docentes.page3.scss',
    './docentes.page4.scss'
  ],
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

  private searchSub?: Subscription;
  searchLoading = false;

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
  this.http.get<{ ok: boolean, data: DocenteView[] }>(`${this.baseUrl}/docentes-estudiante`, { params })
    .subscribe(res => {
      if (res.ok && Array.isArray(res.data)) {
        this.docentes = res.data.map((d, i) => ({ ...d, displayId: i + 1 }));
        this.docentesFiltrados = [...this.docentes];
      } else {
        this.docentes = [];
        this.docentesFiltrados = [];
      }
    }, err => {
      console.error('Error cargando docentes:', err);
      this.docentes = [];
      this.docentesFiltrados = [];
    });
}


  private cargarEstudiantes(): void {
    const params = new HttpParams().set('idInstitucionEducativa', this.idInstitucionEducativa.toString());
    this.http.get<Student[]>(`${this.baseUrl}/estudiantes`, { params })
      .subscribe(list => this.estudiantes = list);
  }

  private cargarAsignadosGlobal(): void {
    const params = new HttpParams().set('idInstitucionEducativa', this.idInstitucionEducativa.toString());
this.http.get<{ ok: boolean, data: number[] }>(`${this.baseUrl}/estudiantes-con-docente`, { params })
  .subscribe(res => {
    if (res.ok && Array.isArray(res.data)) {
      this.allAsignados = res.data;
      this.asignados = [...res.data];
    } else {
      this.allAsignados = [];
      this.asignados = [];
    }
  }, err => {
    console.error('Error cargando asignados:', err);
    this.allAsignados = [];
    this.asignados = [];
  });

  }

  // ------------------ BÚSQUEDA ------------------

  buscarDocente(): void {
    const raw = this.nombreBusqueda.trim();
    if (!raw) {
      this.mostrarAlerta('Error', 'Ingresa un nombre de docente para buscar.');
      return;
    }

    const normalizedRaw = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const matches = this.docentes.filter(d =>
      d.NombreDocente
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes(normalizedRaw)
    );

    if (!matches.length) {
      this.mostrarAlerta('Error', 'No hay docentes con ese nombre.');
      return;
    }

    if (matches.length === 1) {
      this.buscandoDocente = true;
      this.datosCargados = false;
      this.searchLoading = true;
      this.buscarPorId(matches[0]);
      return;
    }

    const idSet = new Set(matches.map(m => m.idDocente ?? 0).filter(id => id && id !== 0));
    if (idSet.size === 1) {
      this.buscandoDocente = true;
      this.datosCargados = false;
      this.searchLoading = true;
      this.buscarPorId(matches[0]);
      return;
    }

    const dniSet = new Set(matches.map(m => (m.DNIDocente || '').toString().trim()));
    if (dniSet.size === 1 && [...dniSet][0]) {
      this.buscandoDocente = true;
      this.datosCargados = false;
      this.searchLoading = true;
      this.buscarPorId(matches[0]);
      return;
    }

    const keySet = new Set(matches.map(m =>
      `${(m.NombreDocente || '').toString().trim()}||${(m.Email || '').toString().trim()}||${(m.Telefono || '').toString().trim()}`
    ));
    if (keySet.size === 1) {
      this.buscandoDocente = true;
      this.datosCargados = false;
      this.searchLoading = true;
      this.buscarPorId(matches[0]);
      return;
    }

    this.docentesFiltrados = matches;
    this.buscandoDocente = true;
    this.datosCargados = false;
  }

  buscarPorId(d: DocenteView | (DocenteView & { index: number })): void {
    if (this.searchSub) {
      this.searchSub.unsubscribe();
      this.searchSub = undefined;
    }

    this.searchLoading = true;
    this.datosCargados = false;

    const displayId = (d as DocenteView).displayId;
    const originalRow = this.docentes.find(x => x.displayId === displayId);

    if (originalRow) {
      const teacherDNI = (originalRow.DNIDocente || '').toString().trim();

      let relatedRows: DocenteView[] = [];

      if (teacherDNI) {
        relatedRows = this.docentes.filter(x => (x.DNIDocente || '').toString().trim() === teacherDNI);
      } else {
        const key = `${(originalRow.NombreDocente || '').toString().trim()}||${(originalRow.Email || '').toString().trim()}||${(originalRow.Telefono || '').toString().trim()}`;
        relatedRows = this.docentes.filter(x => {
          const k = `${(x.NombreDocente || '').toString().trim()}||${(x.Email || '').toString().trim()}||${(x.Telefono || '').toString().trim()}`;
          return k === key;
        });
      }

      const seen = new Set<number>();
      const views: DocenteView[] = [];

      relatedRows.forEach(row => {
        if (seen.has(row.idEstudiante)) return;
        seen.add(row.idEstudiante);

        views.push({
          idDocente: originalRow.idDocente ?? 0,
          idEstudiante: row.idEstudiante,
          NombreEstudiante: this.getEstudianteNombre(row.idEstudiante),
          NombreDocente: row.NombreDocente,
          DNIDocente: row.DNIDocente,
          Email: row.Email,
          Telefono: row.Telefono,
          GradoSeccionLabora: row.GradoSeccionLabora,
          displayId: row.displayId
        });
      });

      if (views.length) {
        this.docentesFiltrados = views;

        this.docente = {
          idDocente: originalRow.idDocente,
          DNIDocente: originalRow.DNIDocente,
          NombreDocente: originalRow.NombreDocente,
          Email: originalRow.Email,
          Telefono: originalRow.Telefono,
          GradoSeccionLabora: originalRow.GradoSeccionLabora,
          idEstudiante: Array.from(seen)
        };

        this.datosCargados = true;
        this.buscandoDocente = false;
        this.searchLoading = false;

        this.asignados = this.allAsignados.filter(id => !Array.from(seen).includes(id));
        this.onEstudiantesChange();
        return;
      }
    }

    let params = new HttpParams().set('nombreDocente', d.NombreDocente);
    if ((d as DocenteView).idDocente != null && (d as DocenteView).idDocente !== 0) {
      params = params.set('idDocente', String((d as DocenteView).idDocente));
    }
    params = params.set('displayId', String(displayId ?? 0));

    this.searchSub = this.http.get<SearchResponse>(`${this.baseUrl}/buscar-docente`, { params })
      .subscribe({
        next: res => {
          this.searchLoading = false;

          const idDocenteVal = (d as DocenteView).idDocente ?? (res.idEstudiante?.[0] ?? 0);

          const seen = new Set<number>();
          const views: DocenteView[] = [];
          res.idEstudiante.forEach(idEst => {
            if (seen.has(idEst)) return;
            seen.add(idEst);

            const match = this.docentes.find(x =>
              x.idEstudiante === idEst &&
              x.NombreDocente === res.NombreDocente &&
              (x.DNIDocente || '') === (res.DNIDocente || '')
            );

            views.push({
              idDocente: idDocenteVal,
              idEstudiante: idEst,
              NombreEstudiante: this.getEstudianteNombre(idEst),
              NombreDocente: res.NombreDocente,
              DNIDocente: res.DNIDocente,
              Email: res.Email,
              Telefono: res.Telefono,
              GradoSeccionLabora: res.GradoSeccionLabora,
              displayId: match ? match.displayId : (d as DocenteView).displayId
            });
          });

          this.docentesFiltrados = views;

          this.docente = {
            idDocente: views[0]?.idDocente,
            DNIDocente: res.DNIDocente,
            NombreDocente: res.NombreDocente,
            Email: res.Email,
            Telefono: res.Telefono,
            GradoSeccionLabora: res.GradoSeccionLabora,
            idEstudiante: Array.from(seen)
          };

          this.datosCargados = true;
          this.buscandoDocente = false;

          this.asignados = this.allAsignados.filter(id => !res.idEstudiante.includes(id));
          this.onEstudiantesChange();
        },
        error: () => {
          this.searchLoading = false;
          this.mostrarAlerta('Error', 'No se pudo obtener los estudiantes del docente.');
        }
      });
  }

  // ------------------ Helpers ------------------

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
    let val = (event?.detail?.value ?? '').replace(/\D/g, '').slice(0, 9);
    const parts: string[] = [];
    for (let i = 0; i < val.length; i += 3) parts.push(val.substring(i, i + 3));
    this.docente.Telefono = parts.join('-');
  }

  validarEmail(): void {
    this.emailInvalid = !!this.docente.Email && !this.emailPattern.test(this.docente.Email);
  }

  actualizarDocente(): void {
    this.validarEmail();

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
  this.studentFilter = '';

  const idsDocenteActual = new Set(
    (this.docente.idEstudiante || []).map((n: any) => Number(n)).filter((x: number) => !isNaN(x))
  );

  // Mostrar SOLO:
  // - estudiantes que ya pertenecen a este docente (idsDocenteActual)
  // - OR estudiantes que NO están asignados globalmente (no están en allAsignados)
  this.allStudents = this.estudiantes
    .filter(e => idsDocenteActual.has(e.idEstudiante) || !this.allAsignados.includes(e.idEstudiante))
    .map(e => ({
      ...e,
      selected: idsDocenteActual.has(e.idEstudiante)
    }));

  this.filteredStudents = [...this.allStudents];
  this.showStudentsModal = true;
}



  closeStudentsModal(): void {
    this.showStudentsModal = false;
  }

filterStudents(): void {
  const txt = (this.studentFilter || '').trim().toLowerCase();
  if (!txt) {
    this.filteredStudents = [...this.allStudents];
    return;
  }
  this.filteredStudents = this.allStudents.filter(s =>
    (s.ApellidosNombres || '').toLowerCase().includes(txt)
  );
}


applyStudentsSelection(): void {
  const seleccionados = this.allStudents
    .filter(s => !!s.selected)
    .map(s => Number(s.idEstudiante))
    .filter(n => !isNaN(n));

  const selNums = Array.from(new Set(seleccionados));

  this.docente.idEstudiante = selNums;
  this.onEstudiantesChange();

  // recalcular asignados: quitar los que ahora pertenecen a este docente
  this.asignados = this.allAsignados.filter(id => !this.docente.idEstudiante.includes(id));

  this.closeStudentsModal();
}

  goTo(page: string): void {
    this.navCtrl.navigateRoot(`/${page}`);
  }

get estudiantesDisponibles(): Student[] {
  const idsDocenteActual = this.docente.idEstudiante || [];
  return this.estudiantes.filter(e => !this.asignados.includes(e.idEstudiante) || idsDocenteActual.includes(e.idEstudiante));
}
  get docentesFiltradosIndexados(): Array<DocenteView & { index: number }> {
    return this.docentesFiltrados.map(d => ({ ...d, index: d.displayId! }));
  }
}
