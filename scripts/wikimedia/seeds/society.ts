import { t, type SeedGroup } from './types';

const PERSON = (q: string) => ({ question: q, alt: 'Portrait ou représentation à identifier' });

export const HISTORY: SeedGroup[] = [
  {
    group: 'Souverains et chefs d’État',
    ...PERSON('Quel personnage historique est représenté ?'),
    titles: t(
      `Napoléon Ier; Louis XIV; Louis XVI; Marie-Antoinette; Henri IV; François Ier; Charlemagne; Clovis Ier; Jeanne d'Arc; Charles de Gaulle; Robespierre; Georges Danton; Louis XV; Napoléon III; Cléopâtre VII; Ramsès II; Toutânkhamon; Akhenaton; Hatchepsout; Alexandre le Grand; Jules César; Auguste; Néron; Marc Aurèle; Constantin Ier; Attila; Hannibal Barca; Périclès; Léonidas Ier; Gengis Khan; Saladin; Richard Cœur de Lion; Guillaume le Conquérant; Élisabeth Ire; Henri VIII; Victoria; Charles Quint; Philippe II d'Espagne; Isabelle Ire de Castille; Pierre le Grand; Catherine II; Ivan le Terrible; Frédéric II de Prusse; Otto von Bismarck; George Washington; Abraham Lincoln; Thomas Jefferson; Benjamin Franklin; Simón Bolívar; Mohandas Karamchand Gandhi; Nelson Mandela; Winston Churchill; Franklin Delano Roosevelt; Lénine; Mao Zedong; Mustafa Kemal Atatürk; John F. Kennedy; Martin Luther King; Che Guevara; Mansa Moussa; Soliman le Magnifique; Mehmed II; Tamerlan; Akbar; Qin Shi Huang; Napoléon Bonaparte; Léopold II; Marie-Thérèse d'Autriche; Élisabeth II; Louis XIII; Louis XVIII; Charles X; Philippe Auguste; Saint Louis; Hugues Capet; Catherine de Médicis; Richelieu; Mazarin; Colbert; Marie Curie; Christophe Colomb; Fernand de Magellan; Vasco de Gama; Jacques Cartier; James Cook; Marco Polo; Samuel de Champlain; Cortés; Francisco Pizarro; Amerigo Vespucci; Ferdinand Foch; Philippe Pétain; Georges Clemenceau; Jean Jaurès; Léon Blum; Napoléon II; Joséphine de Beauharnais; Charles le Téméraire`,
    ),
  },
  {
    group: 'Événements et lieux historiques',
    question: 'Quel événement ou quel lieu historique est illustré ?',
    alt: 'Illustration d’un événement ou d’un lieu historique à identifier',
    titles: t(
      `Tapisserie de Bayeux; Mur d'Hadrien; Pompéi; Herculanum; Titanic; Mur de Berlin; Bataille de Waterloo; Prise de la Bastille; Bataille d'Austerlitz; Bataille de Marathon; Bataille de Trafalgar; Bataille de Verdun; Débarquement de Normandie; Bombardement atomique de Hiroshima; Déclaration d'indépendance des États-Unis; Révolution française; Sacre de Napoléon; Traité de Versailles; Siège de Troie; Invincible Armada; Peste noire; Grand incendie de Londres; Tour de Londres; Forum romain; Voie appienne; Théâtre d'Épidaure; Agora d'Athènes; Colonne Trajane; Arc de Constantin; Cité de Pétra; Pierre de Rosette; Tombe de Toutânkhamon; Vallée des Rois; Grande Pyramide; Jardins suspendus de Babylone; Porte d'Ishtar; Mur des Lamentations; Alcatraz; Auschwitz; Appomattox; Fort Sumter; Boston Tea Party; Mayflower; Santa Maria (navire); Bounty; Cutty Sark; Victory (navire); Vasa; Cité de Troie; Knossos; Mycènes; Delphes; Olympie; Épidaure; Ostie; Volubilis; Carthage; Leptis Magna; Timgad; Persépolis; Babylone; Ninive; Ur; Uruk; Çatal Höyük; Göbekli Tepe; Lascaux; Grotte Chauvet; Alignements de Carnac; Newgrange; Skara Brae; Stonehenge`,
    ),
  },
];

