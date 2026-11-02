import { type RefObject } from 'react';
import SetComboPicker from '../SetComboPicker';
import { useTraduction } from '../../../hooks/useLangue';

export interface SetDeRunesProps {
  setPickerSectionRef: RefObject<HTMLDivElement>;
  setPickerInvalid: boolean;
  comboSets: string[];
  onChangeSets: (next: string[]) => void;
}

export default function SetDeRunes({ setPickerSectionRef, setPickerInvalid, comboSets, onChangeSets }: SetDeRunesProps) {
  const c = useTraduction().optimizer.criteres;
  return (
    <div
      ref={setPickerSectionRef}
      className={`max-w-md ${
        setPickerInvalid
          ? 'rounded-lg border border-bad bg-bad/15 p-2 -m-2 transition'
          : 'transition'
      }`}
    >
      <p className="label mb-1.5">{c.setRecherche}</p>
      <SetComboPicker sets={comboSets} onChange={onChangeSets} />
      {setPickerInvalid && (
        <p className="mt-1.5 text-micro font-semibold text-bad">
          {c.setRequis}
        </p>
      )}
    </div>
  );
}
