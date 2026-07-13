"use client";

import { motion } from "framer-motion";

export function Navbar() {
  return (
    <motion.nav
      className="nav"
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 1.1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="nav__logo">Studio</span>
      <div className="nav__right">
        <button className="nav__link" type="button">
          About
        </button>
        <button className="nav__link" type="button">
          Learn
        </button>
        <button className="nav__cta" type="button">
          Get the app
        </button>
      </div>
    </motion.nav>
  );
}
