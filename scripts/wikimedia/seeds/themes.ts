import { t, type SeedGroup } from './types';

/*
 * Round-2 categories (D-122). Titles are French Wikipedia article titles picked from Wikidata
 * (instance-of class, picture P18, French article), ordered by number of Wikipedia editions
 * (sitelinks) so the best-known subjects come first; the generator keeps at most 150 per category.
 *   Dogs: P31 Q39367 (dog breed) · Cats: P31 Q43577 (cat breed)
 *   Painters: P106 Q1028181 (painter) and creator (P170) of at least two paintings (Q3305213)
 *   Cities: P31/P279? Q515 (city), population > 300 000, 60+ sitelinks (plus the former Geography "Villes")
 *   World dishes: P31/P279? Q746549 (dish), 10+ sitelinks (plus the former Gastronomy "Cuisines du monde")
 *   Arab & Islamic monuments: P149 Islamic architecture or P31 mosque, 8+ sitelinks, completed by
 *   hand with palaces, mausoleums, madrasas and citadels (former Architecture entries moved here).
 * Only the titles come from here; text, picture, licence and revision come from Wikimedia.
 */

export const DOGS: SeedGroup[] = [
  {
    group: 'Races de chiens 1',
    question: 'Quelle est cette race de chien ?',
    alt: 'Photographie d’un chien à identifier',
    titles: t(
      `Berger allemand; Dingo (chien sauvage); Labrador retriever; Beagle (chien); Chihuahua (chien); Golden retriever; Bulldog anglais; Teckel; Rottweiler; Akita (chien); Husky de Sibérie; Carlin; Boxer (chien); Dalmatien; Caniche; Dogue allemand; Dobermann; Border collie; Chow-chow; Saint-bernard; Yorkshire terrier; Lévrier afghan; Lévrier greyhound; Tosa (chien); Basenji; Shih tzu; Terre-neuve (chien); Bichon maltais; Bull Terrier; Samoyède (chien); Malamute de l'Alaska; Shiba (chien); Pékinois (chien); Bouledogue; Dogue du Tibet; Airedale Terrier; Shar Pei; Jack Russell terrier; Berger australien; West Highland white terrier; Berger du Caucase; Irish wolfhound; Dogue argentin; Landseer (chien); Chien de Saint-Hubert; Barzoï; Bullmastiff; Setter anglais; Berger d'Asie centrale; Bouvier australien; Lévrier persan; Cane Corso; Bouvier bernois; Cavalier King Charles Spaniel; American Pit Bull Terrier; Basset hound; Cairn terrier; Setter irlandais rouge; Shetland (chien); Chien-loup tchécoslovaque; Terrier écossais; Bichon à poil frisé; American Staffordshire Terrier; Cocker spaniel anglais; Komondor; Puli; Cocker américain; Lhassa Apso; Mastiff; Terrier de Boston; Berger belge; Bobtail; Azawakh; Terrier irlandais; Pinscher nain; Fox-terrier; Lévrier whippet; Chien de montagne des Pyrénées; Schnauzer miniature; Pointer anglais; Chien du pharaon; Affenpinscher; Border Terrier; Braque allemand à poil court; Mâtin napolitain; Braque hongrois à poil court; Chien de Canaan; Berger de Bergame; Setter Gordon; Welsh Corgi; Xoloitzcuintle; Chien de Rhodésie à crête dorsale; Staffordshire Bull Terrier; Bearded collie; Chien chinois à crête; Berger de Brie; Bedlington terrier; Bouledogue américain; Berger de Beauce; Épagneul breton; Chien de berger islandais; Braque de Weimar; Spitz finlandais; Schnauzer géant; Bichon bolonais; Chien d'arrêt allemand à poil dur; Épagneul nain continental papillon; Hovawart; Leonberg (chien); Petit lévrier italien; Chien du Groenland; Terrier tibétain; Australian Kelpie; Berger Kangal; Chien chanteur de Nouvelle-Guinée`,
    ),
  },
  {
    group: 'Races de chiens 2',
    question: 'Quelle est cette race de chien ?',
    alt: 'Photographie d’un chien à identifier',
    titles: t(
      `Berger de Maremme et Abruzzes; Dogue de Bordeaux; Terrier Kerry Blue; Malinois (chien); Welsh Corgi Pembroke; Retriever de la Nouvelle-Écosse; Welsh terrier; Aïdi; Fila Brasileiro; Berger blanc suisse; Spitz japonais; Épagneul japonais; Bichon havanais; Kuvasz; Chien de berger yougoslave de Charplanina; Shikoku (chien); Colley; Foxhound américain; Terrier australien; Esquimau américain; Terrier de chasse allemand; Coton de Tuléar; Chien d'eau portugais; Pumi (chien); Skye terrier; Chien-loup de Saarloos; Spitz allemand; Deerhound; Berger catalan; Terrier australien à poil soyeux; Dogue des Canaries; Pinscher allemand; Chien d'eau américain; Chien d'ours de Carélie; Chien d'élan norvégien gris; Berger polonais de plaine; Griffon bruxellois; Épagneul tibétain; Akbash; Foxhound anglais; Sloughi; Schipperke; Hokkaïdo (chien); Field Spaniel; Chien finnois de Laponie; American Hairless terrier; Lévrier espagnol; Mâtin espagnol; Braque italien; Manchester terrier; Buhund norvégien; Terrier noir russe; Mudi; Alaskan Klee Kai; Sealyham Terrier; Springer anglais; Esquimau canadien; Retriever de la baie de Chesapeake; Retriever à poil plat; Lakeland Terrier; Grand bouvier suisse; Pinscher autrichien; Terrier brésilien; Mâtin des Pyrénées; Norfolk Terrier; Kangal (chien); Clumber Spaniel; Cocker spaniel; Welsh Corgi Cardigan; Berger hollandais; Broholmer; Podenco d'Ibiza; Bouvier des Flandres; Eurasier; Laïka de Iakoutie; Épagneul d'eau irlandais; Kai (chien); Dandie Dinmont Terrier; Kishu (chien); Berger belge Groenendael; Spitz Loup; Berger de Bosnie-Herzégovine et de Croatie; Schnauzer moyen; Barbet (chien); Boerboel; Berger picard; Alano espagnol; Petit chien lion; Volpino italien; Berger de Russie méridionale; Kooikerhondje; Parson Russell terrier; Chien norvégien de macareux; Norwich Terrier; Spinone; King Charles Spaniel; Chart polski; Basset des Alpes; Bouvier d'Appenzell; Terrier d'agrément anglais noir et feu; Chien d'oysel allemand; Terrier irlandais Glen of Imaal; Cirneco de l'Etna; Berger croate; Terrier tchèque; Berger basque; Grand épagneul de Münster; Chien nu du Pérou; Chien d'eau romagnol; Chien à loutre; Tchouvatch slovaque; Vallhund suédois; Berger des Tatras; Sussex Spaniel; Laïka de Sibérie occidentale`,
    ),
  },
];

