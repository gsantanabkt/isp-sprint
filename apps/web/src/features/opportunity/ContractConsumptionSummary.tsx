import type { ContractConsumption, DealKind } from '@isp/domain';
import { fmtBRL } from '../../lib/format';
import { BUSINESS_LABELS } from './productNegotiation';

export function ContractConsumptionSummary({ result, kind, section }: { result: ContractConsumption | null; kind?: DealKind; section?: number }) {
  if (!result) return <p className="text-sm text-muted">Confira a quantidade e o preço unitário de venda dos itens.</p>;
  const groups = result.groups.filter((group) => (kind == null || group.kind === kind) && (section == null || group.section === section));
  if (!groups.length) return <p className="text-sm text-muted">Informe os itens com preço de contrato.</p>;
  const percentage = (result.rateBp / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return <div className="space-y-2">
    {groups.map((group) => <div key={group.section ?? group.kind ?? 'sem-tipo'}>
      {kind == null && section == null && <p className="text-sm font-semibold text-ink">{group.kind ? BUSINESS_LABELS[group.kind] : 'Sem tipo de negócio'}</p>}
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {group.oneTimeCents != null && <div><dt className="text-muted">Valor do consumo (único)</dt><dd className="num font-semibold">{fmtBRL(group.oneTimeCents)}</dd></div>}
        {group.monthlyCents != null && <div><dt className="text-muted">Valor do consumo (mensal)</dt><dd className="num font-semibold">{fmtBRL(group.monthlyCents)}/mês</dd></div>}
        <div><dt className="text-muted">Inferência de custo de serviço</dt><dd className="num font-semibold">{group.inferenceCents == null
          ? group.kind === 'venda' ? 'Repasse · sem inferência' : 'Sem base de inferência'
          : `${fmtBRL(group.inferenceCents)}${group.inferenceMonthly ? '/mês' : ''} (${percentage}%)`}</dd></div>
      </dl>
    </div>)}
  </div>;
}
