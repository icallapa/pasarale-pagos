**DOCUMENTO DE REQUERIMIENTOS DE SOFTWARE**

**Pasarela de Pagos con QR Interoperable**

*Bolivia*

| Versión | 1.0.0 |
| :---- | :---- |
| **Estado** | Borrador |
| **Fecha** | 28 de mayo de 2026 |
| **Clasificación** | Confidencial |

# **1\. Introducción**

## **1.1 Propósito del Documento**

Este documento define los Requerimientos de Software (SRS) para la implementación de una Pasarela de Pagos con Código QR Interoperable orientada al mercado financiero boliviano. El documento cubre los requerimientos funcionales, no funcionales, de seguridad, regulatorios y de integración necesarios para el desarrollo, certificación y despliegue del sistema.

El sistema está concebido bajo una arquitectura de microservicios (NestJS), regulado por los lineamientos del Banco Central de Bolivia (BCB) y la Autoridad de Supervisión del Sistema Financiero (ASFI), y orientado a comercios B2B que requieren cobros digitales mediante QR dinámico.

## **1.2 Alcance del Sistema**

La pasarela cubrirá las siguientes capacidades principales:

* Generación dinámica de QR de cobro conforme al estándar EMVCo QR Code Specification.

* Procesamiento de pagos a través de los switches bancarios de las entidades financieras bolivianas habilitadas por el BCB.

* Aprovisionamiento y gestión de cuentas de comercios (onboarding KYC).

* Notificaciones en tiempo real mediante webhooks a los sistemas de los comercios.

* Conciliación automática con las cámaras de compensación bolivianas.

* Exposición de APIs REST seguras para integración de terceros.

## **1.3 Definiciones y Acrónimos**

| Término / Acrónimo | Definición |
| ----- | ----- |
| BCB | Banco Central de Bolivia — ente emisor y regulador del sistema de pagos. |
| ASFI | Autoridad de Supervisión del Sistema Financiero. |
| QR | Quick Response Code. Código bidimensional de respuesta rápida. |
| EMVCo | Consorcio internacional (Europay, Mastercard, Visa) que define estándares de pagos con chip y QR. |
| KYC | Know Your Customer — proceso regulatorio de verificación de identidad del comercio. |
| API Key | Llave de autenticación criptográfica para acceso al API REST de la pasarela. |
| Webhook | Callback HTTP POST enviado por la pasarela al servidor del comercio para notificar eventos. |
| SRS | Software Requirements Specification — Especificación de Requerimientos de Software. |
| UUID | Universally Unique Identifier — identificador único utilizado como clave primaria en la base de datos. |
| NUMERIC | Tipo de dato PostgreSQL de precisión exacta, utilizado para montos monetarios. |
| BOB | Boliviano — moneda oficial de Bolivia (ISO 4217). |
| Adquirente | Entidad financiera que procesa las transacciones de pago en nombre del comercio. |

## **1.4 Marco Regulatorio Aplicable**

* Reglamento de Medios de Pago Electrónicos del BCB (Resolución de Directorio N.° 082/2020 y actualizaciones).

* Ley N.° 393 de Servicios Financieros (Bolivia) — Artículos relativos a medios de pago digitales.

* Disposiciones ASFI sobre prevención de legitimación de ganancias ilícitas (PLD/FT).

* Estándar técnico EMVCo QR Code Specification for Payment Systems v1.1.

* Normativa de protección de datos personales aplicable en Bolivia.

# **2\. Descripción General del Sistema**

## **2.1 Perspectiva del Producto**

La pasarela operará como intermediario tecnológico entre los comercios afiliados (clientes B2B) y el ecosistema bancario boliviano. El sistema no retiene fondos propios; actúa como orquestador de mensajería de pago entre el comercio, el banco adquirente y la cámara de compensación.

## **2.2 Actores del Sistema**

| Actor | Rol | Interacción Principal |
| ----- | ----- | ----- |
| Comercio (Merchant) | Cliente B2B que utiliza la pasarela | Consume la API REST para generar cobros QR y recibe webhooks de confirmación. |
| Banco Adquirente | Entidad financiera procesadora | Provee el string QR y confirma la liquidación de la transacción. |
| Cámara de Compensación | BCB / entidad de cuadratura | Envía archivos de conciliación al Settlement Service. |
| Administrador | Operador interno de la pasarela | Gestiona comercios, configuraciones de comisiones y monitoreo. |
| Pagador (Payer) | Cliente final del comercio | Escanea el QR desde su aplicación bancaria y autoriza el pago. |