const MYTH = {
  question: 'Quelle figure mythologique est représentée ?',
  alt: 'Représentation d’une figure mythologique à identifier',
};

export const MYTHOLOGY: SeedGroup[] = [
  {
    group: 'Dieux et déesses grecs',
    ...MYTH,
    titles: t(
      `Zeus; Poséidon; Hadès; Héra; Athéna; Apollon; Artémis; Arès; Aphrodite; Héphaïstos; Hermès; Dionysos; Déméter; Perséphone; Hestia; Éros; Pan; Gaïa; Cronos; Rhéa (mythologie); Hécate; Nikê; Éole; Morphée; Hypnos; Thanatos; Némésis; Tyché; Hélios; Séléné; Éos; Iris (mythologie); Hébé; Asclépios; `,
    ),
  },
  {
    group: 'Dieux et déesses romains',
    ...MYTH,
    titles: t(
      `Jupiter (mythologie); Mars (mythologie); Vénus (mythologie); Minerve; Neptune (mythologie); Vulcain (mythologie); Janus; Saturne (mythologie); Diane (mythologie); Mercure (mythologie); Cérès (mythologie); Bacchus; Pluton (mythologie); Junon (mythologie); Vesta (mythologie); Cupidon; Flore (mythologie); Aurore (mythologie); Faunus; Bellone; Fortuna`,
    ),
  },
  {
    group: 'Héros et personnages de légende',
    ...MYTH,
    titles: t(
      `Héraclès; Persée; Thésée; Achille; Ulysse; Orphée; Prométhée; Atlas (mythologie); Narcisse; Œdipe; Antigone; Électre; Jason; Médée; Ariane; Pénélope; Hélène de Troie; Pâris; Hector; Énée; Romulus et Rémus; Icare; Dédale; Sisyphe; Tantale; Pandore; Midas; Ganymède (mythologie); Adonis; Psyché; Bellérophon; Ajax; Agamemnon; Cassandre; Léda; Europe (mythologie); Danaé; Andromède; Callisto (mythologie); Daphné; Arthur; Merlin; Lancelot du Lac; Roland; Siegfried; Beowulf; Robin des Bois; Guillaume Tell; Gilgamesh; Sigurd`,
    ),
  },
  {
    group: 'Créatures fantastiques',
    ...MYTH,
    titles: t(
      `Méduse; Minotaure; Cerbère; Hydre de Lerne; Pégase; Sphinx; Centaure; Sirène (mythologie); Cyclope; Chimère; Griffon; Phénix; Licorne; Dragon; Harpie; Troll; Satyre; Nymphe; Hippogriffe; Basilic (mythologie); Kraken; Léviathan; Golem; Vampire; Loup-garou; Fée; Elfe; Nain (mythologie); Sylphe; Salamandre (mythologie); Yéti; Bigfoot; Wendigo; Banshee; Leprechaun; Kitsune; Tengu; Kappa; Oni; Naga; Garuda; Roc (mythologie); Simurgh; Triton (mythologie); Charybde et Scylla; Typhon; Échidna; Python (mythologie); Argos (mythologie)`,
    ),
  },
  {
    group: 'Divinités nordiques, égyptiennes et orientales',
    ...MYTH,
    titles: t(
      `Odin; Thor; Loki; Freyja; Freyr; Baldr; Heimdall; Týr; Hel (mythologie); Fenrir; Jörmungand; Yggdrasil; Valkyrie; Sleipnir; Ra; Osiris; Isis; Anubis; Horus; Seth; Thot; Bastet; Sekhmet; Ptah; Amon; Hathor; Nout; Geb; Sobek; Khnoum; Maât; Bès; Aton; Quetzalcoatl; Tezcatlipoca; Huitzilopochtli; Tlaloc; Viracocha; Inti; Shiva; Vishnou; Ganesh; Krishna; Kali; Brahmā; Hanuman; Lakshmi; Durga; Sarasvatî; Rama; Amaterasu; Susanoo; Izanagi; Raijin; Fūjin; Guanyin; Sun Wukong; Mazu; Mithra; Ahura Mazda; Ishtar; Marduk; Gilgamesh; Dagon; Baal; Moloch; Lugh; Dagda; Cernunnos; Épona; Taranis; Teutatès; Svarog; Perun`,
    ),
  },
];

