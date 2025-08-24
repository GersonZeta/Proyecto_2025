import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SeleccionInstitucionesPage } from './seleccion-instituciones.page';

const routes: Routes = [
  {
    path: '',
    component: SeleccionInstitucionesPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SeleccionInstitucionesPageRoutingModule {}
