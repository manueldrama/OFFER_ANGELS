import React from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { FlowNode, FlowNodeData } from '../../../types/chatbot';

interface NodePropertyEditorProps {
    node: FlowNode;
    onChange: (nodeId: string, data: FlowNodeData) => void;
    onClose: () => void;
}

export default function NodePropertyEditor({ node, onChange, onClose }: NodePropertyEditorProps) {
    const data = node.data;

    function update(partial: Partial<FlowNodeData>) {
        onChange(node.id, { ...data, ...partial } as FlowNodeData);
    }

    return (
        <div className="w-72 bg-white border-l border-slate-200 overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Özellikler</h3>
                <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-4">
                {/* Label — common */}
                <Field label="Etiket">
                    <input
                        type="text"
                        value={data.label || ''}
                        onChange={e => update({ label: e.target.value } as any)}
                        className="input-sm"
                    />
                </Field>

                {/* Trigger */}
                {data.nodeType === 'trigger' && (
                    <>
                        <Field label="Tetikleyici Tipi">
                            <select value={(data as any).triggerType} onChange={e => update({ triggerType: e.target.value } as any)} className="input-sm">
                                <option value="keyword">Anahtar Kelime (DM)</option>
                                <option value="comment_keyword">Yorum Anahtar Kelime</option>
                                <option value="story_mention">Story Mention</option>
                                <option value="new_follower">Yeni Takipçi</option>
                                <option value="manual">Manuel</option>
                            </select>
                        </Field>
                        {['keyword', 'comment_keyword'].includes((data as any).triggerType) && (
                            <>
                                <Field label="Eşleşme Tipi">
                                    <select value={(data as any).matchType || 'contains'} onChange={e => update({ matchType: e.target.value } as any)} className="input-sm">
                                        <option value="exact">Tam Eşleşme</option>
                                        <option value="contains">İçeriyor</option>
                                        <option value="starts_with">İle Başlıyor</option>
                                    </select>
                                </Field>
                                <Field label="Anahtar Kelimeler">
                                    <TagInput
                                        tags={(data as any).keywords || []}
                                        onChange={keywords => update({ keywords } as any)}
                                        placeholder="Kelime yazıp Enter'a basın"
                                    />
                                </Field>
                            </>
                        )}
                    </>
                )}

                {/* Send Message */}
                {data.nodeType === 'sendMessage' && (
                    <Field label="Mesaj">
                        <textarea
                            value={(data as any).message || ''}
                            onChange={e => update({ message: e.target.value } as any)}
                            rows={4}
                            className="input-sm"
                            placeholder="Merhaba {{subscriber.first_name}} {{salutation}}, ilginiz için teşekkür ederiz."
                        />
                        <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                            Değişkenler: <code className="text-slate-600">{'{{subscriber.first_name}}'}</code>{' '}
                            <code className="text-slate-600">{'{{salutation}}'}</code> (Bey/Hanım){' '}
                            <code className="text-slate-600">{'{{subscriber.name}}'}</code>{' '}
                            <code className="text-slate-600">{'{{last_input}}'}</code>
                        </p>
                    </Field>
                )}

                {/* Send Image */}
                {data.nodeType === 'sendImage' && (
                    <>
                        <Field label="Görsel URL">
                            <input type="text" value={(data as any).imageUrl || ''} onChange={e => update({ imageUrl: e.target.value } as any)} className="input-sm" placeholder="https://..." />
                        </Field>
                        <Field label="Açıklama">
                            <input type="text" value={(data as any).caption || ''} onChange={e => update({ caption: e.target.value } as any)} className="input-sm" />
                        </Field>
                    </>
                )}

                {/* Send Button */}
                {data.nodeType === 'sendButton' && (
                    <>
                        <Field label="Mesaj">
                            <textarea value={(data as any).message || ''} onChange={e => update({ message: e.target.value } as any)} rows={3} className="input-sm" />
                        </Field>
                        <Field label="Butonlar (maks 3)">
                            <div className="space-y-2">
                                {((data as any).buttons || []).map((btn: any, i: number) => (
                                    <div key={btn.id} className="flex gap-1.5">
                                        <input
                                            type="text"
                                            value={btn.title}
                                            onChange={e => {
                                                const buttons = [...(data as any).buttons];
                                                buttons[i] = { ...btn, title: e.target.value };
                                                update({ buttons } as any);
                                            }}
                                            className="input-sm flex-1"
                                            placeholder={`Buton ${i + 1}`}
                                        />
                                        <button onClick={() => {
                                            const buttons = (data as any).buttons.filter((_: any, j: number) => j !== i);
                                            update({ buttons } as any);
                                        }} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                ))}
                                {((data as any).buttons || []).length < 3 && (
                                    <button onClick={() => {
                                        const buttons = [...((data as any).buttons || []), { id: `btn_${Date.now()}`, title: '' }];
                                        update({ buttons } as any);
                                    }} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                                        <Plus className="w-3 h-3" /> Buton Ekle
                                    </button>
                                )}
                            </div>
                        </Field>
                    </>
                )}

                {/* Delay */}
                {data.nodeType === 'delay' && (
                    <div className="flex gap-2">
                        <Field label="Süre" className="flex-1">
                            <input type="number" min={1} value={(data as any).duration || 5} onChange={e => update({ duration: Number(e.target.value) } as any)} className="input-sm" />
                        </Field>
                        <Field label="Birim" className="flex-1">
                            <select value={(data as any).unit || 'minutes'} onChange={e => update({ unit: e.target.value } as any)} className="input-sm">
                                <option value="minutes">Dakika</option>
                                <option value="hours">Saat</option>
                                <option value="days">Gün</option>
                            </select>
                        </Field>
                    </div>
                )}

                {/* Condition */}
                {data.nodeType === 'condition' && (
                    <>
                        <Field label="Alan">
                            <input type="text" value={(data as any).field || ''} onChange={e => update({ field: e.target.value } as any)} className="input-sm" placeholder="last_input, subscriber.tags..." />
                        </Field>
                        <Field label="Operatör">
                            <select value={(data as any).operator || 'contains'} onChange={e => update({ operator: e.target.value } as any)} className="input-sm">
                                <option value="equals">Eşittir</option>
                                <option value="not_equals">Eşit Değil</option>
                                <option value="contains">İçerir</option>
                                <option value="exists">Var</option>
                                <option value="not_exists">Yok</option>
                                <option value="includes">Dizi İçerir</option>
                            </select>
                        </Field>
                        <Field label="Değer">
                            <input type="text" value={(data as any).value || ''} onChange={e => update({ value: e.target.value } as any)} className="input-sm" />
                        </Field>
                    </>
                )}

                {/* Random Split */}
                {data.nodeType === 'randomSplit' && (
                    <Field label="Dağılım">
                        <div className="space-y-2">
                            {((data as any).splits || []).map((s: any, i: number) => (
                                <div key={s.id} className="flex gap-1.5 items-center">
                                    <input
                                        type="text"
                                        value={s.label}
                                        onChange={e => {
                                            const splits = [...(data as any).splits];
                                            splits[i] = { ...s, label: e.target.value };
                                            update({ splits } as any);
                                        }}
                                        className="input-sm w-16"
                                    />
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={s.percentage}
                                        onChange={e => {
                                            const splits = [...(data as any).splits];
                                            splits[i] = { ...s, percentage: Number(e.target.value) };
                                            update({ splits } as any);
                                        }}
                                        className="input-sm w-16"
                                    />
                                    <span className="text-xs text-slate-400">%</span>
                                    <button onClick={() => {
                                        const splits = (data as any).splits.filter((_: any, j: number) => j !== i);
                                        update({ splits } as any);
                                    }} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                            ))}
                            <button onClick={() => {
                                const splits = [...((data as any).splits || []), { id: `s_${Date.now()}`, label: String.fromCharCode(65 + ((data as any).splits || []).length), percentage: 0 }];
                                update({ splits } as any);
                            }} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                                <Plus className="w-3 h-3" /> Varyant Ekle
                            </button>
                        </div>
                    </Field>
                )}

                {/* Tag Subscriber */}
                {data.nodeType === 'tagSubscriber' && (
                    <>
                        <Field label="İşlem">
                            <select value={(data as any).action || 'add'} onChange={e => update({ action: e.target.value } as any)} className="input-sm">
                                <option value="add">Etiket Ekle</option>
                                <option value="remove">Etiket Çıkar</option>
                            </select>
                        </Field>
                        <Field label="Etiketler">
                            <TagInput
                                tags={(data as any).tags || []}
                                onChange={tags => update({ tags } as any)}
                                placeholder="Etiket yazıp Enter'a basın"
                            />
                        </Field>
                    </>
                )}

                {/* HTTP Request */}
                {data.nodeType === 'httpRequest' && (
                    <>
                        <div className="flex gap-2">
                            <Field label="Metod" className="w-24">
                                <select value={(data as any).method || 'POST'} onChange={e => update({ method: e.target.value } as any)} className="input-sm">
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                    <option value="PUT">PUT</option>
                                </select>
                            </Field>
                            <Field label="URL" className="flex-1">
                                <input type="text" value={(data as any).url || ''} onChange={e => update({ url: e.target.value } as any)} className="input-sm" placeholder="https://..." />
                            </Field>
                        </div>
                        <Field label="Body (JSON)">
                            <textarea value={(data as any).body || ''} onChange={e => update({ body: e.target.value } as any)} rows={3} className="input-sm font-mono text-xs" placeholder='{"key": "value"}' />
                        </Field>
                        <Field label="Yanıtı Kaydet">
                            <input type="text" value={(data as any).saveResponseAs || ''} onChange={e => update({ saveResponseAs: e.target.value } as any)} className="input-sm" placeholder="api_response" />
                        </Field>
                    </>
                )}

                {/* Carousel */}
                {data.nodeType === 'sendCarousel' && (
                    <Field label="Kartlar">
                        <div className="space-y-2">
                            {((data as any).elements || []).map((el: any, i: number) => (
                                <div key={i} className="bg-slate-50 rounded-lg p-2 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-400">Kart {i + 1}</span>
                                        <button onClick={() => {
                                            const elements = (data as any).elements.filter((_: any, j: number) => j !== i);
                                            update({ elements } as any);
                                        }} className="p-0.5 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                    <input
                                        type="text"
                                        value={el.title}
                                        onChange={e => {
                                            const elements = [...(data as any).elements];
                                            elements[i] = { ...el, title: e.target.value };
                                            update({ elements } as any);
                                        }}
                                        className="input-sm"
                                        placeholder="Başlık"
                                    />
                                    <input
                                        type="text"
                                        value={el.subtitle || ''}
                                        onChange={e => {
                                            const elements = [...(data as any).elements];
                                            elements[i] = { ...el, subtitle: e.target.value };
                                            update({ elements } as any);
                                        }}
                                        className="input-sm"
                                        placeholder="Alt başlık"
                                    />
                                </div>
                            ))}
                            <button onClick={() => {
                                const elements = [...((data as any).elements || []), { title: '' }];
                                update({ elements } as any);
                            }} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                                <Plus className="w-3 h-3" /> Kart Ekle
                            </button>
                        </div>
                    </Field>
                )}
            </div>
        </div>
    );
}

/* ── Helpers ────────────────────────────────── */

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={className}>
            <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
            {children}
        </div>
    );
}

function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (tags: string[]) => void; placeholder?: string }) {
    const [input, setInput] = React.useState('');
    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && input.trim()) {
            e.preventDefault();
            if (!tags.includes(input.trim())) {
                onChange([...tags, input.trim()]);
            }
            setInput('');
        }
    }
    return (
        <div>
            <div className="flex flex-wrap gap-1 mb-1.5">
                {tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                        {t}
                        <button onClick={() => onChange(tags.filter(x => x !== t))} className="text-slate-400 hover:text-red-500">&times;</button>
                    </span>
                ))}
            </div>
            <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} className="input-sm" placeholder={placeholder} />
        </div>
    );
}