const DISH = {
  question: 'Quel est ce plat ou cette spécialité ?',
  alt: 'Photographie d’un plat ou d’une spécialité culinaire à identifier',
};

export const GASTRONOMY: SeedGroup[] = [
  {
    group: 'Cuisine française',
    ...DISH,
    titles: t(
      `Ratatouille; Bouillabaisse; Cassoulet; Choucroute; Fondue savoyarde; Raclette; Quiche lorraine; Tarte Tatin; Crêpe; Galette bretonne; Croque-monsieur; Pot-au-feu; Bœuf bourguignon; Coq au vin; Blanquette de veau; Soupe à l'oignon; Salade niçoise; Tartiflette; Moules-frites; Gaufre; Pissaladière; Aligot; Brandade de morue; Flamiche; Gratin dauphinois; Pot-au-feu; Escargot de Bourgogne; Foie gras; Rillettes; Pâté en croûte; Andouillette; Boudin noir; Saucisson sec; Magret de canard; Confit de canard; Steak tartare; Œufs mayonnaise; Quenelle; Gougère; Socca; Pan-bagnat; Tapenade; Aïoli; Bouchées à la reine; Hachis parmentier; Potée; Navarin; Tripes à la mode de Caen; Fricassée; Jambon-beurre; Croque-madame; Omelette; Soufflé; Vichyssoise`,
    ),
  },
  {
    group: 'Pâtisseries et desserts',
    ...DISH,
    titles: t(
      `Baguette; Croissant; Pain au chocolat; Brioche; Macaron; Éclair; Mille-feuille; Paris-Brest; Saint-honoré; Opéra; Forêt-noire (gâteau); Cheesecake; Brownie; Tarte au citron; Crème brûlée; Profiterole; Madeleine; Financier; Clafoutis; Far breton; Kouign-amann; Cannelé; Beignet; Chouquette; Pancake; Donut; Muffin; Scone; Bretzel; Strudel; Sachertorte; Baklava; Loukoum; Tiramisu; Panna cotta; Gâteau basque; Île flottante (dessert); Mousse au chocolat; Riz au lait; Tarte aux fraises; Millefeuille; Religieuse (pâtisserie); Pain d'épices; Nougat; Calisson; Bûche de Noël; Galette des rois; Crêpe Suzette; Pavlova; Churros; Pastel de nata; Cupcake; Meringue; Charlotte (dessert); Succès (pâtisserie); Fraisier; Tarte Bourdaloue; Gâteau au chocolat; Pain perdu; Crème caramel; Sorbet; Glace (aliment); Marron glacé; Chantilly`,
    ),
  },
  {
    group: 'Cuisines du monde',
    ...DISH,
    titles: t(
      `Pizza; Hamburger; Sushi; Ramen; Paella; Couscous; Tajine; Lasagnes; Spaghetti alla carbonara; Risotto; Gnocchi; Ravioli; Moussaka; Gyros; Falafel; Houmous; Taboulé; Kebab; Pad thaï; Phở; Dim sum; Canard laqué; Kimchi; Bibimbap; Tempura; Okonomiyaki; Takoyaki; Burrito; Taco; Guacamole; Nachos; Ceviche; Empanada; Feijoada; Poutine; Fish and chips; Haggis; Goulasch; Pierogi; Bortsch; Blini; Biryani; Poulet tikka masala; Naan; Samoussa; Gazpacho; Tortilla; Chili con carne; Hot-dog; Club sandwich; Bagel; Pastrami; Barbecue; Fajita; Quesadilla; Tamale; Arepa; Pupusa; Jambalaya; Gumbo; Tom yum; Rouleau de printemps; Wonton; Mapo doufu; Nem; Bánh mì; Satay; Nasi goreng; Rendang; Laksa; Dal; Chapati; Tandoori; Chawarma; Mezzé; Shakshouka; Injera; Poulet yassa; Mafé; Thieboudiène; Bobotie; Biltong; Kibbeh; Dolma; Pita; Pide; Lahmacun`,
    ),
  },
  {
    group: 'Fromages',
    question: 'Quel est ce fromage ?',
    alt: 'Photographie d’un fromage à identifier',
    titles: t(
      `Camembert de Normandie; Brie de Meaux; Roquefort; Comté; Emmental; Gruyère; Mozzarella; Parmigiano Reggiano; Gorgonzola; Cheddar (fromage); Gouda (fromage); Edam; Feta; Munster; Reblochon; Cantal; Saint-nectaire; Époisses (fromage); Maroilles; Mimolette; Morbier; Beaufort; Ossau-iraty; Bleu d'Auvergne; Pont-l'évêque; Livarot (fromage); Chaource; Boursin; Manchego; Halloumi; Mascarpone; Ricotta; Pecorino; Stilton; Brillat-Savarin; Vacherin Mont-d'Or; Tomme de Savoie; Abondance; Crottin de Chavignol; Sainte-maure-de-touraine; Valençay (fromage); Selles-sur-Cher (fromage); Banon; Rocamadour (fromage); Neufchâtel; Langres (fromage); Coulommiers; Bleu de Gex; Fourme d'Ambert; Laguiole; Salers; Appenzeller; Raclette (fromage); Tête de moine; Provolone; Taleggio; Burrata; Grana Padano; Cabrales; Idiazábal; Havarti; Jarlsberg; Leerdammer; Limburger; Camembert`,
    ),
  },
  {
    group: 'Fruits et légumes',
    question: 'Quel est ce fruit ou ce légume ?',
    alt: 'Photographie d’un fruit ou d’un légume à identifier',
    titles: t(
      `Pomme; Poire; Banane; Fraise; Framboise; Cerise; Orange (fruit); Citron; Pamplemousse; Ananas; Mangue; Kiwi; Raisin; Pastèque; Melon; Abricot; Pêche (fruit); Prune; Figue; Grenade (fruit); Litchi; Pitaya; Papaye; Noix de coco; Datte; Myrtille; Mûre; Cassis; Groseille; Mandarine; Clémentine; Kaki; Nectarine; Goyave; Fruit de la passion; Carambole; Ramboutan; Mangoustan; Durian; Jacquier; Coing; Nèfle; Tomate; Carotte; Aubergine; Courgette; Poivron; Concombre; Brocoli; Chou-fleur; Artichaut; Asperge; Poireau; Oignon; Ail; Radis; Betterave rouge; Navet; Céleri-rave; Fenouil; Épinard; Laitue; Maïs; Pomme de terre; Patate douce; Potiron; Courge butternut; Chou rouge; Chou de Bruxelles; Endive; Haricot vert; Petit pois; Champignon de Paris; Gingembre; Piment; Avocat; Olive; Manioc; Igname; Taro; Topinambour; Rutabaga; Panais; Salsifis; Mâche; Roquette; Cresson; Rhubarbe; Châtaigne; Noix; Noisette; Amande; Pistache; Cacahuète`,
    ),
  },
];

