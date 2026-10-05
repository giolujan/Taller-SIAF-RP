import type { CreateDocumentProcessOption } from '../../../../shared/components/create-document/create-document.component';
import { NOMBRE_DOCUMENTO } from '../models/saldo-inicial.model';

/** Rutas e ids del proceso. Los ids existen en `DEFAULT_PROCESS_TREE` (shared/utils/process-tree.util.ts). */
export const PROCESS_ROUTE = '/procesos/registro-saldos-iniciales';
export const REQUEST_SEGMENT = 'solicitud';
export const REQUEST_ROUTE = `${PROCESS_ROUTE}/${REQUEST_SEGMENT}`;
export const CONSULTAS_ROUTE = `${PROCESS_ROUTE}/consultas`;

/** Hoja «Documentos de Saldos iniciales» del árbol de procesos: arma las migas de pan. */
export const PROCESS_ID = 'registro-saldos-iniciales-documentos';
/** Hoja «Consultas y reportes» del árbol de procesos. */
export const CONSULTAS_PROCESS_ID = 'registro-saldos-iniciales-consultas';

/** Opción del panel «Crear documento» (shell y pestaña Documentos). */
export const CREATE_DOCUMENT_OPTIONS: CreateDocumentProcessOption[] = [
  {
    id: 'registro-saldos-iniciales',
    label: 'Registro de saldos iniciales en libro banco y libreta de cuentas de registro',
    route: REQUEST_ROUTE,
    documents: [NOMBRE_DOCUMENTO],
    documentOptions: [{ label: NOMBRE_DOCUMENTO, route: REQUEST_ROUTE, actionTypes: ['Creación'] }],
    actionTypes: ['Creación'],
  },
];
