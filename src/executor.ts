/*
 * Executor that handles throttling and task processing rate.
 */

export type ExecutableTask = () => Promise<void>

export interface ExecutorOptions {
  maxRatePerSecond: number,
  maxConcurrentTasks: number,
  urlTimeout: number
}

export interface Executor {
  start: () => void,
  submit: (task: ExecutableTask) => void,
  stop: () => void
}

export default class AsynchronousExecutor implements Executor {
  maxRatePerSecond: number;
  maxConcurrentTasks: number;
  promiseTimeout: number;
  concurrentTaskNumber: number;
  queue: Array<ExecutableTask>;
  isStopped: boolean;
  timeoutMs: number;

  constructor({maxRatePerSecond, maxConcurrentTasks, urlTimeout}: ExecutorOptions) {
    this.maxRatePerSecond = maxRatePerSecond;
    this.maxConcurrentTasks = maxConcurrentTasks || Number.MAX_VALUE;
    this.promiseTimeout = urlTimeout;
    this.concurrentTaskNumber = 0;
    this.queue = [];
    this.isStopped = false;
    this.timeoutMs = (1 / this.maxRatePerSecond) * 1000;
  }

  submit(task: ExecutableTask) {
    this.queue.push(task);
  }

  start() {
    this.processQueueItem();
  }

  stop() {
    this.isStopped = true;
  }

  hasTooManyConcurrentTasks() {
    return this.concurrentTaskNumber >= this.maxConcurrentTasks;
  }

  processQueueItem() {
    if (this.isStopped) {
      return;
    }
    if (!this.hasTooManyConcurrentTasks()) {
      if (this.queue.length !== 0) {
        const nextExecution = this.queue.shift();
        this.concurrentTaskNumber++;

        let timeout = new Promise((resolve, reject) => {
            let id = setTimeout(() => {
                clearTimeout(id);
                resolve('Timed out in '+ this.promiseTimeout + 'ms.')
            }, this.promiseTimeout)
        })
        let execution = nextExecution()

        Promise.race([
            execution,
            timeout
        ]).then(() => {
          this.concurrentTaskNumber--;
        });
      }
    }
    setTimeout(() => {
      this.processQueueItem();
    }, this.timeoutMs);
  }
}