export const MUSIC: SeedGroup[] = [
  {
    group: 'Instruments à cordes',
    question: 'Quel est cet instrument de musique ?',
    alt: 'Photographie d’un instrument de musique à identifier',
    titles: t(
      `Violon; Alto (instrument); Violoncelle; Contrebasse; Harpe; Guitare classique; Guitare électrique; Guitare basse; Banjo; Mandoline; Luth; Sitar; Oud; Ukulélé; Balalaïka; Cithare; Vielle à roue; Kora; Shamisen; Koto; Erhu; Pipa; Lyre; Psaltérion; Viole de gambe; Théorbe; Bouzouki; Santour; Dulcimer; Guzheng; Biwa; Sarod; Tanpura; Nyckelharpa; Charango; Cavaquinho; Cuatro; Tres; Guitare flamenca; Guitare à douze cordes; Guitare hawaïenne`,
    ),
  },
  {
    group: 'Vents, claviers et percussions',
    question: 'Quel est cet instrument de musique ?',
    alt: 'Photographie d’un instrument de musique à identifier',
    titles: t(
      `Piano; Clavecin; Orgue (instrument); Accordéon; Harmonica; Synthétiseur; Flûte traversière; Piccolo; Hautbois; Clarinette; Basson; Saxophone; Trompette; Trombone; Cor d'harmonie; Tuba; Cornemuse; Flûte de pan; Flûte à bec; Didgeridoo; Ocarina; Harmonium; Batterie (musique); Timbales; Xylophone; Marimba; Vibraphone; Glockenspiel; Triangle (instrument); Cymbale; Tambour; Tambourin; Castagnettes; Maracas; Djembé; Conga; Bongo (instrument); Gong; Carillon; Cor des Alpes; Tabla; Steelpan; Thérémine; Orgue de Barbarie; Célesta; Cajón; Guimbarde; Crécelle; Cor anglais; Clarinette basse; Contrebasson; Cornet à pistons; Sousaphone; Serpent (instrument); Cornemuse écossaise; Uilleann pipes; Shakuhachi; Duduk; Zurna; Ney; Bansuri; Sheng; Mellotron; Piano droit; Piano à queue; Orgue Hammond; Glass harmonica; Cloches tubulaires; Wood-block; Charleston (instrument)`,
    ),
  },
  {
    group: 'Compositeurs',
    question: 'Quel compositeur est représenté ?',
    alt: 'Portrait d’un compositeur à identifier',
    titles: t(
      `Wolfgang Amadeus Mozart; Ludwig van Beethoven; Jean-Sébastien Bach; Frédéric Chopin; Franz Liszt; Franz Schubert; Johannes Brahms; Richard Wagner; Giuseppe Verdi; Giacomo Puccini; Gioachino Rossini; Claude Debussy; Maurice Ravel; Erik Satie; Hector Berlioz; Georges Bizet; Camille Saint-Saëns; Gabriel Fauré; Antonio Vivaldi; Georg Friedrich Haendel; Joseph Haydn; Piotr Ilitch Tchaïkovski; Sergueï Rachmaninov; Igor Stravinsky; Dmitri Chostakovitch; Sergueï Prokofiev; Antonín Dvořák; Edvard Grieg; Jean Sibelius; Gustav Mahler; Jacques Offenbach; Charles Gounod; Jean-Baptiste Lully; Jean-Philippe Rameau; François Couperin; Claudio Monteverdi; Niccolò Paganini; Robert Schumann; Felix Mendelssohn; Béla Bartók; George Gershwin; Léo Delibes; Jules Massenet; César Franck; Olivier Messiaen; Pierre Boulez; Nikolaï Rimski-Korsakov; Modeste Moussorgski; Bedřich Smetana; Léoš Janáček; Anton Bruckner; Richard Strauss; Johann Strauss (fils); Domenico Scarlatti; Henry Purcell; Arcangelo Corelli; Carl Maria von Weber; Gaetano Donizetti; Vincenzo Bellini; Johann Pachelbel; Georg Philipp Telemann; Claude Debussy; Francis Poulenc; Darius Milhaud; Arthur Honegger; Edward Elgar; Ralph Vaughan Williams; Benjamin Britten; Aaron Copland; Leonard Bernstein; Philip Glass; Ennio Morricone; John Williams; Hans Zimmer`,
    ),
  },
];

