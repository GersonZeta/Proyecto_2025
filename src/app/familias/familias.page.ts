import { Component } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AlertController, NavController } from '@ionic/angular';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import autoTable from 'jspdf-autotable';
import jsPDF from 'jspdf';
import { environment } from 'src/environments/environment';

export interface Familia {
  idfamilia?: number;
  idestudiantes: number[];   // siempre array de numbers
  NombreEstudiante?: string;
  nombremadreapoderado: string;
  dni: string;
  direccion?: string | null;
  telefono?: string | null;
  ocupacion?: string | null;
  displayId?: number;
}

@Component({
  selector: 'app-familias',
  templateUrl: './familias.page.html',
  styleUrls: [
    './familias.page.scss',
    './familias.page2.scss',
    './familias.page3.scss'
  ],
  standalone: false,
})
export class FamiliasPage {
  private baseUrl = `${environment.apiUrl.replace(/\/$/, '')}/familias`;
  // endpoint de estudiantes (normalmente en otro handler)
  private studentsUrl = `${environment.apiUrl.replace(/\/$/, '')}/estudiantes`;

  private idInstitucionEducativa = 0;

  familias: Familia[] = [];
  familiasFiltradas: Familia[] = [];
  estudiantes: { idEstudiante: number; ApellidosNombres: string }[] = [];

  // Asignados: mantenemos allAsignados (global) y asignados (excluye los de la familia actual)
  allAsignados: number[] = [];
  asignados: number[] = [];

  familiaSeleccionada?: Familia;
  selectedStudentNames = '';

  datosCargados = false;
  seleccionMultiple = false;
  hoverActivo: boolean = false;
  busquedaMadre = '';
  busquedaRealizada = false;

  familia: Familia = {
    idestudiantes: [],
    nombremadreapoderado: '',
    dni: '',
    direccion: '',
    telefono: '',
    ocupacion: ''
  };

