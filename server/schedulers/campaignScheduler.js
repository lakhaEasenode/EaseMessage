const { getOrchestratorQueue } = require('../queues/campaignQueue');

/**
 * Initialize the scheduled campaign checker as a BullMQ repeatable job.
 * Replaces the old setInterval-based approach.
 *
 * The repeatable job:
 * - Runs every 30 seconds
 * - Survives process restarts (persisted in Redis)
 * - Guaranteed single execution (even with multiple processes)
 */
const startScheduler = async () => {
    const orchestratorQueue = getOrchestratorQueue();

    // Add repeatable job (idempotent — BullMQ deduplicates by repeat key)
    await orchestratorQueue.add('check-scheduled', {}, {
        repeat: { every: 30000 },
        removeOnComplete: true
    });

    console.log('Campaign scheduler started (BullMQ repeatable, every 30s)');
};

module.exports = { startScheduler };
