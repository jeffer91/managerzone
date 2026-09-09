# MZ Tactical Lab

App de escritorio en Electron para analizar plantillas de ManagerZone, puntuar jugadores por posición y comparar tácticas.

## Ejecutar

```bash
npm install
npm start
```

## V1 funcional

- Pega la tabla de jugadores copiada/exportada desde ManagerZone.
- Calcula una nota de **0 a 10 por posición** para cada jugador.
- Criterio principal:
  - **DEL:** Remates.
  - **VOL:** Pases + equilibrio del perfil.
  - **DEF:** Entradas.
  - **POR:** Atajando.
- Compara automáticamente 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2 y 3-4-3.
- Construye el mejor XI por formación sin repetir jugadores.
- Puntúa la táctica completa de 0 a 10.
- Permite arrastrar jugadores en la cancha e intercambiar posiciones; la nota se recalcula inmediatamente.
- Genera el banco en el orden funcional de ManagerZone: POR, DEF, VOL, DEL y comodín.
- Incluye evaluador de fichajes para comparar un candidato con la plantilla actual.
- Guarda la plantilla localmente en el equipo mediante `localStorage`.

## Estructura

- `electron/main.js`: proceso principal y ventana Electron.
- `electron/preload.js`: preload seguro.
- `src/index.html`: interfaz.
- `src/styles.css`: diseño compacto tipo cancha.
- `src/app.js`: parser de ManagerZone, motor 0–10, optimizador de XI, tácticas y mercado.

## Ajuste del algoritmo

Los pesos se encuentran en la función `ratePlayer()` de `src/app.js`. Están separados para poder afinarlos después con resultados reales del juego sin rehacer la aplicación.
