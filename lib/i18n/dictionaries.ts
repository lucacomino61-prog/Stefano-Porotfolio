import type { Locale } from './config'

/**
 * All visible copy, in one place, typed so a missing key is a build error
 * rather than an empty span in production.
 *
 * House rules for anything added here:
 *   - No em-dash or en-dash. Use a period, a comma, or a hyphen.
 *   - No eyebrow labels above headings. The heading carries its own weight.
 *   - No scroll cues. A visitor looking at the first viewport knows what
 *     scrolling is.
 *   - One label per intent. "Send a message" is the only contact wording, in
 *     the navigation, the hero and the form alike.
 */
export type Dictionary = {
  meta: { title: string; description: string }
  nav: {
    skipToContent: string
    languageLabel: string
    loadingLabel: string
    sections: string
    /** Short rail labels. Long enough to be unambiguous, short enough to fit. */
    items: { manifesto: string; work: string; process: string; contact: string }
    /** Pager controls inside the machine. Icon-only buttons, so these ARE the names. */
    previous: string
    next: string
  }
  hero: {
    /** The name is not translated. It is here so the reveal has one source. */
    name: string
    role: string
    /** Read out under the name, in the register of a billing block. */
    based: string
    cta: string
    /** The apparatus row under the name: the two readouts and the sound switch. */
    clockLabel: string
    dateLabel: string
    soundOn: string
    soundOff: string
    themeToLight: string
    themeToDark: string
  }
  /**
   * The words on the date stamp, carried here rather than taken from Intl.
   *
   * Two reasons, and the first is not a preference. Chrome ships without `sq`
   * locale data: `Intl.DateTimeFormat('sq')` resolves to en-US and hands back
   * English silently, which would print an English date on the Albanian page
   * of a site that is careful enough to separate the `al` path from the `sq`
   * language tag. The second is that ICU abbreviations differ between builds
   * and platforms, and the stamp sits in a fixed slate: three letters, every
   * language, every browser, or the box changes width as the day turns over.
   *
   * Weekdays are indexed by Date#getDay, so Sunday leads.
   */
  calendar: { weekdays: readonly string[]; months: readonly string[] }
  manifesto: { statement: string }
  work: {
    heading: string
    pending: string
    /** The apparatus around the monitor and the work section. */
    kicker: string
    intro: string
    live: string
    selector: string
    approach: string
    categoryLabel: string
    yearLabel: string
    /** The workstation as something you operate rather than look at. */
    enter: string
    viewWork: string
    /** The desktop: what the icons are, and the heading over the detail list. */
    apps: string
    details: string
    openSite: string
    back: string
    homeHint: string
    /** Per project, keyed by the ids in lib/projects.ts. */
    projects: Record<
      'elixir' | 'bar-martiri',
      {
        category: string
        description: string
        alt: string
        /**
         * Short factual lines shown beside the project. Read off the running
         * sites, not written from imagination: what the thing actually does,
         * who it serves, what it ships.
         */
        facts: readonly string[]
      }
    >
  }
  /**
   * The devices on the desk.
   *
   * These read as controls, not captions: a three-dimensional object cannot be
   * tabbed to and is invisible to a screen reader, so each one has a real
   * button here and the button is what carries the name.
   */
  about: {
    heading: string
    kicker: string
    lede: string
    capabilitiesLabel: string
    capabilities: readonly string[]
  }
  process: {
    heading: string
    intro: string
    steps: { id: string; label: string; body: string }[]
  }
  contact: {
    heading: string
    intro: string
    name: string
    namePlaceholder: string
    email: string
    emailPlaceholder: string
    message: string
    messagePlaceholder: string
    /** Honeypot label. Visually hidden, announced to nobody. */
    company: string
    submit: string
    sending: string
    success: string
    successBody: string
    noScript: string
    errors: {
      tooShort: string
      tooLong: string
      invalidEmail: string
      rateLimited: string
      rejected: string
      server: string
      network: string
    }
  }
  footer: { rights: string; email: string }
}

