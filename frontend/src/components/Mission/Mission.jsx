import { motion, useReducedMotion } from "framer-motion";
import "./Mission.css";

const EASE = [0.16, 1, 0.3, 1];

const items = [
  {
    index: "01",
    title: "Accéder",
    text: "Retrouvez plus simplement les informations et services utiles de Terra Nova.",
  },
  {
    index: "02",
    title: "Communiquer",
    text: "Exprimez un besoin, transmettez une information ou signalez un problème à la ville.",
  },
  {
    index: "03",
    title: "Évoluer",
    text: "La plateforme est pensée pour accueillir de nouveaux services à mesure que les besoins apparaissent.",
  },
];

export default function Mission() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="terra-mission" id="mission" aria-labelledby="mission-title">
      <div className="terra-mission__head">
        <span className="terra-mission__kicker">Notre mission</span>
        <h2 id="mission-title">Faire grandir Terra Nova <span>avec ses habitants.</span></h2>
        <p>Terra Nova grandit : son espace numérique doit accompagner les nouveaux besoins de ses habitants.</p>
      </div>

      <div className="terra-mission__grid">
        {items.map((item, index) => (
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
