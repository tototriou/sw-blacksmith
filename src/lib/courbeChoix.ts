// La rune choisie sur une courbe de runes (CurveChart : « Mon compte » ›
// Runes › Courbes, et la comparaison), et comment elle se suit quand les
// courbes se recalculent.
//
// Le choix désigne un RANG du classement, lu sur toutes les courbes à la fois.
// ⚠️ Il retient aussi la RUNE qui occupait ce rang sur la courbe de référence :
// une rune montée, meulée ou gemmée (« Mon compte » en direct) change de score,
// donc de rang — un choix resté au rang passait à une AUTRE rune. Quand les
// courbes se recalculent, le choix suit sa rune à son nouveau rang ; une rune
// qui n'y est plus (filtrée, vendue) laisse le rang tel quel, jamais un point
// qui n'existe plus.

export interface ChoixCourbe {
  rang: number;
  runeId: number | null;
}

interface SerieCourbe {
  effs: number[];
  runes?: { id: number }[];
  own: boolean;
}

// La courbe dont la rune se suit : celle de SES runes (`own`, l'« Actuelle »),
// sinon la première qui porte des runes.
export function serieDeReference<S extends SerieCourbe>(series: S[]): S | null {
  const ouvrables = series.filter((s) => s.effs.length > 0 && s.runes?.length);
  return ouvrables.find((s) => s.own) ?? ouvrables[0] ?? null;
}

// Le choix du rang `rang`, avec la rune qui l'occupe.
export function choixAuRang(series: SerieCourbe[], rang: number): ChoixCourbe {
  return { rang, runeId: serieDeReference(series)?.runes?.[rang]?.id ?? null };
}

// Le choix après un recalcul des courbes : au nouveau rang de sa rune si elle y
// est encore, sinon inchangé. Rend LE MÊME objet s'il ne bouge pas (un état
// React qui ne change pas ne redessine rien).
export function suivreChoix(choix: ChoixCourbe | null, series: SerieCourbe[]): ChoixCourbe | null {
  if (!choix || choix.runeId == null) return choix;
  const i = serieDeReference(series)?.runes?.findIndex((r) => r.id === choix.runeId) ?? -1;
  return i >= 0 && i !== choix.rang ? { ...choix, rang: i } : choix;
}
