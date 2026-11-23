export declare const NOM_PLUGIN: string;
export declare const CHEMIN_PLUGIN: string;
export declare function banniere(version: string, code: string): string;
export declare function texteDuPluginSwex(version?: string): Promise<{ texte: string; version: string; code: string }>;
export declare function construirePluginSwex(dossier?: string): Promise<{ sortie: string; version: string; code: string }>;
