import React from 'react';
import { SavedOffer } from '../../../types';

interface OfferPageTitleBlockProps {
  activeCount: number;
  savedOffers: SavedOffer[];
}

const OfferPageTitleBlock = ({ activeCount }: OfferPageTitleBlockProps) => (
  <div className="flex items-center gap-3">
    <h1 className="text-xl font-black text-slate-900">Tekliflerim</h1>
    {activeCount > 0 && (
      <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
        {activeCount} aktif
      </span>
    )}
  </div>
);

export default OfferPageTitleBlock;
