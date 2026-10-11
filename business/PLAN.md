# Night Shift — business plan (draft)

_Built in **cfo.ai** from the costs we measured in live runs. Read-only links:_
- **Night Shift business plan** (pricing, costs, revenue, runway): https://app.cfo.ai/s/CsWafbQfu2U1y94W
- **Customer unit economics** (what an incident costs a support team; Night Shift prices every incident with it): https://app.cfo.ai/s/fHcCAy2lG_aXs3Qt

| Scenario (in cfo.ai) | Break-even | Lowest cash | Cash at M24 |
|---|---|---|---|
| Main | M08 | $98.2k | $831k |
| Slow sales (half the new customers) | M13 | $62.4k | $318k |
| LLM prices double | M08 | $97.7k | $819k |

The workspace also has a "Night incident" scenario: $22.5k lost when a bad release runs for 300 minutes
until someone wakes up. That's the number Night Shift exists to cut. The links open the Main scenario.
The tables below are the same model computed locally (`business/model.py`), so it can be reproduced.

## Pricing

| Tier | Price | Includes |
|---|---|---|
| Hobby | $0 | 1 agent; detection, investigations and postmortems; paging only — no autonomous actions |
| Team | $399/mo | up to 5 agents; autonomous containment under your policy; 60 investigations / month included |
| Scale | $1,990/mo | up to 25 agents; custom policies, SSO, audit export; priority support |

## Unit costs (measured)

| Item | Value | Source |
|---|---|---|
| LLM cost per investigation (Claude Sonnet) | $0.087 | mean of 6 live investigations in run3-live |
| replay verification per investigation | $0.036 | 6 replays × Haiku conversation cost (measured ~$0.006) |
| LLM cost per customer per month | $7.39 | 60 investigations/month |
| blended revenue per customer (ARPA) | $638/mo | 15% on Scale |
| COGS per customer | $48/mo | LLM + infra + payment fees |
| gross margin | 93% | ARPA vs COGS |

## 24-month forecast — break-even M08, runway >24 months

| Month | Customers | MRR | Costs | Net | Cash |
|---|---|---|---|---|---|
| M01 | 0 | $0 | $9,400 | $-9,400 | $140,600 |
| M02 | 0 | $0 | $9,400 | $-9,400 | $131,200 |
| M03 | 1 | $638 | $9,448 | $-8,810 | $122,390 |
| M04 | 3 | $1,894 | $11,042 | $-9,148 | $113,242 |
| M05 | 6 | $3,750 | $11,181 | $-7,431 | $105,811 |
| M06 | 10 | $6,188 | $11,363 | $-5,175 | $100,637 |
| M07 | 14 | $9,191 | $11,588 | $-2,397 | $98,240 |
| M08 | 20 | $12,741 | $11,853 | $888 | $99,127 |
| M09 | 26 | $16,822 | $17,659 | $-836 | $98,291 |
| M10 | 34 | $21,419 | $18,002 | $3,416 | $101,707 |
| M11 | 42 | $26,515 | $18,384 | $8,131 | $109,839 |
| M12 | 50 | $32,096 | $18,801 | $13,295 | $123,133 |
| M13 | 60 | $38,147 | $19,254 | $18,893 | $142,027 |
| M14 | 70 | $44,655 | $19,741 | $24,914 | $166,941 |
| M15 | 81 | $51,605 | $20,261 | $31,344 | $198,285 |
| M16 | 93 | $58,983 | $20,813 | $38,171 | $236,455 |
| M17 | 105 | $66,779 | $21,396 | $45,383 | $281,838 |
| M18 | 118 | $74,978 | $22,009 | $52,968 | $334,806 |
| M19 | 131 | $83,568 | $22,652 | $60,916 | $395,723 |
| M20 | 145 | $92,539 | $23,323 | $69,216 | $464,939 |
| M21 | 160 | $101,878 | $24,022 | $77,856 | $542,795 |
| M22 | 175 | $111,575 | $24,747 | $86,828 | $629,623 |
| M23 | 191 | $121,618 | $25,499 | $96,120 | $725,743 |
| M24 | 207 | $131,998 | $26,275 | $105,723 | $831,465 |

## Assumptions

- starting cash: 150000
- founders: 2
- founder monthly cost: 4500
- hire month: 9
- engineer monthly cost: 5500
- base infra monthly: 400
- infra per customer monthly: 18
- marketing monthly from m4: 1500
- price team: 399
- price scale: 1990
- scale share of paid: 0.15
- investigations per customer month: 60
- replays per investigation: 6
- replay cost: 0.006
- monthly logo churn: 0.03
- payment fees: 0.035
- new paid customers per month ramps from 0 to 22 over 24 months
