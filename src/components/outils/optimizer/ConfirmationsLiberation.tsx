import { type Dispatch, type SetStateAction } from 'react';
import { ConfirmDialog } from '../../../ui';
import { type UseOptimizerLists } from '../../../hooks/useOptimizerLists';
import { type ExclusionSelector } from '../../../lib/optimizerExclusion';
import { useTraduction } from '../../../hooks/useLangue';

export interface ConfirmationsLiberationProps {
  lists: UseOptimizerLists;
  releaseConfirm: { listId: string; selector: ExclusionSelector } | null;
  setReleaseConfirm: Dispatch<SetStateAction<{ listId: string; selector: ExclusionSelector } | null>>;
  releaseArtifactsConfirm: { listId: string; selector: ExclusionSelector } | null;
  setReleaseArtifactsConfirm: Dispatch<SetStateAction<{ listId: string; selector: ExclusionSelector } | null>>;
  releaseAllConfirm: string | null;
  setReleaseAllConfirm: Dispatch<SetStateAction<string | null>>;
  removeMemberConfirm: { listId: string; selector: ExclusionSelector } | null;
  setRemoveMemberConfirm: Dispatch<SetStateAction<{ listId: string; selector: ExclusionSelector } | null>>;
}

export default function ConfirmationsLiberation({
  lists,
  releaseConfirm,
  setReleaseConfirm,
  releaseArtifactsConfirm,
  setReleaseArtifactsConfirm,
  releaseAllConfirm,
  setReleaseAllConfirm,
  removeMemberConfirm,
  setRemoveMemberConfirm,
}: ConfirmationsLiberationProps) {
  const l = useTraduction().optimizer.liberation;
  return (
    <>
      {/* Confirmations de libération — demande explicite de l'utilisateur.
          `Modale` est portalisée : sa position dans l'arbre n'a pas
          d'importance pour son rendu. */}
      {releaseConfirm && (
        <ConfirmDialog
          titre={l.buildTitre}
          message={l.buildMessage}
          libelleAction={l.liberer}
          onConfirm={() => {
            lists.releaseBuild(releaseConfirm.listId, releaseConfirm.selector);
            setReleaseConfirm(null);
          }}
          onCancel={() => setReleaseConfirm(null)}
        />
      )}
      {releaseArtifactsConfirm && (
        <ConfirmDialog
          titre={l.artefactsTitre}
          message={l.artefactsMessage}
          libelleAction={l.liberer}
          onConfirm={() => {
            lists.releaseArtifacts(releaseArtifactsConfirm.listId, releaseArtifactsConfirm.selector);
            setReleaseArtifactsConfirm(null);
          }}
          onCancel={() => setReleaseArtifactsConfirm(null)}
        />
      )}
      {releaseAllConfirm && (
        <ConfirmDialog
          titre={l.toutTitre}
          message={l.toutMessage}
          libelleAction={l.toutLiberer}
          destructif
          onConfirm={() => {
            lists.releaseAllInList(releaseAllConfirm);
            setReleaseAllConfirm(null);
          }}
          onCancel={() => setReleaseAllConfirm(null)}
        />
      )}
      {removeMemberConfirm && (
        <ConfirmDialog
          titre={l.retirerTitre}
          message={l.retirerMessage}
          libelleAction={l.retirer}
          destructif
          onConfirm={() => {
            lists.removeMember(removeMemberConfirm.listId, removeMemberConfirm.selector);
            setRemoveMemberConfirm(null);
          }}
          onCancel={() => setRemoveMemberConfirm(null)}
        />
      )}
    </>
  );
}
