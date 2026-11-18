import { t, type SeedGroup } from './types';

const ANIMAL = { question: 'Quel est cet animal ?', alt: 'Photographie d’un animal à identifier' };
const PLANT = {
  question: 'Quelle est cette plante ?',
  alt: 'Photographie d’une plante à identifier',
};
const BIRD = { question: 'Quel est cet oiseau ?', alt: 'Photographie d’un oiseau à identifier' };
const TREE = { question: 'Quel est cet arbre ?', alt: 'Photographie d’un arbre à identifier' };
const INSECT = {
  question: 'Quel est cet insecte ?',
  alt: 'Photographie d’un insecte à identifier',
};
const MUSHROOM = {
  question: 'Quel est ce champignon ?',
  alt: 'Photographie d’un champignon à identifier',
};

export const FAUNA: SeedGroup[] = [
  {
    group: 'Félins',
    ...ANIMAL,
    titles: t(
      `Lion; Tigre; Léopard; Jaguar; Guépard; Puma; Lynx boréal; Panthère des neiges; Caracal; Serval; Chat des sables; Ocelot; Chat de Pallas; Lynx pardelle; Tigre de Sibérie; Chat-pêcheur`,
    ),
  },
  {
    group: 'Canidés et mustélidés',
    ...ANIMAL,
    titles: t(
      `Loup gris; Renard roux; Renard polaire; Fennec; Coyote; Chacal doré; Dhole; Loup à crinière; Chien de prairie; Loutre d'Europe; Loutre de mer; Blaireau européen; Putois d'Europe; Hermine; Belette d'Europe; Martre des pins; Glouton; Carcajou; Raton laveur; Coati roux; Panda roux; Mouffette rayée; Suricate; Mangouste rayée`,
    ),
  },
  {
    group: 'Ours, primates et grands mammifères',
    ...ANIMAL,
    titles: t(
      `Ours brun; Ours polaire; Panda géant; Ours à lunettes; Ours noir américain; Gorille des montagnes; Chimpanzé commun; Bonobo; Orang-outan de Bornéo; Babouin olive; Mandrill; Gibbon à mains blanches; Macaque rhésus; Maki catta; Ouistiti commun; Tamarin-lion doré; Singe-araignée; Nasique; Éléphant d'Afrique; Éléphant d'Asie; Girafe; Okapi; Zèbre de Burchell; Âne sauvage d'Afrique; Rhinocéros blanc; Rhinocéros indien; Hippopotame amphibie; Tapir terrestre; Phacochère commun; Babiroussa; Hyène tachetée; Oryctérope du Cap`,
    ),
  },
  {
    group: 'Ongulés',
    ...ANIMAL,
    titles: t(
      `Dromadaire; Chameau de Bactriane; Lama; Alpaga; Vigogne; Bison d'Amérique; Bison d'Europe; Buffle d'Afrique; Yack; Orignal; Renne; Cerf élaphe; Chevreuil européen; Daim européen; Wapiti; Sanglier; Gnou bleu; Impala; Oryx gazelle; Gazelle de Thomson; Springbok; Bouquetin des Alpes; Chamois; Mouflon; Bœuf musqué; Antilope saïga; Éland du Cap; Grand koudou; Nilgaut; Chèvre domestique; Mouton`,
    ),
  },
  {
    group: 'Petits mammifères',
    ...ANIMAL,
    titles: t(
      `Hérisson d'Europe; Écureuil roux; Marmotte alpine; Castor d'Europe; Ragondin; Capybara; Chinchilla; Cochon d'Inde; Hamster doré; Lièvre d'Europe; Lapin de garenne; Taupe d'Europe; Hamster d'Europe; Loir gris; Muscardin; Grand rhinolophe; Pipistrelle commune; Renard volant; Tamanoir; Paresseux à trois doigts; Tatou à neuf bandes; Pangolin; Daman du Cap; Fourmilier à quatre doigts`,
    ),
  },
  {
    group: 'Marsupiaux et monotrèmes',
    ...ANIMAL,
    titles: t(
      `Kangourou rouge; Koala; Wombat commun; Diable de Tasmanie; Ornithorynque; Échidné à nez court; Wallaby de Bennett; Phalanger volant; Opossum de Virginie; Dingo; Quokka; Sarigue`,
    ),
  },
  {
    group: 'Mammifères marins',
    ...ANIMAL,
    titles: t(
      `Orque; Baleine à bosse; Baleine bleue; Cachalot; Narval; Béluga; Grand dauphin; Dauphin commun; Marsouin commun; Lamantin des Caraïbes; Dugong; Phoque commun; Phoque gris; Morse; Otarie à fourrure; Lion de mer de Californie; Éléphant de mer; Phoque de Weddell; Léopard de mer; Rorqual commun`,
    ),
  },
  {
    group: 'Reptiles',
    ...ANIMAL,
    titles: t(
      `Crocodile du Nil; Alligator du Mississippi; Gavial du Gange; Crocodile marin; Caïman noir; Tortue luth; Tortue verte; Tortue imbriquée; Tortue de Floride; Tortue d'Hermann; Iguane vert; Iguane marin; Caméléon commun; Caméléon de Parson; Gecko tokay; Dragon de Komodo; Varan du Nil; Python réticulé; Python royal; Anaconda vert; Boa constricteur; Cobra royal; Cobra à lunettes; Mamba noir; Vipère aspic; Vipère péliade; Couleuvre à collier; Serpent à sonnette; Lézard des murailles; Lézard vert; Orvet fragile; Basilic vert; Agame barbu; Moloch épineux; Lézard à collerette; Heloderma`,
    ),
  },
  {
    group: 'Amphibiens',
    ...ANIMAL,
    titles: t(
      `Grenouille rousse; Grenouille verte; Ouaouaron; Rainette verte; Crapaud commun; Crapaud buffle; Salamandre tachetée; Triton crêté; Triton alpestre; Axolotl; Dendrobate bleu; Dendrobate à tapirer; Grenouille de Darwin; Rainette aux yeux rouges; Alyte accoucheur; Sonneur à ventre jaune; Protée anguillard; Cécilie`,
    ),
  },
  {
    group: 'Poissons et animaux marins',
    ...ANIMAL,
    titles: t(
      `Requin blanc; Requin-baleine; Requin-marteau halicorne; Requin tigre; Requin-taureau; Raie manta; Raie pastenague; Poisson-clown; Hippocampe; Thon rouge de l'Atlantique; Espadon; Marlin bleu de l'Atlantique; Poisson-lune; Saumon atlantique; Truite arc-en-ciel; Truite commune; Brochet; Carpe commune; Anguille européenne; Hareng atlantique; Morue de l'Atlantique; Piranha; Poisson-scorpion; Poisson-pierre; Murène; Barracuda; Poisson-ange; Poisson-perroquet; Poisson-chirurgien bleu; Poisson-lanterne; Esturgeon; Silure glane; Perche commune; Poulpe commun; Seiche commune; Calmar géant; Nautile; Pieuvre à anneaux bleus; Méduse; Étoile de mer; Oursin; Crabe royal du Kamchatka; Homard européen; Langouste rouge; Crevette; Escargot de Bourgogne; Corail; Anémone de mer`,
    ),
  },
];

export const FLORA: SeedGroup[] = [
  {
    group: 'Fleurs sauvages',
    ...PLANT,
    titles: t(
      `Coquelicot; Bleuet; Marguerite commune; Pissenlit; Edelweiss; Gentiane; Nénuphar blanc; Muguet; Primevère officinale; Violette odorante; Perce-neige; Jacinthe des bois; Digitale pourpre; Belladone; Aconit napel; Grande ciguë; Ortie dioïque; Trèfle blanc; Chardon-Marie; Lierre grimpant; Gui; Grande capucine; Bouton d'or; Mauve sylvestre; Myosotis; Anémone des bois; Ficaire; Ail des ours; Millepertuis perforé; Achillée millefeuille; Carotte sauvage; Bourrache officinale; Camomille romaine; Reine-des-prés; Lamier blanc; Cardère sauvage; Orchis pourpre; Sabot de Vénus; Ophrys abeille; Gesse odorante`,
    ),
  },
  {
    group: 'Fleurs de jardin',
    ...PLANT,
    titles: t(
      `Tournesol; Tulipe; Narcisse; Lis blanc; Iris des jardins; Crocus; Pivoine; Hortensia; Rhododendron; Camélia; Hibiscus; Bougainvillier; Jasmin officinal; Pélargonium; Pétunia; Lupin; Glycine de Chine; Clématite; Chèvrefeuille; Passiflore; Dahlia; Zinnia; Chrysanthème; Œillet; Pavot; Lotus sacré; Lavande vraie; Rose; Géranium; Soucis; Cosmos; Delphinium; Primevère; Pensée; Capucine; Œillet d'Inde; Gerbera; Orchidée; Amaryllis; Fuchsia`,
    ),
  },
  {
    group: 'Aromatiques, céréales et plantes utiles',
    ...PLANT,
    titles: t(
      `Sauge officinale; Romarin; Thym; Menthe poivrée; Basilic; Persil; Ciboulette; Aneth; Aloe vera; Agave; Bambou; Papyrus; Canne à sucre; Maïs; Riz; Blé tendre; Orge; Avoine; Seigle; Sorgho; Lin; Cotonnier; Chanvre; Tabac; Thé; Caféier arabica; Cacaoyer; Vanille; Poivrier noir; Gingembre; Curcuma; Safran; Fougère aigle; Prêle des champs; Mousse; Aloès; Sphaigne; Orpin; Joubarbe; Cactus; Nopal`,
    ),
  },
  {
    group: 'Fleurs et plantes — compléments',
    ...PLANT,
    titles: t(
      `Coquelicot; Pâquerette; Bouton d'or; Trèfle; Lavande; Tournesol; Tulipe; Jonquille; Crocus; Jacinthe; Muscari; Lis blanc; Pivoine; Dahlia; Zinnia; Pétunia; Pensée; Violette; Myosotis; Lupin; Digitale pourpre; Ancolie; Aconit; Hellébore; Anémone des bois; Clématite; Chèvrefeuille; Jasmin; Glycine; Hortensia; Lilas; Forsythia; Camélia; Rhododendron; Azalée; Magnolia; Hibiscus; Bougainvillier; Laurier-rose; Edelweiss; Primevère; Sauge; Thym; Romarin; Menthe; Persil; Origan; Estragon; Aneth; Coriandre; Cerfeuil; Mélisse; Verveine; Camomille; Achillée millefeuille; Tanaisie; Ortie; Plantain; Mauve; Bourrache; Consoude; Chélidoine; Millepertuis; Valériane; Lierre grimpant; Houx; Fougère aigle; Prêle des champs; Lotus sacré; Nénuphar blanc; Roseau commun; Blé tendre; Riz; Avoine; Seigle; Sorgho; Canne à sucre; Tabac; Théier; Caféier; Cacaoyer; Vanillier; Poivrier noir; Cannelier de Ceylan; Muscadier; Giroflier; Cactus; Agave; Aloe vera; Yucca; Bégonia; Cyclamen; Pissenlit; Marguerite commune; Bruyère; Genêt à balais; Ajonc d'Europe; Ail des ours; Fraisier des bois; Ronce commune; Capucine; Souci officinal; Tussilage; Nigelle de Damas; Lunaire annuelle; Passiflore; Orchidée sauvage; Sabot de Vénus; Ophrys abeille; Gesse odorante; Pois de senteur; Lotier corniculé; Vipérine commune; Sceau de Salomon; Arum maculé; Joubarbe des toits; Sedum acre; Bambou; Pampa; Lavatère; Rudbeckie; Échinacée; Gaillarde; Lobélie; Œillet; Giroflée`,
    ),
  },
];