export const CATS: SeedGroup[] = [
  {
    group: 'Races de chats',
    question: 'Quelle est cette race de chat ?',
    alt: 'Photographie d’un chat à identifier',
    titles: t(
      `Siamois (chat); Persan (chat); Abyssin; Maine coon; Bengal; Angora turc; Manx (chat); British shorthair; Sphynx; Norvégien (chat); Bleu russe; Ragdoll; Sacré de Birmanie; Burmese; Sibérien (chat); Scottish fold & Highland Fold; Savannah (chat); Chartreux (chat); Korat; Mau égyptien; Bombay (chat); Ocicat; American curl; Balinais (chat); European shorthair; Devon rex; Turc de Van; American shorthair; Cornish rex; Himalayen; Somali (chat); Bobtail japonais; Exotic shorthair; Cymric; Munchkin (chat); Tonkinois; Oriental shorthair; Snowshoe; Singapura; Peterbald; Donskoy (chat); American wirehair; Selkirk rex; Bobtail des Kouriles; Burmilla; German rex; Bobtail américain; Pixie-bob; Havana brown; Toyger; British longhair; Chausie; Asian; Australian mist; Brazilian shorthair; LaPerm; Serengeti (chat); Sokoké; Thaï (chat); Ragamuffin; Californian spangled; Nebelung; Mau arabe; Tiffany (chat); Mandarin (chat); Ukrainian Levkoy; Chat de gouttière; Khao Manee; Chantilly (chat); Ojos azules; Lykoï; Colorpoint shorthair; Chat à poil long; Minskin; Seychellois; Bobtail du Mékong; Ural rex; Bobtail de Carélie; Highlander (chat); Anatoli; Foreign white; Chat rex; Ashera (chat); Burmese américain; Burmese anglais`,
    ),
  },
];

