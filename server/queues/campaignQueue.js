const { Queue } = require('bullmq');
const { getRedisConnection } = require('../config/redis');

let campaignOrchestratorQueue = null;
let campaignMessageQueue = null;

const getOrchestratorQueue = () => {
    if (!campaignOrchestratorQueue) {
        campaignOrchestratorQueue = new Queue('campaign-orchestrator', {
            connection: getRedisConnection()
        });
    }
    return campaignOrchestratorQueue;
};

const getMessageQueue = () => {
    if (!campaignMessageQueue) {
        campaignMessageQueue = new Queue('campaign-messages', {
            connection: getRedisConnection(),
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000
                },
                removeOnComplete: { count: 1000 },
                removeOnFail: { count: 5000 }
            }
        });
    }
    return campaignMessageQueue;
};

const closeQueues = async () => {
    if (campaignOrchestratorQueue) {
        await campaignOrchestratorQueue.close();
        campaignOrchestratorQueue = null;
    }
    if (campaignMessageQueue) {
        await campaignMessageQueue.close();
        campaignMessageQueue = null;
    }
};

module.exports = { getOrchestratorQueue, getMessageQueue, closeQueues };
