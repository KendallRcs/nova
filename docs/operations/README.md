# Operaciones

**Estado:** configuración local inicial disponible; despliegue pendiente.

## Requisitos locales

- Node.js 24.20.0, registrado en `.nvmrc` y `.node-version`;
- pnpm 11.24.0 mediante Corepack;
- Docker Engine con Docker Compose para PostgreSQL, cuando se empiecen a ejecutar
  migraciones y pruebas de integración.

No se necesita Docker para levantar la pantalla inicial ni el endpoint de salud.

La API valida al arrancar `DATABASE_URL`, `PORT` y `NODE_ENV`; una configuración
ausente o inválida detiene el proceso antes de aceptar solicitudes.

## Ejecución local actual

Después de seleccionar Node 24.20.0, ejecutar en terminales separadas:

```bash
pnpm dev:api
```

La API escucha por defecto en `http://localhost:3001` y su comprobación de salud
está disponible en `http://localhost:3001/health`. La variable `PORT` permite
cambiar el puerto explícitamente.

```bash
pnpm dev:web
```

La web escucha por defecto en `http://localhost:3000`.

## Infraestructura posterior

`infra/compose.yaml` contiene PostgreSQL 18.6, validado localmente el 2026-08-26.
Se levanta y consulta desde la raíz con:

```bash
docker compose --env-file .env.example -f infra/compose.yaml up -d postgres
docker compose --env-file .env.example -f infra/compose.yaml ps
```

La imagen incluye `psql`; no hace falta instalar el cliente en Ubuntu. Para detener
el servicio sin eliminar los datos:

```bash
docker compose --env-file .env.example -f infra/compose.yaml stop postgres
```

No se ejecuta `down --volumes` como operación cotidiana porque elimina el volumen
local. pgAdmin, Mailpit, Nginx, Cloudinary, CI/CD, observabilidad, copias de
seguridad y despliegue al VPS continúan pendientes y no deben instalarse
anticipadamente.
