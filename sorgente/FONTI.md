# Visita virtuale del Foro Italico

## Riferimenti del modello

Il centro locale coincide con il centro del campo cartografato. L'asse X segue il campo verso nord e Z punta verso la tribuna Tevere e lo Stadio dei Marmi. Le distanze sono in metri. La vista iniziale è una prospettiva del modello.

| Componente | Dato utilizzato | Interpretazione nella scena |
| --- | --- | --- |
| Suolo | Ortofoto AGEA 2020, mosaico Regione Lazio, livello WMS `geonode:2020_AGEA_25833_COG` | Immagine riorientata nel sistema dello stadio. La porzione di tetto fotografata dall'alto è sostituita da pavimentazione sotto la geometria 3D. L'anno del volo può differire da quello della foto fornita. |
| Terreno | Mapzen Terrain Tiles, formato Terrarium, SRTM e altre fonti di elevazione secondo la copertura | Campionamento su una griglia locale di 15 m. La superficie della zona sportiva è regolarizzata. |
| Olimpico e Foro Italico | © OpenStreetMap contributors. Impronta dell'Olimpico 117457119, anello interno 119391961, campo 667711166, anello della pista dei Marmi 667706953 e 667706954 | Geometrie locali in `assets/site.json`. Alcune altezze dei volumi secondari sono stimate. |
| Vegetazione | Punti e filari OSM, poligoni boschivi, ortofoto AGEA e campioni della foto fornita | I pini principali seguono gli elementi mappati. Sul versante le posizioni delle chiome sono stimate dai massimi locali di luminosità dell'ortofoto entro le aree boscate. Sagoma, varietà botanica e altezza dei singoli alberi restano approssimative. |
| Copertura | Scheda di progetto MJW Structures, Roma 1990 | 88 campate con anello perimetrale, diagonali, tiranti, supporti secondari e membrana modulata. Profili, spessori e deformazioni sono ricostruiti visivamente. |
| Facciate | Fotografia fornita con il progetto e sagoma planimetrica OSM | Parte del fronte verso i Marmi usa una fascia fotografica rettificata. Altri prospetti e torri sono modellati per analogia. |
| Stadio dei Marmi | Cartografia OSM, ortofoto, documentazione Sport e Salute / Comune di Roma | Bordo pista, gradinate e posizioni delle opere scultoree. Le figure in marmo sono semplificate e non riproducono individualmente le sculture. |
| Interno dell'Olimpico | Campo, pista, anello e organizzazione della demo precedente | Sedute singole, gradoni, corpo centrale della tribuna, reti, bandierine e schermi. La numerazione dei posti e la disponibilità sono dimostrative. |
| Passaggio verso la tribuna | Collegamento costruito nel modello tra la facciata e il livello della gradinata | Il percorso di visita è esemplificativo. Posizione e pendenza del passaggio non derivano da un rilievo degli interni. |

## Contesto Google Maps (facoltativo)

Con una chiave Map Tiles API il suolo, la vegetazione, gli edifici, lo Stadio dei Marmi e il rilievo di questa tabella vengono sostituiti dalle Photorealistic 3D Tiles di Google, caricate in streaming e non salvate nel file. Le tile vengono convertite dal sistema terrestre (ECEF) a quello locale dello stadio in `src/google3d.js`. Il centro del campo è a 41.933886 N, 12.454786 E, l'asse del campo ha azimut −16,5° e la quota viene misurata sul piazzale. Entro la sagoma della facciata più 10 m le tile sono spianate sotto il modello ricostruito. Lo stadio, la copertura e gli interni continuano a derivare dalle fonti elencate qui sopra e dalla cartografia OSM (`rim`, `inner`).

## Crediti e licenze

- **Ortofoto.** © AGEA – Agenzia per le Erogazioni in Agricoltura, Roma. Mosaico Regione Lazio, Area Sistema Informativo Territoriale Regionale. Estratto, riorientato e ritoccato per il modello. [Scheda regionale](https://geoportale.regione.lazio.it/catalogue/csw_to_extra_format/r_lazio%3A92b0f7e3-3b75-4feb-ac5e-2382/ortofoto-agea-v-2020.html) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Google Maps (solo con chiave).** Photorealistic 3D Tiles, Map Tiles API, © Google e fornitori indicati a schermo. Uso soggetto ai [Termini di Google Maps Platform](https://cloud.google.com/maps-platform/terms) e alle [policy della Map Tiles API](https://developers.google.com/maps/documentation/tile/policies).
- **Cartografia.** © OpenStreetMap contributors. La base cartografica derivata in `assets/site.json` è disponibile con licenza ODbL 1.0. Il campo `woodCrowns` contiene posizioni stimate dall'ortofoto regionale. [Attribuzione OpenStreetMap](https://www.openstreetmap.org/copyright) · [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
- **Rilievo.** Mapzen / Tilezen e contributori dei dati di elevazione, inclusa NASA SRTM. [Dataset AWS](https://registry.opendata.aws/terrain-tiles/) · [Attribuzioni dei dati sorgente](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).
- **Materiali e luce ambiente.** Poly Haven, risorse CC0. Mappe ridimensionate o ricodificate per l'esecuzione offline. L'HDRI è utilizzata per la luce riflessa. [Aerial Grass Rock](https://polyhaven.com/a/aerial_grass_rock) · [Concrete Wall 006](https://polyhaven.com/a/concrete_wall_006) · [Asphalt 04](https://polyhaven.com/a/asphalt_04) · [Kloofendal 48d Partly Cloudy](https://polyhaven.com/a/kloofendal_48d_partly_cloudy).
- **Struttura di copertura.** [MJW Structures, Copertura Stadio Olimpico](https://www.majowiecki.com/copertura-stadio-olimpico/s5e79d6ff).
- **Foro Italico e Stadio dei Marmi.** [Sport e Salute e Comune di Roma, relazione generale di restauro (2023)](https://www.mit.gov.it/nfsmitgov/files/media/conferenza-servizio/2023-04/PFI.SM_.001.PD_.00.RG_.001-Relazione%20generale%20-%20Stadio%20dei%20Marmi.pdf).
- **Fotografia usata per le texture.** Immagine fornita con la richiesta. Credito del fotografo e licenza di pubblicazione non indicati. Le porzioni rettificate di chiome e facciata derivano da questa immagine. La licenza della cartografia non si estende alla foto o allo stemma.