const en: Dictionary = {
  meta: {
    title: 'Stefano Doko, web designer and developer',
    description:
      'One pair of hands takes a project from the first sketch to the last commit. Design and build, end to end.',
  },
  nav: {
    skipToContent: 'Skip to content',
    loadingLabel: 'Loading the room',
    languageLabel: 'Language',
    sections: 'Sections',
    items: { manifesto: 'Approach', work: 'Work', process: 'Process', contact: 'Contact' },
    previous: 'Previous screen',
    next: 'Next screen',
  },
  hero: {
    name: 'Stefano Doko',
    role: 'Web designer and developer',
    based: 'Design and build, end to end',
    cta: 'Send a message',
    clockLabel: 'Local time',
    dateLabel: 'Date',
    soundOn: 'Turn sound on',
    soundOff: 'Turn sound off',
    themeToLight: 'Switch to the day sheet',
    themeToDark: 'Switch to the night sheet',
  },
  calendar: {
    weekdays: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
    months: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
  },
  manifesto: {
    statement:
      'One pair of hands takes the work from the first sketch to the last commit. Nothing is handed over, so nothing arrives broken.',
  },
  work: {
    heading: 'Selected work',
    pending: 'This section is waiting on its projects.',
    kicker: 'Two sites, running',
    intro:
      'Both are live, both are mine end to end, and both are one click away. Look at them rather than reading about them.',
    live: 'View',
    selector: 'Choose a project',
    approach: 'Design and build, end to end',
    categoryLabel: 'Discipline',
    yearLabel: 'Shipped',
    enter: 'Open the garage',
    viewWork: 'View my work',
    apps: 'Applications',
    details: 'Details',
    openSite: 'Open the live site',
    back: 'Back',
    homeHint: 'Click a garage display',
    projects: {
      elixir: {
        category: 'Luxury perfume e-commerce',
        description:
          'An online perfume house. Designer, Arabic and niche bottles, catalogued and sold across Albania, on a warm near-black ground built to make a bottle worth looking at.',
        alt: 'The Elixir storefront: a perfume bottle lit against a warm dark ground.',
        facts: ['Catalogue and cart', 'Designer, Arabic and niche', 'Ships across Albania'],
      },
      'bar-martiri': {
        category: 'Hospitality / bar experience',
        description:
          'A bar on the sand at Spille. The menu, the sunbeds and the walk down to the sea, in three languages, for people deciding where to spend the afternoon.',
        alt: 'Bar Martiri: the beach at Spille, sunbeds and the sea behind them.',
        facts: ['Menu and sunbeds', 'Three languages', 'Spille, on the coast'],
      },
    },
  },
  about: {
    heading: 'About',
    kicker: 'One pair of hands',
    lede:
      'I design the thing and then I build it. No handover, no translation loss between a file and a repository, no second party to blame when the two disagree.',
    capabilitiesLabel: 'Capabilities',
    capabilities: [
      'Web design',
      'Frontend development',
      'UI/UX',
      'Creative development',
      'Digital experiences',
    ],
  },
  process: {
    heading: 'How the work runs',
    intro:
      'Five passes, in order. Each one ends with something you can look at, not a status update.',
    steps: [
      {
        id: 'brief',
        label: 'Brief',
        body: 'We agree what the site has to do, who it is for, and what it must not become. The constraints get written down before anything is drawn.',
      },
      {
        id: 'structure',
        label: 'Structure',
        body: 'Content and hierarchy first. What a page says and in what order is settled while it is still cheap to change.',
      },
      {
        id: 'design',
        label: 'Design',
        body: 'Art direction happens in the browser, at real widths, with real copy. A design that only works in a static file is not finished.',
      },
      {
        id: 'build',
        label: 'Build',
        body: 'Production code, typed throughout, measured against a performance budget rather than a feeling. Accessibility is part of the build, not a pass at the end.',
      },
      {
        id: 'ship',
        label: 'Ship',
        body: 'Deploy, measure the result, and hand over something you can run yourself. You own the code and the accounts.',
      },
    ],
  },
  contact: {
    heading: 'Start a conversation',
    intro: 'Tell me what you are making and when it needs to exist.',
    name: 'Name',
    namePlaceholder: 'Your name',
    email: 'Email',
    emailPlaceholder: 'you@example.com',
    message: 'Message',
    messagePlaceholder: 'What are you building, and by when?',
    company: 'Company',
    submit: 'Send a message',
    sending: 'Sending',
    success: 'Received',
    successBody: 'Your message is in. You will get a reply within two working days.',
    noScript: 'The form needs JavaScript. Write to me directly instead:',
    errors: {
      tooShort: 'A little more detail, please.',
      tooLong: 'That is longer than the form accepts.',
      invalidEmail: 'That address does not look right.',
      rateLimited: 'Too many messages from here. Try again shortly.',
      rejected: 'The form could not accept that. Reload the page and try again.',
      server: 'Something broke on my side. Try again, or write directly.',
      network: 'The message did not reach me. Check your connection and try again.',
    },
  },
  footer: {
    rights: 'All rights reserved',
    email: 'Email',
  },
}