export const ISLAMIC_MONUMENTS: SeedGroup[] = [
  {
    group: 'Monuments arabes et islamiques 1',
    question: 'Quel est ce monument ?',
    alt: 'Photographie d’un monument à identifier',
    titles: t(
      `Alhambra; Taj Mahal; Mosquée-cathédrale de Cordoue; Dôme du Rocher; Mosquée al-Aqsa; Mosquée bleue; Mosquée al-Haram; Mosquée du Prophète; Grande mosquée des Omeyyades; Mosquée de Soliman; Mosquée Selimiye; Palais de Topkapı; Qutb Minar; Mosquée Cheikh Zayed; Grande mosquée de Djenné; Mosquée Hassan-II; Grande mosquée de Kairouan; Mosquée du Chah; Mosquée du Cheikh Lotfallah; Place Naghsh-e Jahan; Grande Mosquée d'Ispahan; Si-o-se Pol; Pont Khadju; Palais de Chehel Sotoun; Ali Qapu; Mosquée Nassir-ol-Molk; Registan; Mausolée de Gour Emir; Shah-i-Zinda; Mosquée Bibi-Khanym; Mausolée des Samanides; Minaret Kalon; Itchan Kala; Mausolée de Khoja Ahmed Yasavi; Tombeau d'Humayun; Fort d'Agra; Fort Rouge; Fatehpur-Sikri; Buland Darwaza; Jama Masjid (Delhi); Charminar; Bibi Ka Maqbara; Gol Gumbaz; Mosquée Badshahi; Fort de Lahore; Mosquée de Wazir-Khan; Jardins de Shalimar (Lahore); Mosquée Faisal; Minaret de Djam; Giralda; Alcazar de Séville; Medina Azahara; Aljafería; Generalife; Mosquée Koutoubia; Médersa Ben Youssef; Médersa Bou Inania; Université Al Quaraouiyine; Tour Hassan; Chellah; Kasbah des Oudayas; Bab Mansour; Grande Mosquée de Tlemcen; Mosquée Ketchaoua d'Alger; Djamaâ El-Djazaïr; Djamaâ El Kebir; Mosquée Zitouna; Grande Mosquée de Sousse; Ribat de Monastir; Mosquée Ibn Touloun; Mosquée Al-Azhar; Mosquée du sultan Hassan; Mosquée Mohammed Ali; Citadelle de Saladin`,
    ),
  },
  {
    group: 'Monuments arabes et islamiques 2',
    question: 'Quel est ce monument ?',
    alt: 'Photographie d’un monument à identifier',
    titles: t(
      `Mosquée Al-Rifa'i; Mosquée Amr ibn al-As; Qasr Amra; Grande mosquée de Samarra; Mausolée de l'imam Ali; Mausolée de l'imam Hussein; Sanctuaire Al-Askari; Mausolée Al-Kadhimiya; Grande Mosquée d'Alep; Mosquée de Quba; Grande Mosquée de Sanaa; Grande mosquée du sultan Qabus; Mosquée Al Fateh; Grande Mosquée de Koweït; Mosquée Istiqlal; Mosquée Omar Ali Saifuddin; Mosquée Putra; Masjid Negara; Mosquée Sultan Salahuddin Abdul Aziz; Grande mosquée de Xi'an; Mosquée Id Kah; Mosquée Huaisheng; Mosquée de Niujie; Grande mosquée de Paris; Mosquée Qolsharif; Mosquée Akhmad Kadyrov de Grozny; Mosquée Şehzade Mehmet; Mosquée Rüstem Pacha; Mosquée d'Ortaköy; Mosquée Fatih; Mosquée Eyüp Sultan; Mosquée de Kocatepe; Mosquée neuve; Mosquée Nuruosmaniye; Mosquée Mihrimah (Usküdar); Mosquée verte; Grande Mosquée de Bursa; Grande Mosquée de Divriği; Mosquée Sokollu Mehmet Pacha (Eminönü); Mosquée Bayezid II; Mosquée de Çamlıca; Vieille Mosquée d'Edirne; Mosquée Üç Şerefeli; Mosquée de Gazi Husrev-bey; Mosquée impériale de Sarajevo; Mosquée peinte de Tetovo; Mosquée Et'hem Bey; Mosquée Goharshad (Machhad); Mosquée bleue de Tabriz; Mosquée Vakil; Mosquée du Vendredi (Yazd); Gonbad-e Qabus; Dôme de Soltaniyeh; Arg-é Bam; Mosquée Djingareyber; Sankoré; Grande mosquée de Bruxelles; Mosquée de Rome; Mosquée de Larabanga; Mosquée d'Agadez; Grande Mosquée de Bamako; Mosquée nationale d'Abuja; Baitul Mukarram; Mosquée Tuba Chahi; Mosquée Taza Pir; Mosquées Djuma (Bakou); Mosquée Bibi-Heybat; Mosquée Kalon; Grande mosquée de Meknès; Mosquée des Andalous; Mosquée de Tinmel; Mosquée de Kobe; Mosquée de Tokyo`,
    ),
  },
];

