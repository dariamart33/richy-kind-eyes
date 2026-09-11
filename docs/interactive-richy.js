import { mountRichyMotion } from "./richy-motion.js";
import { mountRichyLoom } from "./richy-loom.js";

const hero = document.querySelector(".interactive-richy-hero");
if (hero) mountRichyMotion(hero);

const loom = document.querySelector(".richy-loom");
if (loom) mountRichyLoom(loom);
