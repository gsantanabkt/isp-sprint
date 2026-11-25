import { describe, expect, it } from 'vitest';
import { contractConsumption } from './contractConsumption';
import { emptyEconInput, type CostLine } from './finance';

const line = (kind: CostLine['kind'], overrides: Partial<CostLine> = {}): CostLine => ({
  kind, description: 'Item contratado', qtyMilli: 5000, unitCents: 20000, impact: 'material', ...overrides,
});

describe('consumo de contrato', () => {
  it('separa repasse, instalação e serviço mensal, com o percentual só na base elegível', () => {
    const result = contractConsumption({
      ...emptyEconInput(),
      capex: [line('venda'), line('servico'), line('recorrencia'), line('locacao'), line('recorrencia', { impact: 'entrega' })],
      opex: [line('recorrencia')],
    }, [], { serviceCostBp: 3500 });

    expect(result.groups).toEqual([
      { kind: 'venda', section: null, oneTimeCents: 100000, monthlyCents: null, inferenceCents: null, inferenceMonthly: false },
      { kind: 'servico', section: null, oneTimeCents: 100000, monthlyCents: null, inferenceCents: 35000, inferenceMonthly: false },
      { kind: 'recorrencia', section: null, oneTimeCents: 200000, monthlyCents: 100000, inferenceCents: 35000, inferenceMonthly: true },
      { kind: 'locacao', section: null, oneTimeCents: 100000, monthlyCents: null, inferenceCents: 35000, inferenceMonthly: true },
    ]);
  });

  it('mantém taxa zero, arredonda em centavos e usa a taxa histórica se ausente', () => {
    const input = { ...emptyEconInput(), capex: [line('servico', { qtyMilli: 1500, unitCents: 3 })] };
    expect(contractConsumption(input, [], {}).groups[0]?.inferenceCents).toBe(2);
    expect(contractConsumption(input, [], { serviceCostBp: 0 }).groups[0]?.inferenceCents).toBe(0);
    expect(contractConsumption(emptyEconInput(), [], {}).groups).toEqual([]);
  });

  it('lê os consumos já salvos por seção sem converter o prazo das seções', () => {
    const input = {
      ...emptyEconInput(),
      sections: [
        { id: 's1', kind: 'venda' as const, termMonths: 12, receiveMonth: 0, costs: [{ ...line('servico'), category: 'mao_de_obra' as const, frequency: 'unico' as const }], marginTargetBp: null, paybackMonths: null, priceCents: null },
        { id: 's2', kind: 'recorrencia' as const, termMonths: 36, receiveMonth: 0, costs: [{ ...line('recorrencia'), category: 'materia_prima' as const, frequency: 'unico' as const }], marginTargetBp: null, paybackMonths: null, priceCents: null },
      ],
    };
    const result = contractConsumption(input, [{ kind: 'servico', section: 0 }], { serviceCostBp: 2000 });
    expect(result.groups).toMatchObject([
      { section: 0, kind: 'servico', inferenceCents: 20000, inferenceMonthly: false },
      { section: 1, kind: 'recorrencia', inferenceCents: 20000, inferenceMonthly: true },
    ]);
  });
});
