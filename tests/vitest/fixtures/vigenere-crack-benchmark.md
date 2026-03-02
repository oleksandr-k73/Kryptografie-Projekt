# Vigenere Crack Benchmark (2026-03-01)

## Budget Regression
| Budget | Runtime ms | Success | Best key | States generated | States evaluated |
|---|---:|---|---|---:|---:|
| 1M | 5797 | yes | BRICK | 161051 | 60000 |
| 10M | 5715 | yes | BRICK | 161051 | 60000 |
| n^L | 5561 | yes | BRICK | 161051 | 60000 |

## Sample Suite (n=100)
| Bucket | Cases | Success | Avg ms |
|---|---:|---:|---:|
| short | 1 | 100.0% | 2661.0 |
| medium | 64 | 89.1% | 652.2 |
| long | 35 | 97.1% | 883.7 |

- Overall success: 92.0%
- Overall avg runtime: 753.3 ms

## 10k Projection
- Projected runtime: 2.09 h
- Projected success rate: 92.0%
- Target window (1.0-2.5h) met: yes
