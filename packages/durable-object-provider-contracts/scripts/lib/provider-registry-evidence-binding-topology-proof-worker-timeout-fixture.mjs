const timer = setInterval(() => {}, 1_000);

process.once("exit", () => clearInterval(timer));
