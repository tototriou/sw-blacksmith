// Tests de rendu — la page « SW Exporter » (`#/sw-exporter`) : le plugin SWEX
// « SW Blacksmith Live ». Principe dans tests/rendu/outils-rendu.tsx : ce que
// la page dit et permet, jamais l'apparence.

import SwExporterPage from '../../src/pages/SwExporterPage';
import { CHEMIN_PLUGIN_SWEX, FICHIER_PLUGIN_SWEX, SW_EXPORTER } from '../../src/lib/pluginSwex';
import { egal, ok, titre } from '../outils';
import { rendre, texteVisible } from './outils-rendu';

function ancres(html: string) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attrs, contenu]) => ({
    href: attrs.match(/\shref="([^"]*)"/)?.[1] ?? '',
    telechargement: attrs.match(/\sdownload="([^"]*)"/)?.[1] ?? null,
    texte: texteVisible(contenu),
    nouvelOnglet: /\starget="_blank"/.test(attrs),
  }));
}

export function testRenduSwExporter() {
  titre('rendu · SW Exporter — ce que la page dit et permet');
  const html = rendre(<SwExporterPage />);
  const t = texteVisible(html);
  const a = ancres(html);

  ok(t.startsWith('SW Exporter'), 'titre « SW Exporter »');
  ok(t.includes("c'est ce fichier que SW Blacksmith importe"), 'l’introduction : ce qu’est SWEX');
  for (const s of ['Ton compte en direct', 'Tes combats de guilde', 'Rien ne quitte ta machine']) ok(t.includes(s), `ce que fait le plugin : « ${s} »`);
  ok(t.includes("n'écrit jamais ta clé de session"), 'la clé de session n’est jamais écrite : c’est dit');

  // Le téléchargement : le FICHIER, enregistré sous son nom (un `.js` s'ouvrirait).
  const bouton = a.find((x) => x.texte === 'Télécharger le plugin');
  egal(bouton?.href, `/${CHEMIN_PLUGIN_SWEX}`, '« Télécharger le plugin » → le fichier émis par la construction');
  egal(bouton?.telechargement, FICHIER_PLUGIN_SWEX, 'le fichier est ENREGISTRÉ, pas ouvert');
  ok(t.includes('SWBlacksmithLive.js · version test'), 'le nom du fichier et la version (celle de l’app)');
  ok(t.includes('À installer depuis un ordinateur, à côté de SW Exporter.'), 'au téléphone : la ligne à la place du bouton');

  // Sur le site : il sert avec l'application de bureau, et le lien y mène.
  ok(t.includes("Il sert avec l'application de bureau"), 'site : il faut l’application de bureau');
  ok(a.some((x) => x.href === '#/telecharger' && !x.nouvelOnglet), 'site : lien vers Télécharger, dans la page');

  // Le tuto, dans l'ordre, et SWEX lui-même dans un nouvel onglet.
  const etapes = ['Installe SW Exporter', 'Télécharge le plugin', 'Dépose-le dans le dossier plugins', 'Redémarre SW Exporter', 'Suis le dossier dans l’application'];
  const positions = etapes.map((e) => t.indexOf(e));
  ok(positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1])), 'les cinq étapes, dans l’ordre');
  ok(t.includes('Laisse son plugin ProfileExport activé'), 'ProfileExport doit rester activé');
  ok(t.includes('Paramètres › Dossier SW Exporter'), 'où choisir le dossier dans l’app');
  ok(a.some((x) => x.href === SW_EXPORTER && x.nouvelOnglet && x.texte === 'SW Exporter sur GitHub'), 'SW Exporter sur GitHub, nouvel onglet');

  for (const s of ['Mettre à jour le plugin', 'Ce qui attend la connexion suivante']) ok(t.includes(s), `« ${s} »`);
}

// Dans l'app de bureau : pas de renvoi vers « Télécharger », qui n'y existe pas.
export function testRenduSwExporterBureau() {
  titre('rendu · SW Exporter — dans l’app de bureau');
  const pont = globalThis as { swblacksmithBureau?: unknown };
  pont.swblacksmithBureau = { bureau: true, plateforme: 'win32' };
  try {
    const html = rendre(<SwExporterPage />);
    const t = texteVisible(html);
    ok(!t.includes("Il sert avec l'application de bureau"), 'bureau : la phrase du site n’y est pas');
    ok(!ancres(html).some((x) => x.href === '#/telecharger'), 'bureau : aucun lien vers Télécharger');
    ok(ancres(html).some((x) => x.texte === 'Télécharger le plugin'), 'bureau : le téléchargement reste');
  } finally {
    delete pont.swblacksmithBureau;
  }
}