export const BIRDS: SeedGroup[] = [
  {
    group: 'Oiseaux de jardin et de forêt',
    ...BIRD,
    titles: t(
      `Rouge-gorge familier; Mésange bleue; Mésange charbonnière; Merle noir; Moineau domestique; Pinson des arbres; Chardonneret élégant; Verdier d'Europe; Rossignol philomèle; Hirondelle rustique; Martinet noir; Étourneau sansonnet; Pie bavarde; Geai des chênes; Corbeau freux; Corneille noire; Grand corbeau; Pigeon ramier; Tourterelle turque; Pic épeiche; Pic vert; Sittelle torchepot; Troglodyte mignon; Accenteur mouchet; Bergeronnette grise; Alouette des champs; Huppe fasciée; Rollier d'Europe; Guêpier d'Europe; Martin-pêcheur d'Europe; Coucou gris; Bouvreuil pivoine; Gros-bec casse-noyaux; Bruant jaune; Grive musicienne; Loriot d'Europe; Mésange à longue queue; Roitelet huppé; Fauvette à tête noire; Tarier pâtre`,
    ),
  },
  {
    group: 'Rapaces',
    ...BIRD,
    titles: t(
      `Aigle royal; Pygargue à tête blanche; Faucon pèlerin; Faucon crécerelle; Buse variable; Milan royal; Autour des palombes; Épervier d'Europe; Balbuzard pêcheur; Vautour fauve; Gypaète barbu; Condor des Andes; Chouette hulotte; Chouette effraie; Hibou grand-duc; Chouette harfang; Chevêche d'Athéna; Hibou moyen-duc; Secrétaire; Caracara huppé; Aigle impérial; Harpie féroce`,
    ),
  },
  {
    group: 'Oiseaux d’eau et marins',
    ...BIRD,
    titles: t(
      `Cygne tuberculé; Canard colvert; Oie cendrée; Bernache du Canada; Héron cendré; Aigrette garzette; Cigogne blanche; Grue cendrée; Flamant rose; Pélican blanc; Cormoran huppé; Fou de Bassan; Mouette rieuse; Goéland argenté; Sterne arctique; Macareux moine; Pingouin torda; Manchot empereur; Manchot royal; Manchot de Humboldt; Albatros hurleur; Fulmar boréal; Râle d'eau; Foulque macroule; Poule d'eau; Grèbe huppé; Plongeon arctique; Spatule blanche; Ibis sacré; Ibis rouge; Bécasseau variable; Huîtrier pie; Avocette élégante; Vanneau huppé; Bec-en-sabot; Frégate superbe`,
    ),
  },
  {
    group: 'Oiseaux exotiques',
    ...BIRD,
    titles: t(
      `Toucan toco; Ara rouge; Ara bleu; Perroquet gris du Gabon; Cacatoès à huppe jaune; Perruche ondulée; Inséparable; Colibri à gorge rubis; Quetzal resplendissant; Paon bleu; Faisan de Colchide; Autruche d'Afrique; Émeu d'Australie; Nandou d'Amérique; Casoar à casque; Kiwi austral; Kookaburra; Oiseau-lyre; Paradisier; Calao à casque rouge; Hoazin huppé; Cardinal rouge; Geai bleu; Mainate religieux; Tisserin gendarme; Vautour pape; Dindon sauvage; Perdrix rouge; Coq bankiva; Pintade de Numidie; Tétras lyre; Gelinotte des bois; Oie des neiges`,
    ),
  },
];

