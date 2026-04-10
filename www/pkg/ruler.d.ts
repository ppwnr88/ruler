/* tslint:disable */
/* eslint-disable */

export class Ruler {
    free(): void;
    [Symbol.dispose](): void;
    clear_markers(): void;
    draw(): void;
    get_marker_count(): number;
    get_marker_values(): Float64Array;
    get_offset(): number;
    get_ppi(): number;
    get_thickness(): number;
    get_unit(): string;
    get_value_at(canvas_pos: number): number;
    hide_cursor(): void;
    is_horizontal(): boolean;
    constructor(canvas_id: string);
    /**
     * Parse commands like "5 cm", "50 px", "2.5 in", "10 mm"
     */
    parse_command(cmd: string): string;
    resize(width: number, height: number): void;
    scroll(delta: number): void;
    set_cursor(pos: number): void;
    set_fraction_denom(d: number): void;
    set_horizontal(): void;
    set_offset(v: number): void;
    set_ppi(ppi: number): void;
    set_thickness(v: number): void;
    set_unit(unit: string): void;
    set_vertical(): void;
    /**
     * Toggle a marker at canvas_pos. Returns true if marker was added, false if removed.
     */
    toggle_marker(canvas_pos: number): boolean;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_ruler_free: (a: number, b: number) => void;
    readonly ruler_clear_markers: (a: number) => void;
    readonly ruler_draw: (a: number) => void;
    readonly ruler_get_marker_count: (a: number) => number;
    readonly ruler_get_marker_values: (a: number) => [number, number];
    readonly ruler_get_offset: (a: number) => number;
    readonly ruler_get_ppi: (a: number) => number;
    readonly ruler_get_thickness: (a: number) => number;
    readonly ruler_get_unit: (a: number) => [number, number];
    readonly ruler_get_value_at: (a: number, b: number) => number;
    readonly ruler_hide_cursor: (a: number) => void;
    readonly ruler_is_horizontal: (a: number) => number;
    readonly ruler_new: (a: number, b: number) => [number, number, number];
    readonly ruler_parse_command: (a: number, b: number, c: number) => [number, number];
    readonly ruler_resize: (a: number, b: number, c: number) => void;
    readonly ruler_scroll: (a: number, b: number) => void;
    readonly ruler_set_cursor: (a: number, b: number) => void;
    readonly ruler_set_fraction_denom: (a: number, b: number) => void;
    readonly ruler_set_horizontal: (a: number) => void;
    readonly ruler_set_offset: (a: number, b: number) => void;
    readonly ruler_set_ppi: (a: number, b: number) => void;
    readonly ruler_set_thickness: (a: number, b: number) => void;
    readonly ruler_set_unit: (a: number, b: number, c: number) => void;
    readonly ruler_set_vertical: (a: number) => void;
    readonly ruler_toggle_marker: (a: number, b: number) => number;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
