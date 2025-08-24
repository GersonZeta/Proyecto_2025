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

  private baseUrl = 'http://localhost:3000';

  instituciones: InstSeleccion[] = [];
  institucionesFiltradas: InstSeleccion[] = [];
  nombreInstBusqueda = '';
  mostrarFiltrosInst = false;

  private chartDisc!: Chart;
  private chartIppPep!: Chart;
  private chartInst!: Chart;
  private chartFam!: Chart;

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

  private loadDiscapacidad() {
    const sub = this.http
      .get<EtiquetaValor[]>(`${this.baseUrl}/estadisticas/discapacidad`)
      .subscribe(data => {
        const cfg: ChartConfiguration = {
          type: 'bar',
          data: {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.value), label: 'Cantidad' }]
          },
          options: {
            responsive: true,
            plugins: { legend: { onClick: () => {} } }
          }
        };
        this.chartDisc = new Chart(
          this.chartDiscRef.nativeElement.getContext('2d')!,
          cfg
        );
      });
    this.subs.push(sub);
  }

  private loadIppPep() {
    const sub = this.http
      .get<{ ippSi: number; ippNo: number; pepSi: number; pepNo: number }>(
        `${this.baseUrl}/estadisticas/ipp-pep`
      )
      .subscribe(r => {
        const cfg: ChartConfiguration = {
          type: 'bar',
          data: {
            labels: ['IPP', 'PEP'],
            datasets: [
              { data: [r.ippSi, r.pepSi], label: 'Sí' },
              { data: [r.ippNo, r.pepNo], label: 'No' }
            ]
          },
          options: {
            responsive: true,
            plugins: { legend: { onClick: () => {} } }
          }
        };
        this.chartIppPep = new Chart(
          this.chartIppPepRef.nativeElement.getContext('2d')!,
          cfg
        );
      });
    this.subs.push(sub);
  }

  private loadFamilias() {
    const sub = this.http
      .get<EtiquetaValor[]>(`${this.baseUrl}/estadisticas/ocupacion-familia`)
      .subscribe(data => {
        const cfg: ChartConfiguration = {
          type: 'bar',
          data: {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.value), label: 'Familias' }]
          },
          options: {
            responsive: true,
            plugins: { legend: { onClick: () => {} } }
          }
        };
        this.chartFam = new Chart(
          this.chartFamRef.nativeElement.getContext('2d')!,
          cfg
        );
      });
    this.subs.push(sub);
  }

  private loadInstituciones() {
    const sub = this.http
      .get<EtiquetaValor[]>(`${this.baseUrl}/estadisticas/instituciones`)
      .subscribe(data => {
        this.instituciones = data.map((d, i) => ({
          label: d.label,
          value: d.value,
          checked: true,
          color: `hsl(${(i * 137.5) % 360}, 70%, 70%)`
        }));
        this.institucionesFiltradas = [...this.instituciones];

        const cfg: ChartConfiguration = {
          type: 'pie',
          data: {
            labels: this.instituciones.map(i => i.label),
            datasets: [{
              data: this.instituciones.map(i => i.value),
              backgroundColor: this.instituciones.map(i => i.color)
            }]
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } }
          }
        };
        this.chartInst = new Chart(
          this.chartInstRef.nativeElement.getContext('2d')!,
          cfg
        );

        this.buildLegend();
      });
    this.subs.push(sub);
  }

  private buildLegend() {
    const legendContainer = document.getElementById('legendInst')!;
    const items = this.chartInst.data.labels!.map((label, idx) => ({
      text: label as string,
      fillStyle: (this.chartInst.data.datasets![0].backgroundColor as string[])[idx]
    }));
    let html = '<ul class="chartjs-legend">';
    items.forEach(item => {
      html += `<li>
        <span style="
          display:inline-block;
          width:12px;
          height:12px;
          margin-right:6px;
          background:${item.fillStyle};
          vertical-align:middle;">
        </span>${item.text}
      </li>`;
    });
    html += '</ul>';
    legendContainer.innerHTML = html;
  }

  updateInstitucionesChart() {
    const sel = this.instituciones.filter(i => i.checked);
    this.chartInst.data.labels = sel.map(i => i.label);
    this.chartInst.data.datasets![0].data = sel.map(i => i.value);
    this.chartInst.data.datasets![0].backgroundColor = sel.map(i => i.color);
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
    const txt = this.nombreInstBusqueda
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    this.institucionesFiltradas = this.instituciones.filter(i =>
      i.label
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
        c.destroy();
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