## **2.3 Restricciones Generales**

* El sistema debe operar exclusivamente en territorio boliviano y bajo moneda BOB.

* Todos los flujos monetarios deben ser auditables y trazables para cumplimiento regulatorio ASFI/BCB.

* La latencia de generación del QR no debe superar los 3 segundos en condiciones normales de carga.

* Los datos de portadores de tarjeta y clientes finales no deben persistir en la base de datos de la pasarela.

# **3\. Requerimientos Funcionales**

📌 *Los identificadores siguen la convención RF-\[MÓDULO\]-\[NÚMERO\]. Prioridad: ALTA / MEDIA / BAJA.*

## **3.1 Microservicio de Comercios (Merchant Service)**

| ID | Requerimiento | Prioridad | Criterio de Aceptación |
| ----- | ----- | ----- | ----- |
| RF-MS-01 | El sistema debe permitir el registro de un nuevo comercio mediante un formulario de onboarding que capture razón social, NIT, dirección, representante legal y datos bancarios. | ALTA | Comercio creado con status PENDING\_KYC en la BD. |
| RF-MS-02 | El sistema debe ejecutar la validación KYC del comercio consultando el padrón tributario del SIN (Servicio de Impuestos Nacionales) y la lista ASFI de sanciones. | ALTA | Comercio rechazado o aprobado automáticamente con registro de auditoría. |
| RF-MS-03 | El sistema debe generar y almacenar de forma segura (hash SHA-256 \+ salt) las API Keys del comercio, con soporte de rotación forzada. | ALTA | API Key nueva emitida sin invalidar transacciones en curso. Llave anterior inhabilitada en \< 60 s. |
| RF-MS-04 | El sistema debe permitir configurar esquemas de comisión diferenciados por comercio (porcentual, fija, o mixta). | ALTA | Comisión calculada correctamente en cada transacción según esquema asignado. |
| RF-MS-05 | El sistema debe proveer un panel de administración para suspender, reactivar o eliminar lógicamente comercios. | MEDIA | Comercio suspendido no puede generar nuevos QR; transacciones en curso se completan. |
| RF-MS-06 | El sistema debe registrar logs de auditoría inmutables para cada cambio de estado de un comercio. | ALTA | Log persistido con timestamp, usuario actor y estado anterior/nuevo. |

## **3.2 Microservicio de Transacciones y QR (Transaction & QR Service)**

| ID | Requerimiento | Prioridad | Criterio de Aceptación |
| ----- | ----- | ----- | ----- |
| RF-TQ-01 | El sistema debe exponer un endpoint POST /v1/payments/qr que, dado el monto, referencia de orden y comercio autenticado, retorne un QR dinámico conforme al estándar EMVCo. | ALTA | QR generado y legible por al menos 3 apps bancarias bolivianas certificadas en \< 3 s. |
| RF-TQ-02 | El sistema debe persistir cada transacción en PostgreSQL con los campos: id (UUID), merchant\_id, order\_reference, amount (NUMERIC 12,2), currency, status, qr\_payload, bank\_transaction\_id, created\_at, updated\_at. | ALTA | Transacción creada con status PENDING; todos los campos correctamente poblados. |
| RF-TQ-03 | El sistema debe consumir de forma asíncrona la API del banco adquirente para confirmar o rechazar el pago, actualizando el status (PROCESSING → SUCCESSFUL | FAILED). | ALTA | Status actualizado en \< 10 s tras confirmación bancaria. Evento publicado en cola de mensajería. |
| RF-TQ-04 | El sistema debe implementar un mecanismo de expiración automática de QR no pagados tras un tiempo configurable (default: 15 minutos). El status debe cambiar a EXPIRED. | ALTA | Job programado detecta y expira QR vencidos; el pagador no puede completar pago en QR expirado. |
| RF-TQ-05 | El sistema debe garantizar idempotencia: una misma order\_reference no puede generar más de un QR activo simultáneamente por comercio. | ALTA | Segundo intento con la misma referencia retorna el QR existente si está PENDING; error 409 si está en otro estado. |
| RF-TQ-06 | El sistema debe mantener índices optimizados en merchant\_id, status y bank\_transaction\_id para consultas concurrentes de alta carga. | ALTA | Tiempo de consulta \< 50 ms bajo carga de 1,000 TPS. |
| RF-TQ-07 | El sistema debe llevar un registro de cada cambio de estado de la transacción en una tabla de historial (transaction\_events). | MEDIA | Historial completo disponible para auditoría con timestamp exacto de cada transición. |

