export const STANDARD_FIELDS = [
  'npr',
  'nit',
  'nombre',
  'bucket',
  'saldo_capital',
  'dias_mora',
  'telefono',
  'email',
  'semaforo',
  'canal_autorizado',
  'fecha_pago',
  'valor_pago',
  'estrategia'
];

export const COLUMN_ALIASES = {
  npr: ['npr', 'id_credito', 'credito', 'num_credito', 'numero_credito', 'id_obligacion', 'obligacion'],
  nit: ['nit', 'documento', 'num_documento', 'identificacion', 'cedula', 'id_cliente'],
  nombre: ['nombre', 'cliente', 'deudor', 'titular', 'razon_social', 'name'],
  bucket: ['bucket', 'tramo', 'segmento_mora', 'rango_mora', 'banda'],
  saldo_capital: ['saldo_capital', 'saldo', 'capital', 'capital_saldo', 'saldo_actual', 'deuda_capital'],
  dias_mora: ['dias_mora', 'mora_dias', 'dias_en_mora', 'edad_mora', 'days_past_due', 'dpd'],
  telefono: ['telefono', 'celular', 'movil', 'phone', 'telefono_1', 'telefono_contacto'],
  email: ['email', 'correo', 'correo_electronico', 'mail', 'e_mail'],
  semaforo: ['semaforo', 'semáforo', 'estado_riesgo', 'nivel_riesgo', 'color_riesgo'],
  canal_autorizado: ['canal_autorizado', 'canal', 'canal_permitido', 'medio_autorizado', 'canal_contacto'],
  fecha_pago: ['fecha_pago', 'fecha_de_pago', 'payment_date', 'fecha_transaccion', 'fecha'],
  valor_pago: ['valor_pago', 'monto_pago', 'pago', 'valor', 'valor_recaudo', 'amount_paid'],
  estrategia: ['estrategia', 'accion', 'plan', 'estrategia_cobranza', 'strategy'],
  concepto: ['concepto', 'descripcion', 'detalle', 'name', 'concept', 'item'],
  categoria: ['cat', 'categoria', 'category', 'rubro', 'tipo'],
  monto: ['monto', 'amount', 'valor', 'total', 'importe'],
  nota: ['nota', 'note', 'notes', 'comentario', 'observacion'],
  fecha: ['fecha', 'date', 'created_at', 'timestamp'],
  tipo: ['tipo', 'type', 'flow', 'kind']
};

export const DATASET_TYPE_RULES = {
  pagos: ['fecha_pago', 'valor_pago', 'pago', 'recaudo', 'payment', 'abono'],
  compromisos: ['compromiso', 'promesa', 'fecha_compromiso', 'valor_compromiso'],
  gestiones: ['gestion', 'resultado', 'tipificacion', 'contactabilidad', 'llamada'],
  demografico: ['ciudad', 'departamento', 'direccion', 'edad', 'genero'],
  estrategias: ['estrategia', 'campana', 'canal', 'segmento'],
  traslados: ['traslado', 'cedido', 'asignacion', 'cambio_agencia', 'cartera_cedida'],
  canal_autorizado: ['canal_autorizado', 'medio_autorizado', 'consentimiento', 'habeas_data']
};
