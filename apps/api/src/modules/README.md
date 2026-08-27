# Módulos del backend

Cada módulo se alinea con una capacidad del dominio y hace visible su frontera:

```text
module/
├── hexagon/
│   ├── domain/
│   └── application/
├── adapters/
│   ├── driving/http/
│   └── driven/prisma/
└── module.module.ts
```

El directorio `hexagon/` no depende de NestJS, Prisma, PostgreSQL ni HTTP.
