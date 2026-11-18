import { t, type SeedGroup } from './types';

export const INVENTIONS: SeedGroup[] = [
  {
    group: 'Communication et image',
    question: 'Quelle est cette invention ?',
    alt: 'Photographie d’une invention à identifier',
    titles: t(
      `Machine à écrire; Téléphone; Phonographe; Gramophone; Radio; Télévision; Magnétoscope; Cassette audio; Walkman; Disque compact; Disquette; Disque dur; Ordinateur personnel; Souris (informatique); Clavier d'ordinateur; Smartphone; Télécopie; Télégraphe; Télégraphe optique; Appareil photographique; Caméra; Kinétoscope; Lanterne magique; Daguerréotype; Imprimerie; Presse typographique; Stylo à bille; Crayon; Plume (écriture); Papier; Parchemin; Antenne; Satellite artificiel; Sismographe; Minitel; Tourne-disque; Tablette tactile`,
    ),
  },
  {
    group: 'Transport',
    question: 'Quelle est cette invention ?',
    alt: 'Photographie d’une invention à identifier',
    titles: t(
      `Locomotive à vapeur; Automobile; Motocyclette; Bicyclette; Draisienne; Trottinette; Montgolfière; Dirigeable; Avion; Hélicoptère; Parachute; Deltaplane; Planeur; Sous-marin; Bathyscaphe; Bateau à vapeur; Paquebot; Voilier; Galère; Phare; Tramway; Métro; Funiculaire; Téléphérique; Ascenseur; Escalator; Chariot élévateur; Char; Roue; Traîneau; Skateboard; Patin à roulettes; Fusée; Navette spatiale américaine; Aéroglisseur; Monorail; Train à grande vitesse; Hydravion`,
    ),
  },
  {
    group: 'Maison et vie quotidienne',
    question: 'Quelle est cette invention ?',
    alt: 'Photographie d’une invention à identifier',
    titles: t(
      `Lampe à incandescence; Bougie; Lampe à huile; Lanterne; Allumette; Briquet; Réfrigérateur; Lave-linge; Aspirateur; Four à micro-ondes; Cocotte-minute; Machine à coudre; Fer à repasser; Métier à tisser; Rouet; Parapluie; Fermeture à glissière; Velcro; Épingle à nourrice; Lunettes; Loupe; Jumelles; Horloge; Sablier; Montre; Réveille-matin; Cadran solaire; Balance; Boulier; Calculatrice; Règle à calcul; Pascaline; Thermomètre; Baromètre; Stéthoscope; Seringue; Microscope; Boussole; Sextant; Astrolabe; Télescope; Compas; Équerre; Pile Volta; Dynamo; Éolienne; Panneau solaire; Moulin à vent; Moulin à eau; Machine à vapeur; Moteur à explosion; Moteur Diesel; Turbine; Poulie; Vis d'Archimède; Levier; Brouette; Charrue; Faux; Arbalète; Arc; Catapulte; Canon; Fusil; Épée; Bouclier; Casque; Armure; Imprimante 3D; Laser; Robot de cuisine`,
    ),
  },
];

const ARTWORK = {
  question: 'Quelle est cette œuvre d’art ?',
  alt: 'Reproduction d’une œuvre d’art à identifier',
};

