# Licence non commerciale : PolyForm Noncommercial 1.0.0

## Décision

- **Le code de SW Blacksmith est sous licence PolyForm Noncommercial 1.0.0** : le dépôt, le site,
  l'application de bureau et le plugin SW Exporter « SW Blacksmith Live ». Le texte officiel,
  inchangé, est [LICENSE.md](../../../LICENSE.md).
- **Tout usage non commercial est permis** (utiliser, étudier, modifier, redistribuer) ; **tout
  usage commercial est interdit**.
- **Qui redistribue crédite** : il transmet le texte de la licence et la ligne
  `Required Notice:` de [NOTICE.md](../../../NOTICE.md), qui nomme les auteurs et le dépôt.
- **La licence ne couvre que le code écrit pour SW Blacksmith** : ni le jeu, ses données et ses
  images (© Com2uS), ni les données de SWARFARM, ni les dépendances, qui gardent leurs
  licences. `NOTICE.md` le dit.
- **Une contribution est faite sous la même licence.**

## Raisons

- **Le dépôt est public et l'app est diffusée** : sans licence, le code est « tous droits
  réservés », mais rien ne dit ce qui est permis, et personne ne le lit ainsi. Une licence écrite
  dit ce qu'on accepte et donne une base pour agir contre une copie qui ne la respecte pas.
- **Deux exigences** : être crédité quand le code est réutilisé, et que personne ne gagne
  d'argent avec. PolyForm Noncommercial porte les deux : l'obligation de transmettre la licence et
  ses mentions, et la limite aux usages non commerciaux.
- **Elle est écrite pour du logiciel** : distribution, modifications, brevets et fin de licence
  après une violation non corrigée sous 32 jours y sont traités.
- **Elle s'accorde avec le jeu** : SW Blacksmith est un outil de fans, non officiel, qui affiche
  des données et des images de Com2uS ; n'en tirer aucun revenu va dans le même sens.

## Options écartées

- **Aucune licence** (possibilité écartée) : le code reste protégé par défaut, mais rien
  n'autorise ce qu'on veut permettre (étudier, reprendre en créditant), et rien ne le dit à qui
  lit le dépôt.
- **MIT, Apache 2.0** (possibilité écartée) : elles obligent à créditer, mais autorisent la
  vente ; c'est la licence de SW Exporter, dont SW Blacksmith n'inclut pas le code.
- **AGPL 3.0** (possibilité écartée) : une version modifiée doit publier son code, même hébergée,
  mais la vente reste permise.
- **CC BY-NC-SA 4.0** (possibilité écartée) : même intention, mais Creative Commons déconseille
  ses licences pour du code, qu'elles ne traitent pas en logiciel (brevets, distribution).

## Conséquences

- **Le code n'est pas « open source »** au sens strict, qui permet l'usage commercial : l'app dit
  « Le code est public » ([accueil/](../../02-app/accueil/README.md)), jamais « open source ».
- **Les fichiers** : `LICENSE.md` (le texte officiel, à ne jamais retoucher), `NOTICE.md` (la
  ligne `Required Notice:`, le résumé, ce qui n'est pas couvert, les contributions), le champ
  `license` de `package.json` (`PolyForm-Noncommercial-1.0.0`), la section « Licence » du README.
- **L'application de bureau** pose `LICENSE.md` et `NOTICE.md` à côté de son exécutable
  ([bureau/](../../02-app/bureau/README.md), `electron-builder.yml`).
- **Un code tiers recopié dans le dépôt** garde sa licence et ses mentions, à côté de lui.
