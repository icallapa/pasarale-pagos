#!/bin/bash

# Configuración del cliente Vault
export VAULT_ADDR="http://localhost:8200"
export VAULT_TOKEN="my-safe-vault-root-token"

echo "Esperando que Vault esté listo..."
until curl -s "$VAULT_ADDR/v1/sys/health" > /dev/null; do
    sleep 1
done
echo "Vault está listo."

# Intentar habilitar el motor KV-v2 en el path 'secret' (en modo dev a veces ya viene habilitado)
vault secrets enable -path=secret kv-v2 2>/dev/null || echo "Motor 'secret' ya habilitado o listo."

# 1. Configuración de Base de Datos
echo "Cargando secretos de base de datos..."
vault kv put secret/database \
    host="host.docker.internal" \
    port="5432" \
    username="admin" \
    password="admin123" \
    database="pasarela_pagos"

# 2. Configuración del Banco Unión (Ficticio para Sandbox)
echo "Cargando secretos bancarios..."
vault kv put secret/bank/union \
    api_url="https://api.sandbox.bancounion.com.bo/v1" \
    client_id="client_union_dev_123" \
    client_secret="secret_union_dev_456" \
    mtls_cert="-----BEGIN CERTIFICATE-----\nMIIF...\n-----END CERTIFICATE-----" \
    mtls_key="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----"

# 3. Configuración de firmas y tokens
echo "Cargando llaves y secretos del sistema..."
vault kv put secret/system \
    jwt_secret="super-secure-jwt-dev-secret-key-123456" \
    webhook_secret="hmac-webhook-dev-secret-sign-key-789"

echo "Vault inicializado correctamente con secretos de desarrollo."
