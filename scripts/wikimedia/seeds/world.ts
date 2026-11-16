import { t, type SeedGroup } from './types';

const FLAG = {
  question: 'Quel pays ce drapeau représente-t-il ?',
  alt: 'Drapeau d’un pays à identifier',
  label: 'flag' as const,
};
const MONUMENT = {
  question: 'Quel est ce monument ou ce bâtiment ?',
  alt: 'Photographie d’un monument ou d’un bâtiment à identifier',
};

export const FLAGS: SeedGroup[] = [
  {
    group: 'Drapeaux d’Europe',
    ...FLAG,
    titles: t(
      `Drapeau de la France; Drapeau de l'Allemagne; Drapeau de l'Italie; Drapeau de l'Espagne; Drapeau du Portugal; Drapeau du Royaume-Uni; Drapeau de l'Irlande; Drapeau de la Belgique; Drapeau des Pays-Bas; Drapeau du Luxembourg; Drapeau de la Suisse; Drapeau de l'Autriche; Drapeau du Danemark; Drapeau de la Suède; Drapeau de la Norvège; Drapeau de la Finlande; Drapeau de l'Islande; Drapeau de la Pologne; Drapeau de la Tchéquie; Drapeau de la Slovaquie; Drapeau de la Hongrie; Drapeau de la Roumanie; Drapeau de la Bulgarie; Drapeau de la Grèce; Drapeau de la Croatie; Drapeau de la Slovénie; Drapeau de la Serbie; Drapeau de la Bosnie-Herzégovine; Drapeau du Monténégro; Drapeau de la Macédoine du Nord; Drapeau de l'Albanie; Drapeau de l'Ukraine; Drapeau de la Biélorussie; Drapeau de la Russie; Drapeau de la Lituanie; Drapeau de la Lettonie; Drapeau de l'Estonie; Drapeau de la Moldavie; Drapeau de Malte; Drapeau de Chypre; Drapeau du Liechtenstein; Drapeau de Monaco; Drapeau d'Andorre; Drapeau de Saint-Marin; Drapeau du Vatican`,
    ),
  },
  {
    group: 'Drapeaux d’Asie',
    ...FLAG,
    titles: t(
      `Drapeau du Japon; Drapeau de la Chine; Drapeau de la Corée du Sud; Drapeau de la Corée du Nord; Drapeau de l'Inde; Drapeau du Pakistan; Drapeau du Bangladesh; Drapeau du Sri Lanka; Drapeau du Népal; Drapeau du Bhoutan; Drapeau de la Thaïlande; Drapeau du Viêt Nam; Drapeau du Cambodge; Drapeau du Laos; Drapeau de la Birmanie; Drapeau de la Malaisie; Drapeau de Singapour; Drapeau de l'Indonésie; Drapeau des Philippines; Drapeau de Brunei; Drapeau de la Mongolie; Drapeau du Kazakhstan; Drapeau de l'Ouzbékistan; Drapeau du Turkménistan; Drapeau du Kirghizistan; Drapeau du Tadjikistan; Drapeau de l'Afghanistan; Drapeau de l'Iran; Drapeau de l'Irak; Drapeau de la Syrie; Drapeau du Liban; Drapeau d'Israël; Drapeau de la Jordanie; Drapeau de l'Arabie saoudite; Drapeau du Yémen; Drapeau d'Oman; Drapeau des Émirats arabes unis; Drapeau du Qatar; Drapeau de Bahreïn; Drapeau du Koweït; Drapeau de la Turquie; Drapeau de la Géorgie; Drapeau de l'Arménie; Drapeau de l'Azerbaïdjan; Drapeau des Maldives; Drapeau de Taïwan`,
    ),
  },
  {
    group: 'Drapeaux d’Afrique',
    ...FLAG,
    titles: t(
      `Drapeau de l'Égypte; Drapeau du Maroc; Drapeau de l'Algérie; Drapeau de la Tunisie; Drapeau de la Libye; Drapeau du Soudan; Drapeau du Soudan du Sud; Drapeau de l'Éthiopie; Drapeau de l'Érythrée; Drapeau de Djibouti; Drapeau de la Somalie; Drapeau du Kenya; Drapeau de l'Ouganda; Drapeau de la Tanzanie; Drapeau du Rwanda; Drapeau du Burundi; Drapeau de la république démocratique du Congo; Drapeau de la république du Congo; Drapeau du Gabon; Drapeau du Cameroun; Drapeau du Nigeria; Drapeau du Ghana; Drapeau de la Côte d'Ivoire; Drapeau du Sénégal; Drapeau du Mali; Drapeau du Burkina Faso; Drapeau du Niger; Drapeau du Tchad; Drapeau de la Mauritanie; Drapeau de la Guinée; Drapeau du Bénin; Drapeau du Togo; Drapeau de la Sierra Leone; Drapeau du Liberia; Drapeau de l'Angola; Drapeau de la Zambie; Drapeau du Zimbabwe; Drapeau du Mozambique; Drapeau de Madagascar; Drapeau de Maurice; Drapeau de la Namibie; Drapeau du Botswana; Drapeau de l'Afrique du Sud; Drapeau du Lesotho; Drapeau de l'Eswatini; Drapeau du Malawi; Drapeau du Cap-Vert; Drapeau de la Gambie; Drapeau de la Guinée-Bissau; Drapeau de la Guinée équatoriale; Drapeau de Sao Tomé-et-Principe; Drapeau des Seychelles; Drapeau des Comores; Drapeau de la république centrafricaine`,
    ),
  },
  {
    group: 'Drapeaux d’Amérique et d’Océanie',
    ...FLAG,
    titles: t(
      `Drapeau des États-Unis; Drapeau du Canada; Drapeau du Mexique; Drapeau du Guatemala; Drapeau du Belize; Drapeau du Honduras; Drapeau du Salvador; Drapeau du Nicaragua; Drapeau du Costa Rica; Drapeau du Panama; Drapeau de Cuba; Drapeau d'Haïti; Drapeau de la République dominicaine; Drapeau de la Jamaïque; Drapeau des Bahamas; Drapeau de la Barbade; Drapeau de Trinité-et-Tobago; Drapeau du Venezuela; Drapeau de la Colombie; Drapeau de l'Équateur; Drapeau du Pérou; Drapeau de la Bolivie; Drapeau du Chili; Drapeau de l'Argentine; Drapeau de l'Uruguay; Drapeau du Paraguay; Drapeau du Brésil; Drapeau du Guyana; Drapeau du Suriname; Drapeau de la Dominique; Drapeau de Sainte-Lucie; Drapeau de la Grenade; Drapeau d'Antigua-et-Barbuda; Drapeau de l'Australie; Drapeau de la Nouvelle-Zélande; Drapeau des Fidji; Drapeau de la Papouasie-Nouvelle-Guinée; Drapeau des Samoa; Drapeau des Tonga; Drapeau du Vanuatu; Drapeau des Îles Salomon; Drapeau des Kiribati; Drapeau de Tuvalu; Drapeau de Nauru; Drapeau des Palaos; Drapeau des États fédérés de Micronésie; Drapeau des Îles Marshall`,
    ),
  },
];