const it: Dictionary = {
  meta: {
    title: 'Stefano Doko, web designer e sviluppatore',
    description:
      'Un solo paio di mani porta un progetto dal primo schizzo all’ultimo commit. Progettazione e sviluppo, dall’inizio alla fine.',
  },
  nav: {
    skipToContent: 'Vai al contenuto',
    loadingLabel: 'Carico la stanza',
    languageLabel: 'Lingua',
    sections: 'Sezioni',
    items: { manifesto: 'Approccio', work: 'Lavori', process: 'Processo', contact: 'Contatti' },
    previous: 'Schermata precedente',
    next: 'Schermata successiva',
  },
  hero: {
    name: 'Stefano Doko',
    role: 'Web designer e sviluppatore',
    based: 'Progetto e costruisco, dall’inizio alla fine',
    cta: 'Scrivimi un messaggio',
    clockLabel: 'Ora locale',
    dateLabel: 'Data',
    soundOn: 'Attiva l’audio',
    soundOff: 'Disattiva l’audio',
    themeToLight: 'Passa al foglio diurno',
    themeToDark: 'Passa al foglio notturno',
  },
  calendar: {
    weekdays: ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'],
    months: ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'],
  },
  manifesto: {
    statement:
      'Un solo paio di mani porta il lavoro dal primo schizzo all’ultimo commit. Niente passa di mano, quindi niente arriva rotto.',
  },
  work: {
    heading: 'Lavori scelti',
    pending: 'Questa sezione aspetta i suoi progetti.',
    kicker: 'Due siti, online',
    intro:
      'Sono entrambi online, entrambi miei dall’inizio alla fine, ed entrambi a un clic. Guardali, invece di leggerne.',
    live: 'Apri',
    selector: 'Scegli un progetto',
    approach: 'Progetto e costruisco, dall’inizio alla fine',
    categoryLabel: 'Disciplina',
    yearLabel: 'Online dal',
    enter: 'Apri il garage',
    viewWork: 'Guarda i miei lavori',
    apps: 'Applicazioni',
    details: 'Dettagli',
    openSite: 'Apri il sito online',
    back: 'Indietro',
    homeHint: 'Clicca un display',
    projects: {
      elixir: {
        category: 'E-commerce di profumeria di lusso',
        description:
          'Una profumeria online. Designer, arabi e di nicchia, a catalogo e in vendita in tutta l’Albania, su un fondo caldo quasi nero costruito perché valga la pena guardare una boccetta.',
        alt: 'La vetrina di Elixir: una boccetta illuminata su un fondo scuro e caldo.',
        facts: ['Catalogo e carrello', 'Designer, arabi e di nicchia', 'Spedizione in tutta l’Albania'],
      },
      'bar-martiri': {
        category: 'Ospitalità / esperienza bar',
        description:
          'Un bar sulla sabbia di Spille. Il menu, i lettini e la discesa al mare, in tre lingue, per chi sta decidendo dove passare il pomeriggio.',
        alt: 'Bar Martiri: la spiaggia di Spille, i lettini e il mare dietro.',
        facts: ['Menu e lettini', 'Tre lingue', 'Spille, sulla costa'],
      },
    },
  },
  about: {
    heading: 'Chi sono',
    kicker: 'Un solo paio di mani',
    lede:
      'Progetto la cosa e poi la costruisco. Nessun passaggio di consegne, nessuna perdita fra un file e un repository, nessun secondo interlocutore da incolpare quando i due non coincidono.',
    capabilitiesLabel: 'Competenze',
    capabilities: [
      'Web design',
      'Sviluppo frontend',
      'UI/UX',
      'Sviluppo creativo',
      'Esperienze digitali',
    ],
  },
  process: {
    heading: 'Come procede il lavoro',
    intro:
      'Cinque passaggi, in ordine. Ognuno finisce con qualcosa da guardare, non con un aggiornamento di stato.',
    steps: [
      {
        id: 'brief',
        label: 'Briefing',
        body: 'Stabiliamo cosa deve fare il sito, per chi, e cosa non deve diventare. I vincoli si scrivono prima di disegnare qualsiasi cosa.',
      },
      {
        id: 'structure',
        label: 'Struttura',
        body: 'Prima i contenuti e la gerarchia. Cosa dice una pagina e in che ordine si decide finché cambiare costa poco.',
      },
      {
        id: 'design',
        label: 'Progetto',
        body: 'La direzione artistica si fa nel browser, alle larghezze vere, con i testi veri. Un progetto che funziona solo in un file statico non è finito.',
      },
      {
        id: 'build',
        label: 'Sviluppo',
        body: 'Codice di produzione, tipizzato ovunque, misurato su un budget di prestazioni invece che a sensazione. L’accessibilità fa parte dello sviluppo, non è un passaggio finale.',
      },
      {
        id: 'ship',
        label: 'Consegna',
        body: 'Pubblicazione, misurazione del risultato, e consegna di qualcosa che puoi gestire da solo. Il codice e gli account sono tuoi.',
      },
    ],
  },
  contact: {
    heading: 'Iniziamo a parlarne',
    intro: 'Raccontami cosa stai costruendo e quando deve esistere.',
    name: 'Nome',
    namePlaceholder: 'Il tuo nome',
    email: 'Email',
    emailPlaceholder: 'tu@esempio.com',
    message: 'Messaggio',
    messagePlaceholder: 'Cosa stai costruendo, ed entro quando?',
    company: 'Azienda',
    submit: 'Scrivimi un messaggio',
    sending: 'Invio in corso',
    success: 'Ricevuto',
    successBody: 'Il messaggio è arrivato. Rispondo entro due giorni lavorativi.',
    noScript: 'Il modulo richiede JavaScript. Scrivimi direttamente:',
    errors: {
      tooShort: 'Serve qualche dettaglio in più.',
      tooLong: 'È più lungo di quanto il modulo accetti.',
      invalidEmail: 'Questo indirizzo non sembra corretto.',
      rateLimited: 'Troppi messaggi da qui. Riprova tra poco.',
      rejected: 'Il modulo non ha potuto accettarlo. Ricarica la pagina e riprova.',
      server: 'Qualcosa si è rotto dalla mia parte. Riprova, oppure scrivimi direttamente.',
      network: 'Il messaggio non è arrivato. Controlla la connessione e riprova.',
    },
  },
  footer: {
    rights: 'Tutti i diritti riservati',
    email: 'Email',
  },
}

