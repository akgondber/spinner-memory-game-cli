#!/usr/bin/env node

import readline from "readline";
import { Command, Option, Cli, Builtins } from "clipanion";
import Table from "cli-table3";
import chalk from "chalk";
import { shuffle } from "fast-shuffle";
import cliSpinners from "cli-spinners";
import logUpdate from "log-update";
import figureSet from "figures";
import * as R from "rambda";

const indexedMap = R.addIndex(R.map);
const flipConcat = R.flip(R.concat);
const successSym = chalk.green(figureSet.tick);
const errorSym = chalk.red(figureSet.cross);
const menuCompose = R.compose(R.flip(R.concat)("\n"), R.join("  "));

const [node, app, ...args] = process.argv;

const fillArrayFn = (n, fn) => {
  return R.times(fn, n);
};
const isZero = R.equals(0);
const isPropActive = R.propEq(true, "active");
const isPropSelected = R.propEq(true, "selected");
const setActive = R.set(R.lensProp("active"), true);
const unsetActive = R.set(R.lensProp("active"), false);
const joinN = R.join("\n");
const findActiveItem = R.find(isPropActive);

const getRandomLocation = (rows, columns) => {
  let rowsArray = fillArrayFn(rows, (i) => i);
  let columnsArray = fillArrayFn(columns, (i) => i);

  return {
    x: rowsArray[Math.floor(Math.random() * rowsArray.length)],
    y: columnsArray[Math.floor(Math.random() * columnsArray.length)],
  };
};

const swapItems = (sourceSequence, activeItem, swapableItem) => {
  return R.map((el) => {
    if (
      R.converge(R.or)([
        R.eqProps("i", swapableItem),
        R.eqProps("i", activeItem),
      ])(el)
    ) {
      const newI = R.eqProps("i", el, activeItem)
        ? swapableItem.i
        : activeItem.i;

      return R.merge(el, { i: newI });
    }

    return el;
  }, sourceSequence);
};

const preparatorySpinners = [
  "dots4",
  "bouncingBar",
  "binary",
  "pipe",
  "triangle",
  "arc",
  "line",
  "bouncingBall",
  "balloon",
];
const funnierSpinners = [
  "monkey",
  "clock",
  "hearts",
  "moon",
  "runner",
  "christmas",
  "fingerDance",
  "orangePulse",
  "earth",
];

class RememberSequenceGameCommand extends Command {
  filler = Option.String("--filler", "+");
  runImmediately = Option.Boolean("--run", true);
  funnySpinners = Option.Boolean("--funny", false);
  s = "";
  subs = [[], [], []];
  usingSpinnersRound = [];
  userAnswersSequence = [];
  usingSpinners = [];
  gameInterval = null;
  promptInterval = null;
  info = menuCompose([
    `${chalk.bold("n")} - ${chalk.bold("start a new round")}`,
    `${chalk.bold("q")} - ${chalk.bold("quit")}`,
  ]);
  result = "";
  gameOver = false;
  isRunning = false;
  isPrompting = false;
  showDescription = true;

  async execute() {
    this.firstRun = !this.runImmediately;
    if (this.runImmediately) this.startGameRound();
    this.registerKeypressHandler();
  }

  getDisplayString() {
    const sequenceTable = new Table({});
    const sortedItems = R.sortBy(
      R.prop(this.gameOver ? "realI" : "i"),
      this.userAnswersSequence,
    );

    sortedItems.map((el) => {
      const number = R.inc(el.i);
      const correctNumber = R.inc(
        this.usingSpinnersSequence.findIndex((a) => a === el.name),
      );
      const currentFrame = el.spinner.frames[el.showingIndex];

      if (this.gameOver) {
        const correctIndex = this.usingSpinnersSequence.findIndex(
          (a) => a === el.name,
        );
        const isCorrect = correctIndex === el.i;

        return sequenceTable.push([
          `${isCorrect ? successSym : errorSym} ${number}`,
          currentFrame,
          el.name,
          `${successSym} ${correctNumber}`,
        ]);
      }
      const radioSym = el.selected ? figureSet.radioOn : figureSet.radioOff;

      return sequenceTable.push([
        el.active ? figureSet.pointer + radioSym : "  ",
        number,
        currentFrame,
        el.name,
      ]);
    });

    const spinnersToShow = sequenceTable.toString();
    const hasSelected = R.any(
      R.propEq(true, "selected"),
      this.userAnswersSequence,
    );

    const helpMessage = joinN([
      "Sequence of spinners occurences was shuffled.",
      "Try to restore a correct sequence.",
    ]);
    const keysInfo = joinN([
      R.join("  ")([
        `${chalk.bold.cyan(figureSet.arrowUp)}/${chalk.bold.cyan(figureSet.arrowDown)} - ${hasSelected ? "swap selected item with previous/next one" : "activate previous/next item"}`,
        `${chalk.bold.cyan("<space>")} - ${chalk.bold(`${hasSelected ? "place selected spinner" : "select active spinner to move"}`)}`,
      ]),
      R.join("  ")([
        `${chalk.bold.cyan("<1>")},${chalk.bold.cyan("<2>")}..${chalk.bold.cyan("<9>")} - ${hasSelected ? "swap selected item to one with specified number" : "go to item at number"}`,
        `${chalk.bold.cyan("s")} - submit`,
      ]),
    ]);
    const resultAtTop = R.ifElse(
      R.isEmpty,
      R.always(""),
      flipConcat("\n\n"),
    )(this.result);
    const infoAtTop = this.gameOver
      ? resultAtTop
      : this.isPrompting
        ? `${helpMessage}\n\n${keysInfo}\n`
        : "";
    const description = joinN([
      `Train your memory with ${chalk.cyan("spinner-memory-game-cli")}`,
      "Spinners one by one will be appeared during specific period of time in a random position of a table",
      "Your task is to rmember their appearences sequence and match the correspondence of spinners to their appearance numbers.",
    ]);
    const stringAtTop = this.firstRun ? description : infoAtTop;
    return `${stringAtTop}${spinnersToShow}\n\n${this.info}`;
  }

  startGameRound() {
    this.usingSpinnersSequence = shuffle(
      this.funnySpinners ? funnierSpinners : preparatorySpinners,
    );
    this.usingSpinners = this.usingSpinnersSequence.map(
      (name) => cliSpinners[name],
    );
    this.userAnswersSequence = [];
    this.gameOver = false;
    this.isRunning = true;
    this.firstRun = false;
    this.isPrompting = false;
    this.usingSpinnersRound = indexedMap(
      (spinner, i) => ({
        i,
        spinner,
        name: this.usingSpinnersSequence[i],
        active: R.equals(3, i),
        selected: R.equals(3, i),
      }),
      this.usingSpinners,
    );
    this.result = "";
    if (this.promptInterval) {
      clearInterval(this.promptInterval);
      this.promptInterval = null;
    }

    let framesCounter = 0;
    let currentFrame = this.usingSpinners[0];
    let frameIndex = 0;
    const rowCount = 10;
    const columnCount = 10;
    const filler = this.filler || "+";
    let rows = [];
    let i = 0;

    for (let m = 0; m < rowCount; m++) {
      rows[m] = rows[m] || [];
      for (let n = 0; n < columnCount; n++) {
        rows[m].push(filler);
      }
    }
    let lc = getRandomLocation(rowCount, columnCount);
    let intervalCounter = 0;
    let passedFrames = [];
    let roundTable = new Table({});
    let needsUpd = true;
    this.gameInterval = setInterval(async () => {
      if (i === currentFrame.frames.length) {
        i = 0;
      }

      if (
        framesCounter === currentFrame.frames.length &&
        intervalCounter >= 20
      ) {
        passedFrames.push(currentFrame);
        framesCounter = 0;
        frameIndex++;
        if (frameIndex === this.usingSpinners.length) {
          clearInterval(this.gameInterval);
          this.isPrompting = true;
          const sequentialIndexes = R.pluck("i", this.usingSpinnersRound);
          const shuffledIndexes = shuffle(sequentialIndexes);
          this.userAnswersSequence = indexedMap(
            (item, i) =>
              R.merge(item, {
                showingIndex: 0,
                i: shuffledIndexes[i],
                realI: sequentialIndexes[i],
              }),
            this.usingSpinnersRound,
          );
          this.promptInterval = setInterval(() => {
            this.userAnswersSequence = R.map((item) => {
              if (item.showingIndex === item.spinner.frames.length - 1) {
                return R.set(R.lensProp("showingIndex"), 0, item);
              }

              return R.over(R.lensProp("showingIndex"), R.inc, item);
            }, this.userAnswersSequence);
            logUpdate(this.getDisplayString());
          }, 200);

          logUpdate(this.getDisplayString());
          return;
        }
        currentFrame = this.usingSpinners[frameIndex];
        lc = getRandomLocation(rowCount, columnCount);
        intervalCounter = 0;

        needsUpd = true;
      } else if (
        framesCounter === currentFrame.frames.length &&
        intervalCounter < 20
      ) {
        framesCounter = 0;
        needsUpd = false;
      } else if (
        framesCounter < currentFrame.frames.length &&
        intervalCounter < 20
      ) {
        needsUpd = true;
      }

      roundTable = new Table({});

      rows.map((item, k) => {
        roundTable.push(
          item.map((current, l) =>
            k === lc.x && l === lc.y ? currentFrame.frames[i] : current,
          ),
        );
      });

      i++;
      if (framesCounter < currentFrame.frames.length) {
        framesCounter++;
      }
      if (needsUpd) intervalCounter++;
      logUpdate(
        `  Remember spinners occurences sequence\n${roundTable.toString()}`,
      );
    }, 100);
  }

