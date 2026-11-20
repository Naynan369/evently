"use client";

import Image from "next/image";
import { useApp } from "./AppProvider";
import styles from "@/styles/TranslationNotice.module.css";

export default function TranslationNotice() {
  const { googleTranslated } = useApp();
  if (!googleTranslated) return null;

  return (
    <aside className={styles.notice} lang="it" aria-label="Google Translate">
      <a
        href="https://translate.google.com/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Google Translate"
      >
        <Image
          src="/images/google-translate-attribution.png"
          width={176}
          height={16}
          alt="powered by Google Translate"
        />
      </a>
      <details className={styles.details}>
        <summary aria-label="Informazioni sulla traduzione">i</summary>
        <p lang="en">
          THIS SERVICE MAY CONTAIN TRANSLATIONS POWERED BY GOOGLE. GOOGLE
          DISCLAIMS ALL WARRANTIES RELATED TO THE TRANSLATIONS, EXPRESS OR
          IMPLIED, INCLUDING ANY WARRANTIES OF ACCURACY, RELIABILITY, AND ANY
          IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE AND NONINFRINGEMENT.
        </p>
      </details>
    </aside>
  );
}
