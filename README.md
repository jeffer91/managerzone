# MZ Tactical Lab

App de escritorio en Electron para analizar plantillas de ManagerZone, puntuar jugadores por posición, comparar formaciones y orientar contrataciones.

## Ejecutar

```bash
npm install
npm start
```

## Verificar la app

```bash
npm test
```

El chequeo valida sintaxis JavaScript, archivos requeridos, orden de carga de scripts, IDs HTML, las 6 formaciones, 11 posiciones por táctica, un portero por formación, coordenadas de cancha y los datos demo.

## Funciones principales

- Pega la plantilla copiada directamente desde ManagerZone o una tabla exportada.
- Parser inteligente tolerante a saltos de línea, espacios y formatos de moneda.
- Calcula una nota de **0 a 10 por posición** para cada jugador.
- Criterio principal:
  - **DEL:** Remates.
  - **VOL:** Pases + equilibrio del perfil.
  - **DEF:** Entradas.
  - **POR:** Atajando.
- Compara automáticamente 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2 y 3-4-3.
- Construye el mejor XI por formación sin repetir jugadores.
- Puntúa la táctica completa de 0 a 10.
- Permite arrastrar jugadores e intercambiar posiciones; la nota se recalcula.
- Genera el banco en el orden funcional de ManagerZone: POR, DEF, VOL, DEL y comodín, optimizando los cuatro puestos del banco de forma conjunta.
- Módulo **Qué comprar**: devuelve una sola prioridad y el mínimo aceptable del fichaje.
- El flujo **Qué comprar → Mercado** conserva el puesto y los mínimos para validar al candidato.
- Guarda la plantilla localmente mediante `localStorage`.

## Estructura

- `electron/main.js`: crea la ventana Electron con aislamiento de contexto, sin Node en el renderer.
- `electron/preload.js`: información mínima y segura del escritorio.
- `src/index.html`: interfaz y orden de carga.
- `src/app.js`: motor base, notas, XI, tácticas y mercado.
- `src/parser-patch.js`: importador inteligente de ManagerZone.
- `src/core-audit.js`: validaciones de datos, necesidades por formación y flujo de mercado.
- `src/tactics-visibility.js`: cancha, visibilidad y banco optimizado.
- `src/needs-minimal.js`: recomendación minimalista de contratación.
- `src/styles.css` y `src/tactics-visibility.css`: diseño.
- `scripts/check.js`: auditoría automatizada.

## Lógica de valoración

Los pesos base están en `ratePlayer()` de `src/app.js`. Además existe una protección del atributo principal para evitar que muchas habilidades secundarias compensen artificialmente una carencia crítica. Por eso la interfaz identifica el atributo como **principal** en vez de presentar el peso base como si fuera el peso efectivo final.