export const ARCHITECTURE: SeedGroup[] = [
  {
    group: 'Monuments de France',
    ...MONUMENT,
    titles: t(
      `Tour Eiffel; Arc de triomphe de l'Étoile; Cathédrale Notre-Dame de Paris; Château de Versailles; Mont-Saint-Michel; Basilique du Sacré-Cœur de Montmartre; Panthéon de Paris; Hôtel des Invalides; Opéra Garnier; Grand Palais; Pont Alexandre-III; Pyramide du Louvre; Centre Pompidou; Grande Arche de la Défense; Tour Montparnasse; Palais des papes; Pont Saint-Bénézet; Pont du Gard; Arènes de Nîmes; Maison carrée; Cité de Carcassonne; Château de Chambord; Château de Chenonceau; Château d'Azay-le-Rideau; Château de Fontainebleau; Cathédrale Notre-Dame de Chartres; Cathédrale Notre-Dame de Reims; Cathédrale Notre-Dame de Strasbourg; Cathédrale d'Amiens; Abbaye de Fontenay; Viaduc de Millau; Palais Garnier; Château de Vaux-le-Vicomte; Château de Pierrefonds; Basilique Notre-Dame de Fourvière; Palais idéal du facteur Cheval; Cité radieuse; Villa Savoye; Château de Chaumont-sur-Loire; Château de Chantilly; Château d'If; Abbaye de Cluny; Basilique Saint-Sernin de Toulouse; Cathédrale Sainte-Cécile d'Albi; Château de Foix; Château de Peyrepertuse; Palais de Chaillot; Colonne Vendôme; Place Stanislas; Pont de Normandie; Tour de Pise`,
    ),
  },
  {
    group: 'Monuments d’Europe',
    ...MONUMENT,
    titles: t(
      `Colisée; Panthéon de Rome; Basilique Saint-Pierre de Rome; Fontaine de Trevi; Tour de Pise; Cathédrale Santa Maria del Fiore; Palais des Doges; Pont du Rialto; Parthénon; Acropole d'Athènes; Sagrada Família; Alhambra; Palais royal de Madrid; Mezquita de Cordoue; Alcázar de Ségovie; Big Ben; Tower Bridge; Tour de Londres; Abbaye de Westminster; Cathédrale Saint-Paul de Londres; Palais de Buckingham; Stonehenge; Château de Windsor; Château de Neuschwanstein; Porte de Brandebourg; Cathédrale de Cologne; Reichstag; Cathédrale Saint-Basile-le-Bienheureux; Kremlin de Moscou; Palais d'Hiver; Cathédrale Saint-Isaac de Saint-Pétersbourg; Sainte-Sophie; Mosquée bleue; Palais de Topkapı; Tour de Belém; Atomium; Manneken-Pis; Château de Prague; Pont Charles; Palais de la Culture et de la Science; Parlement de Budapest; Château de Bran; Schloss Schönbrunn; Opéra d'État de Vienne; Cathédrale Saint-Étienne de Vienne; Château de Chillon; Château d'Edimbourg; Tour penchée de Pise; Moulin de Kinderdijk; Palais du Parlement de Bucarest; Cathédrale de Cantorbéry; Sagrada Familia; Château de Malbork`,
    ),
  },
  {
    group: 'Monuments d’Asie, d’Afrique et d’Océanie',
    ...MONUMENT,
    titles: t(
      `Taj Mahal; Grande Muraille de Chine; Cité interdite; Temple du Ciel; Palais du Potala; Angkor Vat; Borobudur; Prambanan; Wat Arun; Grand Palais de Bangkok; Pétra; Dôme du Rocher; Mur des Lamentations; Mosquée Al-Aqsa; Burj Khalifa; Burj Al Arab; Tours Petronas; Marina Bay Sands; Tokyo Skytree; Tour de Tokyo; Château de Himeji; Kinkaku-ji; Sensō-ji; Grand sanctuaire d'Itsukushima; Fushimi Inari-taisha; Temple d'or d'Amritsar; Fort Rouge; Qutb Minar; Gateway of India; Mosquée Sheikh Zayed; Pyramide de Khéops; Sphinx de Gizeh; Temple d'Abou Simbel; Temples de Karnak; Temple de Louxor; Grande Mosquée de Djenné; Mosquée Hassan-II; Grande Mosquée de Kairouan; Opéra de Sydney; Harbour Bridge; Tour Oriental Pearl; Shanghai World Financial Center; Tour de Canton; Taipei 101; Pont de Hong Kong-Zhuhai-Macao; Temple Shwedagon; Temple de Bagan; Temple d'Angkor Bayon; Mosquée du Chah à Ispahan; Persépolis; Hagia Sophia`,
    ),
  },
  {
    group: 'Monuments des Amériques',
    ...MONUMENT,
    titles: t(
      `Statue de la Liberté; Empire State Building; Chrysler Building; Golden Gate Bridge; Pont de Brooklyn; Capitole des États-Unis; Maison-Blanche; Mont Rushmore; Space Needle; Gateway Arch; Tour CN; Château Frontenac; Machu Picchu; Chichén Itzá; Teotihuacan; Christ Rédempteur; Cathédrale de Brasilia; Palais de l'Alvorada; Théâtre Amazonas; Capitole de Washington; Lincoln Memorial; Washington Monument; Willis Tower; One World Trade Center; Rockefeller Center; Flatiron Building; Cathédrale Saint-Patrick de New York; Hoover Dam; Brooklyn Bridge; Torre Latinoamericana; Palais des beaux-arts de Mexico; Temple de Kukulcán; Sacsayhuamán; Ollantaytambo; Basilique Notre-Dame de Montréal; Parlement du Canada; Hôtel de ville de Toronto; Casa Rosada; Teatro Colón; Palacio de Bellas Artes; Cathédrale métropolitaine de Mexico`,
    ),
  },
];
