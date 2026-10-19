# PalForge

Herramienta para planificar proyectos de cría en Palworld. Busca Pals por nombre o elemento, consulta su rango de cría, registra los huevos eclosionados y elimina proyectos con opción de deshacer.

## Stack

- [Vite](https://vite.dev/) (Vanilla JS)
- [Fuse.js](https://www.fusejs.io/) para búsqueda difusa
- [Vitest](https://vitest.dev/) + jsdom para pruebas unitarias
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) para instalación y offline
- HTML semántico + CSS con metodología BEM

## Requisitos

- Node.js `^20.19.0` o `>=22.12.0` (requisito de Vite 8)

## Desarrollo

```bash
npm install
npm run dev
```

La aplicación queda disponible en `http://localhost:5173/PalForge/`.

## Pruebas

```bash
npm run test
```

Vitest ejecuta las suites de `src/js/tests/` en un entorno jsdom. En una terminal interactiva queda en modo watch; para una ejecución única usa `npm run test -- --run`.

## Probabilidad de cría

La probabilidad acumulada de obtener las pasivas deseadas tras `n` huevos es
`1 - (1 - p)^n`, donde `p` depende de cuántas pasivas se persigan:

| Pasivas objetivo | `p` por huevo |
| ---------------- | ------------- |
| 1                | 40%           |
| 2                | 25%           |
| 3                | 12%           |
| 4                | 10%           |
| 0 (sin pasivas)  | 10%           |

La versión de los datos (`game_version` en `public/data.json`) se muestra en el
pie de la barra lateral.

## Producción

```bash
npm run build
npm run preview
```

El resultado se genera en `dist/`.

## PWA

`vite-plugin-pwa` genera `manifest.webmanifest`, los iconos instalables y un
service worker que precachea la app y `data.json`. La instalación debe probarse
sobre `localhost` o HTTPS con el build de producción:

```bash
npm run build
npm run preview
```

El service worker se registra automáticamente y actualiza la app al publicar una
nueva versión. El botón «Instalar PalForge» permanece visible bajo el buscador
mientras la app no esté instalada: si el navegador emite `beforeinstallprompt`
se lanza el diálogo nativo; en iOS Safari u otros casos sin soporte, se muestra
un toast con las instrucciones de instalación manual. En modo standalone el
botón desaparece.

Cuando el buscador está vacío y no hay resultados, la zona principal muestra la
rejilla «Explorar Pals» con los primeros Pals del catálogo; cada tarjeta abre el
detalle del Pal. Las miniaturas usan placeholders de `placehold.co` hasta contar
con arte oficial.

## Responsive

En pantallas de 768px o menos la app pasa a una sola columna: barra superior con
menú hamburguesa, buscador arriba y el panel de proyectos como cajón lateral
deslizable. El modal de selección de pasivas cabe en pantalla y su contenido hace
scroll.

## Despliegue

El workflow `.github/workflows/deploy.yml` despliega la app en GitHub Pages con
cada push a `master`: instala dependencias con `npm ci`, ejecuta los tests
(`npm run test`), construye `dist/` y lo publica. La app se sirve en
`https://camiicode.github.io/PalForge/`. GitHub Pages distingue mayúsculas, por
lo que Vite usa `base: '/PalForge/'` (exactamente igual que el nombre del
repositorio) y el catálogo se sirve desde `/PalForge/data.json`.

## Estructura

```
.
├── index.html              # Documento raíz y punto de entrada de Vite
├── vite.config.js          # Configuración de Vite y PWA
├── vitest.config.js        # Entorno jsdom y patrón de tests
├── public/
│   ├── data.json           # Catálogo de Pals, servido en /data.json
│   ├── favicon.png         # Icono original
│   ├── icon-192.png        # Icono PWA
│   └── icon-512.png        # Icono PWA
├── src/
│   ├── main.js             # Arranque: carga datos e inicializa los módulos
│   ├── style.css           # Estilos con clases BEM
│   └── js/
│       ├── projects.js     # Persistencia, borrado/restauración y probabilidad
│       ├── search.js       # Índice Fuse, búsqueda y render de resultados
│       ├── ui.js           # Eventos del DOM, modal y proyectos
│       ├── toast.js        # Notificaciones flotantes con acción de deshacer
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
