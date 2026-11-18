// Edit each text and choose its expression: warm, playful, sleepy, curious, serious, calm.
// Keep the quotes and commas. Accents are fine; the visual atlas uses base letters.
// Optional link: { url: 'https://…', label: 'Ver el vídeo' }. No HTML; never opens automatically.
// The selected mood is shown only during its message; between messages she is neutral.
(function (host) {
  const messages = [
    { mood: 'warm', text: 'Hola, viajera. Puedes quedarte un rato.' },
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
    { mood: 'calm', text: 'Las páginas hechas a mano siempre dejan alguna huella.' },
    { mood: 'playful', text: 'Acabas de desbloquear un diálogo secreto. Era este. Fin del presupuesto.' },
    { mood: 'curious', text: 'Un archivo MIDI guarda notas e instrucciones, no una grabación de voz. Una partitura diminuta para tu ordenador.' },
    { mood: 'playful', text: 'Noticia urgente: has sido elegida para escuchar otra canción. El jurado era yo.' },
    { mood: 'warm', text: 'Puedes tocarme para hablar. No hace falta esperar a que se me ocurra algo brillante.' },
    { mood: 'playful', text: 'He detectado una presencia misteriosa... Ah, eras tú mirando la pantalla.' },
    { mood: 'curious', text: 'Si ves un disquete en el botón de guardar, estás viendo un pequeño fósil digital.' },
    { mood: 'sleepy', text: 'El té es virtual. La costumbre de decir «una canción más», no tanto.' },
    { mood: 'playful', text: 'Mantengo esta biblioteca ordenada. Tus pestañas abiertas ya son asunto tuyo.' },
    { mood: 'curious', text: '¿Conoces el Geddan, ese Get Down tan peculiar? Te dejo a Haruhi y compañía para que investigues.',
      link: { url: 'https://youtu.be/XFg5rAAG4Tk?si=vt005pZsPHFUd0bs', label: 'Ver Get Down / Geddan' } },
    { mood: 'calm', text: 'Un GIF puede hacerte compañía durante años sin aprender nada sobre ti.' },
    { mood: 'playful', text: 'Tu nivel de nostalgia ha subido. La experiencia no sirve para nada, pero queda bonito.' },
    { mood: 'serious', text: 'Un enlace a una web que te gusta también es una forma de cuidar internet.' },
    { mood: 'warm', text: 'Hay canciones que parecen guardar la luz de una habitación en la que ya no estás.' },
    { mood: 'playful', text: 'Tengo un documento histórico importantísimo. Bueno... es Haruhi haciendo Geddan. Casi lo mismo.',
      link: { url: 'https://youtu.be/XFg5rAAG4Tk?si=vt005pZsPHFUd0bs', label: 'Abrir el documento histórico' } },
    { mood: 'curious', text: 'Los libros de visitas ya dejaban pequeños «hola, estuve aquí» antes de que todo se midiera en likes.' },
    { mood: 'playful', text: 'Nunca te fíes del todo de un archivo llamado final_final_ahora_si. Hablo por experiencia bibliotecaria.' },
    { mood: 'sleepy', text: 'Si mañana preguntas quién te dejó despierta, yo negaré haber recomendado otra canción.' },
    { mood: 'warm', text: 'No todas las visitas tienen que dejar un mensaje. Me alegra que hayas pasado.' },
    { mood: 'playful', text: 'Este mensaje no contiene ninguna pista secreta. O eso diría alguien escondiendo una pista.' },
    { mood: 'calm', text: 'Puedes quedarte mirando la lluvia, una portada o un GIF. No hace falta convertirlo todo en una tarea.' },
    { mood: 'curious', text: 'Keyboard Cat se grabó en 1984, antes de YouTube. Charlie Schmidt ya estaba guardando nostalgia para nosotras.',
      link: { url: 'https://www.youtube.com/watch?v=J---aiyznGQ', label: 'Escuchar a Keyboard Cat' } },
    { mood: 'playful', text: 'El pronóstico dice Chocolate Rain. Por si acaso, no abras el paraguas dentro de la biblioteca.',
      link: { url: 'https://www.youtube.com/watch?v=EwTZ2xpQwpA', label: 'Ver Chocolate Rain · Tay Zonday' } },
    { mood: 'playful', text: 'Si dos unicornios te ofrecen una excursión a Candy Mountain, yo leería primero la letra pequeña.',
      link: { url: 'https://www.youtube.com/watch?v=CsGYh8AacgY', label: 'Ver Charlie the Unicorn · FilmCow' } },
    { mood: 'playful', text: 'Encontré un enlace completamente inocente. Rick Astley aparece por pura coincidencia, lo prometo.',
      link: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', label: 'Un enlace nada sospechoso' } }
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = messages;
  else host.HOME_COMPANION_MESSAGES = messages;
})(typeof window === 'undefined' ? globalThis : window);
