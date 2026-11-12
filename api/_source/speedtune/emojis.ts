// Les icônes des monstres DANS le texte d'un message Discord : des émojis
// d'application (`<:m20711:123…>`), propres au bot, utilisables sur tous les
// serveurs où il est installé. Une carte par monstre prenait toute la hauteur
// du message ; une icône dans la ligne le garde compact.
//
// Créés à la demande : la première fois qu'un monstre paraît dans un résultat,
// son icône SWARFARM (celle de l'app) est téléversée sous le nom `m<com2usId>`.
// La liste des émojis existants se lit une fois par instance. Une application
// en porte 2 000 au plus, plus que les monstres reconnaissables (1 171).
//
// ⚠️ Un émoji manquant n'empêche jamais la réponse : le monstre s'écrit alors
// sans icône. Rien ici ne lève d'erreur.

import type { Monster } from '../../../src/types';
import { API, type Recuperer } from '../service/discordApi';

export type Emojis = (monstres: Monster[]) => Promise<Map<number, string>>;

const NOM = (id: number) => `m${id}`;
const TAILLE_MAX = 256 * 1024; // limite de Discord pour une image d'émoji

export function creerEmojis(recuperer: Recuperer, applicationId: string, jetonBot: string): Emojis {
  const entetes = { Authorization: `Bot ${jetonBot}`, 'Content-Type': 'application/json' };
  const url = `${API}/applications/${applicationId}/emojis`;
  let connus: Promise<Map<string, string>> | null = null;

  const lister = async (): Promise<Map<string, string>> => {
    const r = await recuperer(url, { headers: entetes });
    if (!r.ok) throw new Error(`émojis HTTP ${r.status}`);
    const { items } = (await r.json()) as { items: { id: string; name: string }[] };
    return new Map(items.map((e) => [e.name, e.id]));
  };

  async function creer(m: Monster, carte: Map<string, string>): Promise<void> {
    if (!m.image || m.com2usId == null) return;
    const image = await recuperer(m.image);
    if (!image.ok) return;
    const octets = Buffer.from(await image.arrayBuffer());
    if (octets.length > TAILLE_MAX) return;
    const r = await recuperer(url, {
      method: 'POST',
      headers: entetes,
      body: JSON.stringify({ name: NOM(m.com2usId), image: `data:image/png;base64,${octets.toString('base64')}` }),
    });
    if (r.ok) {
      const { id } = (await r.json()) as { id: string };
      carte.set(NOM(m.com2usId), id);
    }
  }

  return async (monstres) => {
    const resultat = new Map<number, string>();
    try {
      connus ??= lister();
      const carte = await connus.catch((e) => {
        connus = null; // relire à la prochaine demande
        throw e;
      });
      const manquants = monstres.filter((m, i) => m.com2usId != null && !carte.has(NOM(m.com2usId)) && monstres.indexOf(m) === i);
      await Promise.all(manquants.map((m) => creer(m, carte).catch((e) => console.error(e))));
      for (const m of monstres) {
        const id = m.com2usId != null ? carte.get(NOM(m.com2usId)) : undefined;
        if (id) resultat.set(m.com2usId!, `<:${NOM(m.com2usId!)}:${id}>`);
      }
    } catch (e) {
      console.error(e);
    }
    return resultat;
  };
}