export const TREES: SeedGroup[] = [
  {
    group: 'Feuillus européens',
    ...TREE,
    titles: t(
      `Chêne pédonculé; Chêne sessile; Chêne vert; Chêne-liège; Hêtre commun; Charme commun; Bouleau verruqueux; Frêne élevé; Érable sycomore; Érable plane; Érable champêtre; Tilleul à grandes feuilles; Orme champêtre; Peuplier noir; Peuplier blanc; Saule blanc; Saule pleureur; Aulne glutineux; Noisetier; Châtaignier; Noyer commun; Marronnier d'Inde; Platane commun; Robinier faux-acacia; Sorbier des oiseleurs; Alisier blanc; Merisier; Cerisier; Pommier; Poirier commun; Prunier; Aubépine monogyne; Houx; If commun; Buis commun; Sureau noir; Cornouiller sanguin; Fusain d'Europe; Tremble; Févier d'Amérique`,
    ),
  },
  {
    group: 'Conifères',
    ...TREE,
    titles: t(
      `Pin sylvestre; Pin maritime; Pin parasol; Pin cembro; Pin noir d'Autriche; Pin d'Alep; Épicéa commun; Sapin blanc; Sapin de Nordmann; Douglas vert; Mélèze d'Europe; Cèdre du Liban; Cèdre de l'Atlas; Cyprès de Provence; Genévrier commun; Thuya géant; Séquoia géant; Séquoia à feuilles d'if; Cyprès chauve; Pin de Monterey; Pin de Bristlecone; Araucaria du Chili; Ginkgo biloba; Metasequoia`,
    ),
  },
  {
    group: 'Arbres exotiques et fruitiers',
    ...TREE,
    titles: t(
      `Baobab; Eucalyptus; Acacia; Palmier dattier; Cocotier; Bananier; Olivier; Figuier commun; Amandier; Oranger; Citronnier; Manguier; Avocatier; Hévéa; Banian; Arbre de Judée; Jacaranda; Flamboyant; Magnolia à grandes fleurs; Tulipier de Virginie; Liquidambar; Sakura; Cerisier du Japon; Érable du Japon; Bambou géant; Mimosa; Camphrier; Teck; Acajou; Ébène; Baobab de Grandidier; Dragonnier; Sophora du Japon; Arbre à pain; Mangrove; Grenadier`,
    ),
  },
  {
    group: 'Arbres — compléments',
    ...TREE,
    titles: t(
      `Chêne vert; Chêne pédonculé; Chêne-liège; Hêtre commun; Charme commun; Châtaignier; Noyer commun; Noisetier; Tilleul à grandes feuilles; Orme champêtre; Frêne élevé; Érable sycomore; Érable plane; Érable champêtre; Bouleau verruqueux; Saule pleureur; Peuplier noir; Peuplier blanc; Aulne glutineux; Platane commun; Marronnier d'Inde; Sorbier des oiseleurs; Alisier blanc; Aubépine monogyne; Merisier; Pommier; Poirier commun; Prunier; Pêcher; Abricotier; Figuier; Olivier; Amandier; Oranger; Citronnier; Cyprès de Provence; Pin sylvestre; Pin parasol; Pin maritime; Pin noir d'Autriche; Pin cembro; Épicéa commun; Sapin blanc; Mélèze d'Europe; If commun; Cèdre du Liban; Cèdre de l'Atlas; Douglas vert; Séquoia géant; Séquoia à feuilles d'if; Ginkgo biloba; Baobab; Eucalyptus; Acajou; Teck; Ébène; Palmier dattier; Cocotier; Bananier; Robinier faux-acacia; Févier d'Amérique; Tulipier de Virginie; Catalpa commun; Arbre de Judée; Mûrier blanc; Laurier-sauce; Buis commun; Sureau noir; Tamaris; Dragonnier; Araucaria du Chili; Jacaranda; Flamboyant; Hévéa; Kapokier; Arganier; Sapin de Nordmann; Pin de Monterey; Pin des Canaries; Palmier nain; Pistachier lentisque; Caroubier; Arbousier; Micocoulier de Provence; Sophora du Japon; Cèdre de l'Himalaya; Cyprès chauve; Liquidambar; Copalme d'Amérique; Chêne rouge d'Amérique; Hêtre pourpre; Tremble; Saule blanc; Saule marsault`,
    ),
  },
  {
    // Members of the French Wikipedia categories « Arbre en Europe », « Arbre de climat tempéré
    // océanique », « Arbre de climat méditerranéen » and « Arbre de climat continental humide »
    // that the bank lacked (checked on 18/11/2026: lead image, Wikidata taxon name P225), so Trees
    // stays above the SUBJECT threshold in every language (D-109).
    group: 'Arbres — catégories Wikipédia',
    ...TREE,
    titles: t(
      `Albizia julibrissin; Austrocedrus chilensis; Acer negundo; Araucaria bidwillii; Banksia integrifolia; Banksia brownii; Banksia grandis; Allocasuarina fraseriana; Corylus avellana; Cormier; Cryptomeria japonica; Cyprès de Nootka; Crataegus azarolus; Eucalyptus baxteri; Eucalyptus caliginosa; Eucalyptus acmenoides; Drimys winteri; Laburnum anagyroides; Laurier de Californie; Juniperus oxycedrus; Gevuina avellana; Hedlundia hybrida; Laureliopsis philippiana; Pin de Calabre; Orme d'Amérique; Phoenix theophrasti; Olearia lyallii; Pin rigide; Pin de Salzmann; Phillyrea angustifolia; Picea fennica; Quercus kelloggii; Santalum acuminatum; Quercus muehlenbergii; Quercus chrysolepis; Quercus tomentella; Quercus cerris; Quercus wislizeni; Quercus engelmannii`,
    ),
  },
];

