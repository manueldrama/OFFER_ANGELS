import React from 'react';
import { FileText, Plus, Trash2, Minus, Search, ShoppingBag } from 'lucide-react';
import { CartItem } from '../../types';
import { OFFER_CONTENT } from '../../config/content';

interface OfferSummaryCardProps {
    cart: CartItem[];
    onAddProduct: () => void;
    onRemoveItem: (id: string) => void;
    onUpdateQuantity: (id: string, delta: number) => void;
}

const OfferSummaryCard = ({
    cart,
    onAddProduct,
    onRemoveItem,
    onUpdateQuantity
}: OfferSummaryCardProps) => {
    const content = OFFER_CONTENT.cartSummary;

    return (
        <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full max-h-[calc(100vh-120px)]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center shrink-0 bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <FileText size={18} className="text-primary" />
                    {content.title}
                </h3>
                <button
                    onClick={onAddProduct}
                    className="text-xs font-bold text-primary flex items-center gap-1 hover:bg-primary/10 px-3 py-1.5 rounded-md transition-colors"
                >
                    <Plus size={14} strokeWidth={3} /> {content.addProductButton}
                </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4 cust-scrollbar">
                {cart.map((item) => (
                    <div key={item.id} className="bg-white rounded-md p-4 shadow-sm border border-slate-100 hover:border-primary/20 transition-colors group">
                        <div className="flex gap-4">
                            <div className="w-20 h-20 shrink-0 bg-slate-50/80 rounded-md overflow-hidden p-2 group-hover:bg-slate-50 transition-colors">
                                <img src={item.image} alt={item.name} className="w-full h-full object-contain mix-blend-multiply" />
                            </div>
                            <div className="flex flex-col flex-1 justify-center py-1">
                                <h3 className="font-bold text-slate-900 leading-tight text-sm mb-1">{item.name}</h3>
                                <p className="text-xs text-slate-500 font-medium line-clamp-2">{item.description}</p>
                            </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                            <button
                                onClick={() => onRemoveItem(item.id)}
                                className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-1.5 transition-colors px-2 py-1 -ml-2 rounded-md hover:bg-red-50"
                            >
                                <Trash2 size={14} /> {content.deleteButton}
                            </button>

                            <div className="flex items-center gap-3 bg-slate-50 rounded-md p-1 border border-slate-100">
                                <button
                                    onClick={() => onUpdateQuantity(item.id, -1)}
                                    className="w-8 h-8 flex items-center justify-center rounded-md bg-white text-slate-600 shadow-sm hover:text-primary transition-colors hover:shadow-md"
                                >
                                    <Minus size={14} strokeWidth={2.5} />
                                </button>
                                <span className="font-bold text-slate-900 w-6 text-center text-sm">{item.quantity}</span>
                                <button
                                    onClick={() => onUpdateQuantity(item.id, 1)}
                                    className="w-8 h-8 flex items-center justify-center rounded-md bg-white text-slate-600 shadow-sm hover:text-primary transition-colors hover:shadow-md"
                                >
                                    <Plus size={14} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {cart.length === 0 && (
                    <div className="text-center py-12 flex flex-col items-center justify-center gap-3">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                            <ShoppingBag size={24} className="text-slate-300" />
                        </div>
                        <p className="text-slate-500 text-sm font-medium">{content.emptyCartText}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OfferSummaryCard;
