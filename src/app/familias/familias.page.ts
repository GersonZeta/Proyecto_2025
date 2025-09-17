import { Component } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AlertController, NavController } from '@ionic/angular';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import autoTable from 'jspdf-autotable';
import jsPDF from 'jspdf';

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
  private baseUrl = 'http://localhost:3000';
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
  filteredStudents: typeof this.allStudents = [];
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
    this.cargarEstudiantes();
    this.cargarAsignados();
    this.cargarFamilias();
  }

  private cargarEstudiantes(): void {
    const params = new HttpParams().set('idInstitucionEducativa', this.idInstitucionEducativa.toString());
    this.http.get<{ idEstudiante: number; ApellidosNombres: string }[]>(`${this.baseUrl}/estudiantes`, { params })
      .subscribe(list => {
        this.estudiantes = (list || []).map(s => ({ idEstudiante: Number(s.idEstudiante), ApellidosNombres: s.ApellidosNombres }));
      }, () => {
        this.estudiantes = [];
      });
  }

  // ahora guarda allAsignados y asignados (copia)
  private cargarAsignados(): void {
    const params = new HttpParams().set('idInstitucionEducativa', this.idInstitucionEducativa.toString());
    this.http.get<number[]>(`${this.baseUrl}/estudiantes-con-familia`, { params })
      .subscribe(ids => {
        this.allAsignados = (ids || []).map(n => Number(n)).filter(n => !isNaN(n));
        this.asignados = [...this.allAsignados];
      }, () => {
        this.allAsignados = [];
        this.asignados = [];
      });
  }

private cargarFamilias(callback?: () => void): void {
  const params = new HttpParams().set('idInstitucionEducativa', this.idInstitucionEducativa.toString());
  this.http.get<Familia[]>(`${this.baseUrl}/familias-estudiante`, { params })
    .subscribe(list => {
      const arr = list || [];
      this.familias = arr.map((f, i) => ({
        ...f,
        idestudiantes: Array.isArray((f as any).idestudiantes)
          ? (f as any).idestudiantes.map((v: any) => Number(v)).filter((n: number) => !isNaN(n))
          : (typeof (f as any).idestudiante === 'number' ? [(f as any).idestudiante] : []),
        // displayId VISUAL: siempre índice + 1 (1..N)
        displayId: i + 1,
        nombremadreapoderado: f.nombremadreapoderado ?? '',
        dni: f.dni ?? '',
        direccion: f.direccion ?? null,
        telefono: f.telefono ?? null,
        ocupacion: f.ocupacion ?? null,
        NombreEstudiante: f.NombreEstudiante ?? ''
      })) as Familia[];

      // recalcula para mantener secuencia consistente después de transformaciones
      this.recalcularDisplayIds();
      this.familiasFiltradas = [...this.familias];
      if (callback) callback();
    }, () => {
      this.familias = [];
      this.familiasFiltradas = [];
      if (callback) callback();
    });
}


  // Este getter determina si se muestran en el modal los estudiantes ya de la familia + no asignados
