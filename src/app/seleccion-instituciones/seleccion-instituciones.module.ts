import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SeleccionInstitucionesPageRoutingModule } from './seleccion-instituciones-routing.module';

import { SeleccionInstitucionesPage } from './seleccion-instituciones.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SeleccionInstitucionesPageRoutingModule
  ],
  declarations: [SeleccionInstitucionesPage]
})
export class SeleccionInstitucionesPageModule {}