## **3.3 Microservicio de Notificaciones (Webhook Service)**

| ID | Requerimiento | Prioridad | Criterio de Aceptación |
| ----- | ----- | ----- | ----- |
| RF-WH-01 | El sistema debe enviar un callback HTTP POST al URL de webhook registrado por el comercio dentro de los 5 segundos posteriores a la confirmación de un pago. | ALTA | Webhook entregado y confirmado (HTTP 2xx) en \< 5 s tras evento. |
| RF-WH-02 | El payload del webhook debe contener: transaction\_id, order\_reference, amount, currency, status, timestamp, y firma HMAC-SHA256 del cuerpo. | ALTA | Comercio puede verificar la firma con su secret key; payload completo y correcto. |
| RF-WH-03 | El sistema debe implementar reintentos con backoff exponencial (1 s, 5 s, 30 s, 5 min, 30 min) ante fallas de entrega del webhook. | ALTA | Hasta 5 reintentos; si todos fallan, evento marcado como FAILED\_DELIVERY con alerta al administrador. |
| RF-WH-04 | El sistema debe registrar cada intento de entrega con su resultado (código HTTP, latencia, timestamp) para auditoría. | MEDIA | Log de intentos visible en el panel administrativo. |
| RF-WH-05 | El sistema debe permitir al comercio consultar el historial de webhooks recibidos y reenviar manualmente los fallidos. | MEDIA | Reenvío manual disponible vía endpoint autenticado; evento reenviado con mismo payload original. |

## **3.4 Microservicio de Conciliación (Settlement Service)**

| ID | Requerimiento | Prioridad | Criterio de Aceptación |
| ----- | ----- | ----- | ----- |
| RF-ST-01 | El sistema debe procesar automáticamente los archivos de cuadratura (CSV/TXT) provistos por las cámaras de compensación bolivianas en el horario de cierre contable. | ALTA | Archivo procesado sin errores; diferencias detectadas generan alertas automáticas. |
| RF-ST-02 | El sistema debe cruzar cada registro del archivo de cuadratura con las transacciones internas usando el bank\_transaction\_id como llave de conciliación. | ALTA | 100% de transacciones SUCCESSFUL cruzadas correctamente; discrepancias registradas en tabla de excepciones. |
| RF-ST-03 | El sistema debe calcular el saldo neto liquidable por comercio (monto bruto menos comisiones) y generar un reporte de liquidación diario. | ALTA | Reporte exportable en PDF y CSV; montos cuadran con registros de la cámara. |
| RF-ST-04 | El sistema debe detectar y alertar transacciones no conciliadas dentro de las 24 horas posteriores al cierre contable. | ALTA | Alerta enviada al equipo de operaciones con detalle de la discrepancia. |
| RF-ST-05 | El sistema debe mantener trazabilidad de cada conciliación ejecutada, incluyendo archivo procesado, usuario que lo ejecutó, fecha y resultado. | MEDIA | Historial de conciliaciones disponible en panel administrativo con filtros por fecha. |

# **4\. Requerimientos No Funcionales**

## **4.1 Rendimiento**

| ID | Requerimiento | Métrica Objetivo |
| ----- | ----- | ----- |
| RNF-P-01 | El endpoint de generación de QR debe responder en condiciones normales de carga. | P95 ≤ 3,000 ms |
| RNF-P-02 | El sistema debe soportar carga sostenida sin degradación. | ≥ 500 TPS sostenidas |
| RNF-P-03 | El sistema debe soportar picos de carga transitorios. | ≥ 1,000 TPS por burst de 30 s |
| RNF-P-04 | El tiempo de recuperación tras una falla de microservicio individual. | RTO ≤ 30 s |
| RNF-P-05 | Las consultas a la base de datos deben ser eficientes bajo carga. | P99 ≤ 100 ms por query con índices |

