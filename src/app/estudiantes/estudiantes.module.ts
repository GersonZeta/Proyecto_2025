import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';              // ← Importa FormsModule
import { EstudiantesPage } from './estudiantes.page';
import { EstudiantesPageRoutingModule } from './estudiantes-routing.module';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,                                        // ← Agrégalo aquí
    EstudiantesPageRoutingModule
  ],
  declarations: [EstudiantesPage]
})
export class EstudiantesPageModule {}
