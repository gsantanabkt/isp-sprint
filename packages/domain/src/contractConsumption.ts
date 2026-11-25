import { impactOfCategory, type DealSection } from './dealSections';
import {
  costLineTotal, isMonthlyKind, isVariableFixed, SERVICE_INVESTMENT_BP, serviceInvestmentExtra,
  type CostLine, type DealKind, type EconInput, type EconItem, type EconResult, type EconSettings,
} from './finance';

const CONTRACT_CONSUMPTION_VERSION = 'CONTRACT-CONSUMPTION-1';

export type ContractConsumption = {
  rateBp: number;
  groups: { kind: DealKind | null; section: number | null; oneTimeCents: number | null; monthlyCents: number | null; inferenceCents: number | null; inferenceMonthly: boolean }[];
};

/** O preço aceito é a entrada. Só a base elegível de serviço recebe o percentual vigente. */
export function contractConsumption(input: EconInput, items: Pick<EconItem, 'kind' | 'section'>[], settings: Pick<EconSettings, 'serviceCostBp'>): ContractConsumption {
  const rateBp = settings.serviceCostBp ?? SERVICE_INVESTMENT_BP;
  const group = (kind: DealKind | null, section: number | null, unique: CostLine[], monthly: CostLine[]) => {
    const sum = (lines: CostLine[]) => lines.reduce((total, line) => total + costLineTotal(line), 0);
    const base = unique.filter((line) => !isVariableFixed(line.impact) && (section == null || line.category != null));
    return {
      kind, section, oneTimeCents: unique.length ? sum(unique) : null, monthlyCents: monthly.length ? sum(monthly) : null,
      inferenceCents: kind && kind !== 'venda' && base.length ? serviceInvestmentExtra(sum(base), rateBp) : null,
      inferenceMonthly: kind != null && isMonthlyKind(kind),
    };
  };

  if (input.sections?.length && input.pricingMode !== 'global') {
    const bySection = (section: DealSection, index: number) => {
      const products = items.filter((item) => (item.section ?? 0) === index);
      const kind = section.kind === 'venda' && products.length && products.every((item) => item.kind === 'servico') ? 'servico' : section.kind;
      const costs = section.costs.map((line) => ({ ...line, impact: line.category ? impactOfCategory(line.category, line.frequency) : null }));
      return group(kind, index, costs.filter((line) => line.frequency === 'unico'), costs.filter((line) => line.frequency === 'mensal'));
    };
    return { rateBp, groups: input.sections.flatMap((section, index) => section.costs.length ? [bySection(section, index)] : []) };
  }

  const kinds = new Set([...input.capex, ...input.opex].map((line) => line.kind ?? null));
  return { rateBp, groups: [...kinds].map((kind) => group(kind, null,
    input.capex.filter((line) => (line.kind ?? null) === kind), input.opex.filter((line) => (line.kind ?? null) === kind))) };
}

/** Mantém o formato das fotografias para os leitores históricos e identifica os indicadores indisponíveis. */
export function contractConsumptionResult(input: EconInput, items: EconItem[], settings: EconSettings, publicSector: boolean): EconResult {
  const consumption = contractConsumption(input, items, settings);
  const oneTimeCents = consumption.groups.reduce((sum, group) => sum + (group.oneTimeCents ?? 0), 0);
  const monthlyCents = consumption.groups.reduce((sum, group) => sum + (group.monthlyCents ?? 0), 0);
  return {
    engineVersion: CONTRACT_CONSUMPTION_VERSION, contractConsumption: consumption, mode: input.mode, publicSector,
    revenueCents: input.mode === 'recorrente' ? monthlyCents : oneTimeCents, priceCents: null, priceSource: 'informado',
    rates: { a: 0, b: 0, c: 0, g: 0, m: 0, r: 0 }, fixedTaxCents: 0,
    initialCents: 0, monthlyCostCents: 0, capexBaseCents: 0, capexContingencyCents: 0, opexBaseCents: 0, opexContingencyCents: 0,
    term: { N: 0, D: 0, Dalvo: 0, d: 0 }, items: [], floor: { cashCents: null, economicCents: null, minCents: null },
    marginPriceCents: null, recommendedCents: null, suggestedCents: null, kpi: null, cashflow: [], marginOk: null, paybackOk: null,
    verdict: 'sem_preco', withinPolicy: null, withReservations: false, warnings: [],
  };
}
