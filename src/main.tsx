// ⚠️ EN PREMIER : renomme les clés de stockage de l'ancien nom (SW Forge)
// avant que le moindre module de l'app ne les lise (voir le module).
import './lib/migrationStockage';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import './index.css';
import { surveillerDebordement } from './lib/detecteurDebordement';
import { habillerBureau, sessionBureau } from './lib/bureau';
import { lireSession } from './lib/session';
import { appliquerSession } from './lib/chargementSession';

// ⚠️ En DÉVELOPPEMENT seulement (le module s'arrête de lui-même en production).
// `overflow-x: hidden` masque les débordements ; ce détecteur les NOMME, sinon
// on cherche à la main un coupable qui se manifeste sur une autre page que la
// sienne.
surveillerDebordement();

// ⚠️ **Une session chargée s'applique AVANT l'import de l'app** (application
// de bureau, « Charger… » : voir src/lib/chargementSession.ts). Des réglages
// se lisent au chargement de leur module (thème, langue, mesure…) : l'app
// n'est donc importée qu'ensuite. Les imports ci-dessus n'en entraînent
// aucun. Sur le site, `sessionBureau()` est nul : l'app s'importe aussitôt.
async function demarrer() {
  const aCharger = await sessionBureau()?.aCharger().catch(() => null);
  if (aCharger) {
    const lecture = lireSession(aCharger.texte);
    if (lecture.ok) await appliquerSession(lecture.session, aCharger.nom, lecture.avertissements);
  }

  // Dans l'application de bureau seulement : barre de la fenêtre et couleurs
  // du thème (src/lib/bureau.ts) — après la session, qui peut en changer le
  // thème. Sur le site, ne fait rien.
  habillerBureau();

  const { default: App } = await import('./App');
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      {/* ⚠️ `reducedMotion="user"` : Framer Motion ne respecte PAS
          `prefers-reduced-motion` par défaut. Sans cette ligne, chaque animation
          aurait dû le gérer une par une — et la première oubliée serait passée
          inaperçue, puisqu'on ne développe presque jamais avec le réglage activé.
          Posé ici, il vaut pour toute l'app.
          « user » et non « always » : ce sont les transformations (déplacement,
          échelle) qui sont neutralisées, pas les fondus d'opacité — un élément
          doit toujours pouvoir apparaître. */}
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </React.StrictMode>
  );
}
void demarrer();
