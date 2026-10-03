const CITY_SPOTS = [
  { key:"administration", position:[-4.6,-2.4], size:[2.8,2.5,2.4], color:"#4f7cff", district:"Centre civique" },
  { key:"health", position:[-4.0,2.7], size:[2.6,2.1,2.2], color:"#f45d91", district:"Quartier santé" },
  { key:"security", position:[0.0,3.6], size:[2.5,2.8,2.3], color:"#7657ff", district:"Place Orion" },
  { key:"transport", position:[4.4,2.6], size:[3.2,1.65,2.0], color:"#19aeea", district:"Pôle mobilité" },
  { key:"energy", position:[4.6,-2.3], size:[2.2,2.55,2.2], color:"#ffab32", district:"Secteur solaire" },
  { key:"habitat", position:[0.3,-4.0], size:[3.0,2.0,2.5], color:"#26b989", district:"Résidences Nova" },
  { key:"infrastructure", position:[-1.2,0.0], size:[2.6,1.8,2.2], color:"#2aa99f", district:"Ateliers municipaux" },
  { key:"digital", position:[2.2,0.2], size:[2.0,2.35,2.0], color:"#9255e9", district:"Hub numérique" },
];

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

export function buildServiceLocations(services=[]){
  const used=new Set();
  let fallbackIndex=0;

  return services.map((service,index)=>{
    const preferred=serviceKey(service);
    let spot=CITY_SPOTS.find(item=>item.key===preferred&&!used.has(item.key));

    if(!spot){
      while(fallbackIndex<CITY_SPOTS.length&&used.has(CITY_SPOTS[fallbackIndex].key))fallbackIndex+=1;
      spot=CITY_SPOTS[fallbackIndex%CITY_SPOTS.length];
      fallbackIndex+=1;
    }

    used.add(spot.key);

    return {
      id:service.slug||String(service.id||index),
      slug:service.slug,
      serviceId:service.id,
      name:service.name||"Service municipal",
      category:service.category||"Service",
      description:service.shortDescription||service.description||"",
      openingHours:service.openingHours||"",
      address:service.address||spot.district,
      phone:service.phone||"",
      email:service.email||"",
      icon:service.icon||"◇",
      position:[spot.position[0],0,spot.position[1]],
      size:[...spot.size],
      color:spot.color,
      district:spot.district,
      source:service,
    };
  });
}
