"use client";

import { motion } from "framer-motion";

// Material-study visuals, generated in CSS — no stock imagery.
const PROJECTS = [
  {
    cls: "work--a",
    name: "Residence Aalto",
    tag: "Private house · 2025",
    bg: "radial-gradient(120% 90% at 20% 10%, #d8c9b2 0%, #b09a7c 42%, #6e5843 100%)",
  },
  {
    cls: "work--b",
    name: "Maison Lumière",
    tag: "Apartment · 2025",
    bg: "linear-gradient(160deg, #e8ddca 0%, #cbb89b 48%, #8e7455 100%)",
  },
  {
    cls: "work--c",
    name: "Atelier North",
    tag: "Studio · 2024",
    bg: "linear-gradient(200deg, #b9b3a6 0%, #868072 55%, #4c463b 100%)",
  },
  {
    cls: "work--d",
    name: "Casa Terra",
    tag: "Villa · 2024",
    bg: "radial-gradient(110% 110% at 80% 20%, #d9b79a 0%, #a97e5d 50%, #5f4330 100%)",
  },
  {
    cls: "work--e",
    name: "The Quiet Room",
    tag: "Hospitality · 2023",
    bg: "linear-gradient(145deg, #efe6d3 0%, #d3c2a4 40%, #7d6a50 100%)",
  },
];

const reveal = {
  hidden: { opacity: 0, y: 60 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 1.1, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function Works() {
  return (
    <>
      <section className="works">
        <div className="works__head">
          <motion.h2
            className="works__title"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15%" }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          >
            Built from
            <br />
            <em>imagination</em>
          </motion.h2>
          <span className="works__index">Selected works — 2023 / 2026</span>
        </div>

        <div className="works__grid">
          {PROJECTS.map((p, i) => (
            <motion.article
              key={p.name}
              className={`work ${p.cls}`}
              variants={reveal}
              initial="hidden"
              whileInView="show"
              custom={i}
              viewport={{ once: true, margin: "-10%" }}
            >
              <div className="work__visual" style={{ background: p.bg }} />
              <div className="work__scrim" />
              <div className="work__meta">
                <span className="work__name">{p.name}</span>
                <span className="work__tag">{p.tag}</span>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="statement">
        <span className="statement__mark">The studio</span>
        <motion.p
          className="statement__text"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        >
          We begin where nothing exists. A line, a wall, a shaft of light —
          <em> Studio</em> shapes interiors the way architects dream them:
          <em> slowly, precisely, inevitably.</em>
        </motion.p>
      </section>

      <footer className="footer">
        <div className="footer__logo">Studio</div>
        <div className="footer__row">
          <span>Interior architecture studio</span>
          <span>Est. 2023</span>
          <span>© {new Date().getFullYear()} Studio</span>
        </div>
      </footer>
    </>
  );
}
