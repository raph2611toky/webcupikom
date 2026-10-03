export const CITY_DISTRICTS = [
  { id:"aster", name:"Quartier Aster", subtitle:"Santé & secours", center:[205,155], color:"#e34f83" },
  { id:"orion", name:"District Orion", subtitle:"Sécurité & institutions", center:[510,145], color:"#7657ff" },
  { id:"helios", name:"Pôle Hélios", subtitle:"Mobilité & intervention", center:[805,170], color:"#19aeea" },
  { id:"aurore", name:"Centre Aurore", subtitle:"Vie citoyenne", center:[430,345], color:"#4f7cff" },
  { id:"solaris", name:"Secteur Solaris", subtitle:"Énergie & habitat", center:[790,410], color:"#f59d24" },
  { id:"azura", name:"Rives d’Azura", subtitle:"Voirie & environnement", center:[225,500], color:"#20a997" },
  { id:"nexus", name:"Nexus Numérique", subtitle:"Services digitaux", center:[565,520], color:"#9255e9" },
  { id:"lyra", name:"Jardins Lyra", subtitle:"Résidences & proximité", center:[815,565], color:"#26b989" },
];

export const CITY_POIS = [
  { id:"hospital-aster", kind:"emergency", name:"Hôpital Aster", category:"Hôpital", district:"Quartier Aster", address:"12 avenue des Aurores", x:165, y:128, icon:"✚", color:"#d93b70", description:"Urgences médicales de Nova Terra · accueil 24 h/24." },
  { id:"urgent-vega", kind:"emergency", name:"Centre d’urgence Vega", category:"Urgences", district:"Quartier Aster", address:"4 rue Vega", x:285, y:190, icon:"＋", color:"#e85b38", description:"Point de secours et d’orientation d’urgence." },
  { id:"security-orion", kind:"emergency", name:"Poste de sécurité Orion", category:"Sécurité", district:"District Orion", address:"1 place Orion", x:510, y:116, icon:"◆", color:"#6547e8", description:"Accueil sécurité et assistance municipale." },
  { id:"fire-helios", kind:"emergency", name:"Caserne Hélios", category:"Secours", district:"Pôle Hélios", address:"28 boulevard Hélios", x:835, y:145, icon:"▲", color:"#e95b35", description:"Intervention incendie et secours de proximité." },
];

const SERVICE_SPOTS = [
  { key:"administration", district:"aurore", x:405, y:325, color:"#4f7cff", address:"8 place Aurore" },
  { key:"health", district:"aster", x:205, y:165, color:"#f45d91", address:"20 avenue Aster" },
  { key:"security", district:"orion", x:550, y:175, color:"#7657ff", address:"6 place Orion" },
  { key:"transport", district:"helios", x:760, y:215, color:"#19aeea", address:"3 esplanade Hélios" },
  { key:"energy", district:"solaris", x:815, y:400, color:"#ffab32", address:"15 allée Solstice" },
  { key:"habitat", district:"lyra", x:790, y:545, color:"#26b989", address:"9 jardins Lyra" },
  { key:"infrastructure", district:"azura", x:250, y:500, color:"#2aa99f", address:"17 quai d’Azura" },
  { key:"digital", district:"nexus", x:560, y:515, color:"#9255e9", address:"2 passage Nébula" },
];

function hashText(text=""){
  let hash=2166136261;
  for(const char of String(text)){
    hash^=char.charCodeAt(0);
    hash=Math.imul(hash,16777619);
  }
  return Math.abs(hash>>>0);
}

function serviceKey(service={}){
  const text=`${service.slug||""} ${service.name||""} ${service.category||""}`.toLowerCase();
  if(/admin|état|etat|civil|mairie/.test(text))return "administration";
  if(/sant|health|hôpital|hopital|medical/.test(text))return "health";
  if(/sécur|secur|police|urgence/.test(text))return "security";
  if(/transport|mobilit|gare|bus/.test(text))return "transport";
  if(/énergie|energie|electric|électric/.test(text))return "energy";
  if(/habitat|logement|résidence|residence/.test(text))return "habitat";
  if(/eau|voirie|déchet|dechet|infrastructure|assain/.test(text))return "infrastructure";
  if(/numéri|numeri|digital|tech/.test(text))return "digital";
  return "";
}

function districtById(id){return CITY_DISTRICTS.find(item=>item.id===id)||CITY_DISTRICTS[0]}

export function buildServiceLocations(services=[]){
  const used=new Map();
  return services.map((service,index)=>{
    const preferred=serviceKey(service);
    const spot=SERVICE_SPOTS.find(item=>item.key===preferred)||SERVICE_SPOTS[index%SERVICE_SPOTS.length];
    const duplicate=used.get(spot.key)||0;
    used.set(spot.key,duplicate+1);
    const offset=((duplicate%3)-1)*26;
    const district=districtById(spot.district);
    return {
      id:`service-${service.slug||service.id||index}`,
      kind:"service",
      slug:service.slug,
      serviceId:service.id,
      name:service.name||"Service municipal",
      category:service.category||"Service municipal",
      description:service.shortDescription||service.description||"Service physique de Nova Terra.",
      openingHours:service.openingHours||"Horaires disponibles dans la fiche service",
      address:`${spot.address} · ${district.name}`,
      district:district.name,
      phone:service.phone||"",
      email:service.email||"",
      icon:service.icon||"◇",
      x:spot.x+offset,
      y:spot.y+(duplicate>2?22:0),
      color:spot.color,
      source:service,
    };
  });
}

function mappedDistrict(seed){
  return CITY_DISTRICTS[hashText(seed)%CITY_DISTRICTS.length];
}

function offsetFromSeed(seed){
  const hash=hashText(seed);
  return [((hash%71)-35),(((Math.floor(hash/71))%61)-30)];
}

export function projectReport(report={}){
  const seed=`${report.reference||report.id||"report"}|${report.district||""}|${report.latitude||""}|${report.longitude||""}`;
  const district=mappedDistrict(seed);
  const [dx,dy]=offsetFromSeed(seed);
  const status=report.statusCode||report.status||"submitted";
  return {
    id:`report-${report.reference||report.id}`,
    kind:"report",
    reference:report.reference||report.id,
    name:report.title||"Signalement citoyen",
    category:report.category||report.reportType||"Signalement",
    description:report.description||"Signalement transmis à la ville.",
    district:district.name,
    address:`${district.name} · position déclarée`,
    x:district.center[0]+dx,
    y:district.center[1]+dy,
    color:status==="action_required"?"#e97b16":status==="in_progress"?"#6b18df":"#d63d55",
    icon:"!",
    status,
    statusLabel:report.status||report.status_label||"Signalement",
    source:report,
  };
}

export function projectAlert(alert={}){
  const seed=`${alert.slug||alert.id||alert.title||"alert"}|${(alert.target_districts||[]).join("|")}`;
  const district=mappedDistrict(seed);
  const severity=alert.severity||"warning";
  const radius=severity==="critical"?92:severity==="warning"?72:58;
  return {
    id:`alert-${alert.slug||alert.id}`,
    kind:"alert",
    slug:alert.slug,
    name:alert.title||"Alerte municipale",
    category:severity==="critical"?"Alerte critique":severity==="warning"?"Avertissement":"Information",
    description:alert.excerpt||alert.instructions||alert.content||"Information importante de Nova Terra.",
    district:district.name,
    address:`${district.name} · zone municipale`,
    x:district.center[0],
    y:district.center[1],
    radius,
    color:severity==="critical"?"#c92f45":severity==="warning"?"#ed8b1f":"#3978d8",
    icon:"!",
    severity,
    source:alert,
  };
}
