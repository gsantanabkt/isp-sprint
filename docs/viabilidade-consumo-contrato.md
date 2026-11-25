# Viabilidade no Consumo de contrato

Discovery de 25/11/2026. Implementação autorizada em 25/11/2026.

## Requisito

O **Tipo de venda** selecionado na criação da oportunidade em `/opportunities` determina como interpretar a coluna **Valor unitário** destacada na área **Custos desta negociação**, na tela **Produtos e Serviços**. Os tipos de negócio dentro da oportunidade, como Venda e Recorrência, continuam organizando as linhas e sua apresentação.

Em Licitação, Adesão à Ata e Venda Consultiva, a coluna representa o custo unitário e o motor usa os mesmos cálculos atuais de formação de preço. Uma venda concluída pode gerar um contrato com os preços aceitos pelo cliente. Quando o cliente pede uma quantidade desses itens, o vendedor abre uma nova oportunidade de **Consumo de contrato** e lança ou importa os itens solicitados na mesma grade, com as respectivas quantidades e os preços unitários aceitos no contrato. Nessa oportunidade, a coluna representa o preço unitário de venda. A viabilidade usa apenas o valor das quantidades solicitadas para estimar o custo de serviço.

### Regras existentes dos tipos de negócio

Ao adicionar um tipo de negócio em **Produtos e Serviços**, o usuário escolhe **Venda**, **Instalação**, **Aluguel** ou **Recorrência**. Essas escolhas e a frequência da linha mantêm as regras atuais de valores mensais e únicos. O tipo de negócio **Venda** é repasse e fica fora da base de inferência. **Recorrência** é o caso predominante no Consumo de contrato e segue a elegibilidade e a periodicidade já aplicáveis. Em uma mesma oportunidade, o tratamento de uma linha depende do seu tipo de negócio, ainda que toda a oportunidade seja de Consumo de contrato.

## Implementação

- O servidor seleciona a regra pelo `saleKind` da oportunidade. A prévia em Produtos e Serviços e o salvamento usam a mesma função de domínio. O motor de formação de preço continua no caminho aplicado aos demais tipos de venda.
- A função mantém os subtotais conforme a coluna **Quando** e calcula a inferência sobre as linhas elegíveis de valor único, como na base de investimento do motor existente. Entrega e taxas fixas ficam fora da base. A inferência é pontual para Instalação e mensal para Recorrência e Aluguel. A taxa vigente pode ser zero, com 35% de fallback para versões antigas.
- O salvamento preserva a entrada, sem aprendizado de preço no catálogo de custos e sem sincronização automática com a grade superior de preços da proposta. O cálculo usa os campos já persistidos, inclusive para o editor por seções. As fotografias são identificadas por `CONTRACT-CONSUMPTION-1`, com histórico e exportação em CSV e PDF.
- A decisão da viabilidade de consumo segue para a gestão, com o mesmo controle de permissão, autoria, documentação fiscal e revisão da fotografia. A rota comercial mantém suas demais validações e dispensa a comparação com margem e payback para esse resultado, que é apenas uma inferência.

## O que o código faz hoje

- `OpportunityWorkspace.tsx` grava `saleKind` na oportunidade e permite alterá-lo. As quantidades e os preços para a inferência vêm das linhas preenchidas ou importadas na grade indicada. O painel `ContractItemsBox.tsx` atende ao Controle de Empenhos e segue seu próprio fluxo de reserva de saldo.
- `DealProducts.tsx` corresponde à grade e ao rodapé mostrados na imagem, identificados por **Custos desta negociação** e **Preço sugerido da cesta**. `DealSections.tsx` também exibe essa grade em outro caminho do código. Em `DealSections.tsx`, **Usar este preço** grava o valor nos produtos usados pela proposta e pelo contrato. A API também pode aprender preços das linhas lançadas como custo e atualizar o catálogo. Tratar um preço de venda como linha de custo pode afetar os dois caminhos.
- `computeEconomics` escolhe entre `sectionsEngine` e `financeEngine`. A prévia em tela também usa o domínio. O resultado completo alimenta a aprovação, a fotografia no fechamento, a exportação e outros painéis. Um retorno parcial no motor compartilhado deixaria esses consumidores sem campos que esperam receber.
- Em `finance.ts`, `serviceInvestmentExtra` aplica a taxa configurada e arredonda em centavos, com 35% como fallback. No motor atual, o valor é um acréscimo a uma base de custo elegível. `atProposed` e `investmentOutOfPrice` zeram esse acréscimo. `skipRecommendation` suprime partes da recomendação e o motor continua calculando. Nenhuma dessas flags equivale ao modo solicitado.

## Proposta de tela

Em **Produtos e Serviços**, manter a mesma grade, a listagem e as opções de digitação, colagem e importação, inclusive o formato da planilha. Para Consumo de contrato, usar **Itens para consumo do contrato** como título da grade e **Preço unitário de venda** como rótulo da coluna destacada. No rodapé e na aba **Viabilidade econômica**, mostrar **Valor do consumo** e **Inferência de custo de serviço**, com a taxa aplicada. Apresentar valores pontuais e mensais separadamente com a unidade de cada um. Se faltar preço unitário, mostrar **Informe o preço unitário de venda dos itens** no lugar da inferência.

