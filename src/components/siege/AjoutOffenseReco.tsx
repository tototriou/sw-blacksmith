// La fenêtre « Ajouter à une recommandation » d'une offense venue d'ailleurs
// (src/lib/ajoutOffenseReco.ts) :
//  - un combat gagné de Siège › Statistiques : l'offense devient un deck, la
//    défense battue sa défense visée (docs/02-app/siege/statistiques.md,
//    « Ajouter une offense à une recommandation ») ;
//  - une équipe de Mes équipes : un deck pré-rempli de ses stats, sets et
//    artéfacts, sans défense visée (docs/02-app/compte/feat-equipes.md,
//    « Ajouter à une recommandation »).
//
// ⚠️ **Chaque recommandation dit d'avance ce que fera le clic** : un nouveau
// deck, la défense ajoutée au deck de cette offense, ou rien (déjà dedans,
// désactivée) — on ne découvre pas un doublon après coup.
//
// ⚠️ **La fenêtre reste ouverte après un ajout** : la ligne passe à
// « Ajoutée », on peut ajouter à une autre recommandation. La liste a une
// hauteur FIXE : une recommandation créée ne regrandit pas la fenêtre, qui
// serait recentrée — le bouton qu'on vient de toucher bougerait sous le doigt.
//
// ⚠️ **Les recommandations partagées viennent de Discord** : Discord activé,
// les salons se lisent en arrière-plan — par la page des statistiques à son
// ouverture (SiegeStatistiques.tsx), par la fenêtre elle-même ailleurs
// (`AjoutOffenseRecoDiscord`). Sans connexion, la fenêtre le dit et renvoie à
// la page Recommandations, où l'on se connecte. La zone qui le dit a une
// hauteur RÉSERVÉE : la lecture qui finit ne déplace pas la liste.

import { useId, useMemo, useState } from 'react';
import { Check, Hash, Plus } from 'lucide-react';
import { useTraduction } from '../../hooks/useLangue';
import type { UseRecoState } from '../../hooks/useSiegeRecos';
import { useDiscord, type RecosSynchronisees, type StatutDiscord } from '../../hooks/useDiscord';
import { placeDeLOffense, type OffenseAAjouter, type PlaceOffense, type TrioReco } from '../../lib/ajoutOffenseReco';
import type { Reco } from '../../types';
import { Bouton, ZoneCliquable } from '../../ui';
import { Modale } from '../../ui/Dialogs';
import { Equipe, type ParCom2us } from './SiegeStatsElements';

// Ce dont une page qui ajoute une offense a besoin des recommandations : les
// lire, en créer, y ajouter une offense, et les synchroniser avec Discord.
export type RecosPourAjout = Pick<UseRecoState, 'state' | 'addReco' | 'ajouterOffense'> & RecosSynchronisees;

interface Props {
  ajout: OffenseAAjouter;
  recos: RecosPourAjout;
  parCom2us: ParCom2us;
  onClose: () => void;
}

// La fenêtre, Discord lu par elle-même à son ouverture (Discord activé) : pour
// une page qui ne le lit pas déjà (Mes équipes).
export function AjoutOffenseRecoDiscord(props: Props) {
  const discord = useDiscord(props.recos);
  return <AjoutOffenseReco {...props} statutDiscord={discord.etat.statut} />;
}

export default function AjoutOffenseReco({ ajout, recos, parCom2us, statutDiscord, onClose }: Props & { statutDiscord: StatutDiscord }) {
  const a = useTraduction().siegeStats.ajoutReco;
  const titreId = useId();
  // Les recommandations où l'offense a été ajoutée depuis cette fenêtre.
  const [ajoutees, setAjoutees] = useState<ReadonlySet<string>>(new Set());
  const ajouter = (id: string) => {
    recos.ajouterOffense(id, ajout, parCom2us);
    setAjoutees((s) => new Set(s).add(id));
  };

  return (
    <Modale
      onClose={onClose}
      labelledBy={titreId}
      titre={a.titre}
      sousTitre={ajout.defense ? a.sousTitre : a.sousTitreEquipe}
      croix
      largeur="max-w-[480px]"
      actions={(
        <>
          <Bouton href="#/siege/recommandations" fond="vide" libelle={a.voirRecos} data-voir-recos />
          <Bouton
            onClick={() => ajouter(recos.addReco())}
            fond="vide"
            trait="pointille"
            icone={<Plus size={14} />}
            libelle={a.nouvelleReco}
            data-nouvelle-reco
          />
        </>
      )}
    >
      <ChoixRecoOffense
        ajout={ajout}
        recos={recos.state.recos}
        parCom2us={parCom2us}
        ajoutees={ajoutees}
        statutDiscord={statutDiscord}
        onAjouter={ajouter}
      />
    </Modale>
  );
}

