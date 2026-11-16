// Le journal complet de SWEX (`full_log.txt`) : chaque échange avec le jeu,
// écrit à la suite sous la forme
//
//   API Command: <commande> - <date>
//   Request:
//   { …JSON de la requête… }
//   Response:
//   { …JSON de la réponse… }
//
// Il porte ce que l'export de compte ne contient pas — la box de l'arène
// dimensionnelle, envoyée par le jeu à l'ouverture de ce mode
// (`dimensionarena_getSeasonInfo`).
//
// ⚠️ **Le journal grossit à chaque partie** (8 Mo pour un quart d'heure de
// jeu) : on ne le découpe pas en échanges, on cherche la commande voulue en
// partant de la fin et on ne parse que sa réponse.

const ENTETE = 'API Command: ';

// La commande qui donne la box dimensionnelle : monstres (`unit_list`), runes
// en inventaire (`rune_list`), builds par défaut (`default_unit_list`),
// défense (`defense_deck_info`).
export const COMMANDE_SAISON_DIMENSION = 'dimensionarena_getSeasonInfo';

// Un texte est un journal SWEX s'il commence par un échange. Les blancs de
// tête sont tolérés, BOM compris : `trimStart` le retire.
export function estJournalSwex(texte: string): boolean {
  return texte.trimStart().startsWith(ENTETE);
}

// La réponse de la DERNIÈRE occurrence réussie (`ret_code` 0) de `commande`,
// ou null. Une réponse illisible (journal coupé en cours d'écriture) ou en
// échec fait remonter à l'occurrence précédente.
export function derniereReponse(texte: string, commande: string): Record<string, any> | null {
  const marque = `${ENTETE}${commande} - `;
  let debut = texte.lastIndexOf(marque);
  while (debut !== -1) {
    const fin = texte.indexOf(`\n${ENTETE}`, debut + marque.length);
    const echange = texte.slice(debut, fin === -1 ? undefined : fin);
    const reponse = echange.indexOf('Response:');
    const accolade = reponse === -1 ? -1 : echange.indexOf('{', reponse);
    if (accolade !== -1) {
      try {
        const r = JSON.parse(echange.slice(accolade));
        if (r && typeof r === 'object' && Number(r.ret_code) === 0) return r;
      } catch {
        /* réponse tronquée : l'occurrence précédente */
      }
    }
    debut = debut === 0 ? -1 : texte.lastIndexOf(marque, debut - 1);
  }
  return null;
}

// La saison de l'arène dimensionnelle : depuis un journal SWEX, ou depuis la
// seule réponse de `dimensionarena_getSeasonInfo` (objet ou texte JSON).
export function lireSaisonDimension(src: string | Record<string, any>): Record<string, any> | null {
  if (typeof src !== 'string') return src?.command === COMMANDE_SAISON_DIMENSION ? src : null;
  if (estJournalSwex(src)) return derniereReponse(src, COMMANDE_SAISON_DIMENSION);
  try {
    return lireSaisonDimension(JSON.parse(src));
  } catch {
    return null;
  }
}