Nesse fluxo, o resumo mostra os valores do consumo e da inferência no lugar dos indicadores de formação de preço. A escolha de **Consumo de contrato** ativa o modo automaticamente. A trava é interna, sem opção adicional para o vendedor.

## Proposta de cálculo e integração

1. Resolver o modo pelo `saleKind` persistido. Com `saleKind === 'consumo_contrato'`, usar a inferência isolada. Para qualquer outro tipo, seguir a entrada atual de `computeEconomics`.
2. Somar `quantidade solicitada × preço unitário de venda` para apurar o valor do consumo. Aplicar a taxa de **Inferência custo de serviço** vigente em `/settings/viability` (`serviceCostBp`) só à parcela que atende às regras atuais de inferência. Por exemplo, 5 unidades elegíveis a R$ 200 somam R$ 1.000 de consumo. Com taxa configurada de 35%, o custo estimado é R$ 350 na periodicidade aplicável. Uma linha de Venda entra no valor do consumo como repasse e gera zero de inferência. Preservar o preço aceito no contrato.
3. Compartilhar a regra entre prévia e API. O resultado de inferência indica seu modo explicitamente, para que resumo, aprovação, histórico e exportação interpretem a ausência de indicadores como parte do escopo do cálculo. Preservar as fotografias existentes e reavaliar o modo em rascunhos quando o tipo de venda mudar.
4. Usar o preço digitado, colado ou importado na grade indicada. Guardar sua semântica como preço de venda e impedir que alimente o aprendizado de preços no catálogo de custos. Ao revisar a integração com o valor da proposta, considerar que a grade superior tem uma entrada própria e que o relato não define sincronização entre as duas grades.

## Critérios de validação

- Em Consumo de contrato, a soma das linhas representa o valor comercial e o cálculo termina na inferência de custo de serviço. Testar taxa configurada, fallback, arredondamento, ausência de base e periodicidade aplicável.
- Conferir uma oportunidade de Consumo de contrato com Venda e Recorrência juntas. O repasse entra no valor do consumo e fica fora da base de inferência. Conferir também as regras de valores mensais e únicos para os quatro tipos de negócio.
- Ao mudar o tipo de venda em um rascunho, conferir que a prévia se atualiza e que os valores sejam revisados antes de salvar sob outra interpretação. Para Licitação, Adesão à Ata e Venda Consultiva, comparar os resultados antes e depois com as mesmas entradas, incluindo preço, margem, payback e decisão.
- Conferir a jornada de digitação ou seleção do valor, prévia, salvamento, reabertura e o comportamento acordado para aprovação. Confirmar que o preço não é alterado na proposta e o catálogo de custos não aprende o valor de venda. Na implementação, rodar a checagem TypeScript e os testes essenciais.

## Validação local

- `pnpm build` compilou a API e a interface. A checagem TypeScript foi executada com os `tsconfig.json` do projeto e os tipos de Node disponíveis no lockfile para os pacotes cujo `types: []` deixa `Buffer` de `eml.ts` sem declaração na execução padrão.
- O Vitest passou com 545 testes de domínio, 53 da interface e 24 de integração de viabilidade e aprovação. A integração usou um PostgreSQL temporário e verificou salvamento, reabertura, aprovação manual, exportação CSV e ausência de aprendizado no catálogo de custos.

## Conferência no GitHub e publicação

O checkout local é a base do Discovery. O MCP do GitHub foi usado em leitura para listar branches de homologação e abrir arquivos nas referências remotas. Em `gsantanabkt/isp-sprint`, `main` expõe `FINANCE-3.2` e `fix/viabilidade-custos-por-perfil` expõe `FINANCE-3.11.0`. Mesmo com a mesma versão nominal do motor local, o trecho remoto de `computeEconomics` dessa branch ainda chama diretamente `financeEngine`, enquanto o local também despacha as seções. O trecho conferido em `phsmartdev/isp-sprint` (`main`) inclui esse despacho. Essas verificações cobrem trechos específicos dos arquivos.

- Homologação — [motor na branch main](https://github.com/gsantanabkt/isp-sprint/blob/main/packages/domain/src/finance.ts#L47-L56) e [serviço de viabilidade na branch de custos por perfil](https://github.com/gsantanabkt/isp-sprint/blob/fix/viabilidade-custos-por-perfil/apps/api/src/services/economics.ts#L125-L137).
- Produção, referência de leitura — [serviço de viabilidade na branch main](https://github.com/phsmartdev/isp-sprint/blob/main/apps/api/src/services/economics.ts#L125-L137).

Quando houver implementação, publicar as modificações a partir da base local em uma nova branch de `gsantanabkt/isp-sprint`. Alterações em qualquer branch de `phsmartdev/isp-sprint` exigem solicitação explícita.
