import { ca } from "./ca";
import { en } from "./en";
import { es } from "./es";
import { eu } from "./eu";
import { gl } from "./gl";
import type { Locale } from "./locales";
import type { Messages } from "./types";

export const messages: Record<Locale, Messages> = { es, en, eu, ca, gl };
