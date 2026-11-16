// Edit each text and choose its expression: warm, playful, sleepy, curious, serious, calm.
// Keep the quotes and commas. Accents are fine; the visual atlas uses base letters.
// The selected mood is shown only during its message; between messages she is neutral.
(function (host) {
  const messages = [
    { mood: 'warm', text: 'Hola, viajero. Puedes quedarte un rato.' },
    { mood: 'playful', text: 'Otra canción y ya... Eso dijimos hace tres canciones.' },
    { mood: 'sleepy', text: 'Si sigues aquí de madrugada, al menos estamos en buena compañía.' },
    { mood: 'curious', text: '¿Qué rincón vas a visitar ahora? Yo empezaría por Japón.' },
    { mood: 'serious', text: 'Esta web no necesita un algoritmo para tener personalidad.' },
    { mood: 'calm', text: 'No hace falta decir nada. Podemos escuchar un rato.' },
    { mood: 'warm', text: 'Algún día, las luces de Shibuya dejarán de ser solo una imagen.' },
    { mood: 'playful', text: 'Si una canción te gusta, repetirla veinte veces es una opción.' },
    { mood: 'curious', text: 'Un GIF raro, una canción, un recuerdo... ¿Qué guardarías aquí?' },
    { mood: 'calm', text: 'El reloj avanza, pero este pequeño rincón no tiene prisa.' },
    { mood: 'serious', text: 'No todo tiene que verse perfecto para significar algo.' },
    { mood: 'calm', text: 'Las páginas hechas a mano siempre dejan alguna huella.' }
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = messages;
  else host.HOME_COMPANION_MESSAGES = messages;
})(typeof window === 'undefined' ? globalThis : window);
