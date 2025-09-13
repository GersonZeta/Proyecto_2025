// src/app/login-profesor/login-profesor.page.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

interface Institucion {
  idinstitucioneducativa: number;
  nombreinstitucion: string;
}

interface ModalInstitucion extends Institucion {
  selected: boolean;
  editing: boolean;
  newName: string;
}

interface Profesor {
  idprofesorsaanee: number;
  correo: string;
  nombreprofesorsaanee: string;
  clave: string;
  telefonosaanee: string;
  instituciones: number[];
}

@Component({
  selector: 'app-login-profesor',
  templateUrl: './login-profesor.page.html',
  styleUrls: ['./login-profesor.page.scss', './login-profesor.page2.scss'],
  standalone: false,
})
export class LoginProfesorPage implements OnInit {
  idProfesor: number | null = null;
  correo = '';
  nombreProfesor = '';
  clave = '';
  telefonoProf = '';
  showPassword = false;
  emailError = '';

  allInstituciones: Institucion[] = [];
  institucionUsadasGlobal: Set<number> = new Set();
  institucionesSeleccionadas: number[] = [];
  datosCargados = false;

  showModal = false;
  modalInstituciones: ModalInstitucion[] = [];
  modalInstitucionesFiltradas: ModalInstitucion[] = [];
  filterText = '';
  newInstitutionName = '';

  originalInstituciones: number[] = [];
  newInstituciones: number[] = [];

  searchName = '';
  profesores: Profesor[] = [];

  // usa environment.apiUrl (en prod debería ser '/api', en dev 'http://localhost:3000/api')
  private baseUrl = environment.apiUrl;

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit() {
    this.loadAllInstituciones();
    this.loadAllProfesores();
  }

  private loadAllInstituciones() {
    this.http.get<Institucion[]>(`${this.baseUrl}/instituciones-all`).subscribe(
      insts => {
        this.allInstituciones = insts || [];
        this.recomputeUsedInstitutions();
      },
      err => console.error('Error cargando instituciones:', err)
    );
  }

  private loadAllProfesores() {
    this.http.get<Profesor[]>(`${this.baseUrl}/profesores`).subscribe(
      profs => {
        this.profesores = profs || [];
        this.recomputeUsedInstitutions();
      },
      err => console.error('Error cargando profesores:', err)
    );
  }

  private recomputeUsedInstitutions() {
    this.institucionUsadasGlobal.clear();
    this.profesores.forEach(p =>
      (p.instituciones || []).forEach(id => this.institucionUsadasGlobal.add(id))
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
    if (!nombre) return;

    // bloquear Registrar mientras carga
    this.datosCargados = true;

    this.http
      .get<Profesor>(`${this.baseUrl}/profesores/buscar`, { params: { nombreProfesor: nombre } })
      .subscribe({
        next: prof => {
          this.idProfesor = prof.idprofesorsaanee;
          this.correo = prof.correo;
          this.nombreProfesor = prof.nombreprofesorsaanee;
          this.clave = prof.clave;
          this.telefonoProf = prof.telefonosaanee;

          this.datosCargados = true;

          this.originalInstituciones = [...(prof.instituciones || [])];
          this.institucionesSeleccionadas = [...(prof.instituciones || [])];

          const asignadas = (prof.instituciones || []).map(id => {
            const inst = this.allInstituciones.find(i => i.idinstitucioneducativa === id)!;
            return { ...inst, selected: true, editing: false, newName: inst?.nombreinstitucion ?? '' };
          });

          const libres = this.allInstituciones
            .filter(i => !this.institucionUsadasGlobal.has(i.idinstitucioneducativa))
            .map(i => ({ ...i, selected: false, editing: false, newName: i.nombreinstitucion }));

          this.modalInstituciones = [...asignadas, ...libres];
          this.filterText = '';
          this.actualizarFiltradas();
        },
        error: err => {
          console.error('Error buscando profesor:', err);
          this.datosCargados = false;
        }
      });
  }

  toggleModalEdit(inst: ModalInstitucion) {
    inst.editing = true;
  }

  saveModalEdit(inst: ModalInstitucion) {
    const nombre = inst.newName.trim();
    if (!nombre) return;

    this.http.put(`${this.baseUrl}/institucion/${inst.idinstitucioneducativa}`, { nombreinstitucion: nombre })
      .subscribe({
        next: () => {
          const g = this.allInstituciones.find(i => i.idinstitucioneducativa === inst.idinstitucioneducativa)!;
          if (g) g.nombreinstitucion = nombre;
          inst.editing = false;
          this.actualizarFiltradas();
        },
        error: err => console.error('Error actualizando institución:', err)
      });
  }

  openModal() {
    const libres = this.allInstituciones
      .filter(i => !this.institucionUsadasGlobal.has(i.idinstitucioneducativa) || this.institucionesSeleccionadas.includes(i.idinstitucioneducativa))
      .map(i => ({
        ...i,
        selected: this.institucionesSeleccionadas.includes(i.idinstitucioneducativa),
        editing: false,
        newName: i.nombreinstitucion
      }));

    this.modalInstituciones = libres;
    this.filterText = '';
    this.actualizarFiltradas();
    this.showModal = true;
  }

  addInstitutionModal() {
    if (this.datosCargados) return;
    const name = this.newInstitutionName.trim().substring(0, 40);
    if (!name) return;

    this.http.post<Institucion>(`${this.baseUrl}/institucion`, { nombreinstitucion: name })
      .subscribe({
        next: newInst => {
          this.allInstituciones.push(newInst);
          this.modalInstituciones.push({ ...newInst, selected: true, editing: false, newName: newInst.nombreinstitucion });
          this.newInstitutionName = '';
          this.actualizarFiltradas();
        },
        error: err => console.error('Error añadiendo institución:', err)
      });
  }

  applyModal() {
    const seleccion = this.modalInstituciones
      .filter(i => i.selected)
      .map(i => i.idinstitucioneducativa);

    if (seleccion.length === 0) {
      alert('Debe seleccionar al menos una institución');
      return;
    }

    this.institucionesSeleccionadas = [...seleccion];

    if (this.datosCargados) {
      this.newInstituciones = seleccion.filter(id => !this.originalInstituciones.includes(id));
    }

    this.modalInstituciones.forEach(inst => {
      inst.selected = this.institucionesSeleccionadas.includes(inst.idinstitucioneducativa);
    });

    this.showModal = false;
  }

  closeModal() {
    this.showModal = false;
    this.filterText = '';
  }

  registrarProfesor() {
    const emailRegex = /.+@.+\..+/;
    if (!emailRegex.test(this.correo.trim())) {
      this.emailError = 'Ingrese un correo válido con “@” y dominio.';
      return;
    }
    if (!this.isFormValid()) {
      alert('Complete todos los campos y seleccione al menos una institución');
      return;
    }

    const data = {
      correo: this.correo,
      nombreprofesorsaanee: this.nombreProfesor,
      clave: this.clave,
      telefonosaanee: this.telefonoProf,
      instituciones: this.institucionesSeleccionadas,
    };

    this.http.post(`${this.baseUrl}/profesores/registrar`, data)
      .subscribe({
        next: () => this.resetForm(),
        error: err => {
          console.error('Error al registrar profesor:', err);
          if (err.error?.detail?.includes('already exists')) {
            alert('El correo ya está registrado');
          } else {
            alert('Error al registrar profesor. Revise la consola.');
          }
        }
      });
  }

  actualizarProfesor() {
    if (!this.idProfesor) return;

    const data = {
      idprofesorsaanee: this.idProfesor,
      correo: this.correo,
      nombreprofesorsaanee: this.nombreProfesor,
      clave: this.clave,
      telefonosaanee: this.telefonoProf,
      instituciones: this.institucionesSeleccionadas,
    };

    this.http.put(`${this.baseUrl}/profesores/actualizar`, data)
      .subscribe({
        next: () => this.resetForm(),
        error: err => {
          console.error('Error al actualizar profesor:', err);
          alert('No se pudo actualizar el profesor');
        }
      });
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
    this.modalInstitucionesFiltradas = [];
    this.originalInstituciones = [];
    this.newInstituciones = [];
    this.datosCargados = false;
    this.searchName = '';
    this.loadAllProfesores();
  }

  obtenerNombreInstitucion(id: number): string {
    const inst = this.allInstituciones.find(i => i.idinstitucioneducativa === id);
    return inst ? inst.nombreinstitucion : 'Institución desconocida';
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
    const d = (e.target?.value || '').replace(/\D/g, '').substring(0, 9);
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