export const WORLD_DISHES: SeedGroup[] = [
  {
    group: 'Plats du monde 1',
    question: 'Quel est ce plat ?',
    alt: 'Photographie d’un plat à identifier',
    titles: t(
      `Pizza; Hamburger; Sushi; Ramen; Paella; Couscous; Tajine; Lasagnes; Spaghetti alla carbonara; Risotto; Gnocchi; Ravioli; Moussaka; Gyros; Falafel; Houmous; Taboulé; Kebab; Pad thaï; Phở; Dim sum; Canard laqué; Kimchi; Bibimbap; Tempura; Okonomiyaki; Takoyaki; Burrito; Taco; Guacamole; Nachos; Ceviche; Empanada; Feijoada; Poutine; Fish and chips; Haggis; Goulasch; Pierogi; Bortsch; Blini; Biryani; Poulet tikka masala; Naan; Samoussa; Gazpacho; Tortilla; Chili con carne; Hot-dog; Club sandwich; Bagel; Pastrami; Barbecue; Fajita; Quesadilla; Tamale; Arepa; Pupusa; Jambalaya; Gumbo; Tom yum; Rouleau de printemps; Wonton; Mapo doufu; Nem; Bánh mì; Satay; Nasi goreng; Rendang; Laksa; Dal; Chapati; Tandoori; Chawarma; Mezzé; Shakshouka; Injera; Poulet yassa; Mafé; Thieboudiène; Bobotie; Biltong; Kibbeh; Dolma; Pita; Pide; Lahmacun; Rāmen; Salade russe; Pâtes à la carbonara; Salade grecque; Canard laqué de Pékin; Chakchouka; Bigos; Papadum; Foufou; Kefta; Gimbap; Mantı; Kebbé; Tamal; Enchilada; Poutine (plat); Salade caprese; Tteokbokki; Lángos; Appam; Panipuri; Soudjouk; Harira; Gado-gado; Pizza hawaïenne; Pizza Margherita; Tonkatsu; Osso buco`,
    ),
  },
  {
    group: 'Plats du monde 2',
    question: 'Quel est ce plat ?',
    alt: 'Photographie d’un plat à identifier',
    titles: t(
      `Foul; Cordon bleu (cuisine); Spätzle; Kochari; Pastırma; Macaroni au fromage; Salade Waldorf; Ugali; Basboussa; Bryndzové halušky; Asado; Kalakukko; Aşure; Hákarl; Syrniki; Tarte flambée; Thiéboudiène; Amatriciana; Rujak; Mouhallabié; Bortsch vert; Fattouche; Chana masala; Cendol; Osechi; Cacio e pepe; Menemen (plat); Fabada asturiana; Poke (plat); Pav bhaji; Lemang; Gefilte fish; Lokma; Loco moco; Japchae; Rousong; Fettuccine Alfredo; Croustillon; Mandu (plat); Żurek; Panzanella; Feuilles farcies; California roll; Saganáki; Ragù; Jian dui; Mango sticky rice; Oyakodon; Nouilles biáng biáng; Bortsch froid; Mititei; Skordaliá; Yakiniku; Bingsu; Ribollita; Vatrouchka; Stroganina; Churrasco; Pintxo; Assida; Saucisse de Francfort; Spaghetti alle vongole; Ghapama; Poulet du général Tao; Bakso; Chakalaka; Dhokla; Gogol Mogol; Dal bhat; Chawanmushi; Rogan josh; Cachupa; Ostkaka; Bubble and squeak (plat); Mitraillette (cuisine); Farofa; Lamian; Soupe joumou; Lontong; Kapsalon; Cranachan; Hareng en fourrure; Gulai; Po' boy; Unagidon; Tumpeng; Tchelow kabab; Zuccotto; Harosset; Cocido; Délice de Bouddha; Phat kaphrao; Bun cha; Tavuk göğsü; Pecel (cuisine); Panzerotti; Agliata; Çılbır; Asam pedas; Buccellato; Agnolotti; Migas (gastronomie); Toum (sauce); Crostini; Hallaca; Sandwich Reuben; Poulet Reine Élizabeth; Hotteok; Nasi uduk; Soupe de saumon finlandaise; Piperade; Curry rouge; Ema datshi; Nasi kuning; Tostada`,
    ),
  },
];

