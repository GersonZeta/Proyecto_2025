import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface Institucion {
  idInstitucionEducativa: number;
  NombreInstitucion: string;
}

interface ModalInstitucion extends Institucion {
  selected: boolean;
  editing: boolean;
  newName: string;
}

interface Profesor {
  idProfesor: number;
  Correo: string;
  NombreProfesor: string;
  Clave: string;
  TelefonoProf: string;
  Instituciones: number[];
}

@Component({
  selector: 'app-login-profesor',
  templateUrl: './login-profesor.page.html',
  styleUrls: [
    './login-profesor.page.scss',
    './login-profesor.page2.scss'
  ],

  standalone: false,
})
export class LoginProfesorPage implements OnInit {
  // Campos del formulario
  idProfesor: number | null = null;
  correo = '';
  nombreProfesor = '';
  clave = '';
  telefonoProf = '';
  showPassword = false;

  // Mensaje de error para correo
  emailError = '';

  // Datos globales
  allInstituciones: Institucion[] = [];
  institucionUsadasGlobal: Set<number> = new Set();
  institucionesSeleccionadas: number[] = [];
  datosCargados = false;

  // Modal
  showModal = false;
  modalInstituciones: ModalInstitucion[] = [];
  modalInstitucionesFiltradas: ModalInstitucion[] = [];
  filterText = '';
  newInstitutionName = '';

  originalInstituciones: number[] = [];
  newInstituciones: number[] = [];

  // Búsqueda y tabla
  searchName = '';
  profesores: Profesor[] = [];

  private baseUrl = 'http://localhost:3000';

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit() {
    this.loadAllInstituciones();
    this.loadAllProfesores();
  }

  private loadAllInstituciones() {
    this.http.get<Institucion[]>(`${this.baseUrl}/instituciones-all`).subscribe(
      insts => {
        this.allInstituciones = insts;
        this.recomputeUsedInstitutions();
      },
      () => { /* Silencioso */ }
    );
  }

  private loadAllProfesores() {
    this.http.get<Profesor[]>(`${this.baseUrl}/profesores`).subscribe(
      profs => {
        this.profesores = profs;
        this.recomputeUsedInstitutions();
      },
      () => { /* Silencioso */ }
    );
  }

  private recomputeUsedInstitutions() {
    this.institucionUsadasGlobal.clear();
    this.profesores.forEach(p =>
      p.Instituciones.forEach(id => this.institucionUsadasGlobal.add(id))
    );
  }

  clearEmailError() {
    this.emailError = '';
  }

  isFormValid(): boolean {
    return (
      this.correo.trim() !== '' &&
      this.nombreProfesor.trim() !== '' &&
      this.clave.trim() !== '' &&
      this.telefonoProf.trim() !== '' &&
      this.institucionesSeleccionadas.length > 0
    );
  }

  buscarProfesor() {
    const nombre = this.searchName.trim();
    if (!nombre) { return; }

    this.http
      .get<Profesor>(`${this.baseUrl}/buscar-profesor`, {
        params: { nombreProfesor: nombre },
      })
      .subscribe(prof => {
        this.idProfesor = prof.idProfesor;
        this.correo = prof.Correo;
        this.nombreProfesor = prof.NombreProfesor;
        this.clave = prof.Clave;
        this.telefonoProf = prof.TelefonoProf;
        this.datosCargados = true;

        this.originalInstituciones = [...prof.Instituciones];
        this.institucionesSeleccionadas = [...prof.Instituciones];

        const asignadas = prof.Instituciones.map(id => {
          const inst = this.allInstituciones.find(
            i => i.idInstitucionEducativa === id
          )!;
          return {
            ...inst,
            selected: true,
            editing: false,
            newName: inst.NombreInstitucion,
          };
        });
        const noUsadas = this.allInstituciones
          .filter(i => !this.institucionUsadasGlobal.has(i.idInstitucionEducativa))
          .map(i => ({
            ...i,
            selected: false,
            editing: false,
            newName: i.NombreInstitucion,
          }));

        this.modalInstituciones = [...asignadas, ...noUsadas];
        this.filterText = '';
        this.actualizarFiltradas();
      });
  }

  toggleModalEdit(inst: ModalInstitucion) {
    inst.editing = true;
  }

  saveModalEdit(inst: ModalInstitucion) {
    const nombre = inst.newName.trim();
    if (!nombre) { return; }

    this.http
      .put(`${this.baseUrl}/institucion/${inst.idInstitucionEducativa}`, {
        NombreInstitucion: nombre,
      })
      .subscribe({
        next: () => {
          const g = this.allInstituciones.find(
            i => i.idInstitucionEducativa === inst.idInstitucionEducativa
          )!;
          g.NombreInstitucion = nombre;
          inst.editing = false;
          this.actualizarFiltradas();
        },
        error: () => {},
      });
  }

