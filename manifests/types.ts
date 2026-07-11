export interface ManifestIcons {
    [size: string]: string;
}

export interface ManifestBase {
    name: string;
    version: string;
    description: string;

    icons?: ManifestIcons;

    permissions?: string[];

    host_permissions?: string[];

    browser_specific_settings?: {
        gecko?: {
            id?: string;
            strict_min_version?: string;
        };
    };
}