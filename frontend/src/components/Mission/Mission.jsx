import { motion, useReducedMotion } from "framer-motion";
import { useLocale } from "../../utils/i18n.js";
import { useDataMode } from "../../utils/useDataMode.js";
import "./Mission.css";

const EASE = [0.16, 1, 0.3, 1];

const COPY = {
  fr: {
    kicker:"Notre mission",
    title:<>Faire grandir Nova Terra <span>avec ses habitants.</span></>,
    intro:"Nova Terra grandit : son espace numérique doit accompagner les nouveaux besoins de ses habitants.",
    items:[
      {index:"01",title:"Accéder",text:"Retrouvez plus simplement les informations et services utiles de Nova Terra."},
      {index:"02",title:"Communiquer",text:"Exprimez un besoin, transmettez une information ou signalez un problème à la ville."},
      {index:"03",title:"Évoluer",text:"La plateforme est pensée pour accueillir de nouveaux services à mesure que les besoins apparaissent."},
    ],
  },
  en: {
    kicker:"Our mission",
    title:<>Grow Nova Terra <span>with its residents.</span></>,
    intro:"As Nova Terra grows, its digital space must keep up with residents’ new needs.",
    items:[
      {index:"01",title:"Access",text:"Find useful Nova Terra information and services more easily."},
      {index:"02",title:"Communicate",text:"Ask for help, share information or report a city issue."},
      {index:"03",title:"Evolve",text:"The platform is designed to welcome new services as new needs appear."},
    ],
  },
  mg: {
    kicker:"Ny iraka ataonay",
    title:<>Hampivoatra an'i Nova Terra <span>miaraka amin'ny mponina.</span></>,
    intro:"Rehefa mivoatra i Nova Terra dia tsy maintsy manaraka ny filàn'ny mponina koa ny habaka nomerika.",
    items:[
      {index:"01",title:"Miditra",text:"Tadiavo mora kokoa ny vaovao sy ny sampan-draharaha ilaina ao Nova Terra."},
      {index:"02",title:"Mifandray",text:"Ampitao ny filànao, zarao ny vaovao na mitatitra olana amin'ny tanàna."},
      {index:"03",title:"Mivoatra",text:"Natao handray sampan-draharaha vaovao ny sehatra rehefa miseho ny filàna vaovao."},
    ],
  },
};

export default function Mission() {
  const systemReduceMotion = useReducedMotion();
  const dataProfile = useDataMode();
  const reduceMotion = systemReduceMotion || dataProfile.reduced;
  const [locale] = useLocale();
  const copy = COPY[locale] || COPY.fr;

  return (
    <section className="terra-mission" id="mission" aria-labelledby="mission-title">
      <div className="terra-mission__head">
        <span className="terra-mission__kicker">{copy.kicker}</span>
        <h2 id="mission-title">{copy.title}</h2>
        <p>{copy.intro}</p>
      </div>

      <div className="terra-mission__grid">
        {copy.items.map((item, index) => (
          <motion.article
            key={item.index}
            className="terra-mission__card"
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.58, delay: reduceMotion ? 0 : index * 0.08, ease: EASE }}
          >
            <span className="terra-mission__index">{item.index}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