get estudiantesDisponibles() {
  const idsFamiliaActual = this.familia.idestudiantes || [];
  return this.estudiantes.filter(
    e => !this.asignados.includes(e.idEstudiante) || idsFamiliaActual.includes(e.idEstudiante)
  );
}


  validateNumber(evt: KeyboardEvent): void {
    if (!/[0-9]/.test(evt.key)) evt.preventDefault();
  }

  validateLetters(evt: KeyboardEvent): void {
    if (!/[a-zA-ZñÑáéíóúÁÉÍÓÚ ]/.test(evt.key)) evt.preventDefault();
  }

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

  // Filtrar familias ya cargadas
  const matches = this.familias.filter(f =>
    (normalize(f.nombremadreapoderado) || '').includes(q)
  );

  if (!matches.length) {
    this.buscarFamiliaBackend(raw);
    return;
  }

  // Generar filas individuales por estudiante
  const filas: Familia[] = [];
  matches.forEach(f => {
    const ids = Array.isArray(f.idestudiantes) ? f.idestudiantes : [f.idestudiantes];
    const nombresArray = (f.NombreEstudiante ?? '').split(',').map(s => s.trim());

    ids.forEach((id, index) => {
      filas.push({
        ...f,
        idestudiantes: [Number(id)],
        NombreEstudiante: nombresArray[index] ?? '',
        displayId: f.displayId ?? f.idfamilia
      });
    });
  });

  // Comprobar si todas las filas pertenecen al mismo padre
  const dniSet = new Set(matches.map(f => (f.dni ?? '').toString().trim()));
  const keySet = new Set(matches.map(f =>
    `${(f.nombremadreapoderado ?? '').trim()}||${(f.telefono ?? '').trim()}`
  ));

  if (dniSet.size === 1 || keySet.size === 1) {
    // Solo un padre -> auto-seleccionar
    this.seleccionMultiple = false;
    this.familiasFiltradas = filas; // 👈 filas separadas en la tabla

    // 👇 familia consolidada con todos los hijos
    const f = matches[0];
    this.familia = {
      ...f,
      idestudiantes: matches.reduce((acc: number[], m: Familia) => {
        const ids = Array.isArray(m.idestudiantes)
          ? m.idestudiantes.map((x: any) => Number(x)).filter((n: number) => !isNaN(n))
          : [];
        return acc.concat(ids);
      }, [])
    };

    this.selectedStudentNames = this.estudiantes
      .filter(e => this.familia.idestudiantes.includes(e.idEstudiante))
      .map(e => e.ApellidosNombres)
      .join(', ');

    // actualizar asignados para permitir editar correctamente
    this.asignados = this.allAsignados.filter(id => !this.familia.idestudiantes.includes(id));

    this.datosCargados = true;
    this.hoverActivo = false;
    this.busquedaRealizada = true;
    return;
  }

  // Múltiples padres -> mostrar todas las filas para elegir
  this.familiasFiltradas = filas;
  this.seleccionMultiple = true;
  this.hoverActivo = true;
  this.busquedaRealizada = true;
}

  seleccionarFamilia(f: Familia): void {
    if (!f.dni) return;

    const dniPadre = f.dni.trim();

    // 1) Todas las familias relacionadas con este padre
    const familiasRelacionadas = this.familias.filter(x => (x.dni?.trim() || '') === dniPadre);

    // 2) Generar filas por cada estudiante de cada familia relacionada
    const filas: Familia[] = [];
    familiasRelacionadas.forEach(r => {
      const ids = Array.isArray(r.idestudiantes) ? r.idestudiantes : [r.idestudiantes];
      const nombresArray = (r.NombreEstudiante ?? '').split(',').map(s => s.trim());

      ids.forEach((id, index) => {
        filas.push({
          ...r,
          idestudiantes: [Number(id)],
          NombreEstudiante: nombresArray[index] ?? '',
          displayId: r.displayId ?? r.idfamilia
        });
      });
    });

    // 3) Consolidar todos los ids (normalizar a number y quitar NaN)
    const todosLosIds: number[] = [];
    familiasRelacionadas.forEach((fam: Familia) => {
      const ids = Array.isArray(fam.idestudiantes) ? fam.idestudiantes : [fam.idestudiantes];
      ids.forEach(id => {
        const n = Number(id);
        if (!isNaN(n)) todosLosIds.push(n);
      });
    });

    const uniqueIds = Array.from(new Set(todosLosIds));

    this.familia = {
      ...familiasRelacionadas[0],
      idestudiantes: uniqueIds
    };

    // 4) actualizar nombres seleccionados
    this.selectedStudentNames = this.estudiantes
      .filter(e => this.familia.idestudiantes.includes(e.idEstudiante))
      .map(e => e.ApellidosNombres)
      .join(', ');

    // 5) actualizar tabla y asignados
    this.familiasFiltradas = filas;
    this.asignados = this.allAsignados.filter(id => !this.familia.idestudiantes.includes(id));

    // UI
    this.seleccionMultiple = false;
    this.datosCargados = true;
    this.hoverActivo = false;
    this.busquedaRealizada = true;
  }

  // ---------- Helper: fallback al backend ----------
  private buscarFamiliaBackend(raw: string): void {
    const params = new HttpParams()
      .set('nombreMadreApoderado', raw)
      .set('idInstitucionEducativa', String(this.idInstitucionEducativa));

    this.http.get<any>(`${this.baseUrl}/buscar-familia`, { params })
      .subscribe({
        next: res => {
          if (!res) {
            this.mostrarAlerta('Aviso', 'No se encontró la familia.');
            return;
          }

          const rows: any[] = Array.isArray(res) ? res : [res];

          const mapped: Array<Familia & { NombreEstudiante?: string }> = rows.map(r => ({
            idfamilia: r.idfamilia ?? undefined,
            idestudiantes: Array.isArray(r.idestudiantes)
              ? r.idestudiantes.map((v: any) => Number(v)).filter((n: number) => !isNaN(n))
              : (typeof r.idestudiante === 'number'
                  ? [r.idestudiante]
                  : (r.idestudiante ? [Number(r.idestudiante)] : [])),
            NombreEstudiante: Array.isArray(r.estudiantes)
              ? (r.estudiantes.map((e: any) => e.apellidosnombres).join(', ') || '')
              : (r.estudiantes?.apellidosnombres ?? r.NombreEstudiante ?? ''),
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
            if (!agrupadasMap[key]) {
              agrupadasMap[key] = { ...f, idestudiantes: [...(f.idestudiantes ?? [])] };
            } else {
              agrupadasMap[key].idestudiantes.push(...(f.idestudiantes ?? []));
              if (f.NombreEstudiante) {
                agrupadasMap[key].NombreEstudiante = agrupadasMap[key].NombreEstudiante
                  ? agrupadasMap[key].NombreEstudiante + ', ' + f.NombreEstudiante
                  : f.NombreEstudiante;
              }
            }
          }

          const resultado: Familia[] = Object.values(agrupadasMap).map(g => {
            const uniqueIds = Array.from(new Set((g.idestudiantes ?? []).map(Number).filter(n => !isNaN(n))));
            const nameParts = (g.NombreEstudiante ?? '').split(',').map(s => s.trim()).filter(Boolean);
            const uniqueNames = Array.from(new Set(nameParts));
            return {
              ...g,
              idestudiantes: uniqueIds,
              NombreEstudiante: uniqueNames.join(', ')
            };
          });

          if (resultado.length === 0) {
            this.mostrarAlerta('Aviso', 'No se encontró la familia.');
            return;
          }

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
        error: () => {
          this.mostrarAlerta('Error', 'No fue posible consultar la familia en el servidor.');
        }
      });
  }

  validarYRegistrar(): void {
    if (
      this.familia.idestudiantes.length === 0 ||
      !this.familia.nombremadreapoderado.trim() ||
      !this.familia.dni.trim()
    ) {
      this.mostrarErrorCampos = true;
      return;
    }
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

    this.http.post<{ inserted: number; familias?: any[] }>(`${this.baseUrl}/registrar-familia`, payload)
      .subscribe({
        next: res => {
          this.mostrarAlerta('Éxito', `Familia registrada con ${res.inserted ?? 0} estudiante(s).`);
          this.allAsignados.push(...this.familia.idestudiantes);
          this.asignados = [...this.allAsignados];
          this.reloadAll();
        },
        error: err => {
          this.mostrarAlerta('Error', err.error?.error || 'No fue posible registrar');
        }
      });
  }
openStudentsModal(): void {
  this.studentFilter = '';

  const idsFamiliaActual = new Set(
    (this.familia.idestudiantes || []).map((n: any) => Number(n)).filter((x: number) => !isNaN(x))
  );

  // Mostrar SOLO:
  // - estudiantes que ya pertenecen a esta familia (idsFamiliaActual)
  // - O estudiantes que NO están asignados globalmente (no están en allAsignados)
  this.allStudents = this.estudiantes
    .filter(e => idsFamiliaActual.has(e.idEstudiante) || !this.allAsignados.includes(e.idEstudiante))
    .map(e => ({
      ...e,
      selected: idsFamiliaActual.has(e.idEstudiante),
      // optional flag if you want to show diference in UI
      assignedToOther: this.allAsignados.includes(e.idEstudiante) && !idsFamiliaActual.has(e.idEstudiante)
    }));

  this.filteredStudents = [...this.allStudents];
  this.showStudentsModal = true;
}


filterStudents(): void {
  const q = (this.studentFilter || '').toLowerCase().trim();
  if (!q) {
    this.filteredStudents = [...this.allStudents];
    return;
  }
  this.filteredStudents = this.allStudents.filter(s =>
    (s.ApellidosNombres || '').toLowerCase().includes(q)
  );
}

closeStudentsModal(): void {
  this.showStudentsModal = false;
  this.filteredStudents = [];
}


applyStudentsSelection(): void {
  // 1) Obtener seleccionados del modal
  const seleccionados = this.allStudents
    .filter(s => !!s.selected)
    .map(s => Number(s.idEstudiante));

  // 2) Actualizar familia.idestudiantes
  this.familia.idestudiantes = [...seleccionados];

  // 3) Actualizar nombres concatenados
  this.selectedStudentNames = this.estudiantes
    .filter(e => this.familia.idestudiantes.includes(e.idEstudiante))
    .map(e => e.ApellidosNombres)
    .join(', ');

  // 4) Ajustar asignados (los que no pertenecen a la familia quedan bloqueados)
  this.asignados = this.allAsignados.filter(
    id => !this.familia.idestudiantes.includes(id)
  );

  // 5) Cerrar modal
  this.closeStudentsModal();
}

  // helper que usa asignados y familia actual
  get hayEstudiantesParaSeleccionar(): boolean {
    const asignadosExcluyendoActual = this.allAsignados.filter(id => !this.familia.idestudiantes.includes(id));
    const disponibles = this.estudiantes.filter(e => !asignadosExcluyendoActual.includes(e.idEstudiante));
    return disponibles.length > 0;
  }

  // ------------------- LOS MÉTODOS QUE FALTABAN EN TU ERROR -------------------

  // Mostrar confirmación antes de eliminar
  async confirmEliminar(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar',
      message: '¿Estás seguro que deseas eliminar esta familia?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'confirm', handler: () => this.eliminarFamilia() }
      ]
    });
    await alert.present();
  }

  // Eliminar familia (HTTP DELETE)
  eliminarFamilia(): void {
    if (!this.familia?.idfamilia) {
      this.mostrarAlerta('Error', 'No hay familia seleccionada para eliminar.');
      return;
    }

    this.http.delete<{ error?: string }>(`${this.baseUrl}/eliminar-familia/${this.familia.idfamilia}`)
      .subscribe({
        next: res => {
          // si el backend devuelve un error en body
          if ((res as any)?.error) {
            this.mostrarAlerta('Error', (res as any).error);
            return;
          }

          // Quitar estudiantes de la lista de asignados (los que tenía esta familia)
          this.allAsignados = this.allAsignados.filter(id => !this.familia.idestudiantes.includes(id));
          this.asignados = this.allAsignados.slice();

          // Quitar la familia de los arrays locales
          this.familias = this.familias.filter(f => f.idfamilia !== this.familia.idfamilia);
          this.familiasFiltradas = this.familiasFiltradas.filter(f => f.idfamilia !== this.familia.idfamilia);

          // Recalcular displayId
          this.recalcularDisplayIds();

          this.resetForm();
          this.mostrarAlerta('Éxito', 'Familia eliminada correctamente.');
        },
        error: err => {
          this.mostrarAlerta('Error', err.error?.error || 'No se pudo eliminar la familia.');
        }
      });
  }

  // Actualizar familia (HTTP PUT)