export const ARTS: SeedGroup[] = [
  {
    group: 'Peintures célèbres',
    ...ARTWORK,
    titles: t(
      `La Joconde; La Nuit étoilée; Le Cri; La Ronde de nuit; La Jeune Fille à la perle; Les Ménines; Guernica (tableau); La Liberté guidant le peuple; Le Radeau de la Méduse; Impression, soleil levant; Le Déjeuner sur l'herbe; Olympia; Les Nymphéas; La Persistance de la mémoire; Le Baiser; La Naissance de Vénus; Le Printemps; La Cène; La Création d'Adam; L'École d'Athènes; La Dame à l'hermine; Les Tournesols; Le Sacre de Napoléon; La Grande Odalisque; Le Serment des Horaces; La Mort de Marat; Les Glaneuses; L'Angélus; Le Fils de l'homme; American Gothic; Nighthawks; Le Jardin des délices; La Tour de Babel; Les Époux Arnolfini; La Vénus d'Urbino; Les Noces de Cana; La Laitière; Le Cavalier polonais; Les Trois Grâces; Les Joueurs de cartes; Bal du moulin de la Galette; Le Déjeuner des canotiers; Un dimanche après-midi à l'île de la Grande Jatte; La Danse; Les Demoiselles d'Avignon; Composition VIII; Le Chat du Rabbin; La Joueuse de luth; Autoportrait au chapeau de paille; Le Joueur de fifre; Portrait de Madame Récamier; La Sainte Famille; Le Songe; Le Tricheur à l'as de carreau; Le Bain turc; La Chambre de Van Gogh à Arles; Le Moulin Rouge; La Mer de glace; Le Voyageur contemplant une mer de nuages; La Grande Vague de Kanagawa`,
    ),
  },
  {
    group: 'Sculptures et monuments sculptés',
    ...ARTWORK,
    titles: t(
      `Le Penseur; David; La Pietà; Vénus de Milo; Victoire de Samothrace; Le Baiser (Rodin); Le Moïse; Laocoon et ses fils; Le Discobole; Apollon du Belvédère; Les Bourgeois de Calais; La Porte de l'Enfer; Statue équestre de Marc Aurèle; L'Enlèvement de Proserpine; Persée avec la tête de Méduse; Bouddhas de Bâmiyân; Tête de Néfertiti; Masque de Toutânkhamon; Guerriers de terre cuite; Sphinx; Cheval de Troie; Moaï; Le David de Donatello; Pygmalion et Galatée; Éros et Psyché; L'Éternel Printemps; La Petite Sirène; Le Manneken-Pis; Le Lion de Lucerne; Le Cyclope; L'Homme qui marche; Oiseau dans l'espace; Les Trois Ombres; Le Grand Sphinx; Le Génie de la Bastille`,
    ),
  },
  {
    group: 'Écrivains',
    question: 'Quel écrivain est représenté ?',
    alt: 'Portrait d’un écrivain à identifier',
    titles: t(
      `Victor Hugo; Molière; Jean de La Fontaine; Voltaire; Jean-Jacques Rousseau; Alexandre Dumas; Gustave Flaubert; Honoré de Balzac; Émile Zola; Charles Baudelaire; Arthur Rimbaud; Paul Verlaine; Marcel Proust; Albert Camus; Jules Verne; Stendhal; Guy de Maupassant; Alfred de Musset; Pierre Corneille; Jean Racine; Rabelais; Michel de Montaigne; William Shakespeare; Miguel de Cervantes; Dante Alighieri; Johann Wolfgang von Goethe; Friedrich Schiller; Léon Tolstoï; Fiodor Dostoïevski; Anton Tchekhov; Alexandre Pouchkine; Charles Dickens; Jane Austen; Edgar Allan Poe; Mark Twain; Ernest Hemingway; Oscar Wilde; Franz Kafka; Homère; Virgile; Ovide; Jorge Luis Borges; Gabriel García Márquez; George Orwell; Agatha Christie; Lewis Carroll; Hans Christian Andersen; Victor Hugo; Jean-Paul Sartre; Simone de Beauvoir; Antoine de Saint-Exupéry; Molière`,
    ),
  },
  {
    group: 'Artistes',
    question: 'Quel artiste est représenté ?',
    alt: 'Portrait d’un artiste à identifier',
    titles: t(
      `Léonard de Vinci; Michel-Ange; Raphaël; Rembrandt; Vincent van Gogh; Claude Monet; Pablo Picasso; Salvador Dalí; Frida Kahlo; Auguste Rodin; Paul Cézanne; Édouard Manet; Edgar Degas; Henri Matisse; Johannes Vermeer; Francisco de Goya; Diego Vélasquez; Albrecht Dürer; Sandro Botticelli; Titien; Caravage; Gustav Klimt; Edvard Munch; Pierre-Auguste Renoir; Paul Gauguin; Camille Pissarro; Eugène Delacroix; Jean-Auguste-Dominique Ingres; Jacques-Louis David; Georges Seurat; Henri de Toulouse-Lautrec; Marc Chagall; Wassily Kandinsky; Piet Mondrian; Joan Miró; René Magritte; Andy Warhol; Jackson Pollock; Pierre Soulages; Camille Claudel; Donatello; Giotto; Jan van Eyck; Pierre Paul Rubens; Nicolas Poussin; Gustave Courbet; Jean-François Millet; Rosa Bonheur; Berthe Morisot; Georgia O'Keeffe; Katsushika Hokusai`,
    ),
  },
];

