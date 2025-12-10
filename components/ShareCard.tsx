import React from 'react';
import { AnalysisResult, AnalysisType, UserProfile } from '../types';
import { Stethoscope, AlertOctagon, CheckCircle2, Activity, Pill } from 'lucide-react';

interface Props {
  id: string;
  result: AnalysisResult;
  profileName: string;
  reportDate: string;
}

const ShareCard: React.FC<Props> = ({ id, result, profileName, reportDate }) => {
  return (
    <div 
      id={id}
      style={{ position: 'absolute', top: 0, left: '-9999px', width: '500px' }}
      className="bg-slate-50 p-6 font-sans text-gray-900"
    >
      <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-gray-200">
        {/* Header */}
        <div className="bg-teal-600 p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Stethoscope size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2 opacity-90">
              <Stethoscope size={20} />
              <span className="text-sm font-bold tracking-wider">家庭健康助手</span>
            </div>
            <h1 className="text-2xl font-bold mb-1">
              {result.type === AnalysisType.MEDICATION ? '药品说明解读' : '健康报告解读'}
            </h1>
            <p className="text-teal-100 text-sm flex items-center gap-2">
              <span>使用者: {profileName}</span>
              <span>•</span>
              <span>{reportDate}</span>
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Summary */}
          <div className="text-sm leading-relaxed text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100">
             <span className="font-bold text-gray-900 block mb-1">总体概览</span>
             {result.summary}
          </div>

          {/* Key Indicators (Limit to first 5 abnormal or first 3 normal) */}
          {result.type === AnalysisType.REPORT && result.indicators && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">关键发现</div>
              {result.indicators.slice(0, 4).map((ind, i) => (
                <div key={i} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0">
                  <div>
                    <div className="font-bold text-gray-800 text-sm">{ind.name}</div>
                    <div className="text-xs text-gray-500">{ind.value}</div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-bold 
                    ${['HIGH','LOW','CRITICAL'].includes(ind.status) ? 'bg-red-50 text-red-600' : 'bg-teal-50 text-teal-600'}
                  `}>
                    {ind.status === 'NORMAL' ? '正常' : ind.status}
                  </div>
                </div>
              ))}
              {result.indicators.length > 4 && (
                <div className="text-center text-xs text-gray-400 mt-2">
                  ...还有 {result.indicators.length - 4} 项指标
                </div>
              )}
            </div>
          )}

           {/* Medication */}
           {result.type === AnalysisType.MEDICATION && result.medication && (
             <div className="space-y-3">
               <div className="flex items-start gap-3">
                 <div className="bg-blue-100 p-2 rounded-lg text-blue-600 shrink-0">
                   <Activity size={20} />
                 </div>
                 <div>
                   <div className="font-bold text-sm text-gray-900">用法</div>
                   <div className="text-sm text-gray-600">{result.medication.usage}</div>
                 </div>
               </div>
               {result.medication.warnings.length > 0 && (
                <div className="flex items-start gap-3">
                  <div className="bg-amber-100 p-2 rounded-lg text-amber-600 shrink-0">
                    <AlertOctagon size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-gray-900">提醒</div>
                    <div className="text-sm text-gray-600">{result.medication.warnings[0]}</div>
                  </div>
                </div>
               )}
             </div>
           )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-4 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 leading-tight">
            免责声明：结果仅供参考，不构成医疗建议。<br/>请务必咨询医生。
          </p>
          <div className="mt-3 text-xs font-bold text-teal-600">
            由 AI 家庭健康助手 生成
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareCard;