// src/app/graficos/graficos.page.ts

import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import 'chart.js/auto';
import { Chart, ChartConfiguration } from 'chart.js';

interface EtiquetaValor {
  label: string;
  value: number;
}

interface InstSeleccion {
  label: string;
  value: number;
  checked: boolean;
  color: string;
}

@Component({
  selector: 'app-graficos',
  templateUrl: './graficos.page.html',
  styleUrls: ['./graficos.page.scss'],
  standalone: false,
})
export class GraficosPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartDisc') chartDiscRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartIppPep') chartIppPepRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartInst') chartInstRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartFam') chartFamRef!: ElementRef<HTMLCanvasElement>;

  // ruta relativa al index.js de graficos
  private baseUrl = '/api/graficos';

  instituciones: InstSeleccion[] = [];
  institucionesFiltradas: InstSeleccion[] = [];
  nombreInstBusqueda = '';
  mostrarFiltrosInst = false;

  private chartDisc!: Chart | undefined;
  private chartIppPep!: Chart | undefined;
  private chartInst!: Chart | undefined;
  private chartFam!: Chart | undefined;

  // Para almacenar y limpiar suscripciones HTTP
  private subs: Subscription[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() {}

  ngAfterViewInit() {
    this.loadDiscapacidad();
    this.loadIppPep();
    this.loadFamilias();
    this.loadInstituciones();
  }

  /** Helper: intenta normalizar la respuesta del endpoint { ok, data } o un array directo */
  private unwrap<T>(res: any): T | null {
    if (!res) return null;
    if (res?.ok !== undefined) {
      return res.ok ? (res.data as T) : null;
    }
    if (res?.data !== undefined) return res.data as T;
    return (res as T);
  }

  private safeGetContext(ref?: ElementRef<HTMLCanvasElement>) {
    try {
      return ref?.nativeElement?.getContext('2d') ?? null;
    } catch {
      return null;
    }
  }

  private loadDiscapacidad() {
    const sub = this.http
      .get<any>(`${this.baseUrl}?action=discapacidad`)
      .subscribe(resp => {
        const data = this.unwrap<EtiquetaValor[]>(resp) || [];
        const labels = data.map(d => d.label);
        const values = data.map(d => d.value);

        const cfg: ChartConfiguration = {
          type: 'bar',
          data: {
            labels,
            datasets: [{ data: values, label: 'Cantidad' }]
          },
          options: {
            responsive: true,
            plugins: { legend: { onClick: () => {} } }
          }
        };

        if (this.chartDisc) try { this.chartDisc.destroy(); } catch (e) { /* ignore */ }
        const ctx = this.safeGetContext(this.chartDiscRef);
        if (ctx) this.chartDisc = new Chart(ctx, cfg);
      }, err => {
        console.error('Error loadDiscapacidad:', err);
      });
    this.subs.push(sub);
  }

  private loadIppPep() {
    const sub = this.http
      .get<any>(`${this.baseUrl}?action=ipp-pep`)
      .subscribe(resp => {
        const data = this.unwrap<any>(resp) || {};
        // El backend devuelve { ippSi, ippNo, ippNoEspecificado, pepSi, pepNo, pepNoEspecificado }
        const ippSi = (typeof data.ippSi === 'number') ? data.ippSi : (data?.data?.ippSi ?? 0);
        const ippNo = (typeof data.ippNo === 'number') ? data.ippNo : (data?.data?.ippNo ?? 0);
        const pepSi = (typeof data.pepSi === 'number') ? data.pepSi : (data?.data?.pepSi ?? 0);
        const pepNo = (typeof data.pepNo === 'number') ? data.pepNo : (data?.data?.pepNo ?? 0);

        const cfg: ChartConfiguration = {
          type: 'bar',
          data: {
            labels: ['IPP', 'PEP'],
            datasets: [
              { data: [ippSi, pepSi], label: 'Sí' },
              { data: [ippNo, pepNo], label: 'No' }
            ]
          },
          options: {
            responsive: true,
            plugins: { legend: { onClick: () => {} } }
          }
        };

        if (this.chartIppPep) try { this.chartIppPep.destroy(); } catch (e) { /* ignore */ }
        const ctx = this.safeGetContext(this.chartIppPepRef);
        if (ctx) this.chartIppPep = new Chart(ctx, cfg);
      }, err => {
        console.error('Error loadIppPep:', err);
      });
    this.subs.push(sub);
  }

  private loadFamilias() {
    const sub = this.http
      .get<any>(`${this.baseUrl}?action=ocupacion-familia`)
      .subscribe(resp => {
        const data = this.unwrap<EtiquetaValor[]>(resp) || [];
        const labels = data.map(d => d.label);
        const values = data.map(d => d.value);

        const cfg: ChartConfiguration = {
          type: 'bar',
          data: {
            labels,
            datasets: [{ data: values, label: 'Familias' }]
          },
          options: {
            responsive: true,
            plugins: { legend: { onClick: () => {} } }
          }
        };

        if (this.chartFam) try { this.chartFam.destroy(); } catch (e) { /* ignore */ }
        const ctx = this.safeGetContext(this.chartFamRef);
        if (ctx) this.chartFam = new Chart(ctx, cfg);
      }, err => {
        console.error('Error loadFamilias:', err);
      });
    this.subs.push(sub);
  }

  private loadInstituciones() {
    const sub = this.http
      .get<any>(`${this.baseUrl}?action=instituciones`)
      .subscribe(resp => {
        const data = this.unwrap<EtiquetaValor[]>(resp) || [];
        // asignar colores y checked por defecto
        this.instituciones = data.map((d, i) => ({
          label: d.label,
          value: d.value,
          checked: true,
          color: `hsl(${(i * 137.5) % 360} 70% 60%)`
        }));
        this.institucionesFiltradas = [...this.instituciones];

        const labels = this.instituciones.map(i => i.label);
        const values = this.instituciones.map(i => i.value);
        const colors = this.instituciones.map(i => i.color);

        const cfg: ChartConfiguration = {
          type: 'pie',
          data: {
            labels,
            datasets: [{
              data: values,
              backgroundColor: colors as any
            }]
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } }
          }
        };

        if (this.chartInst) try { this.chartInst.destroy(); } catch (e) { /* ignore */ }
        const ctx = this.safeGetContext(this.chartInstRef);
        if (ctx) this.chartInst = new Chart(ctx, cfg);

        // construir leyenda si existe el contenedor
        this.buildLegend();
      }, err => {
        console.error('Error loadInstituciones:', err);
      });
    this.subs.push(sub);
  }

  private buildLegend() {
    const legendContainer = document.getElementById('legendInst');
    if (!legendContainer || !this.chartInst || !this.chartInst.data.labels) return;

    const bg = this.chartInst!.data.datasets?.[0].backgroundColor as string[] | undefined;
    const labels = this.chartInst.data.labels || [];
    let html = '<ul class="chartjs-legend">';
    (labels as string[]).forEach((label, idx) => {
      const color = bg?.[idx] ?? '#ccc';
      html += `<li style="margin-bottom:6px;cursor:default;">
        <span style="
          display:inline-block;
          width:12px;
          height:12px;
          margin-right:6px;
          background:${color};
          vertical-align:middle;">
        </span>${label}
      </li>`;
    });
    html += '</ul>';
    legendContainer.innerHTML = html;
  }

  updateInstitucionesChart() {
    if (!this.chartInst) return;

    const sel = this.instituciones.filter(i => i.checked);
    this.chartInst.data.labels = sel.map(i => i.label);
    this.chartInst.data.datasets![0].data = sel.map(i => i.value) as any;
    this.chartInst.data.datasets![0].backgroundColor = sel.map(i => i.color) as any;
    this.chartInst.update();
    this.buildLegend();
  }

  selectAll() {
    this.instituciones.forEach(i => (i.checked = true));
    this.institucionesFiltradas.forEach(i => (i.checked = true));
    this.updateInstitucionesChart();
  }

  deselectAll() {
    this.instituciones.forEach(i => (i.checked = false));
    this.institucionesFiltradas.forEach(i => (i.checked = false));
    this.updateInstitucionesChart();
  }

  buscarInst() {
    const txt = (this.nombreInstBusqueda || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    this.institucionesFiltradas = this.instituciones.filter(i =>
      (i.label || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes(txt)
    );
  }

  toggleFiltrosInst() {
    this.mostrarFiltrosInst = !this.mostrarFiltrosInst;
  }

  onlyLetters(e: KeyboardEvent) {
    if (!/^[A-Za-z0-9À-ÿ\s]$/.test(e.key)) {
      e.preventDefault();
    }
  }

  /** Limpieza de charts y suscripciones cuando salimos de la página */
  private cleanup() {
    [this.chartDisc, this.chartIppPep, this.chartInst, this.chartFam].forEach(c => {
      if (c) {
        try { c.destroy(); } catch (e) { /* ignorar */ }
      }
    });
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
  }

  /** Ionic lifecycle hook */
  ionViewWillLeave() {
    this.cleanup();
  }

  ngOnDestroy() {
    this.cleanup();
  }
}
