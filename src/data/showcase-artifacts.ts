import type { ShowcaseArtifact } from "@/types/artifact";

export const SHOWCASE_ARTIFACTS: ShowcaseArtifact[] = [
  {
    id: "greek-amphora",
    catalogNumber: "EXHIBIT I",
    shortTitle: "Greek Amphora",
    authenticName:
      "Fragments of a Terracotta Black-Figure Amphora (Boxer Panel)",
    accessionNumber: "57.12.9a–d",
    dateRange: "c. 550–525 BCE",
    historicalPeriod: "Archaic Period (Attributed near Painter of Tarquinia RC 6847)",
    civilization: "Ancient Greek (Attic)",
    origin: "Athens, Greece",
    material: "Wheel-thrown terracotta, black-figure slip with incision",
    dimensions: "Surviving sherd .a H. 10.2 cm (4 in.); reconstructed H. ~41 cm",
    museum: "The Metropolitan Museum of Art",
    museumUrl: "https://www.metmuseum.org/art/collection/search/254947",
    license: "CC0 1.0 Public Domain (Met Open Access)",
    editorialSummary:
      "A type of two-handled Attic pottery vessel used for storing wine and olive oil. Surviving only as four black-figure sherds showing a bearded boxer with leather-bound fists, its full vessel profile and athletic contest are reconstructed from contemporaneous Athenian parallels.",
    purpose:
      "Two-handled Attic amphorae stored wine, olive oil, and banquet provisions for aristocratic symposia, funerary offerings, and Panathenaic athletic prizes. The surviving panel celebrates pugilism (pyx), showing a bearded athlete with leather thongs (himantes) wrapped around his knuckles.",
    presentCondition:
      "Survives as four unjoined body and base fragments (57.12.9a–d) with raw fracture edges and no modern plaster infill. Only the left-hand bearded boxer's head, cocked bound right fist, extended left arm, striding legs, and lower base-ray sherds remain; the neck, mouth, twin handles, opposing boxer, and foot are completely lost.",
    observedElements: [
      "Bearded boxer facing right with purplish-red hair fillet, cocked right fist in leather himantes, and extended left guard arm",
      "Wide striding black-figure legs with incised knee and calf markings on a double groundline",
      "Warm iron-rich Attic orange-red clay ground, flat lustrous black-gloss slip, and lower base-ray sherds",
      "Wall curvature and panel border consistent with a mid-6th-century BCE Attic amphora",
    ],
    reconstructedAdditions: [
      "Complete continuous Type B / neck-amphora body, flaring rim, twin handles, and foot",
      "Confronting opposing boxer on the right half of the athletic figure panel",
      "Archaic lotus-palmette band, shoulder tongue ornament, and lower base rays",
    ],
    reconstructionEvidence:
      "Curvature and black-figure panel framing match intact Athenian amphorae of ca. 530–520 BCE. While the opposing boxer is assured by the surviving figure's guard stance and a fragmentary edge at right, whether the vessel was a belly-amphora or neck-amphora remains an open typological choice.",
    comparableParallels: [
      {
        name: "Terracotta Neck-Amphora of Panathenaic Shape (Boxing Contest)",
        museum: "The Metropolitan Museum of Art",
        date: "ca. 520 BCE",
        accessionNumber: "06.1021.51",
        url: "https://www.metmuseum.org/art/collection/search/247223",
        relevance:
          "Complete Attic black-figure amphora attributed to the Antimenes Painter preserving full vessel geometry and a complete two-boxer match.",
      },
      {
        name: "Terracotta Panathenaic Prize Amphora",
        museum: "The Metropolitan Museum of Art",
        date: "ca. 530 BCE",
        accessionNumber: "14.130.12",
        url: "https://www.metmuseum.org/art/collection/search/248902",
        relevance:
          "Attributed to the Euphiletos Painter; documents contemporaneous Attic rim, handle, foot proportions, and athletic panel framing.",
      },
    ],
    originalImageUrl: "/showcase/greek-amphora/original.jpg",
    originalCutoutUrl: "/showcase/greek-amphora/original-cutout.webp",
    sketchImageUrl: "/showcase/greek-amphora/sketch.webp",
    fragmentedVisualUrl: "/showcase/greek-amphora/original.jpg",
    fragmentedIsAiEstimated: true,
    restoredModelUrl: "/showcase/greek-amphora/hyp-1.glb",
    themePalette: {
      swatch: "#c85d2b",
      bgDeep: "#0e0604",
      bgMid: "#1d0d08",
      bgGlow: "rgba(104, 44, 24, 0.54)",
      surfaceCard: "rgba(32, 15, 10, 0.72)",
      surfaceSolid: "#170b07",
      pedestalTint: "#b89588",
      rimLightColor: "#e08452",
    },
    hypotheses: [
      {
        id: "hyp-1",
        label: "Interpretation I",
        title: "Type B Belly-Amphora Completion",
        subtitle: "Continuous S-curve Attic body with confronting boxer",
        imageUrl: "/showcase/greek-amphora/hyp-1.webp",
        restoredModelUrl: "/showcase/greek-amphora/hyp-1.glb",
        methodologyNote:
          "Projects the surviving sherd curvature onto a classic Attic Type B belly-amphora silhouette, completing the opposing pugilist and traditional palmette borders.",
        observedFeaturesPreserved: [
          "Surviving bearded boxer's head, purplish-red fillet, cocked himantes fist, and striding legs",
          "Flat 2D Attic orange-terracotta clay hue, black-gloss slip, and incised linework",
        ],
        hypothesizedAdditions: [
          "Continuous belly-amphora neck, flaring echinus lip, and twin handles",
          "Opposing bearded boxer in symmetrical Archaic guard stance",
        ],
      },
      {
        id: "hyp-2",
        label: "Interpretation II",
        title: "Panathenaic-Shape Neck-Amphora",
        subtitle: "Offset lotus-palmette neck after Antimenes Painter parallels",
        imageUrl: "/showcase/greek-amphora/hyp-2.webp",
        restoredModelUrl: "/showcase/greek-amphora/hyp-2.glb",
        methodologyNote:
          "Reconstructs the sherds onto an offset-neck Panathenaic-type amphora inspired by Met 06.1021.51 (ca. 520 BCE), pairing a narrower foot with lotus-palmette neck ornament.",
        observedFeaturesPreserved: [
          "Exact boxer posture, cocked right fist, and black-figure wrist bindings",
          "Archaic reserved panel framing and lower base-ray sherd geometry",
        ],
        hypothesizedAdditions: [
          "Distinct offset neck with alternating lotus-palmette chain",
          "Tapering lower body and compact torus foot",
        ],
      },
      {
        id: "hyp-3",
        label: "Interpretation III",
        title: "Pugilistic Match with Paidotribes",
        subtitle: "Includes robed trainer holding forked rhabdos rod",
        imageUrl: "/showcase/greek-amphora/hyp-3.webp",
        restoredModelUrl: "/showcase/greek-amphora/hyp-3.glb",
        methodologyNote:
          "Follows wider Archaic contest compositions where a draped judge or trainer (paidotribes) flanks the two boxers with a forked officiating staff.",
        observedFeaturesPreserved: [
          "Left-hand bearded boxer, striding legs, and incised anatomical markings",
          "Flat black-gloss glaze density and terracotta slip contrast",
        ],
        hypothesizedAdditions: [
          "Sideline paidotribes figure in himation holding forked rod",
          "Full two-handled amphora rim, shoulder tongues, and base rays",
        ],
      },
    ],
    diagramType: "amphora",
    sources: [
      {
        label: "Fragments of a terracotta amphora (57.12.9a–d)",
        institution: "The Metropolitan Museum of Art",
        url: "https://www.metmuseum.org/art/collection/search/254947",
        license: "CC0 1.0 Open Access",
      },
      {
        label: "Comparable Parallel: Neck-amphora with boxers (06.1021.51)",
        institution: "The Metropolitan Museum of Art",
        url: "https://www.metmuseum.org/art/collection/search/247223",
        license: "CC0 1.0 Open Access",
      },
    ],
    viewerConfig: {
      defaultScale: 1.02,
      initialRotationY: -Math.PI / 2,
    },
  },
  {
    id: "marble-eirene",
    catalogNumber: "EXHIBIT II",
    shortTitle: "Marble Statue of Eirene",
    authenticName: "Marble Statue of Eirene (The Personification of Peace)",
    accessionNumber: "06.311",
    dateRange: "c. 14–68 CE (after c. 375 BCE original)",
    historicalPeriod: "Early Roman Imperial, Julio-Claudian (after Greek Classical original)",
    civilization: "Roman / Classical Greek",
    origin: "Found in Rome (copying Athenian Agora monument by Kephisodotos)",
    material: "Fine-grained white Pentelic marble",
    dimensions: "Surviving H. without plinth: 177.2 cm (69 3/4 in.)",
    museum: "The Metropolitan Museum of Art",
    museumUrl: "https://www.metmuseum.org/art/collection/search/247173",
    license: "CC0 1.0 Public Domain (Met Open Access)",
    editorialSummary:
      "A monumental Roman marble copy of Kephisodotos the Elder's celebrated Athenian statue of Peace cradling the infant Ploutos (Wealth). Though headless and missing both arms and child today, ancient replicas and Panathenaic coinage preserve its complete allegory.",
    purpose:
      "Erected in the Agora of Athens ca. 375–370 BCE to commemorate peace with Sparta and the state cult of Eirene. As recorded by Pausanias, showing Peace nurturing infant Wealth expressed the civic ideal that agricultural and civic prosperity depend upon peace.",
    presentCondition:
      "Preserves the monumental peplos-clad female body and mantle folds without modern restorations. The entire head and upper neck, the raised right arm below the shoulder, the left forearm, and the entire figure of the infant Ploutos once seated on her left arm are fractured off.",
    observedElements: [
      "Heavy archaizing Doric peplos with deep vertical columnar flutes and overfold",
      "Contrapposto weight shift onto the left leg with relaxed right knee projecting through drapery",
      "Shoulder break angle indicating a raised right arm and supporting left forearm",
    ],
    reconstructedAdditions: [
      "Gently inclined classical female head with centrally parted waves and fillet",
      "Infant Ploutos (Wealth) seated on left forearm reaching affectionately toward Eirene's chin",
      "Raised right arm grasping a tall royal scepter and cornucopia motif",
    ],
    reconstructionEvidence:
      "Unlike anonymous torsos, Eirene's lost elements are securely documented by the intact Munich Glyptothek replica (Gl. 219), dated Panathenaic prize amphorae of 360/359 BCE depicting the monument, and Athenian Imperial bronze coins.",
    comparableParallels: [
      {
        name: "Statue of Eirene with the Infant Ploutos ('Munich Eirene', Gl. 219)",
        museum: "Glyptothek, Staatliche Antikensammlungen Munich",
        date: "Roman copy after ca. 370 BCE original",
        accessionNumber: "Gl. 219",
        url: "https://www.antike-am-koenigsplatz.mwn.de/en/glyptothek-munich",
        relevance:
          "Preserves Eirene's inclined head and the seated figure of the child Ploutos matching the exact drapery folds of Met 06.311.",
      },
      {
        name: "Marble Statue of a Wounded Warrior",
        museum: "The Metropolitan Museum of Art",
        date: "ca. 138–181 CE",
        accessionNumber: "25.116",
        url: "https://www.metmuseum.org/art/collection/search/251929",
        relevance:
          "Illustrates Roman Imperial marble copying practices after 5th–4th century BCE Greek bronze civic monuments.",
      },
    ],
    originalImageUrl: "/showcase/marble-eirene/original.jpg",
    originalCutoutUrl: "/showcase/marble-eirene/original-cutout.webp",
    sketchImageUrl: "/showcase/marble-eirene/sketch.webp",
    fragmentedVisualUrl: "/showcase/marble-eirene/original.jpg",
    fragmentedIsAiEstimated: true,
    restoredModelUrl: "/showcase/marble-eirene/hyp-1.glb",
    themePalette: {
      swatch: "#d6cab0",
      bgDeep: "#0b0a08",
      bgMid: "#181510",
      bgGlow: "rgba(78, 69, 54, 0.54)",
      surfaceCard: "rgba(28, 24, 19, 0.72)",
      surfaceSolid: "#14120e",
      pedestalTint: "#b5ae9e",
      rimLightColor: "#dcd0b4",
    },
    hypotheses: [
      {
        id: "hyp-1",
        label: "Interpretation I",
        title: "Pentelic Marble Sculptural Completion",
        subtitle: "Unpainted ivory Pentelic marble after Munich Glyptothek Gl. 219",
        imageUrl: "/showcase/marble-eirene/hyp-1.webp",
        restoredModelUrl: "/showcase/marble-eirene/hyp-1.glb",
        methodologyNote:
          "Completes the Julio-Claudian marble torso in matching unpainted Pentelic marble using the Munich Eirene replica (Gl. 219) and 360/359 BCE Panathenaic amphora depictions, preserving blank carved marble eyes, shoulder locks, tall scepter in the raised right hand, and toddler Ploutos with cornucopia on the left forearm.",
        observedFeaturesPreserved: [
          "Exact Doric peplos catenary chest folds, ruffled overfold, and vertical columnar flutes",
          "Contrapposto stance, shoulder-pinned himation, and unpainted Pentelic marble patina",
        ],
        hypothesizedAdditions: [
          "Downward-inclined Classical head with fillet, shoulder tresses, and blank marble eyes",
          "Raised right arm holding tall scepter to plinth and Ploutos with cornucopia on left forearm",
        ],
      },
      {
        id: "hyp-2",
        label: "Interpretation II",
        title: "Athenian Agora Lost-Wax Bronze Original",
        subtitle: "Reconstructs Kephisodotos's ca. 375 BCE Classical hollow-cast bronze monument",
        imageUrl: "/showcase/marble-eirene/hyp-2.webp",
        restoredModelUrl: "/showcase/marble-eirene/hyp-2.glb",
        methodologyNote:
          "Translates the surviving Roman marble copy back into Kephisodotos the Elder's lost 4th-century BCE Athenian Agora hollow-cast bronze prototype, rendered in museum-patinated olive-brown Classical bronze with solid cast-bronze eyes, lotus-tipped scepter, and Ploutos cradling the horn of plenty.",
        observedFeaturesPreserved: [
          "Identical Kephisodotan drapery fold architecture, contrapposto weight shift, and maternal poise",
          "Documented Agora monument pose attested on 360/359 BCE Panathenaic prize amphorae",
        ],
        hypothesizedAdditions: [
          "Hollow-cast Classical Greek olive-brown bronze alloy patina and solid cast-bronze features",
          "Cast-bronze royal scepter, cornucopia with fruits and wheat, and infant Ploutos",
        ],
      },
      {
        id: "hyp-3",
        label: "Interpretation III",
        title: "Julio-Claudian Gilded Attributes & Circumlitio",
        subtitle: "Ganosis wax-polished marble with gilded-bronze scepter, diadem, cornucopia & hem meander",
        imageUrl: "/showcase/marble-eirene/hyp-3.webp",
        restoredModelUrl: "/showcase/marble-eirene/hyp-3.glb",
        methodologyNote:
          "Reflects Roman Imperial villa display practices where fine Pentelic marble copies received warm beeswax ganosis polish, separately fitted gilded-bronze attributes (diadem, scepter, and cornucopia), and restrained gilded Greek-key meander hem borders (circumlitio) while keeping the carved marble face and eyes unpainted.",
        observedFeaturesPreserved: [
          "Carved Pentelic marble drapery folds, projecting right knee, and blank sculpted marble eyes",
          "Original Roman imperial oval marble plinth proportions",
        ],
        hypothesizedAdditions: [
          "Separately attached antique gilded-bronze scepter, hair fillet, and overflowing cornucopia",
          "Restrained weathered gold meander hem border (circumlitio) along peplos overfold and mantle",
        ],
      },
    ],
    diagramType: "sculpture",
    sources: [
      {
        label: "Marble statue of Eirene (06.311)",
        institution: "The Metropolitan Museum of Art",
        url: "https://www.metmuseum.org/art/collection/search/247173",
        license: "CC0 1.0 Open Access",
      },
    ],
    viewerConfig: {
      defaultScale: 1.06,
      initialRotationY: -Math.PI / 2,
    },
  },
  {
    id: "egyptian-queen",
    catalogNumber: "EXHIBIT III",
    shortTitle: "Amarna Queen's Face",
    authenticName: "Fragment of a Queen's Face (Yellow Jasper)",
    accessionNumber: "26.7.1396",
    dateRange: "c. 1353–1336 BCE",
    historicalPeriod: "New Kingdom, Dynasty 18, Amarna Period (Reign of Akhenaten)",
    civilization: "Ancient Egyptian",
    origin: "Amarna (ancient Akhetaten), Middle Egypt",
    material: "Polished yellow jasper (originally part of a composite statue)",
    dimensions: "Surviving H. 13 cm (5 1/8 in.) × W. 12.5 cm × D. 12.5 cm",
    museum: "The Metropolitan Museum of Art",
    museumUrl: "https://www.metmuseum.org/art/collection/search/544514",
    license: "CC0 1.0 Public Domain (Met Open Access)",
    editorialSummary:
      "Carved from radiant yellow jasper—one of the hardest stones worked in antiquity—this celebrated Amarna fragment preserves only the sensuous lips, chin, and left cheek of a royal queen, violently shattered after Akhenaten's reign.",
    purpose:
      "Formed the luminous golden-skinned face of a composite temple cult statue assembled via mortise-and-tenon joinery with contrasting alabaster garments, faience or lapis-blue royal crown, and inlaid stone eyes.",
    presentCondition:
      "Sheared diagonally from below the left cheekbone across the bridge of the nose, destroying both eyes, brow, ears, and headdress. Only the mouth, philtrum, rounded chin, throat, and internal neck mortise socket survive.",
    observedElements: [
      "Mirror-polished honey-yellow jasper chin, philtrum, lower cheeks, and throat",
      "Sensuous full Amarna royal mouth with delicately undercut corners",
      "Internal rear mortise socket proving composite multi-stone statue construction",
    ],
    reconstructedAdditions: [
      "Upper nasal bridge, high cheekbones, and copper-rimmed quartz/obsidian inlaid eyes",
      "Composite royal headdress (debated among Nefertiti's blue crown, Tiye's khat, or Kiya's wig)",
      "Pleated Egyptian travertine-alabaster royal collar and shoulders",
    ],
    reconstructionEvidence:
      "Excavations at sculptor Thutmose's Amarna workshop confirm composite royal statues pairing hardstone faces with faience crowns and alabaster drapery. Because Egyptologists still debate whether the fragment portrays Nefertiti, Queen Tiye, or Kiya, three distinct crown hypotheses are presented.",
    comparableParallels: [
      {
        name: "Head of a Princess from a Group Statue (Amarna)",
        museum: "The Metropolitan Museum of Art",
        date: "ca. 1353–1336 BCE",
        accessionNumber: "2005.363",
        url: "https://www.metmuseum.org/art/collection/search/547692",
        relevance:
          "Amarna quartzite royal head demonstrating contemporaneous eye slant, brow curvature, and composite mortise joinery.",
      },
      {
        name: "Portrait Head of Queen Tiye from Medinet el-Gurob (ÄM 21834)",
        museum: "Ägyptisches Museum und Papyrussammlung, Berlin",
        date: "ca. 1355 BCE",
        accessionNumber: "ÄM 21834",
        url: "https://recherche.smb.museum/detail/608090",
        relevance:
          "Complete composite royal head with inlaid eyes and headdress closely paralleling the mouth geometry of Met 26.7.1396.",
      },
    ],
    originalImageUrl: "/showcase/egyptian-queen/original.jpg",
    originalCutoutUrl: "/showcase/egyptian-queen/original-cutout.webp",
    sketchImageUrl: "/showcase/egyptian-queen/sketch.webp",
    fragmentedVisualUrl: "/showcase/egyptian-queen/original.jpg",
    fragmentedIsAiEstimated: true,
    restoredModelUrl: "/showcase/egyptian-queen/hyp-1.glb",
    themePalette: {
      swatch: "#365f9c",
      bgDeep: "#050a12",
      bgMid: "#0c1729",
      bgGlow: "rgba(31, 61, 108, 0.56)",
      surfaceCard: "rgba(13, 25, 44, 0.72)",
      surfaceSolid: "#0a1322",
      pedestalTint: "#8ca4c4",
      rimLightColor: "#78a7e2",
    },
    hypotheses: [
      {
        id: "hyp-1",
        label: "Interpretation I",
        title: "Nefertiti Blue Crown Hypothesis",
        subtitle: "Composite jasper face with tall lapis-blue cap crown & gold uraeus",
        imageUrl: "/showcase/egyptian-queen/hyp-1.webp",
        restoredModelUrl: "/showcase/egyptian-queen/hyp-1.glb",
        methodologyNote:
          "Completes the yellow jasper face and ears with inlaid quartz/obsidian eyes and pairs it with Nefertiti's signature flat-topped blue faience crown, gold ribbon diadem, and alabaster collar.",
        observedFeaturesPreserved: [
          "Exact closed yellow jasper lips, chin contour, and honey-ochre stone polish",
          "Composite neck join transition and natural mineral flecks",
        ],
        hypothesizedAdditions: [
          "Copper-rimmed inlaid quartz/obsidian almond eyes and yellow jasper nose/ears",
          "Tall flat-topped Amarna blue faience crown with gold uraeus cobra",
        ],
      },
      {
        id: "hyp-2",
        label: "Interpretation II",
        title: "Queen Tiye Khat Headcloth Hypothesis",
        subtitle: "Enveloping blue-and-gold khat cloth inspired by Berlin ÄM 21834",
        imageUrl: "/showcase/egyptian-queen/hyp-2.webp",
        restoredModelUrl: "/showcase/egyptian-queen/hyp-2.glb",
        methodologyNote:
          "Reflects the widely supported attribution to Queen Mother Tiye, framing the completed yellow jasper face with a royal khat headcloth and broad beaded wesekh collar.",
        observedFeaturesPreserved: [
          "Full closed Amarna lips and rounded chin characteristic of Tiye portraits",
        ],
        hypothesizedAdditions: [
          "Striped lapis-and-gold khat headcloth and twin-cobra brow uraeus",
          "Polychrome stone and gold broad wesekh collar on alabaster bust",
        ],
      },
      {
        id: "hyp-3",
        label: "Interpretation III",
        title: "Royal Wife Kiya Nubian Wig Hypothesis",
        subtitle: "Ebonized tiered curl wig and white travertine pleated garment",
        imageUrl: "/showcase/egyptian-queen/hyp-3.webp",
        restoredModelUrl: "/showcase/egyptian-queen/hyp-3.glb",
        methodologyNote:
          "Explores the scholarly hypothesis attributing the fragment to Akhenaten's secondary wife Kiya, pairing the closed-mouth yellow jasper face with the tiered Nubian wig and gold ear disks.",
        observedFeaturesPreserved: [
          "Closed sensuous Amarna mouth and mirror-polished yellow jasper stone",
        ],
        hypothesizedAdditions: [
          "Carved dark steatite/ebonized tiered Nubian curl wig and alabaster shawl",
        ],
      },
    ],
    diagramType: "egyptian",
    sources: [
      {
        label: "Fragment of a Queen's Face (26.7.1396)",
        institution: "The Metropolitan Museum of Art",
        url: "https://www.metmuseum.org/art/collection/search/544514",
        license: "CC0 1.0 Open Access",
      },
      {
        label: "Comparable Parallel: Amarna Royal Head (2005.363)",
        institution: "The Metropolitan Museum of Art",
        url: "https://www.metmuseum.org/art/collection/search/547692",
        license: "CC0 1.0 Open Access",
      },
    ],
    viewerConfig: {
      defaultScale: 1.0,
      initialRotationY: -Math.PI / 2,
    },
  },
  {
    id: "persepolis-bull",
    catalogNumber: "EXHIBIT IV",
    shortTitle: "Persepolis Bull Capital",
    authenticName: "Bull's Head from a Monumental Column Capital",
    accessionNumber: "47.100.83",
    dateRange: "c. 5th century BCE",
    historicalPeriod: "Achaemenid Persian Empire (Reigns of Xerxes I – Artaxerxes I)",
    civilization: "Ancient Persian (Achaemenid)",
    origin: "Istakhr (near Persepolis), Fars Province, Iran",
    material: "Polished dark gray-black Persepolitan limestone (originally gilded & polychromed)",
    dimensions: "Surviving head: 48.5 × 29 × 40 cm (19 1/8 × 11 7/16 × 15 3/4 in.)",
    museum: "The Metropolitan Museum of Art",
    museumUrl: "https://www.metmuseum.org/art/collection/search/324025",
    license: "CC0 1.0 Public Domain (Met Open Access)",
    editorialSummary:
      "Carved in lustrous dark limestone near imperial Persepolis, this royal bull's head once crowned a towering palace column capital. Though sheared from its kneeling protome body and stripped of its mortised horns and ears, intact Persepolitan capitals document its full architectural majesty.",
    purpose:
      "Formed one half of an addorsed (back-to-back) double-bull column capital atop a fluted stone shaft, cradling massive cedar roof beams across royal audience halls while symbolizing imperial strength and cosmic order.",
    presentCondition:
      "Only the severed head and upper neck survive, fractured diagonally below the jaw and spiral neck ringlets. Both separately carved horns and both projecting ears are missing from their deep mortise sockets, and the lower muzzle and nostril rims are chipped.",
    observedElements: [
      "Lustrous dark gray Persepolitan limestone with stylized concentric brow ridges and almond eyes",
      "Tightly carved rows of Achaemenid snail-shell spiral curls across the forehead and cheek",
      "Cut mortise sockets at the crown and temples engineered to receive separately fitted horns and ears",
    ],
    reconstructedAdditions: [
      "Sweeping curved royal bull horns sheathed in antique gold leaf and fluted stone ears",
      "Muscular kneeling bull chest and tucked forelegs with twelve-petal lotus-and-rosette collar",
      "Restored lower muzzle, nostril rims, and optional palace mineral polychromy or twin addorsed protome",
    ],
    reconstructionEvidence:
      "Complete column capitals excavated at Persepolis (OIM A24065 in Chicago) and Susa (Louvre Sb 2788) preserve identical mortised horn/ear joinery, twelve-petal rosette collars, and folded forelegs, while archaeometric pigment studies confirm original Egyptian-blue, cinnabar, and gold-leaf finishes.",
    comparableParallels: [
      {
        name: "Colossal Bull Capital from the Throne Hall of Persepolis (OIM A24065)",
        museum: "Institute for the Study of Ancient Cultures, University of Chicago",
        date: "ca. 486–424 BCE",
        accessionNumber: "OIM A24065",
        url: "https://isac.uchicago.edu/collections/highlights/bull-head-persepolis",
        relevance:
          "Excavated in situ at Persepolis; preserves complete horn sockets, ear tenons, and collar proportions matching Met 47.100.83.",
      },
      {
        name: "Gold Vessel Terminating in the Forepart of a Leonine Creature",
        museum: "The Metropolitan Museum of Art",
        date: "ca. 5th century BCE",
        accessionNumber: "54.3.3",
        url: "https://www.metmuseum.org/art/collection/search/324291",
        relevance:
          "Contemporaneous Achaemenid court metalwork illustrating tucked foreleg posture and stylized royal animal musculature.",
      },
    ],
    originalImageUrl: "/showcase/persepolis-bull/original.jpg",
    originalCutoutUrl: "/showcase/persepolis-bull/original-cutout.webp",
    sketchImageUrl: "/showcase/persepolis-bull/sketch.webp",
    fragmentedVisualUrl: "/showcase/persepolis-bull/original.jpg",
    fragmentedIsAiEstimated: true,
    restoredModelUrl: "/showcase/persepolis-bull/hyp-1.glb",
    themePalette: {
      swatch: "#d6a449",
      bgDeep: "#0d0903",
      bgMid: "#1c1306",
      bgGlow: "rgba(112, 80, 22, 0.56)",
      surfaceCard: "rgba(32, 23, 9, 0.72)",
      surfaceSolid: "#161005",
      pedestalTint: "#c4b28e",
      rimLightColor: "#eab95c",
    },
    hypotheses: [
      {
        id: "hyp-1",
        label: "Interpretation I",
        title: "Gilded Horn & Limestone Protome",
        subtitle: "Restores gold-sheathed horns, carved ears, rosette collar, and folded forelegs",
        imageUrl: "/showcase/persepolis-bull/hyp-1.webp",
        restoredModelUrl: "/showcase/persepolis-bull/hyp-1.glb",
        methodologyNote:
          "Completes the surviving Persepolitan limestone head with repaired muzzle, mortise-fitted gilded horns, fluted ears, lotus-rosette neck band, and tucked forelegs after Persepolis Throne Hall parallels.",
        observedFeaturesPreserved: [
          "Exact concentric brow folds, almond eyes, and spiral forehead/neck curls",
          "Polished dark dove-gray veined Persepolitan limestone surface",
        ],
        hypothesizedAdditions: [
          "Sweeping burnished gold-leaf horns, carved stone ears, and repaired nostril scroll",
          "Kneeling muscular chest, tucked hooves, and twelve-petal rosette collar",
        ],
      },
      {
        id: "hyp-2",
        label: "Interpretation II",
        title: "Imperial Persepolis Polychrome State",
        subtitle: "Egyptian-blue curls, cinnabar accents, and hammered gold horns",
        imageUrl: "/showcase/persepolis-bull/hyp-2.webp",
        restoredModelUrl: "/showcase/persepolis-bull/hyp-2.glb",
        methodologyNote:
          "Applies archaeometrically documented Achaemenid palace pigments identified on Persepolis sculptures: lapis/Egyptian-blue hair curls, vermilion-cinnabar eyelids and nostrils, and gilded horns.",
        observedFeaturesPreserved: [
          "Three-quarter right profile, carved spiral curl rows, and ridged eyelids",
        ],
        hypothesizedAdditions: [
          "Egyptian-blue, cinnabar-red, and gold-leaf palace mineral polychromy",
          "Restored muzzle, ears, polychrome rosette collar, and kneeling forelegs",
        ],
      },
      {
        id: "hyp-3",
        label: "Interpretation III",
        title: "Addorsed Double-Bull Saddle Capital",
        subtitle: "Full symmetrical twin-bull architectural capital bearing roof impost",
        imageUrl: "/showcase/persepolis-bull/hyp-3.webp",
        restoredModelUrl: "/showcase/persepolis-bull/hyp-3.glb",
        methodologyNote:
          "Reconstructs the complete architectural unit as installed atop a palace column shaft (comparable to Louvre Sb 2788 from Susa), pairing twin back-to-back horned bull protomes beneath a beam saddle.",
        observedFeaturesPreserved: [
          "Right-hand bull's facial canon, spiral beard curls, and dark veined limestone finish",
        ],
        hypothesizedAdditions: [
          "Mirrored twin bull protome, central beam saddle impost, and four gilded horns",
        ],
      },
    ],
    diagramType: "capital",
    sources: [
      {
        label: "Bull's head from column capital (47.100.83)",
        institution: "The Metropolitan Museum of Art",
        url: "https://www.metmuseum.org/art/collection/search/324025",
        license: "CC0 1.0 Open Access",
      },
      {
        label: "Comparable Parallel: Achaemenid Gold Vessel (54.3.3)",
        institution: "The Metropolitan Museum of Art",
        url: "https://www.metmuseum.org/art/collection/search/324291",
        license: "CC0 1.0 Open Access",
      },
    ],
    viewerConfig: {
      defaultScale: 0.9,
      initialRotationY: -Math.PI / 2,
    },
  },
  {
    id: "teotihuacan-mask",
    catalogNumber: "EXHIBIT V",
    shortTitle: "Teotihuacan Stone Mask",
    authenticName: "Greenstone Ceremonial Funerary Mask",
    accessionNumber: "1979.206.527",
    dateRange: "c. 250–650 CE",
    historicalPeriod: "Classic Teotihuacan Period (3rd–7th Century CE)",
    civilization: "Teotihuacan (Mesoamerican)",
    origin: "Central Highlands of Mexico",
    material: "Carved greenstone (chlorite schist), drilled for lapidary regalia",
    dimensions: "H. 24.1 × W. 24.8 × D. 11.7 cm (9 1/2 × 9 3/4 × 4 5/8 in.)",
    museum: "The Metropolitan Museum of Art",
    museumUrl: "https://www.metmuseum.org/art/collection/search/312736",
    license: "CC0 1.0 Public Domain (Met Open Access)",
    editorialSummary:
      "Carved from sacred dark chlorite-schist greenstone to serve as the eternal face of an elite mortuary bundle, this Classic Teotihuacan mask preserves its austere architectural planes, blind recessed stone eye and mouth troughs, and biconically drilled ear flanges once fitted with jadeite regalia.",
    purpose:
      "Solid and unpierced for human wear, Classic Teotihuacan stone masks were lashed onto wrapped royal or elite mortuary bundles (bultos mortuorios) and ritual effigies, endowing the venerated ancestor with an idealized, timeless greenstone countenance.",
    presentCondition:
      "The carved chlorite-schist greenstone face survives intact with minor chips along the rectangular ear flanges and chin, stripped of its perishable mortuary bundle wrappings, jadeite earspool assemblies (orejeras), feathered headdress, and lapidary overlays; its recessed horizontal eye and mouth troughs remain bare chiseled stone.",
    observedElements: [
      "Mottled grey-green chlorite-schist facial sculpture with flat horizontal forehead rim and trapezoidal canon",
      "Blind recessed horizontal stone eye troughs and parted toothless stone mouth cavity",
      "Biconically drilled suspension perforations in both rectangular ear flanges",
    ],
    reconstructedAdditions: [
      "Carved Classic Teotihuacan flared apple-green jadeite earspools (orejeras) and greenstone bead strand",
      "Sacred cotton-wrapped mortuary bundle (bulto mortuorio) with stepped talud-tablero headdress and quetzal plumes",
      "Documented Malinaltepec-type turquoise, amazonite, and red Spondylus shell mosaic heirloom cladding",
    ],
    reconstructionEvidence:
      "Scholarship on Teotihuacan funerary bundles (Berrin, Pasztory, Headrick), theater-type incensario effigies, and INAH's technical analysis of the turquoise-and-Spondylus Mask of Malinaltepec demonstrate how austere greenstone masks functioned within composite jadeite, textile, feather, and mosaic ritual assemblages without naturalistic eyeballs or teeth.",
    comparableParallels: [
      {
        name: "Travertine (Tecali) Funerary Mask",
        museum: "The Metropolitan Museum of Art",
        date: "ca. 300–600 CE",
        accessionNumber: "1978.412.198",
        url: "https://www.metmuseum.org/art/collection/search/310647",
        relevance:
          "Companion Classic Teotihuacan stone mask in The Met exhibiting identical blind recessed lithic troughs and biconically drilled earflare suspension perforations.",
      },
      {
        name: "Mosaic Mask of Malinaltepec",
        museum: "Museo Nacional de Antropología, INAH (Mexico City)",
        date: "Classic Teotihuacan core (ca. 300–600 CE) with Postclassic mosaic overlay",
        accessionNumber: "MNA 10-9620",
        url: "https://www.mna.inah.gob.mx/",
        relevance:
          "Scientifically documented chlorite-schist Teotihuacan mask clad in turquoise, amazonite, and coral-red Spondylus tesserae with a toothless parted mouth.",
      },
    ],
    originalImageUrl: "/showcase/teotihuacan-mask/original.jpg",
    originalCutoutUrl: "/showcase/teotihuacan-mask/original-cutout.webp",
    sketchImageUrl: "/showcase/teotihuacan-mask/sketch.webp",
    fragmentedVisualUrl: "/showcase/teotihuacan-mask/original.jpg",
    fragmentedIsAiEstimated: true,
    restoredModelUrl: "/showcase/teotihuacan-mask/hyp-1.glb",
    themePalette: {
      swatch: "#437a60",
      bgDeep: "#04100c",
      bgMid: "#0a2119",
      bgGlow: "rgba(25, 82, 62, 0.58)",
      surfaceCard: "rgba(11, 35, 27, 0.72)",
      surfaceSolid: "#081a14",
      pedestalTint: "#8eb8a6",
      rimLightColor: "#72bd9d",
    },
    hypotheses: [
      {
        id: "hyp-1",
        label: "Interpretation I",
        title: "Lithic Greenstone & Jadeite Regalia",
        subtitle: "Unadorned blind stone troughs with Classic jadeite orejeras & pectoral beads",
        imageUrl: "/showcase/teotihuacan-mask/hyp-1.webp",
        restoredModelUrl: "/showcase/teotihuacan-mask/hyp-1.glb",
        methodologyNote:
          "Preserves the austere satin-polished chlorite-schist face with empty shadowed eye and mouth recesses while restoring the flared apple-green jadeite earspools (orejeras) and subspherical greenstone bead strand indicated by the earlobe perforations.",
        observedFeaturesPreserved: [
          "Strict frontal trapezoidal Teotihuacan brow, triangular nose, and mottled chlorite-schist grain",
          "Uninlaid blind recessed stone eye troughs and toothless parted stone lips",
        ],
        hypothesizedAdditions: [
          "Circular flared apple-green jadeite earspools (orejeras) mounted at both ear flanges",
          "Suspended ceremonial strand of hand-carved subspherical and tubular greenstone beads",
        ],
      },
      {
        id: "hyp-2",
        label: "Interpretation II",
        title: "Elite Mortuary Bundle (Bulto Mortuorio)",
        subtitle: "Mounted on cotton funerary bundle with talud-tablero headdress & quetzal plumes",
        imageUrl: "/showcase/teotihuacan-mask/hyp-2.webp",
        restoredModelUrl: "/showcase/teotihuacan-mask/hyp-2.glb",
        methodologyNote:
          "Reconstructs the mask's primary funerary context lashed as the sacred face of a wrapped elite mortuary bundle, crowned by an architectural stepped talud-tablero headdress (tocado) with quetzal tail plumes and a three-tier jadeite plaque pectoral modeled on Teotihuacan theater-censer effigies.",
        observedFeaturesPreserved: [
          "Unaltered dark grey-green chlorite-schist mask core with blind stone eye and mouth cavities",
          "Symmetrical horizontal forehead rim engineered to seat a composite headdress",
        ],
        hypothesizedAdditions: [
          "Stepped greenstone and red-ochre talud-tablero headdress crowned with quetzal plumes",
          "Woven-cotton mortuary bundle collar, three-tier jadeite plaque necklace, and pendant orejeras",
        ],
      },
      {
        id: "hyp-3",
        label: "Interpretation III",
        title: "Turquoise, Amazonite & Spondylus Mosaic",
        subtitle: "Postclassic heirloom lapidary overlay after the Mask of Malinaltepec",
        imageUrl: "/showcase/teotihuacan-mask/hyp-3.webp",
        restoredModelUrl: "/showcase/teotihuacan-mask/hyp-3.glb",
        methodologyNote:
          "Follows INAH's archaeometric study of the Mask of Malinaltepec—an authentic Classic Teotihuacan chlorite-schist mask later revered as a sacred heirloom and clad in sky-blue turquoise, amazonite, and coral-red Spondylus shell tesserae over copal resin, maintaining flat dark mineral eye slits and an empty toothless mouth.",
        observedFeaturesPreserved: [
          "Broad trapezoidal Teotihuacan facial geometry, parted lip contour, and chlorite-schist ear rims",
          "Empty recessed toothless mouth aperture and flat non-spherical eye slits",
        ],
        hypothesizedAdditions: [
          "Polygonal turquoise and amazonite mosaic tesserae with Spondylus cheek bands and lip tiles",
          "Suspended bi-chrome greenstone and Spondylus tubular ear pendants",
        ],
      },
    ],
    diagramType: "mask",
    sources: [
      {
        label: "Greenstone Mask (1979.206.527)",
        institution: "The Metropolitan Museum of Art",
        url: "https://www.metmuseum.org/art/collection/search/312736",
        license: "CC0 1.0 Open Access",
      },
      {
        label: "Comparable Parallel: Teotihuacan Mask (1978.412.198)",
        institution: "The Metropolitan Museum of Art",
        url: "https://www.metmuseum.org/art/collection/search/310647",
        license: "CC0 1.0 Open Access",
      },
    ],
    viewerConfig: {
      defaultScale: 0.96,
      initialRotationY: -Math.PI / 2,
    },
  },
];
