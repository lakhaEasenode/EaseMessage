const { createOrchestratorWorker } = require('./campaignOrchestratorWorker');
const { createMessageWorker } = require('./campaignMessageWorker');
const { getOrchestratorQueue, closeQueues } = require('../queues/campaignQueue');

let orchestratorWorker = null;
let messageWorker = null;

/**
 * Start all campaign workers and set up the scheduled campaign checker.
 */
async function startWorkers() {
    console.log('Starting campaign workers...');

    // Create workers
    orchestratorWorker = createOrchestratorWorker();
    messageWorker = createMessageWorker();

    // Set up repeatable job for checking scheduled campaigns (every 30s)
    const orchestratorQueue = getOrchestratorQueue();
    await orchestratorQueue.add('check-scheduled', {}, {
        repeat: { every: 30000 },
        removeOnComplete: true
    });

    console.log('Campaign workers started (orchestrator + message worker)');
    console.log('Scheduled campaign checker running every 30s');
}

/**
 * Gracefully stop all workers and close queues.
 */
async function stopWorkers() {
    console.log('Stopping campaign workers...');

    if (orchestratorWorker) {
        await orchestratorWorker.close();
        orchestratorWorker = null;
    }
    if (messageWorker) {
        await messageWorker.close();
        messageWorker = null;
    }

    await closeQueues();
    console.log('Campaign workers stopped');
}

module.exports = { startWorkers, stopWorkers };
