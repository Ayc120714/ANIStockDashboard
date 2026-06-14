/** Limit concurrent mobile API calls so one uvicorn worker is not stampeded. */
const MAX_INFLIGHT = 8;
let inflight = 0;
const waiters = [];

function pump() {
  while (inflight < MAX_INFLIGHT && waiters.length > 0) {
    const next = waiters.shift();
    inflight += 1;
    next();
  }
}

export function withRequestGate(fn) {
  return new Promise((resolve, reject) => {
    const run = () => {
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          inflight = Math.max(0, inflight - 1);
          pump();
        });
    };
    if (inflight < MAX_INFLIGHT) {
      inflight += 1;
      run();
    } else {
      waiters.push(run);
    }
  });
}