export const SPORTS: SeedGroup[] = [
  {
    group: 'Sports collectifs et de raquette',
    question: 'Quel sport est illustré ?',
    alt: 'Photographie d’un sport à identifier',
    titles: t(
      `Football; Rugby à XV; Basket-ball; Volley-ball; Handball; Tennis; Badminton; Tennis de table; Squash; Golf; Hockey sur glace; Hockey sur gazon; Baseball; Cricket; Football américain; Water-polo; Polo; Pelote basque; Pétanque; Billard; Bowling; Fléchettes; Ultimate; Netball; Futsal; Football gaélique; Hurling; Kabaddi; Sepak takraw; Floorball; Bandy; Padel; Pickleball; Korfbal; Football australien`,
    ),
  },
  {
    group: 'Sports individuels, d’hiver et mécaniques',
    question: 'Quel sport est illustré ?',
    alt: 'Photographie d’un sport à identifier',
    titles: t(
      `Natation sportive; Plongeon; Aviron; Canoë-kayak; Surf; Planche à voile; Ski alpin; Ski de fond; Biathlon; Saut à ski; Snowboard; Patinage artistique; Patinage de vitesse; Curling; Luge; Bobsleigh; Escrime; Judo; Karaté; Taekwondo; Boxe anglaise; Lutte; Haltérophilie; Gymnastique artistique; Trampoline; Marathon; Saut à la perche; Saut en longueur; Lancer du javelot; Lancer du poids; Décathlon; Cyclisme sur route; Cyclisme sur piste; VTT; BMX; Triathlon; Pentathlon moderne; Tir à l'arc; Tir sportif; Alpinisme; Escalade; Parachutisme; Parapente; Plongée sous-marine; Course d'orientation; Sumo; Capoeira; Skateboard; Roller; Kitesurf; Rafting; Ski nautique; Formule 1; Rallye; Motocyclisme; Karting; Saut d'obstacles; Dressage; Course de haies; Saut en hauteur; Lancer du marteau; Lancer du disque; Triple saut; Marche athlétique; Ski acrobatique; Ski-alpinisme; Course de côte; Course de dragsters; NASCAR; Jiu-jitsu brésilien; Kendo; Aïkido; Kung-fu; Muay-thaï; Savate; Sambo; Lutte gréco-romaine; Gymnastique rythmique; Nage synchronisée; Pêche sportive; Spéléologie; Canyoning; Saut à l'élastique`,
    ),
  },
  {
    group: 'Sportifs',
    question: 'Quel sportif est représenté ?',
    alt: 'Photographie d’un sportif à identifier',
    titles: t(
      `Pelé; Zinédine Zidane; Lionel Messi; Cristiano Ronaldo; Michael Jordan; Usain Bolt; Roger Federer; Rafael Nadal; Muhammad Ali; Tiger Woods; Michael Phelps; Teddy Riner; Diego Maradona; Michel Platini; Eddy Merckx; Bernard Hinault; Jesse Owens; Carl Lewis; Serena Williams; Novak Djokovic; Lewis Hamilton; Michael Schumacher; Ayrton Senna; Alain Prost; Sébastien Loeb; Marie-José Pérec; Laure Manaudou; Kylian Mbappé; Neymar; Johan Cruijff; Franz Beckenbauer; Lev Iachine; Just Fontaine; Raymond Kopa; Thierry Henry; Karim Benzema; Antoine Griezmann; Paul Pogba; Didier Deschamps; Éric Cantona; Jean-Claude Killy; Martin Fourcade; Marie-Amélie Le Fur; Renaud Lavillenie; Tony Parker; Rudy Gobert; Victor Wembanyama; Yannick Noah; Amélie Mauresmo; Justine Henin; Björn Borg; Pete Sampras; Andre Agassi; Steffi Graf; Martina Navrátilová; Chris Evert; Jacques Anquetil; Miguel Indurain; Lance Armstrong; Jan Ullrich; Tadej Pogačar; Sébastien Chabal; Jonah Lomu; Dan Carter; Wayne Gretzky; Babe Ruth; LeBron James; Magic Johnson; Kareem Abdul-Jabbar; Larry Bird; Shaquille O'Neal; Kobe Bryant; Nadia Comăneci; Simone Biles; Mark Spitz; Ian Thorpe; Katie Ledecky; Emil Zátopek; Paavo Nurmi; Haile Gebrselassie; Eliud Kipchoge; Florence Griffith-Joyner; Carl Lewis; Valentino Rossi; Marc Márquez; Juan Manuel Fangio; Niki Lauda; Jim Clark; Fernando Alonso; Sebastian Vettel; Max Verstappen`,
    ),
  },
];

