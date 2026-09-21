import type { TaskAssignee, TaskPriority } from '../types/database'

export const TASK_STAGES = [
  '12+ meses',
  '9 meses',
  '6 meses',
  '3 meses',
  '1 mes',
  'Semana de la boda',
  'Después de la boda',
] as const

export type TaskStage = (typeof TASK_STAGES)[number]

export interface TemplateTask {
  key: string
  title: string
  stage: TaskStage
  /** Días antes de la boda (negativo = después) */
  offsetDays: number
  priority: TaskPriority
  assignee: TaskAssignee
  description?: string
}

const t = (
  key: string,
  title: string,
  stage: TaskStage,
  offsetDays: number,
  priority: TaskPriority = 'media',
  assignee: TaskAssignee = 'ambos',
  description?: string,
): TemplateTask => ({ key, title, stage, offsetDays, priority, assignee, description })

/** Plantilla de tareas típicas de una boda en Colombia, de la más lejana a la más cercana */
export const TASK_TEMPLATE: TemplateTask[] = [
  t('presupuesto', 'Definir el presupuesto total y cómo repartirlo', '12+ meses', 400, 'alta'),
  t('lista-preliminar', 'Hacer la lista preliminar de invitados', '12+ meses', 395, 'alta'),
  t('estilo', 'Definir estilo, paleta de colores y tipo de boda', '12+ meses', 390),
  t('fecha', 'Confirmar fecha y hora de la boda', '12+ meses', 385, 'alta'),
  t('venue', 'Visitar y reservar el lugar de la recepción', '12+ meses', 380, 'alta'),
  t('ceremonia', 'Reservar iglesia, notaría o lugar de la ceremonia', '12+ meses', 375, 'alta'),
  t('planner', 'Decidir si contratan wedding planner o coordinador del día', '12+ meses', 370),
  t('padrinos', 'Elegir padrinos y testigos', '12+ meses', 365),

  t('fotografo', 'Cotizar y reservar fotógrafo', '9 meses', 300, 'alta'),
  t('video', 'Cotizar y reservar videógrafo', '9 meses', 295),
  t('catering', 'Hacer degustaciones y reservar el catering', '9 meses', 290, 'alta'),
  t('musica', 'Reservar DJ, orquesta o banda', '9 meses', 285, 'alta'),
  t('vestido', 'Buscar y encargar el vestido de novia', '9 meses', 280, 'alta', 'novia'),
  t('save-the-date', 'Enviar "save the date" a los invitados que viajan', '9 meses', 275),
  t('destino-luna-miel', 'Elegir el destino de la luna de miel', '9 meses', 270),

  t('traje', 'Elegir y encargar el traje del novio', '6 meses', 180, 'media', 'novio'),
  t('decoracion', 'Contratar decoración y flores', '6 meses', 175, 'alta'),
  t(
    'plan-b-lluvia',
    'Definir el plan B de lluvia con el lugar (carpa o espacio cubierto)',
    '6 meses',
    172,
    'alta',
    'ambos',
    'Mayo cae en la primera temporada de lluvias de la región Andina (IDEAM: de mediados de marzo a mediados de junio). Pregunten el costo de la carpa y hasta cuándo se puede decidir.',
  ),
  t('invitaciones-diseno', 'Diseñar y encargar las invitaciones', '6 meses', 170),
  t('mesa-regalos', 'Armar la mesa de regalos en la app', '6 meses', 165),
  t('reservas-luna-miel', 'Reservar vuelos y hotel de la luna de miel', '6 meses', 160, 'alta'),
  t('transporte', 'Reservar transporte para los novios e invitados', '6 meses', 155),
  t('maquillaje', 'Reservar maquillaje y peinado', '6 meses', 150, 'media', 'novia'),
  t('hospedaje-invitados', 'Conseguir tarifa de hotel para invitados de fuera', '6 meses', 145, 'baja'),

  t('invitaciones-envio', 'Enviar invitaciones con el link de confirmación (RSVP)', '3 meses', 90, 'alta'),
  t('curso-prematrimonial', 'Hacer el curso prematrimonial (si la ceremonia es religiosa)', '3 meses', 85),
  t('argollas', 'Comprar las argollas', '3 meses', 80, 'alta'),
  t('menu-final', 'Definir menú final, bebidas y torta', '3 meses', 75),
  t('pruebas-vestido', 'Primeras pruebas del vestido', '3 meses', 70, 'media', 'novia'),
  t('canciones', 'Elegir canciones: entrada, vals y hora loca', '3 meses', 65),
  t('recordatorios', 'Encargar recordatorios o detalles para los invitados', '3 meses', 62, 'baja'),
  t(
    'cita-notaria',
    'Pedir cita en la notaría (o la parroquia) y la lista exacta de requisitos',
    '3 meses',
    100,
    'alta',
    'ambos',
    'Las notarías recomiendan empezar el trámite del matrimonio civil entre 2 y 3 meses antes.',
  ),
  t(
    'registros-civiles',
    'Sacar los registros civiles de nacimiento (no antes: vencen a los 3 meses)',
    '3 meses',
    60,
    'alta',
    'ambos',
    'Para el matrimonio civil el registro civil de nacimiento debe tener vigencia no mayor a 3 meses. Si la ceremonia es religiosa, pidan también las partidas de bautismo.',
  ),
  t('testigos', 'Confirmar los 2 testigos (mayores de edad con cédula vigente)', '3 meses', 55),

  t(
    'radicar-notaria',
    'Radicar los documentos en la notaría',
    '1 mes',
    40,
    'alta',
    'ambos',
    'La notaría fija un edicto durante 5 días hábiles antes de poder celebrar el matrimonio civil.',
  ),
  t('seguimiento-rsvp', 'Llamar a los invitados que no han confirmado', '1 mes', 30, 'alta'),
  t('mesas', 'Armar la distribución de mesas', '1 mes', 25, 'alta'),
  t('pagos-finales', 'Programar los pagos finales a proveedores', '1 mes', 24, 'alta'),
  t('cronograma-dia', 'Cerrar el cronograma del día y enviarlo a los proveedores', '1 mes', 21, 'alta'),
  t('prueba-maquillaje', 'Prueba de maquillaje y peinado', '1 mes', 20, 'media', 'novia'),
  t('votos', 'Escribir los votos o unas palabras', '1 mes', 18),
  t('conteo-final', 'Enviar el conteo final de invitados al catering', '1 mes', 14, 'alta'),
  t('zapatos', 'Ablandar los zapatos de la boda', '1 mes', 12, 'baja'),

  t('confirmar-proveedores', 'Confirmar hora y lugar con todos los proveedores', 'Semana de la boda', 7, 'alta'),
  t('confirmar-plan-b', 'Revisar el pronóstico del IDEAM y confirmar la carpa o el plan B', 'Semana de la boda', 5, 'alta'),
  t('prueba-final', 'Prueba final de vestido y traje', 'Semana de la boda', 6, 'alta'),
  t('sobres', 'Preparar sobres con pagos y propinas del día', 'Semana de la boda', 5),
  t('maleta', 'Empacar la maleta de la luna de miel', 'Semana de la boda', 4),
  t('entregar-detalles', 'Entregar decoración y detalles en el lugar', 'Semana de la boda', 2),
  t('ensayo', 'Ensayo de la ceremonia', 'Semana de la boda', 2),
  t('descansar', 'Descansar: nada de pendientes el día antes', 'Semana de la boda', 1, 'baja'),

  t('agradecimientos', 'Enviar mensajes o tarjetas de agradecimiento', 'Después de la boda', -21, 'media'),
  t('album', 'Elegir las fotos para el álbum', 'Después de la boda', -45, 'baja'),
]
