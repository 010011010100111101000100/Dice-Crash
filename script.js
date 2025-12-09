function rollDice() {
  return Math.floor(Math.random()*6)+1;
}

document.getElementById('rollBtn').onclick = function() {
  const n1 = parseInt(document.getElementById('num1').value);
  const n2 = parseInt(document.getElementById('num2').value);
  const d1 = rollDice();
  const d2 = rollDice();
  document.getElementById('result').innerText = `Rolled: ${d1} and ${d2}`;
  if (d1 === n1 && d2 === n2) {
    document.getElementById('winPopup').classList.remove('hidden');
  }
}

function closePopup() {
  document.getElementById('winPopup').classList.add('hidden');
}
