const { execSync } = require('child_process');
const http = require('http');

// Configuración de puertos de Microservicios o Kong Gateway
const USE_GATEWAY = false; // Cambiar a true si Kong está levantado en puerto 8000
const GATEWAY_URL = 'http://localhost:8000';
const SERVICE_URLS = {
  merchant: 'http://localhost:3001',
  transaction: 'http://localhost:3002',
  webhook: 'http://localhost:3003',
  settlement: 'http://localhost:3004',
};

// Utilidad simple para hacer peticiones HTTP
function request(url, method, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Ejecutar comando psql
function runSql(query) {
  try {
    const cmd = `PGPASSWORD=admin123 psql -h localhost -U admin -d pasarela_pagos -t -A -c "${query}"`;
    return execSync(cmd).toString().trim();
  } catch (error) {
    console.error(`Error de Base de Datos: ${error.message}`);
    return null;
  }
}

async function run() {
  console.log('==========================================================');
  console.log('  SIMULACIÓN DE FLUJO DE INTEGRACIÓN DE PUNTA A PUNTA');
  console.log('==========================================================\n');

  const getUrl = (service, path) => {
    return USE_GATEWAY ? `${GATEWAY_URL}${path}` : `${SERVICE_URLS[service]}${path}`;
  };

  // --- PASO 1: ONBOARDING DE UN NUEVO COMERCIO ---
  console.log('Paso 1: Registrando nuevo comercio (Onboarding)...');
  const merchantPayload = {
    legalName: 'Supermercados Súper Bolivia',
    nit: '1029384756',
    commissionScheme: { type: 'mixed', value: 1.2, fixedValue: 0.80 }, // 1.2% + 0.80 BOB
    webhookUrl: 'http://localhost:3010/merchant-webhook',
  };

  let onboarding;
  try {
    onboarding = await request(getUrl('merchant', '/v1/merchants'), 'POST', {}, merchantPayload);
  } catch (err) {
    console.error('❌ Error al conectar con Merchant Service. ¿Están levantados los servicios?');
    process.exit(1);
  }

  if (onboarding.status !== 201) {
    console.error('❌ Error en Onboarding:', onboarding.body);
    process.exit(1);
  }

  const { merchant, apiKey } = onboarding.body;
  console.log(`✅ Comercio Creado: ${merchant.legalName} (ID: ${merchant.id})`);
  console.log(`🔑 API Key Generada: ${apiKey}\n`);

  // --- PASO 2: ASIGNAR ROL DE ADMINISTRADOR (Para poder ejecutar Conciliación) ---
  console.log('Paso 2: Elevando API Key a rol "admin" en la base de datos...');
  runSql(`UPDATE api_keys SET role = 'admin' WHERE merchant_id = '${merchant.id}'`);
  console.log('✅ API Key actualizada a rol "admin" con éxito.\n');

  // --- PASO 3: GENERACIÓN DE PAGO QR ---
  console.log('Paso 3: Creando transacción y QR de Pago...');
  const paymentPayload = {
    orderReference: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
    amount: 150.00, // 150 BOB
  };

  const payment = await request(
    getUrl('transaction', '/v1/payments'),
    'POST',
    { 'X-Api-Key': apiKey },
    paymentPayload
  );

  if (payment.status !== 201) {
    console.error('❌ Error en Generación de QR:', payment.body);
    process.exit(1);
  }

  const tx = payment.body;
  console.log(`✅ Transacción Pendiente Creada (ID: ${tx.id})`);
  console.log(`📲 QR Decodificado: ${tx.qrPayload}`);
  console.log(`🏦 ID Transacción Banco Unión: ${tx.bankTransactionId}\n`);

  // --- PASO 4: SIMULACIÓN DE CALLBACK DEL BANCO ---
  console.log('Paso 4: Simulando confirmación de pago del Banco Unión (Callback)...');
  const callbackPayload = {
    transactionId: tx.bankTransactionId,
    orderReference: tx.orderReference,
    status: 'COMPLETED',
    paymentDate: new Date().toISOString(),
  };

  const callback = await request(
    getUrl('webhook', '/v1/webhooks/bank/union'),
    'POST',
    // Si pasamos por gateway se requiere X-Api-Key, en directo no es necesario para el endpoint de banco
    USE_GATEWAY ? { 'X-Api-Key': apiKey } : {},
    callbackPayload
  );

  if (callback.status !== 201 && callback.status !== 200) {
    console.error('❌ Error en Callback de Banco:', callback.body);
    process.exit(1);
  }

  console.log('✅ Callback bancario procesado por pasarela:', callback.body);

  // Esperar un momento a que se ejecute la cola asíncrona de webhooks
  console.log('⏳ Esperando 2 segundos para la ejecución asíncrona del webhook...');
  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log('');

  // --- PASO 5: VERIFICACIÓN DE ESTADO EN BASE DE DATOS ---
  console.log('Paso 5: Consultando estado final de la transacción en Base de Datos...');
  const txStatus = runSql(`SELECT status FROM transactions WHERE id = '${tx.id}'`);
  const eventLogs = runSql(`SELECT to_status, description FROM transaction_events WHERE transaction_id = '${tx.id}' ORDER BY created_at ASC`);
  const webhookLogs = runSql(`SELECT attempt_number, http_status, response_payload FROM webhook_logs WHERE transaction_id = '${tx.id}' ORDER BY attempt_number ASC`);

  console.log(`ℹ️ Estado en DB: ${txStatus}`);
  console.log(`ℹ️ Historial de Eventos:\n${eventLogs}`);
  console.log(`ℹ️ Intentos de Webhook al Comercio:\n${webhookLogs}\n`);

  // --- PASO 6: CONCILIACIÓN DIARIA (CLEARING BANCARIO) ---
  console.log('Paso 6: Ejecutando conciliación diaria con archivo de clearing del banco...');
  const runDate = new Date().toISOString().split('T')[0];
  const clearingPayload = {
    runDate: runDate,
    transactions: [
      {
        bankTransactionId: tx.bankTransactionId,
        amount: 150.00, // Coincide monto
        status: 'COMPLETED',
      },
    ],
  };

  const clearing = await request(
    getUrl('settlement', '/v1/settlements/clearings'),
    'POST',
    { 'X-Api-Key': apiKey }, // Enviamos API Key con rol 'admin'
    clearingPayload
  );

  if (clearing.status !== 201) {
    console.error('❌ Error en Conciliación de Clearing:', clearing.body);
    process.exit(1);
  }

  const runDetails = clearing.body;
  console.log(`✅ Conciliación Procesada.`);
  console.log(`📊 Totales del Cierre:`);
  console.log(`   - Transacciones Procesadas: ${runDetails.totalTransactions}`);
  console.log(`   - Monto Bruto: ${runDetails.totalAmount} BOB`);
  console.log(`   - Comisión Neta Recaudada (1.2% + 0.80 BOB): ${runDetails.totalCommission} BOB`);
  console.log(`   - Monto Líquido a Transferir al Comercio: ${runDetails.totalNetAmount} BOB`);
  console.log(`   - Diferencias/Incidencias no conciliadas: ${runDetails.unreconciledCount}\n`);

  // --- PASO 7: CONSULTAR REPORTE DETALLADO ---
  console.log('Paso 7: Obteniendo reporte detallado del cierre conciliado...');
  const report = await request(
    getUrl('settlement', `/v1/settlements/runs/${runDetails.id}`),
    'GET',
    { 'X-Api-Key': apiKey },
    null
  );

  if (report.status !== 200) {
    console.error('❌ Error al consultar corrida:', report.body);
    process.exit(1);
  }

  console.log(`✅ Detalle del reporte obtenido:`);
  console.log(JSON.stringify(report.body, null, 2));

  console.log('\n==========================================================');
  console.log('         ¡SIMULACIÓN COMPLETADA EXITOSAMENTE!');
  console.log('==========================================================');
}

run().catch(console.error);
