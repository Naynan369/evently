import type { MessinaArea } from "./messina";

type AreaPhoto = {
  src: string;
  place: { en: string; it: string };
  alt: { en: string; it: string };
  credit?: string;
  source?: string;
  license?: string;
  licenseUrl?: string;
};

// Keep the guide, list previews and WebGL scene on the same photo for each area.
export const messinaAreaPhotos: Record<MessinaArea, AreaPhoto> = {
  centro: {
    src: "/images/messina-cathedral-sunset.jpg",
    place: { en: "Piazza Duomo · Messina", it: "Piazza Duomo · Messina" },
    alt: { en: "Messina Cathedral at sunset", it: "Il Duomo di Messina al tramonto" },
  },
  sud: {
    src: "/images/messina-areas/messina-giampilieri.webp",
    place: { en: "Giampilieri Marina · South Messina", it: "Giampilieri Marina · Messina Sud" },
    alt: { en: "People playing on the beach at Giampilieri Marina", it: "Persone che giocano sulla spiaggia di Giampilieri Marina" },
    credit: "Ivitellisonobelli",
    source: "https://commons.wikimedia.org/wiki/File:Giampilieri_Marina_Spiaggia.JPG",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  nord: {
    src: "/images/messina-areas/messina-north.webp",
    place: { en: "Pace · North Messina", it: "Pace · Messina Nord" },
    alt: { en: "Beach and Strait at Pace in northern Messina", it: "La spiaggia e lo Stretto a Pace, Messina Nord" },
    credit: "Effems",
    source: "https://commons.wikimedia.org/wiki/File:Stretto_(Messina)_03_04_2024_04.jpg",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  ganzirri: {
    src: "/images/messina-areas/messina-ganzirri.webp",
    place: { en: "Lago di Ganzirri · Messina", it: "Lago di Ganzirri · Messina" },
    alt: { en: "Palms by Lake Ganzirri in Messina", it: "Palme lungo il Lago di Ganzirri a Messina" },
    credit: "Effems",
    source: "https://commons.wikimedia.org/wiki/File:Ganzirri_(Messina)_03_04_2024_13.jpg",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  "torre-faro": {
    src: "/images/messina-areas/messina-torre-faro.webp",
    place: { en: "Torre Faro · Strait of Messina", it: "Torre Faro · Stretto di Messina" },
    alt: { en: "The Torre Faro pylon seen from the lakes", it: "Il Pilone di Torre Faro visto dai laghi" },
    credit: "Sissi Sul",
    source: "https://commons.wikimedia.org/wiki/File:Il_Pilone_di_Torre_Faro_visto_dai_Laghi.jpg",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  colli: {
    src: "/images/messina-areas/messina-peloritani.webp",
    place: { en: "Peloritani Mountains · Messina", it: "Monti Peloritani · Messina" },
    alt: { en: "Green slopes of the Peloritani Mountains", it: "I versanti verdi dei Monti Peloritani" },
    source: "https://commons.wikimedia.org/wiki/File:Pizzo_russa,_monti_peloritani,_sicily.JPG",
    license: "Public domain",
  },
};
