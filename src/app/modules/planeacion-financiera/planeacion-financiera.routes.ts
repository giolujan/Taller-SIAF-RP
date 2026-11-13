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
  // Detalle de un registro desde el consolidado: la misma pantalla que desde la solicitud.
  {
    path: 'procesos/consolidado-pliego-estimacion-ingresos/consolidado/:id/registro/:codigo',
    data: { ambito: 'pliego' },
    loadComponent: () =>
      import('./estimacion-ingresos/pages/registro/estimacion-ingresos-registro-detalle.component').then(
        (m) => m.EstimacionIngresosRegistroDetalleComponent,
      ),
  },
  {
    path: 'procesos/consolidado-dgtp-estimacion-ingresos/consolidado/:id/registro/:codigo',
    data: { ambito: 'dgtp' },
    loadComponent: () =>
      import('./estimacion-ingresos/pages/registro/estimacion-ingresos-registro-detalle.component').then(
        (m) => m.EstimacionIngresosRegistroDetalleComponent,
      ),
  },
  // Consolidado DGTP: la misma bandeja y pantalla que el del pliego, con `ambito: 'dgtp'`.
  {
    path: 'procesos/consolidado-dgtp-estimacion-ingresos',
    data: { ambito: 'dgtp' },
    loadComponent: () =>
      import('./estimacion-ingresos/pages/consolidado-pliego/consolidado-pliego-documents.component').then(
        (m) => m.ConsolidadoPliegoDocumentsComponent,
      ),
  },
  {
    path: 'procesos/consolidado-dgtp-estimacion-ingresos/consolidado',
    data: { ambito: 'dgtp' },
    loadComponent: () =>
      import('./estimacion-ingresos/pages/consolidado-pliego/consolidado-pliego.component').then((m) => m.ConsolidadoPliegoComponent),
  },
  {
    path: 'procesos/consolidado-dgtp-estimacion-ingresos/consolidado/:id',
    data: { ambito: 'dgtp' },
    loadComponent: () =>
      import('./estimacion-ingresos/pages/consolidado-pliego/consolidado-pliego.component').then((m) => m.ConsolidadoPliegoComponent),
  },
  // Proyección DGTP de ingresos: la misma bandeja y flujo de creación que el consolidado DGTP, con `ambito: 'proyeccion'`.
  {
    path: 'procesos/proyeccion-dgtp-ingresos',
    data: { ambito: 'proyeccion' },
    loadComponent: () =>
      import('./estimacion-ingresos/pages/consolidado-pliego/consolidado-pliego-documents.component').then(
        (m) => m.ConsolidadoPliegoDocumentsComponent,
      ),
  },
  {
    path: 'procesos/proyeccion-dgtp-ingresos/proyeccion',
    data: { ambito: 'proyeccion' },
    loadComponent: () =>
      import('./estimacion-ingresos/pages/consolidado-pliego/consolidado-pliego.component').then((m) => m.ConsolidadoPliegoComponent),
  },
  {
    path: 'procesos/proyeccion-dgtp-ingresos/proyeccion/:id',
    data: { ambito: 'proyeccion' },
    loadComponent: () =>
      import('./estimacion-ingresos/pages/consolidado-pliego/consolidado-pliego.component').then((m) => m.ConsolidadoPliegoComponent),
  },
  {
    path: 'procesos/proyeccion-dgtp-ingresos/proyeccion/:id/registro/:codigo',
    data: { ambito: 'proyeccion' },
    loadComponent: () =>
      import('./estimacion-ingresos/pages/registro/estimacion-ingresos-registro-detalle.component').then(
        (m) => m.EstimacionIngresosRegistroDetalleComponent,
      ),
  },
  {
    path: 'procesos/estimacion-ingresos/solicitud/:id/registro/:codigo',
    loadComponent: () =>
      import('./estimacion-ingresos/pages/registro/estimacion-ingresos-registro-detalle.component').then(
        (m) => m.EstimacionIngresosRegistroDetalleComponent,
      ),
  },
];
