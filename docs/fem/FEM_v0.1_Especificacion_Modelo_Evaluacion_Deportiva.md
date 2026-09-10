# Football Evaluation Model (FEM)

## Especificación del Modelo de Evaluación Deportiva

**Versión:** 0.1

## 1. Objetivo

El Football Evaluation Model (FEM) define el modelo conceptual mediante el cual se evalúa el rendimiento de un futbolista a partir de eventos observables registrados durante un partido.

El objetivo del modelo no es asignar una calificación directamente, sino transformar observaciones objetivas del juego en información estructurada que permita evaluar el desempeño del jugador de forma consistente, auditable y explicable.

El Rating (si existe) será una consecuencia del modelo y no su elemento principal.

## 2. Principios

### 2.1 La evaluación se basa en evidencias

Todo resultado debe estar sustentado por eventos registrados durante el partido. No es válido registrar percepciones; deben registrarse acciones observables.

Ejemplo

No es válido registrar:

"Jugó muy bien."

Debe registrarse:

- Pase filtrado exitoso.
- Recuperación.
- Regate exitoso.
- Error defensivo.
- Centro preciso.

### 2.2 Los eventos son la unidad mínima de información

Todo el modelo gira alrededor del concepto de Evento. Un evento representa una acción realizada por un jugador durante un partido.

Ejemplos

- Pase
- Remate
- Gol
- Recuperación
- Entrada
- Intercepción
- Regate
- Despeje
- Falta

### 2.3 El contexto modifica el significado del evento

Un evento nunca debe interpretarse de forma aislada. Su impacto depende del contexto en el que ocurre.

Ejemplo

Un pase horizontal exitoso en campo propio tiene un valor diferente a un pase filtrado exitoso que rompe líneas bajo presión.

El evento es similar.

El contexto no.

### 2.4 La complejidad modifica la dificultad de ejecución

Además del contexto, cada evento posee un nivel de complejidad que representa qué tan difícil era ejecutar correctamente esa acción. La complejidad considera factores como dificultad técnica, distancia, precisión requerida, presión rival, velocidad de ejecución, cantidad de rivales involucrados, uso de pierna no dominante, espacio disponible y riesgo asumido. Contexto y complejidad son conceptos independientes.

Por ejemplo:

- Un pase de 5 metros sin presión es una acción de baja dificultad.
- Un pase filtrado de 30 metros entre tres rivales bajo presión es una acción de alta dificultad.

### 2.5 La evaluación es explicable

Toda valoración debe poder justificarse mediante los eventos registrados.

## 3. Modelo conceptual

Jugador → Partido → Evento → Contexto → Complejidad → Consecuencia → Evidencia → Evaluación

El jugador nunca se evalúa directamente. Siempre se evalúan los eventos registrados durante sus partidos.

## 4. Evento

El Evento constituye la unidad fundamental del modelo. Representa una acción realizada por un jugador en un instante específico del partido. Un evento nunca contiene una valoración; solo describe un hecho.

Ejemplo:
Jugador: Juan Pérez
Minuto: 34
Evento: Pase
Resultado: Exitoso

## 5. Contexto

El contexto describe las condiciones bajo las cuales ocurre el evento. Dos eventos iguales pueden tener diferente impacto dependiendo de su contexto.

Contexto espacial: área propia, primer tercio, zona media, último tercio, área rival.
Contexto temporal: minuto, tiempo del partido, tiempo añadido.
Contexto competitivo: ganando, empatando, perdiendo.
Contexto de presión: sin presión, baja, media, alta.
Contexto posicional: arquero, central, lateral, volante, extremo, delantero.

## 6. Complejidad de la acción

La complejidad representa la dificultad intrínseca de ejecutar correctamente una acción.

Factores iniciales:
- Dificultad técnica.
- Distancia de la acción.
- Precisión requerida.
- Presión rival.
- Velocidad de ejecución.
- Cantidad de rivales involucrados.
- Uso de pierna no dominante.
- Espacio disponible.
- Riesgo asumido.

La complejidad no sustituye el contexto. Dos eventos pueden ocurrir en el mismo contexto y tener distinta complejidad.

## 7. Consecuencia

Todo evento puede producir una consecuencia. Ejemplo: Pase → Rompe líneas → Genera ocasión → Asistencia → Gol. La consecuencia complementa al evento y permite medir su impacto.

## 8. Evidencia

Una evidencia es un evento registrado junto con su contexto, complejidad y consecuencia.

Evidencia = Evento + Contexto + Complejidad + Consecuencia.

La evidencia constituye la unidad de análisis del modelo.

## 9. Cadena de impacto

Los eventos rara vez son independientes. Generalmente forman cadenas.
Ejemplo: Recuperación → Pase progresivo → Pase filtrado → Remate → Gol.
Cada evento aporta valor dentro de la secuencia.

## 10. Evaluación

La evaluación no analiza únicamente eventos individuales. Analiza patrones construidos a partir de múltiples evidencias. La evaluación responde a capacidades demostradas por el jugador, no a la suma directa de acciones.

Ejemplo

Durante un partido un jugador realiza

- 63 pases
- 9 progresivos
- 4 rompen líneas
- 2 generan ocasión

## 11. Componentes del modelo

Capa 1 – Registro: registra eventos.
Capa 2 – Interpretación: analiza eventos considerando contexto y complejidad.
Capa 3 – Indicadores: agrupa evidencias para describir capacidades.
Capa 4 – Evaluación: construye el perfil del jugador. El Rating es una representación resumida y opcional.

## 12. Modelo de procesamiento

Video → Observación → Registro de eventos → Asignación de contexto → Determinación de complejidad → Construcción de evidencias → Generación de indicadores → Evaluación del jugador → Rating (opcional).

## 13. Alcance de la versión 0.1

Esta versión define únicamente la estructura conceptual del modelo. No define fórmulas matemáticas, pesos, calificaciones, rating, percentiles ni escalas.