export const INSECTS: SeedGroup[] = [
  {
    group: 'Papillons',
    ...INSECT,
    titles: t(
      `Monarque; Paon-du-jour; Vulcain; Belle-dame; Citron; Machaon; Flambé; Azuré commun; Morpho bleu; Petit Nacré; Tabac d'Espagne; Grand Mars changeant; Sphinx tête de mort; Bombyx du mûrier; Grand paon de nuit; Papillon Atlas; Apollon; Aurore; Silène; Thécla du bouleau; Vanesse des chardons; Piéride du chou; Moro-sphinx; Écaille chinée; Isabelle; Ulysse; Ornithoptère de la reine Alexandra; Hespérie de la houque; Myrtil; Tircis; Procris; Citron de Provence`,
    ),
  },
  {
    group: 'Coléoptères',
    ...INSECT,
    titles: t(
      `Coccinelle à sept points; Hanneton commun; Lucane cerf-volant; Scarabée rhinocéros; Scarabée Hercule; Carabe doré; Longicorne; Capricorne du chêne; Bupreste; Cétoine dorée; Scarabée sacré; Coléoptère Goliath; Doryphore; Lampyre; Charançon; Dytique; Staphylin; Scarabée tigre; Ver luisant; Méloé; Cantharide; Bousier`,
    ),
  },
  {
    group: 'Autres insectes',
    ...INSECT,
    titles: t(
      `Abeille européenne; Bourdon terrestre; Guêpe commune; Frelon européen; Fourmi rousse; Fourmi coupe-feuille; Termite; Mante religieuse; Phasme; Sauterelle verte; Grillon champêtre; Criquet pèlerin; Libellule déprimée; Aeschne bleue; Demoiselle; Éphémère; Perce-oreille; Punaise verte; Gerris; Notonecte; Puce; Pou; Moustique; Mouche domestique; Taon; Syrphe; Cousin; Hémérobe; Fourmilion; Cicadelle; Puceron; Cochenille; Blatte; Mouche tsé-tsé; Éphippigère; Courtilière; Xylocope violet; Mégachile`,
    ),
  },
  {
    group: 'Insectes — compléments',
    ...INSECT,
    titles: t(
      `Abeille domestique; Bourdon terrestre; Guêpe commune; Frelon européen; Frelon asiatique; Termite; Mante religieuse; Phasme; Criquet pèlerin; Grillon champêtre; Courtilière commune; Libellule déprimée; Agrion élégant; Perce-oreille; Punaise verte; Puceron; Coccinelle à sept points; Doryphore; Cétoine dorée; Lucane cerf-volant; Capricorne; Scarabée rhinocéros; Charançon; Carabe doré; Luciole; Taupin; Paon-du-jour; Citron (papillon); Monarque; Morpho bleu; Flambé; Piéride du chou; Tircis; Myrtil; Azuré commun; Cuivré commun; Sphinx du tilleul; Moro-sphinx; Bombyx du mûrier; Grand paon de nuit; Écaille chinée; Processionnaire du pin; Mouche domestique; Moustique; Taon; Syrphe ceinturé; Drosophile; Tipule; Puce; Pou de tête; Cafard; Blatte germanique; Fourmi noire; Abeille charpentière; Fourmilion; Chrysope; Éphémère commune; Demoiselle; Sauterelle; Criquet; Cigale grise; Notonecte; Gerris; Dytique bordé; Hydrophile; Géotrupe; Bousier; Coccinelle asiatique; Cantharide; Méloé; Pyrrhocore; Zygène; Gazé; Aurore (papillon); Machaon; Vulcain; Belle-dame; Grande tortue; Petite tortue; Grand mars changeant; Apollon; Argus bleu; Procris; Thècle; Satyre; Robert-le-diable; Sylvain azuré; Nacré de la ronce; Bombyx; Sphinx tête de mort; Attacus atlas; Papillon Monarque; Bourdon des champs; Xylocope; Mégachile; Osmie rousse; Andrène; Halicte; Polistes; Vespula germanica; Ichneumon; Cynips; Tenthrède; Mouche tsé-tsé; Anophèle; Cousin`,
    ),
  },
  {
    group: 'Insectes — suite',
    ...INSECT,
    titles: t(
      `Zygène de la filipendule; Piéride de la rave; Piéride du navet; Citron de Provence; Soufré; Demi-deuil; Mélitée du plantain; Damier de la succise; Grand nègre des bois; Amaryllis; Azuré du serpolet; Cuivré des marais; Hespérie de la mauve; Sphinx du liseron; Sphinx de l'euphorbe; Sphinx de la vigne; Écaille martre; Phalène du bouleau; Rosalie des Alpes; Lepture; Calosome sycophante; Cicindèle champêtre; Nécrophore; Coccinelle à deux points; Coccinelle à vingt-deux points; Altise; Chrysomèle; Criocère du lis; Ténébrion meunier; Dermeste; Scolyte; Hylobe; Typographe; Dectique verrucivore; Éphippigère des vignes; Conocéphale; Criquet migrateur; Œdipode turquoise; Caloptène italien; Truxale; Empuse; Cercope; Cicadelle verte; Punaise rouge; Graphosome rayé; Punaise arlequin; Réduve; Nèpe cendrée; Ranatre; Mouche verte; Mouche bleue; Éristale gluant; Stomoxe; Fourmi charpentière; Fourmi pharaon; Fourmi coupeuse de feuilles; Bourdon des pierres; Mutille; Eumène; Anax empereur; Cordulie bronzée; Gomphe; Caloptéryx éclatant; Leste vert; Agrion jouvencelle; Libellule à quatre taches; Sympétrum rouge sang; Orthétrum réticulé; Phrygane; Lépisme argenté; Thrips; Puce du chat; Pou du corps; Pou du pubis; Punaise de lit; Poisson d'argent; Hanneton foulon; Hanneton de la Saint-Jean; Acherontia atropos; Cétoine dorée; Gazé; Piéride du chou; Vulcain (papillon); Machaon (papillon); Fourmi des bois; Fourmi rousse des bois; Grande sauterelle verte; Sauterelle verte; Éphémère; Perlidae; Fourmi légionnaire; Fourmi de feu; Lampyre; Ver luisant; Scarabée du fumier; Scarabée Goliath; Dynaste Hercule; Mante orchidée; Phasme bâton; Phyllie; Criquet marocain; Cigale périodique; Fulgore; Membracide; Pyrale du buis; Teigne des vêtements; Mite alimentaire; Charançon du riz; Capricorne des maisons; Vrillette; Termite de Saintonge; Fourmi d'Argentine`,
    ),
  },
];

