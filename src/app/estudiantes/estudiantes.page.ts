// src/app/estudiantes/estudiantes.page.ts
import {
  Component,
  AfterViewInit,
  OnDestroy,
  NgZone
} from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AlertController } from '@ionic/angular';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import autoTable from 'jspdf-autotable';
import jsPDF from 'jspdf';
import { environment } from 'src/environments/environment';

interface EstudianteResponse {
  idEstudiante: number;
  ApellidosNombres: string;
  FechaNacimiento: string;
  Edad: number;
  DNI: string;
  GradoSeccion: string;
  TipoDiscapacidad?: string;
  DocumentoSustentatorio?: string;
  DocumentoInclusiva?: string;
  IPP: 'Si' | 'No';
  PEP: 'Si' | 'No';
  idInstitucionEducativa: number;
}

interface EstudianteLocal {
  id: number;
  fila: number;
  ApellidosNombres: string;
  FechaNacimiento: string;
  Edad: number;
  DNI: string;
  GradoSeccion: string;
  TipoDiscapacidad?: string;
  DocumentoSustentatorio?: string;
  DocumentoInclusiva?: string;
  IPP: boolean;
  PEP: boolean;
}

@Component({
  selector: 'app-estudiantes',
  templateUrl: './estudiantes.page.html',
  styleUrls: [
    './estudiantes.page.scss',
    './estudiantes.page2.scss',
    './estudiantes.page3.scss',
    './estudiantes.page4.scss'
  ],
  standalone: false,
})
export class EstudiantesPage implements AfterViewInit, OnDestroy {
  private baseUrl = environment.apiUrl + '/estudiantes';
  idIE!: number;
  nombreBusqueda = '';
  datosCargados = false;
  seleccionMultiple = false;
  hoverActivo = false;
  alumno: Partial<EstudianteLocal> = {};
  estudiantes: EstudianteLocal[] = [];
  estudiantesFiltrados: EstudianteLocal[] = [];

  // Overlay flags
  mostrarAlertaExportar = false;
  mostrarErrorCampos = false;
  mensajeErrorCampos = 'Completa todos los campos requeridos';

  private resizeListener!: () => void;

  constructor(
    private http: HttpClient,
    private alertCtrl: AlertController,
    private zone: NgZone
  ) {}

  ngAfterViewInit() {
    this.resizeListener = () =>
      this.zone.runOutsideAngular(() => this.fixZoom());
    window.addEventListener('resize', this.resizeListener);
    this.fixZoom();
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.resizeListener);
  }

  private fixZoom() {
    const container = document.getElementById('zoom-fix');
    if (!container) return;
    const zoomFactor = window.outerWidth / window.innerWidth;
    const scale = 1 / zoomFactor;
    (container.style as any).transformOrigin = '0 0';
    (container.style as any).transform = `scale(${scale})`;
    (container.style as any).width = `${zoomFactor * 100}%`;
    (container.style as any).height = `${zoomFactor * 100}%`;
  }

  ionViewWillEnter(): void {
    this.hoverActivo = false;
    const stored = localStorage.getItem('idInstitucionEducativa');
    this.idIE = stored ? +stored : 0;
    if (!this.idIE) {
      this.mostrarAlerta('Error', 'No hay institución seleccionada');
      return;
    }
    this.resetForm();
    this.cargarEstudiantes();
  }

  private cargarEstudiantes(callback?: () => void): void {
    const params = new HttpParams().set(
      'idInstitucionEducativa',
      this.idIE.toString()
    );
    this.http
      .get<{ ok: boolean; data: EstudianteResponse[] }>(
        `${this.baseUrl}?action=listar`,
        { params }
      )
      .subscribe(
        (res) => {
          const list = res?.data || [];
          this.estudiantes = list.map((r, i) => ({
            id: r.idEstudiante,
            fila: i + 1,
            ApellidosNombres: r.ApellidosNombres,
            FechaNacimiento: r.FechaNacimiento,
            Edad: r.Edad,
            DNI: r.DNI,
            GradoSeccion: r.GradoSeccion,
            TipoDiscapacidad: r.TipoDiscapacidad || '',
            DocumentoSustentatorio: r.DocumentoSustentatorio || '',
            DocumentoInclusiva: r.DocumentoInclusiva || '',
            IPP: r.IPP === 'Si',
            PEP: r.PEP === 'Si',
          }));
          this.estudiantesFiltrados = [...this.estudiantes];
          if (typeof callback === 'function') callback();
        },
        () => this.mostrarAlerta('Error', 'Error cargando estudiantes')
      );
  }


