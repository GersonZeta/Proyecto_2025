import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./home/home.module').then( m => m.HomePageModule)
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'login-profesor',
    loadChildren: () => import('./login-profesor/login-profesor.module').then( m => m.LoginProfesorPageModule)
  },
  {
    path: 'seleccion-instituciones',
    loadChildren: () => import('./seleccion-instituciones/seleccion-instituciones.module').then( m => m.SeleccionInstitucionesPageModule)
  },
  {
    path: 'estudiantes',
    loadChildren: () => import('./estudiantes/estudiantes.module').then( m => m.EstudiantesPageModule)
  },
  {
    path: 'docentes',
    loadChildren: () => import('./docentes/docentes.module').then( m => m.DocentesPageModule)
  },
  {
    path: 'familias',
    loadChildren: () => import('./familias/familias.module').then( m => m.FamiliasPageModule)
  },
  {
    path: 'graficos',
    loadChildren: () => import('./graficos/graficos.module').then( m => m.GraficosPageModule)
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
