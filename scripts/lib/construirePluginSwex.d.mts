export declare const NOM_PLUGIN: string;
export declare const CHEMIN_PLUGIN: string;
export declare function texteDuPluginSwex(): Promise<{ texte: string; version: string }>;
export declare function construirePluginSwex(dossier?: string): Promise<{ sortie: string; version: string }>;