actualizarFamilia(): void {
  // Intentar obtener idFamilia confiable
  let idFamilia = this.familia?.idfamilia;

  // Si no viene, intentar resolverlo buscando por dni + nombre en el listado cargado
  if (!idFamilia) {
    const match = this.familias.find(f =>
      (f.dni ?? '').toString().trim() === (this.familia.dni ?? '').toString().trim() &&
      (f.nombremadreapoderado ?? '').toString().trim() === (this.familia.nombremadreapoderado ?? '').toString().trim()
    );
    if (match && match.idfamilia) {
      idFamilia = match.idfamilia;
      // also set locally so future ops have it
      this.familia.idfamilia = match.idfamilia;
    }
  }

  if (!idFamilia) {
    // Mensaje claro: no podemos actualizar si no tenemos id de familia
    this.mostrarAlerta('Error', 'No se puede actualizar porque falta el ID de la familia. Selecciona una familia válida desde la lista y vuelve a intentar.');
    return;
  }

  // Validación mínima
  if (
    !this.familia.nombremadreapoderado?.trim() ||
    !this.familia.dni?.trim() ||
    !Array.isArray(this.familia.idestudiantes) ||
    this.familia.idestudiantes.length === 0
  ) {
    this.mostrarErrorCampos = true;
    return;
  }

  // Construir payload con números
  const payload = {
    idFamilia: Number(idFamilia),
    idEstudiantes: (this.familia.idestudiantes || []).map((v: any) => Number(v)).filter((n: number) => !isNaN(n)),
    NombreMadreApoderado: this.familia.nombremadreapoderado,
    DNI: this.familia.dni,
    Direccion: this.familia.direccion || null,
    Telefono: this.familia.telefono || null,
    Ocupacion: this.familia.ocupacion || null,
    idInstitucionEducativa: this.idInstitucionEducativa
  };

  // Guardar copia de los ids anteriores por si quieres comparar (opcional, útil para debugging)
  // const prevIds = [...(this.familias.find(f => f.idfamilia === idFamilia)?.idestudiantes || [])];

this.http.put(`${this.baseUrl}/actualizar-familia`, payload)
  .subscribe({
    next: () => {
      this.mostrarAlerta('Éxito', 'Familia actualizada correctamente.');
      // Guardamos la clave para re-selección (preferir idfamilia si la tienes, sino DNI)
      const savedIdFamilia = Number(this.familia.idfamilia) || null;
      const savedDni = (this.familia.dni || '').toString().trim();

      // recargar asignados y familias, y luego re-seleccionar y resetear formulario
      this.cargarAsignados();
      this.cargarFamilias(() => {
        // intentar re-seleccionar por idfamilia
        let found = null;
        if (savedIdFamilia) found = this.familias.find(f => f.idfamilia === savedIdFamilia);
        if (!found && savedDni) found = this.familias.find(f => (f.dni || '').toString().trim() === savedDni);

        if (found) {
          // si quieres abrir la familia en el formulario en vez de resetear
          this.familia = { ...found, idestudiantes: Array.isArray(found.idestudiantes) ? found.idestudiantes : [found.idestudiantes] };
          this.selectedStudentNames = this.estudiantes
            .filter(e => this.familia.idestudiantes.includes(e.idEstudiante))
            .map(e => e.ApellidosNombres).join(', ');
          this.asignados = this.allAsignados.filter(id => !this.familia.idestudiantes.includes(id));
          this.datosCargados = true;
        } else {
          // si no lo encontramos, limpias (mantén esto si quieres cerrar el formulario)
          this.resetForm();
        }
      });
    },
    error: err => {
      console.error('Error al actualizar familia (cliente):', err);
      this.mostrarAlerta('Error', err.error?.error || 'No se pudo actualizar la familia. Revisa la consola y el backend.');
    }
  });

}


  // Exportaciones
  showExportOptions(): void {
    this.mostrarAlertaExportar = true;
  }

  cerrarAlertaExportar(): void {
    this.mostrarAlertaExportar = false;
  }

  exportExcel(): void {
    const data = this.familiasFiltradas.map(f => ({
      ID: f.displayId,
      Estudiantes: f.NombreEstudiante ?? '',
      Madre: f.nombremadreapoderado,
      DNI: f.dni,
      Dirección: f.direccion ?? '',
      Teléfono: f.telefono ?? '',
      Ocupación: f.ocupacion ?? ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Familias');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), 'familias.xlsx');
  }

  exportPDF(): void {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    autoTable(doc, {
      head: [['ID', 'Estudiantes', 'Madre/Apoderado', 'DNI', 'Dirección', 'Teléfono', 'Ocupación']],
      body: this.familiasFiltradas.map(f => [
        f.displayId?.toString() ?? '',
        f.NombreEstudiante ?? '',
        f.nombremadreapoderado,
        f.dni,
        f.direccion ?? '',
        f.telefono ?? '',
        f.ocupacion ?? ''
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

private recalcularDisplayIds(): void {
  this.familias.forEach((f, index) => {
    f.displayId = index + 1;
  });

  // Asegurar que familiasFiltradas herede los displayId visuales correctos
  this.familiasFiltradas = this.familiasFiltradas.map(fil => {
    const original = this.familias.find(f => f.idfamilia === fil.idfamilia) || this.familias.find(f => f.dni === fil.dni);
    return original ? { ...fil, displayId: original.displayId } : { ...fil, displayId: undefined };
  });
}



  private async mostrarAlerta(header: string, message: string) {
    const alert = await this.alertCtrl.create({ header, message, buttons: ['OK'] });
    await alert.present();
  }

  resetForm(): void {
    this.familia = {
      idestudiantes: [],
      nombremadreapoderado: '',
      dni: '',
      direccion: '',
      telefono: '',
      ocupacion: ''
    };
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
