# Issue 18: capacidad y retención sin borrados

Propuesta de integración; no acredita una lectura productiva ni un despliegue. Este cambio no configura purgas, no cancela paquetes y no aumenta límites.

## Regla actual que debe conservarse

| Recurso | Límite base |
| --- | --- |
| Archivo | 10 MiB |
| Paquete | 25 MiB |
| Almacenamiento global | 128 MiB |
| Paquete ordinario | 20 elementos, más el cierre acreditado reservado |
| Paquete reabierto | 40 elementos, con la última ranura reservada al cierre acreditado |
| Paquetes conservados | 1000 |

El margen de cierre existente es de 1024 bytes por paquete para controles acreditados; no es una ampliación de la capacidad editorial ni una política de retención. Los diagnósticos reciben los límites efectivos ya calculados por el Guard, por lo que describen también ese margen sin conceder otro.

Cerrar o publicar no elimina filas ni originales y no reduce el contador global de paquetes. Los registros CANCELLED también cuentan. Descartar una reserva PENDING sin original libera exactamente su ranura y bytes reservados, una sola vez, conservando la fila de auditoría. Retirar material STORED de una revisión reabierta sólo lo excluye de esa revisión: conserva original, huella, bytes y ranura.

## Diagnóstico propuesto

`diagnosePackageQuotaFailure` diferencia el límite global de paquetes, elementos ordinarios, elementos de recuperación, bytes del paquete y bytes globales. Emite únicamente códigos acotados y contadores enteros; no recibe ni devuelve fuentes o identificadores privados. El Receiver explica esa causa y mantiene el mensaje anterior si recibe un diagnóstico legacy o no confirmado.

`readPackageCapacityAudit` hace una única SELECT de agregados, sin locks ni cambios de tablas. Devuelve uso/límite/remanente, paquetes por estado, filas de elementos, reservas PENDING y bytes de originales conservados. Coteja cuota con paquetes y con el cálculo de ranuras/bytes de las reglas actuales. Una diferencia se registra para revisión, nunca se repara de manera automática: algunos descartes históricos pueden requerir reconstruir su contabilidad específica.

La lectura global debe realizarla el integrador mediante un contexto administrativo autenticado existente. El helper no añade una ruta pública ni amplía permisos. Registro mínimo desde una conexión ya autorizada:

```javascript
const connection = await pool.getConnection();
try {
  const audit = await readPackageCapacityAudit(connection);
  // Conservar únicamente este resultado acotado y su hora real de observación.
  // CAPACITY_UNCONFIRMED no acredita capacidad disponible.
  return audit;
} finally {
  connection.release();
}
```

Los campos de diferencias son `packageCount`, `quotaVsPackageBytes`, `packageVsAccountedBytes` y `packageVsCurrentRuleSlots`. El resultado declara `readOnly:true`, `authorizesDeletion:false` y `authorizesLimitChange:false`. No concede permiso de reabrir, reintentar o publicar.

## Retención propuesta para este cierre

Conservar originales, revisiones, recibos y registros históricos dentro de las cuotas vigentes. Cuando un cupo impida almacenar material, comunicar el recurso agotado; mantener operativos el estado, el cierre y el descarte seguro de reservas vacías. Antes de integrar o diagnosticar un cupo, registrar una lectura agregada actual para distinguir un límite real de una discrepancia contable.

No añadir purga automática ni liberar contadores porque una nota esté publicada. Una futura política de archivado requiere decidir explícitamente destino privado, verificación de integridad, plazo y condiciones de acceso antes de considerar cualquier eliminación; no forma parte de este parche. La cancelación de paquetes del issue 28 permanece diferida. Esta propuesta deja los datos intactos y permite comprobar la capacidad real sin convertir un resultado incierto en permiso de reintento.

## Fuente y pruebas

Helpers: `tools/telegram/guard-recovery-candidate/package-quota-diagnostic.mjs`. Builder Receiver: `receiver/build-issue18-quota-receiver-operations.mjs`, con dos cambios de parámetros construidos desde el receptor activo de 52 nodos: diagnóstico de apertura y respuesta de operación. La ruta de cierre y el ajuste de `prepareSeal` de la integración atómica se realizan aparte.

24 pruebas específicas pasan: límites ordinarios/de recuperación, márgenes efectivos de cierre, múltiples cupos simultáneos, datos numéricos inválidos, ausencia de datos privados, formatter embebible, fallback legacy, agregados SQL de sólo lectura, discrepancias visibles, originales descartados retenidos, conteos conservadores de posibles cierres legados y conservación de rutas, identidad y cuerpo del comando para componer después el parche de cierre atómico.
