import React from 'react';
import { Workflow, Database, Zap } from 'lucide-react';

/**
 * Placeholder center workspace for Backend mode (Stage 3a skeleton).
 * Displays live summary counts for flows, dataModels, and triggers.
 */
export default function BackendWorkspaceSkeleton({ projectBackend = null }) {
  const flowsCount = Array.isArray(projectBackend?.flows) ? projectBackend.flows.length : 0;
  const modelsCount = Array.isArray(projectBackend?.dataModels) ? projectBackend.dataModels.length : 0;
  const triggersCount = Array.isArray(projectBackend?.triggers) ? projectBackend.triggers.length : 0;

  const cards = [
    {
      id: 'flows',
      label: 'İş Akışları',
      count: flowsCount,
      desc: 'Form gönderimi, hesaplama ve sayfa aksiyon zincirleri',
      icon: Workflow,
      accent: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    },
    {
      id: 'dataModels',
      label: 'Veri Modelleri',
      count: modelsCount,
      desc: 'Kod yazmadan saklanan veri kutuları ve tablolar',
      icon: Database,
      accent: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
    },
    {
      id: 'triggers',
      label: 'Sayfa Tetikleyicileri',
      count: triggersCount,
      desc: 'Tasarım bileşenlerini akışlara bağlayan olaylar',
      icon: Zap,
      accent: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    },
  ];

  return (
    <div
      data-backend-workspace
      className="flex-1 min-w-0 h-full bg-[#111114] flex flex-col items-center justify-center p-6 overflow-y-auto select-none"
    >
      <div className="max-w-xl w-full rounded-2xl border border-[#272730] bg-[#16161b]/95 p-6 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-300 shrink-0">
            <Workflow size={20} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">
              Backend çalışma alanı, yakında
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Kod yazmadan görsel iş akışı, veri kutuları ve sayfa tetikleyicileri kurgulama tuvali.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                data-backend-card={card.id}
                className="rounded-xl border border-[#26262f] bg-[#111115] p-3.5 flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-zinc-300">{card.label}</span>
                  <span className={`w-6 h-6 rounded-lg border flex items-center justify-center ${card.accent}`}>
                    <Icon size={13} />
                  </span>
                </div>
                <div
                  data-backend-count={card.id}
                  className="text-xl font-bold font-mono tabular-nums text-zinc-100"
                >
                  {card.count}
                </div>
                <p className="text-[10px] text-zinc-500 leading-snug">{card.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