buscarEstudiante(): void {
  this.seleccionMultiple = false;
  this.datosCargados = false;
  this.hoverActivo = false;

  const raw = this.nombreBusqueda.trim();
  if (!raw) {
    this.mensajeErrorCampos = 'Ingresa un nombre para buscar.';
    this.mostrarErrorCampos = true;
    return;
  }

  const normalize = (s: string) =>
    s
      ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      : '';

  const q = normalize(raw);

  const matches = this.estudiantes.filter((e) =>
    normalize(e.ApellidosNombres).startsWith(q)
  );

  if (!matches.length) {
    this.mensajeErrorCampos = 'Docente no encontrado, vuelve a intentar.';
    this.mostrarErrorCampos = true;
    this.estudiantesFiltrados = [];
    return;
  }

  this.estudiantesFiltrados = matches;

  if (matches.length > 1) {
    this.seleccionMultiple = true;
    this.hoverActivo = true;
  } else {
    this.alumno = { ...matches[0] };
    this.datosCargados = true;
    this.hoverActivo = false;
  }
}


  seleccionarEstudiante(est: EstudianteLocal): void {
    this.alumno = { ...est };
    this.datosCargados = true;
    this.estudiantesFiltrados = [est];
    this.seleccionMultiple = false;
    this.hoverActivo = false;
  }

private async validarCampos(): Promise<boolean> {
  if (
    !this.alumno.ApellidosNombres ||
    !this.alumno.FechaNacimiento ||
    !this.alumno.DNI
  ) {
    this.mensajeErrorCampos = 'Completa todos los campos requeridos';
    this.mostrarErrorCampos = true;
    return false;
  }
  return true;
}


  cerrarErrorCampos() {
    this.mostrarErrorCampos = false;
  }

async registrarEstudiante(): Promise<void> {
  if (!(await this.validarCampos())) {
    return;
  }

  const payload: any = {
    ApellidosNombres: this.alumno.ApellidosNombres,
    FechaNacimiento: this.alumno.FechaNacimiento,
    Edad: this.alumno.Edad,
    DNI: this.alumno.DNI,
    GradoSeccion: this.alumno.GradoSeccion,
    TipoDiscapacidad: this.alumno.TipoDiscapacidad,
    DocumentoSustentatorio: this.alumno.DocumentoSustentatorio,
    DocumentoInclusiva: this.alumno.DocumentoInclusiva,
    IPP: this.alumno.IPP ? 'Si' : 'No',
    PEP: this.alumno.PEP ? 'Si' : 'No',
    idInstitucionEducativa: this.idIE,
  };

  this.http
    .post<{ ok: boolean; data?: any }>(
      `${this.baseUrl}?action=registrar`,
      payload
    )
    .subscribe({
      next: () => {
        this.resetForm();
        this.cargarEstudiantes();
      },
      error: (e) =>
        this.mostrarAlerta(
          'Error',
          e.error?.mensaje || 'No fue posible registrar'
        ),
    });
}

actualizarEstudiante(): void {
  this.validarCampos().then((ok) => {
    if (!ok) return;

    const payload: any = {
      idEstudiante: this.alumno.id,
      ApellidosNombres: this.alumno.ApellidosNombres,
      FechaNacimiento: this.alumno.FechaNacimiento,
      Edad: this.alumno.Edad,
      DNI: this.alumno.DNI,
      GradoSeccion: this.alumno.GradoSeccion,
      TipoDiscapacidad: this.alumno.TipoDiscapacidad,
      DocumentoSustentatorio: this.alumno.DocumentoSustentatorio,
      DocumentoInclusiva: this.alumno.DocumentoInclusiva,
      IPP: this.alumno.IPP ? 'Si' : 'No',
      PEP: this.alumno.PEP ? 'Si' : 'No',
    };

    this.http
      .put(`${this.baseUrl}?action=actualizar`, payload)
      .subscribe({
        next: () => {
          this.resetForm();
          this.cargarEstudiantes(() => {
            this.hoverActivo = false;
          });
        },
        error: (e) =>
          this.mostrarAlerta(
            'Error',
            e.error?.mensaje || 'No fue posible actualizar'
          ),
      });
  });
}


  // async confirmEliminar() {
  //   const localFlag = localStorage.getItem('noMostrarEliminar');
  //   if (localFlag === 'true') {
  //     this.eliminarEstudiante();
  //     return;
  //   }

  //   const alert = await this.alertCtrl.create({
  //     header: 'Confirmación',
  //     message: '¿Estás seguro de eliminar este estudiante?',
  //     inputs: [
  //       {
  //         name: 'noMostrar',
  //         type: 'checkbox',
  //         label: 'No volver a mostrar este mensaje',
  //         value: 'noMostrar',
  //       },
  //     ],
  //     buttons: [
  //       { text: 'No', role: 'cancel' },
  //       {
  //         text: 'Sí',
  //         handler: (data: any) => {
  //           if (
  //             Array.isArray(data)
  //               ? data.includes('noMostrar')
  //               : data?.noMostrar === 'noMostrar'
  //           ) {
  //             localStorage.setItem('noMostrarEliminar', 'true');
  //           }
  //           this.eliminarEstudiante();
  //         },
  //       },
  //     ],
  //   });
  //   await alert.present();
  // }


  // Eliminar directamente sin confirmar ni mostrar alertas
