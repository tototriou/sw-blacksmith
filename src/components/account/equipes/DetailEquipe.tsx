import { useEffect, useState, type ReactNode } from 'react';
import { Crown, Plus, RefreshCw, X } from 'lucide-react';
import type { Monster } from '../../../types';
import type { BoxItem } from '../../../lib/applyAccount';
import { Bouton, BoutonIcone, Champ, Selecteur } from '../../../ui';
import MonsterAvatar from '../../MonsterAvatar';
import MonsterGear from '../../MonsterGear';
import { CarteRune } from '../RunesList';
import { useMediaQuery, SOUS_LG } from '../../../hooks/useMediaQuery';
import { useTraduction } from '../../../hooks/useLangue';
import {
  MONSTRES_MAX_EQUIPE, MONSTRES_MIN_EQUIPE, deplacerMonstre, designerLeader, etatExemplaire, etatsEquipement, modifierTextes,
  memeEquipement, remplacerEquipement, retirerMonstre,
  type EquipeEnregistree, type EtatPiece, type InventaireCompte, type MonstreEnregistre,
} from '../../../lib/equipesEnregistrees';

interface Props {
  equipe: EquipeEnregistree;
  // Pas encore enregistrée : moins de deux monstres (« Nouvelle équipe »).
  brouillon?: boolean;
  onChanger: (f: (e: EquipeEnregistree, maintenant: Date) => EquipeEnregistree) => void;
  monstreDe: (com2usId: number) => Monster | undefined;
  box: readonly BoxItem[];
  // `null` sans compte : l'équipement s'affiche tel qu'enregistré.
  inventaire: InventaireCompte | null;
  onAjouter: () => void;
  // L'en-tête de la page : le retour à la grille et le menu de l'équipe
  // (`null` pour un brouillon), sur la ligne du nom et de la note au bureau.
  retour: ReactNode;
  menu: ReactNode;
}

// Un champ texte de l'équipe : saisi librement, enregistré (trimé) à la sortie.
function ChampTexte({ libelle, valeur, onValider }: { libelle: string; valeur: string; onValider: (v: string) => void }) {
  const [brouillon, setBrouillon] = useState(valeur);
  useEffect(() => setBrouillon(valeur), [valeur]);
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-dim">
      {libelle}
      <Champ value={brouillon} onChange={(ev) => setBrouillon(ev.target.value)}
        onBlur={() => { onValider(brouillon); setBrouillon((b) => b.trim()); }} />
    </label>
  );
}

// Le détail d'une équipe, dans la page à la place de la grille : son nom, sa
// note et une ligne par monstre. Le même contenu aux deux formats.
export default function DetailEquipe({ equipe, brouillon = false, onChanger, monstreDe, box, inventaire, onAjouter, retour, menu }: Props) {
  const t = useTraduction();
  const d = t.equipes.detail;
  const plein = equipe.monstres.length >= MONSTRES_MAX_EQUIPE;
  // Enregistrée, une équipe garde deux monstres : le retrait du deuxième est refusé.
  const retirable = brouillon || equipe.monstres.length > MONSTRES_MIN_EQUIPE;
  // Téléphone : la roue de runes, plus compacte en hauteur que six cartes ;
  // ordinateur : les cartes, à droite de la relique. Lu une fois pour toutes
  // les fiches.
  const telephone = useMediaQuery(SOUS_LG);
  // Une grille, pas une colonne flex : dans le panneau du téléphone, une
  // colonne flex aligne ses enfants à gauche (index.css, `[data-tiroir]`) et
  // les fiches se rétrécissaient sur leur contenu.
  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Le nom de l'équipe n'est écrit que dans son champ. Bureau : retour,
          nom, note et menu sur une ligne. Téléphone : retour et menu, puis
          les deux champs dessous. */}
      <div className="flex flex-wrap items-end gap-3">
        {retour}
        <div className="ml-auto lg:order-last lg:ml-0">{menu}</div>
        <div className="grid basis-full grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-0 lg:flex-1 lg:basis-0">
          <ChampTexte libelle={d.nom} valeur={equipe.nom} onValider={(nom) => onChanger((e, n) => modifierTextes(e, { nom }, n))} />
          <ChampTexte libelle={d.note} valeur={equipe.note} onValider={(note) => onChanger((e, n) => modifierTextes(e, { note }, n))} />
        </div>
      </div>
      {brouillon && <p role="status" className="text-xs text-ink-dim">{d.brouillon}</p>}
      {!inventaire && equipe.monstres.length > 0 && <p className="text-xs text-ink-dim">{d.sansCompte}</p>}
      {equipe.monstres.map((m, i) => (
        <FicheMonstre key={m.uid} m={m} position={i} total={equipe.monstres.length} leader={equipe.leader === m.uid} retirable={retirable}
          monstre={monstreDe(m.com2usId)} box={box} inventaire={inventaire} onChanger={onChanger} telephone={telephone} />
      ))}
      <div>
        <Bouton trait="pointille" icone={<Plus size={14} />} libelle={d.ajouter} disabled={plein}
          title={plein ? d.complet : undefined} onClick={onAjouter} />
      </div>
    </div>
  );
}

