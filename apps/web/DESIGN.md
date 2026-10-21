---
name: Nova
description: Una mesa de trabajo clara para ventas, inventario y cuentas.
colors:
  nova-blue: "#2563eb"
  nova-blue-hover: "#1d4ed8"
  nova-blue-soft: "#e7efff"
  cloud: "#f6f8fc"
  surface: "#ffffff"
  ink: "#1f2937"
  ink-soft: "#53627a"
  line: "#d8e1ee"
  line-strong: "#bdcadd"
  mint: "#16866c"
  mint-soft: "#e3f5ef"
  amber: "#a86708"
  amber-soft: "#fff2d4"
  red: "#c53737"
  red-soft: "#fde9e9"
typography:
  headline:
    fontFamily: 'Aptos, "Segoe UI Variable", "Segoe UI", Roboto, Arial, sans-serif'
    fontSize: "2.15rem"
    fontWeight: 770
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  title:
    fontFamily: 'Aptos, "Segoe UI Variable", "Segoe UI", Roboto, Arial, sans-serif'
    fontSize: "1.25rem"
    fontWeight: 760
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: 'Aptos, "Segoe UI Variable", "Segoe UI", Roboto, Arial, sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: 'Aptos, "Segoe UI Variable", "Segoe UI", Roboto, Arial, sans-serif'
    fontSize: "0.78rem"
    fontWeight: 760
    lineHeight: 1.3
    letterSpacing: "0.08em"
rounded:
  sm: "10px"
  md: "14px"
  lg: "16px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.nova-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.nova-blue-hover}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "11px 14px"
    height: "52px"
---

# Design System: Nova

## Overview

**Creative North Star: "Mostrador luminoso"**

Nova se siente como una mesa de trabajo limpia bajo buena luz: cada herramienta
tiene un lugar, los estados importantes se distinguen con rapidez y el color nunca
compite con la operación. La personalidad aparece en el rastro cronológico que une
ventas, inventario, pagos y responsables; no en decoración ajena al negocio.

La experiencia es compacta y familiar en controles, con suficiente aire entre
tareas. Móvil prioriza una sola decisión por momento y escritorio añade contexto sin
cambiar el vocabulario.

**Key Characteristics:**

- base clara y fría con Azul Nova reservado para acción y selección;
- tipografía de sistema legible en Android y Windows;
- trazos cronológicos como firma de trazabilidad;
- jerarquía operativa antes que métricas decorativas;
- adaptación estructural entre barra inferior y navegación lateral.

## Colors

La paleta combina superficies frías y luminosas con un único acento de acción y
colores semánticos contenidos.

### Primary

- **Azul Nova**: acción principal, enlace activo y foco.
- **Azul de trabajo**: fondo suave para selección y zonas de acción.

### Secondary

- **Menta confirmación**: disponibilidad, éxito y hechos completados.
- **Ámbar atención**: vencimientos, revisión y conflictos recuperables.
- **Rojo corrección**: error y acciones destructivas exclusivamente.

### Neutral

- **Nube**: fondo general y separación amplia entre áreas.
- **Superficie**: formularios, navegación y espacios de trabajo.
- **Tinta**: texto principal e iconografía.
- **Tinta suave**: contexto, ayuda y metadatos.
- **Línea**: divisores y contornos estructurales.

**The One Blue Action Rule.** Un contexto presenta una sola acción primaria azul;
si dos botones compiten, la jerarquía debe resolverse antes de añadir color.

## Typography

**Display Font:** Aptos con fallbacks Segoe UI, Roboto y Arial.
**Body Font:** la misma familia de sistema.

**Character:** una sans de trabajo sobria, con cifras y caracteres claros. La
identidad proviene de peso, ritmo y lenguaje, no de una fuente ornamental.

### Hierarchy

- **Headline**: títulos principales estables por breakpoint, compactos y con peso alto.
- **Title**: encabezados de sección y decisiones dentro de un flujo.
- **Body**: instrucciones y contenido con una medida habitual máxima de 65 caracteres.
- **Label**: contexto corto; mayúsculas solo para kickers ocasionales, nunca para toda la navegación.

**The Stable Type Rule.** La tipografía operativa no usa tamaños fluidos; cambia en
puntos de adaptación explícitos.

## Layout

En escritorio, el workspace usa una navegación lateral fija de 252 píxeles y un
área principal con máximo de 1180 píxeles. En móvil, la navegación se convierte en
cinco destinos inferiores y el contenido conserva márgenes de 16 píxeles. Los
formularios trabajan en una columna; paneles paralelos se apilan antes de 980
píxeles y la estructura móvil entra a 820 píxeles.

## Elevation & Depth

El sistema es plano por defecto. Bordes y cambios tonales separan las superficies;
una sombra ambiental aparece únicamente en paneles flotantes, foco protegido o
superficies realmente elevadas.

**The Flat Worktop Rule.** Una superficie está enmarcada por borde o elevada por
sombra, nunca por ambos como decoración redundante.

## Shapes

Controles y filas usan esquinas de 10 píxeles; paneles contextuales, 14 píxeles; y
áreas principales, 16 píxeles. Las formas totalmente redondas quedan para avatares
e indicadores pequeños. Los contornos son de un píxel y comunican estructura o
estado.

## Components

### Buttons

- **Shape:** rectángulo suavemente curvo con radio pequeño y altura táctil de 52 píxeles.
- **Primary:** Azul Nova con texto blanco y verbo explícito.
- **Hover / Focus:** azul más profundo, elevación corta y anillo de foco visible.
- **Disabled:** conserva el texto y reduce contraste; el estado de espera nombra la acción en curso.

### Cards / Containers

- **Corner Style:** radio grande sin llegar a forma de píldora.
- **Background:** superficie blanca o tinte funcional explícito.
- **Shadow Strategy:** sin sombra en reposo; borde estructural de un píxel.
- **Internal Padding:** entre 20 y 32 píxeles según densidad.

### Inputs / Fields

- **Style:** superficie blanca, borde fuerte y altura táctil de 52 píxeles.
- **Focus:** borde Azul Nova con halo suave del mismo matiz.
- **Error:** fondo rojo claro, borde rojo y mensaje específico junto al campo.

### Navigation

La selección combina icono, texto, Azul Nova y fondo azul claro. En escritorio la
navegación es lateral; en móvil conserva los mismos cinco nombres en la barra
inferior. Nunca se comunica un destino solo con un icono.

### Rastro operativo

Una línea fina conecta hechos en orden y cada punto acompaña responsable, momento y
cambio. Es la firma visual de Nova y solo aparece cuando existe trazabilidad real.

## Do's and Don'ts

### Do:

- **Do** priorizar la acción cotidiana sobre resúmenes y configuración.
- **Do** mantener visibles texto, icono y recuperación en cada estado importante.
- **Do** usar Menta, Ámbar y Rojo junto a lenguaje explícito.
- **Do** preservar objetivos táctiles mínimos de 44 por 44 píxeles.

### Don't:

- **Don't** convertir el inicio en una cuadrícula de tarjetas métricas equivalentes.
- **Don't** usar gradientes, cristal, neón ni una interfaz oscura como identidad.
- **Don't** asignar un color distinto a cada módulo.
- **Don't** comprimir tablas de escritorio dentro de una pantalla móvil.
- **Don't** usar animación que retrase una tarea.