// Ce que la fenêtre dit de Discord, dans sa zone réservée : sans connexion
// (jamais connecté, déconnecté, connexion en attente de son code), le bouton
// qui mène à la page Recommandations, où l'on se connecte.
function EtatDiscord({ statut }: { statut: StatutDiscord }) {
  const textes = useTraduction();
  const d = textes.siegeStats.ajoutReco.discord;
  const horsConnexion = statut === 'inactif' || statut === 'code';
  return (
    <div className="flex min-h-[4.5rem] flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-panel2 px-3 py-2 text-xs text-ink-dim" data-etat-discord={statut}>
      <span className="min-w-0 flex-1 basis-56">
        {horsConnexion ? d.horsConnexion : statut === 'lecture' ? d.lecture : statut === 'indisponible' ? d.indisponible : d.connecte}
      </span>
      {horsConnexion && (
        <Bouton href="#/siege/recommandations" taille="sm" icone={<Hash size={13} />} libelle={textes.recosDiscord.connexion.bouton} data-connexion-discord />
      )}
    </div>
  );
}

// Le corps de la fenêtre : l'offense (face à la défense battue, pour un
// combat), l'état de Discord, puis une ligne par recommandation. Exporté pour
// les tests de rendu (la `Modale` ne rend rien côté serveur).
export function ChoixRecoOffense({ ajout, recos, parCom2us, ajoutees, statutDiscord, onAjouter }: {
  ajout: OffenseAAjouter;
  recos: Reco[];
  parCom2us: ParCom2us;
  ajoutees: ReadonlySet<string>;
  statutDiscord: StatutDiscord;
  onAjouter: (recoId: string) => void;
}) {
  const textes = useTraduction();
  const s = textes.siegeStats;
  const a = s.ajoutReco;
  const places = useMemo(
    () => new Map(recos.map((r) => [r.id, placeDeLOffense(r, ajout, parCom2us)])),
    [recos, ajout, parCom2us],
  );
  // Une place vide d'une équipe (monstre absent des données) n'a pas de portrait.
  const ids = (t: TrioReco) => t.flatMap((m) => (m.com2usId != null ? [m.com2usId] : []));
  const statut = (id: string, place: PlaceOffense): { texte: string; aide?: string; ton: string } =>
    place.type === 'dejaDedans'
      ? ajoutees.has(id)
        ? { texte: a.ajoutee, ton: 'text-good' }
        : { texte: a.dejaDedans, aide: ajout.defense ? a.dejaDedansAide : a.dejaDedansEquipeAide, ton: 'text-ink-dim' }
      : place.type === 'nouvelleDefense'
        ? { texte: a.nouvelleDefense, aide: a.nouvelleDefenseAide, ton: 'text-accent' }
        : { texte: a.nouveauDeck, ton: 'text-accent' };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Equipe ids={ids(ajout.offense)} parCom2us={parCom2us} />
        {ajout.defense && (
          <>
            <span className="text-xs text-ink-dimmer">{s.versus}</span>
            <Equipe ids={ids(ajout.defense)} parCom2us={parCom2us} />
          </>
        )}
      </div>
      {/* Un combat : le leader du journal est supposé. Une équipe : son
          leader est connu, ses stats et sets sont repris. */}
      <p className="text-xs text-ink-dim">{ajout.defense ? a.leader : a.leaderEquipe}</p>
      <EtatDiscord statut={statutDiscord} />
      <div className="flex flex-col gap-1">
        <span className="label">{a.dans}</span>
        <div className="flex h-[min(18rem,45dvh)] flex-col gap-1.5 overflow-y-auto" data-recos-ajout>
          {recos.length === 0 && <p className="text-sm text-ink-dim">{a.aucune}</p>}
          {recos.map((reco, rang) => {
            const place = places.get(reco.id)!;
            const st = statut(reco.id, place);
            const fait = place.type === 'dejaDedans';
            return (
              <ZoneCliquable
                key={reco.id}
                onClick={() => onAjouter(reco.id)}
                disabled={fait}
                title={st.aide}
                className={`flex w-full min-w-0 items-center gap-2 rounded-lg border border-border-soft bg-panel px-2.5 py-2 ${fait ? '' : 'hoverable:border-accent'}`}
                data-reco-ajout={place.type}
              >
                <span className="flex min-w-0 flex-col">
                  <b className="truncate text-sm font-semibold text-ink">{reco.name || textes.partage.reco.recommandation(rang + 1)}</b>
                  <span className="flex min-w-0 items-center gap-2 font-mono text-micro text-ink-dim">
                    <span className="flex-none">{textes.carteReco.decks(reco.decks.length)}</span>
                    {/* Une recommandation partagée : son salon. */}
                    {reco.lien && (
                      <span className="inline-flex min-w-0 items-center gap-0.5" data-salon-ajout>
                        <Hash size={10} className="flex-none" aria-hidden="true" />
                        <span className="truncate">{reco.lien.nomSalon}</span>
                      </span>
                    )}
                  </span>
                </span>
                <span className={`ml-auto inline-flex flex-none items-center gap-1 text-xs font-semibold ${st.ton}`}>
                  {ajoutees.has(reco.id) && fait && <Check size={13} aria-hidden="true" />}
                  {st.texte}
                </span>
              </ZoneCliquable>
            );
          })}
        </div>
      </div>
    </div>
  );
}
