// Required modules
const crypto = require("crypto");
const readline = require("readline");
const { LocalStorage } = require("node-localstorage");

// Initialize storage
const localStorage = new LocalStorage("./scratch");
const args = process.argv.slice(2);

// Helper classes
class KeyGenerator {
  static generateKey() {
    return crypto.randomBytes(32).toString("hex");
  }
}

class HMACGenerator {
  static generateHMAC(key, message) {
    return crypto.createHmac("sha256", key).update(message).digest("hex");
  }
}

class RandomGenerator {
  static generate(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

// Main game class
class JarGame {
  constructor(diceSets) {
    this.diceSets = diceSets;
    this.key = KeyGenerator.generateKey();
    this.hmac = HMACGenerator.generateHMAC(this.key, diceSets.join(","));
    this.userScore = 0;
    this.computerScore = 0;
    this.roundsPlayed = 0;
    this.maxRounds = 3; // Limit to three rounds
  }

  static validateDiceSets(args) {
    if (args.length < 3) {
      throw new Error(
        "Error: You must provide at least 3 dice combinations. Example: node game.js 2,2,4,4,9,9 6,8,1,1,8,6 7,5,3,7,5,3"
      );
    }
    args.forEach((arg) => {
      const numbers = arg.split(",");
      if (numbers.length !== 6 || !numbers.every((num) => /^\d+$/.test(num))) {
        throw new Error(
          `Error: Invalid dice combination "${arg}". Each combination must contain exactly 6 integers separated by commas.`
        );
      }
    });
  }

  getDiceByIndex(index) {
    if (index < 0 || index >= this.diceSets.length) {
      throw new Error("Invalid index. Please choose a valid index.");
    }
    return this.diceSets[index].split(",");
  }

  updateScore(winner) {
    if (winner === "user") {
      this.userScore++;
    } else if (winner === "computer") {
      this.computerScore++;
    }
    this.roundsPlayed++;
  }

  printScores() {
    console.log(`Scores:`);
    console.log(`You: ${this.userScore}`);
    console.log(`Computer: ${this.computerScore}`);
  }

  checkGameEnd() {
    if (this.roundsPlayed >= this.maxRounds) {
      console.log("\nGame over!");
      if (this.userScore > this.computerScore) {
        console.log("Congratulations! You are the winner!");
      } else if (this.userScore < this.computerScore) {
        console.log("I win! Better luck next time.");
      } else {
        console.log("It's a tie! Great game.");
      }
      exitGame();
    }
  }
}

// Calculate probabilities
function calculateProbabilities(diceSets) {
  const probabilities = [];
  for (let i = 0; i < diceSets.length; i++) {
    probabilities[i] = [];
    for (let j = 0; j < diceSets.length; j++) {
      if (i === j) {
        probabilities[i][j] = "-";
      } else {
        probabilities[i][j] = calculateWinProbability(diceSets[i], diceSets[j]);
      }
    }
  }
  return probabilities;
}

function calculateWinProbability(userDice, opponentDice) {
  const userNumbers = userDice.split(",").map(Number);
  const opponentNumbers = opponentDice.split(",").map(Number);
  let userWins = 0;
  let totalRounds = 0;

  for (const userRoll of userNumbers) {
    for (const opponentRoll of opponentNumbers) {
      totalRounds++;
      if ((userRoll + opponentRoll) % 6 === userRoll % 6) {
        userWins++;
      }
    }
  }

  return (userWins / totalRounds).toFixed(4);
}

function printProbabilityTable(diceSets, probabilities) {
  console.log("\nProbability of the win for the user:");
  const header = `+-------------+${diceSets.map(() => "-------------+").join("")}`;
  const diceHeaders = diceSets.map((set) => `| ${set} `).join("");
  console.log(header);
  console.log(`| User dice v ${diceHeaders}|`);
  console.log(header);

  for (let i = 0; i < diceSets.length; i++) {
    const row = [`| ${diceSets[i]} `];
    for (let j = 0; j < diceSets.length; j++) {
      const cell = probabilities[i][j] === "-" ? "- (0.3333)" : probabilities[i][j];
      row.push(`| ${cell} `.padEnd(13));
    }
    console.log(row.join("") + "|");
    console.log(header);
  }
}
// Initialize the game
try {
  JarGame.validateDiceSets(args);
  const probabilities = calculateProbabilities(args);
  printProbabilityTable(args, probabilities); 
} catch (error) {
  console.error(error.message);
  process.exit(1);
}


const game = new JarGame(args);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// User interaction functions
function printHelp() {
  console.log("Commands:");
  console.log("X - Exit");
  console.log("? - Help");
  console.log("0-1 - Guess the turn");
  console.log("0-5 - Choose a number");
}

function askForGuess() {
  const randomBit = RandomGenerator.generate(0, 1);
  const hmac = HMACGenerator.generateHMAC(game.key, randomBit.toString());
  console.log(`Let's determine who will make the first move.`);
  console.log(`I chose a random value in the range 0..1 (HMAC=${hmac}).`);
  console.log("Try to guess my choice.");
  rl.question("Your choice (0 or 1): ", (input) => {
    if (input === "X") return exitGame();
    if (input === "?") {
      printHelp();
      return askForGuess();
    }

    if (input === "0" || input === "1") {
      console.log(`Your choice: ${input}`);
      console.log(`My choice: ${randomBit} (KEY=${game.key}).`);

      if (parseInt(input) === randomBit) {
        console.log("You guessed correctly! You go first.");
        userChooseDice();
      } else {
        console.log("You guessed wrong. I go first.");
        computerChooseDice();
        userChooseDice();
      }
    } else {
      console.log("Invalid input. Please enter 0 or 1.");
      askForGuess();
    }
  });
}

function userChooseDice() {
  console.log("Choose your dice:");
  game.diceSets.forEach((set, index) => {
    console.log(`${index} - ${set}`);
  });

  rl.question("Your choice: ", (input) => {
    if (input === "X") return exitGame();
    if (input === "?") {
      printHelp();
      return userChooseDice();
    }

    const index = parseInt(input, 10);
    if (isNaN(index) || index < 0 || index >= game.diceSets.length) {
      console.log("Invalid index. Please choose a valid index.");
      return userChooseDice();
    }

    const userDice = game.getDiceByIndex(index);
    console.log(`You chose the dice [${userDice.join(",")}].`);
    computerRoll(userDice, "user");
  });
}

function computerChooseDice() {
  const index = RandomGenerator.generate(0, game.diceSets.length - 1);
  const computerDice = game.getDiceByIndex(index);
  console.log(`I chose the dice [${computerDice.join(",")}].`);
  computerRoll(computerDice, "computer");
}

function computerRoll(dice, player) {
  const randomNum = RandomGenerator.generate(0, 5);
  const hmac = HMACGenerator.generateHMAC(game.key, randomNum.toString());
  console.log(`I chose a random value in the range 0..5 (HMAC=${hmac}).`);
  console.log("Add up your number modulo 6.");
  askForNumber(dice, randomNum, player);
}

function askForNumber(dice, randomNum, player) {
  rl.question("Your choice (0-5): ", (input) => {
    if (input === "X") return exitGame();
    if (input === "?") {
      printHelp();
      return askForNumber(dice, randomNum, player);
    }

    const userNum = parseInt(input, 10);
    if (isNaN(userNum) || userNum < 0 || userNum > 5) {
      console.log("Invalid choice. Please choose a number between 0 and 5.");
      return askForNumber(dice, randomNum, player);
    }

    console.log(`Your number: ${userNum}.`);
    console.log(`My number: ${randomNum}.`);
    const total = (userNum + randomNum) % 6;
    console.log(`The result (modulo 6) is: ${total}.`);

    const winner = total === userNum ? "user" : "computer";
    console.log(`${winner === "user" ? "You win this round!" : "I win this round!"}`);
    game.updateScore(winner);

    game.printScores();
    game.checkGameEnd(); 
    console.log("Let's play another round!");
    askForGuess();
  });
}

function exitGame() {
  console.log("Exiting the game.");
  game.printScores();
  rl.close();
}