## **4.2 Disponibilidad y Resiliencia**

* RNF-D-01: La disponibilidad del sistema debe ser ≥ 99.9% mensual (máximo 43.8 minutos de downtime/mes).

* RNF-D-02: El sistema debe implementar health checks automáticos para cada microservicio con circuit breakers.

* RNF-D-03: La base de datos debe operar con replicación primario-réplica (streaming replication de PostgreSQL) con failover automático.

* RNF-D-04: Cada microservicio debe ser desplegable de forma independiente sin afectar la disponibilidad de los demás.

* RNF-D-05: El sistema debe contar con backups automáticos de la base de datos cada 6 horas con retención mínima de 30 días.

## **4.3 Escalabilidad**

* RNF-E-01: La arquitectura debe permitir el escalado horizontal independiente de cada microservicio mediante contenedores Docker orquestados con Kubernetes.

* RNF-E-02: El sistema debe soportar el incremento del volumen de comercios hasta 10,000 merchants activos sin rediseño arquitectónico.

* RNF-E-03: La incorporación de nuevos bancos adquirentes debe realizarse mediante un patrón Adapter sin modificar el núcleo transaccional.

## **4.4 Mantenibilidad**

* RNF-M-01: El código fuente debe cumplir una cobertura mínima de pruebas unitarias del 80% medida con Jest.

* RNF-M-02: Cada microservicio debe exponer endpoints de health (/health/liveness y /health/readiness) compatibles con Kubernetes probes.

* RNF-M-03: El sistema debe implementar trazabilidad distribuida (OpenTelemetry) para correlacionar requests entre microservicios.

* RNF-M-04: Los logs de todos los microservicios deben ser estructurados en formato JSON y centralizados en un stack de observabilidad (ELK o Grafana Loki).

# **5\. Requerimientos de Seguridad**

📌 *Todos los requerimientos de seguridad de esta sección son de prioridad ALTA y son mandatorios para la certificación del sistema.*

## **5.1 Autenticación y Autorización**

| ID | Requerimiento de Seguridad |
| ----- | ----- |
| RS-AA-01 | El acceso al API REST de la pasarela debe autenticarse exclusivamente mediante API Keys criptográficas (256 bits de entropía mínima) transmitidas en el header X-Api-Key. |
| RS-AA-02 | Las API Keys deben almacenarse como hash bcrypt (factor de costo ≥ 12\) en la base de datos. La llave en texto plano debe ser entregada una única vez al comercio. |
| RS-AA-03 | El panel administrativo debe requerir autenticación multifactor (MFA) mediante TOTP (RFC 6238). |
| RS-AA-04 | Los tokens de sesión del panel administrativo deben tener expiración de 8 horas y soportar revocación inmediata. |
| RS-AA-05 | El sistema debe implementar control de acceso basado en roles (RBAC) diferenciando al menos los roles: ADMIN, OPERATIONS, SUPPORT, MERCHANT\_READ\_ONLY. |

## **5.2 Seguridad en Tránsito y en Reposo**

* RS-TR-01: Toda comunicación entre microservicios y con servicios externos debe realizarse sobre TLS 1.2 o superior. Se prohíbe el uso de TLS 1.0 y 1.1.

* RS-TR-02: Los QR payloads y datos sensibles de comercios almacenados en base de datos deben estar cifrados con AES-256-GCM.

* RS-TR-03: Las comunicaciones con los bancos adquirentes deben utilizar mutual TLS (mTLS) con certificados de cliente provistos por cada entidad financiera.

* RS-TR-04: Los secretos de aplicación (credenciales bancarias, claves de cifrado) deben gestionarse mediante un servicio de secretos centralizado (HashiCorp Vault o AWS Secrets Manager). Prohibido almacenarlos en código fuente o variables de entorno planas.

## **5.3 Protección contra Fraude y Abuso**

* RS-FA-01: El sistema debe implementar rate limiting por API Key: máximo 100 requests/minuto en el endpoint de generación de QR.