  // Modal estudiantes
  showStudentsModal = false;
  allStudents: Array<{ idEstudiante: number; ApellidosNombres: string; selected?: boolean; assignedToOther?: boolean }> = [];
  filteredStudents: Array<{ idEstudiante: number; ApellidosNombres: string; selected?: boolean; assignedToOther?: boolean }> = [];
  studentFilter = '';

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
    // Cargar en paralelo: estudiantes, asignados y familias.
    // openStudentsModal está preparado para el caso en que alguna de estas llamadas
    // aún no haya terminado.
    this.cargarEstudiantes();
    this.cargarAsignados();
    this.cargarFamilias();
  }

  private cargarEstudiantes(): void {
    const params = new HttpParams().set('idInstitucionEducativa', this.idInstitucionEducativa.toString());
    this.http.get<any>(this.studentsUrl, { params })
      .subscribe(res => {
        // Aceptar varias formas de respuesta: { ok, data: [...] } | [...] | { data: [...] }
        const list = res?.ok ? (res.data || []) : (Array.isArray(res) ? res : (res?.data || res?.estudiantes || []));
        this.estudiantes = (list || []).map((s: any) => ({
          idEstudiante: Number(s.idEstudiante ?? s.idestudiante ?? s.id) || 0,
          ApellidosNombres: s.ApellidosNombres ?? s.apellidosnombres ?? s.apellidos_nombre ?? ''
        })).filter((e: any) => !!e.idEstudiante);

        // Si ya hay una familia cargada (por búsqueda), actualizar selectedStudentNames
        this.selectedStudentNames = this.estudiantes
          .filter(e => this.familia.idestudiantes.includes(e.idEstudiante))
          .map(e => e.ApellidosNombres)
          .join(', ');
      }, () => {
        this.estudiantes = [];
      });
  }

  // ahora guarda allAsignados y asignados (copia)
  private cargarAsignados(): void {
    const params = new HttpParams()
      .set('idInstitucionEducativa', this.idInstitucionEducativa.toString())
      .set('action', 'estudiantes-con-familia');

    this.http.get<any>(this.baseUrl, { params })
      .subscribe({
        next: res => {
          // Aceptar varias formas: { ok: true, estudiantes: [1,2] } | { ok: true, data: [1,2] } | [1,2]
          let ids: any = [];
          if (res == null) ids = [];
          else if (Array.isArray(res)) ids = res;
          else if (res.ok && Array.isArray(res.estudiantes)) ids = res.estudiantes;
          else if (res.ok && Array.isArray(res.data)) ids = res.data;
          else if (Array.isArray(res.estudiantes)) ids = res.estudiantes;
          else if (Array.isArray(res.data)) ids = res.data;
          else ids = res;

          // Flatten to numbers (handles array of objects with id or idEstudiante)
          const numericIds = (ids || []).map((v: any) => {
            if (typeof v === 'number') return v;
            if (v == null) return NaN;
            return Number(v.idEstudiante ?? v.idestudiante ?? v.id ?? v);
          }).filter((n: number) => !isNaN(n));

          this.allAsignados = Array.from(new Set(numericIds));
          this.asignados = [...this.allAsignados];
        },
        error: () => {
          this.allAsignados = [];
          this.asignados = [];
        }
      });
  }

  private cargarFamilias(callback?: () => void): void {
    const params = new HttpParams()
      .set('idInstitucionEducativa', this.idInstitucionEducativa.toString())
      .set('action', 'listar');

    this.http.get<any>(this.baseUrl, { params })
      .subscribe({
        next: res => {
          const arr = res?.ok ? (res.data || []) : (res || []);
          this.familias = (arr || []).map((f: any, i: number) => ({
            ...f,
            idestudiantes: Array.isArray((f as any).idestudiantes)
              ? (f as any).idestudiantes.map((v: any) => Number(v)).filter((n: number) => !isNaN(n))
              : (typeof (f as any).idestudiante === 'number' ? [(f as any).idestudiante] : []),
            displayId: i + 1,
            nombremadreapoderado: f.nombremadreapoderado ?? '',
            dni: f.dni ?? '',
            direccion: f.direccion ?? null,
            telefono: f.telefono ?? null,
            ocupacion: f.ocupacion ?? null,
            NombreEstudiante: f.NombreEstudiante ?? ''
          })) as Familia[];

          this.recalcularDisplayIds();
          this.familiasFiltradas = [...this.familias];
          if (callback) callback();
        },
        error: () => {
          this.familias = [];
          this.familiasFiltradas = [];
          if (callback) callback();
        }
      });
  }

  // Este getter determina si se muestran en el modal los estudiantes ya de la familia + no asignados
  get estudiantesDisponibles() {
    const idsFamiliaActual = this.familia.idestudiantes || [];
    return this.estudiantes.filter(
      e => !this.asignados.includes(e.idEstudiante) || idsFamiliaActual.includes(e.idEstudiante)
    );
  }

  validateNumber(evt: KeyboardEvent): void { if (!/[0-9]/.test(evt.key)) evt.preventDefault(); }
  validateLetters(evt: KeyboardEvent): void { if (!/[a-zA-ZñÑáéíóúÁÉÍÓÚ ]/.test(evt.key)) evt.preventDefault(); }

  formatTelefono(event: any): void {
    const val = (event?.detail?.value ?? '').replace(/[^0-9]/g, '').slice(0, 9);
    const parts: string[] = [];
    for (let i = 0; i < val.length; i += 3) parts.push(val.substring(i, i + 3));
    this.familia.telefono = parts.join('-');
  }

  // ------------------------ BUSCAR FAMILIA ------------------------
  buscarFamilia(): void {
    this.seleccionMultiple = false;
    this.datosCargados = false;
    this.hoverActivo = false;
    this.busquedaRealizada = false;

    const raw = (this.busquedaMadre ?? '').trim();
    if (!raw) {
      this.mostrarAlerta('Error', 'Ingresa parte del nombre de la Madre/Apoderado');
      return;
    }

    const normalize = (s: string) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const q = normalize(raw);

    const matches = this.familias.filter(f => (normalize(f.nombremadreapoderado) || '').includes(q));

    if (!matches.length) { this.buscarFamiliaBackend(raw); return; }

    const filas: Familia[] = [];
    matches.forEach(f => {
      const ids = Array.isArray(f.idestudiantes) ? f.idestudiantes : [f.idestudiantes];
      const nombresArray = (f.NombreEstudiante ?? '').split(',').map(s => s.trim());
      ids.forEach((id, index) => filas.push({ ...f, idestudiantes: [Number(id)], NombreEstudiante: nombresArray[index] ?? '', displayId: f.displayId ?? f.idfamilia }));
    });

    const dniSet = new Set(matches.map(f => (f.dni ?? '').toString().trim()));
    const keySet = new Set(matches.map(f => `${(f.nombremadreapoderado ?? '').trim()}||${(f.telefono ?? '').trim()}`));

    if (dniSet.size === 1 || keySet.size === 1) {
      this.seleccionMultiple = false;
      this.familiasFiltradas = filas;

      const f = matches[0];
      this.familia = {
        ...f,
        idestudiantes: matches.reduce((acc: number[], m: Familia) => {
          const ids = Array.isArray(m.idestudiantes) ? m.idestudiantes.map((x: any) => Number(x)).filter((n: number) => !isNaN(n)) : [];
          return acc.concat(ids);
        }, [])
      };

      this.selectedStudentNames = this.estudiantes
        .filter(e => this.familia.idestudiantes.includes(e.idEstudiante))
        .map(e => e.ApellidosNombres)
        .join(', ');

      this.asignados = this.allAsignados.filter(id => !this.familia.idestudiantes.includes(id));
      this.datosCargados = true;
      this.hoverActivo = false;
      this.busquedaRealizada = true;
      return;
    }

    this.familiasFiltradas = filas;
    this.seleccionMultiple = true;
    this.hoverActivo = true;
    this.busquedaRealizada = true;
  }

  seleccionarFamilia(f: Familia): void {
    if (!f.dni) return;
    const dniPadre = f.dni.trim();
    const familiasRelacionadas = this.familias.filter(x => (x.dni?.trim() || '') === dniPadre);

    const filas: Familia[] = [];
    familiasRelacionadas.forEach(r => {
      const ids = Array.isArray(r.idestudiantes) ? r.idestudiantes : [r.idestudiantes];
      const nombresArray = (r.NombreEstudiante ?? '').split(',').map(s => s.trim());
      ids.forEach((id, index) => filas.push({ ...r, idestudiantes: [Number(id)], NombreEstudiante: nombresArray[index] ?? '', displayId: r.displayId ?? r.idfamilia }));
    });

    const todosLosIds: number[] = [];
    familiasRelacionadas.forEach((fam: Familia) => {
      const ids = Array.isArray(fam.idestudiantes) ? fam.idestudiantes : [fam.idestudiantes];
      ids.forEach(id => { const n = Number(id); if (!isNaN(n)) todosLosIds.push(n); });
    });

    const uniqueIds = Array.from(new Set(todosLosIds));

    this.familia = { ...familiasRelacionadas[0], idestudiantes: uniqueIds };

    this.selectedStudentNames = this.estudiantes
      .filter(e => this.familia.idestudiantes.includes(e.idEstudiante))
      .map(e => e.ApellidosNombres)
      .join(', ');

    this.familiasFiltradas = filas;
    this.asignados = this.allAsignados.filter(id => !this.familia.idestudiantes.includes(id));

    this.seleccionMultiple = false;
    this.datosCargados = true;
    this.hoverActivo = false;
    this.busquedaRealizada = true;
  }

  // ---------- Helper: fallback al backend ----------
  private buscarFamiliaBackend(raw: string): void {
    const params = new HttpParams()
      .set('nombreMadreApoderado', raw)
      .set('idInstitucionEducativa', String(this.idInstitucionEducativa))
      .set('action', 'buscar');

    this.http.get<any>(this.baseUrl, { params })
      .subscribe({
        next: res => {
          if (!res?.ok) { this.mostrarAlerta('Aviso', 'No se encontró la familia.'); return; }
          const rows: any[] = Array.isArray(res.data) ? res.data : [res.data];

          const mapped: Array<Familia & { NombreEstudiante?: string }> = rows.map(r => ({
            idfamilia: r.idfamilia ?? undefined,
            idestudiantes: Array.isArray(r.idestudiantes) ? r.idestudiantes.map((v: any) => Number(v)).filter((n: number) => !isNaN(n)) : (typeof r.idestudiante === 'number' ? [r.idestudiante] : (r.idestudiante ? [Number(r.idestudiante)] : [])),
            NombreEstudiante: Array.isArray(r.estudiantes) ? (r.estudiantes.map((e: any) => e.apellidosnombres).join(', ') || '') : (r.estudiantes?.apellidosnombres ?? r.NombreEstudiante ?? ''),
            nombremadreapoderado: r.nombremadreapoderado ?? r.nombremadre ?? '',
            dni: r.dni ?? '',
            direccion: r.direccion ?? null,
            telefono: r.telefono ?? null,
            ocupacion: r.ocupacion ?? null,
            displayId: undefined
          }));

          const agrupadasMap: { [k: string]: Familia & { NombreEstudiante?: string } } = {};
          for (const f of mapped) {
            const key = `${(f.nombremadreapoderado ?? '').normalize?.('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}|${(f.dni ?? '').toString().trim()}`;
            if (!agrupadasMap[key]) { agrupadasMap[key] = { ...f, idestudiantes: [...(f.idestudiantes ?? [])] }; }
            else {
              agrupadasMap[key].idestudiantes.push(...(f.idestudiantes ?? []));
              if (f.NombreEstudiante) agrupadasMap[key].NombreEstudiante = agrupadasMap[key].NombreEstudiante ? agrupadasMap[key].NombreEstudiante + ', ' + f.NombreEstudiante : f.NombreEstudiante;
            }
          }

          const resultado: Familia[] = Object.values(agrupadasMap).map(g => {
            const uniqueIds = Array.from(new Set((g.idestudiantes ?? []).map(Number).filter(n => !isNaN(n))));
            const nameParts = (g.NombreEstudiante ?? '').split(',').map(s => s.trim()).filter(Boolean);
            const uniqueNames = Array.from(new Set(nameParts));
            return { ...g, idestudiantes: uniqueIds, NombreEstudiante: uniqueNames.join(', ') };
          });

          if (resultado.length === 0) { this.mostrarAlerta('Aviso', 'No se encontró la familia.'); return; }

          if (resultado.length === 1) {
            const fam = resultado[0];
            this.familia = { ...fam };
            this.familiasFiltradas = [fam];
            this.datosCargados = true;
            this.busquedaRealizada = true;
            this.selectedStudentNames = this.estudiantes
              .filter(e => fam.idestudiantes.includes(e.idEstudiante))
              .map(e => e.ApellidosNombres)
              .join(', ');

            this.asignados = this.allAsignados.filter(id => !this.familia.idestudiantes.includes(id));
            return;
          }

          this.familiasFiltradas = resultado;
          this.busquedaRealizada = true;
          this.datosCargados = false;
          this.seleccionMultiple = true;
          this.hoverActivo = true;
        },
        error: () => { this.mostrarAlerta('Error', 'No fue posible consultar la familia en el servidor.'); }
      });
  }

  validarYRegistrar(): void {
    if (this.familia.idestudiantes.length === 0 || !this.familia.nombremadreapoderado.trim() || !this.familia.dni.trim()) {
      this.mostrarErrorCampos = true; return; }
    this.registrarFamilia();
  }

  registrarFamilia(): void {
    const payload = {
      idEstudiantes: this.familia.idestudiantes.map(Number),
      NombreMadreApoderado: this.familia.nombremadreapoderado,
      DNI: this.familia.dni,
      Direccion: this.familia.direccion || null,
      Telefono: this.familia.telefono || null,
      Ocupacion: this.familia.ocupacion || null,
      idInstitucionEducativa: this.idInstitucionEducativa
    };

    const params = new HttpParams().set('action', 'registrar');

    this.http.post<any>(this.baseUrl, payload, { params })
      .subscribe({
        next: res => {
          if (!res?.ok) { this.mostrarAlerta('Error', res?.mensaje || 'No fue posible registrar'); return; }
          this.mostrarAlerta('Éxito', `Familia registrada con ${res.inserted ?? 0} estudiante(s).`);
          this.allAsignados.push(...this.familia.idestudiantes);
          this.asignados = [...this.allAsignados];
          this.reloadAll();
        },
        error: err => { this.mostrarAlerta('Error', err.error?.error || 'No fue posible registrar'); }
      });
  }

  openStudentsModal(): void {
    this.studentFilter = '';

    const idsFamiliaActual = new Set((this.familia.idestudiantes || []).map((n: any) => Number(n)).filter((x: number) => !isNaN(x)));

    // Usar un conjunto de asignados globales (robusto si aún no llegó la respuesta)
    const assignedSet = new Set((this.allAsignados || []).map((n: any) => Number(n)).filter((x: number) => !isNaN(x)));

    this.allStudents = this.estudiantes
      .filter(e => idsFamiliaActual.has(e.idEstudiante) || !assignedSet.has(e.idEstudiante))
      .map(e => ({ ...e, selected: idsFamiliaActual.has(e.idEstudiante), assignedToOther: assignedSet.has(e.idEstudiante) && !idsFamiliaActual.has(e.idEstudiante) }));

    this.filteredStudents = [...this.allStudents];
    this.showStudentsModal = true;
  }

  filterStudents(): void {
    const txt = (this.studentFilter || '').trim().toLowerCase();
    if (!txt) { this.filteredStudents = [...this.allStudents]; return; }
    this.filteredStudents = this.allStudents.filter(s => (s.ApellidosNombres || '').toLowerCase().includes(txt));
  }

  closeStudentsModal(): void { this.showStudentsModal = false; }

  applyStudentsSelection(): void {
    const seleccionados = this.allStudents.filter(s => !!s.selected).map(s => Number(s.idEstudiante)).filter(n => !isNaN(n));
    const selNums = Array.from(new Set(seleccionados));

    this.familia.idestudiantes = selNums;
    this.selectedStudentNames = this.allStudents.filter(s => s.selected).map(s => s.ApellidosNombres).join(', ');

    // recalcular asignados: quitar los que ahora pertenecen a esta familia
    this.asignados = this.allAsignados.filter(id => !this.familia.idestudiantes.includes(id));

    this.closeStudentsModal();
  }

  // helper que usa asignados y familia actual
  get hayEstudiantesParaSeleccionar(): boolean {
    const asignadosExcluyendoActual = this.allAsignados.filter(id => !this.familia.idestudiantes.includes(id));
    const disponibles = this.estudiantes.filter(e => !asignadosExcluyendoActual.includes(e.idEstudiante));
    return disponibles.length > 0;
  }

  async confirmEliminar(): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Confirmar', message: '¿Estás seguro que deseas eliminar esta familia?', buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'Eliminar', role: 'confirm', handler: () => this.eliminarFamilia() }] });
    await alert.present();
  }

  eliminarFamilia(): void {
    if (!this.familia?.idfamilia) { this.mostrarAlerta('Error', 'No hay familia seleccionada para eliminar.'); return; }

    const params = new HttpParams().set('action', 'eliminar').set('id', String(this.familia.idfamilia));

    this.http.delete<any>(this.baseUrl, { params })
      .subscribe({
        next: res => {
          if (!res?.ok) { this.mostrarAlerta('Error', res?.mensaje || res?.error || 'No se pudo eliminar la familia.'); return; }
          this.allAsignados = this.allAsignados.filter(id => !this.familia.idestudiantes.includes(id));
          this.asignados = this.allAsignados.slice();
          this.familias = this.familias.filter(f => f.idfamilia !== this.familia.idfamilia);
          this.familiasFiltradas = this.familiasFiltradas.filter(f => f.idfamilia !== this.familia.idfamilia);
          this.recalcularDisplayIds();
          this.resetForm();
          this.mostrarAlerta('Éxito', 'Familia eliminada correctamente.');
        },
        error: err => { this.mostrarAlerta('Error', err.error?.error || 'No se pudo eliminar la familia.'); }
      });
  }

  actualizarFamilia(): void {
    let idFamilia = this.familia?.idfamilia;
    if (!idFamilia) {
      const match = this.familias.find(f => (f.dni ?? '').toString().trim() === (this.familia.dni ?? '').toString().trim() && (f.nombremadreapoderado ?? '').toString().trim() === (this.familia.nombremadreapoderado ?? '').toString().trim());
      if (match && match.idfamilia) { idFamilia = match.idfamilia; this.familia.idfamilia = match.idfamilia; }
    }

    if (!idFamilia) { this.mostrarAlerta('Error', 'No se puede actualizar porque falta el ID de la familia. Selecciona una familia válida desde la lista y vuelve a intentar.'); return; }

    if (!this.familia.nombremadreapoderado?.trim() || !this.familia.dni?.trim() || !Array.isArray(this.familia.idestudiantes) || this.familia.idestudiantes.length === 0) { this.mostrarErrorCampos = true; return; }

    const payload = { idFamilia: Number(idFamilia), idEstudiantes: (this.familia.idestudiantes || []).map((v: any) => Number(v)).filter((n: number) => !isNaN(n)), NombreMadreApoderado: this.familia.nombremadreapoderado, DNI: this.familia.dni, Direccion: this.familia.direccion || null, Telefono: this.familia.telefono || null, Ocupacion: this.familia.ocupacion || null, idInstitucionEducativa: this.idInstitucionEducativa };

    const params = new HttpParams().set('action', 'actualizar');

    this.http.put<any>(this.baseUrl, payload, { params }).subscribe({
      next: () => {
        this.mostrarAlerta('Éxito', 'Familia actualizada correctamente.');
        const savedIdFamilia = Number(this.familia.idfamilia) || null;
        const savedDni = (this.familia.dni || '').toString().trim();
        this.cargarAsignados();
        this.cargarFamilias(() => {
          let found: any = null;
          if (savedIdFamilia) found = this.familias.find(f => f.idfamilia === savedIdFamilia);
          if (!found && savedDni) found = this.familias.find(f => (f.dni || '').toString().trim() === savedDni);
          if (found) {
            this.familia = { ...found, idestudiantes: Array.isArray(found.idestudiantes) ? found.idestudiantes : [found.idestudiantes] };
            this.selectedStudentNames = this.estudiantes.filter(e => this.familia.idestudiantes.includes(e.idEstudiante)).map(e => e.ApellidosNombres).join(', ');
            this.asignados = this.allAsignados.filter(id => !this.familia.idestudiantes.includes(id));
            this.datosCargados = true;
          } else { this.resetForm(); }
        });
      },
      error: err => { console.error('Error al actualizar familia (cliente):', err); this.mostrarAlerta('Error', err.error?.error || 'No se pudo actualizar la familia. Revisa la consola y el backend.'); }
    });
  }

  showExportOptions(): void { this.mostrarAlertaExportar = true; }
  cerrarAlertaExportar(): void { this.mostrarAlertaExportar = false; }

  exportExcel(): void {
    const data = this.familiasFiltradas.map(f => ({ ID: f.displayId, Estudiantes: f.NombreEstudiante ?? '', Madre: f.nombremadreapoderado, DNI: f.dni, Dirección: f.direccion ?? '', Teléfono: f.telefono ?? '', Ocupación: f.ocupacion ?? '' }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Familias');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), 'familias.xlsx');
  }

  exportPDF(): void { const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' }); autoTable(doc, { head: [['ID', 'Estudiantes', 'Madre/Apoderado', 'DNI', 'Dirección', 'Teléfono', 'Ocupación']], body: this.familiasFiltradas.map(f => [ f.displayId?.toString() ?? '', f.NombreEstudiante ?? '', f.nombremadreapoderado, f.dni, f.direccion ?? '', f.telefono ?? '', f.ocupacion ?? '' ]), startY: 40 }); doc.save('familias.pdf'); }

  cerrarErrorCampos(): void { this.mostrarErrorCampos = false; }

  private reloadAll(): void { this.resetForm(); this.cargarFamilias(); this.cargarAsignados(); }

  private recalcularDisplayIds(): void {
    this.familias.forEach((f, index) => { f.displayId = index + 1; });
    this.familiasFiltradas = this.familiasFiltradas.map(fil => { const original = this.familias.find(f => f.idfamilia === fil.idfamilia) || this.familias.find(f => f.dni === fil.dni); return original ? { ...fil, displayId: original.displayId } : { ...fil, displayId: undefined }; });
  }

  private async mostrarAlerta(header: string, message: string) {
    const alert = await this.alertCtrl.create({ header, message, buttons: ['OK'] });
    await alert.present();
  }

  resetForm(): void {
    this.familia = { idestudiantes: [], nombremadreapoderado: '', dni: '', direccion: '', telefono: '', ocupacion: '' };
    this.datosCargados = false;
    this.seleccionMultiple = false;
    this.busquedaMadre = '';
    this.familiasFiltradas = [...this.familias];
    this.selectedStudentNames = '';
    this.busquedaRealizada = false;
    this.mostrarErrorCampos = false;
    this.mostrarAlertaExportar = false;
  }
}
