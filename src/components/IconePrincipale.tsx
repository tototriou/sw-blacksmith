import { Heart, Shield, Swords } from 'lucide-react';

// L'icône de la stat principale d'un artéfact : ♥ PV, ⚔ ATQ, 🛡 DEF — le
// Top 10 par propriété et les objectifs d'artéfacts.
//
// ⚠️ **En COULEUR**, comme les outils de référence du jeu : sur des rangs
// serrés, c'est la teinte qu'on repère d'un coup d'œil, pas la forme. Le cœur
// rouge et le bouclier bleu reprennent les tokens du Feu et de l'Eau (deux
// valeurs par thème, déjà mesurées), les épées restent à l'encre.
export const ICONE_PRINCIPALE: Record<number, { Icone: typeof Heart; couleur: string }> = {
  100: { Icone: Heart, couleur: 'text-fire' },
  101: { Icone: Swords, couleur: 'text-ink' },
  102: { Icone: Shield, couleur: 'text-water' },
};