const al: Dictionary = {
  meta: {
    title: 'Stefano Doko, dizajner dhe zhvillues uebi',
    description:
      'Një palë duar e çojnë një projekt nga skica e parë te commit-i i fundit. Dizajn dhe ndërtim, nga fillimi në fund.',
  },
  nav: {
    skipToContent: 'Kalo te përmbajtja',
    loadingLabel: 'Po ngarkoj dhomën',
    languageLabel: 'Gjuha',
    sections: 'Seksionet',
    items: { manifesto: 'Qasja', work: 'Punët', process: 'Procesi', contact: 'Kontakt' },
    previous: 'Ekrani i mëparshëm',
    next: 'Ekrani tjetër',
  },
  hero: {
    name: 'Stefano Doko',
    role: 'Dizajner dhe zhvillues uebi',
    based: 'Projektoj dhe ndërtoj, nga fillimi në fund',
    cta: 'Dërgo një mesazh',
    clockLabel: 'Ora lokale',
    dateLabel: 'Data',
    soundOn: 'Aktivizo zërin',
    soundOff: 'Çaktivizo zërin',
    themeToLight: 'Kalo te fleta e ditës',
    themeToDark: 'Kalo te fleta e natës',
  },
  calendar: {
    weekdays: ['DIE', 'HËN', 'MAR', 'MËR', 'ENJ', 'PRE', 'SHT'],
    months: ['JAN', 'SHK', 'MAR', 'PRI', 'MAJ', 'QER', 'KOR', 'GSH', 'SHT', 'TET', 'NËN', 'DHJ'],
  },
  manifesto: {
    statement:
      'Një palë duar e çojnë punën nga skica e parë te commit-i i fundit. Asgjë nuk dorëzohet, prandaj asgjë nuk mbërrin e prishur.',
  },
  work: {
    heading: 'Punët e zgjedhura',
    pending: 'Kjo pjesë pret projektet e veta.',
    kicker: 'Dy faqe, online',
    intro:
      'Të dyja janë online, të dyja janë të miat nga fillimi në fund, dhe të dyja janë një klik larg. Shikojini, në vend që të lexoni për to.',
    live: 'Hap',
    selector: 'Zgjidhni një projekt',
    approach: 'Projektoj dhe ndërtoj, nga fillimi në fund',
    categoryLabel: 'Disiplina',
    yearLabel: 'Online nga',
    enter: 'Hap garazhin',
    viewWork: 'Shiko punët e mia',
    apps: 'Aplikacione',
    details: 'Detaje',
    openSite: 'Hap faqen online',
    back: 'Kthehu',
    homeHint: 'Kliko një ekran',
    projects: {
      elixir: {
        category: 'Tregti online parfumesh luksoze',
        description:
          'Një shtëpi parfumesh online. Designer, arabe dhe nishe, në katalog dhe në shitje në gjithë Shqipërinë, mbi një sfond të ngrohtë thuajse të zi, ndërtuar që një shishe të ketë vlerë të shihet.',
        alt: 'Vitrina e Elixir: një shishe parfumi e ndriçuar mbi sfond të errët e të ngrohtë.',
        facts: ['Katalog dhe shportë', 'Designer, arabe dhe nishe', 'Dërgim në gjithë Shqipërinë'],
      },
      'bar-martiri': {
        category: 'Mikpritje / përvojë bari',
        description:
          'Një bar mbi rërën në Spille. Menuja, shezlonet dhe rruga deri te deti, në tri gjuhë, për ata që po vendosin ku ta kalojnë pasditen.',
        alt: 'Bar Martiri: plazhi i Spilles, shezlonet dhe deti pas tyre.',
        facts: ['Menu dhe shezlone', 'Tri gjuhë', 'Spille, në bregdet'],
      },
    },
  },
  about: {
    heading: 'Rreth meje',
    kicker: 'Një palë duar',
    lede:
      'E projektoj gjënë dhe pastaj e ndërtoj. Pa dorëzime, pa humbje mes një skede dhe një depoje kodi, pa një palë të dytë për të fajësuar kur të dyja nuk përputhen.',
    capabilitiesLabel: 'Aftësi',
    capabilities: [
      'Web design',
      'Zhvillim frontend',
      'UI/UX',
      'Zhvillim krijues',
      'Përvoja dixhitale',
    ],
  },
  process: {
    heading: 'Si ecën puna',
    intro:
      'Pesë hapa, me radhë. Secili mbaron me diçka që mund ta shohësh, jo me një njoftim statusi.',
    steps: [
      {
        id: 'brief',
        label: 'Briefi',
        body: 'Bihemi dakord se çfarë duhet të bëjë faqja, për kë është, dhe çfarë nuk duhet të bëhet. Kufizimet shkruhen para se të vizatohet gjeja e parë.',
      },
      {
        id: 'structure',
        label: 'Struktura',
        body: 'Së pari përmbajtja dhe hierarkia. Çfarë thotë një faqe dhe me çfarë radhe vendoset sa kohë që ndryshimi kushton pak.',
      },
      {
        id: 'design',
        label: 'Dizajni',
        body: 'Drejtimi artistik bëhet në shfletues, në gjerësi reale, me tekste reale. Një dizajn që funksionon vetëm në një skedar statik nuk është i përfunduar.',
      },
      {
        id: 'build',
        label: 'Ndërtimi',
        body: 'Kod prodhimi, i tipizuar kudo, i matur kundër një buxheti performance dhe jo me ndjesi. Aksesueshmëria është pjesë e ndërtimit, jo një hap në fund.',
      },
      {
        id: 'ship',
        label: 'Dorëzimi',
        body: 'Publikim, matje e rezultatit, dhe dorëzim i diçkaje që mund ta mbash vetë. Kodi dhe llogaritë janë të tuat.',
      },
    ],
  },
  contact: {
    heading: 'Le ta nisim bisedën',
    intro: 'Më trego çfarë po ndërtoni dhe kur duhet të ekzistojë.',
    name: 'Emri',
    namePlaceholder: 'Emri juaj',
    email: 'Email',
    emailPlaceholder: 'ju@shembull.com',
    message: 'Mesazhi',
    messagePlaceholder: 'Çfarë po ndërtoni, dhe deri kur?',
    company: 'Kompania',
    submit: 'Dërgo një mesazh',
    sending: 'Duke dërguar',
    success: 'U mor',
    successBody: 'Mesazhi mbërriti. Do të merrni përgjigje brenda dy ditëve pune.',
    noScript: 'Formulari kërkon JavaScript. Më shkruani drejtpërdrejt:',
    errors: {
      tooShort: 'Pak më shumë detaje, ju lutem.',
      tooLong: 'Kjo është më e gjatë se sa pranon formulari.',
      invalidEmail: 'Kjo adresë nuk duket e saktë.',
      rateLimited: 'Shumë mesazhe nga këtu. Provoni sërish pas pak.',
      rejected: 'Formulari nuk mundi ta pranonte. Rifreskoni faqen dhe provoni sërish.',
      server: 'Diçka u prish nga ana ime. Provoni sërish, ose më shkruani drejtpërdrejt.',
      network: 'Mesazhi nuk mbërriti. Kontrolloni lidhjen dhe provoni sërish.',
    },
  },
  footer: {
    rights: 'Të gjitha të drejtat e rezervuara',
    email: 'Email',
  },
}

const dictionaries: Record<Locale, Dictionary> = { it, en, al }

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale]
}
