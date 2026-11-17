// Editable HOME object reactions. These do not enter the automatic/random message pool.
(function (host) {
  const reactions = {
    clock: [
      { mood: 'sleepy', text: 'Mirar el reloj no hace que la próxima canción dure menos. Lo he comprobado muchas madrugadas.' },
      { mood: 'calm', text: 'El reloj lleva la hora. Yo llevo la cuenta de las veces que dijimos «cinco minutos más».' }
    ],
    avatar: [
      { mood: 'warm', text: 'Ese es el rincón de Muted. Aunque, viendo el avatar, sospecho que el gato tiene la última palabra.' },
      { mood: 'playful', text: '¿El verdadero administrador de esta página? Mira el avatar. Tiene bigotes y ninguna intención de trabajar.' }
    ],
    mascots: [
      { mood: 'playful', text: 'Kirby lleva todo el día caminando por aquí. Espero que no haya venido a comerse la biblioteca.' },
      { mood: 'warm', text: 'No alimentes al GIF después de medianoche. Es broma... pero con Kirby nunca se sabe.' }
    ],
    badges: [
      { mood: 'serious', text: 'Hecha a mano, con paciencia y alguna etiqueta rebelde. Ese pequeño badge se lo ha ganado.' },
      { mood: 'playful', text: 'MADE W/ NOTEPAD. El sello de calidad oficial de «esto lo arreglo yo a las dos de la mañana».' }
    ],
    visits: [
      { mood: 'curious', text: 'Ese contador todavía es decorativo. Por ahora, mi única estadística fiable es que tú estás aquí.' },
      { mood: 'playful', text: 'No, no he contado esas visitas una por una. El contador es decorativo; yo ya tengo bastante con los libros.' }
    ],
    fortune: [
      { mood: 'curious', text: 'A ver qué dice el omikuji... Si no te gusta, culparemos al cilindro de bambú, no a quien lo agitó.' },
      { mood: 'playful', text: '¿Otra fortuna? Te recuerdo que el cilindro no acepta reclamaciones. Yo te preparo un té por si acaso.' }
    ],
    guestbook: [
      { mood: 'warm', text: 'El libro de visitas sigue en construcción. Estoy guardando una página para cuando puedas dejar tu saludo.' },
      { mood: 'playful', text: 'Todavía no se puede escribir en ese libro. Culpa de las obras, no de una bibliotecaria especialmente lenta.' }
    ]
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = reactions;
  else host.HOME_COMPANION_REACTIONS = reactions;
})(typeof window === 'undefined' ? globalThis : window);