export const GEOGRAPHY: SeedGroup[] = [
  {
    group: 'Montagnes et volcans',
    question: 'Quelle est cette montagne ou ce volcan ?',
    alt: 'Photographie d’une montagne ou d’un volcan à identifier',
    titles: t(
      `Everest; K2; Mont Blanc; Cervin; Mont Fuji; Kilimandjaro; Aconcagua; Denali; Elbrouz; Mont Ararat; Mont Olympe; Etna; Vésuve; Eiger; Jungfrau; Mont Kenya; Mont Cook; Uluru; Montagne de la Table; Mont Saint-Elias; Mont Rainier; Mont Hood; Mont Saint Helens; Popocatépetl; Cotopaxi; Chimborazo; Fitz Roy; Parc national Torres del Paine; Matterhorn; Piz Bernina; Barre des Écrins; Meije; Mont Ventoux; Puy de Dôme; Piton de la Fournaise; Mont Pelé; Krakatoa; Stromboli; Mont Vinson; Mont Kosciuszko; Annapurna; Lhotse; Makalu; Nanga Parbat; Kangchenjunga; Mont Logan; Mont Blanc de Courmayeur; Dent Blanche; Grandes Jorasses; Dent du Géant; Aiguille du Midi; Pic du Midi de Bigorre; Mont Perdu`,
    ),
  },
  {
    group: 'Eaux et reliefs naturels',
    question: 'Quel est ce site naturel ?',
    alt: 'Photographie d’un site naturel à identifier',
    titles: t(
      `Grand Canyon; Chutes du Niagara; Chutes Victoria; Chutes d'Iguazú; Angel Falls; Lac Baïkal; Lac Léman; Lac de Constance; Lac Majeur; Lac de Côme; Lac Titicaca; Lac Victoria; Lac Tanganyika; Lac Balaton; Lac Louise; Lac Moraine; Lac Annecy; Loch Ness; Mer Morte; Danube; Rhin; Seine; Loire; Rhône; Garonne; Tamise; Tibre; Amazone; Nil; Mississippi; Yangzi Jiang; Gange; Mékong; Congo; Zambèze; Colorado; Volga; Désert du Sahara; Désert de Gobi; Désert d'Atacama; Désert de Namib; Désert du Néguev; Vallée de la Mort; Monument Valley; Cappadoce; Baie d'Ha Long; Grande Barrière de corail; Geysir; Yellowstone; Chaussée des Géants; Falaises d'Étretat; Dune du Pilat; Cirque de Gavarnie; Gorges du Verdon; Calanques de Marseille; Mer de Glace; Glacier Perito Moreno; Fjord de Geiranger; Pamukkale; Salar d'Uyuni; Ayers Rock; Delta du Danube; Camargue; Île de Pâques; Îles Galápagos; Santorin; Capri; Ibiza; Corse; Sicile; Sardaigne; Majorque; Bora-Bora; Tahiti; Hawaï; Madère; Île de Ré; Mont-Saint-Michel; Îles Lofoten; Spitzberg; Islande; Groenland`,
    ),
  },
  {
    group: 'Villes',
    question: 'Quelle est cette ville ?',
    alt: 'Photographie d’une ville à identifier',
    titles: t(
      `Paris; Marseille; Lyon; Bordeaux; Toulouse; Nice; Strasbourg; Lille; Nantes; Rouen; Londres; Édimbourg; Dublin; Amsterdam; Bruges; Bruxelles; Berlin; Munich; Hambourg; Vienne; Prague; Budapest; Varsovie; Cracovie; Rome; Venise; Florence; Milan; Naples; Barcelone; Madrid; Séville; Lisbonne; Porto; Athènes; Istanbul; Moscou; Saint-Pétersbourg; Stockholm; Copenhague; Oslo; Helsinki; Reykjavik; Zurich; Genève; New York; San Francisco; Los Angeles; Chicago; Las Vegas; Washington; Boston; Miami; Montréal; Québec; Toronto; Vancouver; Mexico; Rio de Janeiro; Buenos Aires; Lima; Cuzco; La Havane; Tokyo; Kyoto; Osaka; Séoul; Pékin; Shanghai; Hong Kong; Singapour; Bangkok; Hanoï; Dubaï; Jérusalem; Le Caire; Marrakech; Casablanca; Tunis; Le Cap; Nairobi; Sydney; Melbourne; Mumbai; Delhi; Jaipur; Venise; Dubrovnik; Santorin; Cordoue; Grenade`,
    ),
  },
];

