# PalForge

Herramienta para planificar proyectos de cría en Palworld. Busca Pals por nombre o elemento, consulta su rango de cría y registra los huevos eclosionados de cada proyecto.

## Stack

- [Vite](https://vite.dev/) (Vanilla JS)
- [Fuse.js](https://www.fusejs.io/) para búsqueda difusa
- HTML semántico + CSS con metodología BEM

## Requisitos

- Node.js `^20.19.0` o `>=22.12.0` (requisito de Vite 8)

## Desarrollo

```bash
npm install
npm run dev
```

La aplicación queda disponible en `http://localhost:5173/`.

## Producción

```bash
npm run build
npm run preview
```

El resultado se genera en `dist/`.

## Estructura

```
.
├── index.html          # Documento raíz y punto de entrada de Vite
├── public/
│   └── data.json       # Catálogo de Pals, servido en /data.json
├── src/
│   ├── main.js         # Lógica de la app (importa Fuse.js y los estilos)
│   └── style.css       # Estilos con clases BEM
└── package.json
```

## Convenciones

- Clases CSS siguiendo BEM (`bloque__elemento--modificador`).
- Commits siguiendo [Conventional Commits](https://www.conventionalcommits.org/).
