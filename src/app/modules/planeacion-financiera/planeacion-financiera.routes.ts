import { Routes } from '@angular/router';

/** Procesos de «Planeación financiera»: Flujos de caja proyectados > Estimación de ingresos. */
export const PLANEACION_FINANCIERA_ROUTES: Routes = [
  {
    path: 'procesos/estimacion-ingresos',
    loadComponent: () =>
      import('./estimacion-ingresos/pages/documents/estimacion-ingresos-documents.component').then(
        (m) => m.EstimacionIngresosDocumentsComponent,
      ),
  },
  {
    path: 'procesos/estimacion-ingresos/solicitud',
    loadComponent: () =>
      import('./estimacion-ingresos/pages/solicitud/estimacion-ingresos-solicitud.component').then(
        (m) => m.EstimacionIngresosSolicitudComponent,
      ),
  },
  {
    path: 'procesos/estimacion-ingresos/solicitud/:id',
    loadComponent: () =>
      import('./estimacion-ingresos/pages/solicitud/estimacion-ingresos-solicitud.component').then(
        (m) => m.EstimacionIngresosSolicitudComponent,
      ),
  },
  {
    path: 'procesos/estimacion-ingresos/solicitud/:id/clasificador/:indice',
    loadComponent: () =>
      import('./estimacion-ingresos/pages/clasificador/estimacion-ingresos-clasificador.component').then(
        (m) => m.EstimacionIngresosClasificadorComponent,
      ),
  },
];