confirmEliminar() {
  this.eliminarEstudiante();
}


private eliminarEstudiante() {
  if (!this.alumno.id) return;
  this.http
    .delete(`${this.baseUrl}?action=eliminar&id=${this.alumno.id}`)
    .subscribe({
      next: () => {
        this.resetForm();
        this.cargarEstudiantes();
      },
      error: () => this.mostrarAlerta('Error', 'No fue posible eliminar'),
    });
}


  resetForm(): void {
    this.alumno = {};
    this.nombreBusqueda = '';
    this.datosCargados = false;
    this.seleccionMultiple = false;
    this.estudiantesFiltrados = [...this.estudiantes];
    this.hoverActivo = false;
  }

  private async mostrarAlerta(
    header: string,
    message: string
  ): Promise<void> {
    const alert = await this.alertCtrl.create({ header, message, buttons: ['OK'] });
    await alert.present();
  }

  onFechaChange(): void {
    let v = (this.alumno.FechaNacimiento || '')
      .replace(/\D/g, '')
      .substr(0, 8);
    if (v.length <= 2) {
      this.alumno.FechaNacimiento = v;
    } else if (v.length <= 4) {
      this.alumno.FechaNacimiento = v.substr(0, 2) + '/' + v.substr(2);
    } else {
      this.alumno.FechaNacimiento =
        v.substr(0, 2) + '/' + v.substr(2, 2) + '/' + v.substr(4);
    }
    this.calculateAge();
  }

  private calculateAge(): void {
    const fecha = this.alumno.FechaNacimiento;
    if (!fecha || fecha.length !== 10) {
      this.alumno.Edad = undefined;
      return;
    }
    const [dd, mm, yyyy] = fecha.split('/').map((s) => +s);
    const birthDate = new Date(yyyy, mm - 1, dd);
    if (isNaN(birthDate.getTime())) {
      this.alumno.Edad = undefined;
      return;
    }
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    this.alumno.Edad = age;
  }

  validateNumber(e: KeyboardEvent): void {
    if (!/[0-9]/.test(e.key)) e.preventDefault();
  }

  onlyLetters(e: KeyboardEvent): void {
    if (!/^[A-Za-zÀ-ÿ\s]$/.test(e.key)) e.preventDefault();
  }

  abrirAlertaExportar() {
    this.mostrarAlertaExportar = true;
  }

  cerrarAlertaExportar() {
    this.mostrarAlertaExportar = false;
  }

  exportExcel(): void {
    const headers = [
      'Fila',
      'Apellidos y Nombres',
      'Fecha Nac.',
      'Edad',
      'DNI',
      'Grado/Sección',
      'Tipo Discapacidad',
      'Doc. Sust.',
      'Doc. Inc.',
      'IPP',
      'PEP',
    ];
    const data = this.estudiantesFiltrados.map((e) => ({
      Fila: e.fila,
      'Apellidos y Nombres': e.ApellidosNombres,
      'Fecha Nac.': e.FechaNacimiento,
      Edad: e.Edad,
      DNI: e.DNI,
      'Grado/Sección': e.GradoSeccion,
      'Tipo Discapacidad': e.TipoDiscapacidad,
      'Doc. Sust.': e.DocumentoSustentatorio,
      'Doc. Inc.': e.DocumentoInclusiva,
      IPP: e.IPP ? 'Si' : 'No',
      PEP: e.PEP ? 'Si' : 'No',
    }));
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    ws['!cols'] = headers.map((_) => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estudiantes');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([wbout], { type: 'application/octet-stream' }),
      'estudiantes.xlsx'
    );
  }

  exportPDF(): void {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4',
    });
    const cols = [
      'Fila',
      'Apellido y Nombres',
      'Fecha Nac.',
      'Edad',
      'DNI',
      'Grado/Sección',
      'Discapacidad',
      'IPP',
      'PEP',
    ];
    const rows = this.estudiantesFiltrados.map((e) => [
      e.fila,
      e.ApellidosNombres,
      e.FechaNacimiento,
      e.Edad,
      e.DNI,
      e.GradoSeccion,
      e.TipoDiscapacidad || '',
      e.IPP ? 'Si' : 'No',
      e.PEP ? 'Si' : 'No',
    ]);
    autoTable(doc, { head: [cols], body: rows, startY: 40 });
    doc.save('estudiantes.pdf');
  }
}
