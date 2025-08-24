import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { FamiliasPageRoutingModule } from './familias-routing.module';

import { FamiliasPage } from './familias.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    FamiliasPageRoutingModule
  ],
  declarations: [FamiliasPage]
})
export class FamiliasPageModule {}