export const SPACE: SeedGroup[] = [
  {
    group: 'Système solaire',
    question: 'Quel est cet astre du système solaire ?',
    alt: 'Image d’un astre du système solaire à identifier',
    titles: t(
      `Soleil; Mercure (planète); Vénus (planète); Terre; Lune; Mars (planète); Jupiter (planète); Saturne (planète); Uranus (planète); Neptune (planète); Pluton (planète naine); Cérès (planète naine); Io (lune); Europe (lune); Ganymède (lune); Callisto (lune); Titan (lune); Encelade (lune); Mimas (lune); Rhéa (lune); Japet (lune); Dioné (lune); Triton (lune); Charon (lune); Phobos (lune); Déimos (lune); Miranda (lune); Titania (lune); Obéron (lune); Ariel (lune); Umbriel (lune); Protée (lune); Hypérion (lune); Éris (planète naine); Makémaké (planète naine); Vesta (astéroïde); Éros (astéroïde); Itokawa (astéroïde); Bennu (astéroïde); Ryugu (astéroïde); Arrokoth (objet transneptunien); Comète de Halley; Comète Hale-Bopp; Comète Churyumov-Gerasimenko; Comète Shoemaker-Levy 9; Tempel 1; Comète Hyakutake; Comète McNaught; Comète 17P/Holmes; Comète Wild 2; Comète NEOWISE`,
    ),
  },
  {
    group: 'Ciel profond',
    question: 'Quel est cet objet du ciel profond ?',
    alt: 'Image d’un objet du ciel profond à identifier',
    titles: t(
      `Nébuleuse d'Orion; Nébuleuse du Crabe; Nébuleuse de l'Hélice; Nébuleuse de la Tête de cheval; Nébuleuse de l'Aigle; Nébuleuse de la Lyre; Nébuleuse de l'Haltère; Nébuleuse de la Lagune; Nébuleuse Trifide; Nébuleuse de la Carène; Nébuleuse du Cœur; Nébuleuse de l'Âme; Nébuleuse de la Rosette; Nébuleuse de l'Anneau; Nébuleuse de la Tarentule; Nébuleuse du Papillon; Nébuleuse de la Bulle; Nébuleuse du Sac à charbon; Nébuleuse de l'Œil de chat; Nébuleuse du Voile; Galaxie d'Andromède; Voie lactée; Galaxie du Triangle; Galaxie du Tourbillon; Galaxie du Sombrero; Galaxie du Cigare; Galaxie des Antennes; Grand Nuage de Magellan; Petit Nuage de Magellan; Galaxie de la Roue de chariot; Galaxie du Moulinet; Galaxie de Barnard; Galaxie du Tourbillon; Pléiades; Amas globulaire d'Hercule; Omega Centauri; Amas de la Boîte à bijoux; Messier 87; Quasar 3C 273; Centaurus A; Galaxie Naine du Sagittaire; Amas du Boulet; Amas de la Vierge; Galaxie NGC 1300; Galaxie de l'Œil noir; Galaxie des Chiens de chasse; Galaxie spirale M74; Galaxie du Fuseau; Galaxie de Bode; Galaxie du Cigare`,
    ),
  },
  {
    group: 'Engins spatiaux',
    question: 'Quel est cet engin spatial ?',
    alt: 'Image d’un engin spatial à identifier',
    titles: t(
      `Station spatiale internationale; Télescope spatial Hubble; Télescope spatial James-Webb; Apollo 11; Apollo 13; Apollo 17; Voyager 1; Voyager 2; Spoutnik 1; Soyouz (véhicule spatial); Saturn V; Navette spatiale américaine; Challenger; Columbia; Discovery; Atlantis; Curiosity; Opportunity; Spirit; Perseverance; Ingenuity; Mir; Skylab; Rosetta; Philae; Cassini-Huygens; New Horizons; Galileo (sonde); Juno (sonde spatiale); Pioneer 10; Mariner 10; Magellan (sonde); Messenger (sonde spatiale); Dawn; Hayabusa; Ariane 5; Ariane 6; Falcon 9; Falcon Heavy; Starship; Space Launch System; Vostok 1; Lunokhod 1; Luna 9; Chandrayaan-3; Tchang'e 4; Sojourner; Viking 1; Mars Pathfinder; InSight; Parker Solar Probe; Solar Orbiter; Gaia; Herschel; Planck; Kepler; Compton Gamma Ray Observatory; Chandra; Spitzer`,
    ),
  },
  // Real titles of subjects whose earlier seed title was a disambiguation page or missing, and
  // named members of « Objet de Messier » (checked on 18/11/2026), so Space & Astronomy stays above
  // the SUBJECT threshold in every language (D-109).
  {
    group: 'Engins spatiaux — titres exacts',
    question: 'Quel est cet engin spatial ?',
    alt: 'Image d’un engin spatial à identifier',
    titles: t(
      `Atlantis (navette spatiale); Challenger (navette spatiale); Columbia (navette spatiale); Discovery (navette spatiale); Curiosity (astromobile); Dawn (sonde spatiale); Hayabusa (sonde spatiale); Herschel (télescope spatial); Kepler (télescope spatial); Mir (station spatiale); Rosetta (sonde spatiale); Spirit (rover); Spitzer (télescope spatial); Planck (télescope spatial); Chandra (télescope spatial); Magellan (sonde spatiale); Chang'e 4`,
    ),
  },
  {
    group: 'Ciel profond — objets de Messier et titres exacts',
    question: 'Quel est cet objet du ciel profond ?',
    alt: 'Image d’un objet du ciel profond à identifier',
    titles: t(
      `Pléiades (astronomie); NGC 6302; Galaxies des Antennes; Amas d'Hercule; M74 (galaxie); Amas du Canard sauvage; M44 (amas ouvert); M63 (galaxie); NGC 1300`,
    ),
  },
  {
    group: 'Comètes et astéroïdes',
    question: 'Quel est cet astre du système solaire ?',
    alt: 'Image d’un astre du système solaire à identifier',
    label: 'title',
    titles: t(
      `C/2006 P1 (McNaught); C/2020 F3 (NEOWISE); (433) Éros; (486958) Arrokoth; 17P/Holmes`,
    ),
  },
];
