import { Routes } from '@angular/router';

/** Proceso de ejemplo del taller: Documentos y registros, la solicitud y la consulta. */
export const TESORERIA_ROUTES: Routes = [
  {
    path: 'procesos/registro-cuentas-bancarias',
    loadComponent: () =>
      import('./cuentas-bancarias/pages/documents/cuentas-bancarias-documents.component').then(
        (m) => m.CuentasBancariasDocumentsComponent,
      ),
  },
  {
    path: 'procesos/registro-cuentas-bancarias/solicitud',
    loadComponent: () =>
      import('./cuentas-bancarias/pages/solicitud/cuenta-bancaria-request.component').then(
        (m) => m.CuentaBancariaRequestComponent,
      ),
  },
  {
    path: 'procesos/registro-cuentas-bancarias/solicitud/:id',
    loadComponent: () =>
      import('./cuentas-bancarias/pages/solicitud/cuenta-bancaria-request.component').then(
        (m) => m.CuentaBancariaRequestComponent,
      ),
  },
  {
    path: 'procesos/registro-cuentas-bancarias/consultas',
    loadComponent: () =>
      import('./cuentas-bancarias/pages/consultas/cuentas-bancarias-consultas.component').then(
        (m) => m.CuentasBancariasConsultasComponent,
      ),
  },
  {
    path: 'procesos/registro-saldos-iniciales',
    loadComponent: () =>
      import('./saldos-iniciales/pages/documents/saldos-iniciales-documents.component').then(
        (m) => m.SaldosInicialesDocumentsComponent,
      ),
  },
  {
    path: 'procesos/registro-saldos-iniciales/solicitud',
    loadComponent: () =>
      import('./saldos-iniciales/pages/solicitud/saldo-inicial-request.component').then(
        (m) => m.SaldoInicialRequestComponent,
      ),
  },
  {
    path: 'procesos/registro-saldos-iniciales/solicitud/:id',
    loadComponent: () =>
      import('./saldos-iniciales/pages/solicitud/saldo-inicial-request.component').then(
        (m) => m.SaldoInicialRequestComponent,
      ),
  },
  {
    path: 'procesos/registro-saldos-iniciales/consultas',
    loadComponent: () =>
      import('./saldos-iniciales/pages/consultas/saldos-iniciales-consultas.component').then(
        (m) => m.SaldosInicialesConsultasComponent,
      ),
  },
  {
    path: 'procesos/ingresos-tributarios-sunat',
    loadComponent: () =>
      import('./ingresos-tributarios-sunat/pages/documents/ingresos-tributarios-sunat-documents.component').then(
        (m) => m.IngresosTributariosSunatDocumentsComponent,
      ),
  },
  {
    path: 'procesos/ingresos-tributarios-sunat/documento/:id',
    loadComponent: () =>
      import('./ingresos-tributarios-sunat/pages/documento/ingreso-tributario-detalle.component').then(
        (m) => m.IngresoTributarioDetalleComponent,
      ),
  },
];