* RS-FA-02: Los IPs con más de 10 intentos de autenticación fallida en 5 minutos deben ser bloqueados automáticamente por un período mínimo de 30 minutos.

* RS-FA-03: El sistema debe detectar y alertar patrones de transacciones anómalas: mismo QR escaneado más de 3 veces, intentos de doble pago, o montos que superen el límite configurado por el BCB.

* RS-FA-04: Los webhooks deben incluir firma HMAC-SHA256 para que el comercio pueda verificar la autenticidad del callback.

## **5.4 Auditoría y No Repudio**

* RS-AN-01: El sistema debe mantener logs de auditoría inmutables para todas las operaciones críticas (creación de QR, cambios de estado, accesos administrativos, rotación de llaves).

* RS-AN-02: Los logs de auditoría deben conservarse por un mínimo de 5 años conforme a regulación ASFI.

* RS-AN-03: Cada transacción debe poder rastrearse de extremo a extremo con un correlation ID único que persista desde la solicitud del comercio hasta la notificación de la cámara de compensación.

# **6\. Requerimientos de Integración**

## **6.1 API REST de la Pasarela**

La pasarela debe exponer una API REST versionada (v1) con las siguientes operaciones mínimas:

| Método | Endpoint | Módulo | Descripción |
| ----- | ----- | ----- | ----- |
| POST | /v1/payments/qr | Transaction | Genera un QR dinámico de cobro. |
| GET | /v1/payments/{id} | Transaction | Consulta el estado de una transacción. |
| GET | /v1/payments | Transaction | Lista transacciones del comercio con paginación y filtros. |
| POST | /v1/merchants | Merchant | Registra un nuevo comercio (onboarding). |
| GET | /v1/merchants/me | Merchant | Retorna el perfil y configuración del comercio autenticado. |
| PUT | /v1/merchants/me/webhook | Merchant | Actualiza la URL de webhook del comercio. |
| POST | /v1/merchants/me/api-keys/rotate | Merchant | Solicita la rotación de la API Key activa. |
| GET | /v1/settlements | Settlement | Lista los reportes de liquidación disponibles. |
| GET | /v1/webhooks/logs | Webhook | Consulta el historial de entregas de webhooks. |
| POST | /v1/webhooks/{id}/retry | Webhook | Reintenta manualmente la entrega de un webhook fallido. |

## **6.2 Esquema del Request de Generación de QR**

El body del request POST /v1/payments/qr debe tener la siguiente estructura JSON:

{ "order\_reference": "ORD-2024-001", "amount": 150.00, "currency": "BOB", "description": "Pago de servicio", "expiration\_minutes": 15, "metadata": { "product\_id": "SKU-XYZ" } }

## **6.3 Integración con Bancos Adquirentes**

* RI-BA-01: La integración con cada banco adquirente debe implementarse mediante el patrón de diseño Adapter (BankAdapterInterface), permitiendo incorporar nuevas entidades sin modificar el núcleo.

* RI-BA-02: Los timeouts de comunicación con el banco adquirente deben ser configurables por entidad (default: 5,000 ms de conexión / 10,000 ms de lectura).

* RI-BA-03: Ante fallas de comunicación con el banco adquirente, el sistema debe implementar reintentos con backoff exponencial y circuit breaker (patrón Hystrix/Resilience4j equivalente en NestJS).

* RI-BA-04: El sistema debe soportar la integración inicial con al menos: Banco Unión, BNB, Banco Bisa y Banco Mercantil Santa Cruz.

## **6.4 Mensajería Asíncrona**

* RI-MA-01: La comunicación entre microservicios debe realizarse mediante un broker de mensajería (Apache Kafka o RabbitMQ).

* RI-MA-02: Los topics/queues críticos deben contar con at-least-once delivery garantizado y mecanismo de dead-letter queue para mensajes no procesables.

* RI-MA-03: El sistema debe soportar el replay de eventos para recuperación ante fallas sin pérdida de transacciones.

# **7\. Modelo de Datos**

## **7.1 Entidades Principales**

