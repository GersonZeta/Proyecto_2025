// app.component.ts
import { Component, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements AfterViewInit {
  ngAfterViewInit(): void {
    this.updateHairline();
    window.addEventListener('resize', () => this.updateHairline());
    // escucha cambios de zoom en visualViewport
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.updateHairline());
    }
  }

  private updateHairline() {
    const dpr = window.devicePixelRatio || 1;
    const scale = (window.visualViewport && window.visualViewport.scale) || 1;
    // hairline en CSS‑px = 1 píxel físico dividido por (dpr * zoom)
    const hairline = `${1 / (dpr * scale)}px`;
    document.documentElement.style.setProperty('--hairline', hairline);
  }
}
