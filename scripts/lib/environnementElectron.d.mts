// Types de environnementElectron.mjs (écrit en JavaScript : voir son en-tête).

type Environnement = Record<string, string | undefined>;

export declare const VARIABLES_DU_SNAP: readonly string[];
export declare const SUFFIXE_ORIGINE_SNAP: string;
export declare function environnementElectron(herite: Environnement, supplement?: Environnement): Environnement;