function FicheMonstre({ m, position, total, leader, retirable, monstre, box, inventaire, onChanger, telephone }: {
  m: MonstreEnregistre; position: number; total: number; leader: boolean; retirable: boolean; monstre: Monster | undefined;
  box: readonly BoxItem[]; inventaire: InventaireCompte | null;
  onChanger: Props['onChanger']; telephone: boolean;
}) {
  const t = useTraduction();
  const d = t.equipes.detail;
  const nom = monstre?.name ?? String(m.com2usId);
  const exemplaire = inventaire ? etatExemplaire(m, box) : null;
  const actuel = m.unitId === null ? undefined : box.find((b) => b.key === String(m.unitId) && b.monster.com2usId === m.com2usId);
  const ecarts: string[] = [];
  if (inventaire && m.equipement) {
    const etats = etatsEquipement(m.equipement, inventaire);
    const dire = (libelle: string, etat: EtatPiece) => { if (etat !== 'identique') ecarts.push(`${libelle} : ${d.etats[etat]}`); };
    m.equipement.runes.forEach((r, k) => dire(d.rune(r.slot), etats.runes[k]));
    m.equipement.artifacts.forEach((_a, k) => dire(d.artefact(k + 1), etats.artefacts[k]));
    if (etats.relique) dire(d.relique, etats.relique);
  }
  return (
    // Une ligne par monstre : l'identité et ses réglages à gauche, puis la
    // fiche de stats, les artéfacts, les runes et la relique. Trop étroite
    // (téléphone, volet), l'identité passe au-dessus de l'équipement.
    <section className="@container rounded-lg border border-border-soft bg-panel2/40 p-3" aria-label={nom}>
      <div className="flex flex-col gap-3 @4xl:flex-row @4xl:items-center">
        {/* Identité au-dessus de l'équipement (fiche étroite) : les réglages
            passent sous le nom tant qu'ils le tronqueraient, sinon ils se
            glissent entre le nom et la croix. Fiche sur une ligne : une
            colonne à la largeur de son contenu (au plus 224 px), le nom
            suivi de la croix, puis « Leader » et la position l'un sous
            l'autre ; la place va à l'équipement et aux runes. */}
        <div className="min-w-0 @4xl:w-max @4xl:max-w-56 @4xl:flex-none">
          <div className="flex flex-wrap items-center gap-2 @4xl:grid @4xl:grid-cols-[auto_minmax(0,max-content)_auto]">
            <MonsterAvatar monster={monstre ?? null} fallback={nom} size={40} couronne={leader} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{nom}</p>
              <p className="truncate text-xs text-ink-dim">
                {d.provenance[m.provenance]}{exemplaire ? ` · ${d.exemplaire[exemplaire]}` : ''}
              </p>
            </div>
            <div className="order-1 flex basis-full items-center gap-2 @lg:order-none @lg:basis-auto @4xl:order-1 @4xl:col-span-3 @4xl:flex-col @4xl:items-start">
              <Bouton taille="sm" actif={leader} icone={<Crown size={14} />} libelle={leader ? d.leader : d.designerLeader}
                title={leader ? d.retirerLeader : d.designerLeader}
                onClick={() => onChanger((e, n) => designerLeader(e, leader ? null : m.uid, n))} />
              <Selecteur taille="sm" pleineLargeur={false} surface="panel" aria-label={d.position} value={String(position)}
                onChange={(ev) => onChanger((e, n) => deplacerMonstre(e, m.uid, Number(ev.target.value), n))}>
                {Array.from({ length: total }, (_, k) => <option key={k} value={k}>{d.positionN(k + 1)}</option>)}
              </Selecteur>
            </div>
            {/* Désactivé, son infobulle dit pourquoi. */}
            <BoutonIcone libelle={retirable ? d.retirer(nom) : d.minimum} icone={<X size={14} />} disabled={!retirable}
              onClick={() => onChanger((e, n) => retirerMonstre(e, m.uid, n))} />
          </div>
          {/* Seulement quand l'exemplaire, connu et dans la Box, porte autre
              chose que la copie : sinon le geste ne changerait rien. */}
          {actuel?.gear && !(m.equipement && memeEquipement(m.equipement, actuel.gear)) && (
            <div className="mt-2">
              <Bouton taille="sm" icone={<RefreshCw size={14} />} libelle={d.reprendre} title={d.reprendreAide}
                onClick={() => onChanger((e, n) => remplacerEquipement(e, m.uid, actuel.gear!, 'porte', n))} />
            </div>
          )}
          {/* `w-0 min-w-full` : le texte suit la largeur de la colonne sans la
              dicter. */}
          {ecarts.length > 0 && <p className="mt-2 w-0 min-w-full text-xs text-warn">{ecarts.join(' · ')}</p>}
        </div>
        {m.equipement && (
          // Ordinateur : l'équipement sans la roue, puis ses runes en cartes,
          // à droite de la relique. Téléphone : la roue, sans les cartes.
          // Les runes passent dessous seulement quand la place de deux
          // cartes (2 × 215 + 8) manque ; sinon leur bande défile de côté,
          // sans jamais pousser la ligne au-delà de la fiche.
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <div className="min-w-0 max-w-full flex-none overflow-x-auto">
              <MonsterGear gear={m.equipement} sansRoue={!telephone} />
            </div>
            {!telephone && m.equipement.runes.length > 0 && (
              <div className="flex min-w-0 flex-1 basis-[438px] items-start gap-2 overflow-x-auto" role="list" aria-label={d.runes}>
                {[...m.equipement.runes].sort((a, b) => a.slot - b.slot).map((r) => (
                  <div key={r.id} role="listitem" className="grid w-[215px] flex-none">
                    <CarteRune rune={r} etroit={false} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
