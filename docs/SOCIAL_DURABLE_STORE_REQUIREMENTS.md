# Social — requisitos técnicos del registro durable

Fecha: 2026-10-25. Estado: diseño de interfaz, **sin proveedor elegido ni provisionado**.

No basta con calcular una clave SHA-256 ni conservar el historial n8n. Para
activar publicación real se necesita un almacén accesible por n8n que cumpla:

1. Claim atómico: insertar/reservar `(platform, idempotency_key)` con unicidad en
   el servidor. Un lookup seguido de insert separados no evita carreras.
2. Lease y propietario: `lease_owner`, `lease_until`, actualización condicionada
   al propietario/versión. Un intento no puede completar el trabajo de otro.
3. Fingerprint: persistir hash de copy aprobado, asset original y account_ref.
   Si cambia el payload bajo la misma clave, rechazarlo sin publicar otra copia.
4. Checkpoints: guardar container/upload ID antes de avanzar y remote post ID tan
   pronto se conoce; conservar intentos y provider request IDs sin secretos.
5. Resolución de ambigüedad: una caída después de enviar POST y antes de recibir
   respuesta **no libera automáticamente el trabajo para republicar**. Requiere
   reconciliación del proveedor o revisión manual. Un lease expirado no demuestra
   que el post no exista.
6. Lectura de nueve resultados y snapshot consolidado por `event_id`/run;
   correlación, retención y auditoría. El estado persistido debe sobrevivir
   reinicios, ejecuciones paralelas y despliegues.

## Operaciones mínimas del adaptador

| Operación | Garantía necesaria |
|---|---|
| `claim(key, fingerprint, owner)` | Atomicidad, unicidad y control de lease |
| `checkpoint(key, owner, expected_version, data)` | Compare-and-swap; IDs remotos recuperables |
| `complete(key, owner, expected_version, result)` | Resultado terminal y timestamp durable |
| `read(key)` | Permite devolver un éxito previo sin nueva llamada externa |
| `results(event_id)` | Nueve plataformas, una identidad por rama |

La clave v1 aprobada sigue siendo `sha256(event_id:platform:social_contract_version)`.
Fase 1 permite un target configurado por plataforma. Una ampliación a múltiples
cuentas requiere decidir el alcance de idempotencia y versionar el contrato.

## Pruebas obligatorias antes de quitar LIVE_BLOCKED

- Dos claims simultáneos: exactamente uno obtiene permiso para enviar.
- Un éxito previo devuelve duplicado y no hace una nueva publicación.
- Un cambio de copy/imagen/cuenta bajo la misma clave queda bloqueado.
- Caída antes del envío: lease recuperable según política.
- Timeout después del envío: no se repite POST a ciegas.
- Reinicio de n8n: se conserva el checkpoint y el resultado.
- Fallo de una plataforma: las otras ocho completan sus resultados.
- Readback real del proveedor antes de afirmar `SUCCESS` publicado.

**Decisión pendiente del chat principal:** identificar un servicio persistente ya
disponible y aprobar su uso, o seleccionar uno nuevo con sus costos/permisos.
No se asume acceso al esquema interno de n8n ni se crean tablas dentro de él.
