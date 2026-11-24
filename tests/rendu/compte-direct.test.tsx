// Tests de rendu — le direct de l'application de bureau : l'interrupteur
// « Direct » dans les vues de « Mon compte », et la carte du plugin de la page
// SW Exporter (état, téléchargement de la dernière version, « Mettre à jour
// mon compte »). Principe dans tests/rendu/outils-rendu.tsx.

import AccountPage from '../../src/pages/AccountPage';
import InterrupteurDirect from '../../src/components/account/InterrupteurDirect';
import { CartePlugin, lignePlugin } from '../../src/pages/SwExporterPage';
import SwExporterPage from '../../src/pages/SwExporterPage';
import { DirectSwexContext, type DirectSwex } from '../../src/hooks/useCompteDirect';
import type { AccountView } from '../../src/App';
import type { EtatDirectSwex } from '../../src/lib/bureau';
import { CHEMIN_PLUGIN_SWEX, FICHIER_PLUGIN_SWEX } from '../../src/lib/pluginSwex';
import { runesUtiliseesVides } from '../../src/lib/importAccount';
import { fr } from '../../src/i18n/fr';
import { en } from '../../src/i18n/en';
import { annoncePlugin, clePlugin } from '../../src/components/MiseAJourPlugin';
import type { Monster } from '../../src/types';
import { egal, faussLocalStorage, monstersJson, ok, titre } from '../outils';
import { ARTEFACTS, BOX } from './compte.test';
import { RUNES } from './runes.test';
import { rendre, texteVisible } from './outils-rendu';

const etat = (e: Partial<EtatDirectSwex> = {}, plugin: Partial<EtatDirectSwex['plugin']> = {}): EtatDirectSwex => ({
  actif: false,
  disponible: true,
  maj: Date.UTC(2026, 10, 18, 13, 32),
  ...e,
  plugin: { installee: '2.4.4', app: '2.4.4', statut: 'a-jour', ...plugin },
});
const direct = (e: EtatDirectSwex | null): DirectSwex => ({
  etat: e,
  activer: () => {},
  relire: () => {},
  mettreAJour: async () => ({ ok: true, nom: null }),
});

const VUES: ['monstres' | 'runes' | 'artefacts', AccountView][] = [
  ['monstres', 'resume'],
  ['runes', 'resume'],
  ['runes', 'liste'],
  ['runes', 'courbes'],
  ['runes', 'comparaison'],
  ['runes', 'optimisation'],
  ['artefacts', 'resume'],
  ['artefacts', 'liste'],
];

function rendreAvec(valeur: DirectSwex | null, sub: 'monstres' | 'runes' | 'artefacts', vue: AccountView) {
  faussLocalStorage({});
  return rendre(
    <DirectSwexContext.Provider value={valeur}>
      <AccountPage
        sub={sub}
        vue={vue}
        box={BOX}
        runes={RUNES}
        artifacts={ARTEFACTS}
        crafts={[]}
        usedRuneIds={runesUtiliseesVides()}
        runeMarkerLabels={{}}
        loadState="live"
        hydrating={false}
        allMonsters={monstersJson() as Monster[]}
        menuOuvert={false}
        onFermerMenu={() => {}}
      />
    </DirectSwexContext.Provider>
  );
}

const interrupteurs = (html: string) => [...html.matchAll(/<button\b[^>]*data-interrupteur-direct[^>]*>([\s\S]*?)<\/button>/g)];

export function testRenduCompteDirect() {
  titre('rendu · direct — l’interrupteur « Direct » dans chaque vue de « Mon compte »');
  for (const [sub, vue] of VUES) {
    const html = rendreAvec(direct(etat()), sub, vue);
    ok(interrupteurs(html).length >= 1, `${sub} › ${vue} : l’interrupteur est parmi les filtres`);
    egal(rendreAvec(null, sub, vue).includes('data-interrupteur-direct'), false, `${sub} › ${vue} : sur le site, aucun`);
  }

  titre('rendu · direct — ce que dit l’interrupteur');
  const rendu = (e: EtatDirectSwex | null) => rendre(<DirectSwexContext.Provider value={direct(e)}><InterrupteurDirect /></DirectSwexContext.Provider>);
  egal(rendu(null), '', 'pas d’état (site) : rien');
  egal(rendu(etat({ disponible: false }, { installee: null, statut: 'absent' })), '', 'ni plugin, ni session, ni direct activé : rien');
  const coupe = rendu(etat());
  ok(texteVisible(coupe) === 'Direct' && /aria-pressed="false"/.test(coupe), 'coupé par défaut : « Direct », non pressé');
  ok(coupe.includes(`title="${fr.direct.activer}"`), 'coupé, session en cours : propose de suivre la partie');
  const actif = rendu(etat({ actif: true }));
  ok(/aria-pressed="true"/.test(actif) && texteVisible(actif) === 'Direct', 'activé : pressé, le même libellé (rien ne bouge)');
  ok(/title="En direct · dernière action à \d\d:\d\d · cliquer pour couper"/.test(actif), 'activé : l’heure de la dernière action, dans l’infobulle');
  ok(rendu(etat({ actif: true, disponible: false })).includes(`title="${fr.direct.actifSansSession}"`), 'activé sans session : il attend la prochaine');
  ok(rendu(etat({ disponible: false })).includes('aria-pressed="false"'), 'plugin installé sans session : activable quand même');

  titre('rendu · direct — la carte du plugin (page SW Exporter, application de bureau)');
  const s = fr.swExporter;
  const carte = (e: EtatDirectSwex, suivi = true, resultat: string | null = null) =>
    rendre(<CartePlugin etat={e} suivi={suivi} heure={() => '14:32'} enCours={false} resultat={resultat} onMettreAJour={() => {}} />);
  ok(texteVisible(carte(etat(), false)) === s.sansDossier, 'aucun dossier suivi : il faut le choisir dans Paramètres');
  const ancien = carte(etat({}, { installee: '2.4.2', statut: 'ancien' }));
  const ta = texteVisible(ancien);
  ok(ta.includes('Installé · version 2.4.2 · la version 2.4.4 est disponible'), 'plugin ancien : la version installée et celle disponible');
  const lien = /<a\b[^>]*href="([^"]*)"[^>]*download="([^"]*)"[^>]*>[\s\S]*?Télécharger la dernière version/.exec(ancien);
  egal([lien?.[1], lien?.[2]], [`/${CHEMIN_PLUGIN_SWEX}`, FICHIER_PLUGIN_SWEX], 'plugin ancien : « Télécharger la dernière version », enregistré sous son nom');
  ok(ta.includes('Session en direct · dernière action à 14:32'), 'la session en direct et sa dernière action');
  ok(/<button\b[^>]*data-mettre-a-jour[^>]*>/.test(ancien) && !/<button\b[^>]*\sdisabled=""[^>]*data-mettre-a-jour/.test(ancien), '« Mettre à jour mon compte » : actif avec une session');
  const aJour = carte(etat({ disponible: false, maj: null }));
  ok(texteVisible(aJour).includes('Installé · version 2.4.4 · à jour') && !aJour.includes('Télécharger la dernière version'), 'à jour : pas de téléchargement proposé');
  ok(texteVisible(aJour).includes(s.sansSession), 'sans session : dit comment en avoir une');
  ok(/<button\b[^>]*\sdisabled=""[^>]*data-mettre-a-jour/.test(aJour), 'sans session : « Mettre à jour mon compte » désactivé');
  ok(texteVisible(carte(etat(), true, 'Compte mis à jour à 14:35.')).includes('Compte mis à jour à 14:35.'), 'le résultat s’écrit sous le bouton, sans notification');
  egal(lignePlugin(etat({}, { installee: null, statut: 'absent' }), s), s.pluginAbsent, 'absent : pas trouvé dans plugins');
  egal(lignePlugin(etat({}, { installee: '2.5.0', statut: 'plus-recent' }), s), "Installé · version 2.5.0, plus récente que l'application", 'plus récent que l’app : dit tel quel');

  titre('rendu · direct — la notification d’un plugin à remplacer (application de bureau)');
  const ouvrir = () => {};
  egal(annoncePlugin(null, fr, ouvrir), null, 'sur le site : rien');
  for (const statut of ['a-jour', 'plus-recent', 'absent'] as const)
    egal(annoncePlugin(etat({}, { statut }), fr, ouvrir), null, `${statut} : rien`);
  egal(
    annoncePlugin(etat({}, { installee: '2.5.1', app: '2.6.0', statut: 'ancien' }), fr, ouvrir),
    { message: s.notifPluginAncien, action: ouvrir, libelleAction: s.notifPluginAction, persistante: true },
    'ancien : une question, persistante, qui ouvre la page SW Exporter'
  );
  egal(annoncePlugin(etat({}, { statut: 'ancien' }), en, ouvrir)?.message, 'New SW Blacksmith Live plugin version available', 'en anglais');
  egal(
    [clePlugin(null), clePlugin(etat()), clePlugin(etat({}, { installee: '2.5.1', app: '2.6.0', statut: 'ancien' }))],
    [null, null, '2.5.1>2.6.0'],
    'ce qui a été notifié : le plugin installé face à l’app, seulement s’il est ancien'
  );

  titre('rendu · direct — le tuto d’utilisation (site et application)');
  const page = texteVisible(rendre(<SwExporterPage />));
  const etapes = ['Utiliser le plugin', ...s.utilisation.map((u) => u.titre)];
  const positions = etapes.map((x) => page.indexOf(x));
  ok(positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1])), 'le tuto d’utilisation, après l’installation, dans l’ordre');
  ok(page.includes("Rien n'est écrit dans le dossier de SW Exporter"), 'le dossier de SWEX n’est jamais modifié : c’est dit');
  ok(page.includes('Les favoris et préréglages de la RTA'), 'ce que le plugin ne suit pas encore : dit');
}
