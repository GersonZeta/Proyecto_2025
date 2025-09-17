// src/app/docentes/docentes.page.ts
import { Component } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AlertController, ActionSheetController, NavController } from '@ionic/angular';
import { forkJoin, Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import autoTable from 'jspdf-autotable';
import jsPDF from 'jspdf';
import { environment } from 'src/environments/environment';

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
  private baseUrl = environment.apiUrl + '/docentes';
  private idInstitucionEducativa = 0;

  docentes: DocenteView[] = [];
  docentesFiltrados: DocenteView[] = [];
  estudiantes: Student[] = [];
  allAsignados: number[] = []; // ids globalmente asignados (vienen del servidor)
  asignados: number[] = []; // copia usada temporalmente en UI

  // modal / selección
  showStudentsModal = false;
  studentFilter = '';
  allStudents: Student[] = [];     // items actuales en modal (solo disponibles + asignados al docente)
  filteredStudents: Student[] = []; // filtrado por búsqueda en modal

  // helper: lista calculada de estudiantes NO asignados (disponibles)
  availableStudents: Student[] = [];

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
  isLoadingAsignados = false;

  constructor(
    private http: HttpClient,
    private alertCtrl: AlertController,
    private actionSheetCtrl: ActionSheetController,
    private navCtrl: NavController
  ) {}

  cerrarAlertaExportar(): void { this.mostrarAlertaExportar = false; }
  cerrarErrorCampos(): void { this.mostrarErrorCampos = false; }

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

  // ------------------ CARGAS ------------------
  private cargarDocentes(): void {
    const params = new HttpParams()
      .set('action', 'listar')
      .set('idInstitucionEducativa', this.idInstitucionEducativa.toString());

    this.http.get<{ ok: boolean, data: DocenteView[] }>(`${this.baseUrl}`, { params })
      .subscribe(res => {
        if (res.ok && Array.isArray(res.data)) {
          // Mantener el orden que trae el servidor (no ordenar por nombre)
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
    const params = new HttpParams()
      .set('action', 'listar')
      .set('idInstitucionEducativa', this.idInstitucionEducativa.toString());

    this.http.get<{ ok: boolean; data: any[] }>(`${environment.apiUrl}/estudiantes`, { params })
      .subscribe(res => {
        this.estudiantes = (res?.data || []).map((r: any) => ({
          idEstudiante: r.idEstudiante ?? r.idestudiante,
          ApellidosNombres: r.ApellidosNombres ?? r.apellidosnombres,
          idInstitucionEducativa: r.idInstitucionEducativa ?? r.idinstitucioneducativa
        }));

        // no rellenamos el modal con TODOS: actualizamos la lista de disponibles
        this.updateAvailableStudents();
        // por seguridad dejamos modal vacío hasta que el usuario lo abra
        this.allStudents = [];
        this.filteredStudents = [];
      }, err => {
        console.error('Error cargando estudiantes:', err);
        this.estudiantes = [];
        this.availableStudents = [];
        this.allStudents = [];
        this.filteredStudents = [];
      });
  }

  private cargarAsignadosGlobal(): void {
    this.isLoadingAsignados = true;
    const params = new HttpParams()
      .set('action', 'listar')
      .set('idInstitucionEducativa', this.idInstitucionEducativa.toString());

    // Llamamos al mismo endpoint /docentes?action=listar y extraemos idestudiante(s)
    this.http.get<{ ok: boolean, data: DocenteView[] }>(`${this.baseUrl}`, { params })
      .subscribe(res => {
        const rows = (res && res.data && Array.isArray(res.data)) ? res.data : [];
        // extraer ids únicos de estudiantes que ya tienen docente
        const ids = Array.from(new Set(rows
          .map(r => r.idEstudiante)
          .filter(n => n != null && !isNaN(Number(n)))
          .map(n => Number(n))
        ));
        this.allAsignados = ids;
        this.asignados = [...this.allAsignados];
        this.isLoadingAsignados = false;
        this.updateAvailableStudents();
      }, err => {
        console.error('Error cargando asignados:', err);
        this.allAsignados = [];
        this.asignados = [];
        this.isLoadingAsignados = false;
        this.updateAvailableStudents();
      });
  }

  // recalcula availableStudents usando estudiantes y allAsignados
  private updateAvailableStudents(): void {
    if (!Array.isArray(this.estudiantes) || !Array.isArray(this.allAsignados)) {
      this.availableStudents = [];
      return;
    }
    const assignedSet = new Set(this.allAsignados.map(n => Number(n)));
    this.availableStudents = this.estudiantes.filter(s => !assignedSet.has(Number(s.idEstudiante)));
  }

  buscarDocente(): void {
    const raw = this.nombreBusqueda.trim();
    if (!raw) {
      this.mostrarAlerta('Error', 'Ingresa un nombre de docente para buscar.');
      return;
    }

    const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normalizedRaw = normalize(raw);

    // Filtrar todos los docentes cuyo nombre contenga la búsqueda
    const matches = this.docentes.filter(d => normalize(d.NombreDocente).includes(normalizedRaw));

    if (!matches.length) {
      this.mostrarAlerta('Error', 'No hay docentes con ese nombre.');
      return;
    }

    // Filtrar coincidencias exactas
    const exactMatches = matches.filter(d => normalize(d.NombreDocente) === normalizedRaw);

    // Agrupar por DNIDocente para saber si son realmente distintos docentes
    const mapByDNI = new Map<string, DocenteView[]>();
    exactMatches.forEach(d => {
      const dni = (d.DNIDocente || '').toString().trim();
      if (!mapByDNI.has(dni)) mapByDNI.set(dni, []);
      mapByDNI.get(dni)!.push({
        idDocente: d.idDocente ?? 0,
        idEstudiante: d.idEstudiante,
        NombreEstudiante: this.getEstudianteNombre(d.idEstudiante),
        NombreDocente: d.NombreDocente,
        DNIDocente: d.DNIDocente,
        Email: d.Email,
        Telefono: d.Telefono,
        GradoSeccionLabora: d.GradoSeccionLabora,
        displayId: d.displayId
      });
    });

    // Si solo hay un docente exacto (mismo DNI), seleccionamos automáticamente todos sus estudiantes
    if (mapByDNI.size === 1) {
      const estudiantes = Array.from(mapByDNI.values())[0];
      const estudiantesIds = estudiantes.map(e => e.idEstudiante);
      const d = estudiantes[0];
      this.docente = {
        idDocente: d.idDocente,
        DNIDocente: d.DNIDocente ?? '',
        NombreDocente: d.NombreDocente,
        Email: d.Email,
        Telefono: d.Telefono,
        GradoSeccionLabora: d.GradoSeccionLabora,
        idEstudiante: estudiantesIds
      };
      this.asignados = this.allAsignados.filter(id => !estudiantesIds.includes(id));
      this.onEstudiantesChange();
      this.updateAvailableStudents();
      this.allStudents = [];
      this.filteredStudents = [];
      this.docentesFiltrados = estudiantes; // Mostrar todos sus estudiantes
      this.datosCargados = true;
      this.buscandoDocente = false; // NO pedir elección
      return;
    }

    // Si hay varios DNIs diferentes con el mismo nombre: mostrar todos los estudiantes agrupados por docente
    const allStudents: DocenteView[] = [];
    mapByDNI.forEach(arr => allStudents.push(...arr));
    this.docentesFiltrados = allStudents;
    this.datosCargados = true;
    this.buscandoDocente = true; // Solo aquí pedimos elegir, porque son docentes distintos
  }

  buscarPorId(d: DocenteView | (DocenteView & { index: number })): void {
    // cancelar sub existente
    if (this.searchSub) {
      this.searchSub.unsubscribe();
      this.searchSub = undefined;
    }

    this.searchLoading = true;
    this.datosCargados = false;

    // Usar la información que ya tenemos en 'd' para identificar al docente,
    // en lugar de depender de displayId (que puede confundir cuando hay búsquedas parciales).
    const dniParam = ((d as DocenteView).DNIDocente || '').toString().trim();
    const nombreParam = ((d as DocenteView).NombreDocente || '').toString().trim();
    const emailParam = ((d as DocenteView).Email || '').toString().trim();
    const telParam = ((d as DocenteView).Telefono || '').toString().trim();

    // si hay DNIs confiable, filtrar por DNIDocente; si no, usar la clave compuesta
    let relatedRows: DocenteView[] = [];
    if (dniParam) {
      relatedRows = this.docentes.filter(x => ((x.DNIDocente || '').toString().trim()) === dniParam);
    } else {
      relatedRows = this.docentes.filter(x => {
        return ((x.NombreDocente || '').toString().trim() === nombreParam) &&
               ((x.Email || '').toString().trim() === emailParam) &&
               ((x.Telefono || '').toString().trim() === telParam);
      });
    }

    // Si encontramos filas locales suficientes, construir vista y terminar
    if (relatedRows && relatedRows.length > 0) {
      const seen = new Set<number>();
      const views: DocenteView[] = [];

      relatedRows.forEach(row => {
        if (seen.has(row.idEstudiante)) return;
        seen.add(row.idEstudiante);

        views.push({
          idDocente: row.idDocente ?? 0,
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

      // Si hay resultados, asignarlos y setear estado
      if (views.length) {
        this.docentesFiltrados = views;
        this.docente = {
          idDocente: relatedRows[0]?.idDocente,
          DNIDocente: relatedRows[0]?.DNIDocente ?? '',
          NombreDocente: relatedRows[0]?.NombreDocente ?? '',
          Email: relatedRows[0]?.Email ?? '',
          Telefono: relatedRows[0]?.Telefono ?? '',
          GradoSeccionLabora: relatedRows[0]?.GradoSeccionLabora ?? '',
          idEstudiante: Array.from(seen)
        };

        this.datosCargados = true;
        this.buscandoDocente = false;
        this.searchLoading = false;

        // recalcular asignados UI
        this.asignados = this.allAsignados.filter(id => !Array.from(seen).includes(id));
        this.onEstudiantesChange();

        // actualizar disponibles y limpiar buffers modal
        this.updateAvailableStudents();
        this.allStudents = [];
        this.filteredStudents = [];

        return;
      }
    }

    // Si no hay filas locales, fallback al servidor (igual que antes)
    const params = new HttpParams()
      .set('action', 'buscar')
      .set('nombreDocente', (d as DocenteView).NombreDocente || '');

    this.searchSub = this.http.get<{ ok: boolean, data: SearchResponse }>(`${this.baseUrl}`, { params })
      .subscribe({
        next: res => {
          this.searchLoading = false;
          const payload = res?.data;
          if (!res.ok || !payload) {
            this.mostrarAlerta('Error', 'Docente no encontrado en servidor.');
            return;
          }

          const seen = new Set<number>();
          const views: DocenteView[] = [];
          (payload.idEstudiante || []).forEach(idEst => {
            if (seen.has(idEst)) return;
            seen.add(idEst);
            views.push({
              idDocente: (d as any).idDocente ?? 0,
              idEstudiante: idEst,
              NombreEstudiante: this.getEstudianteNombre(idEst),
              NombreDocente: payload.NombreDocente,
              DNIDocente: payload.DNIDocente,
              Email: payload.Email,
              Telefono: payload.Telefono,
              GradoSeccionLabora: payload.GradoSeccionLabora,
              displayId: (d as DocenteView).displayId ?? 0
            });
          });

          this.docentesFiltrados = views;
          this.docente = {
            idDocente: views[0]?.idDocente,
            DNIDocente: payload.DNIDocente,
            NombreDocente: payload.NombreDocente,
            Email: payload.Email,
            Telefono: payload.Telefono,
            GradoSeccionLabora: payload.GradoSeccionLabora,
            idEstudiante: Array.from(seen)
          };

          this.datosCargados = true;
          this.buscandoDocente = false;
          this.asignados = this.allAsignados.filter(id => !payload.idEstudiante.includes(id));
          this.onEstudiantesChange();

          this.updateAvailableStudents();
          this.allStudents = [];
          this.filteredStudents = [];
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

  validateLetters(evt: KeyboardEvent): void { if (!/[a-zA-ZñÑáéíóúÁÉÍÓÚ ]/.test(evt.key)) evt.preventDefault(); }
  validateNumber(evt: KeyboardEvent): void { if (!/\d/.test(evt.key)) evt.preventDefault(); }

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

    const payload: any = {
      DNIDocente: this.docente.DNIDocente,
      NombreDocente: this.docente.NombreDocente,
      Email: this.docente.Email,
      Telefono: this.docente.Telefono,
      GradoSeccionLabora: this.docente.GradoSeccionLabora,
      idEstudiante: this.docente.idEstudiante || []
    };

    const params = new HttpParams().set('action', 'actualizar');

    this.http.put(`${this.baseUrl}`, payload, { params }).subscribe({
      next: () => {
        this.cargarAsignadosGlobal();
        this.resetForm();
        this.cargarDocentes();
        this.mostrarAlerta('Éxito', 'Datos actualizados.');
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
      };
      const params = new HttpParams().set('action', 'registrar');
      return this.http.post<{ ok: boolean; data?: any }>(`${this.baseUrl}`, payload, { params });
    });

    forkJoin(reqs).subscribe(() => {
      // después de registrar, refrescar datos desde servidor
      this.resetForm();
      this.cargarAsignadosGlobal();
      this.cargarDocentes();
    }, err => {
      console.error('Error registrando docente(s):', err);
      this.mostrarAlerta('Error', 'No fue posible registrar los docentes.');
    });
  }

  eliminarDocente(): void {
    if (!this.docente.idDocente) {
      this.mostrarAlerta('Error', 'No hay docente seleccionado para eliminar.');
      return;
    }

    const params = new HttpParams().set('action', 'eliminar').set('id', String(this.docente.idDocente));
    this.http.delete<{ ok?: boolean; mensaje?: string; count?: number }>(`${this.baseUrl}`, { params })
      .subscribe({
        next: res => {
          if (!res || (res.ok === false && res.mensaje)) {
            this.mostrarAlerta('Error', res.mensaje || 'No fue posible eliminar.');
            return;
          }
          this.mostrarAlerta('Éxito', 'Docente eliminado correctamente.');
          this.resetForm();
          this.cargarAsignadosGlobal();
          this.cargarDocentes();
        },
        error: err => this.mostrarAlerta('Error', err.error?.mensaje || 'No fue posible eliminar el docente.')
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
    // cancelar subscripciones de búsqueda activas (si las hubiera)
    if (this.searchSub) {
      this.searchSub.unsubscribe();
      this.searchSub = undefined;
    }

    // restablecer el formulario del docente
    this.docente = {
      idDocente: undefined,
      DNIDocente: '',
      NombreDocente: '',
      Email: '',
      Telefono: '',
      GradoSeccionLabora: '',
      idEstudiante: []
    };

    // limpiar textos / flags UI
    this.selectedStudentNames = '';
    this.nombreBusqueda = '';
    this.datosCargados = false;
    this.buscandoDocente = false;
    this.searchLoading = false;
    this.emailInvalid = false;

    // restaurar asignados visibles desde el origen (allAsignados)
    this.asignados = Array.isArray(this.allAsignados) ? [...this.allAsignados] : [];

    // restaurar lista de docentes filtrados a la lista completa
    this.docentesFiltrados = Array.isArray(this.docentes) ? [...this.docentes] : [];

    // limpiar modal / buffers
    this.allStudents = [];
    this.filteredStudents = [];
    this.showStudentsModal = false;
    this.studentFilter = '';

    // limpiar cualquier "selected" que pudiera haberse quedado en estudiantes
    if (Array.isArray(this.estudiantes)) {
      this.estudiantes.forEach(s => { delete (s as any).selected; });
    }

    // recalcular disponibles con base en estudiantes + allAsignados
    this.updateAvailableStudents();

    // (opcional) forzar recalculo del nombre seleccionado mostrado
    this.onEstudiantesChange();
  }

  onEstudiantesChange(): void {
    this.selectedStudentNames = this.estudiantes
      .filter(e => this.docente.idEstudiante.includes(e.idEstudiante))
      .map(e => e.ApellidosNombres)
      .join(', ');
  }

  openStudentsModal(): void {
    // Asegura que la lista de disponibles esté actualizada
    this.updateAvailableStudents();

    // IDs asignados al docente actualmente
    const assignedIds = (this.docente && Array.isArray(this.docente.idEstudiante))
      ? this.docente.idEstudiante.map(n => Number(n)).filter(n => !isNaN(n))
      : [];

    // Mapa temporal: key = idEstudiante, value = Student (con selected)
    const map = new Map<number, Student & { selected?: boolean }>();

    // 1) Añadir todos los estudiantes NO asignados (availableStudents) - por defecto NOT selected
    this.availableStudents.forEach(s => {
      map.set(Number(s.idEstudiante), { ...s, selected: false });
    });

    // 2) Si hay un docente seleccionado, añadir también SUS estudiantes asignados y marcarlos selected = true
    if (assignedIds.length) {
      assignedIds.forEach(id => {
        const num = Number(id);
        if (isNaN(num)) return;

        if (map.has(num)) {
          // si ya está (porque no estaba asignado globalmente), marcar selected
          const existing = map.get(num)!;
          existing.selected = true;
          map.set(num, existing);
        } else {
          // si no está en availableStudents, buscar en lista completa de estudiantes
          const found = this.estudiantes.find(e => Number(e.idEstudiante) === num);
          if (found) {
            map.set(num, { ...found, selected: true });
          } else {
            // fallback: crear un placeholder si no existe en this.estudiantes
            map.set(num, {
              idEstudiante: num,
              ApellidosNombres: '-',
              idInstitucionEducativa: this.idInstitucionEducativa,
              selected: true
            });
          }
        }
      });
    }

    // 3) Convertir a array y ordenar: primero los asignados al docente (selected = true),
    //    luego los no asignados; dentro de cada grupo ordenar alfabéticamente por nombre.
    const list = Array.from(map.values()).sort((a, b) => {
      const aSel = a.selected ? 1 : 0;
      const bSel = b.selected ? 1 : 0;
      if (aSel !== bSel) return bSel - aSel; // selected (1) debe ir antes
      return (a.ApellidosNombres || '').localeCompare(b.ApellidosNombres || '');
    });

    // 4) Preparar modal
    this.allStudents = list;
    this.filteredStudents = [...this.allStudents];

    // Mostrar modal
    this.showStudentsModal = true;
  }

closeStudentsModal(): void {
  this.showStudentsModal = false;
  this.studentFilter = '';
  this.filteredStudents = [...this.allStudents];
}






  filterStudents(): void {
    const term = this.studentFilter.trim().toLowerCase();
    if (!term) {
      this.filteredStudents = [...this.allStudents];
      return;
    }
    this.filteredStudents = this.allStudents.filter(s =>
      (s.ApellidosNombres || '').toLowerCase().includes(term)
    );
  }

applyStudentsSelection(): void {
  // Asegurar que los checkboxes se reflejen
  this.allStudents = this.allStudents.map(s => ({ ...s, selected: !!s.selected }));

  // Obtener IDs seleccionados
  const seleccionados = this.allStudents
    .filter(s => !!s.selected)
    .map(s => Number(s.idEstudiante))
    .filter(n => !isNaN(n));

  // 🔹 Mantener los que ya tenía el docente + los seleccionados
  const union = Array.from(new Set([...(this.docente.idEstudiante || []), ...seleccionados]));

  this.docente.idEstudiante = union;
  this.onEstudiantesChange();

  // Recalcular asignados visual
  this.asignados = this.allAsignados.filter(id => !this.docente.idEstudiante.includes(id));

  // Cerrar modal
  this.showStudentsModal = false;
  this.studentFilter = '';
  this.filteredStudents = [...this.allStudents];
}

  goTo(page: string): void { this.navCtrl.navigateRoot(`/${page}`); }

  // getter para UI: estudiantes realmente disponibles (NO asignados)
  // Ahora devuelve también los estudiantes asignados al docente (si existe uno),
  // así el botón "Estudiantes" no se bloqueará si el docente ya tiene asignados.
  get estudiantesDisponibles(): Student[] {
    // estudiantes no asignados globalmente
    const avail = Array.isArray(this.availableStudents) ? [...this.availableStudents] : [];

    // si hay un docente con estudiantes asignados, incluirlos al inicio
    if (this.docente && Array.isArray(this.docente.idEstudiante) && this.docente.idEstudiante.length) {
      const assigned = this.estudiantes
        .filter(e => this.docente.idEstudiante.includes(e.idEstudiante))
        // evitar duplicados si por algún motivo están también en availableStudents
        .filter(a => !avail.some(x => x.idEstudiante === a.idEstudiante));

      // devolver primero asignados (si quieres que estén primero)
      return [...assigned, ...avail];
    }

    return avail;
  }

  get docentesFiltradosIndexados(): Array<DocenteView & { index: number }> {
    return this.docentesFiltrados.map(d => ({ ...d, index: d.displayId! }));
  }
}