export const CITIES: SeedGroup[] = [
  {
    group: 'Villes du monde 1',
    question: 'Quelle est cette ville ?',
    alt: 'Photographie d’une ville à identifier',
    titles: t(
      `Paris; Marseille; Lyon; Bordeaux; Toulouse; Nice; Strasbourg; Lille; Nantes; Rouen; Londres; Édimbourg; Dublin; Amsterdam; Bruges; Bruxelles; Berlin; Munich; Hambourg; Vienne; Prague; Budapest; Varsovie; Cracovie; Rome; Venise; Florence; Milan; Naples; Barcelone; Madrid; Séville; Lisbonne; Porto; Athènes; Istanbul; Moscou; Saint-Pétersbourg; Stockholm; Copenhague; Oslo; Helsinki; Reykjavik; Zurich; Genève; New York; San Francisco; Los Angeles; Chicago; Las Vegas; Washington; Boston; Miami; Montréal; Québec; Toronto; Vancouver; Mexico; Rio de Janeiro; Buenos Aires; Lima; Cuzco; La Havane; Tokyo; Kyoto; Osaka; Séoul; Pékin; Shanghai; Hong Kong; Singapour; Bangkok; Hanoï; Dubaï; Jérusalem; Le Caire; Marrakech; Casablanca; Tunis; Le Cap; Nairobi; Sydney; Melbourne; Mumbai; Delhi; Jaipur; Dubrovnik; Cordoue; Grenade; Washington (district de Columbia); Vienne (Autriche); Bogota; Tirana; Kiev; Santiago; Hô Chi Minh-Ville; São Paulo; Jakarta; Bakou; Ankara; Damas; Téhéran; Bucarest; Ottawa; Bombay; Minsk; Tallinn; Belgrade; Vilnius; Tbilissi; Sofia; Kaboul; Bratislava; Brasilia; Macao`,
    ),
  },
  {
    group: 'Villes du monde 2',
    question: 'Quelle est cette ville ?',
    alt: 'Photographie d’une ville à identifier',
    titles: t(
      `Riga; Dacca; Dubaï (ville); Zagreb; Astana; Caracas; Alger; Erevan; Kuala Lumpur; Canberra; Beyrouth; Francfort-sur-le-Main; Manille; Kinshasa; Atlanta; Calcutta; Montevideo; Karachi; Accra; Pyongyang; Abuja; Addis-Abeba; Taipei; Katmandou; Skopje; Riyad; Islamabad; Tachkent; Amman; Chișinău; Pretoria; Houston; Honolulu; Tel Aviv-Jaffa; Cologne; Rabat; Lagos; Oulan-Bator; Seattle; Tripoli (Libye); Doha; Abou Dabi (ville); Johannesbourg; Luanda; Bichkek; Achgabat; Khartoum; Denver; Kampala; Liverpool; Stuttgart; Dresde; Guadalajara (Mexique); La Haye; Quito; Phnom Penh; Phoenix (Arizona); Turin; Gênes; Wuhan; Douchanbé; Alexandrie; Lviv; Asuncion; Perth (Australie-Occidentale); Odessa; Bamako; Dakar; Dallas; Sacramento; Glasgow; Palerme; Harare; Vientiane; Détroit (Michigan); La Nouvelle-Orléans; Düsseldorf; Windhoek; Sanaa; Brazzaville; Hanovre; Mogadiscio; Gdańsk; Ouagadougou; Canton (Chine); Kharkiv; Bissau; Rotterdam; Yokohama; Leipzig; Austin (Texas); Koweït (ville); Brisbane; Bangalore; Asmara; N'Djaména; Yaoundé; Lusaka; Maputo; Lomé; Kigali; Indianapolis; Izmir; Kazan; Birmingham; Monrovia; Niamey; Conakry; Antananarivo; Anvers; San Diego; Brême; Médine; Bonn; Djeddah`,
    ),
  },
];

