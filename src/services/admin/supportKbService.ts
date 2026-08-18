import { supabase } from '../../lib/supabase/client';

export interface SupportKbEntry {
    id: string;
    title: string;                       // TR — eşleştirici girişi
    answer: string;                      // TR fallback (answer_i18n.tr ile eşlenir)
    answer_i18n: Record<string, string>; // { tr, en, de, ... }
    keywords: string[];
    category: string | null;
    step_scope: 'all' | 'model_selection' | 'final_offer';
    is_active: boolean;
    is_quick: boolean;
    quick_label_i18n: Record<string, string>;
    sort_order: number;
    created_at?: string;
    updated_at?: string;
}

export type SupportKbInput = Omit<SupportKbEntry, 'id' | 'created_at' | 'updated_at'>;

const SELECT = 'id,title,answer,answer_i18n,keywords,category,step_scope,is_active,is_quick,quick_label_i18n,sort_order,created_at,updated_at';

export const SupportKbService = {
    async list(): Promise<SupportKbEntry[]> {
        const { data, error } = await supabase
            .from('support_kb_entries')
            .select(SELECT)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data || []) as SupportKbEntry[];
    },

    async create(input: SupportKbInput): Promise<SupportKbEntry> {
        // answer kolonu TR fallback olarak answer_i18n.tr ile senkron tutulur
        const row = { ...input, answer: input.answer_i18n?.tr || input.answer || '' };
        const { data, error } = await supabase
            .from('support_kb_entries')
            .insert(row)
            .select(SELECT)
            .single();
        if (error) throw error;
        return data as SupportKbEntry;
    },

    async update(id: string, patch: Partial<SupportKbInput>): Promise<void> {
        const row: any = { ...patch, updated_at: new Date().toISOString() };
        if (patch.answer_i18n) row.answer = patch.answer_i18n.tr || patch.answer || '';
        const { error } = await supabase.from('support_kb_entries').update(row).eq('id', id);
        if (error) throw error;
    },

    async remove(id: string): Promise<void> {
        const { error } = await supabase.from('support_kb_entries').delete().eq('id', id);
        if (error) throw error;
    },
};