| Tabla | Campo | Tipo | Descripción |
| ----- | ----- | ----- | ----- |
| merchants | id | UUID | Identificador único del comercio. |
| merchants | legal\_name | VARCHAR(200) | Razón social registrada en el SIN. |
| merchants | nit | VARCHAR(20) | Número de Identificación Tributaria. |
| merchants | status | ENUM | PENDING\_KYC | ACTIVE | SUSPENDED | BLOCKED |
| merchants | commission\_scheme | JSONB | Esquema de comisión en formato JSON estructurado. |
| merchants | webhook\_url | TEXT | URL de callback para notificaciones. |
| transactions | id | UUID | Identificador único de la transacción. |
| transactions | merchant\_id | UUID (FK) | Referencia al comercio generador. |
| transactions | order\_reference | VARCHAR(100) | Referencia de orden del sistema del comercio. |
| transactions | amount | NUMERIC(12,2) | Monto exacto en BOB. Sin punto flotante. |
| transactions | currency | VARCHAR(3) | Moneda ISO 4217\. Default: BOB. |
| transactions | status | ENUM | PENDING | PROCESSING | SUCCESSFUL | FAILED | EXPIRED |
| transactions | qr\_payload | TEXT | String EMVCo del QR generado (cifrado AES-256). |
| transactions | bank\_transaction\_id | VARCHAR(150) | ID de transacción asignado por el banco adquirente. |
| transactions | expires\_at | TIMESTAMPTZ | Timestamp de expiración del QR. |
| api\_keys | id | UUID | Identificador de la llave. |
| api\_keys | merchant\_id | UUID (FK) | Comercio propietario de la llave. |
| api\_keys | key\_hash | VARCHAR(255) | Hash bcrypt de la API Key. |
| api\_keys | is\_active | BOOLEAN | Indica si la llave está vigente. |
| webhook\_logs | id | UUID | Identificador del intento de entrega. |
| webhook\_logs | transaction\_id | UUID (FK) | Transacción que originó el webhook. |
| webhook\_logs | attempt\_number | INTEGER | Número de intento (1 a 5). |
| webhook\_logs | http\_status | INTEGER | Código HTTP de respuesta del servidor del comercio. |
| webhook\_logs | delivered\_at | TIMESTAMPTZ | Timestamp de entrega exitosa. |

# **8\. Requerimientos de Infraestructura**

## **8.1 Stack Tecnológico Mandatorio**

| Componente | Tecnología | Justificación |
| ----- | ----- | ----- |
| Backend / Microservicios | NestJS (Node.js ≥ 20 LTS) | Framework modular con DI, decoradores y soporte nativo de microservicios. |
| Base de Datos Principal | PostgreSQL ≥ 15 | ACID, NUMERIC exacto para montos, JSONB para esquemas flexibles. |
| Broker de Mensajería | Apache Kafka o RabbitMQ | At-least-once delivery, replay de eventos, desacoplamiento. |
| Caché / Rate Limiting | Redis ≥ 7 | Rate limiting distribuido, sesiones, idempotency keys. |
| Orquestación | Kubernetes (K8s) | Escalado horizontal, self-healing, rolling deployments. |
| Contenedores | Docker | Empaquetado reproducible de microservicios. |
| API Gateway | Kong o AWS API GW | Rate limiting centralizado, routing, SSL termination. |
| Observabilidad | OpenTelemetry \+ Grafana | Trazas distribuidas, métricas y logs centralizados. |
| Gestión de Secretos | HashiCorp Vault | Almacenamiento seguro de credenciales y llaves criptográficas. |
| CI/CD | GitHub Actions o GitLab CI | Pipelines automatizados de build, test y despliegue. |

## **8.2 Entornos de Despliegue**

* INF-01: El sistema debe contar con tres entornos separados: DEVELOPMENT, STAGING (certificación y UAT) y PRODUCTION.

* INF-02: El entorno de STAGING debe ser funcionalmente equivalente a PRODUCTION con datos anonimizados.

* INF-03: Los ambientes deben estar segregados en redes privadas (VPC) con acceso controlado por grupos de seguridad.

* INF-04: El despliegue a PRODUCTION debe requerir aprobación manual del responsable técnico tras el paso exitoso del pipeline en STAGING.

# **9\. Requerimientos de Cumplimiento Regulatorio**