export const PAINTERS: SeedGroup[] = [
  {
    group: 'Peintres 1',
    question: 'Quel peintre est représenté ?',
    alt: 'Portrait d’un peintre à identifier',
    titles: t(
      `Léonard de Vinci; Michel-Ange; Raphaël; Rembrandt; Vincent van Gogh; Claude Monet; Pablo Picasso; Salvador Dalí; Frida Kahlo; Paul Cézanne; Édouard Manet; Edgar Degas; Henri Matisse; Johannes Vermeer; Francisco de Goya; Diego Vélasquez; Albrecht Dürer; Sandro Botticelli; Titien; Caravage; Gustav Klimt; Edvard Munch; Pierre-Auguste Renoir; Paul Gauguin; Camille Pissarro; Eugène Delacroix; Jean-Auguste-Dominique Ingres; Jacques-Louis David; Georges Seurat; Henri de Toulouse-Lautrec; Marc Chagall; Wassily Kandinsky; Piet Mondrian; Joan Miró; René Magritte; Andy Warhol; Jackson Pollock; Pierre Soulages; Giotto; Jan van Eyck; Pierre Paul Rubens; Nicolas Poussin; Gustave Courbet; Jean-François Millet; Rosa Bonheur; Berthe Morisot; Georgia O'Keeffe; Katsushika Hokusai; Raphaël (peintre); William Blake; Le Caravage; Le Greco; Auguste Renoir; Vassily Kandinsky; Giotto di Bondone; Paul Klee; Jérôme Bosch; Pieter Brueghel l'Ancien; Caspar David Friedrich; Ilia Répine; Marcel Duchamp; Mary Cassatt; Amedeo Modigliani; William Turner; Georges Braque; Le Tintoret; Kasimir Malevitch; Diego Rivera; Dante Gabriel Rossetti; Antoine van Dyck; William Hogarth; Masaccio; Bartolomé Esteban Murillo; Francisco de Zurbarán; Paul Véronèse; Alfred Sisley; Gustave Doré; Artemisia Gentileschi; Camille Corot; Fra Angelico; Ernst Ludwig Kirchner; Franz Marc; Egon Schiele; Giovanni Bellini; Ivan Aïvazovski; Domenico Ghirlandaio; Hans Holbein le Jeune; Thomas Gainsborough; Canaletto; Max Ernst; John Constable; Henri Rousseau; Mark Rothko; Andrea Mantegna; Théodore Géricault; Antoine Watteau; Alfons Mucha; Joshua Reynolds; James Abbott McNeill Whistler; Francis Bacon (peintre); Piero della Francesca; Élisabeth Vigée Le Brun; José de Ribera; Frans Hals; Giambattista Tiepolo; Giorgione; Otto Dix; Andrea del Verrocchio; Giorgio de Chirico; Giuseppe Arcimboldo; Le Pérugin; Sofonisba Anguissola; Duccio di Buoninsegna; Honoré Daumier; Paul Signac`,
    ),
  },
  {
    group: 'Peintres 2',
    question: 'Quel peintre est représenté ?',
    alt: 'Portrait d’un peintre à identifier',
    titles: t(
      `August Macke; George Grosz; Viktor Vasnetsov; David Hockney; Ivan Chichkine; Bronzino; William Bouguereau; Amrita Sher-Gil; Ravi Varmâ; Juan Gris; Jan Matejko; John Singer Sargent; Andrea del Sarto; Max Beckmann; Cimabue; Rogier van der Weyden; Odilon Redon; François Boucher; Edward Hopper; Lucas Cranach l'Ancien; Robert Delaunay; Jean-Honoré Fragonard; Antonello de Messine; Paolo Uccello; Oskar Kokoschka; Frédéric Bazille; Jean-Michel Basquiat; Francis Picabia; Carl Larsson; Ivan Kramskoï; Roy Lichtenstein; Jean-Léon Gérôme; Vassili Verechtchaguine; Le Corrège; Arnold Böcklin; John Everett Millais; Tamara de Lempicka; Gustave Caillebotte; Angelica Kauffmann; André Derain; Guido Reni; William Holman Hunt; Valentin Serov; Umberto Boccioni; Fernand Léger; Pierre Bonnard; Willem de Kooning; Jan Steen; Issaak Levitan; Karl Brioullov; Eugène Boudin; Claude Gellée; Grant Wood; Norman Rockwell; Georges de La Tour; Anders Zorn; Gustave Moreau; Max Liebermann; Vassili Sourikov; Charles Le Brun; Akseli Gallen-Kallela; Vassili Perov; Matthias Grünewald; Francesco Hayez; Albrecht Altdorfer; Simone Martini; Thomas Eakins; Fra Filippo Lippi; Hans Memling; Carl Spitzweg; James Ensor; Pontormo; Lawrence Alma-Tadema; Annibale Carracci; Jean Siméon Chardin; Lovis Corinth; Anton Raphael Mengs; Arkhip Kouïndji; Maurice Denis; Vittore Carpaccio; Gentile Bellini; Mikhaïl Vroubel; Luca Signorelli; Ambrogio Lorenzetti; John William Waterhouse; Jean Fouquet; Parmigianino; Charles-François Daubigny; Thomas Cole; Leonora Carrington; Filippino Lippi; Suzanne Valadon; Giulio Romano; Théodore Rousseau; Jacob van Ruisdael; Nathalie Gontcharova; James Tissot; Edward Burne-Jones; Félix Vallotton; Henri Fantin-Latour; Fra Bartolomeo; Joaquín Sorolla; Jan Brueghel l'Ancien; Alexej von Jawlensky; Johann Heinrich Füssli; Pinturicchio; Pierre de Cortone; Bernardo Bellotto; Le Guerchin; Boris Koustodiev; Salvator Rosa; Alexandre Cabanel; Winslow Homer; Piero di Cosimo; Frederic Leighton`,
    ),
  },
];
