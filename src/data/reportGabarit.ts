/**
 * Gabarit complet de rapport de nettoyage CVAC — NADCA ACR 2021
 * Références : NADCA ACR 2021 · IRSST R-525 / RG-088 · NFPA 96 · ASHRAE 62.1
 *
 * Principes :
 *  - Aucun texte de remplissage visible (aucun "préciser", "à compléter", "___")
 *  - Toutes les variables {{...}} sont remplacées par les données réelles du projet
 *  - Les sections conditionnelles (anomalies, hottes) sont masquées si aucune donnée
 *  - Le contenu est rédigé en français technique professionnel, adapté à un audit qualité
 */

export interface GabaritSection {
  type:    'subtitle' | 'text' | 'equipment_list' | 'observations'
  title:   string
  content?: string   // HTML — sections text uniquement
}

// ─────────────────────────────────────────────────────────────────────────────
//  Gabarit OMHM — Rapport d'intervention récurrent – Multilogement
// ─────────────────────────────────────────────────────────────────────────────
export const REPORT_GABARIT_OMHM: GabaritSection[] = [

  // ── 1. Résumé des travaux ─────────────────────────────────────────────────
  {
    type:  'subtitle',
    title: '1. Résumé des travaux',
  },
  {
    type:    'text',
    title:   '',
    content: `<p>Dans le cadre du programme d'entretien des systèmes de ventilation de l'<strong>Office municipal d'habitation de Montréal (OMHM)</strong>, une intervention a été réalisée à l'immeuble <strong>{{nomImmeuble}}</strong> situé au <strong>{{adresse}}</strong> (dossier n° <strong>{{numProjet}}</strong>).</p>
<p>Les travaux ont été effectués du <strong>{{date}}</strong> au <strong>{{dateFin}}</strong> par une équipe de techniciens spécialisés, sous la supervision du technicien responsable <strong>{{technicien}}</strong>.</p>
<p>L'ensemble des systèmes identifiés au mandat ont été traités conformément aux exigences applicables.</p>
<p>Les plans, photographies et fiches détaillées sont fournis en annexe.</p>
<p><strong>Synthèse :</strong></p>
<ul>
  <li>Intervention complétée conformément au mandat</li>
  <li>{{nbSystemes}} système(s) CVAC traité(s)</li>
  <li>{{nbAppartements}} appartement(s) traité(s)</li>
  <li>Documentation disponible en annexe</li>
</ul>`,
  },

  // ── 2. Portée du mandat ───────────────────────────────────────────────────
  {
    type:  'subtitle',
    title: '2. Portée du mandat',
  },
  {
    type:    'text',
    title:   '2.1 Immeuble concerné',
    content: `<p><strong>{{nomImmeuble}}</strong><br/>
{{typeBatiment}} — <strong>{{adresse}}</strong></p>
<p>
<strong>Propriétaire / Client :</strong> {{client}}<br/>
<strong>Nombre d'étages :</strong> {{nbEtages}}<br/>
<strong>Nombre d'unités / logements :</strong> {{nbLogements}}<br/>
<strong>Année de construction :</strong> {{anneeConstruction}}
</p>`,
  },

  // ── 3. Systèmes traités ───────────────────────────────────────────────────
  {
    type:  'subtitle',
    title: '3. Systèmes traités',
  },
  {
    type:    'text',
    title:   '',
    content: `{{systemes_tableau}}`,
  },

  // ── 4. Travaux réalisés ───────────────────────────────────────────────────
  {
    type:  'subtitle',
    title: '4. Travaux réalisés',
  },
  {
    type:    'text',
    title:   '',
    content: `<p>Les travaux de nettoyage ont été réalisés par brossage mécanique sous aspiration HEPA sur l'ensemble des systèmes désignés au mandat. Les interventions effectuées comprennent :</p><ul><li><strong>Conduits de ventilation</strong> — nettoyage mécanique par contact des conduits principaux, secondaires et de distribution des aires communes ;</li><li><strong>Composantes des unités de traitement d'air</strong> — nettoyage des chambres, serpentins, bacs de condensat, ventilateurs et volets ;</li><li><strong>Hottes et conduits d'extraction de cuisine</strong> — dégraissage complet, nettoyage des filtres, nettoyage des conduits verticaux jusqu'au toit et vérification du ventilateur de toiture, vérification des volets coupe-feu ;</li><li><strong>Ventilateurs d'extraction de salle de bain</strong> — dépoussiérage des grilles, pales et conduits flexibles des logements visés, nettoyage des conduits verticaux collecteurs jusqu'au toit et du ventilateur de toiture ;</li><li><strong>Ventilateurs locaux</strong> — nettoyage des buanderies, locaux techniques et locaux à déchets.</li></ul><p>La documentation photographique avant et après travaux pour chaque section est disponible dans les fiches détaillées fournies en annexe du présent rapport.</p>`,
  },

  {
    type:    'text',
    title:   '4.1 Remplacements de hottes de cuisine',
    content: `{{changements_tableau}}`,
  },

  // ── 5. Observations et anomalies ─────────────────────────────────────────
  {
    type:  'subtitle',
    title: '5. Observations et anomalies',
  },
  {
    type:  'observations',
    title: '5.1 Constats et anomalies relevés',
  },
  {
    type:    'text',
    title:   '',
    content: `<p><em><strong>Note :</strong> La colonne « Réf. » permet d'identifier l'origine de chaque constat. Les références de la forme <strong>T-XX</strong> correspondent aux points de travail numérotés sur les plans joints en annexe. Les références numériques ou alphanumériques (ex. : <strong>101</strong>, <strong>3B</strong>) désignent le numéro d'appartement concerné, tel qu'inscrit au rapport d'intervention.</em></p>`,
  },
  {
    type:    'text',
    title:   '5.2 Locataires absents lors de l\'intervention',
    content: `{{absences_tableau}}`,
  },

  // ── 6. Recommandations ────────────────────────────────────────────────────
  {
    type:  'subtitle',
    title: '6. Recommandations',
  },
  {
    type:    'text',
    title:   '',
    content: `<p>Sur la base des observations réalisées lors du présent mandat, nous formulons les recommandations suivantes à l'attention de l'Office municipal d'habitation de Montréal :</p><ul><li><strong>Maintenir le cycle annuel de nettoyage</strong> — la fréquence actuelle est appropriée pour les systèmes d'extraction des buanderies et des salles de bain des logements ;</li><li><strong>Augmenter la fréquence pour les hottes communes</strong> — un nettoyage semestriel est recommandé selon le volume d'utilisation constaté ;</li><li><strong>Planifier le remplacement des composantes défaillantes</strong> — les ventilateurs et volets en fin de vie identifiés devraient être remplacés dans les 6 à 12 prochains mois ;</li><li><strong>Ajouter des trappes d'accès</strong> — l'installation de trappes supplémentaires sur les tronçons identifiés permettra un nettoyage complet lors des prochaines interventions ;</li><li><strong>Instaurer un registre d'entretien par bâtiment</strong> — consigner les dates d'intervention, les systèmes traités et les anomalies relevées pour chaque immeuble du parc.</li></ul>`,
  },

  // ── 7. Conclusion ─────────────────────────────────────────────────────────
  {
    type:  'subtitle',
    title: '7. Conclusion',
  },
  {
    type:    'text',
    title:   '',
    content: `<p>Les travaux de nettoyage réalisés à l'immeuble <strong>{{nomImmeuble}}</strong> (<strong>{{adresse}}</strong>) sont complétés. L'ensemble des systèmes désignés au mandat ont été traités conformément aux exigences de l'Office municipal d'habitation de Montréal.</p>
<p><strong>Bâtiment :</strong> {{typeBatiment}} · {{nbEtages}} étage(s) · {{nbLogements}} logement(s)</p>
<p><strong>Systèmes CVAC traités :</strong> {{nbSystemes}} système(s) — {{systemes}}.</p>
{{interventions_resume}}
<p>Les systèmes des aires communes, salles mécaniques et zones spécifiques ({{zonesSpecifiques}}) présentent un niveau de salubrité conforme aux critères acceptables à la suite des travaux. Les anomalies relevées lors de l'intervention ont été documentées pour suivi et planification des correctifs par l'OMHM.</p>
<p>Nous remercions l'OMHM de la confiance accordée à notre équipe et demeurons disponibles pour les interventions de la prochaine saison d'entretien ainsi que pour tout suivi requis sur les anomalies signalées.</p>`,
  },

]