export const MUSHROOMS: SeedGroup[] = [
  {
    group: 'Champignons comestibles',
    ...MUSHROOM,
    titles: t(
      `Cèpe de Bordeaux; Girolle; Morille commune; Trompette de la mort; Pied-de-mouton; Rosé des prés; Champignon de Paris; Coulemelle; Lactaire délicieux; Chanterelle en tube; Pleurote en huître; Truffe noire du Périgord; Russule charbonnière; Hydne imbriqué; Clavaire; Langue-de-bœuf; Polypore soufré; Bolet bai; Armillaire couleur de miel; Vesse-de-loup perlée; Shiitake; Enokitake; Marasme des oréades; Tricholome de la Saint-Georges; Laccaire améthyste; Bolet orangé; Cèpe d'été; Amanite des Césars; Bolet granulé; Collybie à pied velouté`,
    ),
  },
  {
    group: 'Champignons toxiques',
    ...MUSHROOM,
    titles: t(
      `Amanite tue-mouches; Amanite phalloïde; Amanite panthère; Amanite vireuse; Cortinaire remarquable; Galère marginée; Entolome livide; Clitocybe de l'olivier; Inocybe de Patouillard; Bolet de Satan; Tricholome tigré; Paxille enroulé; Agaric jaunissant; Lépiote brune; Hypholome en touffes; Psilocybe; Panthérine; Russule émétique; Gyromitre; Coprin noir d'encre; Fausse morille; Volvaire soyeuse; Amanite citrine; Scléroderme commun; Clathre rouge; Satyre puant; Langue de bœuf; Cèpe de Satan; Pholiote changeante`,
    ),
  },
  {
    group: 'Autres champignons',
    ...MUSHROOM,
    titles: t(
      `Coprin chevelu; Polypore versicolore; Amadouvier; Tremelle mésentérique; Pézize orangée; Étoile de terre; Cordyceps; Clathre grillagé; Langue de chat; Lycoperdon; Oreille de Judas; Coprin micacé; Xylaire du bois; Bolet amer; Champignon de couche; Bolet à pied rouge; Chanterelle jaune; Cèpe des pins; Nid d'oiseau; Mycène rose; Marasme; Pleurote; Craterelle`,
    ),
  },
  {
    group: 'Champignons — compléments',
    ...MUSHROOM,
    titles: t(
      `Cèpe de Bordeaux; Girolle; Trompette de la mort; Morille commune; Truffe noire du Périgord; Amanite tue-mouches; Amanite phalloïde; Amanite des Césars; Amanite panthère; Amanite vireuse; Coprin chevelu; Coprin noir d'encre; Lactaire délicieux; Russule charbonnière; Russule émétique; Pied-de-mouton; Bolet bai; Bolet jaune; Bolet à pied rouge; Bolet rude; Tricholome de la Saint-Georges; Rosé des prés; Agaric des jachères; Lépiote élevée; Armillaire couleur de miel; Pleurote en huître; Shiitake; Collybie à pied velouté; Polypore du bouleau; Tramète versicolore; Vesse-de-loup perlée; Géastre; Clathre rouge; Satyre puant; Hypholome en touffes; Pholiote écailleuse; Galère marginée; Cortinaire; Inocybe; Entolome livide; Clitocybe nébuleux; Marasme des Oréades; Sparassis crépu; Fistuline hépatique; Pézize orangée; Hygrophore; Tremelle foliacée; Oreille de Judas; Xylaire du bois; Ganoderme luisant; Chanterelle; Lactaire à toison; Lactaire; Russule; Bolet; Amanite; Agaric; Chanterelle en tube; Morille; Cèpe; Coprin; Pleurote; Lycoperdon; Calocère visqueuse; Pézize veinée; Pézize écarlate; Coprin pie; Psilocybe; Amanite rougissante; Amanite citrine; Amanite à volve; Agaric des bois; Agaric champêtre; Cèpe d'été; Bolet des bouviers; Bolet orangé; Bolet élégant; Bolet à chair jaune; Bolet de Satan; Hydne imbriqué; Hydne ombiliqué; Craterelle; Typhula; Auriculaire; Clavaire jaune; Ramaire; Amadouvier; Fomitopsis; Polypore soufré; Grifola frondosa; Lentin tigré; Pluteus cervinus; Volvaire; Paxille enroulé; Pholiote du peuplier; Cuphophyllus; Mycène; Mycène rose; Omphale; Hebeloma; Lyophyllum; Tricholome terreux; Tricholome équestre; Tricholome soufré`,
    ),
  },
  {
    // Members of the French Wikipedia categories « Champignon comestible », « Champignon toxique »
    // and « Champignon hallucinogène » that the bank lacked (checked on 18/11/2026: article with a
    // lead image, Wikidata taxon name P225), added so Mushrooms stays above the SUBJECT threshold
    // in every language (D-109).
    group: 'Champignons — catégories Wikipédia',
    ...MUSHROOM,
    titles: t(
      `Amanita arocheae; Amanita zambiana; Agaricus subrufescens; Amanita calyptroderma; Amanita ponderosa; Afroboletus luteolus; Albatrellus ovinus; Amanita submembranacea; Boletus subcaerulescens; Boletus pallidoroseus; Boletus violaceofuscus; Boletus vermiculosus; Boletus rex-veris; Boletus variipes; Boletus nobilis; Boletus quercophilus; Boletus nobilissimus; Boletus subalpinus; Boletus regineus; Calvatia craniiformis; Bovista plumbea; Hygrophorus russula; Gomphus clavatus; Gyroporus cyanescens; Hapalopilus rutilans; Hericium erinaceus; Hygrophore des prés; Hydnum rufescens; Entoloma clypeatum; Guepinia helvelloides; Morchella; Omphalotus olearius; Pholiote ridée; Morchella elata; Morchella semilibera; Omphalotus japonicus; Paralepistopsis acromelalga; Neoboletus xanthopus; Stropharia; Schizophyllum commune; Sarcodon; Stropharia rugosoannulata; Suillus sibiricus; Russula japonica; Russula mustelina; Russule dorée`,
    ),
  },
];
