export const branches = [
  { id: 'sham-royal', name: 'Sham Royal', active: true },
  { id: 'sham-aroos', name: 'Sham Aroos', active: true },
  { id: 'sham-aroos-vip', name: 'Sham Aroos VIP', active: true },
  { id: 'dollar', name: 'Dollar Department', active: true },
  { id: 'sham-shaban', name: 'Sham Shaban', active: false },
] as const;
export type ActiveBranchId = (typeof branches)[number]['id'] extends infer T
  ? Exclude<T, 'sham-shaban'>
  : never;
export function branchCurrency(id: string): 'AFN' | 'USD' {
  return id === 'dollar' ? 'USD' : 'AFN';
}
export function isActiveBranch(value: string): value is ActiveBranchId {
  return branches.some((branch) => branch.id === value && branch.active);
}
