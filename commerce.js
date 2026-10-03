import {PROTOTYPE_BOM} from './commerce-data.js';

const $ = selector => document.querySelector(selector);
const money = cents => `¥${(cents / 100).toFixed(2)}`;
const total = PROTOTYPE_BOM.reduce((sum, item) => sum + item.cents, 0);
const rows = PROTOTYPE_BOM.map(item => {
  const row = document.createElement('tr');
  const name = document.createElement('th');
  name.scope = 'row'; name.textContent = item.name;
  const cost = document.createElement('td'); cost.textContent = money(item.cents);
  row.append(name, cost); return row;
});
$('#bomRows').replaceChildren(...rows);
$('#bomTotal').textContent = (total / 100).toFixed(2);
$('#bomTableTotal').textContent = money(total);
