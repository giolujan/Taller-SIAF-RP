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
    path: 'procesos/consolidado-pliego-estimacion-ingresos',
    loadComponent: () =>
      import('./estimacion-ingresos/pages/consolidado-pliego/consolidado-pliego-documents.component').then(
        (m) => m.ConsolidadoPliegoDocumentsComponent,
      ),
  },
  {
    path: 'procesos/consolidado-pliego-estimacion-ingresos/consolidado',
    loadComponent: () =>
      import('./estimacion-ingresos/pages/consolidado-pliego/consolidado-pliego.component').then((m) => m.ConsolidadoPliegoComponent),
  },
  {
    path: 'procesos/consolidado-pliego-estimacion-ingresos/consolidado/:id',
    loadComponent: () =>
      import('./estimacion-ingresos/pages/consolidado-pliego/consolidado-pliego.component').then((m) => m.ConsolidadoPliegoComponent),
  },
  {
    path: 'procesos/estimacion-ingresos/solicitud/:id/registro/:codigo',
    loadComponent: () =>
      import('./estimacion-ingresos/pages/registro/estimacion-ingresos-registro-detalle.component').then(
        (m) => m.EstimacionIngresosRegistroDetalleComponent,
      ),
  },
];