export const SCIENCE: SeedGroup[] = [
  {
    group: 'Scientifiques',
    ...PERSON('Quel scientifique est représenté ?'),
    titles: t(
      `Albert Einstein; Isaac Newton; Galilée (savant); Marie Curie; Pierre Curie; Louis Pasteur; Charles Darwin; Nikola Tesla; Thomas Edison; Alexander Graham Bell; Stephen Hawking; Niels Bohr; Max Planck; Werner Heisenberg; Erwin Schrödinger; Richard Feynman; Antoine Lavoisier; Dmitri Mendeleïev; Gregor Mendel; Alexander Fleming; Johannes Kepler; Nicolas Copernic; Blaise Pascal; René Descartes; Archimède; Euclide; Pythagore; Ada Lovelace; Alan Turing; James Clerk Maxwell; Michael Faraday; Alessandro Volta; André-Marie Ampère; Rosalind Franklin; Carl von Linné; Jean-Baptiste de Lamarck; Georges Cuvier; Sigmund Freud; Robert Koch; Edwin Hubble; Carl Sagan; Jane Goodall; Ernest Rutherford; Henri Becquerel; Joseph Fourier; Pierre-Simon de Laplace; Évariste Galois; Bernhard Riemann; Carl Friedrich Gauss; Leonhard Euler; Hippocrate; Avicenne; Alhazen; Tycho Brahe; Christian Huygens; Robert Hooke; Robert Boyle; John Dalton; Alfred Nobel; Wilhelm Röntgen; Heinrich Hertz; Guglielmo Marconi; Joseph Priestley; Humphry Davy; Lord Kelvin; Louis de Broglie; Paul Dirac; Enrico Fermi; Robert Oppenheimer; Edward Jenner; Joseph Lister; Ignace Semmelweis; Claude Bernard; Paul Broca; Jean-Martin Charcot; Jean-François Champollion; Alexander von Humboldt; Alfred Wegener; Jacques Cousteau; Aristote; Platon; Ératosthène; Ptolémée; Hipparque`,
    ),
  },
  {
    group: 'Éléments chimiques',
    question: 'Quel élément chimique est présenté ?',
    alt: 'Photographie d’un échantillon à identifier',
    titles: t(
      `Hydrogène; Hélium; Carbone; Azote; Oxygène; Sodium; Magnésium; Aluminium; Silicium; Soufre; Chlore; Calcium; Fer; Cuivre; Zinc; Argent; Or; Mercure (élément); Plomb; Étain; Uranium; Phosphore; Iode; Brome; Bore; Lithium; Titane; Nickel; Platine; Tungstène; Cobalt; Chrome; Manganèse; Arsenic; Bismuth; Gallium; Néon; Argon; Potassium; Césium; Rubidium; Baryum; Strontium; Zirconium; Molybdène; Palladium; Rhodium; Iridium; Osmium; Antimoine; Tellure; Sélénium; Germanium; Béryllium; Thorium; Plutonium; Radium; Krypton; Xénon; Vanadium; Cadmium; Tantale; Niobium; Scandium; Yttrium; Lanthane; Cérium; Néodyme; Erbium`,
    ),
  },
  {
    group: 'Minéraux et roches',
    question: 'Quel est ce minéral ou cette roche ?',
    alt: 'Photographie d’un minéral ou d’une roche à identifier',
    titles: t(
      `Quartz; Améthyste; Diamant; Émeraude; Rubis; Saphir; Opale; Turquoise (minéral); Malachite; Pyrite; Galène; Fluorine; Calcite; Gypse; Halite; Topaze; Grenat; Obsidienne; Lapis-lazuli; Jade; Ambre; Corindon; Azurite; Hématite; Magnétite; Cinabre; Soufre natif; Béryl; Tourmaline; Zircon; Olivine; Mica; Feldspath; Talc; Basalte; Granite; Marbre; Calcaire; Grès; Schiste; Gneiss; Ardoise; Silex; Craie; Pierre ponce; Charbon; Tuf; Cristal de roche; Œil-de-tigre; Agate; Jaspe; Onyx; Cornaline; Pierre de lune; Aigue-marine; Spinelle; Rhodonite; Sodalite; Labradorite; Aventurine; Rose des sables; Météorite; Fulgurite; Pétrole; Sel gemme; Bauxite; Kaolin; Argile; Sable; Dolomite; Barytine; Wulfénite; Stibine; Rhodochrosite; Smithsonite; Vanadinite`,
    ),
  },
];