  registerKeypressHandler() {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    logUpdate(this.getDisplayString());
    process.stdin.on("keypress", (_chunk, key) => {
      const spinnerCount = this.usingSpinnersRound.length;

      if (key && key.name == "q") {
        if (this.gameInterval) {
          clearInterval(this.gameInterval);
        }
        if (this.promptInterval) {
          clearInterval(this.promptInterval);
        }
        process.exit();
      } else if (key && key.name == "n") {
        this.usingSpinnersSequence = shuffle(preparatorySpinners);
        this.result = "";
        logUpdate(this.getDisplayString());
        this.startGameRound();
      } else if ("123456789".includes(key.name)) {
        if (!this.isPrompting) return;

        const activeSelectedItem = R.find(
          R.both(isPropSelected, isPropActive),
          this.userAnswersSequence,
        );

        if (activeSelectedItem) {
          const swapableItem = R.find(
            R.propEq(+key.name - 1, "i"),
            this.userAnswersSequence,
          );
          if (swapableItem) {
            this.userAnswersSequence = swapItems(
              this.userAnswersSequence,
              activeSelectedItem,
              swapableItem,
            );
          }
        } else {
          const itemToActivate = R.find(
            R.propEq(+key.name - 1, "i"),
            this.userAnswersSequence,
          );
          if (itemToActivate) {
            const currentActiveItem = findActiveItem(this.userAnswersSequence);
            if (currentActiveItem) {
              this.userAnswersSequence = R.map((item) => {
                if (item.i === currentActiveItem.i)
                  return R.merge(item, { active: false });
                if (item.i === itemToActivate.i)
                  return R.merge(item, { active: true });
                return item;
              }, this.userAnswersSequence);
            }
          }
        }
      } else if (key.name === "space") {
        if (!this.isPrompting) return;

        const activeItem = R.findIndex(isPropActive, this.userAnswersSequence);
        this.userAnswersSequence = R.adjust(
          activeItem,
          R.over(R.lensProp("selected"), R.not),
          this.userAnswersSequence,
        );
      } else if (key.name === "down") {
        if (!this.isPrompting) return;

        const activeItem = R.find(isPropActive, this.userAnswersSequence);
        const maxIndex = R.dec(this.usingSpinnersRound.length);
        const nextIndex = R.ifElse(
          R.equals(maxIndex),
          R.always(0),
          R.inc,
        )(activeItem.i);

        if (activeItem.selected) {
          const swapableItem = R.find(
            (item) => item.i === nextIndex,
            this.userAnswersSequence,
          );
          if (swapableItem) {
            this.userAnswersSequence = swapItems(
              this.userAnswersSequence,
              activeItem,
              swapableItem,
            );
          }
        } else {
          this.userAnswersSequence = R.map((el) => {
            if (el.i === nextIndex) return setActive(el);
            if (R.eqProps("i", activeItem, el)) return unsetActive(el);
            return el;
          }, this.userAnswersSequence);
        }
      } else if (key.name === "up") {
        if (!this.isPrompting) return;

        const activeItem = R.find(isPropActive, this.userAnswersSequence);
        const previousIndex = R.ifElse(
          isZero,
          R.always(R.dec(spinnerCount)),
          R.dec,
        )(activeItem.i);
        if (activeItem.selected) {
          const swapableItem = R.find(
            (item) => item.i === previousIndex,
            this.userAnswersSequence,
          );

          if (swapableItem) {
            this.userAnswersSequence = swapItems(
              this.userAnswersSequence,
              activeItem,
              swapableItem,
            );
          }
        } else {
          this.userAnswersSequence = R.map((el) => {
            if (el.i === previousIndex) return setActive(el);
            if (R.eqProps("i", activeItem, el)) return unsetActive(el);
            return el;
          }, this.userAnswersSequence);
        }
      } else if (key.name === "s" || key.name === "return") {
        if (!this.isPrompting) return;
        this.gameOver = true;
        this.isRunning = false;
        const correctAnswers = R.count(
          (item) =>
            R.propEq(
              R.findIndex(R.equals(item.name), this.usingSpinnersSequence),
              "i",
              item,
            ),
          this.userAnswersSequence,
        );
        this.result = R.concat("     ")(
          correctAnswers === this.usingSpinners.length
            ? `${successSym} You won!`
            : `${errorSym} You lost (${correctAnswers} out of ${this.usingSpinnersRound.length})`,
        );
      }

      logUpdate(this.getDisplayString());
    });
  }
}

const cli = new Cli({
  binaryLabel: `spinner-memory-game`,
  binaryName: `${node} ${app}`,
  binaryVersion: `1.0.0`,
});

cli.register(Builtins.HelpCommand);
cli.register(RememberSequenceGameCommand);

cli.runExit(args);
