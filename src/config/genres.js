// Genre slug → TMDB discover config
export const GENRE_MAP = {
  action:    { id: 28,  label: 'Action Movies',    mediaType: 'movie' },
  animation: { id: 16,  label: 'Animation Movies', mediaType: 'movie' },
  comedy:    { id: 35,  label: 'Comedy Movies',    mediaType: 'movie' },
  drama:     { id: 18,  label: 'Drama Movies',     mediaType: 'movie' },
  horror:    { id: 27,  label: 'Horror Movies',    mediaType: 'movie' },
  anime:     { id: null, label: 'Anime',           mediaType: 'both', language: 'ja' },
  yoruba:   { id: null, label: 'Yoruba Films',     mediaType: 'movie', language: 'yo', country: 'NG' },
  igbo:     { id: null, label: 'Igbo Films',       mediaType: 'movie', language: 'ig', country: 'NG' },
  hausa:    { id: null, label: 'Hausa Films',      mediaType: 'movie', language: 'ha', country: 'NG' },
  naija_action: { id: 28, label: 'Naija Action',  mediaType: 'movie', country: 'NG' },
  naija_comedy: { id: 35, label: 'Naija Comedy',  mediaType: 'movie', country: 'NG' },
  naija_drama:  { id: 18, label: 'Naija Drama',   mediaType: 'movie', country: 'NG' },
};