📌 *El incumplimiento de cualquier requerimiento de esta sección puede derivar en la imposibilidad de obtener la habilitación operativa del BCB/ASFI.*

## **9.1 Habilitación BCB / ASFI**

* RC-01: El sistema debe obtener la habilitación como Proveedor de Servicios de Pago (PSP) ante el BCB previo a operar en producción.

* RC-02: El sistema debe implementar y documentar el proceso de PLD/FT (Prevención de Lavado de Dinero y Financiamiento del Terrorismo) conforme a la normativa ASFI.

* RC-03: El sistema debe reportar automáticamente al BCB las transacciones que superen los umbrales definidos en la normativa vigente (ROS — Reporte de Operaciones Sospechosas).

* RC-04: El sistema debe permitir la trazabilidad completa de fondos para auditorías regulatorias con acceso controlado para inspectores del BCB/ASFI.

## **9.2 Estándar QR EMVCo**

* RC-05: El QR generado debe cumplir íntegramente con la especificación EMVCo Merchant Presented Mode (MPM) v1.1.

* RC-06: El payload del QR debe incluir los campos mandatorios: Payload Format Indicator (ID 00), Point of Initiation Method (ID 01, valor 12 para QR dinámico), Merchant Category Code, Transaction Amount, Transaction Currency y Country Code (BO).

* RC-07: La interoperabilidad del QR debe ser validada mediante pruebas de aceptación con las aplicaciones móviles de las entidades bancarias bolivianas habilitadas.

## **9.3 Protección de Datos**

* RC-08: Los datos personales del pagador no deben persistir en la base de datos de la pasarela. Solo se almacenará el bank\_transaction\_id como referencia opaca.

* RC-09: El sistema debe implementar el derecho al olvido para los datos de comercios inactivos conforme a normativa aplicable, manteniendo únicamente los registros exigidos por auditoría regulatoria.

# **10\. Criterios de Aceptación y Plan de Pruebas**

## **10.1 Tipos de Prueba Requeridos**

| Tipo de Prueba | Herramienta Sugerida | Criterio de Éxito |
| ----- | ----- | ----- |
| Unitarias | Jest (NestJS) | Cobertura ≥ 80% en lógica de negocio. |
| Integración | Jest \+ Testcontainers | Todos los flujos de pago E2E completados sin errores. |
| Carga y Rendimiento | k6 / Artillery | 500 TPS sostenidas; P95 ≤ 3,000 ms en /v1/payments/qr. |
| Seguridad (DAST) | OWASP ZAP | Sin vulnerabilidades de severidad ALTA o CRÍTICA. |
| Penetración | Empresa externa certificada | Informe sin hallazgos críticos no remediados. |
| Aceptación de Usuario | Equipo QA \+ Merchants piloto | 100% de casos de uso aprobados por comercios piloto. |
| Interoperabilidad QR | Apps bancarias bolivianas | QR legible y pagable desde ≥ 4 apps bancarias. |
| Recuperación ante Fallas | Chaos Engineering (k6/Chaos) | RTO ≤ 30 s tras falla de microservicio individual. |

# **11\. Glosario de Estados de Transacción**

| Estado | Descripción | Transiciones Posibles |
| ----- | ----- | ----- |
| PENDING | QR generado y en espera de ser escaneado por el pagador. | → PROCESSING, → EXPIRED |
| PROCESSING | Pago en proceso de autorización con el banco adquirente. | → SUCCESSFUL, → FAILED |
| SUCCESSFUL | Pago confirmado y liquidado por el banco adquirente. | Estado final (no transiciona). |
| FAILED | Pago rechazado por el banco adquirente o error de sistema. | Estado final (no transiciona). |
| EXPIRED | El QR no fue pagado dentro del tiempo de expiración. | Estado final (no transiciona). |

# **12\. Control de Versiones del Documento**

| Versión | Fecha | Autor | Cambios |
| ----- | ----- | ----- | ----- |
| 1.0.0 | 28 de mayo de 2026 | Equipo de Arquitectura | Versión inicial del documento basada en propuesta técnica de arquitectura. |

📌 *Este documento debe revisarse y actualizarse ante cualquier cambio en los requerimientos regulatorios del BCB/ASFI o modificaciones a la arquitectura base del sistema.*