// ─────────────────────────────────────────────────────────────────────────────

export const REPORT_GABARIT_NADCA: GabaritSection[] = [

  // ══════════════════════════════════════════════════════════════════════════
  //  RÉSUMÉ EXÉCUTIF  (pas de numéro — n'incrémente pas le compteur TOC)
  // ══════════════════════════════════════════════════════════════════════════
  {
    type:  'subtitle',
    title: 'Résumé exécutif',
  },
  {
    type:    'text',
    title:   '',   // titre vide → pas d'en-tête répété ni d'entrée TOC redondante
    content: `<p>Les présents travaux de nettoyage et d'assainissement des systèmes de ventilation mécanique ont été réalisés au bénéfice de <strong>{{client}}</strong>, au bâtiment situé au <strong>{{adresse}}</strong>. Le mandat a porté sur <strong>{{nbSystemes}}</strong> système(s) CVAC — <strong>{{systemes}}</strong> — du <strong>{{date}}</strong> au <strong>{{dateFin}}</strong>.</p>

<p>Les travaux ont été conduits par <strong>{{technicienFull}}</strong>, sous la supervision de <strong>{{verificateurFull}}</strong>, en conformité avec les exigences de la norme <strong>NADCA ACR 2021</strong> (<em>Assessment, Cleaning and Restoration of HVAC Systems</em>), les recommandations de l'<strong>ASHRAE 62.1</strong> et les critères de salubrité définis par l'<strong>IRSST</strong>.</p>

<p>L'ensemble des composantes accessibles des réseaux aérauliques ont été traitées par méthode mécanique agréée (brossage rotatif sous aspiration HEPA simultanée). À l'issue des travaux, les systèmes présentent un niveau de salubrité conforme aux critères NADCA et IRSST (niveaux 1–2). Les anomalies relevées, les recommandations formulées et les mesures de suivi proposées sont présentées dans les sections subséquentes du présent rapport.</p>`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  1. INTRODUCTION
  // ══════════════════════════════════════════════════════════════════════════
  {
    type:  'subtitle',
    title: '1. Introduction',
  },
  {
    type:    'text',
    title:   '1.1 Mandat de nettoyage',
    content: `<p>Le présent mandat a été confié à notre entreprise par <strong>{{client}}</strong>. Référence du dossier : <strong>{{refsFull}}</strong>. Les travaux ont été réalisés du <strong>{{date}}</strong> au <strong>{{dateFin}}</strong> au bâtiment situé au <strong>{{adresse}}</strong>.</p>

<p>Le rapport a été préparé par <strong>{{technicienFull}}</strong> et révisé par <strong>{{verificateurFull}}</strong>. Ce document constitue la documentation officielle des travaux accomplis et peut être utilisé à des fins réglementaires, d'assurance qualité ou de référence pour les prochains cycles d'inspection et de maintenance.</p>

<p>Le présent rapport a pour objet de :</p>
<ul>
  <li>documenter l'étendue réelle des travaux de nettoyage exécutés ;</li>
  <li>attester la conformité des méthodes employées aux normes NADCA ACR 2021 et ASHRAE 62.1 ;</li>
  <li>signaler les anomalies, déficiences ou conditions particulières observées pendant les travaux ;</li>
  <li>formuler des recommandations adaptées aux observations terrain pour le maintien des systèmes à l'état propre.</li>
</ul>`,
  },
  {
    type:    'text',
    title:   '1.2 Portée des travaux',
    content: `<p>Le mandat couvre le nettoyage des <strong>{{nbSystemes}}</strong> système(s) de ventilation mécanique suivant(s) desservant le bâtiment :</p>

{{systemes_liste}}

<p>Pour chacun de ces systèmes, les travaux comprennent :</p>
<ul>
  <li>le nettoyage mécanique par contact des conduits de soufflage et de reprise (conduits principaux et secondaires accessibles) ;</li>
  <li>le nettoyage complet des composantes internes des unités de traitement d'air : chambres de mélange, serpentins, bacs de condensat, parois internes, ventilateurs, volets et registres ;</li>
  <li>le nettoyage des systèmes d'extraction localisée (hottes de cuisine, ventilateurs de sanitaires et locaux techniques) lorsque inclus au mandat ;</li>
  <li>la documentation photographique avant et après nettoyage pour chaque section traitée ;</li>
  <li>l'inspection visuelle des composantes et le signalement de toute anomalie relevée lors des travaux ;</li>
  <li>la rédaction du présent rapport avec attestation de conformité NADCA.</li>
</ul>

<p>Sont expressément exclus du présent mandat : les systèmes non désignés ci-dessus, les sections de conduits dont l'accès est structurellement impossible sans travaux de démolition non prévus au contrat, et toute intervention relevant du remplacement ou de la réparation de composantes mécaniques défectueuses.</p>`,
  },
  {
    type:    'text',
    title:   '1.3 Description du bâtiment et des systèmes mécaniques',
    content: `<p>Le bâtiment situé au <strong>{{adresse}}</strong> est desservi par <strong>{{nbSystemes}}</strong> système(s) de ventilation mécanique alimentant les différentes zones occupées. Les réseaux aérauliques comprennent :</p>

<ul>
  <li>des unités de traitement d'air (UTA) centralisées assurant le conditionnement, la filtration et la distribution de l'air dans les zones desservies ;</li>
  <li>un réseau de distribution par conduits en tôle galvanisée (sections rectangulaires et circulaires) ;</li>
  <li>des terminaux de distribution — diffuseurs, grilles de soufflage, bouches de reprise — répartis dans les espaces occupés ;</li>
  <li>des systèmes d'extraction localisée desservant les cuisines, les sanitaires et les locaux techniques.</li>
</ul>

<p>Chaque système inclus dans le présent mandat est identifié par une désignation unique, cohérente avec les plans mécaniques de référence. Les caractéristiques physiques — zones desservies, configuration des réseaux, types de composantes, matériaux des conduits — sont documentées individuellement dans les fiches de nettoyage jointes au présent rapport.</p>`,
  },
  {
    type:    'text',
    title:   '1.4 Description des systèmes CVAC traités',
    content: `<p>Les systèmes de ventilation mécanique traités dans le cadre du présent mandat sont les suivants :</p>

{{systemes_liste}}

<p>Chaque système est documenté individuellement dans les fiches de nettoyage. Ces fiches présentent la configuration du réseau, les composantes traitées, les observations avant nettoyage, les méthodes employées, les résultats obtenus et les photographies avant et après intervention. Les plans annotés, joints en annexe, permettent de localiser précisément chaque système et les sections de conduits traitées dans le bâtiment.</p>`,
  },
  {
    type:  'equipment_list',
    title: '1.5 Inventaire des systèmes et composantes traitées',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  2. NORMES ET MÉTHODOLOGIE
  // ══════════════════════════════════════════════════════════════════════════
  {
    type:  'subtitle',
    title: '2. Normes et méthodologie',
  },
  {
    type:    'text',
    title:   '2.1 Normes de référence applicables',
    content: `<p>Les travaux de nettoyage ont été réalisés en conformité avec les normes, standards et guides techniques reconnus dans l'industrie du nettoyage des systèmes CVAC :</p>

<ul>
  <li><strong>NADCA ACR 2021</strong> — <em>Assessment, Cleaning and Restoration of HVAC Systems</em> : norme de référence principale définissant les critères de propreté acceptables pour les réseaux CVAC, les méthodes de nettoyage admises, les exigences de documentation et les conditions d'attestation de conformité ;</li>
  <li><strong>IRSST — Rapport R-525</strong> — <em>Critères de déclenchement du nettoyage des systèmes CVAC d'édifices non industriels</em> : classification des niveaux de salubrité (niveaux 1 à 4) utilisée pour caractériser l'état des surfaces internes avant et après nettoyage ;</li>
  <li><strong>IRSST — Guide RG-088</strong> — <em>Guide de prévention contre la prolifération microbienne dans les systèmes de ventilation</em> : recommandations pour la prévention des contaminations biologiques dans les réseaux aérauliques ;</li>
  <li><strong>ASHRAE 62.1</strong> — <em>Ventilation for Acceptable Indoor Air Quality</em> : critères de qualité de l'air intérieur applicables lors de la remise en service des systèmes nettoyés ;</li>
  <li><strong>NFPA 96</strong> — <em>Standard for Ventilation Control and Fire Protection of Commercial Cooking Operations</em> : applicable au nettoyage des hottes de cuisine et de leurs conduits d'extraction ;</li>
  <li><strong>NAIMA</strong> — <em>Cleaning Fibrous Glass Insulated Duct Systems – Recommended Practice</em> : pour les réseaux comportant des conduits à isolation interne en fibre de verre.</li>
</ul>

<p>Selon l'IRSST, le nettoyage est recommandé lorsque les composantes des systèmes CVAC présentent des accumulations correspondant aux <strong>niveaux de salubrité 3 ou 4</strong>. À l'issue des travaux, les surfaces internes doivent satisfaire aux critères des <strong>niveaux 1 ou 2</strong> : propres à l'œil nu, ou présentant un film de poussière uniforme n'excédant pas 1 mm d'épaisseur.</p>`,
  },
  {
    type:    'text',
    title:   '2.2 Méthode de nettoyage',
    content: `<p>Les travaux ont été réalisés selon la <strong>méthode mécanique par contact</strong>, conforme aux exigences de la norme NADCA ACR 2021. Cette méthode est reconnue comme la plus efficace pour les réseaux de ventilation commerciaux, institutionnels et résidentiels. Elle comprend les phases suivantes :</p>

<ol>
  <li><strong>Mise en dépression et confinement du réseau</strong> — Raccordement d'une unité de filtration à haute efficacité (HEPA, efficacité certifiée >= 99,97 % pour les particules de 0,3 µm) au réseau de conduits. La dépression créée confine les contaminants mobilisés et prévient leur dispersion dans les espaces occupés. Les grilles, diffuseurs et bouches de reprise sont obturés temporairement pour concentrer le flux d'aspiration vers les sections en cours de traitement ;</li>
  <li><strong>Nettoyage mécanique des conduits</strong> — Brossage rotatif motorisé des parois internes avec des brosses en nylon ou polypropylène adaptées aux dimensions des conduits (sections rondes de 4 po à 24 po et sections rectangulaires). L'aspiration simultanée capture les contaminants décollés sans remise en suspension dans l'environnement. Pour les sections à accès restreint, des fouets et tiges flexibles sont utilisés ;</li>
  <li><strong>Nettoyage des composantes des unités de traitement d'air</strong> — Nettoyage par aspiration, essuyage et brossage manuel des serpentins, bacs de condensat, parois internes, pales de ventilateurs, chambres de mélange et volets. Les bacs de condensat sont nettoyés, rincés et leurs drains vérifiés ;</li>
  <li><strong>Nettoyage des terminaux de distribution</strong> — Nettoyage des diffuseurs, grilles de soufflage et bouches de reprise par aspiration et essuyage ;</li>
  <li><strong>Inspection finale et documentation</strong> — Vérification visuelle de la propreté de chaque section nettoyée ; documentation photographique avant et après à chaque point d'accès ;</li>
  <li><strong>Remise en service</strong> — Remontage des panneaux d'accès, réinstallation des grilles et registres, remplacement des filtres si requis, vérification du bon fonctionnement des systèmes.</li>
</ol>`,
  },
  {
    type:    'text',
    title:   '2.3 Équipements utilisés',
    content: `<p>Les équipements spécialisés suivants ont été déployés sur le chantier pour la réalisation des travaux :</p>

<ul>
  <li><strong>Unité(s) de filtration HEPA portative(s)</strong> — Efficacité certifiée >= 99,97 % pour les particules de 0,3 µm ; débit d'aspiration adapté au volume du réseau traité ;</li>
  <li><strong>Système de brossage mécanique rotatif</strong> — Brosses en nylon et polypropylène de diamètres variés (de 4 po à 24 po), adaptées aux sections circulaires et rectangulaires ;</li>
  <li><strong>Fouets et tiges flexibles</strong> — Pour le nettoyage des conduits à accès restreint, des coudes serrés et des sections inaccessibles aux brosses motorisées ;</li>
  <li><strong>Aspirateurs industriels HEPA</strong> — Pour la collecte et la récupération des résidus dans les composantes des UTA et aux points d'accès ;</li>
  <li><strong>Équipement de nettoyage vapeur</strong> — Pour le dégraissage des hottes de cuisine et des composantes à encrassement gras ;</li>
  <li><strong>Produits nettoyants et désinfectants homologués</strong> — Conformes aux exigences réglementaires (Santé Canada) et adaptés à chaque type de surface ;</li>
  <li><strong>Équipements de protection individuelle (ÉPI)</strong> — Masques respiratoires N95/P100, combinaisons Tyvek, gants de protection, lunettes de sécurité.</li>
</ul>`,
  },
  {
    type:    'text',
    title:   '2.4 Mesures de protection, de sécurité et de confinement',
    content: `<p>L'ensemble des travaux a été réalisé dans le respect des règles de sécurité en vigueur et des exigences de protection des occupants :</p>

<ul>
  <li><strong>Aspiration HEPA continue</strong> — Aucune opération de nettoyage n'a été effectuée sans que l'unité de filtration ne soit en fonctionnement ; aucun contaminant n'a été remis en suspension dans l'air ambiant ;</li>
  <li><strong>Confinement des zones de travail</strong> — Installation de barrières physiques et de calfeutrement aux ouvertures des zones traitées ; signalisation appropriée aux accès ;</li>
  <li><strong>Protection des surfaces adjacentes</strong> — Bâchage des équipements, meubles et surfaces susceptibles d'être exposés à des résidus lors des travaux ;</li>
  <li><strong>Coordination avec l'occupant</strong> — Planification des travaux en concertation avec le gestionnaire du bâtiment afin de minimiser les impacts sur les activités des occupants ; travaux hors heures d'occupation lorsque requis ;</li>
  <li><strong>Gestion des résidus</strong> — Collecte, conditionnement et disposition des résidus de nettoyage conformément aux règlements municipaux applicables ;</li>
  <li><strong>Port obligatoire des ÉPI</strong> — Application stricte des règles de protection individuelle par tous les membres de l'équipe de nettoyage tout au long des travaux.</li>
</ul>`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  3. RÉSULTATS DU NETTOYAGE
  // ══════════════════════════════════════════════════════════════════════════
  {
    type:  'subtitle',
    title: '3. Résultats du nettoyage',
  },
  {
    type:    'text',
    title:   '3.1 Synthèse des travaux réalisés',
    content: `<p>L'ensemble des sections de conduits et des composantes désignées au mandat ont été traitées conformément aux exigences de la norme NADCA ACR 2021. Les travaux ont couvert les <strong>{{nbSystemes}}</strong> système(s) suivant(s) : <strong>{{systemes}}</strong>.</p>

<p>Les résultats détaillés par système et par composante sont documentés dans les fiches de nettoyage individuelles jointes au présent rapport. Chaque fiche présente :</p>
<ul>
  <li>la désignation du système et de la composante traitée ;</li>
  <li>le niveau de salubrité IRSST constaté avant nettoyage ;</li>
  <li>la méthode de nettoyage employée ;</li>
  <li>le niveau de salubrité atteint après nettoyage ;</li>
  <li>les observations particulières relevées lors de l'intervention ;</li>
  <li>les photographies avant et après nettoyage.</li>
</ul>

<p>L'inventaire des composantes traitées est présenté à la section 1.5. Les anomalies et déficiences constatées lors des travaux sont documentées à la section 3.5.</p>`,
  },
  {
    type:    'text',
    title:   '3.2 Nettoyage des réseaux de conduits',
    content: `<p>Les conduits de soufflage et de reprise des systèmes <strong>{{systemes}}</strong> ont été nettoyés par brossage mécanique rotatif sous aspiration HEPA continue. Les travaux ont été conduits à partir des ouvertures d'accès existantes, complétées par de nouvelles ouvertures pratiquées aux points stratégiques selon les besoins d'accessibilité du réseau.</p>

<p>La progression du nettoyage a suivi les réseaux depuis les unités de traitement d'air vers les terminaux de distribution, de sorte que les contaminants mobilisés soient aspirés dans le sens du flux d'air. Chaque section de conduit a fait l'objet d'un passage de brossage suivi d'une vérification visuelle avant fermeture du point d'accès.</p>

<p>L'état de propreté atteint après nettoyage pour chaque point d'accès est documenté par photographie dans les fiches individuelles. Pour l'ensemble des sections accessibles traitées, les résultats sont conformes aux critères NADCA et correspondent aux niveaux IRSST 1–2 (propres à l'œil nu).</p>`,
  },
  {
    type:    'text',
    title:   '3.3 Nettoyage des unités de traitement d\'air',
    content: `<p>Les composantes internes accessibles de chaque unité de traitement d'air (UTA) incluse dans le mandat ont été nettoyées selon le protocole suivant :</p>

<ul>
  <li><strong>Serpentins de chauffage et de refroidissement</strong> — Nettoyage des ailettes par aspiration et soufflage ; élimination des accumulations de poussière, fibres et particules ; résultat : ailettes dégagées et flux d'air non obstrué ;</li>
  <li><strong>Bacs de récupération des condensats</strong> — Nettoyage complet, rinçage et détartrage ; vérification et débouchage des drains ; résultat : bacs propres, drains fonctionnels ;</li>
  <li><strong>Chambres de mélange et parois internes</strong> — Nettoyage par aspiration et essuyage ; résultat : surfaces propres à l'œil nu, conformes aux niveaux IRSST 1–2 ;</li>
  <li><strong>Ventilateurs (roues et pales)</strong> — Dépoussiérage et nettoyage des pales, du carter et de la plaque de base ; résultat : surfaces propres, équilibre visuel rétabli ;</li>
  <li><strong>Volets et registres</strong> — Nettoyage des lames et des cadres ; vérification du fonctionnement mécanique et de la course complète des volets ;</li>
  <li><strong>Filtres</strong> — Inspection de l'état des filtres en place ; remplacement effectué ou recommandé selon l'état constaté et les prescriptions du fabricant.</li>
</ul>

<p>Les caractéristiques et l'état constaté de chaque UTA avant et après nettoyage sont documentés dans les fiches de nettoyage individuelles correspondantes.</p>`,
  },
  {
    type:    'text',
    title:   '3.4 Nettoyage des hottes et systèmes d\'extraction',
    content: `<p>Les hottes de cuisine et systèmes d'extraction inclus dans le mandat ont été nettoyés conformément aux exigences de la norme NFPA 96 et aux pratiques reconnues de l'industrie. Le protocole de nettoyage comprend, pour chaque installation :</p>

<ul>
  <li><strong>Hotte et carénage</strong> — Dégraissage complet des surfaces internes et des gouttières par application de produit dégraissant homologué, brossage et essuyage ;</li>
  <li><strong>Filtres à graisse</strong> — Retrait, nettoyage en machine (ou remplacement si les filtres sont en fin de vie utile), séchage et réinstallation ;</li>
  <li><strong>Conduits d'extraction</strong> — Nettoyage par brossage mécanique et aspiration sur toute la longueur accessible ; élimination complète des dépôts de graisse condensée ;</li>
  <li><strong>Volet coupe-feu</strong> — Nettoyage des lames et du mécanisme de déclenchement thermique ; vérification visuelle du fonctionnement et de la liberté de mouvement ;</li>
  <li><strong>Ventilateur d'extraction</strong> — Dégraissage et nettoyage des pales, du carter et de l'arbre ; vérification de l'état des paliers accessibles.</li>
</ul>

<p>L'état de propreté atteint après nettoyage est conforme aux critères de la norme NFPA 96 : surfaces internes exemptes d'accumulations de graisse susceptibles de constituer un risque d'incendie. La documentation photographique avant et après est consignée dans les fiches individuelles.</p>`,
  },
  {
    type:  'observations',
    title: '3.5 Anomalies et déficiences relevées lors des travaux',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  4. RECOMMANDATIONS
  // ══════════════════════════════════════════════════════════════════════════
  {
    type:  'subtitle',
    title: '4. Recommandations',
  },
  {
    type:    'text',
    title:   '4.1 Programme de maintenance préventive',
    content: `<p>Afin de maintenir les systèmes <strong>{{systemes}}</strong> dans un état de propreté conforme aux normes NADCA ACR 2021 et de limiter la réaccumulation de contaminants, nous recommandons au client <strong>{{client}}</strong> la mise en œuvre du programme de maintenance préventive suivant :</p>

<ul>
  <li><strong>Mensuel</strong>
    <ul>
      <li>Inspection visuelle et remplacement des filtres selon l'état constaté et la lecture de pression différentielle (remplacer lorsque la résistance dépasse la valeur limite spécifiée par le fabricant) ;</li>
      <li>Nettoyage des grilles de soufflage et des bouches de reprise dans les zones à forte production de poussière ou à forte circulation.</li>
    </ul>
  </li>
  <li><strong>Trimestriel</strong>
    <ul>
      <li>Nettoyage des hottes de cuisine (fréquence à ajuster selon le type et l'intensité d'utilisation — voir section 4.2) ;</li>
      <li>Inspection visuelle des bacs de condensat des UTA ; nettoyage si dépôts présents ;</li>
      <li>Vérification du bon fonctionnement des volets coupe-feu et des registres d'air ;</li>
      <li>Inspection et nettoyage des ventilateurs d'extraction des sanitaires.</li>
    </ul>
  </li>
  <li><strong>Annuel</strong>
    <ul>
      <li>Inspection visuelle complète des conduits principaux avec documentation photographique aux points d'accès ;</li>
      <li>Nettoyage complet des composantes internes des UTA (serpentins, bacs, parois, ventilateurs) ;</li>
      <li>Vérification des débits d'air et rééquilibrage si nécessaire ;</li>
      <li>Inspection et lubrification des paliers et des courroies de ventilateurs selon les prescriptions du fabricant.</li>
    </ul>
  </li>
  <li><strong>Tous les 3 à 5 ans</strong>
    <ul>
      <li>Nettoyage complet du réseau de conduits conformément à la norme NADCA ACR 2021, selon les résultats des inspections annuelles et le niveau de contamination observé dans les espaces desservis.</li>
    </ul>
  </li>
</ul>

<p>La tenue d'un registre de maintenance documenté est fortement recommandée. Cet historique permet de justifier les intervalles de nettoyage, de démontrer la conformité réglementaire et de planifier de façon proactive les prochaines interventions.</p>`,
  },
  {
    type:    'text',
    title:   '4.2 Fréquences de nettoyage recommandées',
    content: `<p>Sur la base des conditions observées lors des présents travaux et des prescriptions des normes applicables, nous recommandons les fréquences de nettoyage suivantes pour les systèmes du bâtiment situé au <strong>{{adresse}}</strong> :</p>

<table>
  <thead>
    <tr>
      <th>Composante</th>
      <th>Fréquence recommandée</th>
      <th>Base normative</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Conduits principaux et secondaires</td>
      <td>Tous les 3 à 5 ans</td>
      <td>NADCA ACR 2021 — selon inspection annuelle</td>
    </tr>
    <tr>
      <td>Composantes internes UTA (serpentins, bacs, parois, ventilateurs)</td>
      <td>Annuellement</td>
      <td>NADCA ACR 2021 · ASHRAE 62.1</td>
    </tr>
    <tr>
      <td>Filtres UTA</td>
      <td>Selon delta-P ou trimestriellement</td>
      <td>Recommandation fabricant</td>
    </tr>
    <tr>
      <td>Hottes de cuisine — usage intensif (restaurant, traiteur)</td>
      <td>Trimestriellement</td>
      <td>NFPA 96 — Art. 11.6.2</td>
    </tr>
    <tr>
      <td>Hottes de cuisine — usage modéré (cantine, cafétéria)</td>
      <td>Semestriellement</td>
      <td>NFPA 96 — Art. 11.6.2</td>
    </tr>
    <tr>
      <td>Hottes de cuisine — usage résidentiel (appartements)</td>
      <td>Annuellement</td>
      <td>NFPA 96 · bonne pratique</td>
    </tr>
    <tr>
      <td>Ventilateurs d'extraction (sanitaires, locaux techniques)</td>
      <td>Annuellement</td>
      <td>Bonne pratique CVAC</td>
    </tr>
    <tr>
      <td>Diffuseurs et grilles de soufflage</td>
      <td>Tous les 2 ans</td>
      <td>Bonne pratique CVAC</td>
    </tr>
  </tbody>
</table>

<p>Ces fréquences constituent des recommandations minimales basées sur les conditions observées lors des présents travaux. Elles devront être révisées, à la hausse ou à la baisse, en fonction des résultats des prochaines inspections annuelles et des conditions d'exploitation du bâtiment.</p>`,
  },
  {
    type:    'text',
    title:   '4.3 Suivi des anomalies et corrections requises',
    content: `<p>Les anomalies relevées lors des travaux de nettoyage (documentées à la section 3.5) nécessitent les actions de suivi suivantes, classées par niveau de priorité :</p>

<ul>
  <li><strong>Priorité immédiate (0–15 jours)</strong> — Anomalies présentant un risque pour la sécurité des occupants ou pour l'intégrité des équipements ; intervention corrective requise avant la remise en service normale du système ;</li>
  <li><strong>Court terme (15–30 jours)</strong> — Déficiences affectant l'efficacité du nettoyage ou susceptibles d'accélérer la réaccumulation de contaminants ; planification d'une intervention rapide ;</li>
  <li><strong>Moyen terme (1–3 mois)</strong> — Anomalies non critiques à corriger dans le cadre des activités régulières de maintenance ;</li>
  <li><strong>Long terme (3–12 mois)</strong> — Améliorations recommandées pouvant optimiser l'entretien futur des systèmes, notamment l'ajout d'ouvertures d'accès permanentes aux points stratégiques des réseaux.</li>
</ul>

<p>Notre équipe demeure disponible pour assister <strong>{{client}}</strong> dans le suivi de ces anomalies et pour coordonner les interventions correctives requises. Un rapport de suivi pourra être produit sur demande à l'issue des travaux correctifs.</p>`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  5. CONCLUSION ET ATTESTATION
  // ══════════════════════════════════════════════════════════════════════════
  {
    type:  'subtitle',
    title: '5. Conclusion',
  },
  {
    type:    'text',
    title:   '5.1 Attestation de conformité NADCA',
    content: `<p>Le soussigné atteste que les travaux de nettoyage des systèmes de ventilation mécanique réalisés pour le compte de <strong>{{client}}</strong> (<strong>{{refsFull}}</strong>) ont été exécutés conformément aux exigences de la norme <strong>NADCA ACR 2021</strong>, aux dispositions contractuelles et aux normes techniques en vigueur au moment de la réalisation des travaux.</p>

<p>Les systèmes traités — <strong>{{systemes}}</strong> — ont été nettoyés entre le <strong>{{date}}</strong> et le <strong>{{dateFin}}</strong>. À l'issue des travaux, les surfaces internes des conduits et composantes inspectées présentent un niveau de salubrité conforme aux critères NADCA et IRSST (niveaux 1–2) : propres à l'œil nu, avec un film de poussière n'excédant pas 1 mm d'épaisseur sur les surfaces accessibles.</p>

<p>La présente attestation est conditionnelle aux éléments suivants :</p>
<ul>
  <li>elle porte exclusivement sur les systèmes, sections et composantes désignés dans la portée des travaux (section 1.2) ;</li>
  <li>elle s'appuie sur des observations visuelles effectuées lors des travaux et non sur des analyses de laboratoire ;</li>
  <li>elle décrit l'état des systèmes à la date d'intervention ; les conditions peuvent évoluer selon l'intensité d'utilisation et les pratiques d'entretien ultérieures.</li>
</ul>

<p>Rapport préparé par : <strong>{{technicienFull}}</strong><br/>
Révisé et approuvé par : <strong>{{verificateurFull}}</strong></p>`,
  },
  {
    type:    'text',
    title:   '5.2 Portée, limitations et exclusions',
    content: `<p>Les informations contenues dans le présent rapport sont fondées sur les observations visuelles réalisées lors des travaux de nettoyage. Les constatations et conclusions s'appliquent exclusivement aux systèmes, sections et composantes désignés dans la portée du mandat (section 1.2).</p>

<p>Les limitations suivantes s'appliquent au présent rapport :</p>
<ul>
  <li><strong>Sections hors portée</strong> — Les conduits et composantes non inclus dans le mandat n'ont pas été nettoyés et ne sont pas couverts par la présente attestation de conformité ;</li>
  <li><strong>Sections inaccessibles</strong> — Les sections de réseaux dont l'accès est physiquement impossible sans travaux de démolition non prévus au contrat n'ont pu être traitées ; elles sont identifiées dans les fiches individuelles correspondantes ;</li>
  <li><strong>Évaluation visuelle uniquement</strong> — Aucune analyse microbiologique, prélèvement d'air ou échantillonnage de surfaces n'a été réalisé dans le cadre du présent mandat ; le rapport ne constitue pas une évaluation de la présence de contaminants biologiques ou de matières dangereuses ;</li>
  <li><strong>Inspection mécanique</strong> — L'inspection visuelle des composantes lors des travaux de nettoyage ne remplace pas une inspection technique spécialisée des équipements mécaniques par un ingénieur ou un technicien accrédité ;</li>
  <li><strong>Évolution des conditions</strong> — Le rapport documente l'état des systèmes à la date d'intervention ; les conditions peuvent évoluer selon l'intensité d'utilisation, la qualité de l'entretien courant et les conditions environnementales du bâtiment.</li>
</ul>

<p>Notre équipe demeure à la disposition de <strong>{{client}}</strong> pour toute question relative au présent rapport ou pour la planification des prochaines interventions de nettoyage, d'inspection et de maintenance des systèmes CVAC.</p>`,
  },
]
