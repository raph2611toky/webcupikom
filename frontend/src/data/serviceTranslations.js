export const SERVICE_TRANSLATIONS = {
  transport: {
    en: {
      name:"Transport", category:"Transport", shortDescription:"Routes, shuttles and mobility services across Nova Terra.",
      description:"The Transport service coordinates public routes, shuttles and mobility-related requests throughout Nova Terra.",
      actions:["Check schedules","Report a transport problem","Request mobility assistance"], requiredDocuments:["Citizen ID when required"],
    },
    mg: {
      name:"Fitaterana", category:"Fitaterana", shortDescription:"Lalana, fiara fitaterana ary fivezivezena manerana an'i Nova Terra.",
      description:"Ny sampan-draharahan'ny Fitaterana no mandrindra ny lalana, ny fiara fitaterana ary ny fangatahana mifandraika amin'ny fivezivezena.",
      actions:["Hijery fandaharam-potoana","Hitatitra olana amin'ny fitaterana","Hangataka fanampiana amin'ny fivezivezena"], requiredDocuments:["Kara-panondro raha ilaina"],
    },
  },
  habitat: {
    en: {
      name:"Housing", category:"Housing", shortDescription:"Housing, residences and maintenance of inhabited areas.",
      description:"The Housing service supports residents with housing information, maintenance and building-related requests.",
      actions:["Report a housing issue","Update housing information","Request an intervention"], requiredDocuments:["Citizen ID","Housing reference when required"],
    },
    mg: {
      name:"Trano fonenana", category:"Trano fonenana", shortDescription:"Trano, toeram-ponenana ary fikojakojana ny faritra onenana.",
      description:"Ny sampan-draharahan'ny Trano fonenana dia manampy ny mponina amin'ny vaovao, fikojakojana ary fangatahana mifandraika amin'ny trano.",
      actions:["Hitatitra olana amin'ny trano","Hanavao ny mombamomba ny trano","Hangataka fandraisana andraikitra"], requiredDocuments:["Kara-panondro","Laharan'ny trano raha ilaina"],
    },
  },
  energie: {
    en: {
      name:"Energy", category:"Energy", shortDescription:"Electricity distribution, consumption and incident reporting.",
      description:"The Energy service monitors supply and receives reports related to the city network.",
      actions:["Report an outage","Check my sector","Request an inspection"], requiredDocuments:["Citizen ID","Location of the incident"],
    },
    mg: {
      name:"Angovo", category:"Angovo", shortDescription:"Famatsiana herinaratra, fanjifana ary tatitra momba ny olana.",
      description:"Ny sampan-draharahan'ny Angovo dia manara-maso ny famatsiana ary mandray tatitra momba ny tambajotran'ny tanàna.",
      actions:["Hitatitra fahatapahan-jiro","Hijery ny faritra misy ahy","Hangataka fanaraha-maso"], requiredDocuments:["Kara-panondro","Toerana misy ny olana"],
    },
  },
  administration: {
    en: {
      name:"Administration", category:"Administration", shortDescription:"Official documents, identity and civic procedures.",
      description:"The Administration service handles official document requests and citizen account procedures.",
      actions:["Request a certificate","Update my information","Contact the administration"], requiredDocuments:["Citizen ID","Supporting document depending on the procedure"],
    },
    mg: {
      name:"Fitantanana", category:"Fitantanana", shortDescription:"Taratasy ofisialy, maha-izy azy ary raharaham-panjakana.",
      description:"Ny sampan-draharahan'ny Fitantanana dia mikarakara fangatahana taratasy ofisialy sy fanavaozana ny mombamomba ny mponina.",
      actions:["Hangataka taratasy fanamarinana","Hanavao ny mombamomba ahy","Hifandray amin'ny fitantanana"], requiredDocuments:["Kara-panondro","Taratasy fanampiny arakaraka ny fangatahana"],
    },
  },
  sante: {
    en: {
      name:"Health", category:"Health", shortDescription:"Health centers, prevention and practical information.",
      description:"The Health service provides information about city health centers and prevention campaigns.",
      actions:["Find a center","View health information","Request assistance"], requiredDocuments:["Citizen ID when required"],
    },
    mg: {
      name:"Fahasalamana", category:"Fahasalamana", shortDescription:"Tobim-pahasalamana, fisorohana ary vaovao ilaina.",
      description:"Ny sampan-draharahan'ny Fahasalamana dia manome vaovao momba ny tobim-pahasalamana sy ny hetsika fisorohana.",
      actions:["Hitady tobim-pahasalamana","Hijery vaovao momba ny fahasalamana","Hangataka fanampiana"], requiredDocuments:["Kara-panondro raha ilaina"],
    },
  },
  securite: {
    en: {
      name:"Safety", category:"Safety", shortDescription:"Reports, prevention and urban safety coordination.",
      description:"The Safety service receives reports and publishes useful guidance for residents.",
      actions:["Submit a report","View safety guidance","Contact the service"], requiredDocuments:["No document required for an urgent report"],
    },
    mg: {
      name:"Fiarovana", category:"Fiarovana", shortDescription:"Tatitra, fisorohana ary fandrindrana ny fiarovana an-tanàna.",
      description:"Ny sampan-draharahan'ny Fiarovana dia mandray tatitra ary mizara torolalana ilaina ho an'ny mponina.",
      actions:["Handefa tatitra","Hijery torolalana momba ny fiarovana","Hifandray amin'ny sampan-draharaha"], requiredDocuments:["Tsy ilaina ny taratasy raha tatitra maika"],
    },
  },
};
