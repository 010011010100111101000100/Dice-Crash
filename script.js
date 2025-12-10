// === Daily Roll Limit ===
const MAX_ROLLS = 3;

// Load roll count from localStorage
function getRollsToday() {
    const data = JSON.parse(localStorage.getItem("diceRollData")) || {};
    const today = new Date().toDateString();

    if (data.date !== today) {
        localStorage.setItem("diceRollData", JSON.stringify({ date: today, rolls: 0 }));
        return 0;
    }
    return data.rolls;
}

function incrementRolls() {
    const today = new Date().toDateString();
    const data = { date: today, rolls: getRollsToday() + 1 };
    localStorage.setItem("diceRollData", JSON.stringify(data));
}

// === Dice Rolling Logic ===
const dice = document.getElementById("dice");
const resultText = document.getElementById("result");
const rollBtn = document.getElementById("rollBtn");

let rolling = false;

// Random side rotation combos to simulate physics
const rotations = [
    { x: 360, y: 360 },
    { x: 720, y: 360 },
    { x: 360, y: 720 },
    { x: 720, y: 720 },
    { x: 1080, y: 720 },
    { x: 720, y: 1080 }
];

function rollDice() {
    if (rolling) return;

    let rollsToday = getRollsToday();
    if (rollsToday >= MAX_ROLLS) {
        resultText.textContent = "❌ You've used all 3 rolls for today.";
        return;
    }

    rolling = true;
    resultText.textContent = "Rolling…";

    const randomFace = Math.floor(Math.random() * 6) + 1;
    const r = rotations[Math.floor(Math.random() * rotations.length)];

    // Apply neon glow during rolling
    dice.classList.add("rolling");

    // Rotate dice
    dice.style.transform = `rotateX(${r.x}deg) rotateY(${r.y}deg)`;

    setTimeout(() => {
        dice.classList.remove("rolling");
        showFace(randomFace);
        resultText.textContent = "You rolled a " + randomFace + "!";
        incrementRolls();
        rolling = false;
    }, 1200);
}

function showFace(n) {
    // Snap to final angle for the face
    const faces = {
        1: "rotateX(0deg) rotateY(0deg)",
        2: "rotateX(-90deg) rotateY(0deg)",
        3: "rotateX(0deg) rotateY(90deg)",
        4: "rotateX(0deg) rotateY(-90deg)",
        5: "rotateX(90deg) rotateY(0deg)",
        6: "rotateX(180deg) rotateY(0deg)"
    };
    dice.style.transform = faces[n];
}

// Button handler
rollBtn.addEventListener("click", rollDice);

// Display remaining rolls on page load
document.addEventListener("DOMContentLoaded", () => {
    const rollsToday = getRollsToday();
    if (rollsToday >= MAX_ROLLS) {
        resultText.textContent = "❌ You've used all 3 rolls for today.";
    }
});
