

import React from 'react';
import { MedicationInfo, Language } from '../types';
import { Pill, AlertTriangle, Clock, Activity } from 'lucide-react';
import { translations } from '../locales';

interface Props {
  data: MedicationInfo;
  lang: Language;
}

const MedicationCard: React.FC<Props> = ({ data, lang }) => {
  const t = translations[lang];

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <Pill size={24} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">{data.name}</h2>
        </div>
        
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-blue-100">
            <div className="flex items-center gap-2 mb-2 text-blue-800 font-semibold">
              <Clock size={16} />
              <span>{t.usage}</span>
            </div>
            <p className="text-gray-700 leading-relaxed">{data.usage}</p>
          </div>

          <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
             <div className="flex items-center gap-2 mb-2 text-amber-800 font-semibold">
              <AlertTriangle size={16} />
              <span>{t.warnings}</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
              {data.warnings.map((warn, idx) => (
                <li key={idx}>{warn}</li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
             <div className="bg-white p-3 rounded-xl border border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{t.sideEffects}</p>
                <p className="text-sm text-gray-700">{data.sideEffects}</p>
             </div>
             <div className="bg-white p-3 rounded-xl border border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{t.tips}</p>
                <p className="text-sm text-gray-700">{data.tips}</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicationCard;