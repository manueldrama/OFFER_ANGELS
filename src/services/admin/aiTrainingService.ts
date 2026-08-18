import { supabase } from '../../lib/supabase/client';

export interface ConversationLine {
    role: 'customer' | 'rep';
    text: string;
}

export interface TrainingExample {
    id: string;
    title: string;
    description: string | null;
    conversation: ConversationLine[];
    is_active: boolean;
    created_at: string;
}

export const aiTrainingService = {
    async getExamples(): Promise<TrainingExample[]> {
        const { data, error } = await supabase
            .from('ai_training_examples')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as TrainingExample[];
    },

    async createExample(payload: { title: string; description?: string; conversation: ConversationLine[]; is_active: boolean }): Promise<TrainingExample> {
        const { data, error } = await supabase
            .from('ai_training_examples')
            .insert([payload])
            .select()
            .single();
        if (error) throw error;
        return data as TrainingExample;
    },

    async updateExample(id: string, payload: Partial<{ title: string; description: string; conversation: ConversationLine[]; is_active: boolean }>): Promise<TrainingExample> {
        const { data, error } = await supabase
            .from('ai_training_examples')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as TrainingExample;
    },

    async deleteExample(id: string): Promise<void> {
        const { error } = await supabase
            .from('ai_training_examples')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },
};