  openModal() {
    if (!this.datosCargados) {
      this.modalInstituciones = this.allInstituciones
        .filter(i => !this.institucionUsadasGlobal.has(i.idInstitucionEducativa))
        .map(i => ({
          ...i,
          selected: false,
          editing: false,
          newName: i.NombreInstitucion,
        }));
    }
    this.filterText = '';
    this.actualizarFiltradas();
    this.showModal = true;
  }

  addInstitutionModal() {
    if (this.datosCargados) return;
    const name = this.newInstitutionName.trim().substring(0, 40);
    if (!name) return;
    this.http
      .post<Institucion>(`${this.baseUrl}/institucion`, { NombreInstitucion: name })
      .subscribe({
        next: newInst => {
          this.allInstituciones.push(newInst);
          this.modalInstituciones.push({
            ...newInst,
            selected: true,
            editing: false,
            newName: newInst.NombreInstitucion,
          });
          this.newInstitutionName = '';
          this.actualizarFiltradas();
        },
        error: () => {},
      });
  }

  applyModal() {
    const seleccion = this.modalInstituciones
      .filter(i => i.selected)
      .map(i => i.idInstitucionEducativa);

    this.institucionesSeleccionadas = [...seleccion];
    if (this.datosCargados) {
      this.profesores[0].Instituciones = [...seleccion];
      this.newInstituciones = seleccion.filter(
        id => !this.originalInstituciones.includes(id)
      );
    }
    this.closeModal();
  }

  closeModal() {
    this.showModal = false;
    this.filterText = '';
    if (!this.datosCargados) {
      this.institucionesSeleccionadas = [];
      this.newInstituciones = [];
    }
  }

  registrarProfesor() {
    const emailRegex = /.+@.+\..+/;
    if (!emailRegex.test(this.correo.trim())) {
      this.emailError = 'Ingrese un correo válido con “@” y dominio.';
      return;
    }
    if (!this.isFormValid()) return;

    const data = {
      Correo:               this.correo,
      NombreProfesorSAANEE: this.nombreProfesor,
      Clave:                this.clave,
      TelefonoSAANEE:       this.telefonoProf,
      Instituciones:        this.institucionesSeleccionadas,
    };
    this.http.post(`${this.baseUrl}/registrar-profesor`, data)
      .subscribe(() => this.resetForm());
  }

  actualizarProfesor() {
    if (!this.idProfesor) { return; }

    const data = {
      idProfesorSAANEE:      this.idProfesor,
      Correo:                this.correo,
      NombreProfesorSAANEE:  this.nombreProfesor,
      Clave:                 this.clave,
      TelefonoSAANEE:        this.telefonoProf,
      Instituciones:         this.institucionesSeleccionadas,
    };
    this.http.put(`${this.baseUrl}/actualizar-profesor`, data)
      .subscribe(() => this.resetForm());
  }

  resetForm() {
    this.idProfesor = null;
    this.correo = '';
    this.emailError = '';
    this.nombreProfesor = '';
    this.clave = '';
    this.telefonoProf = '';
    this.institucionesSeleccionadas = [];
    this.modalInstituciones = [];
    this.originalInstituciones = [];
    this.newInstituciones = [];
    this.datosCargados = false;
    this.searchName = '';
    this.loadAllProfesores();
  }

  obtenerNombreInstitucion(id: number): string {
    const inst = this.allInstituciones.find(
      i => i.idInstitucionEducativa === id
    );
    return inst ? inst.NombreInstitucion : 'Institución desconocida';
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onlyNumbers(e: KeyboardEvent) {
    if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
      e.preventDefault();
    }
  }

  formatearTelefono(e: any) {
    const d = e.target.value.replace(/\D/g, '').substring(0, 9);
    const p = d.match(/.{1,3}/g);
    this.telefonoProf = p ? p.join('-') : d;
  }

  onlyLetters(event: KeyboardEvent) {
    const key = event.key;
    const lettersRegex = /^[a-zA-ZÀ-ÿ\s]$/;
    const controlKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];

    if (!lettersRegex.test(key) && !controlKeys.includes(key)) {
      event.preventDefault();
    }
  }

  private actualizarFiltradas() {
    const txt = this.filterText.trim().toLowerCase();
    this.modalInstitucionesFiltradas = this.modalInstituciones.filter(i =>
      i.newName.toLowerCase().includes(txt)
    );
  }

  filtrarInstituciones() {
    this.actualizarFiltradas();
  }

  goToHome() {
    this.resetForm();
    this.router.navigate(['/home']);
  }
}
