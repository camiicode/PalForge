# PalForge

Herramienta para planificar proyectos de cría en Palworld. Busca Pals por nombre o elemento, consulta su rango de cría y registra los huevos eclosionados de cada proyecto.

## Stack

- [Vite](https://vite.dev/) (Vanilla JS)
- [Fuse.js](https://www.fusejs.io/) para búsqueda difusa
- [Vitest](https://vitest.dev/) + jsdom para pruebas unitarias
- HTML semántico + CSS con metodología BEM

## Requisitos

- Node.js `^20.19.0` o `>=22.12.0` (requisito de Vite 8)

## Desarrollo

```bash
npm install
npm run dev
```

La aplicación queda disponible en `http://localhost:5173/`.

## Pruebas

```bash
npm run test
```

Vitest ejecuta las suites de `src/js/tests/` en un entorno jsdom. En una terminal interactiva queda en modo watch; para una ejecución única usa `npm run test -- --run`.

## Producción

```bash
npm run build
npm run preview
```

El resultado se genera en `dist/`.

## Estructura

```
.
├── index.html              # Documento raíz y punto de entrada de Vite
├── vitest.config.js        # Entorno jsdom y patrón de tests
├── public/
│   └── data.json           # Catálogo de Pals, servido en /data.json
├── src/
│   ├── main.js             # Arranque: carga datos e inicializa los módulos
│   ├── style.css           # Estilos con clases BEM
│   └── js/
│       ├── projects.js     # Persistencia y probabilidad acumulada
│       ├── search.js       # Índice Fuse, búsqueda y render de resultados
│       ├── ui.js           # Eventos del DOM, modal y proyectos
│       ├── utils.js        # Utilidades compartidas (escapeHtml)
│       └── tests/
│           ├── projects.test.js
│           └── search.test.js
└── package.json
```

## Convenciones

- Clases CSS siguiendo BEM (`bloque__elemento--modificador`).
- Commits siguiendo [Conventional Commits](https://www.conventionalcommits.org/).
- Lógica de dominio separada de la capa de UI y cubierta por pruebas unitarias.
